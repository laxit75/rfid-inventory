const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'USER', 'ZONE_MANAGER', 'AUDITOR', 'OPERATOR', 'INTEGRATION'], default: 'USER' },
  zones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Zone' }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash')) return next();
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);