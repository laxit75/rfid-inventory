const mongoose = require('mongoose');

const alertTargetGroupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recipient' }],
  // Tag-specific assignments: link a specific tag to a specific person with email
  tagAssignments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TagAssignment' }]
}, { timestamps: true });

module.exports = mongoose.model('AlertTargetGroup', alertTargetGroupSchema);
