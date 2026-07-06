const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  tagId: { type: String, required: true, unique: true },
  equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  assignedZone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  currentZone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  status: {
    type: String,
    enum: ['ACTIVE', 'TEMP_DISABLED', 'PERMANENT_DISABLED'],
    default: 'ACTIVE'
  },
  location: {
    type: String,
    enum: ['IN_LAB', 'OUTSIDE', 'IN_ZONE'],
    default: 'OUTSIDE'
  },
  alertStatus: {
    type: String,
    enum: ['NONE', 'ALARMING', 'OVERDUE'],
    default: 'NONE'
  },
  silenced: { type: Boolean, default: false },
  disabledUntil: { type: Date, default: null },
  disableReason: { type: String, default: '' },
  lastAlarmBeepAt: { type: Date, default: null },
  lastEmailSentAt: { type: Date, default: null },
  overdueAlertStart: { type: Date, default: null },
  lastOverdueEmailSentAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Tag', tagSchema);