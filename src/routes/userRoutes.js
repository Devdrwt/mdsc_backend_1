const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const fileController = require('../controllers/fileController');
const { authenticateToken, protect } = require('../middleware/auth');

// Alias REST standard pour le profil utilisateur
router.get('/me', protect, authController.getProfile);
router.put('/me', protect, authController.updateProfile);

// Route pour upload d'avatar (alias vers fileController avec file_type: 'profile_picture')
router.post('/me/avatar',
  authenticateToken,
  (req, res, next) => {
    // Force file_type à 'profile_picture' pour cette route
    if (!req.body) req.body = {};
    req.body.file_type = 'profile_picture';
    next();
  },
  fileController.upload.single('file'),
  fileController.uploadProfileFile
);

module.exports = router;


