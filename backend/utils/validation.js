function validateRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    const error = new Error(`${fieldName} is required`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

function validateRequiredNumber(value, fieldName) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    const error = new Error(`${fieldName} must be a positive number`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function validateBoolean(value, fieldName) {
  if (typeof value !== 'boolean') {
    const error = new Error(`${fieldName} must be a boolean`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

module.exports = { validateRequiredString, validateRequiredNumber, validateBoolean };
