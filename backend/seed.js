require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Equipment = require('./models/Equipment');
const Tag = require('./models/Tag');
const User = require('./models/User');
const Settings = require('./models/Settings');
const Recipient = require('./models/Recipient');
const Zone = require('./models/Zone');
const Reader = require('./models/Reader');

const forceFlag = process.argv.includes('--force');
if (process.env.NODE_ENV === 'production' && !forceFlag) {
  console.error('Refusing to seed in production without --force.');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    Equipment.deleteMany({}),
    Tag.deleteMany({}),
    User.deleteMany({}),
    Settings.deleteMany({}),
    Recipient.deleteMany({}),
    Zone.deleteMany({})
  ]);

  // Create zones
  const zoneA = await Zone.create({ name: 'Zone A - Test Bay', description: 'Primary test bay' });
  const zoneB = await Zone.create({ name: 'Zone B - Paint Shop', description: 'Paint and finishing zone' });

  // Each physical gate uses two antenna ports: one for exit and one for entry.
  await Reader.create([
    { readerId: 'Shutter-1', name: 'Zone A - Test Bay exit', description: 'North gate exit antenna', zone: zoneA._id, antennaPort: 1, direction: 'EXIT', status: 'ONLINE' },
    { readerId: 'Shutter-1-Entry', name: 'Zone A - Test Bay entry', description: 'North gate entry antenna', zone: zoneA._id, antennaPort: 2, direction: 'ENTRY', status: 'ONLINE' },
    { readerId: 'Shutter-2', name: 'Zone B - Paint Shop exit', description: 'South gate exit antenna', zone: zoneB._id, antennaPort: 3, direction: 'EXIT', status: 'ONLINE' },
    { readerId: 'Shutter-2-Entry', name: 'Zone B - Paint Shop entry', description: 'South gate entry antenna', zone: zoneB._id, antennaPort: 4, direction: 'ENTRY', status: 'ONLINE' }
  ]);

  // Create sample equipment
  const equip1 = await Equipment.create({ name: 'Torque Wrench', category: 'Tool', quantity: 5 });
  const equip2 = await Equipment.create({ name: 'Diagnostic Scanner', category: 'Electronics', quantity: 2 });
  const equip3 = await Equipment.create({ name: 'Safety Vest', category: 'PPE', quantity: 10 });

  // Create tags covering all states (Test scenarios)
  const tags = [
    {
      tagId: 'TAG-001',
      equipment: equip1._id,
      assignedZone: zoneA._id,
      currentZone: zoneA._id,
      status: 'ACTIVE',
      location: 'IN_ZONE',
      alertStatus: 'NONE'
    },
    {
      tagId: 'TAG-002',
      equipment: equip2._id,
      assignedZone: zoneA._id,
      currentZone: zoneB._id,
      status: 'TEMP_DISABLED',
      location: 'IN_ZONE',
      disabledUntil: new Date(Date.now() + 60000),
      disableReason: 'Authorized borrow until testing complete'
    },
    {
      tagId: 'TAG-003',
      equipment: equip3._id,
      assignedZone: zoneB._id,
      currentZone: null,
      status: 'PERMANENT_DISABLED',
      location: 'OUTSIDE',
      disableReason: 'Lost in field',
      alertStatus: 'NONE'
    }
  ];

  await Tag.insertMany(tags);

  // Create users with fallback passwords if env vars not set
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin123');
  const userPassword = process.env.SEED_USER_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'user123');
  if (process.env.NODE_ENV === 'production' && (!adminPassword || !userPassword)) {
    console.error('SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD must be set in production mode');
    process.exit(1);
  }
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const userHash = await bcrypt.hash(userPassword, 10);
  await User.create([
    { username: 'admin', passwordHash: adminHash, role: 'ADMIN', active: true },
    { username: 'engineer1', passwordHash: userHash, role: 'USER', active: true }
  ]);

  // Default settings
  await Settings.create({});

  // Sample recipient
  await Recipient.create({ email: 'lab-supervisor@example.com', name: 'Lab Supervisor' });

  console.log('Seed data inserted successfully');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
