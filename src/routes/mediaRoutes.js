const express = require('express');
const router = express.Router();
const path = require('path');
const mediaController = require('../controllers/mediaController');
const MediaService = require('../services/mediaService');
const { authenticateToken, authorize } = require('../middleware/auth');

// Servir les fichiers statiques uploadés via /api/media/uploads
// Cette route doit être avant les autres routes pour éviter les conflits
const uploadsPath = path.join(__dirname, '../../uploads');
const fs = require('fs');

router.use('/uploads', (req, res, next) => {
  // Construire le chemin complet du fichier
  let filePath = path.join(uploadsPath, req.path);
  
  // Vérifier que le chemin est sécurisé (pas de directory traversal)
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(path.normalize(uploadsPath))) {
    return res.status(403).json({ success: false, message: 'Accès interdit' });
  }
  
  // Si le fichier n'existe pas au chemin demandé, chercher dans d'autres dossiers possibles
  if (!fs.existsSync(filePath)) {
    const filename = path.basename(req.path);
    const possiblePaths = [
      path.join(uploadsPath, 'courses', 'thumbnails', filename),
      path.join(uploadsPath, 'courses', 'videos', filename),
      path.join(uploadsPath, 'profiles', filename),
      path.join(uploadsPath, 'images', filename),
      path.join(uploadsPath, 'modules', filename)
    ];
    
    // Chercher le fichier dans les dossiers possibles
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        filePath = possiblePath;
        break;
      }
    }
  }
  
  // Vérifier que le fichier existe (après recherche)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
  }
  
  // Vérifier que c'est un fichier (pas un dossier)
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    return res.status(404).json({ success: false, message: 'Fichier non trouvé' });
  }
  
  // Déterminer le type MIME
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  
  // Définir les en-têtes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  
  if (mimeTypes[ext]) {
    res.setHeader('Content-Type', mimeTypes[ext]);
  }
  
  // Servir le fichier
  res.sendFile(filePath);
});

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

