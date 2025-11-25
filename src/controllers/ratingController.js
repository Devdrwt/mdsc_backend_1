const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');

/**
 * POST /api/courses/:courseId/ratings
 * Créer une notation
 */
const createRating = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { enrollment_id, rating, comment, pros, cons, would_recommend, is_anonymous } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'La note doit être entre 1 et 5'
      });
    }

    if (!enrollment_id) {
      return res.status(400).json({
        success: false,
        error: 'enrollment_id est requis'
      });
    }

    // Vérifier que l'utilisateur peut noter (a complété le cours)
    const [enrollments] = await pool.execute(
      'SELECT * FROM enrollments WHERE id = ? AND user_id = ? AND course_id = ?',
      [enrollment_id, userId, courseId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inscription non trouvée'
      });
    }

    const enrollment = enrollments[0];

    // Vérifier que le cours est complété (status = 'completed')
    if (enrollment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Vous devez compléter le cours avant de le noter',
        can_rate: false,
        reason: 'course_not_completed'
      });
    }

    // Vérifier si l'utilisateur a déjà noté
    const [existingRatings] = await pool.execute(
      'SELECT id FROM course_reviews WHERE course_id = ? AND user_id = ? AND enrollment_id = ?',
      [courseId, userId, enrollment_id]
    );

    if (existingRatings.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Vous avez déjà noté ce cours',
        can_rate: false,
        has_rated: true
      });
    }

    // Créer la notation
    const [result] = await pool.execute(
      `INSERT INTO course_reviews 
       (course_id, user_id, enrollment_id, rating, comment, pros, cons, would_recommend, is_anonymous, status, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', TRUE)`,
      [
        courseId,
        userId,
        enrollment_id,
        rating,
        comment || null,
        pros || null,
        cons || null,
        would_recommend !== false ? 1 : 0,
        is_anonymous ? 1 : 0
      ]
    );

    // Récupérer la notation créée
    const [newRating] = await pool.execute(
      'SELECT * FROM course_reviews WHERE id = ?',
      [result.insertId]
    );

    // Mettre à jour les statistiques du cours
    await updateCourseRatingStats(courseId);

    res.status(201).json({
      success: true,
      message: 'Notation créée avec succès',
      data: newRating[0]
    });

  } catch (error) {
    console.error('Erreur lors de la création de la notation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/courses/:courseId/ratings
 * Lister les notations d'un cours
 */
const getCourseRatings = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 10, sort = 'recent' } = req.query;
    const offset = (page - 1) * limit;

    let orderBy = 'cr.created_at DESC';
    if (sort === 'rating') orderBy = 'cr.rating DESC, cr.created_at DESC';
    if (sort === 'helpful') orderBy = 'cr.rating DESC';

    const [ratings] = await pool.execute(
      `SELECT 
        cr.*,
        u.first_name,
        u.last_name,
        u.email,
        CASE WHEN cr.is_anonymous = 1 THEN NULL ELSE u.profile_picture END as avatar
       FROM course_reviews cr
       JOIN users u ON cr.user_id = u.id
       WHERE cr.course_id = ? AND cr.status = 'approved' AND cr.is_approved = TRUE
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [courseId, parseInt(limit), offset]
    );

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM course_reviews WHERE course_id = ? AND status = ? AND is_approved = TRUE',
      [courseId, 'approved']
    );

    res.json({
      success: true,
      data: ratings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult[0].total),
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des notations:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/courses/:courseId/ratings/stats
 * Statistiques des notations
 */
const getRatingStats = async (req, res) => {
  try {
    const { courseId } = req.params;

    const [stats] = await pool.execute(
      `SELECT 
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) as rating_count,
        SUM(CASE WHEN would_recommend = 1 THEN 1 ELSE 0 END) as recommendation_count,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5
       FROM course_reviews
       WHERE course_id = ? AND status = 'approved' AND is_approved = TRUE`,
      [courseId]
    );

    const stat = stats[0];
    const recommendationRate = stat.rating_count > 0
      ? (stat.recommendation_count / stat.rating_count) * 100
      : 0;

    res.json({
      success: true,
      data: {
        average_rating: parseFloat(stat.average_rating || 0).toFixed(2),
        rating_count: parseInt(stat.rating_count || 0),
        rating_distribution: {
          "1": parseInt(stat.rating_1 || 0),
          "2": parseInt(stat.rating_2 || 0),
          "3": parseInt(stat.rating_3 || 0),
          "4": parseInt(stat.rating_4 || 0),
          "5": parseInt(stat.rating_5 || 0)
        },
        recommendation_rate: parseFloat(recommendationRate).toFixed(2)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/enrollments/:enrollmentId/can-rate
 * Vérifier si l'étudiant peut noter
 */
const canRate = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    const [enrollments] = await pool.execute(
      'SELECT * FROM enrollments WHERE id = ? AND user_id = ?',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Inscription non trouvée'
      });
    }

    const enrollment = enrollments[0];

    // Vérifier si le cours est complété
    if (enrollment.status !== 'completed') {
      return res.json({
        success: true,
        can_rate: false,
        reason: 'course_not_completed',
        status: enrollment.status
      });
    }

    // Vérifier si déjà noté
    const [existingRatings] = await pool.execute(
      'SELECT id FROM course_reviews WHERE enrollment_id = ?',
      [enrollmentId]
    );

    if (existingRatings.length > 0) {
      return res.json({
        success: true,
        can_rate: false,
        has_rated: true,
        reason: 'already_rated'
      });
    }

    res.json({
      success: true,
      can_rate: true
    });

  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * Fonction helper pour mettre à jour les statistiques du cours
 */
async function updateCourseRatingStats(courseId) {
  try {
    const [stats] = await pool.execute(
      `SELECT 
        COALESCE(AVG(rating), 0) as avg_rating,
        COUNT(*) as count,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5
       FROM course_reviews
       WHERE course_id = ? AND status = 'approved' AND is_approved = TRUE`,
      [courseId]
    );

    const result = stats[0];
    const distribution = {
      "1": parseInt(result.rating_1 || 0),
      "2": parseInt(result.rating_2 || 0),
      "3": parseInt(result.rating_3 || 0),
      "4": parseInt(result.rating_4 || 0),
      "5": parseInt(result.rating_5 || 0)
    };

    await pool.execute(
      `UPDATE courses 
       SET average_rating = ?, 
           rating_count = ?, 
           rating_distribution = ?
       WHERE id = ?`,
      [
        parseFloat(result.avg_rating || 0),
        parseInt(result.count || 0),
        JSON.stringify(distribution),
        courseId
      ]
    );
  } catch (error) {
    console.error('Erreur lors de la mise à jour des statistiques:', error);
  }
}

module.exports = {
  createRating,
  getCourseRatings,
  getRatingStats,
  canRate,
  updateCourseRatingStats
};

