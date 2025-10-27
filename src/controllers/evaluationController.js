const { pool } = require('../config/database');

// Récupérer les évaluations d'un utilisateur
const getUserEvaluations = async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.userId;

    // Vérifier que l'utilisateur peut accéder à ces évaluations
    if (parseInt(userId) !== currentUserId && req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à accéder à ces évaluations'
      });
    }

    // Récupérer les évaluations de l'utilisateur
    const query = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.type,
        e.due_date,
        e.max_score,
        e.is_published,
        c.title as course_title,
        c.id as course_id,
        ue.score,
        ue.submitted_at,
        ue.status,
        ue.feedback
      FROM evaluations e
      LEFT JOIN courses c ON e.course_id = c.id
      LEFT JOIN user_evaluations ue ON e.id = ue.evaluation_id AND ue.user_id = ?
      WHERE e.is_published = TRUE
      ORDER BY e.due_date ASC, e.created_at DESC
    `;

    const [evaluations] = await pool.execute(query, [userId]);

    // Formater les données
    const formattedEvaluations = evaluations.map(evaluation => ({
      id: evaluation.id,
      title: evaluation.title,
      description: evaluation.description,
      type: evaluation.type,
      due_date: evaluation.due_date,
      max_score: evaluation.max_score,
      is_published: evaluation.is_published,
      course: {
        id: evaluation.course_id,
        title: evaluation.course_title
      },
      user_progress: {
        score: evaluation.score,
        submitted_at: evaluation.submitted_at,
        status: evaluation.status,
        feedback: evaluation.feedback
      }
    }));

    res.json({
      success: true,
      data: formattedEvaluations
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des évaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des évaluations'
    });
  }
};

// Récupérer une évaluation spécifique
const getEvaluation = async (req, res) => {
  try {
    const evaluationId = req.params.id;
    const userId = req.user.userId;

    const query = `
      SELECT 
        e.*,
        c.title as course_title,
        c.id as course_id,
        ue.score,
        ue.submitted_at,
        ue.status,
        ue.feedback,
        ue.answers
      FROM evaluations e
      LEFT JOIN courses c ON e.course_id = c.id
      LEFT JOIN user_evaluations ue ON e.id = ue.evaluation_id AND ue.user_id = ?
      WHERE e.id = ? AND e.is_published = TRUE
    `;

    const [evaluations] = await pool.execute(query, [userId, evaluationId]);

    if (evaluations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Évaluation non trouvée'
      });
    }

    const evaluation = evaluations[0];

    res.json({
      success: true,
      data: {
        id: evaluation.id,
        title: evaluation.title,
        description: evaluation.description,
        type: evaluation.type,
        due_date: evaluation.due_date,
        max_score: evaluation.max_score,
        is_published: evaluation.is_published,
        course: {
          id: evaluation.course_id,
          title: evaluation.course_title
        },
        user_progress: {
          score: evaluation.score,
          submitted_at: evaluation.submitted_at,
          status: evaluation.status,
          feedback: evaluation.feedback,
          answers: evaluation.answers
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'évaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'évaluation'
    });
  }
};

// Soumettre une évaluation
const submitEvaluation = async (req, res) => {
  try {
    const evaluationId = req.params.id;
    const userId = req.user.userId;
    const { answers, score } = req.body;

    // Vérifier que l'évaluation existe et est publiée
    const evaluationQuery = `
      SELECT * FROM evaluations 
      WHERE id = ? AND is_published = TRUE
    `;
    const [evaluations] = await pool.execute(evaluationQuery, [evaluationId]);

    if (evaluations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Évaluation non trouvée'
      });
    }

    // Vérifier si l'utilisateur a déjà soumis cette évaluation
    const existingSubmissionQuery = `
      SELECT * FROM user_evaluations 
      WHERE evaluation_id = ? AND user_id = ?
    `;
    const [existingSubmissions] = await pool.execute(existingSubmissionQuery, [evaluationId, userId]);

    if (existingSubmissions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Évaluation déjà soumise'
      });
    }

    // Insérer la soumission
    const insertQuery = `
      INSERT INTO user_evaluations (evaluation_id, user_id, answers, score, status, submitted_at)
      VALUES (?, ?, ?, ?, 'submitted', NOW())
    `;
    
    await pool.execute(insertQuery, [evaluationId, userId, JSON.stringify(answers), score]);

    res.json({
      success: true,
      message: 'Évaluation soumise avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la soumission de l\'évaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la soumission de l\'évaluation'
    });
  }
};

// Récupérer les statistiques d'évaluations d'un utilisateur
const getUserEvaluationStats = async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.userId;

    // Vérifier que l'utilisateur peut accéder à ces statistiques
    if (parseInt(userId) !== currentUserId && req.user.role !== 'admin' && req.user.role !== 'instructor') {
      return res.status(403).json({
        success: false,
        message: 'Non autorisé à accéder à ces statistiques'
      });
    }

    // Statistiques générales
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT e.id) as total_evaluations,
        COUNT(DISTINCT ue.evaluation_id) as evaluations_attempted,
        COUNT(DISTINCT CASE WHEN ue.status = 'submitted' THEN ue.evaluation_id END) as evaluations_submitted,
        COUNT(DISTINCT CASE WHEN ue.status = 'graded' THEN ue.evaluation_id END) as evaluations_graded,
        AVG(CASE WHEN ue.status = 'graded' THEN ue.score END) as average_score,
        MAX(ue.score) as highest_score,
        MIN(ue.score) as lowest_score
      FROM evaluations e
      LEFT JOIN user_evaluations ue ON e.id = ue.evaluation_id AND ue.user_id = ?
      WHERE e.is_published = TRUE
    `;

    const [stats] = await pool.execute(statsQuery, [userId]);

    // Statistiques par type d'évaluation
    const typeStatsQuery = `
      SELECT 
        e.type,
        COUNT(DISTINCT e.id) as total,
        COUNT(DISTINCT ue.evaluation_id) as attempted,
        COUNT(DISTINCT CASE WHEN ue.status = 'submitted' THEN ue.evaluation_id END) as submitted,
        AVG(CASE WHEN ue.status = 'graded' THEN ue.score END) as average_score
      FROM evaluations e
      LEFT JOIN user_evaluations ue ON e.id = ue.evaluation_id AND ue.user_id = ?
      WHERE e.is_published = TRUE
      GROUP BY e.type
    `;

    const [typeStats] = await pool.execute(typeStatsQuery, [userId]);

    // Évaluations récentes
    const recentEvaluationsQuery = `
      SELECT 
        e.id,
        e.title,
        e.type,
        e.due_date,
        ue.status,
        ue.score,
        ue.submitted_at
      FROM evaluations e
      LEFT JOIN user_evaluations ue ON e.id = ue.evaluation_id AND ue.user_id = ?
      WHERE e.is_published = TRUE
      ORDER BY e.due_date ASC
      LIMIT 5
    `;

    const [recentEvaluations] = await pool.execute(recentEvaluationsQuery, [userId]);

    res.json({
      success: true,
      data: {
        overview: {
          total_evaluations: stats[0].total_evaluations || 0,
          evaluations_attempted: stats[0].evaluations_attempted || 0,
          evaluations_submitted: stats[0].evaluations_submitted || 0,
          evaluations_graded: stats[0].evaluations_graded || 0,
          average_score: stats[0].average_score || 0,
          highest_score: stats[0].highest_score || 0,
          lowest_score: stats[0].lowest_score || 0,
          completion_rate: stats[0].total_evaluations > 0 ? 
            ((stats[0].evaluations_submitted || 0) / stats[0].total_evaluations * 100).toFixed(2) : 0
        },
        by_type: typeStats.map(type => ({
          type: type.type,
          total: type.total,
          attempted: type.attempted,
          submitted: type.submitted,
          average_score: type.average_score || 0
        })),
        recent_evaluations: recentEvaluations.map(eval => ({
          id: eval.id,
          title: eval.title,
          type: eval.type,
          due_date: eval.due_date,
          status: eval.status || 'not_started',
          score: eval.score,
          submitted_at: eval.submitted_at
        }))
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques d\'évaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques d\'évaluations'
    });
  }
};

// Créer une évaluation (instructeur)
const createEvaluation = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, type, due_date, max_score, is_published } = req.body;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire du cours
    const courseQuery = 'SELECT id FROM courses WHERE id = ? AND instructor_id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId, instructorId]);

    if (courses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à créer des évaluations pour ce cours'
      });
    }

    // Insérer l'évaluation
    const insertQuery = `
      INSERT INTO evaluations (
        title, description, type, course_id, instructor_id, 
        due_date, max_score, is_published, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      title, description, type, courseId, instructorId,
      due_date, max_score, is_published || false
    ]);

    res.status(201).json({
      success: true,
      message: 'Évaluation créée avec succès',
      data: {
        id: result.insertId,
        course_id: courseId,
        title,
        type
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création de l\'évaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'évaluation'
    });
  }
};

// Récupérer les évaluations d'un cours (instructeur)
const getCourseEvaluations = async (req, res) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire du cours
    const courseQuery = 'SELECT id FROM courses WHERE id = ? AND instructor_id = ?';
    const [courses] = await pool.execute(courseQuery, [courseId, instructorId]);

    if (courses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à voir ce cours'
      });
    }

    // Récupérer les évaluations
    const evaluationsQuery = `
      SELECT 
        e.*,
        COUNT(ue.id) as submissions_count,
        AVG(ue.score) as average_score
      FROM evaluations e
      LEFT JOIN user_evaluations ue ON e.id = ue.evaluation_id
      WHERE e.course_id = ?
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `;

    const [evaluations] = await pool.execute(evaluationsQuery, [courseId]);

    res.json({
      success: true,
      data: evaluations
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des évaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des évaluations'
    });
  }
};

// Modifier une évaluation (instructeur)
const updateEvaluation = async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const { title, description, type, due_date, max_score, is_published } = req.body;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire de l'évaluation
    const evaluationQuery = 'SELECT id FROM evaluations WHERE id = ? AND instructor_id = ?';
    const [evaluations] = await pool.execute(evaluationQuery, [evaluationId, instructorId]);

    if (evaluations.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier cette évaluation'
      });
    }

    // Mettre à jour l'évaluation
    const updateQuery = `
      UPDATE evaluations SET
        title = ?, description = ?, type = ?, due_date = ?,
        max_score = ?, is_published = ?, updated_at = NOW()
      WHERE id = ? AND instructor_id = ?
    `;

    await pool.execute(updateQuery, [
      title, description, type, due_date,
      max_score, is_published, evaluationId, instructorId
    ]);

    res.json({
      success: true,
      message: 'Évaluation mise à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'évaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'évaluation'
    });
  }
};

// Supprimer une évaluation (instructeur)
const deleteEvaluation = async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire de l'évaluation
    const evaluationQuery = 'SELECT id FROM evaluations WHERE id = ? AND instructor_id = ?';
    const [evaluations] = await pool.execute(evaluationQuery, [evaluationId, instructorId]);

    if (evaluations.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à supprimer cette évaluation'
      });
    }

    // Supprimer l'évaluation (les soumissions seront supprimées automatiquement par CASCADE)
    await pool.execute('DELETE FROM evaluations WHERE id = ? AND instructor_id = ?', [evaluationId, instructorId]);

    res.json({
      success: true,
      message: 'Évaluation supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de l\'évaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'évaluation'
    });
  }
};

// Récupérer les soumissions d'une évaluation (instructeur)
const getEvaluationSubmissions = async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur est propriétaire de l'évaluation
    const evaluationQuery = 'SELECT id FROM evaluations WHERE id = ? AND instructor_id = ?';
    const [evaluations] = await pool.execute(evaluationQuery, [evaluationId, instructorId]);

    if (evaluations.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à voir cette évaluation'
      });
    }

    // Récupérer les soumissions
    const submissionsQuery = `
      SELECT 
        ue.*,
        u.first_name,
        u.last_name,
        u.email
      FROM user_evaluations ue
      JOIN users u ON ue.user_id = u.id
      WHERE ue.evaluation_id = ?
      ORDER BY ue.submitted_at DESC
    `;

    const [submissions] = await pool.execute(submissionsQuery, [evaluationId]);

    res.json({
      success: true,
      data: submissions
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des soumissions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des soumissions'
    });
  }
};

// Noter une soumission (instructeur)
const gradeSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { score, feedback } = req.body;
    const instructorId = req.user.userId;

    // Vérifier que l'instructeur peut noter cette soumission
    const submissionQuery = `
      SELECT ue.*, e.instructor_id 
      FROM user_evaluations ue
      JOIN evaluations e ON ue.evaluation_id = e.id
      WHERE ue.id = ?
    `;
    const [submissions] = await pool.execute(submissionQuery, [submissionId]);

    if (submissions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Soumission non trouvée'
      });
    }

    if (submissions[0].instructor_id !== instructorId) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à noter cette soumission'
      });
    }

    // Mettre à jour la note et le feedback
    const updateQuery = `
      UPDATE user_evaluations SET
        score = ?, feedback = ?, status = 'graded', graded_at = NOW()
      WHERE id = ?
    `;

    await pool.execute(updateQuery, [score, feedback, submissionId]);

    res.json({
      success: true,
      message: 'Soumission notée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la notation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la notation'
    });
  }
};

module.exports = {
  getUserEvaluations,
  getEvaluation,
  submitEvaluation,
  getUserEvaluationStats,
  createEvaluation,
  getCourseEvaluations,
  updateEvaluation,
  deleteEvaluation,
  getEvaluationSubmissions,
  gradeSubmission
};
