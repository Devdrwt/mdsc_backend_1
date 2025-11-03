const { body, validationResult } = require('express-validator');

// Middleware pour gérer les erreurs de validation
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    console.error('\n❌ VALIDATION ERRORS:', req.method, req.path);
    console.error('   Body reçu:', req.body);
    console.error('   Erreurs:', errors.array());
    console.error('   Content-Type:', req.headers['content-type']);
    console.error('   Origin:', req.headers.origin);
    
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  
  next();
};

// Validation pour l'inscription
exports.validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Adresse email invalide')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'),
  body('firstName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Le prénom doit contenir au moins 2 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-]+$/)
    .withMessage('Le prénom ne peut contenir que des lettres, espaces et tirets'),
  body('lastName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Le nom doit contenir au moins 2 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-]+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces et tirets'),
  body('npi')
    .optional()
    .trim()
    .isLength({ min: 5, max: 50 })
    .withMessage('Le NPI doit contenir entre 5 et 50 caractères'),
  body('phone')
    .optional()
    .trim()
    .isLength({ min: 8, max: 20 })
    .withMessage('Le numéro de téléphone doit contenir entre 8 et 20 caractères'),
  body('organization')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Le nom de l\'organisation ne peut pas dépasser 255 caractères'),
  body('country')
    .optional()
    .isLength({ min: 2, max: 3 })
    .withMessage('Le code pays doit contenir entre 2 et 3 caractères'),
];

// Validation pour la connexion
exports.validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Adresse email invalide')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis'),
];

// Validation pour la vérification d'email
exports.validateEmailVerification = [
  body('token')
    .notEmpty()
    .withMessage('Token de vérification requis')
    .trim()
    .isLength({ min: 64, max: 64 })
    .withMessage('Format de token invalide')
    .matches(/^[a-f0-9]{64}$/i)
    .withMessage('Format de token invalide (doit être un hash SHA-256)'),
];

// Validation pour le renvoi d'email de vérification
exports.validateResendVerification = [
  body('email')
    .isEmail()
    .withMessage('Adresse email invalide')
    .normalizeEmail(),
];

// Validation pour forgot password
exports.validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage('Adresse email invalide')
    .normalizeEmail(),
];

// Validation pour reset password
exports.validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Token de réinitialisation requis')
    .trim()
    .isLength({ min: 64, max: 64 })
    .withMessage('Format de token invalide')
    .matches(/^[a-f0-9]{64}$/i)
    .withMessage('Format de token invalide (doit être un hash SHA-256)'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'),
];

// Validation pour refresh token
exports.validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token requis'),
];

// Validation pour les cours
exports.validateCourse = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage('Le titre doit contenir entre 5 et 255 caractères'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('La description doit contenir au moins 10 caractères'),
  body('short_description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La description courte ne peut pas dépasser 500 caractères'),
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID de catégorie invalide'),
  body('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Niveau de difficulté invalide'),
  body('language')
    .optional()
    .isLength({ min: 2, max: 10 })
    .withMessage('Code langue invalide'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix doit être un nombre positif'),
  body('duration_minutes')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La durée doit être un nombre entier positif'),
  body('max_students')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le nombre maximum d\'étudiants doit être un entier positif'),
];

// Validation pour les inscriptions
exports.validateEnrollment = [
  body('courseId')
    .isInt({ min: 1 })
    .withMessage('ID de cours invalide'),
];

// Validation pour les tentatives de quiz
exports.validateQuizAttempt = [
  body('answers')
    .isArray({ min: 1 })
    .withMessage('Les réponses sont requises'),
  body('answers.*.question_id')
    .isInt({ min: 1 })
    .withMessage('ID de question invalide'),
  body('answers.*.answer_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID de réponse invalide'),
  body('answers.*.answer_text')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Texte de réponse requis'),
];

// Validation pour les conversations IA
exports.validateAIConversation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Le titre doit contenir entre 3 et 255 caractères'),
  body('context')
    .optional()
    .isIn(['general', 'course_help', 'assignment_help', 'study_plan'])
    .withMessage('Contexte de conversation invalide'),
];

// Validation pour les messages IA
exports.validateAIMessage = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Le message doit contenir entre 1 et 2000 caractères'),
  body('context')
    .optional()
    .isIn(['general', 'course_help', 'assignment_help', 'study_plan'])
    .withMessage('Contexte de message invalide'),
];

