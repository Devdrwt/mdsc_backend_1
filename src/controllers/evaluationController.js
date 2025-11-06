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

// Créer une évaluation finale (instructeur) - OBLIGATOIRE ET UNIQUE
const createEvaluation = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { 
      title, 
      description, 
      passing_score = 70, 
      duration_minutes, 
      max_attempts = 3,
      questions // Support pour créer des questions
    } = req.body;
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

    // Vérifier qu'une évaluation finale n'existe pas déjà
    const [existing] = await pool.execute(
      'SELECT id FROM course_evaluations WHERE course_id = ?',
      [courseId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Une évaluation finale existe déjà pour ce cours. Utilisez PUT pour la modifier.'
      });
    }

    // Créer l'évaluation finale dans course_evaluations
    const insertQuery = `
      INSERT INTO course_evaluations (
        course_id, title, description, passing_score,
        duration_minutes, max_attempts, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, TRUE)
    `;

    const [result] = await pool.execute(insertQuery, [
      courseId,
      title,
      description || null,
      passing_score,
      duration_minutes || null,
      max_attempts
    ]);

    // Mettre à jour courses.evaluation_id
    await pool.execute(
      'UPDATE courses SET evaluation_id = ? WHERE id = ?',
      [result.insertId, courseId]
    ).catch(() => {
      // Si la colonne n'existe pas encore, continuer
      console.warn('⚠️ Colonne evaluation_id non trouvée dans courses');
    });

    const evaluationId = result.insertId;

    // Créer les questions si fournies
    if (questions && Array.isArray(questions)) {
      const { sanitizeValue } = require('../utils/sanitize');
      
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        // Pour les évaluations finales, on utilise course_evaluation_id (quiz_id peut être NULL)
        const [questionResult] = await pool.execute(
          `INSERT INTO quiz_questions (
            quiz_id, course_evaluation_id, question_text, question_type, points, order_index, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
          [
            null, // NULL pour les évaluations finales
            evaluationId, // Lien vers l'évaluation finale via course_evaluation_id
            sanitizeValue(question.question_text),
            sanitizeValue(question.question_type || 'multiple_choice'),
            sanitizeValue(question.points || 1),
            question.order_index !== undefined ? question.order_index : i
          ]
        );

        const questionId = questionResult.insertId;

        // Gérer les réponses selon le type de question
        if (question.question_type === 'multiple_choice' && question.options && Array.isArray(question.options)) {
          // QCM : créer plusieurs réponses depuis options
          for (let j = 0; j < question.options.length; j++) {
            const option = question.options[j];
            const isCorrect = question.correct_answer === option || 
                             (typeof question.correct_answer === 'string' && question.correct_answer.trim() === option.trim());
            await pool.execute(
              `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
              [questionId, sanitizeValue(option), isCorrect, j]
            );
          }
        } else if (question.question_type === 'true_false' && question.correct_answer !== undefined) {
          // Vrai/Faux : créer deux réponses (true et false)
          const correctAnswer = question.correct_answer === true || question.correct_answer === 'true';
          await pool.execute(
            `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [questionId, 'Vrai', correctAnswer, 0]
          );
          await pool.execute(
            `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [questionId, 'Faux', !correctAnswer, 1]
          );
        } else if (question.question_type === 'short_answer' && question.correct_answer) {
          // Réponse courte : stocker la réponse correcte dans quiz_answers
          await pool.execute(
            `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [questionId, sanitizeValue(question.correct_answer), true, 0]
          );
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Évaluation finale créée avec succès',
      data: {
        id: evaluationId,
        course_id: courseId
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création de l\'évaluation:', error);
    
    // Si erreur de contrainte unique
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Une évaluation finale existe déjà pour ce cours'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'évaluation'
    });
  }
};

// Récupérer l'évaluation finale d'un cours (instructeur)
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

    // Récupérer l'évaluation finale
    const [evaluations] = await pool.execute(
      `SELECT 
        ce.*,
        COUNT(cea.id) as attempts_count,
        COUNT(CASE WHEN cea.is_passed = TRUE THEN 1 END) as passed_count
       FROM course_evaluations ce
       LEFT JOIN quiz_attempts cea ON ce.id = cea.course_evaluation_id
       WHERE ce.course_id = ?
       GROUP BY ce.id
       LIMIT 1`,
      [courseId]
    );

    if (evaluations.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'Aucune évaluation finale créée pour ce cours'
      });
    }

    const evaluation = evaluations[0];

    // Récupérer les questions liées à l'évaluation finale
    const [questions] = await pool.execute(
      `SELECT 
        qq.id,
        qq.question_text,
        qq.question_type,
        qq.points,
        qq.order_index,
        qq.is_active
       FROM quiz_questions qq
       WHERE qq.course_evaluation_id = ?
       ORDER BY qq.order_index ASC`,
      [evaluation.id]
    );

    // Récupérer les réponses pour chaque question
    const questionsWithAnswers = await Promise.all(
      questions.map(async (question) => {
        const [answers] = await pool.execute(
          `SELECT 
            id,
            answer_text,
            is_correct,
            order_index
           FROM quiz_answers
           WHERE question_id = ?
           ORDER BY order_index ASC`,
          [question.id]
        );

        // Formater les réponses selon le type de question
        let formattedAnswers = [];
        let correctAnswer = null;

        if (question.question_type === 'multiple_choice') {
          // Pour les QCM, retourner toutes les options
          formattedAnswers = answers.map(answer => ({
            id: answer.id,
            text: answer.answer_text,
            is_correct: answer.is_correct === 1 || answer.is_correct === true
          }));
          // Trouver la réponse correcte
          const correct = answers.find(a => a.is_correct === 1 || a.is_correct === true);
          if (correct) {
            correctAnswer = correct.answer_text;
          }
        } else if (question.question_type === 'true_false') {
          // Pour vrai/faux, retourner les deux options
          formattedAnswers = answers.map(answer => ({
            id: answer.id,
            text: answer.answer_text,
            is_correct: answer.is_correct === 1 || answer.is_correct === true
          }));
          // Trouver la réponse correcte (true ou false)
          const correct = answers.find(a => a.is_correct === 1 || a.is_correct === true);
          if (correct) {
            correctAnswer = correct.text === 'Vrai' ? 'true' : 'false';
          }
        } else if (question.question_type === 'short_answer') {
          // Pour réponse courte, stocker la réponse correcte
          if (answers.length > 0) {
            correctAnswer = answers[0].answer_text;
          }
        }

        return {
          id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          points: parseFloat(question.points) || 1,
          order_index: question.order_index || 0,
          is_active: question.is_active === 1 || question.is_active === true,
          options: formattedAnswers.map(a => a.text), // Pour compatibilité avec le frontend
          answers: formattedAnswers, // Format détaillé
          correct_answer: correctAnswer
        };
      })
    );

    res.json({
      success: true,
      data: {
        ...evaluation,
        questions: questionsWithAnswers
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

// Modifier une évaluation (instructeur) - Support pour course_evaluations
const updateEvaluation = async (req, res) => {
  try {
    // Support pour les deux formats : evaluationId ou id
    const evaluationId = req.params.evaluationId || req.params.id;
    const { 
      title, 
      description, 
      passing_score,
      duration_minutes,
      max_attempts,
      is_published,
      questions // Support pour mettre à jour les questions
    } = req.body;
    const instructorId = req.user.userId;

    if (!evaluationId) {
      return res.status(400).json({
        success: false,
        message: 'ID d\'évaluation requis'
      });
    }

    // Vérifier que l'évaluation existe et que l'instructeur est propriétaire du cours
    const [evaluations] = await pool.execute(
      `SELECT ce.*, c.instructor_id 
       FROM course_evaluations ce
       JOIN courses c ON ce.course_id = c.id
       WHERE ce.id = ?`,
      [evaluationId]
    );

    if (evaluations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Évaluation non trouvée'
      });
    }

    const evaluation = evaluations[0];

    if (parseInt(evaluation.instructor_id) !== parseInt(instructorId)) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à modifier cette évaluation'
      });
    }

    // Mettre à jour l'évaluation finale
    const { sanitizeValue } = require('../utils/sanitize');
    const updateFields = [];
    const values = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      values.push(sanitizeValue(title));
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      values.push(sanitizeValue(description));
    }
    if (passing_score !== undefined) {
      updateFields.push('passing_score = ?');
      values.push(sanitizeValue(passing_score));
    }
    if (duration_minutes !== undefined) {
      updateFields.push('duration_minutes = ?');
      values.push(sanitizeValue(duration_minutes));
    }
    if (max_attempts !== undefined) {
      updateFields.push('max_attempts = ?');
      values.push(sanitizeValue(max_attempts));
    }
    if (is_published !== undefined) {
      updateFields.push('is_published = ?');
      values.push(sanitizeValue(is_published));
    }

    if (updateFields.length > 0) {
      values.push(evaluationId);
      await pool.execute(
        `UPDATE course_evaluations SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
      );
    }

    // Mettre à jour les questions si fournies
    if (questions && Array.isArray(questions)) {
      // sanitizeValue déjà importé plus haut
      
      // Supprimer les anciennes questions et réponses
      await pool.execute(
        'DELETE FROM quiz_answers WHERE question_id IN (SELECT id FROM quiz_questions WHERE course_evaluation_id = ?)',
        [evaluationId]
      );
      await pool.execute(
        'DELETE FROM quiz_questions WHERE course_evaluation_id = ?',
        [evaluationId]
      );

      // Créer les nouvelles questions (même logique que createEvaluation)
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        const [questionResult] = await pool.execute(
          `INSERT INTO quiz_questions (
            quiz_id, course_evaluation_id, question_text, question_type, points, order_index, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
          [
            null,
            evaluationId,
            sanitizeValue(question.question_text),
            sanitizeValue(question.question_type || 'multiple_choice'),
            sanitizeValue(question.points || 1),
            sanitizeValue(question.order_index !== undefined ? question.order_index : i)
          ]
        );

        const questionId = questionResult.insertId;

        // Gérer les réponses selon le type de question
        if (question.question_type === 'multiple_choice' && question.options && Array.isArray(question.options)) {
          for (let j = 0; j < question.options.length; j++) {
            const option = question.options[j];
            const isCorrect = question.correct_answer === option || 
                             (typeof question.correct_answer === 'string' && question.correct_answer.trim() === option.trim());
            await pool.execute(
              `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
              [questionId, sanitizeValue(option), isCorrect, j]
            );
          }
        } else if (question.question_type === 'true_false' && question.correct_answer !== undefined) {
          const correctAnswer = question.correct_answer === true || question.correct_answer === 'true';
          await pool.execute(
            `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [questionId, 'Vrai', correctAnswer, 0]
          );
          await pool.execute(
            `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [questionId, 'Faux', !correctAnswer, 1]
          );
        } else if (question.question_type === 'short_answer' && question.correct_answer) {
          await pool.execute(
            `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [questionId, sanitizeValue(question.correct_answer), true, 0]
          );
        }
      }
    }

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

/**
 * Récupérer l'évaluation finale pour un étudiant
 */
const getEnrollmentEvaluation = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.userId;

    // Vérifier l'inscription
    const [enrollments] = await pool.execute(
      'SELECT course_id FROM enrollments WHERE id = ? AND user_id = ?',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    const courseId = enrollments[0].course_id;

    // Récupérer l'évaluation finale
    const [evaluations] = await pool.execute(
      'SELECT * FROM course_evaluations WHERE course_id = ? AND is_published = TRUE',
      [courseId]
    );

    if (evaluations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Évaluation finale non trouvée pour ce cours'
      });
    }

    const evaluation = evaluations[0];

    // Récupérer les tentatives précédentes
    const [attempts] = await pool.execute(
      `SELECT * FROM quiz_attempts 
       WHERE enrollment_id = ? AND course_evaluation_id = ? 
       ORDER BY started_at DESC`,
      [enrollmentId, evaluation.id]
    );

    res.json({
      success: true,
      data: {
        evaluation,
        previous_attempts: attempts,
        can_attempt: attempts.length < evaluation.max_attempts
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

/**
 * Soumettre une tentative d'évaluation finale
 */
const submitEvaluationAttempt = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { answers } = req.body;
    const userId = req.user.userId;

    // Vérifier l'inscription
    const [enrollments] = await pool.execute(
      'SELECT course_id FROM enrollments WHERE id = ? AND user_id = ?',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    const courseId = enrollments[0].course_id;

    // Récupérer l'évaluation finale
    const [evaluations] = await pool.execute(
      'SELECT * FROM course_evaluations WHERE course_id = ? AND is_published = TRUE',
      [courseId]
    );

    if (evaluations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Évaluation finale non trouvée'
      });
    }

    const evaluation = evaluations[0];

    // Vérifier les tentatives
    const [attemptsResult] = await pool.execute(
      `SELECT COUNT(*) as count FROM quiz_attempts 
       WHERE enrollment_id = ? AND course_evaluation_id = ?`,
      [enrollmentId, evaluation.id]
    );

    if (attemptsResult[0].count >= evaluation.max_attempts) {
      return res.status(400).json({
        success: false,
        message: 'Nombre maximum de tentatives atteint'
      });
    }

    // Vérifier que toutes les leçons sont complétées
    const [progressResult] = await pool.execute(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM progress 
       WHERE enrollment_id = ?`,
      [enrollmentId]
    );

    if (progressResult[0].total > 0 && progressResult[0].completed < progressResult[0].total) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez compléter toutes les leçons avant de passer l\'évaluation finale'
      });
    }

    // Créer la tentative
    const [attemptResult] = await pool.execute(
      `INSERT INTO quiz_attempts (
        user_id, quiz_id, course_id, course_evaluation_id, started_at
      ) VALUES (?, NULL, ?, ?, NOW())`,
      [userId, courseId, evaluation.id]
    );

    const attemptId = attemptResult.insertId;

    // Calculer le score (logique similaire à quizController)
    let totalPoints = 0;
    let earnedPoints = 0;

    // Traiter les réponses
    for (const answer of answers) {
      const { question_id, answer_id, answer_text } = answer;

      // Récupérer la question depuis quiz_questions avec course_evaluation_id
      const [questions] = await pool.execute(
        'SELECT points FROM quiz_questions WHERE id = ? AND course_evaluation_id = ?',
        [question_id, evaluation.id]
      );

      if (questions.length > 0) {
        const question = questions[0];
        totalPoints += question.points;

        // Vérifier la réponse
        if (answer_id) {
          const [correctAnswersList] = await pool.execute(
            'SELECT is_correct FROM quiz_answers WHERE id = ? AND question_id = ?',
            [answer_id, question_id]
          );

          if (correctAnswersList.length > 0 && correctAnswersList[0].is_correct) {
            earnedPoints += question.points;
          }
        }
      }
    }

    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const isPassed = percentage >= evaluation.passing_score;

    // Mettre à jour la tentative
    await pool.execute(
      `UPDATE quiz_attempts 
       SET completed_at = NOW(), answers = ?, score = ?, total_points = ?, 
           percentage = ?, is_passed = ?
       WHERE id = ?`,
      [
        JSON.stringify(answers),
        earnedPoints,
        totalPoints,
        percentage,
        isPassed,
        attemptId
      ]
    );

    res.json({
      success: true,
      message: 'Évaluation soumise avec succès',
      data: {
        attempt_id: attemptId,
        score: earnedPoints,
        total_points: totalPoints,
        percentage: percentage,
        is_passed: isPassed,
        eligible_for_certificate: isPassed
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la soumission'
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
  gradeSubmission,
  getEnrollmentEvaluation,
  submitEvaluationAttempt
};
