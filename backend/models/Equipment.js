const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('Equipment', equipmentSchema);