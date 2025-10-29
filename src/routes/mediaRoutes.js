const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const MediaService = require('../services/mediaService');
const { authenticateToken, authorize } = require('../middleware/auth');

// Upload single file
router.post('/upload', 
  authenticateToken,
  (req, res, next) => {
    const { content_type } = req.body;
    if (!content_type) {
      return res.status(400).json({
        success: false,
        message: 'content_type est requis'
      });
    }
    
    const upload = MediaService.getMulterConfig(content_type).single('file');
    upload(req, res, next);
  },
  mediaController.uploadFile
);

// Upload multiple files
router.post('/upload-bulk',
  authenticateToken,
  (req, res, next) => {
    const { content_type } = req.body;
    if (!content_type) {
      return res.status(400).json({
        success: false,
        message: 'content_type est requis'
      });
    }
    
    const upload = MediaService.getMulterConfig(content_type).array('files', 10);
    upload(req, res, next);
  },
  mediaController.uploadBulkFiles
);

// Routes publiques
router.get('/:id', mediaController.getMediaFile);
router.get('/lesson/:lessonId', mediaController.getLessonMediaFiles);
router.get('/course/:courseId', mediaController.getCourseMediaFiles);

// Télécharger un fichier
router.get('/:id/download', mediaController.downloadMediaFile);

// Supprimer un fichier
router.delete('/:id',
  authenticateToken,
  authorize(['instructor', 'admin']),
  mediaController.deleteMediaFile
);

module.exports = router;

