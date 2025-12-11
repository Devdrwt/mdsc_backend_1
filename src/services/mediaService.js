const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const MinioService = require('./minioService');

/**
 * Service de gestion des médias (upload, download, delete)
 */
class MediaService {
  // Configuration des types de fichiers acceptés par content_type
  static CONTENT_TYPE_CONFIG = {
    video: {
      formats: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
      mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
      maxSize: 150 * 1024 * 1024, // 150MB
      category: 'video'
    },
    document: {
      formats: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
      mimeTypes: ['application/pdf', 'application/msword', 
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'application/vnd.ms-excel',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'application/vnd.ms-powerpoint',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      maxSize: 150 * 1024 * 1024, // 150MB
      category: 'document'
    },
    audio: {
      formats: ['mp3', 'wav', 'ogg', 'm4a'],
      mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
      maxSize: 150 * 1024 * 1024, // 150MB
      category: 'audio'
    },
    presentation: {
      formats: ['ppt', 'pptx'],
      mimeTypes: ['application/vnd.ms-powerpoint',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      maxSize: 150 * 1024 * 1024, // 150MB
      category: 'presentation'
    },
    h5p: {
      formats: ['h5p', 'zip'],
      mimeTypes: ['application/zip', 'application/x-h5p'],
      maxSize: 150 * 1024 * 1024, // 150MB
      category: 'h5p'
    },
    image: {
      formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 150 * 1024 * 1024, // 150MB
      category: 'image'
    }
  };

  /**
   * Obtenir le dossier de stockage selon le type de contenu
   */
  static getFolderByContentType(contentType) {
    const folders = {
      'video': 'videos',
      'document': 'documents',
      'audio': 'audio',
      'presentation': 'presentations',
      'h5p': 'h5p',
      'image': 'images'
    };
    return folders[contentType] || 'others';
  }

  /**
   * Obtenir les types MIME autorisés selon le content_type
   */
  static getAllowedMimeTypes(contentType) {
    const config = this.CONTENT_TYPE_CONFIG[contentType];
    return config ? config.mimeTypes : [];
  }

  /**
   * Obtenir la taille maximale selon le content_type
   */
  static getMaxFileSize(contentType) {
    const config = this.CONTENT_TYPE_CONFIG[contentType];
    return config ? config.maxSize : 150 * 1024 * 1024; // Default 150MB
  }

  /**
   * Obtenir la catégorie de fichier selon le content_type
   */
  static getFileCategory(contentType) {
    const config = this.CONTENT_TYPE_CONFIG[contentType];
    return config ? config.category : 'other';
  }

  /**
   * Configurer multer selon le content_type
   * Utilise MinIO si disponible, sinon stockage local
   */
  static getMulterConfig(contentType) {
    const maxSize = this.getMaxFileSize(contentType);
    const allowedMimes = this.getAllowedMimeTypes(contentType);

    // Si MinIO est disponible, utiliser le stockage mémoire (pour upload direct vers MinIO)
    // Sinon, utiliser le stockage disque local
    let storage;
    
    if (MinioService.isAvailable()) {
      // Stockage mémoire pour MinIO (le fichier sera uploadé directement vers MinIO)
      storage = multer.memoryStorage();
    } else {
      // Stockage disque local (fallback)
      const uploadDir = path.join(__dirname, '../../uploads', this.getFolderByContentType(contentType));
      storage = multer.diskStorage({
        destination: async (req, file, cb) => {
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
          cb(null, `${req.user.id || 'anon'}-${uniqueSuffix}${ext}`);
        }
      });
    }

    const fileFilter = (req, file, cb) => {
      if (allowedMimes.length === 0 || allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Type de fichier non autorisé. Types acceptés: ${allowedMimes.join(', ')}`), false);
      }
    };

    return multer({
      storage: storage,
      fileFilter: fileFilter,
      limits: {
        fileSize: maxSize
      }
    });
  }

  /**
   * Sauvegarder les informations d'un fichier uploadé en base
   * Utilise MinIO si disponible, sinon stockage local
   */
  static async saveMediaFile(file, contentType, userId, lessonId = null, courseId = null) {
    const fileCategory = this.getFileCategory(contentType);
    let storageType = 'local';
    let storagePath = null;
    let url = null;
    let filename = file.filename;
    let bucketName = null;
    let objectName = null;

    // Si MinIO est disponible, uploader vers MinIO
    if (MinioService.isAvailable()) {
      try {
        const folder = this.getFolderByContentType(contentType);
        objectName = MinioService.generateObjectName(folder, file.originalname, userId);
        
        // Upload vers MinIO
        const uploadResult = await MinioService.uploadFile(file, objectName, file.mimetype);
        
        storageType = 'minio';
        storagePath = objectName;
        url = uploadResult.url;
        filename = path.basename(objectName);
        bucketName = uploadResult.bucket;
        
        // Nettoyer le fichier temporaire local s'il existe
        if (file.path) {
          try {
            await fs.access(file.path);
            await fs.unlink(file.path);
          } catch (error) {
            // Fichier n'existe pas ou erreur d'accès, ignorer
          }
        }
      } catch (error) {
        console.error('Erreur lors de l\'upload vers MinIO, utilisation du stockage local:', error);
        // Fallback vers stockage local
        storagePath = file.path;
        url = `/uploads/${this.getFolderByContentType(contentType)}/${file.filename}`;
      }
    } else {
      // Stockage local
      storagePath = file.path;
      url = `/uploads/${this.getFolderByContentType(contentType)}/${file.filename}`;
    }

    const insertQuery = `
      INSERT INTO media_files (
        lesson_id, course_id, filename, original_filename,
        file_type, file_category, file_size, storage_type,
        bucket_name, storage_path, url, uploaded_by, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      lessonId,
      courseId,
      filename,
      file.originalname,
      file.mimetype,
      fileCategory,
      file.size,
      storageType,
      bucketName,
      storagePath,
      url,
      userId
    ]);

    return {
      id: result.insertId,
      media_file_id: result.insertId,
      url,
      storage_path: storagePath,
      filename: filename,
      original_filename: file.originalname,
      file_size: file.size,
      file_type: file.mimetype,
      file_category: fileCategory,
      storage_type: storageType,
      bucket_name: bucketName
    };
  }

  /**
   * Récupérer un fichier média par ID
   */
  static async getMediaFile(mediaId) {
    const query = `
      SELECT 
        mf.*,
        u.first_name as uploader_first_name,
        u.last_name as uploader_last_name,
        l.title as lesson_title,
        c.title as course_title
      FROM media_files mf
      LEFT JOIN users u ON mf.uploaded_by = u.id
      LEFT JOIN lessons l ON mf.lesson_id = l.id
      LEFT JOIN courses c ON mf.course_id = c.id
      WHERE mf.id = ?
    `;

    const [files] = await pool.execute(query, [mediaId]);
    return files.length > 0 ? files[0] : null;
  }

  /**
   * Récupérer les fichiers média d'une leçon
   */
  static async getLessonMediaFiles(lessonId) {
    const query = `
      SELECT * FROM media_files
      WHERE lesson_id = ?
      ORDER BY uploaded_at DESC
    `;

    const [files] = await pool.execute(query, [lessonId]);
    return files;
  }

  /**
   * Récupérer les fichiers média d'un cours
   */
  static async getCourseMediaFiles(courseId) {
    const query = `
      SELECT * FROM media_files
      WHERE course_id = ?
      ORDER BY uploaded_at DESC
    `;

    const [files] = await pool.execute(query, [courseId]);
    return files;
  }

  /**
   * Supprimer un fichier média
   */
  static async deleteMediaFile(mediaId) {
    // Récupérer les infos du fichier
    const file = await this.getMediaFile(mediaId);
    if (!file) {
      throw new Error('Fichier média non trouvé');
    }

    // Supprimer le fichier physique selon le type de stockage
    try {
      if (file.storage_type === 'minio' && file.storage_path) {
        // Supprimer depuis MinIO
        await MinioService.deleteFile(file.storage_path);
      } else if (file.storage_type === 'local' && file.url) {
        // Supprimer depuis le stockage local
        const filePath = path.join(__dirname, '../../', file.url);
        try {
          await fs.unlink(filePath);
        } catch (error) {
          console.warn('Fichier local non trouvé lors de la suppression:', error.message);
        }
      }
    } catch (error) {
      console.warn('Erreur lors de la suppression du fichier physique:', error.message);
    }

    // Supprimer l'entrée en base
    const deleteQuery = 'DELETE FROM media_files WHERE id = ?';
    await pool.execute(deleteQuery, [mediaId]);

    return { success: true };
  }

  /**
   * Upload multiple fichiers
   */
  static async uploadBulkFiles(files, contentType, userId, lessonId = null, courseId = null) {
    const results = [];

    for (const file of files) {
      const result = await this.saveMediaFile(file, contentType, userId, lessonId, courseId);
      results.push(result);
    }

    return results;
  }

  /**
   * Obtenir le chemin de téléchargement
   */
  static getDownloadPath(file) {
    // Si c'est un fichier MinIO, retourner l'URL publique
    if (file.storage_type === 'minio' && file.url) {
      return file.url;
    }
    // Sinon, retourner l'URL locale
    return file.url;
  }

  /**
   * Obtenir l'URL complète d'un fichier média
   * Gère les fichiers MinIO et locaux
   */
  static buildMediaUrl(file) {
    if (!file) return null;

    // Si c'est déjà une URL complète (MinIO ou autre), la retourner
    if (file.url && (file.url.startsWith('http://') || file.url.startsWith('https://'))) {
      return file.url;
    }

    // Si c'est un fichier MinIO avec storage_path, construire l'URL
    if (file.storage_type === 'minio' && file.storage_path) {
      return MinioService.getPublicUrl(file.storage_path);
    }

    // Sinon, construire l'URL locale
    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    return file.url ? `${apiUrl}${file.url}` : null;
  }
}

module.exports = MediaService;

