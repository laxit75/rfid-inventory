const mongoose = require('mongoose');

const tagAlertStateSchema = new mongoose.Schema({
  tagId: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['normal', 'unintentional_alert', 'temp_disabled', 'temp_disabled_overdue', 'permanently_disabled'],
    default: 'normal'
  },

  // Alert episode tracking
  firstDetectedAt: { type: Date, default: null },
  lastAlarmTriggeredAt: { type: Date, default: null },
  alarmCount: { type: Number, default: 0 },
  resolvedAt: { type: Date, default: null },

  // Mute enforcement
  mutedBy: { type: String, default: '' },
  mutedAt: { type: Date, default: null },
  muteExpiresAt: { type: Date, default: null },
  alarmMuted: { type: Boolean, default: false },

  // Disabled state
  disabledUntil: { type: Date, default: null },
  disabledBy: { type: String, default: '' },

  // Email tracking
  lastEmailSentAt: { type: Date, default: null },
  emailsSent: [{
    cadence: { type: String, enum: ['hourly', 'daily'], required: true },
    sentAt: { type: Date, default: Date.now }
  }],

  // Movement tracking
  lastMovementDetectedAt: { type: Date, default: null },

  // Location context
  vehicleId: { type: String, default: '' },
  location: { type: String, default: '' }
}, { timestamps: true });

// Compound index for efficient alert queries
tagAlertStateSchema.index({ status: 1, lastAlarmTriggeredAt: 1 });
tagAlertStateSchema.index({ status: 1, 'emailsSent.type': 1 });

module.exports = mongoose.model('TagAlertState', tagAlertStateSchema);
