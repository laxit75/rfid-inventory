const mongoose = require('mongoose');

const recipientSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Recipient', recipientSchema);