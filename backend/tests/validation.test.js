const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRequiredString, validateRequiredNumber } = require('../utils/validation');

test('validateRequiredString rejects empty values', () => {
  assert.throws(() => validateRequiredString('', 'username'), /username/);
  assert.throws(() => validateRequiredString('   ', 'username'), /username/);
});

test('validateRequiredNumber accepts positive numbers', () => {
  assert.equal(validateRequiredNumber(5, 'alarmDurationSec'), 5);
});

test('validateRequiredNumber rejects non-numeric values', () => {
  assert.throws(() => validateRequiredNumber('ten', 'alarmDurationSec'), /alarmDurationSec/);
});
