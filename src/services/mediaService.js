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
      maxSize: 500 * 1024 * 1024, // 500MB pour les grosses vidéos
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
      maxSize: 500 * 1024 * 1024, // 500MB pour les gros documents
      category: 'document'
    },
    audio: {
      formats: ['mp3', 'wav', 'ogg', 'm4a'],
      mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
      maxSize: 500 * 1024 * 1024, // 500MB pour les gros fichiers audio
      category: 'audio'
    },
    presentation: {
      formats: ['ppt', 'pptx'],
      mimeTypes: ['application/vnd.ms-powerpoint',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      maxSize: 500 * 1024 * 1024, // 500MB pour les grosses présentations
      category: 'presentation'
    },
    h5p: {
      formats: ['h5p', 'zip'],
      mimeTypes: ['application/zip', 'application/x-h5p'],
      maxSize: 500 * 1024 * 1024, // 500MB pour les packages H5P
      category: 'h5p'
    },
    image: {
      formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxSize: 500 * 1024 * 1024, // 500MB (images < 10MB généralement)
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
    return config ? config.maxSize : 500 * 1024 * 1024; // Default 500MB pour les grosses vidéos
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

    // MinIO est OBLIGATOIRE - utiliser uniquement memoryStorage
    if (!MinioService.isAvailable()) {
      throw new Error('MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.');
    }

    // Stockage mémoire pour MinIO (le fichier sera uploadé directement vers MinIO)
    const storage = multer.memoryStorage();

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
    let filename = file.filename || null;
    let bucketName = null;
    let objectName = null;

    // MinIO est OBLIGATOIRE - pas de fallback local
    if (!MinioService.isAvailable()) {
      throw new Error('MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.');
    }

    try {
      const folder = this.getFolderByContentType(contentType);
      const originalName = file.originalname || 'unnamed-file';
      objectName = MinioService.generateObjectName(folder, originalName, userId);
      
      // Upload vers MinIO
      const uploadResult = await MinioService.uploadFile(file, objectName, file.mimetype || 'application/octet-stream');
      
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
      console.error('❌ [MEDIA SERVICE] Erreur lors de l\'upload vers MinIO:', error);
      console.error('❌ [MEDIA SERVICE] Détails:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      // Préserver l'erreur originale avec un message amélioré
      let errorMessage = error.message || error.toString() || 'Erreur inconnue lors de l\'upload vers MinIO';
      let errorCode = error.code;
      
      // Si l'erreur originale a un message vide, essayer de l'extraire depuis l'erreur originale
      if (!errorMessage || errorMessage === 'Error' || errorMessage === error.toString()) {
        const originalError = error.originalError || error;
        
        // Logger toutes les propriétés de l'erreur pour debugging
        console.error('🔍 [MEDIA SERVICE] ========== ANALYSE ERREUR ORIGINALE ==========');
        console.error('🔍 [MEDIA SERVICE] Analyse erreur originale:', {
          name: originalError.name,
          message: originalError.message,
          code: originalError.code,
          toString: originalError.toString(),
          stack: originalError.stack, // Stack complet
          keys: Object.keys(originalError || {}),
          allPropertyNames: Object.getOwnPropertyNames(originalError),
          originalError: originalError
        });
        console.error('🔍 [MEDIA SERVICE] ===============================================');
        
        // Essayer d'extraire depuis plusieurs sources
        const errorStr = JSON.stringify(originalError, null, 2) + originalError.toString() + (originalError.stack || '');
        
        // Logger la chaîne complète pour debugging
        console.error('🔍 [MEDIA SERVICE] Chaîne d\'erreur complète:', errorStr.substring(0, 10000)); // Premiers 10000 caractères
        
        const codeMatch = errorStr.match(/<Code>([^<]+)<\/Code>/i);
        const messageMatch = errorStr.match(/<Message>([^<]+)<\/Message>/i);
        
        if (codeMatch) {
          errorCode = codeMatch[1];
          console.error('🔍 [MEDIA SERVICE] Code d\'erreur extrait:', errorCode);
          console.error('🔍 [MEDIA SERVICE] Match complet:', codeMatch[0]);
        } else {
          console.error('⚠️  [MEDIA SERVICE] Aucun code d\'erreur trouvé dans la chaîne');
        }
        if (messageMatch) {
          errorMessage = messageMatch[1];
          console.error('🔍 [MEDIA SERVICE] Message d\'erreur extrait:', errorMessage);
          console.error('🔍 [MEDIA SERVICE] Match complet:', messageMatch[0]);
        } else {
          console.error('⚠️  [MEDIA SERVICE] Aucun message d\'erreur trouvé dans la chaîne');
        }
        
        // Utiliser le message de l'erreur originale si disponible
        if (originalError.message && originalError.message !== 'Error' && originalError.message.trim() !== '') {
          errorMessage = originalError.message;
        }
      }
      
      // Améliorer le message selon le type d'erreur
      if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
        errorMessage = `Impossible de se connecter à MinIO (${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}). Vérifiez la configuration réseau.`;
      } else if (errorCode === 'InvalidAccessKeyId' || errorCode === 'SignatureDoesNotMatch' || errorCode === 'AccessDenied') {
        errorMessage = 'Erreur d\'authentification MinIO. Vérifiez MINIO_ACCESS_KEY et MINIO_SECRET_KEY.';
      } else if (errorCode === 'NoSuchBucket') {
        errorMessage = `Le bucket ${MinioService.defaultBucket} n'existe pas.`;
      } else if (!errorMessage || errorMessage === 'Error' || errorMessage.trim() === '') {
        errorMessage = errorCode ? `Erreur MinIO (${errorCode})` : 'Erreur lors de l\'upload vers MinIO';
      }
      
      const enhancedError = new Error(`Échec de l'upload vers MinIO: ${errorMessage}`);
      enhancedError.originalError = error;
      enhancedError.code = errorCode || error.code;
      enhancedError.originalMessage = error.message;
      throw enhancedError;
    }

    const insertQuery = `
      INSERT INTO media_files (
        lesson_id, course_id, filename, original_filename,
        file_type, file_category, file_size, storage_type,
        bucket_name, storage_path, url, uploaded_by, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    // S'assurer qu'aucune valeur n'est undefined (convertir en null)
    // IMPORTANT: storage_path et url sont NOT NULL dans la table
    // Avec MinIO obligatoire, ces valeurs doivent toujours être définies
    const safeLessonId = lessonId !== undefined ? lessonId : null;
    const safeCourseId = courseId !== undefined ? courseId : null;
    const safeFilename = filename !== undefined && filename !== null ? filename : 'unnamed-file';
    const safeOriginalName = file.originalname !== undefined && file.originalname !== null ? file.originalname : 'unnamed-file';
    const safeMimeType = file.mimetype !== undefined && file.mimetype !== null ? file.mimetype : 'application/octet-stream';
    const safeFileCategory = fileCategory !== undefined && fileCategory !== null ? fileCategory : 'other';
    const safeFileSize = file.size !== undefined && file.size !== null ? file.size : 0;
    const safeStorageType = storageType !== undefined ? storageType : 'minio';
    const safeBucketName = bucketName !== undefined ? bucketName : null;
    // storage_path est NOT NULL - avec MinIO, il doit toujours être défini (objectName)
    if (!storagePath) {
      throw new Error('storage_path ne peut pas être null. Erreur lors de l\'upload vers MinIO.');
    }
    const safeStoragePath = storagePath;
    // url est NOT NULL - avec MinIO, il doit toujours être défini
    if (!url) {
      throw new Error('url ne peut pas être null. Erreur lors de l\'upload vers MinIO.');
    }
    const safeUrl = url;
    const safeUserId = userId !== undefined && userId !== null ? userId : null;

    const [result] = await pool.execute(insertQuery, [
      safeLessonId,
      safeCourseId,
      safeFilename,
      safeOriginalName,
      safeMimeType,
      safeFileCategory,
      safeFileSize,
      safeStorageType,
      safeBucketName,
      safeStoragePath,
      safeUrl,
      safeUserId
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

