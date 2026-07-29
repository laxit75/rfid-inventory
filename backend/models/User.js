const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'USER', 'ZONE_MANAGER', 'AUDITOR', 'OPERATOR', 'INTEGRATION'], default: 'USER' },
  zones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Zone' }],
  active: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },
  lastIpAddress: { type: String, default: '' }
}, { timestamps: true });

// Remove the misleading pre-save hook - it did nothing useful (just called next()).
// The password hashing happens explicitly in routes/users.js before saving.

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);