const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const MinioService = require('../services/minioService');

// Configuration multer pour l'upload de fichiers
// MinIO est OBLIGATOIRE - utiliser uniquement memoryStorage
if (!MinioService.isAvailable()) {
  throw new Error('MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.');
}

const storage = multer.memoryStorage(); // Stockage mémoire pour MinIO

const fileFilter = (req, file, cb) => {
  // Accepter tous les types MIME autorisés (profile_picture et identity_document)
  // La validation spécifique sera faite dans le contrôleur
  const allowedMimes = [
    'image/jpeg', 
    'image/png', 
    'image/gif', 
    'image/webp',
    'application/pdf'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Type de fichier non autorisé. Types acceptés: ${allowedMimes.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max pour les grosses vidéos
  }
});

// Upload d'un fichier de profil
const uploadProfileFile = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;
    const file_type = (req.body && req.body.file_type) ? req.body.file_type : 'profile_picture';

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    // Vérifier que le type de fichier correspond au MIME type
    const allowedTypes = {
      'profile_picture': ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      'identity_document': ['image/jpeg', 'image/png', 'application/pdf']
    };

    const allowedMimes = allowedTypes[file_type] || allowedTypes['profile_picture'];
    
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Type de fichier non autorisé pour ${file_type}. Types acceptés: ${allowedMimes.join(', ')}`
      });
    }

    // Vérifier que l'utilisateur peut uploader ce type de fichier
    if (file_type === 'identity_document' && !['instructor', 'student'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Seuls les instructeurs et étudiants peuvent uploader des pièces d\'identité'
      });
    }

    // Supprimer l'ancien fichier du même type s'il existe
    const existingFileQuery = 'SELECT file_path, storage_type FROM user_files WHERE user_id = ? AND file_type = ?';
    const [existingFiles] = await pool.execute(existingFileQuery, [userId, file_type]);
    
    if (existingFiles.length > 0) {
      const existingFile = existingFiles[0];
      try {
        // Supprimer selon le type de stockage
        if (existingFile.storage_type === 'minio' && existingFile.file_path) {
          await MinioService.deleteFile(existingFile.file_path);
        } else if (existingFile.file_path) {
          await fs.unlink(existingFile.file_path);
        }
      } catch (error) {
        console.log('Fichier précédent non trouvé:', error.message);
      }
      
      await pool.execute('DELETE FROM user_files WHERE user_id = ? AND file_type = ?', [userId, file_type]);
    }

    // MinIO est OBLIGATOIRE - pas de fallback local
    if (!MinioService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.'
      });
    }

    let storageType = 'minio';
    let storagePath = null;
    let fileName = null;
    let fileUrl = null;

    console.log('📤 [UPLOAD] MinIO disponible?', MinioService.isAvailable());
    console.log('📤 [UPLOAD] Fichier reçu:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
      hasPath: !!req.file.path
    });

    try {
      const objectName = MinioService.generateObjectName('profiles', req.file.originalname, userId);
      console.log('📤 [UPLOAD] Upload vers MinIO, objectName:', objectName);
      
      const uploadResult = await MinioService.uploadFile(req.file, objectName, req.file.mimetype);
      
      storagePath = objectName;
      fileName = path.basename(objectName);
      fileUrl = uploadResult.url;
      
      console.log('✅ [UPLOAD] Fichier uploadé vers MinIO:', {
        storageType,
        storagePath,
        url: fileUrl
      });
      
      // Nettoyer le fichier temporaire local s'il existe
      if (req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (error) {
          console.warn('Impossible de supprimer le fichier temporaire:', error.message);
        }
      }
    } catch (error) {
      console.error('❌ [UPLOAD] Erreur lors de l\'upload vers MinIO:', error);
      return res.status(500).json({
        success: false,
        message: `Échec de l'upload vers MinIO: ${error.message}`
      });
    }

    // Vérifier que storagePath et fileUrl sont définis (obligatoires avec MinIO)
    if (!storagePath || !fileUrl) {
      return res.status(500).json({
        success: false,
        message: 'Erreur: storage_path ou url non défini après upload MinIO'
      });
    }

    // S'assurer qu'aucune valeur n'est undefined (remplacer par null)
    const safeFileName = fileName || 'unnamed-file';
    const safeStoragePath = storagePath; // Déjà vérifié ci-dessus
    const safeOriginalName = req.file.originalname || 'unnamed-file';
    const safeMimeType = req.file.mimetype || 'application/octet-stream';
    const safeFileSize = req.file.size || 0;

    // Insérer les informations du fichier en base
    const insertQuery = `
      INSERT INTO user_files (
        user_id, file_type, file_name, original_name, file_path,
        file_size, mime_type, storage_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      userId,
      file_type,
      safeFileName,
      safeOriginalName,
      safeStoragePath,
      safeFileSize,
      safeMimeType,
      storageType
    ]);

    res.status(201).json({
      success: true,
      message: 'Fichier uploadé avec succès',
      data: {
        id: result.insertId,
        file_type,
        file_name: safeFileName,
        original_name: safeOriginalName,
        file_size: safeFileSize,
        mime_type: safeMimeType,
        url: fileUrl,
        storage_type: storageType
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'upload:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload du fichier'
    });
  }
};

// Récupérer les fichiers de profil d'un utilisateur
const getUserFiles = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;

    const query = `
      SELECT 
        id, file_type, file_name, original_name, file_size,
        mime_type, is_verified, verified_at, created_at
      FROM user_files 
      WHERE user_id = ?
      ORDER BY file_type, created_at DESC
    `;

    const [files] = await pool.execute(query, [userId]);

    // Construire l'URL complète pour chaque fichier
    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

    res.json({
      success: true,
      data: files.map(file => {
        let url = null;
        if (file.storage_type === 'minio' && file.file_path) {
          url = MinioService.getPublicUrl(file.file_path);
        } else if (file.file_name) {
          url = `${apiUrl}/uploads/profiles/${file.file_name}`;
        }
        
        return {
          id: file.id,
          file_type: file.file_type,
          file_name: file.file_name,
          original_name: file.original_name,
          file_size: file.file_size,
          mime_type: file.mime_type,
          is_verified: file.is_verified,
          verified_at: file.verified_at,
          created_at: file.created_at,
          url: url
        };
      })
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers'
    });
  }
};

// Supprimer un fichier de profil
const deleteProfileFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    // Vérifier que le fichier appartient à l'utilisateur
    const fileQuery = 'SELECT file_path FROM user_files WHERE id = ? AND user_id = ?';
    const [files] = await pool.execute(fileQuery, [fileId, userId]);

    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }

    // Supprimer le fichier physique selon le type de stockage
    try {
      const file = files[0];
      if (file.storage_type === 'minio' && file.file_path) {
        await MinioService.deleteFile(file.file_path);
      } else if (file.file_path) {
        await fs.unlink(file.file_path);
      }
    } catch (error) {
      console.log('Fichier physique non trouvé:', error.message);
    }

    // Supprimer l'enregistrement en base
    await pool.execute('DELETE FROM user_files WHERE id = ? AND user_id = ?', [fileId, userId]);

    res.json({
      success: true,
      message: 'Fichier supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du fichier'
    });
  }
};

// Vérifier un fichier (admin seulement)
const verifyFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const adminId = req.user.userId;

    // Vérifier que l'utilisateur est admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent vérifier les fichiers'
      });
    }

    // Mettre à jour le statut de vérification
    const updateQuery = `
      UPDATE user_files SET
        is_verified = TRUE, verified_at = NOW(), verified_by = ?
      WHERE id = ?
    `;

    await pool.execute(updateQuery, [adminId, fileId]);

    res.json({
      success: true,
      message: 'Fichier vérifié avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du fichier'
    });
  }
};

// Récupérer les fichiers en attente de vérification (admin)
const getPendingFiles = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès interdit'
      });
    }

    const query = `
      SELECT 
        uf.*,
        u.first_name,
        u.last_name,
        u.email,
        u.role
      FROM user_files uf
      JOIN users u ON uf.user_id = u.id
      WHERE uf.is_verified = FALSE
      ORDER BY uf.created_at ASC
    `;

    const [files] = await pool.execute(query);

    res.json({
      success: true,
      data: files.map(file => ({
        id: file.id,
        file_type: file.file_type,
        original_name: file.original_name,
        file_size: file.file_size,
        mime_type: file.mime_type,
        created_at: file.created_at,
        user: {
          id: file.user_id,
          name: file.first_name + ' ' + file.last_name,
          email: file.email,
          role: file.role
        }
      }))
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers en attente:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers en attente'
    });
  }
};

// Configuration multer pour l'upload de fichiers de cours
// MinIO est OBLIGATOIRE - utiliser uniquement memoryStorage
if (!MinioService.isAvailable()) {
  throw new Error('MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.');
}

const courseStorage = multer.memoryStorage(); // Stockage mémoire pour MinIO

const courseFileFilter = (req, file, cb) => {
  try {
    let options = {};
    try {
      options = req.body.options ? JSON.parse(req.body.options) : {};
    } catch (e) {
      // Ignorer l'erreur de parsing
    }
    
    const category = options.category || req.body.category;
    
    if (category === 'course_thumbnail') {
      // Images seulement
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Format de fichier non supporté. Utilisez JPG ou PNG.'), false);
      }
    } else if (category === 'course_intro_video') {
      // Vidéos seulement
      const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Format de fichier non supporté. Utilisez MP4.'), false);
      }
    } else {
      // Accepter images et vidéos par défaut (pour compatibilité avec uploads de profil)
      // Plus PDF pour les pièces d'identité
      const allowedMimes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
        'application/pdf'
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Type de fichier non autorisé'), false);
      }
    }
  } catch (error) {
    cb(error);
  }
};

const uploadCourse = multer({
  storage: courseStorage,
  fileFilter: courseFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max pour les grosses vidéos
  }
});

// Upload d'un fichier de cours (thumbnail ou vidéo introductive)
const uploadCourseFile = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Non authentifié' 
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    // Lire les options
    let options = {};
    try {
      options = req.body.options ? JSON.parse(req.body.options) : {};
    } catch (e) {
      console.log('Erreur parsing options:', e);
    }

    const category = options.category || 'other';
    
    // Valider la catégorie
    if (!['course_thumbnail', 'course_intro_video'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Catégorie non supportée: ${category}. Utilisez 'course_thumbnail' ou 'course_intro_video'.`
      });
    }

    // Validation taille selon catégorie
    if (category === 'course_thumbnail' && req.file.size > 500 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: 'Fichier trop volumineux. Taille maximale: 500 MB'
      });
    }
    
    if (category === 'course_intro_video' && req.file.size > 500 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: 'Fichier trop volumineux. Taille maximale: 500 MB'
      });
    }

    // Déterminer file_category pour media_files
    const fileCategory = category === 'course_thumbnail' ? 'image' : 'video';
    
    // MinIO est OBLIGATOIRE - pas de fallback local
    if (!MinioService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.'
      });
    }

    let storageType = 'minio';
    let storagePath = null;
    let fileName = null;
    let fileUrl = null;
    let fullFileUrl = null;

    try {
      const folder = category === 'course_thumbnail' ? 'courses/thumbnails' : 'courses/videos';
      const objectName = MinioService.generateObjectName(folder, req.file.originalname, userId);
      const uploadResult = await MinioService.uploadFile(req.file, objectName, req.file.mimetype);
      
      storagePath = objectName;
      fileName = path.basename(objectName);
      fileUrl = uploadResult.url;
      fullFileUrl = uploadResult.url;
      
      // Nettoyer le fichier temporaire local s'il existe
      if (req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (error) {
          console.warn('Impossible de supprimer le fichier temporaire:', error.message);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'upload vers MinIO:', error);
      return res.status(500).json({
        success: false,
        message: `Échec de l'upload vers MinIO: ${error.message}`
      });
    }

    // Vérifier que storagePath et fileUrl sont définis (obligatoires avec MinIO)
    if (!storagePath || !fileUrl) {
      return res.status(500).json({
        success: false,
        message: 'Erreur: storage_path ou url non défini après upload MinIO'
      });
    }

    // Sauvegarder dans media_files
    const insertQuery = `
      INSERT INTO media_files (
        course_id, filename, original_filename,
        file_type, file_category, file_size,
        storage_type, storage_path, url,
        uploaded_by, uploaded_at
      ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // S'assurer qu'aucune valeur n'est undefined
    const [result] = await pool.execute(insertQuery, [
      fileName || 'unnamed-file',
      req.file.originalname || 'unnamed-file',
      req.file.mimetype || 'application/octet-stream',
      fileCategory || 'other',
      req.file.size || 0,
      storageType || 'minio',
      storagePath,
      fileUrl,
      userId
    ]);

    // Générer thumbnail URL (pour images, c'est le même fichier, pour vidéos on pourrait générer plus tard)
    let thumbnailUrl = null;
    if (category === 'course_thumbnail') {
      thumbnailUrl = fullFileUrl;
    }

    // Préparer les métadonnées
    const metadata = {};
    if (category === 'course_thumbnail') {
      // Pour images, on pourrait extraire width/height avec sharp ou jimp
      metadata.category = 'image';
    } else {
      metadata.category = 'video';
      // Pour vidéos, on pourrait extraire duration avec ffmpeg
    }

    // Format de réponse attendu par le frontend
    res.status(201).json({
      success: true,
      data: {
        id: result.insertId.toString(), // Utiliser l'ID de la base
        userId: userId.toString(),
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fullFileUrl,
        storage_path: storagePath,
        thumbnailUrl: category === 'course_thumbnail' ? fullFileUrl : thumbnailUrl,
        metadata: metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'upload du fichier de cours:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'upload du fichier'
    });
  }
};

module.exports = {
  upload,
  uploadCourse,
  uploadProfileFile,
  uploadCourseFile,
  getUserFiles,
  deleteProfileFile,
  verifyFile,
  getPendingFiles
};
