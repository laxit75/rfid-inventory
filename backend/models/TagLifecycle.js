const mongoose = require('mongoose');

const tagLifecycleSchema = new mongoose.Schema({
  tag: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true },
  tagId: { type: String, required: true },
  eventType: {
    type: String,
    enum: ['CREATED','ASSIGNED','EXIT','RETURN','SILENCED','DISABLED','OVERDUE','ALARM_RAISED','ALARM_RESOLVED','EMAIL_SENT','ACKNOWLEDGED','RESOLVED','MANUAL_UPDATE'],
    required: true
  },
  fromState: { type: String, default: '' },
  toState: { type: String, default: '' },
  actor: { type: String, default: 'system' },
  details: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('TagLifecycle', tagLifecycleSchema);
