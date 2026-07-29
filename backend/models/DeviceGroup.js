const mongoose = require('mongoose');

const deviceGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  readers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Reader' }],
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  speakers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }]
}, { timestamps: true });

module.exports = mongoose.model('DeviceGroup', deviceGroupSchema);
