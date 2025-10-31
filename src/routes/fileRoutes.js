const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes pour les fichiers de profil
router.post('/upload', 
  authenticateToken, 
  fileController.upload.single('file'),
  fileController.uploadProfileFile
);

router.get('/my-files', 
  authenticateToken, 
  fileController.getUserFiles
);

// Alias attendu par le front
router.get('/my', 
  authenticateToken, 
  fileController.getUserFiles
);

router.delete('/:fileId', 
  authenticateToken, 
  fileController.deleteProfileFile
);

// Routes admin pour la vérification des fichiers
router.get('/pending', 
  authenticateToken, 
  authorize(['admin']), 
  fileController.getPendingFiles
);

router.put('/:fileId/verify', 
  authenticateToken, 
  authorize(['admin']), 
  fileController.verifyFile
);

module.exports = router;
