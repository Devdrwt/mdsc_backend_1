const ProgressService = require('../services/progressService');
const { pool } = require('../config/database');

/**
 * Contrôleur pour la gestion de la progression
 */

// Récupérer la progression détaillée d'une inscription
const getProgressByEnrollment = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.id;

    // Vérifier que l'utilisateur peut accéder à cette inscription
    const enrollmentQuery = 'SELECT user_id FROM enrollments WHERE id = ?';
    const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    if (enrollments[0].user_id !== userId && req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à accéder à cette progression'
      });
    }

    const progress = await ProgressService.getProgressByEnrollment(enrollmentId);

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la progression:', error);
    
    if (error.message === 'Inscription non trouvée') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la progression'
    });
  }
};

// Marquer une leçon comme complétée
const markLessonCompleted = async (req, res) => {
  try {
    const { enrollmentId, lessonId } = req.params;
    const { time_spent } = req.body;
    const userId = req.user.id;

    // Vérifier que l'inscription appartient à l'utilisateur
    const enrollmentQuery = 'SELECT user_id FROM enrollments WHERE id = ?';
    const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    if (enrollments[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier cette progression'
      });
    }

    const progress = await ProgressService.markLessonCompleted(
      enrollmentId,
      lessonId,
      time_spent || 0
    );

    res.json({
      success: true,
      message: 'Leçon marquée comme complétée',
      data: progress
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la progression:', error);
    
    if (error.message.includes('non trouv')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la mise à jour de la progression'
    });
  }
};

// Mettre à jour la progression d'une leçon
const updateLessonProgress = async (req, res) => {
  try {
    const { enrollmentId, lessonId } = req.params;
    const { completion_percentage, time_spent } = req.body;
    const userId = req.user.id;

    // Vérifier les permissions
    const enrollmentQuery = 'SELECT user_id FROM enrollments WHERE id = ?';
    const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    if (enrollments[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier cette progression'
      });
    }

    if (completion_percentage === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Le pourcentage de complétion est requis'
      });
    }

    await ProgressService.updateLessonProgress(
      enrollmentId,
      lessonId,
      completion_percentage,
      time_spent || 0
    );

    res.json({
      success: true,
      message: 'Progression mise à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la progression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la progression'
    });
  }
};

// Récupérer la progression d'un cours
const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    const progress = await ProgressService.getCourseProgress(courseId, userId);

    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours'
      });
    }

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la progression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la progression'
    });
  }
};

// Récupérer la progression d'une leçon
const getLessonProgress = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    const progress = await ProgressService.getLessonProgress(lessonId, userId);

    res.json({
      success: true,
      data: progress || {
        lesson_id: lessonId,
        status: 'not_started',
        completion_percentage: 0,
        time_spent: 0
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la progression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la progression'
    });
  }
};

module.exports = {
  getProgressByEnrollment,
  markLessonCompleted,
  updateLessonProgress,
  getCourseProgress,
  getLessonProgress
};

