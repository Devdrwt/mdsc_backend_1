const MediaService = require('../services/mediaService');

/**
 * Contrôleur pour la gestion des médias (upload, download, delete)
 */

// Upload d'un fichier
const uploadFile = async (req, res) => {
  try {
    const { content_type, lesson_id, course_id } = req.body;
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

    if (!content_type) {
      return res.status(400).json({
        success: false,
        message: 'Le type de contenu est requis'
      });
    }

    // Vérifier que le type de contenu est valide
    if (!MediaService.CONTENT_TYPE_CONFIG[content_type]) {
      return res.status(400).json({
        success: false,
        message: `Type de contenu non supporté: ${content_type}`
      });
    }

    // Vérifier les permissions si lesson_id ou course_id fourni
    if (lesson_id) {
      const { pool } = require('../config/database');
      const lessonQuery = `
        SELECT l.id, c.instructor_id 
        FROM lessons l
        JOIN courses c ON l.course_id = c.id
        WHERE l.id = ?
      `;
      const [lessons] = await pool.execute(lessonQuery, [lesson_id]);
      
      if (lessons.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Leçon non trouvée'
        });
      }

      if (lessons[0].instructor_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à modifier cette leçon'
        });
      }
    }

    const mediaFile = await MediaService.saveMediaFile(
      req.file,
      content_type,
      userId,
      lesson_id || null,
      course_id || null
    );

    res.status(201).json({
      success: true,
      message: 'Fichier uploadé avec succès',
      data: mediaFile
    });

  } catch (error) {
    console.error('Erreur lors de l\'upload:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'upload du fichier'
    });
  }
};

// Upload multiple fichiers
const uploadBulkFiles = async (req, res) => {
  try {
    const { content_type, lesson_id, course_id } = req.body;
    const userId = req.user?.id ?? req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // req.files peut être un tableau (multer.any) ou un objet (multer.fields)
    const filesArray = Array.isArray(req.files)
      ? req.files
      : (req.files ? Object.values(req.files).flat() : []);

    if (!filesArray || filesArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    if (!content_type) {
      return res.status(400).json({
        success: false,
        message: 'Le type de contenu est requis'
      });
    }

    const results = await MediaService.uploadBulkFiles(
      filesArray,
      content_type,
      userId,
      lesson_id || null,
      course_id || null
    );

    res.status(201).json({
      success: true,
      message: `${results.length} fichier(s) uploadé(s) avec succès`,
      data: results
    });

  } catch (error) {
    console.error('Erreur lors de l\'upload multiple:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload des fichiers'
    });
  }
};

// Récupérer un fichier média
const getMediaFile = async (req, res) => {
  try {
    const { id } = req.params;

    const mediaFile = await MediaService.getMediaFile(id);

    if (!mediaFile) {
      return res.status(404).json({
        success: false,
        message: 'Fichier média non trouvé'
      });
    }

    // Construire l'URL complète si nécessaire
    const { buildMediaUrl } = require('../services/mediaService');
    const mediaFileWithUrl = {
      ...mediaFile,
      url: buildMediaUrl(mediaFile)
    };

    res.json({
      success: true,
      data: mediaFileWithUrl
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du fichier:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du fichier'
    });
  }
};

// Récupérer les fichiers d'une leçon
const getLessonMediaFiles = async (req, res) => {
  try {
    const { lessonId } = req.params;

    const files = await MediaService.getLessonMediaFiles(lessonId);

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers'
    });
  }
};

// Récupérer les fichiers d'un cours
const getCourseMediaFiles = async (req, res) => {
  try {
    const { courseId } = req.params;

    const files = await MediaService.getCourseMediaFiles(courseId);

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des fichiers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fichiers'
    });
  }
};

// Supprimer un fichier média
const deleteMediaFile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Vérifier que l'utilisateur peut supprimer ce fichier
    const mediaFile = await MediaService.getMediaFile(id);
    
    if (!mediaFile) {
      return res.status(404).json({
        success: false,
        message: 'Fichier média non trouvé'
      });
    }

    // Vérifier les permissions
    if (mediaFile.uploaded_by !== userId && req.user.role !== 'admin') {
      // Vérifier si c'est l'instructeur du cours
      if (mediaFile.course_id) {
        const { pool } = require('../config/database');
        const courseQuery = 'SELECT instructor_id FROM courses WHERE id = ?';
        const [courses] = await pool.execute(courseQuery, [mediaFile.course_id]);
        
        if (courses.length === 0 || courses[0].instructor_id !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Vous n\'êtes pas autorisé à supprimer ce fichier'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à supprimer ce fichier'
        });
      }
    }

    await MediaService.deleteMediaFile(id);

    res.json({
      success: true,
      message: 'Fichier supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du fichier:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la suppression du fichier'
    });
  }
};

// Télécharger un fichier
const downloadMediaFile = async (req, res) => {
  try {
    const { id } = req.params;
    const path = require('path');
    const MinioService = require('../services/minioService');

    const mediaFile = await MediaService.getMediaFile(id);

    if (!mediaFile) {
      return res.status(404).json({
        success: false,
        message: 'Fichier média non trouvé'
      });
    }

    // Si le fichier est dans MinIO, télécharger depuis MinIO
    if (mediaFile.storage_type === 'minio' && mediaFile.storage_path) {
      try {
        const fileStream = await MinioService.downloadFile(mediaFile.storage_path);
        
        // Définir les en-têtes
        res.setHeader('Content-Disposition', `attachment; filename="${mediaFile.original_filename}"`);
        res.setHeader('Content-Type', mediaFile.file_type || 'application/octet-stream');
        
        // Stream le fichier vers la réponse
        fileStream.pipe(res);
        
        fileStream.on('error', (err) => {
          console.error('Erreur lors du streaming depuis MinIO:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: 'Erreur lors du téléchargement du fichier'
            });
          }
        });
      } catch (error) {
        console.error('Erreur lors du téléchargement depuis MinIO:', error);
        res.status(500).json({
          success: false,
          message: 'Erreur lors du téléchargement du fichier'
        });
      }
      return;
    }

    // Sinon, télécharger depuis le stockage local
    const filePath = path.join(__dirname, '../../', mediaFile.url);

    res.download(filePath, mediaFile.original_filename, (err) => {
      if (err) {
        console.error('Erreur lors du téléchargement:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement du fichier'
          });
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du fichier'
    });
  }
};

module.exports = {
  uploadFile,
  uploadBulkFiles,
  getMediaFile,
  getLessonMediaFiles,
  getCourseMediaFiles,
  deleteMediaFile,
  downloadMediaFile
};

