const express = require('express');
const router = express.Router();
const adminAuthController = require('../../controllers/adminAuthController');
const { authenticateAdminToken } = require('../../middleware/adminAuth');

// Connexion admin
router.post('/login', adminAuthController.login);

// Vérification 2FA
router.post('/verify-2fa', adminAuthController.verify2FA);

// Déconnexion
router.post('/logout', authenticateAdminToken, adminAuthController.logout);

// Vérifier session
router.get('/me', authenticateAdminToken, adminAuthController.getMe);

module.exports = router;

