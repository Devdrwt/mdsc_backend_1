const express = require('express');
const router = express.Router();
const path = require('path');
const mediaController = require('../controllers/mediaController');
const MediaService = require('../services/mediaService');
const MinioService = require('../services/minioService');
const { authenticateToken, authorize } = require('../middleware/auth');
const { pool } = require('../config/database');

// Servir les fichiers statiques uploadés via /api/media/uploads
// Cette route doit être avant les autres routes pour éviter les conflits
// Supporte maintenant MinIO et stockage local
const uploadsPath = path.join(__dirname, '../../uploads');
const fs = require('fs');

router.use('/uploads', async (req, res, next) => {
  try {
    const filename = path.basename(req.path);
    
    // Chercher le fichier dans la base de données (media_files)
    const [mediaFiles] = await pool.execute(
      'SELECT * FROM media_files WHERE filename = ? OR url LIKE ? LIMIT 1',
      [filename, `%/${filename}`]
    );
    
    // Si le fichier est dans MinIO, rediriger vers l'URL MinIO
    if (mediaFiles.length > 0 && mediaFiles[0].storage_type === 'minio' && mediaFiles[0].storage_path) {
      const minioUrl = MinioService.getPublicUrl(mediaFiles[0].storage_path);
      if (minioUrl) {
        return res.redirect(302, minioUrl);
      }
    }
    
    // Sinon, chercher dans le stockage local
    let filePath = path.join(uploadsPath, req.path);
    
    // Vérifier que le chemin est sécurisé (pas de directory traversal)
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(path.normalize(uploadsPath))) {
      return res.status(403).json({ success: false, message: 'Accès interdit' });
    }
    
    // Si le fichier n'existe pas au chemin demandé, chercher dans d'autres dossiers possibles
    if (!fs.existsSync(filePath)) {
      const possiblePaths = [
        path.join(uploadsPath, 'courses', 'thumbnails', filename),
        path.join(uploadsPath, 'courses', 'videos', filename),
        path.join(uploadsPath, 'profiles', filename),
        path.join(uploadsPath, 'images', filename),
        path.join(uploadsPath, 'modules', filename),
        path.join(uploadsPath, 'videos', filename),
        path.join(uploadsPath, 'documents', filename),
        path.join(uploadsPath, 'audio', filename),
        path.join(uploadsPath, 'presentations', filename),
        path.join(uploadsPath, 'h5p', filename),
        path.join(uploadsPath, 'others', filename)
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
  } catch (error) {
    console.error('Erreur lors de la récupération du fichier:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération du fichier' });
  }
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
    
    const parseAll = multer({ 
      storage: tempStorage,
      limits: {
        fileSize: 150 * 1024 * 1024 // 150MB max
      }
    }).any();
    
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
  // Parser tous les champs (texte + fichiers) avec .any() pour accepter n'importe quel nom de champ
  async (req, res, next) => {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs').promises;
    
    // Configuration temporaire pour parser tous les fichiers (validation faite après)
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
        const ext = path.extname(file.originalname);
        cb(null, `temp-${uniqueSuffix}${ext}`);
      }
    });
    
    // Parser avec .any() pour accepter n'importe quel nom de champ (files, files[], etc.)
    const parseAll = multer({ 
      storage: tempStorage,
      limits: { fileSize: 150 * 1024 * 1024 } // 150MB max
    }).any();
    
    parseAll(req, res, async (err) => {
      if (err) return next(err);
      
      // Récupérer content_type depuis req.body ou req.query
      // Note: avec multer().any(), les champs texte devraient être dans req.body
      let content_type = req.body?.content_type || req.query?.content_type;
      
      // Si content_type n'est pas fourni, essayer de le déduire depuis le premier fichier
      if (!content_type && req.files && req.files.length > 0) {
        const firstFile = req.files[0];
        const mimeType = firstFile.mimetype;
        
        // Mapper les types MIME vers content_type
        const mimeToContentType = {
          'video/mp4': 'video',
          'video/webm': 'video',
          'video/quicktime': 'video',
          'video/x-msvideo': 'video',
          'video/x-matroska': 'video',
          'application/pdf': 'document',
          'application/msword': 'document',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
          'application/vnd.ms-excel': 'document',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
          'application/vnd.ms-powerpoint': 'presentation',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation',
          'audio/mpeg': 'audio',
          'audio/wav': 'audio',
          'audio/ogg': 'audio',
          'audio/mp4': 'audio',
          'image/jpeg': 'image',
          'image/png': 'image',
          'image/gif': 'image',
          'image/webp': 'image',
          'application/zip': 'h5p'
        };
        
        content_type = mimeToContentType[mimeType];
      }
      
      // Debug: logger les données reçues (uniquement en développement)
      if (process.env.NODE_ENV !== 'production') {
        console.log('📤 Upload bulk - req.body:', req.body);
        console.log('📤 Upload bulk - req.query:', req.query);
        console.log('📤 Upload bulk - req.files count:', req.files?.length || 0);
        console.log('📤 Upload bulk - content_type détecté:', content_type);
      }
      
      if (!content_type) {
        // Nettoyer les fichiers temporaires si content_type manquant
        if (req.files) {
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (e) {
              // Ignorer
            }
          }
        }
        return res.status(400).json({
          success: false,
          message: 'content_type est requis. Envoyez-le dans le FormData avec la clé "content_type" ou dans les query params.',
          debug: process.env.NODE_ENV !== 'production' ? {
            bodyKeys: Object.keys(req.body || {}),
            queryKeys: Object.keys(req.query || {}),
            filesCount: req.files?.length || 0,
            firstFileMime: req.files?.[0]?.mimetype
          } : undefined
        });
      }
      
      // Valider les types MIME selon content_type
      const allowedMimes = MediaService.getAllowedMimeTypes(content_type);
      if (allowedMimes.length > 0 && req.files) {
        const invalidFiles = req.files.filter(file => !allowedMimes.includes(file.mimetype));
        if (invalidFiles.length > 0) {
          // Nettoyer les fichiers temporaires
          for (const file of req.files) {
            try {
              await fs.unlink(file.path);
            } catch (e) {
              // Ignorer
            }
          }
          return res.status(400).json({
            success: false,
            message: `Type de fichier non autorisé. Types acceptés: ${allowedMimes.join(', ')}`
          });
        }
      }
      
      // S'assurer que content_type est dans req.body pour le contrôleur
      req.body.content_type = content_type;
      
      // Déplacer les fichiers vers le bon dossier selon content_type
      if (req.files && req.files.length > 0) {
        const finalDir = path.join(__dirname, '../../uploads', MediaService.getFolderByContentType(content_type));
        await fs.mkdir(finalDir, { recursive: true });
        
        for (const file of req.files) {
          try {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            const finalFilename = `${req.user.id || 'anon'}-${uniqueSuffix}${ext}`;
            const finalPath = path.join(finalDir, finalFilename);
            
            await fs.rename(file.path, finalPath);
            
            // Mettre à jour les propriétés du fichier
            file.destination = finalDir;
            file.filename = finalFilename;
            file.path = finalPath;
          } catch (error) {
            console.error('Erreur lors du déplacement du fichier:', error);
            // Nettoyer en cas d'erreur
            try {
              await fs.unlink(file.path);
            } catch (e) {
              // Ignorer
            }
          }
        }
      }
      
      next();
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

