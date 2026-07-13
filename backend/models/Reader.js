const mongoose = require('mongoose');

const readerSchema = new mongoose.Schema({
  readerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  status: { type: String, enum: ['ONLINE', 'OFFLINE', 'UNKNOWN'], default: 'UNKNOWN' },
  lastSeenAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Reader', readerSchema);
