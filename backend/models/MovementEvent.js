const mongoose = require('mongoose');

const movementEventSchema = new mongoose.Schema({
  tag: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true },
  tagId: { type: String, required: true },
  readerId: { type: String, required: true },
  zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  zoneTransition: { type: String, enum: ['ENTER', 'LEAVE'], default: null },
  direction: { type: String, enum: ['EXIT', 'RETURN'], required: true },
  classification: {
    type: String,
    enum: ['INTENTIONAL', 'UNINTENTIONAL', 'OVERDUE_DISABLED', 'PERMANENTLY_DISABLED', 'RETURN'],
    required: true
  },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('MovementEvent', movementEventSchema);