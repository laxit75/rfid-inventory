const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['SPEAKER', 'SIREN', 'DISPLAY'], default: 'SPEAKER' },
  endpoint: { type: String, required: true },
  secret: { type: String, required: true },
  zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  active: { type: Boolean, default: true },
  lastTriggeredAt: Date,
  lastStatus: String
}, { timestamps: true });

module.exports = mongoose.model('Device', deviceSchema);
