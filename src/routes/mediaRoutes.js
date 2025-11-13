const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const MediaService = require('../services/mediaService');
const { authenticateToken, authorize } = require('../middleware/auth');

// Upload single file
router.post('/upload', 
  authenticateToken,
  // Parser tous les champs avec multer().any(), puis valider selon content_type
  (req, res, next) => {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs').promises;
    
    // Parser tout (champs texte + fichiers) avec une config générique
    const tempStorage = multer.diskStorage({
      destination: async (req, file, cb) => {
        try {
          const tempDir = path.join(__dirname, '../../uploads/temp');
          await fs.mkdir(tempDir, { recursive: true });
          cb(null, tempDir);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `temp-${uniqueSuffix}-${file.originalname}`);
      }
    });
    
    const parseAll = multer({ storage: tempStorage }).any();
    
    parseAll(req, res, async (err) => {
      if (err) return next(err);
      
      // Obtenir content_type depuis req.body
      const content_type = req.body.content_type;
      
      if (!content_type) {
        // Nettoyer les fichiers temporaires
        if (req.files) {
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (e) {
              // Ignore
            }
          }
        }
        return res.status(400).json({
          success: false,
          message: 'content_type est requis'
        });
      }
      
      // Trouver le fichier 'file'
      const fileObj = req.files.find(f => f.fieldname === 'file');
      if (!fileObj) {
        // Nettoyer les fichiers temporaires
        if (req.files) {
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (e) {
              // Ignore
            }
          }
        }
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier trouvé dans le champ "file"'
        });
      }
      
      // Valider selon content_type
      const allowedMimes = MediaService.getAllowedMimeTypes(content_type);
      if (allowedMimes.length > 0 && !allowedMimes.includes(fileObj.mimetype)) {
        // Nettoyer le fichier temporaire
        try {
          await fs.unlink(fileObj.path);
        } catch (e) {
          // Ignore
        }
        return res.status(400).json({
          success: false,
          message: `Type de fichier non autorisé. Types acceptés: ${allowedMimes.join(', ')}`
        });
      }
      
      // Déplacer le fichier vers le bon dossier avec le bon format de nom
      const finalDir = path.join(__dirname, '../../uploads', MediaService.getFolderByContentType(content_type));
      await fs.mkdir(finalDir, { recursive: true });
      
      // Générer le nom de fichier final selon le format utilisé par MediaService
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(fileObj.originalname);
      const finalFilename = `${req.user.id || 'anon'}-${uniqueSuffix}${ext}`;
      const finalPath = path.join(finalDir, finalFilename);
      
      await fs.rename(fileObj.path, finalPath);
      
      // Mettre à jour req.file avec le chemin final
      req.file = {
        ...fileObj,
        fieldname: fileObj.fieldname,
        originalname: fileObj.originalname,
        encoding: fileObj.encoding,
        mimetype: fileObj.mimetype,
        size: fileObj.size,
        destination: finalDir,
        filename: finalFilename,
        path: finalPath
      };
      
      next();
    });
  },
  mediaController.uploadFile
);

// Upload multiple files
router.post('/upload-bulk',
  authenticateToken,
  // D'abord parser les champs du formulaire (sans les fichiers) pour obtenir content_type
  (req, res, next) => {
    const multer = require('multer');
    const parseFields = multer().none();
    parseFields(req, res, (err) => {
      if (err) return next(err);
      
      const { content_type } = req.body;
      if (!content_type) {
        return res.status(400).json({
          success: false,
          message: 'content_type est requis'
        });
      }
      
      const upload = MediaService.getMulterConfig(content_type).array('files', 10);
      upload(req, res, next);
    });
  },
  mediaController.uploadBulkFiles
);

// Routes publiques
router.get('/:id', mediaController.getMediaFile);
router.get('/lesson/:lessonId', mediaController.getLessonMediaFiles);
router.get('/course/:courseId', mediaController.getCourseMediaFiles);

// Télécharger un fichier
router.get('/:id/download', mediaController.downloadMediaFile);

// Convertir un PPTX en images
const pptxController = require('../controllers/pptxController');
router.get('/:id/convert-pptx', pptxController.convertPptxToImages);
router.get('/:id/slides/:filename', pptxController.getSlideImage);

// Supprimer un fichier
router.delete('/:id',
  authenticateToken,
  authorize(['instructor', 'admin']),
  mediaController.deleteMediaFile
);

module.exports = router;

