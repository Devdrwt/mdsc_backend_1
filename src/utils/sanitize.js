/**
 * Utilitaires pour la sanitization des valeurs
 * Convertit undefined en null pour MySQL2
 */

/**
 * Convertit undefined en null (requis pour MySQL2)
 * @param {any} value - La valeur à sanitiser
 * @returns {any} - La valeur sanitisée (null si undefined)
 */
const sanitizeValue = (value) => {
  if (value === undefined) {
    return null;
  }
  return value;
};

/**
 * Sanitise un objet en convertissant toutes les valeurs undefined en null
 * @param {Object} obj - L'objet à sanitiser
 * @returns {Object} - L'objet sanitisé
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
};

/**
 * Sanitise un tableau de valeurs
 * @param {Array} arr - Le tableau à sanitiser
 * @returns {Array} - Le tableau sanitisé
 */
const sanitizeArray = (arr) => {
  if (!Array.isArray(arr)) {
    return arr;
  }
  return arr.map(item => sanitizeValue(item));
};

module.exports = {
  sanitizeValue,
  sanitizeObject,
  sanitizeArray
};

