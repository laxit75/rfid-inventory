const mongoose = require('mongoose');

const tagAssignmentSchema = new mongoose.Schema({
  tagId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true },
  personName: { type: String, required: true },
  personEmail: { type: String, required: true },
  notes: { type: String, default: '' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('TagAssignment', tagAssignmentSchema);
