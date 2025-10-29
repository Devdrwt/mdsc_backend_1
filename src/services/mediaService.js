const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

/**
 * Service de gestion des médias (upload, download, delete)
 */
class MediaService {
  // Configuration des types de fichiers acceptés par content_type
  static CONTENT_TYPE_CONFIG = {
    video: {
      formats: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
      mimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
      maxSize: 500 * 1024 * 1024, // 500MB
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
      maxSize: 50 * 1024 * 1024, // 50MB
      category: 'document'
    },
    audio: {
      formats: ['mp3', 'wav', 'ogg', 'm4a'],
      mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
      maxSize: 100 * 1024 * 1024, // 100MB
      category: 'audio'
    },
    presentation: {
      formats: ['ppt', 'pptx'],
      mimeTypes: ['application/vnd.ms-powerpoint',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      maxSize: 100 * 1024 * 1024, // 100MB
      category: 'presentation'
    },
    h5p: {
      formats: ['h5p', 'zip'],
      mimeTypes: ['application/zip', 'application/x-h5p'],
      maxSize: 200 * 1024 * 1024, // 200MB
      category: 'h5p'
    },
    image: {
      formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 10 * 1024 * 1024, // 10MB
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
    return config ? config.maxSize : 10 * 1024 * 1024; // Default 10MB
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
   */
  static getMulterConfig(contentType) {
    const uploadDir = path.join(__dirname, '../../uploads', this.getFolderByContentType(contentType));
    const maxSize = this.getMaxFileSize(contentType);
    const allowedMimes = this.getAllowedMimeTypes(contentType);

    const storage = multer.diskStorage({
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
   */
  static async saveMediaFile(file, contentType, userId, lessonId = null, courseId = null) {
    const fileCategory = this.getFileCategory(contentType);
    const storagePath = file.path;
    const url = `/uploads/${this.getFolderByContentType(contentType)}/${file.filename}`;
    
    // Pour l'instant, on utilise le stockage local
    // Plus tard, on pourra adapter pour MinIO/S3
    const insertQuery = `
      INSERT INTO media_files (
        lesson_id, course_id, filename, original_filename,
        file_type, file_category, file_size, storage_type,
        storage_path, url, uploaded_by, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'local', ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      lessonId,
      courseId,
      file.filename,
      file.originalname,
      file.mimetype,
      fileCategory,
      file.size,
      storagePath,
      url,
      userId
    ]);

    return {
      id: result.insertId,
      media_file_id: result.insertId,
      url,
      storage_path: storagePath,
      filename: file.filename,
      original_filename: file.originalname,
      file_size: file.size,
      file_type: file.mimetype,
      file_category: fileCategory
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

    // Supprimer le fichier physique
    try {
      const filePath = path.join(__dirname, '../../', file.url);
      await fs.unlink(filePath);
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
    // Pour l'instant, retourner l'URL
    // Plus tard, on pourra générer un lien signé pour MinIO/S3
    return file.url;
  }
}

module.exports = MediaService;

