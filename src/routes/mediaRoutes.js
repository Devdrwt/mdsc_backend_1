const express = require('express');
const router = express.Router();
const path = require('path');
const mediaController = require('../controllers/mediaController');
const MediaService = require('../services/mediaService');
const MinioService = require('../services/minioService');
const { authenticateToken, authorize } = require('../middleware/auth');
const { pool } = require('../config/database');

// Servir les fichiers depuis MinIO via /api/media/uploads
// Tous les fichiers sont maintenant stockés sur MinIO

router.use('/uploads', async (req, res, next) => {
  try {
    const filename = path.basename(req.path);
    
    // Chercher le fichier dans la base de données (media_files)
    const [mediaFiles] = await pool.execute(
      'SELECT * FROM media_files WHERE filename = ? OR url LIKE ? LIMIT 1',
      [filename, `%/${filename}`]
    );
    
    // Vérifier que MinIO est disponible
    if (!MinioService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.'
      });
    }

    // Le fichier DOIT être dans MinIO
    if (mediaFiles.length > 0 && mediaFiles[0].storage_type === 'minio' && mediaFiles[0].storage_path) {
      // Rediriger vers l'URL publique MinIO
      const minioUrl = MinioService.getPublicUrl(mediaFiles[0].storage_path);
      if (minioUrl) {
        return res.redirect(302, minioUrl);
      }
      
      // Si pas d'URL publique, télécharger depuis MinIO et servir
      try {
        const fileStream = await MinioService.downloadFile(mediaFiles[0].storage_path);
        
        // Déterminer le type MIME
        const contentType = mediaFiles[0].file_type || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
        
        fileStream.pipe(res);
        
        fileStream.on('error', (err) => {
          console.error('❌ [MEDIA ROUTES] Erreur lors du streaming depuis MinIO:', err);
          if (!res.headersSent) {
            res.status(500).json({ 
              success: false, 
              message: 'Erreur lors de la récupération du fichier' 
            });
          }
        });
        return;
      } catch (error) {
        console.error('❌ [MEDIA ROUTES] Erreur lors du téléchargement depuis MinIO:', error);
        return res.status(404).json({ 
          success: false, 
          message: 'Fichier non trouvé dans MinIO' 
        });
      }
    }
    
    // Fichier non trouvé dans la base ou pas dans MinIO
    return res.status(404).json({ 
      success: false, 
      message: 'Fichier non trouvé. Tous les fichiers doivent être stockés sur MinIO.' 
    });
  } catch (error) {
    console.error('❌ [MEDIA ROUTES] Erreur lors de la récupération du fichier:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la récupération du fichier' 
    });
  }
});

// ===== ROUTES UPLOAD DIRECT MINIO AVEC URLs PRÉ-SIGNÉES =====

/**
 * Générer une URL pré-signée pour upload direct vers MinIO
 * Cette méthode permet d'éviter les timeouts en uploadant directement vers MinIO
 */
router.post('/upload/presigned-url',
  authenticateToken,
  async (req, res) => {
    try {
      const { fileName, fileType, contentType, lessonId, moduleId } = req.body;

      // Validation
      if (!fileName) {
        return res.status(400).json({
          success: false,
          message: 'Le nom du fichier est requis'
        });
      }

      // Vérifier que MinIO est disponible
      if (!MinioService.isAvailable()) {
        return res.status(503).json({
          success: false,
          message: 'MinIO n\'est pas disponible'
        });
      }

      // Déterminer le bucket selon le type de fichier
      let bucket = 'mdsc-files';
      let folder = 'others';

      if (contentType) {
        if (contentType.startsWith('video/')) {
          bucket = 'videos-mdsc';
          folder = 'modules';
        } else if (contentType.startsWith('audio/')) {
          bucket = 'videos-mdsc';
          folder = 'audio';
        } else if (contentType === 'application/pdf') {
          bucket = 'mdsc-files';
          folder = 'documents';
        } else if (contentType.startsWith('image/')) {
          bucket = 'mdsc-files';
          folder = 'images';
        }
      }

      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const objectName = `${folder}/${timestamp}-${sanitizedFileName}`;

      // Générer URL pré-signée (valide 2 heures)
      const uploadUrl = await MinioService.getPresignedUploadUrl(bucket, objectName, 7200);

      // Générer l'URL publique finale
      const publicUrl = MinioService.getPublicUrl(objectName, bucket);

      console.log('✅ [PRESIGNED] URL générée pour:', {
        fileName: sanitizedFileName,
        bucket,
        objectName,
        contentType,
        userId: req.user.id
      });

      res.json({
        success: true,
        data: {
          uploadUrl,
          objectName,
          bucket,
          publicUrl,
          expiresIn: 7200 // 2 heures
        }
      });
    } catch (error) {
      console.error('❌ [PRESIGNED] Erreur:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la génération de l\'URL'
      });
    }
  }
);

/**
 * Confirmer l'upload après que le fichier ait été uploadé directement vers MinIO
 * Enregistre les métadonnées dans la base de données
 */
router.post('/upload/confirm',
  authenticateToken,
  async (req, res) => {
    try {
      const { objectName, bucket, fileName, fileSize, contentType, lessonId, moduleId } = req.body;

      // Validation
      if (!objectName || !bucket) {
        return res.status(400).json({
          success: false,
          message: 'objectName et bucket sont requis'
        });
      }

      // Vérifier que le fichier existe dans MinIO
      try {
        const metadata = await MinioService.getFileMetadata(objectName);
        console.log('✅ [CONFIRM] Fichier vérifié dans MinIO:', {
          objectName,
          size: metadata.size,
          etag: metadata.etag
        });
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: 'Le fichier n\'existe pas dans MinIO'
        });
      }

      // Déterminer le type de contenu
      let file_category = 'other';
      if (contentType) {
        if (contentType.startsWith('video/')) file_category = 'video';
        else if (contentType.startsWith('audio/')) file_category = 'audio';
        else if (contentType.startsWith('image/')) file_category = 'image';
        else if (contentType === 'application/pdf') file_category = 'document';
      }

      // Générer l'URL publique
      const publicUrl = MinioService.getPublicUrl(objectName, bucket);

      // Insérer dans media_files
      const [result] = await pool.execute(`
        INSERT INTO media_files (
          filename, file_path, file_type, file_size, file_category,
          storage_type, storage_path, url, bucket_name, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        fileName || path.basename(objectName),
        objectName,
        contentType || 'application/octet-stream',
        fileSize || 0,
        file_category,
        'minio',
        objectName,
        publicUrl,
        bucket,
        req.user.id
      ]);

      const mediaFileId = result.insertId;

      // Si lessonId fourni, créer la relation
      if (lessonId) {
        await pool.execute(`
          INSERT INTO lesson_media (lesson_id, media_file_id, media_type, created_at)
          VALUES (?, ?, ?, NOW())
        `, [lessonId, mediaFileId, file_category]);
      }

      console.log('✅ [CONFIRM] Upload enregistré:', {
        mediaFileId,
        objectName,
        lessonId,
        userId: req.user.id
      });

      res.json({
        success: true,
        data: {
          mediaFileId,
          url: publicUrl,
          objectName,
          bucket
        }
      });
    } catch (error) {
      console.error('❌ [CONFIRM] Erreur:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Erreur lors de la confirmation de l\'upload'
      });
    }
  }
);

// Upload single file
router.post('/upload', 
  authenticateToken,
  // Parser tous les champs avec multer().any(), puis valider selon content_type
  (req, res, next) => {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs').promises;
    
    // MinIO est OBLIGATOIRE - utiliser uniquement memoryStorage
    if (!MinioService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.'
      });
    }
    
    const storage = multer.memoryStorage();
    
    const parseAll = multer({ 
      storage: storage,
      limits: {
        fileSize: 500 * 1024 * 1024 // 500MB max pour les grosses vidéos
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
        console.error('❌ [MEDIA ROUTES] Aucun fichier trouvé dans req.files');
        console.error('❌ [MEDIA ROUTES] req.files:', req.files ? req.files.map(f => ({
          fieldname: f.fieldname,
          originalname: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          hasBuffer: !!f.buffer,
          bufferLength: f.buffer ? f.buffer.length : 0
        })) : 'null');
        return res.status(400).json({
          success: false,
          message: 'Aucun fichier trouvé dans le champ "file"'
        });
      }
      
      // Vérifier que le fichier a un buffer (obligatoire avec memoryStorage)
      if (!fileObj.buffer || fileObj.buffer.length === 0) {
        console.error('❌ [MEDIA ROUTES] Fichier sans buffer ou buffer vide:', {
          fieldname: fileObj.fieldname,
          originalname: fileObj.originalname,
          hasBuffer: !!fileObj.buffer,
          bufferLength: fileObj.buffer ? fileObj.buffer.length : 0,
          size: fileObj.size
        });
        return res.status(400).json({
          success: false,
          message: 'Le fichier est vide ou n\'a pas été correctement chargé'
        });
      }
      
      console.log('✅ [MEDIA ROUTES] Fichier trouvé:', {
        fieldname: fileObj.fieldname,
        originalname: fileObj.originalname,
        mimetype: fileObj.mimetype,
        size: fileObj.size,
        bufferLength: fileObj.buffer.length
      });
      
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
      
      // Pour MinIO, le fichier est en mémoire (memoryStorage), on garde l'objet tel quel
      req.file = fileObj;
      
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
    
    // MinIO est OBLIGATOIRE - utiliser uniquement memoryStorage
    if (!MinioService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.'
      });
    }
    
    const storage = multer.memoryStorage();
    
    // Parser avec .any() pour accepter n'importe quel nom de champ (files, files[], etc.)
    const parseAll = multer({ 
      storage: storage,
      limits: { fileSize: 500 * 1024 * 1024 } // 500MB max pour les grosses vidéos
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
      
      // Pour MinIO, les fichiers sont en mémoire (memoryStorage), pas besoin de déplacer
      
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

