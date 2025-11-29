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

/**
 * Convertit une date ISO (avec Z) en format MySQL DATETIME (YYYY-MM-DD HH:MM:SS)
 * @param {string|Date|null} dateValue - La date à convertir
 * @returns {string|null} - La date au format MySQL ou null
 */
const convertToMySQLDateTime = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  try {
    const date = new Date(dateValue);
    
    // Vérifier que la date est valide
    if (isNaN(date.getTime())) {
      return null;
    }

    // Convertir en format MySQL (YYYY-MM-DD HH:MM:SS)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Erreur conversion date MySQL:', error);
    return null;
  }
};

module.exports = {
  sanitizeValue,
  sanitizeObject,
  sanitizeArray,
  convertToMySQLDateTime
};

