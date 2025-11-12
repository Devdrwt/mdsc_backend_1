const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configuration multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/profiles');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const userId = req.user?.id ?? req.user?.userId ?? 'anon';
    cb(null, `${userId}-${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

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
    fileSize: 5 * 1024 * 1024 // 5MB max
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
    const existingFileQuery = 'SELECT file_path FROM user_files WHERE user_id = ? AND file_type = ?';
    const [existingFiles] = await pool.execute(existingFileQuery, [userId, file_type]);
    
    if (existingFiles.length > 0) {
      try {
        await fs.unlink(existingFiles[0].file_path);
      } catch (error) {
        console.log('Fichier précédent non trouvé:', error.message);
      }
      
      await pool.execute('DELETE FROM user_files WHERE user_id = ? AND file_type = ?', [userId, file_type]);
    }

    // Insérer les informations du fichier en base
    const insertQuery = `
      INSERT INTO user_files (
        user_id, file_type, file_name, original_name, file_path,
        file_size, mime_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      userId,
      file_type,
      req.file.filename || null,
      req.file.originalname || null,
      req.file.path || null,
      req.file.size || 0,
      req.file.mimetype || null
    ]);

    // Construire l'URL complète du fichier
    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const fileUrl = `${apiUrl}/uploads/profiles/${req.file.filename}`;

    res.status(201).json({
      success: true,
      message: 'Fichier uploadé avec succès',
      data: {
        id: result.insertId,
        file_type,
        file_name: req.file.filename,
        original_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        url: fileUrl
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
      data: files.map(file => ({
        id: file.id,
        file_type: file.file_type,
        file_name: file.file_name,
        original_name: file.original_name,
        file_size: file.file_size,
        mime_type: file.mime_type,
        is_verified: file.is_verified,
        verified_at: file.verified_at,
        created_at: file.created_at,
        url: file.file_name ? `${apiUrl}/uploads/profiles/${file.file_name}` : null
      }))
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

    // Supprimer le fichier physique
    try {
      await fs.unlink(files[0].file_path);
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
const courseStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Déterminer le dossier selon la catégorie
    let category = null;
    try {
      let options = {};
      try {
        options = req.body.options ? JSON.parse(req.body.options) : {};
      } catch (e) {
        // Ignorer
      }
      category = options.category || req.body.category;
      
      let uploadDir;
      if (category === 'course_thumbnail') {
        uploadDir = path.join(__dirname, '../../uploads/courses/thumbnails');
      } else if (category === 'course_intro_video') {
        uploadDir = path.join(__dirname, '../../uploads/courses/videos');
      } else {
        // Par défaut, utiliser le dossier profiles (pour compatibilité avec uploads de profil)
        uploadDir = path.join(__dirname, '../../uploads/profiles');
      }
      
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const userId = req.user?.id ?? req.user?.userId ?? 'anon';
    cb(null, `${userId}-${uniqueSuffix}${ext}`);
  }
});

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
    fileSize: 100 * 1024 * 1024 // 100MB max pour vidéos
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
    if (category === 'course_thumbnail' && req.file.size > 5 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: 'Fichier trop volumineux. Taille maximale: 5 MB'
      });
    }
    
    if (category === 'course_intro_video' && req.file.size > 100 * 1024 * 1024) {
      return res.status(413).json({
        success: false,
        message: 'Fichier trop volumineux. Taille maximale: 100 MB'
      });
    }

    // Déterminer file_category pour media_files
    const fileCategory = category === 'course_thumbnail' ? 'image' : 'video';
    
    // Construire l'URL relative pour stockage en base
    // buildMediaUrl construira l'URL complète lors de la récupération
    const folder = category === 'course_thumbnail' ? 'courses/thumbnails' : 'courses/videos';
    const fileUrl = `/uploads/${folder}/${req.file.filename}`;
    
    // URL complète pour la réponse (mais on stocke la relative en base)
    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const fullFileUrl = `${apiUrl}${fileUrl}`;

    // Sauvegarder dans media_files
    const insertQuery = `
      INSERT INTO media_files (
        course_id, filename, original_filename,
        file_type, file_category, file_size,
        storage_type, storage_path, url,
        uploaded_by, uploaded_at
      ) VALUES (NULL, ?, ?, ?, ?, ?, 'local', ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      fileCategory,
      req.file.size,
      req.file.path,
      fileUrl,
      userId
    ]);

    // Générer thumbnail URL (pour images, c'est le même fichier, pour vidéos on pourrait générer plus tard)
    let thumbnailUrl = null;
    if (category === 'course_thumbnail') {
      thumbnailUrl = fileUrl;
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
        storage_path: req.file.path,
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
