const mongoose = require('mongoose');

const tagAlertStateSchema = new mongoose.Schema({
  tagId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['normal', 'unintentional_alert', 'temp_disabled', 'temp_disabled_overdue', 'permanently_disabled'],
    default: 'normal'
  },
  disabledUntil: { type: Date, default: null },
  disabledBy: { type: String, default: '' },
  lastEmailSentAt: { type: Date, default: null },
  lastMovementDetectedAt: { type: Date, default: null },
  alarmMuted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('TagAlertState', tagAlertStateSchema);
