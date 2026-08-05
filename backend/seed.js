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
const Device = require('./models/Device');
const DeviceGroup = require('./models/DeviceGroup');
const AlertTargetGroup = require('./models/AlertTargetGroup');
const AlertFlow = require('./models/AlertFlow');

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
    Zone.deleteMany({}),
    Reader.deleteMany({}),
    Device.deleteMany({}),
    DeviceGroup.deleteMany({}),
    AlertTargetGroup.deleteMany({}),
    AlertFlow.deleteMany({})
  ]);

  // Create zones with more granular testing areas
  const zoneA = await Zone.create({ name: 'Zone A - Test Bay', description: 'Primary test bay — engine and chassis testing' });
  const zoneB = await Zone.create({ name: 'Zone B - Paint Shop', description: 'Paint and finishing zone' });
  const zoneC = await Zone.create({ name: 'Zone C - Assembly Line', description: 'Final assembly and quality check' });
  const zoneD = await Zone.create({ name: 'Zone D - Tool Crib', description: 'Central tool storage and checkout' });

  // ── Readers ──────────────────────────────────────
  // Each physical gate uses two antenna ports: one for exit and one for entry.
  // Additional internal readers cover equipment zones and tool crib.
  await Reader.create([
    // Zone A — Test Bay (2 gates: north + east)
    { readerId: 'Shutter-1', name: 'Zone A exit - North gate', description: 'North gate exit antenna — test bay', zone: zoneA._id, antennaPort: 1, direction: 'EXIT', status: 'ONLINE' },
    { readerId: 'Shutter-1-Entry', name: 'Zone A entry - North gate', description: 'North gate entry antenna', zone: zoneA._id, antennaPort: 2, direction: 'ENTRY', status: 'ONLINE' },
    { readerId: 'Shutter-3', name: 'Zone A exit - East gate', description: 'East gate exit antenna — test bay overflow', zone: zoneA._id, antennaPort: 5, direction: 'EXIT', status: 'ONLINE' },
    { readerId: 'Shutter-3-Entry', name: 'Zone A entry - East gate', description: 'East gate entry antenna', zone: zoneA._id, antennaPort: 6, direction: 'ENTRY', status: 'ONLINE' },

    // Zone B — Paint Shop (1 gate)
    { readerId: 'Shutter-2', name: 'Zone B exit - South gate', description: 'South gate exit antenna — paint shop', zone: zoneB._id, antennaPort: 3, direction: 'EXIT', status: 'ONLINE' },
    { readerId: 'Shutter-2-Entry', name: 'Zone B entry - South gate', description: 'South gate entry antenna', zone: zoneB._id, antennaPort: 4, direction: 'ENTRY', status: 'ONLINE' },

    // Zone C — Assembly Line (internal zone reader)
    { readerId: 'Reader-C1', name: 'Assembly line exit', description: 'Assembly line exit antenna', zone: zoneC._id, antennaPort: 7, direction: 'EXIT', status: 'ONLINE' },
    { readerId: 'Reader-C2', name: 'Assembly line entry', description: 'Assembly line entry antenna', zone: zoneC._id, antennaPort: 8, direction: 'ENTRY', status: 'ONLINE' },

    // Zone D — Tool Crib (internal check-in/out)
    { readerId: 'Tool-Crib-Exit', name: 'Tool crib exit gate', description: 'Tool crib exit antenna — tools leaving storage', zone: zoneD._id, antennaPort: 9, direction: 'EXIT', status: 'ONLINE' },
    { readerId: 'Tool-Crib-Entry', name: 'Tool crib entry gate', description: 'Tool crib entry antenna — tools returning', zone: zoneD._id, antennaPort: 10, direction: 'ENTRY', status: 'ONLINE' }
  ]);

  // ── IP Horn Speakers (AKOM SH-30) ─────────────────
  // One speaker per zone so alarms are heard locally.
  const speakers = await Device.create([
    {
      name: 'Speaker - Zone A (Test Bay)',
      type: 'SPEAKER',
      endpoint: process.env.SPEAKER_A_ENDPOINT || 'http://192.168.1.101:8080',
      secret: process.env.SPEAKER_A_SECRET || 'akom-secret-a',
      zone: zoneA._id,
      active: true
    },
    {
      name: 'Speaker - Zone B (Paint Shop)',
      type: 'SPEAKER',
      endpoint: process.env.SPEAKER_B_ENDPOINT || 'http://192.168.1.102:8080',
      secret: process.env.SPEAKER_B_SECRET || 'akom-secret-b',
      zone: zoneB._id,
      active: true
    },
    {
      name: 'Speaker - Zone C (Assembly Line)',
      type: 'SPEAKER',
      endpoint: process.env.SPEAKER_C_ENDPOINT || 'http://192.168.1.103:8080',
      secret: process.env.SPEAKER_C_SECRET || 'akom-secret-c',
      zone: zoneC._id,
      active: true
    },
    {
      name: 'Speaker - Zone D (Tool Crib)',
      type: 'SPEAKER',
      endpoint: process.env.SPEAKER_D_ENDPOINT || 'http://192.168.1.104:8080',
      secret: process.env.SPEAKER_D_SECRET || 'akom-secret-d',
      zone: zoneD._id,
      active: true
    },
    {
      name: 'Speaker - Main Hall (Global Alarm)',
      type: 'SPEAKER',
      endpoint: process.env.SPEAKER_MAIN_ENDPOINT || 'http://192.168.1.100:8080',
      secret: process.env.SPEAKER_MAIN_SECRET || 'akom-secret-main',
      zone: null, // zone=null means global — always triggered
      active: true
    }
  ]);

  // ── Device Groups ─────────────────────────────────
  // Organize speakers into groups that can be referenced by alert flows.
  const groupA = await DeviceGroup.create({
    name: 'Zone A Speakers',
    description: 'Speakers covering the Test Bay area',
    speakers: [speakers[0]._id],
    readers: [],
    tags: []
  });
  const groupB = await DeviceGroup.create({
    name: 'Zone B Speakers',
    description: 'Speakers covering the Paint Shop area',
    speakers: [speakers[1]._id],
    readers: [],
    tags: []
  });
  const groupC = await DeviceGroup.create({
    name: 'Zone C Speakers',
    description: 'Speakers covering the Assembly Line',
    speakers: [speakers[2]._id],
    readers: [],
    tags: []
  });
  await DeviceGroup.create({
    name: 'Global Speakers',
    description: 'All speakers including main hall for site-wide alerts',
    speakers: speakers.map(s => s._id),
    readers: [],
    tags: []
  });

  // Create sample equipment — expanded with more tool types for testing
  const equip1 = await Equipment.create({ name: 'Torque Wrench', category: 'Tool', quantity: 5 });
  const equip2 = await Equipment.create({ name: 'Diagnostic Scanner', category: 'Electronics', quantity: 2 });
  const equip3 = await Equipment.create({ name: 'Safety Vest', category: 'PPE', quantity: 10 });
  const equip4 = await Equipment.create({ name: 'Calibration Gauge Set', category: 'Tool', quantity: 3 });
  const equip5 = await Equipment.create({ name: 'Impact Driver', category: 'Tool', quantity: 4 });
  const equip6 = await Equipment.create({ name: 'Multimeter Pro', category: 'Electronics', quantity: 6 });

  // Create tags covering all states (Test scenarios) — expanded for testing
  const tags = [
    // Zone A tags
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
      tagId: 'TAG-004',
      equipment: equip4._id,
      assignedZone: zoneA._id,
      currentZone: zoneA._id,
      status: 'ACTIVE',
      location: 'IN_ZONE',
      alertStatus: 'NONE'
    },
    {
      tagId: 'TAG-005',
      equipment: equip5._id,
      assignedZone: zoneA._id,
      currentZone: zoneA._id,
      status: 'ACTIVE',
      location: 'IN_ZONE',
      alertStatus: 'NONE'
    },
    // Zone B tags
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
    // Disabled / edge-case tags
    {
      tagId: 'TAG-003',
      equipment: equip3._id,
      assignedZone: zoneB._id,
      currentZone: null,
      status: 'PERMANENT_DISABLED',
      location: 'OUTSIDE',
      disableReason: 'Lost in field',
      alertStatus: 'NONE'
    },
    // Zone C tags
    {
      tagId: 'TAG-006',
      equipment: equip6._id,
      assignedZone: zoneC._id,
      currentZone: zoneC._id,
      status: 'ACTIVE',
      location: 'IN_ZONE',
      alertStatus: 'NONE'
    },
    // Unassigned tags (no zone)
    {
      tagId: 'TAG-007',
      equipment: equip3._id,
      assignedZone: null,
      currentZone: null,
      status: 'ACTIVE',
      location: 'OUTSIDE',
      alertStatus: 'NONE'
    },
    // Tag that was left behind (simulates a past alert episode)
    {
      tagId: 'TAG-008',
      equipment: equip1._id,
      assignedZone: zoneD._id,
      currentZone: null,
      status: 'ACTIVE',
      location: 'OUTSIDE',
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

  // Sample recipients — expanded for testing
  await Recipient.create([
    { email: 'lab-supervisor@example.com', name: 'Lab Supervisor', role: 'ADMIN' },
    { email: 'floor-manager@example.com', name: 'Floor Manager', role: 'SUPPORT' },
    { email: 'security-desk@example.com', name: 'Security Desk', role: 'SECURITY' }
  ]);

  console.log('Seed data inserted successfully');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
