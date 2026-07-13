const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  role: {
    type: String,
    enum: ['ADMIN', 'SUPPORT', 'SECURITY'],
    default: 'SUPPORT'
  }
}, { timestamps: true });

module.exports = mongoose.model('Recipient', recipientSchema);