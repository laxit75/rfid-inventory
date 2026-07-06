const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  alarmDurationSec: { type: Number, default: 5 },
  alarmRepeatIntervalSec: { type: Number, default: 5 },
  alarmVolume: { type: Number, default: 80, min: 0, max: 100 },
  alarmMuted: { type: Boolean, default: false },
  emailRepeatIntervalSec: { type: Number, default: 3600 },
  overdueEmailRepeatIntervalSec: { type: Number, default: 86400 }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);