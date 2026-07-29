const mongoose = require('mongoose');

const alertFlowSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  enabled: { type: Boolean, default: true },
  // Source: which device group triggers this alert flow
  sourceGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'DeviceGroup', required: true },
  // Targets: who gets notified (email groups)
  targetGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AlertTargetGroup' }],
  // Targets: which speakers/devices trigger when alert fires
  speakerDevices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }],
  // Trigger conditions
  triggerOnExit: { type: Boolean, default: true },
  triggerOnOverdue: { type: Boolean, default: true },
  // Whether this alert requires manual resolution by an operator
  isResolutionRequired: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('AlertFlow', alertFlowSchema);
