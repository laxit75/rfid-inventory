const mongoose = require('mongoose');

const alertLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['ALARM_BEEP', 'ALARM_RESOLVED', 'EMAIL_SENT', 'SMS_SENT', 'OVERDUE_EMAIL_SENT', 'OVERDUE_SMS_SENT', 'OVERDUE_RESOLVED'],
    required: true
  },
  tag: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true },
  tagId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: String, default: '' }
});

module.exports = mongoose.model('AlertLog', alertLogSchema);