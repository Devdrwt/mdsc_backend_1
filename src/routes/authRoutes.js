const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validateEmailVerification,
  validateResendVerification,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
  handleValidationErrors
} = require('../middleware/validation');

// Routes publiques
router.post('/register', 
  validateRegister, 
  handleValidationErrors, 
  authController.register
);

router.post('/login', 
  validateLogin, 
  handleValidationErrors, 
  authController.login
);

// Route GET pour la vérification d'email (lien dans l'email)
router.get('/verify-email', authController.verifyEmail);

// Route POST pour la vérification d'email (via API)
router.post('/verify-email', 
  validateEmailVerification, 
  handleValidationErrors, 
  authController.verifyEmail
);

router.post('/resend-verification', 
  validateResendVerification, 
  handleValidationErrors, 
  authController.resendVerificationEmail
);

router.post('/forgot-password', 
  validateForgotPassword, 
  handleValidationErrors, 
  authController.forgotPassword
);

router.post('/reset-password', 
  validateResetPassword, 
  handleValidationErrors, 
  authController.resetPassword
);

router.post('/refresh-token', 
  validateRefreshToken, 
  handleValidationErrors, 
  authController.refreshToken
);

router.post('/logout', 
  authController.logout
);

// Routes protégées (nécessitent authentification)
router.get('/profile', 
  protect, 
  authController.getProfile
);

router.put('/profile', 
  protect, 
  authController.updateProfile
);

router.put('/change-password', 
  protect, 
  authController.changePassword
);

// Endpoint de diagnostic pour l'authentification
router.get('/debug', protect, (req, res) => {
  res.json({
    success: true,
    message: 'Authentification OK',
    user: req.user,
    timestamp: new Date().toISOString(),
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      userAgent: req.get('user-agent')
    }
  });
});

module.exports = router;

