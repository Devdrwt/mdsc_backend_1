const { pool } = require('../config/database');

const MAX_EVALUATIONS_LIMIT = 100;

const getUserIdentifier = (req) => req.user?.userId || req.user?.id;

const parseLimit = (value, fallback = 20, min = 1, max = MAX_EVALUATIONS_LIMIT) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const parseOffset = (value) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

const formatCourseStatus = (row) => {
  if (row.course_status) {
    return row.course_status;
  }
  if (row.course_is_published === null || row.course_is_published === undefined) {
    return null;
  }
  return row.course_is_published === 1 ? 'published' : 'draft';
};

const fetchUserFinalEvaluation = async (evaluationId, userId) => {
  const finalEvaluationQuery = `
    SELECT ce.*, e.id as enrollment_id, e.course_id
    FROM course_evaluations ce
    INNER JOIN courses c ON ce.course_id = c.id
    INNER JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.is_active = TRUE
    WHERE ce.id = ? AND ce.is_published = TRUE
  `;
  const [rows] = await pool.execute(finalEvaluationQuery, [userId, evaluationId]);
  return rows[0] || null;
};

const getActiveAttemptForEvaluation = async (enrollmentId, evaluationId) => {
  const [attempts] = await pool.execute(
    `SELECT id, started_at
     FROM quiz_attempts 
     WHERE enrollment_id = ? AND course_evaluation_id = ? AND completed_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    [enrollmentId, evaluationId]
  );
  return attempts[0] || null;
};

const getAttemptsForEvaluation = async (enrollmentId, evaluationId) => {
  const [attempts] = await pool.execute(
    `SELECT 
      id,
      score,
      total_points,
      percentage,
      is_passed,
      started_at,
      completed_at
     FROM quiz_attempts
     WHERE enrollment_id = ? AND course_evaluation_id = ?
     ORDER BY started_at DESC`,
    [enrollmentId, evaluationId]
  );

  return attempts;
};

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

    // Récupérer les évaluations classiques (table evaluations)
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

    // Récupérer les évaluations finales (course_evaluations) pour les cours auxquels l'utilisateur est inscrit
    const finalEvaluationsQuery = `
      SELECT 
        ce.id,
        ce.title,
        ce.description,
        ce.passing_score,
        ce.duration_minutes,
        ce.max_attempts,
        ce.is_published,
        ce.created_at,
        ce.updated_at,
        c.id as course_id,
        c.title as course_title,
        c.slug as course_slug,
        e.id as enrollment_id,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN qa.id END) as attempts_count,
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as best_score,
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.completed_at END) as passed_at,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NULL THEN qa.id END) as incomplete_attempts_count,
        MAX(CASE WHEN qa.completed_at IS NULL THEN qa.started_at END) as incomplete_started_at,
        -- Vérifier si tous les modules sont complétés
        (
          SELECT COUNT(DISTINCT m.id) as total_modules
          FROM modules m
          WHERE m.course_id = c.id
        ) as total_modules,
        (
          SELECT COUNT(DISTINCT m.id) as completed_modules
          FROM modules m
          WHERE m.course_id = c.id
          AND (
            -- Un module est complété si toutes ses leçons sont complétées
            SELECT COUNT(DISTINCT l.id) as total_lessons
            FROM lessons l
            WHERE l.module_id = m.id AND l.is_published = TRUE
          ) = (
            SELECT COUNT(DISTINCT l.id) as completed_lessons
            FROM lessons l
            LEFT JOIN progress p ON l.id = p.lesson_id AND p.enrollment_id = e.id
            WHERE l.module_id = m.id 
              AND l.is_published = TRUE 
              AND p.status = 'completed'
          )
          AND (
            SELECT COUNT(DISTINCT l.id) as total_lessons
            FROM lessons l
            WHERE l.module_id = m.id AND l.is_published = TRUE
          ) > 0
        ) as completed_modules
      FROM course_evaluations ce
      INNER JOIN courses c ON ce.course_id = c.id
      INNER JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.is_active = TRUE
      LEFT JOIN quiz_attempts qa ON ce.id = qa.course_evaluation_id AND qa.user_id = ?
      WHERE ce.is_published = TRUE
      GROUP BY ce.id, c.id, e.id
      ORDER BY ce.created_at DESC
    `;

    const [finalEvaluations] = await pool.execute(finalEvaluationsQuery, [userId, userId]);

    // Formater les évaluations classiques pour correspondre à l'interface Evaluation du frontend
    const formattedEvaluations = evaluations.map(evaluation => ({
      id: String(evaluation.id),
      courseId: String(evaluation.course_id || ''),
      courseName: evaluation.course_title || '',
      title: evaluation.title,
      description: evaluation.description || '',
      type: evaluation.type || 'quiz',
      status: evaluation.status || 'not-started',
      dueDate: evaluation.due_date ? new Date(evaluation.due_date).toISOString() : undefined,
      score: evaluation.score,
      maxScore: evaluation.max_score || 100,
      instructions: evaluation.description || '',
      createdAt: evaluation.created_at ? new Date(evaluation.created_at).toISOString() : new Date().toISOString(),
      updatedAt: evaluation.updated_at ? new Date(evaluation.updated_at).toISOString() : new Date().toISOString()
    }));

    // Formater les évaluations finales pour correspondre à l'interface Evaluation du frontend
    const formattedFinalEvaluations = finalEvaluations.map(evaluation => {
      const attemptsCount = Number(evaluation.attempts_count || 0);
      const incompleteAttemptsCount = Number(evaluation.incomplete_attempts_count || 0);
      const maxAttempts = Number(evaluation.max_attempts || 1);
      const canAttempt = attemptsCount < maxAttempts;
      const bestScore = evaluation.best_score !== null && evaluation.best_score !== undefined ? Number(evaluation.best_score) : null;
      const passingScore = Number(evaluation.passing_score || 70);
      const isPassed = bestScore !== null && bestScore >= passingScore;
      
      // Vérifier si tous les modules sont complétés
      const totalModules = Number(evaluation.total_modules || 0);
      const completedModules = Number(evaluation.completed_modules || 0);
      const allModulesCompleted = totalModules > 0 && completedModules === totalModules;
      
      // Déterminer le statut selon l'interface Evaluation
      // Si tous les modules ne sont pas complétés, l'évaluation est verrouillée
      let status = 'not-started';
      if (!allModulesCompleted) {
        status = 'locked'; // Modules non complétés
      } else if (incompleteAttemptsCount > 0) {
        status = 'in-progress'; // Minuterie active
      } else if (attemptsCount > 0) {
        if (isPassed) {
          status = 'graded';
        } else if (canAttempt) {
          status = 'not-started'; // Peut recommencer
        } else {
          status = 'graded'; // Échoué après toutes les tentatives
        }
      }

      return {
        id: String(evaluation.id),
        courseId: String(evaluation.course_id),
        courseName: evaluation.course_title,
        title: evaluation.title,
        description: evaluation.description || '',
        type: 'exam',
        status: status,
        dueDate: null, // Les évaluations finales n'ont pas de date limite
        score: bestScore,
        maxScore: 100, // Score maximum pourcentage
        instructions: evaluation.description || '',
        createdAt: evaluation.created_at ? new Date(evaluation.created_at).toISOString() : new Date().toISOString(),
        updatedAt: evaluation.updated_at ? new Date(evaluation.updated_at).toISOString() : new Date().toISOString(),
        // Champs supplémentaires pour les évaluations finales
        enrollment_id: evaluation.enrollment_id,
        passing_score: passingScore,
        duration_minutes: evaluation.duration_minutes,
        max_attempts: maxAttempts,
        attempts_count: attemptsCount,
        is_final: true,
        is_locked: !allModulesCompleted,
        // Informations de tentative incomplète pour le timer
        incomplete_started_at: evaluation.incomplete_started_at ? new Date(evaluation.incomplete_started_at).toISOString() : null
      };
    });

    // Récupérer les quiz de modules pour les cours auxquels l'utilisateur est inscrit
    const moduleQuizzesQuery = `
      SELECT 
        mq.id,
        mq.title,
        mq.description,
        mq.passing_score,
        mq.time_limit_minutes,
        mq.max_attempts,
        mq.is_published,
        mq.created_at,
        mq.updated_at,
        m.id as module_id,
        m.title as module_title,
        m.order_index as module_order,
        c.id as course_id,
        c.title as course_title,
        c.slug as course_slug,
        e.id as enrollment_id,
        -- Vérifier si toutes les leçons du module sont complétées
        (
          SELECT COUNT(DISTINCT l.id) as total_lessons
          FROM lessons l
          WHERE l.module_id = m.id AND l.is_published = TRUE
        ) as total_lessons,
        (
          SELECT COUNT(DISTINCT l.id) as completed_lessons
          FROM lessons l
          LEFT JOIN progress p ON l.id = p.lesson_id AND p.enrollment_id = e.id
          WHERE l.module_id = m.id 
            AND l.is_published = TRUE 
            AND p.status = 'completed'
        ) as completed_lessons,
        -- Trouver la leçon quiz ou la dernière leçon du module pour la redirection
        (
          SELECT l.id
          FROM lessons l
          WHERE l.module_id = m.id 
            AND l.is_published = TRUE
            AND (l.content_type = 'quiz' OR l.content_type = 'exercise')
          ORDER BY l.order_index DESC
          LIMIT 1
        ) as quiz_lesson_id,
        -- Si pas de leçon quiz, prendre la dernière leçon du module
        (
          SELECT l.id
          FROM lessons l
          WHERE l.module_id = m.id 
            AND l.is_published = TRUE
          ORDER BY l.order_index DESC
          LIMIT 1
        ) as last_lesson_id,
        -- Meilleur score du quiz
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as best_score,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN qa.id END) as attempts_count
      FROM module_quizzes mq
      INNER JOIN modules m ON mq.module_id = m.id
      INNER JOIN courses c ON m.course_id = c.id
      INNER JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.is_active = TRUE
      LEFT JOIN quiz_attempts qa ON mq.id = qa.module_quiz_id AND qa.user_id = ?
      WHERE mq.is_published = TRUE
      GROUP BY mq.id, m.id, c.id, e.id
      ORDER BY m.order_index ASC, mq.created_at DESC
    `;

    const [moduleQuizzes] = await pool.execute(moduleQuizzesQuery, [userId, userId]);

    // Formater les quiz de modules
    const formattedModuleQuizzes = moduleQuizzes.map(quiz => {
      const totalLessons = Number(quiz.total_lessons || 0);
      const completedLessons = Number(quiz.completed_lessons || 0);
      const isModuleCompleted = totalLessons > 0 && completedLessons === totalLessons;
      const bestScore = quiz.best_score !== null && quiz.best_score !== undefined ? Number(quiz.best_score) : null;
      const attemptsCount = Number(quiz.attempts_count || 0);
      const passingScore = Number(quiz.passing_score || 70);
      const isPassed = bestScore !== null && bestScore >= passingScore;
      
      // Déterminer le statut
      let status = 'not-started';
      if (!isModuleCompleted) {
        status = 'locked'; // Module non complété
      } else if (attemptsCount > 0) {
        if (isPassed) {
          status = 'graded';
        } else {
          status = 'graded'; // Échoué
        }
      }

      // Déterminer la leçon pour la redirection (priorité à quiz_lesson_id, sinon last_lesson_id)
      const lessonId = quiz.quiz_lesson_id || quiz.last_lesson_id;

      return {
        id: `module_quiz_${quiz.id}`, // Préfixe pour distinguer des autres évaluations
        courseId: String(quiz.course_id),
        courseName: quiz.course_title,
        title: quiz.title,
        description: quiz.description || '',
        type: 'quiz',
        status: status,
        dueDate: null,
        score: bestScore,
        maxScore: 100,
        instructions: quiz.description || '',
        createdAt: quiz.created_at ? new Date(quiz.created_at).toISOString() : new Date().toISOString(),
        updatedAt: quiz.updated_at ? new Date(quiz.updated_at).toISOString() : new Date().toISOString(),
        // Champs supplémentaires pour les quiz de modules
        is_module_quiz: true,
        module_id: quiz.module_id,
        module_title: quiz.module_title,
        lesson_id: lessonId,
        enrollment_id: quiz.enrollment_id,
        passing_score: passingScore,
        time_limit_minutes: quiz.time_limit_minutes,
        max_attempts: quiz.max_attempts,
        attempts_count: attemptsCount,
        is_locked: !isModuleCompleted
      };
    });

    // Combiner tous les types d'évaluations
    const allEvaluations = [...formattedEvaluations, ...formattedFinalEvaluations, ...formattedModuleQuizzes];

    res.json({
      success: true,
      data: allEvaluations
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des évaluations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des évaluations'
    });
  }
};

// Vérifier l'existence d'une tentative (sans en créer une nouvelle)
const checkEvaluationAttempt = async (req, res) => {
  try {
    const evaluationId = req.params.id;
    const userId = req.user.userId;

    const evaluation = await fetchUserFinalEvaluation(evaluationId, userId);

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Évaluation non trouvée'
      });
    }

    const activeAttempt = await getActiveAttemptForEvaluation(evaluation.enrollment_id, evaluationId);

    if (activeAttempt) {
      return res.json({
        success: true,
        data: {
          attemptId: activeAttempt.id,
          startedAt: activeAttempt.started_at,
          durationMinutes: evaluation.duration_minutes,
          exists: true
        }
      });
    }

    return res.json({
      success: true,
      data: {
        exists: false,
        durationMinutes: evaluation.duration_minutes
      }
    });

  } catch (error) {
    console.error('Erreur lors de la vérification de la tentative:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de la tentative'
    });
  }
};

// Récupérer les tentatives d'une évaluation finale
const getEvaluationAttempts = async (req, res) => {
  try {
    const evaluationId = req.params.id;
    const userId = req.user.userId;

    const evaluation = await fetchUserFinalEvaluation(evaluationId, userId);

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Évaluation non trouvée'
      });
    }

    const attempts = await getAttemptsForEvaluation(evaluation.enrollment_id, evaluationId);
    const maxAttempts = Number(evaluation.max_attempts || 1);
    const activeAttempt = attempts.find((attempt) => !attempt.completed_at);

    res.json({
      success: true,
      data: {
        evaluation_id: evaluation.id,
        evaluation_title: evaluation.title,
        enrollment_id: evaluation.enrollment_id,
        course_id: evaluation.course_id,
        max_attempts: maxAttempts,
        attempts: attempts.map((attempt) => ({
          id: attempt.id,
          score: attempt.score,
          total_points: attempt.total_points,
          percentage: attempt.percentage,
          is_passed: Boolean(attempt.is_passed),
          started_at: attempt.started_at,
          completed_at: attempt.completed_at
        })),
        can_attempt: attempts.length < maxAttempts,
        attempts_count: attempts.length,
        active_attempt: activeAttempt
          ? {
              id: activeAttempt.id,
              started_at: activeAttempt.started_at,
              duration_minutes: evaluation.duration_minutes
            }
          : null,
        duration_minutes: evaluation.duration_minutes
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des tentatives:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tentatives'
    });
  }
};

// Démarrer une tentative d'évaluation finale
const startEvaluationAttempt = async (req, res) => {
  try {
    const evaluationId = req.params.id;
    const userId = req.user.userId;

    const evaluation = await fetchUserFinalEvaluation(evaluationId, userId);

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: 'Évaluation non trouvée'
      });
    }

    const enrollmentId = evaluation.enrollment_id;
    const courseId = evaluation.course_id;
    const attempts = await getAttemptsForEvaluation(enrollmentId, evaluationId);
    const activeAttempt = attempts.find((attempt) => !attempt.completed_at);
    const maxAttempts = Number(evaluation.max_attempts || 1);

    if (activeAttempt) {
      return res.json({
        success: true,
        data: {
          attemptId: activeAttempt.id,
          startedAt: activeAttempt.started_at,
          durationMinutes: evaluation.duration_minutes
        }
      });
    }

    if (attempts.length >= maxAttempts) {
      return res.status(400).json({
        success: false,
        message: 'Nombre maximum de tentatives atteint'
      });
    }

    const [attemptResult] = await pool.execute(
      `INSERT INTO quiz_attempts (
        user_id, quiz_id, course_id, course_evaluation_id, enrollment_id, started_at
      ) VALUES (?, NULL, ?, ?, ?, NOW())`,
      [userId, courseId, evaluationId, enrollmentId]
    );

    res.json({
      success: true,
      data: {
        attemptId: attemptResult.insertId,
        startedAt: new Date(),
        durationMinutes: evaluation.duration_minutes
      }
    });

  } catch (error) {
    console.error('Erreur lors du démarrage de la tentative:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du démarrage de la tentative'
    });
  }
};

// Récupérer une évaluation spécifique
const getEvaluation = async (req, res) => {
  try {
    const evaluationId = req.params.id;
    const userId = req.user.userId;

    // D'abord, essayer de récupérer depuis la table evaluations (évaluations classiques)
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

    if (evaluations.length > 0) {
      // Évaluation classique trouvée
      const evaluation = evaluations[0];
      return res.json({
        success: true,
        data: {
          id: String(evaluation.id),
          courseId: String(evaluation.course_id || ''),
          courseName: evaluation.course_title || '',
          title: evaluation.title,
          description: evaluation.description || '',
          type: evaluation.type || 'quiz',
          status: evaluation.status || 'not-started',
          dueDate: evaluation.due_date ? new Date(evaluation.due_date).toISOString() : undefined,
          score: evaluation.score,
          maxScore: evaluation.max_score || 100,
          instructions: evaluation.description || '',
          createdAt: evaluation.created_at ? new Date(evaluation.created_at).toISOString() : new Date().toISOString(),
          updatedAt: evaluation.updated_at ? new Date(evaluation.updated_at).toISOString() : new Date().toISOString(),
          feedback: evaluation.feedback,
          answers: evaluation.answers
        }
      });
    }

    // Si pas trouvé dans evaluations, chercher dans course_evaluations (évaluations finales)
    // Vérifier que l'utilisateur est inscrit au cours
    const finalEvaluationQuery = `
      SELECT 
        ce.*,
        c.id as course_id,
        c.title as course_title,
        c.slug as course_slug,
        e.id as enrollment_id,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN qa.id END) as attempts_count,
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as best_score,
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.completed_at END) as passed_at
      FROM course_evaluations ce
      INNER JOIN courses c ON ce.course_id = c.id
      INNER JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.is_active = TRUE
      LEFT JOIN quiz_attempts qa ON ce.id = qa.course_evaluation_id AND qa.user_id = ?
      WHERE ce.id = ? AND ce.is_published = TRUE
      GROUP BY ce.id, c.id, e.id
    `;

    const [finalEvaluations] = await pool.execute(finalEvaluationQuery, [userId, userId, evaluationId]);

    if (finalEvaluations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Évaluation introuvable. Cette évaluation n\'existe pas ou vous n\'y avez pas accès.'
      });
    }

    // Évaluation finale trouvée
    const evaluation = finalEvaluations[0];
    const attemptsCount = Number(evaluation.attempts_count || 0);
    const maxAttempts = Number(evaluation.max_attempts || 1);
    const canAttempt = attemptsCount < maxAttempts;
    const bestScore = evaluation.best_score !== null && evaluation.best_score !== undefined ? Number(evaluation.best_score) : null;
    const passingScore = Number(evaluation.passing_score || 70);
    const isPassed = bestScore !== null && bestScore >= passingScore;
    
    // Déterminer le statut
    let status = 'not-started';
    if (attemptsCount > 0) {
      if (isPassed) {
        status = 'graded';
      } else if (canAttempt) {
        status = 'in-progress';
      } else {
        status = 'graded'; // Échoué après toutes les tentatives
      }
    }

    // Récupérer les questions de l'évaluation finale
    const [questions] = await pool.execute(
      `SELECT 
        qq.id,
        qq.question_text,
        qq.question_type,
        qq.points,
        qq.order_index,
        qq.is_active
       FROM quiz_questions qq
       WHERE qq.course_evaluation_id = ? AND qq.is_active = TRUE
       ORDER BY qq.order_index ASC`,
      [evaluationId]
    );

    // Récupérer les réponses pour chaque question
    const questionsWithAnswers = await Promise.all(
      questions.map(async (question) => {
        const [answers] = await pool.execute(
          `SELECT id, answer_text, is_correct, order_index
           FROM quiz_answers
           WHERE question_id = ?
           ORDER BY order_index ASC`,
          [question.id]
        );
        return {
          ...question,
          points: Number(question.points) || 0, // S'assurer que points est un nombre
          order_index: Number(question.order_index) || 0,
          answers: answers.map(a => ({
            id: a.id,
            text: a.answer_text,
            isCorrect: a.is_correct === 1 || a.is_correct === true,
            orderIndex: a.order_index
          }))
        };
      })
    );

    res.json({
      success: true,
      data: {
        id: String(evaluation.id),
        courseId: String(evaluation.course_id),
        courseName: evaluation.course_title,
        title: evaluation.title,
        description: evaluation.description || '',
        type: 'exam',
        status: status,
        dueDate: null,
        score: bestScore,
        maxScore: 100,
        instructions: evaluation.description || '',
        createdAt: evaluation.created_at ? new Date(evaluation.created_at).toISOString() : new Date().toISOString(),
        updatedAt: evaluation.updated_at ? new Date(evaluation.updated_at).toISOString() : new Date().toISOString(),
        // Champs spécifiques aux évaluations finales
        enrollment_id: evaluation.enrollment_id,
        passing_score: passingScore,
        duration_minutes: evaluation.duration_minutes,
        max_attempts: maxAttempts,
        attempts_count: attemptsCount,
        can_attempt: canAttempt,
        is_final: true,
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

// Soumettre une évaluation
const submitEvaluation = async (req, res) => {
  try {
    const evaluationId = req.params.id;
    const userId = req.user.userId;
    const { answers, score, enrollmentId } = req.body;

    // D'abord, vérifier si c'est une évaluation finale (course_evaluations)
    const finalEvaluationQuery = `
      SELECT ce.*, e.id as enrollment_id, e.course_id
      FROM course_evaluations ce
      INNER JOIN courses c ON ce.course_id = c.id
      INNER JOIN enrollments e ON c.id = e.course_id AND e.user_id = ? AND e.is_active = TRUE
      WHERE ce.id = ? AND ce.is_published = TRUE
    `;
    const [finalEvaluations] = await pool.execute(finalEvaluationQuery, [userId, evaluationId]);

    if (finalEvaluations.length > 0) {
      // C'est une évaluation finale, utiliser la logique de submitEvaluationAttempt
      const evaluation = finalEvaluations[0];
      let actualEnrollmentId = enrollmentId || evaluation.enrollment_id;
      const courseId = evaluation.course_id;

      // Si enrollmentId n'est pas fourni, le récupérer automatiquement
      if (!actualEnrollmentId) {
        const [enrollments] = await pool.execute(
          'SELECT id FROM enrollments WHERE course_id = ? AND user_id = ? AND is_active = TRUE',
          [courseId, userId]
        );

        if (enrollments.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Vous n\'êtes pas inscrit à ce cours'
          });
        }

        actualEnrollmentId = enrollments[0].id;
      } else {
        // Vérifier l'inscription si fournie
        const [enrollments] = await pool.execute(
          'SELECT course_id FROM enrollments WHERE id = ? AND user_id = ? AND is_active = TRUE',
          [actualEnrollmentId, userId]
        );

        if (enrollments.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Inscription non trouvée'
          });
        }

        // Vérifier que l'évaluation appartient bien au cours
        if (enrollments[0].course_id !== courseId) {
          return res.status(403).json({
            success: false,
            message: 'Cette évaluation n\'appartient pas à votre cours'
          });
        }
      }

      // Vérifier s'il y a une tentative incomplète existante
      const [existingAttempts] = await pool.execute(
        `SELECT id, started_at FROM quiz_attempts 
         WHERE enrollment_id = ? AND course_evaluation_id = ? AND completed_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1`,
        [actualEnrollmentId, evaluationId]
      );

      let attemptId;
      let startedAt;

      if (existingAttempts.length > 0) {
        // Utiliser la tentative existante
        attemptId = existingAttempts[0].id;
        startedAt = existingAttempts[0].started_at;
      } else {
        // Vérifier le nombre de tentatives complètes (seulement les complètes comptent)
        const [attemptsResult] = await pool.execute(
          `SELECT COUNT(*) as count FROM quiz_attempts 
           WHERE enrollment_id = ? AND course_evaluation_id = ? AND completed_at IS NOT NULL`,
          [actualEnrollmentId, evaluationId]
        );

        if (attemptsResult[0].count >= evaluation.max_attempts) {
          return res.status(400).json({
            success: false,
            message: 'Nombre maximum de tentatives atteint'
          });
        }

        // Créer une nouvelle tentative seulement s'il n'y en a pas d'incomplète
        const [attemptResult] = await pool.execute(
          `INSERT INTO quiz_attempts (
            user_id, quiz_id, course_id, course_evaluation_id, enrollment_id, started_at
          ) VALUES (?, NULL, ?, ?, ?, NOW())`,
          [userId, courseId, evaluationId, actualEnrollmentId]
        );

        attemptId = attemptResult.insertId;
        startedAt = new Date();
      }

      // Récupérer toutes les questions de l'évaluation
      const [allQuestions] = await pool.execute(
        `SELECT id, points, question_type FROM quiz_questions 
         WHERE course_evaluation_id = ? AND is_active = TRUE`,
        [evaluationId]
      );

      // Calculer le score
      let totalPoints = 0;
      let earnedPoints = 0;
      let correctAnswers = 0;
      let totalQuestions = 0;

      // Convertir answers en format standard si c'est un objet
      let answersArray = [];
      if (Array.isArray(answers)) {
        answersArray = answers;
      } else if (typeof answers === 'object' && answers !== null) {
        answersArray = Object.entries(answers).map(([question_id, answer_value]) => ({
          question_id: String(question_id),
          answer_id: typeof answer_value === 'object' && answer_value !== null ? answer_value.id : answer_value,
          answer_text: typeof answer_value === 'object' && answer_value !== null ? answer_value.text : String(answer_value || '')
        }));
      }

      // Traiter chaque question
      for (const question of allQuestions) {
        const questionPoints = Number(question.points) || 0;
        totalPoints += questionPoints;
        totalQuestions++;

        const answer = answersArray.find(a => String(a.question_id) === String(question.id));
        if (!answer) continue;

        const { answer_id, answer_text } = answer;

        if (answer_id) {
          const [correctAnswersList] = await pool.execute(
            'SELECT is_correct FROM quiz_answers WHERE id = ? AND question_id = ?',
            [answer_id, question.id]
          );

          if (correctAnswersList.length > 0 && correctAnswersList[0].is_correct) {
            earnedPoints += questionPoints;
            correctAnswers++;
          }
        } else if (answer_text) {
          const [correctAnswersList] = await pool.execute(
            'SELECT answer_text FROM quiz_answers WHERE question_id = ? AND is_correct = TRUE',
            [question.id]
          );

          if (correctAnswersList.length > 0) {
            const correctText = correctAnswersList[0].answer_text?.toLowerCase().trim();
            const userText = answer_text.toLowerCase().trim();
            
            // Comparaison exacte d'abord
            let isCorrect = correctText === userText;
            
            // Si pas de correspondance exacte, faire une comparaison flexible
            if (!isCorrect && correctText && userText) {
              // Normaliser les textes : supprimer les accents, ponctuation, espaces multiples
              const normalize = (text) => {
                return text
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
                  .replace(/[^\w\s]/g, ' ') // Remplacer la ponctuation par des espaces
                  .replace(/\s+/g, ' ') // Remplacer les espaces multiples par un seul
                  .trim();
              };
              
              const normalizedCorrect = normalize(correctText);
              const normalizedUser = normalize(userText);
              
              // Vérifier si les mots-clés importants sont présents
              const correctWords = normalizedCorrect.split(' ').filter(w => w.length > 3); // Mots de plus de 3 caractères
              const userWords = normalizedUser.split(' ');
              
              // Compter les mots-clés présents
              const matchingKeywords = correctWords.filter(word => 
                userWords.some(uw => uw.includes(word) || word.includes(uw))
              );
              
              // Si au moins 70% des mots-clés sont présents, considérer comme correct
              const keywordMatchRatio = correctWords.length > 0 
                ? matchingKeywords.length / correctWords.length 
                : 0;
              
              // Ou si la similarité de Levenshtein est élevée (simplifié : longueur similaire et beaucoup de mots en commun)
              const wordOverlap = matchingKeywords.length / Math.max(correctWords.length, userWords.length);
              
              // Accepter si au moins 70% des mots-clés correspondent OU si 80% de similarité de mots
              isCorrect = keywordMatchRatio >= 0.7 || wordOverlap >= 0.8;
              
              console.log(`[Evaluation] Comparaison flexible pour question ${question.id}:`, {
                correctText: correctText.substring(0, 100),
                userText: userText.substring(0, 100),
                normalizedCorrect: normalizedCorrect.substring(0, 100),
                normalizedUser: normalizedUser.substring(0, 100),
                correctWords: correctWords,
                matchingKeywords: matchingKeywords,
                keywordMatchRatio: keywordMatchRatio,
                wordOverlap: wordOverlap,
                isCorrect: isCorrect
              });
            }
            
            if (isCorrect) {
              earnedPoints += questionPoints;
              correctAnswers++;
            }
          }
        }
      }

      const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
      const passingScore = Number(evaluation.passing_score) || 70;
      const isPassed = percentage >= passingScore;

      // Mettre à jour la tentative
      await pool.execute(
        `UPDATE quiz_attempts 
         SET completed_at = NOW(), answers = ?, score = ?, total_points = ?, 
             percentage = ?, is_passed = ?
         WHERE id = ?`,
        [
          JSON.stringify(answersArray),
          earnedPoints,
          totalPoints,
          percentage,
          isPassed,
          attemptId
        ]
      );

      // Recalculer la progression du cours après la complétion de l'évaluation finale
      try {
        const ProgressService = require('../services/progressService');
        await ProgressService.updateCourseProgress(actualEnrollmentId);
        console.log(`✅ [Evaluation] Progression recalculée pour l'enrollment ${actualEnrollmentId} après soumission de l'évaluation finale`);
      } catch (progressError) {
        console.error('❌ [Evaluation] Erreur lors du recalcul de la progression:', progressError);
        // Ne pas bloquer la réponse si le recalcul échoue
      }

      // Créer une notification
      const notificationTitle = isPassed 
        ? `✅ Évaluation finale réussie : ${evaluation.title}`
        : `❌ Évaluation finale échouée : ${evaluation.title}`;
      const notificationMessage = isPassed
        ? `Félicitations ! Vous avez réussi l'évaluation finale "${evaluation.title}" avec un score de ${Math.round(percentage)}%.`
        : `Vous avez obtenu ${Math.round(percentage)}% à l'évaluation finale "${evaluation.title}". Le score minimum requis est ${passingScore}%.`;

      try {
        await pool.execute(
          `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            userId,
            notificationTitle,
            notificationMessage,
            isPassed ? 'evaluation_passed' : 'evaluation_failed',
            `/dashboard/student/evaluations/${evaluationId}/results`,
            JSON.stringify({ 
              evaluationId: evaluationId, 
              evaluationTitle: evaluation.title,
              score: percentage,
              isPassed: isPassed
            })
          ]
        );
      } catch (notificationError) {
        console.error('Erreur notification:', notificationError);
      }

      return res.json({
        success: true,
        message: isPassed ? 'Évaluation réussie !' : 'Évaluation soumise',
        data: {
          attempt_id: attemptId,
          score: earnedPoints,
          total_points: totalPoints,
          percentage: Math.round(percentage * 100) / 100,
          passed: isPassed,
          is_passed: isPassed,
          correct_answers: correctAnswers,
          total_questions: totalQuestions,
          enrollmentId: actualEnrollmentId
        }
      });
    }

    // Si ce n'est pas une évaluation finale, chercher dans l'ancienne table
    let evaluationQuery = `
      SELECT * FROM evaluations 
      WHERE id = ? AND is_published = TRUE
    `;
    [evaluations] = await pool.execute(evaluationQuery, [evaluationId]);

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

    // Calculer le score si non fourni
    const calculatedScore = req.body.score || 0;

    // Insérer la soumission
    const insertQuery = `
      INSERT INTO user_evaluations (evaluation_id, user_id, answers, score, status, submitted_at)
      VALUES (?, ?, ?, ?, 'submitted', NOW())
    `;
    
    await pool.execute(insertQuery, [evaluationId, userId, JSON.stringify(answers), calculatedScore]);

    const evaluation = evaluations[0];
    const evaluationTitle = evaluation.title || 'Évaluation';

    // Créer une notification pour l'évaluation soumise
    try {
      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          '📝 Évaluation soumise',
          `Vous avez soumis l'évaluation "${evaluationTitle}". Votre score sera disponible une fois corrigé par l'instructeur.`,
          'evaluation_submitted',
          '/dashboard/student/evaluations',
          JSON.stringify({ 
            evaluationId: evaluationId, 
            evaluationTitle: evaluationTitle,
            score: calculatedScore
          })
        ]
      );
    } catch (notificationError) {
      console.error('Erreur lors de la création de la notification d\'évaluation:', notificationError);
    }

    // Enregistrer l'activité de soumission d'évaluation
    try {
      const { recordActivity } = require('./gamificationController');
      await recordActivity(
        userId,
        'evaluation_submitted',
        15, // Points pour avoir soumis une évaluation
        `Évaluation "${evaluationTitle}" soumise`,
        { 
          evaluationId: evaluationId,
          evaluationTitle: evaluationTitle,
          score: calculatedScore
        }
      );
    } catch (activityError) {
      console.error('Erreur lors de l\'enregistrement de l\'activité d\'évaluation:', activityError);
    }

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

    // Statistiques pour les évaluations classiques
    const classicStatsQuery = `
      SELECT 
        COUNT(DISTINCT e.id) as total_evaluations,
        COUNT(DISTINCT ue.evaluation_id) as evaluations_attempted,
        COUNT(DISTINCT CASE WHEN ue.status = 'submitted' THEN ue.evaluation_id END) as evaluations_submitted,
        COUNT(DISTINCT CASE WHEN ue.status = 'graded' THEN ue.evaluation_id END) as evaluations_graded,
        AVG(CASE WHEN ue.status = 'graded' THEN ue.score END) as average_score,
        MAX(CASE WHEN ue.status = 'graded' THEN ue.score END) as highest_score,
        MIN(CASE WHEN ue.status = 'graded' THEN ue.score END) as lowest_score
      FROM evaluations e
      LEFT JOIN user_evaluations ue ON e.id = ue.evaluation_id AND ue.user_id = ?
      WHERE e.is_published = TRUE
    `;
    const [classicStats] = await pool.execute(classicStatsQuery, [userId]);

    // Statistiques pour les évaluations finales
    const finalStatsQuery = `
      SELECT 
        COUNT(DISTINCT ce.id) as total_evaluations,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN ce.id END) as evaluations_attempted,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN ce.id END) as evaluations_submitted,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN ce.id END) as evaluations_graded,
        AVG(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as average_score,
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as highest_score,
        MIN(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as lowest_score
      FROM course_evaluations ce
      INNER JOIN courses c ON ce.course_id = c.id
      INNER JOIN enrollments en ON c.id = en.course_id AND en.user_id = ? AND en.is_active = TRUE
      LEFT JOIN quiz_attempts qa ON ce.id = qa.course_evaluation_id AND qa.user_id = ? AND qa.completed_at IS NOT NULL
      WHERE ce.is_published = TRUE
    `;
    const [finalStats] = await pool.execute(finalStatsQuery, [userId, userId]);

    // Statistiques pour les quiz de modules
    const moduleQuizStatsQuery = `
      SELECT 
        COUNT(DISTINCT mq.id) as total_evaluations,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN mq.id END) as evaluations_attempted,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN mq.id END) as evaluations_submitted,
        COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN mq.id END) as evaluations_graded,
        AVG(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as average_score,
        MAX(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as highest_score,
        MIN(CASE WHEN qa.completed_at IS NOT NULL THEN qa.percentage END) as lowest_score
      FROM module_quizzes mq
      INNER JOIN modules m ON mq.module_id = m.id
      INNER JOIN courses c ON m.course_id = c.id
      INNER JOIN enrollments en ON c.id = en.course_id AND en.user_id = ? AND en.is_active = TRUE
      LEFT JOIN quiz_attempts qa ON mq.id = qa.module_quiz_id AND qa.user_id = ? AND qa.completed_at IS NOT NULL
      WHERE mq.is_published = TRUE
    `;
    const [moduleQuizStats] = await pool.execute(moduleQuizStatsQuery, [userId, userId]);

    // Combiner les statistiques (évaluations classiques + évaluations finales + quiz de modules)
    const totalEvaluations = (classicStats[0].total_evaluations || 0) + (finalStats[0].total_evaluations || 0) + (moduleQuizStats[0].total_evaluations || 0);
    const totalGraded = (classicStats[0].evaluations_graded || 0) + (finalStats[0].evaluations_graded || 0) + (moduleQuizStats[0].evaluations_graded || 0);
    
    // Calculer "En attente" : toutes les évaluations non complétées (not-started, in-progress, locked, etc.)
    const evaluationsPending = totalEvaluations - totalGraded;
    
    // Calculer la moyenne pondérée pour tous les types
    const classicAvg = classicStats[0].average_score || 0;
    const finalAvg = finalStats[0].average_score || 0;
    const moduleQuizAvg = moduleQuizStats[0].average_score || 0;
    const classicCount = classicStats[0].evaluations_graded || 0;
    const finalCount = finalStats[0].evaluations_graded || 0;
    const moduleQuizCount = moduleQuizStats[0].evaluations_graded || 0;
    const totalCount = classicCount + finalCount + moduleQuizCount;
    const averageScore = totalCount === 0 ? 0 : ((classicAvg * classicCount) + (finalAvg * finalCount) + (moduleQuizAvg * moduleQuizCount)) / totalCount;
    
    const stats = [{
      total_evaluations: totalEvaluations,
      evaluations_attempted: (classicStats[0].evaluations_attempted || 0) + (finalStats[0].evaluations_attempted || 0) + (moduleQuizStats[0].evaluations_attempted || 0),
      evaluations_submitted: (classicStats[0].evaluations_submitted || 0) + (finalStats[0].evaluations_submitted || 0) + (moduleQuizStats[0].evaluations_submitted || 0),
      evaluations_graded: totalGraded,
      evaluations_pending: evaluationsPending,
      average_score: averageScore,
      highest_score: Math.max(
        classicStats[0].highest_score || 0, 
        finalStats[0].highest_score || 0,
        moduleQuizStats[0].highest_score || 0
      ),
      lowest_score: (() => {
        const classicMin = classicStats[0].lowest_score;
        const finalMin = finalStats[0].lowest_score;
        const moduleQuizMin = moduleQuizStats[0].lowest_score;
        const allMins = [classicMin, finalMin, moduleQuizMin].filter(v => v !== null && v !== undefined);
        if (allMins.length === 0) return null;
        return Math.min(...allMins);
      })()
    }];

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
          evaluations_pending: stats[0].evaluations_pending || 0,
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

const listFinalEvaluations = async (req, res) => {
  try {
    const userRole = req.user?.role || 'student';
    const currentUserId = getUserIdentifier(req);
    const limit = parseLimit(req.query.limit, 20);
    const offset = parseOffset(req.query.offset);
    const search = (req.query.search || '').trim();
    const statusFilter = (req.query.status || '').trim().toLowerCase();
    const targetInstructorId = userRole === 'admin' && req.query.instructorId
      ? parseInt(req.query.instructorId, 10)
      : null;

    const validStatuses = ['draft', 'pending_approval', 'approved', 'rejected', 'published'];

    const whereClauses = [];
    const params = [];

    if (userRole !== 'admin' || !targetInstructorId) {
      if (!currentUserId) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
      whereClauses.push('c.instructor_id = ?');
      params.push(currentUserId);
    } else if (targetInstructorId) {
      whereClauses.push('c.instructor_id = ?');
      params.push(targetInstructorId);
    }

    if (statusFilter && validStatuses.includes(statusFilter)) {
      whereClauses.push(`COALESCE(c.status, CASE WHEN c.is_published = 1 THEN 'published' ELSE 'draft' END) = ?`);
      params.push(statusFilter);
    }

    if (search) {
      const likeSearch = `%${search}%`;
      whereClauses.push('(c.title LIKE ? OR ce.title LIKE ?)');
      params.push(likeSearch, likeSearch);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const listQuery = `
      SELECT
        ce.id,
        ce.course_id,
        ce.title AS evaluation_title,
        ce.description,
        ce.passing_score,
        ce.duration_minutes,
        ce.max_attempts,
        ce.is_published,
        ce.created_at,
        ce.updated_at,
        c.title AS course_title,
        c.slug AS course_slug,
        COALESCE(c.status, CASE WHEN c.is_published = 1 THEN 'published' ELSE 'draft' END) AS course_status,
        c.is_published AS course_is_published,
        c.language AS course_language,
        COUNT(DISTINCT qq.id) AS questions_count,
        COUNT(DISTINCT qa.id) AS attempts_count,
        COUNT(DISTINCT CASE WHEN qa.is_passed = 1 THEN qa.user_id END) AS passed_students
      FROM course_evaluations ce
      JOIN courses c ON c.id = ce.course_id
      LEFT JOIN quiz_questions qq ON qq.course_evaluation_id = ce.id
      LEFT JOIN quiz_attempts qa ON qa.course_evaluation_id = ce.id
      ${whereSql}
      GROUP BY ce.id
      ORDER BY ce.updated_at DESC
      LIMIT ?
      OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM course_evaluations ce
      JOIN courses c ON c.id = ce.course_id
      ${whereSql}
    `;

    const [rows] = await pool.execute(listQuery, [...params, limit, offset]);
    const [[{ total = 0 } = {}]] = await pool.execute(countQuery, params);

    const evaluations = rows.map((row) => ({
      id: row.id,
      course_id: row.course_id,
      evaluation_title: row.evaluation_title,
      description: row.description,
      passing_score: Number(row.passing_score || 0),
      duration_minutes: row.duration_minutes !== null ? Number(row.duration_minutes) : null,
      max_attempts: row.max_attempts !== null ? Number(row.max_attempts) : null,
      is_published: row.is_published === 1 || row.is_published === true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      course: {
        id: row.course_id,
        title: row.course_title,
        slug: row.course_slug,
        language: row.course_language,
        status: formatCourseStatus(row),
        detail_url: row.course_slug
          ? `/dashboard/instructor/courses/${row.course_slug}`
          : `/dashboard/instructor/courses/${row.course_id}`
      },
      statistics: {
        questions_count: Number(row.questions_count || 0),
        attempts_count: Number(row.attempts_count || 0),
        passed_students: Number(row.passed_students || 0)
      },
      links: {
        api: `/api/evaluations/${row.id}`,
        detail: `/dashboard/instructor/evaluations/${row.id}`,
        edit: `/dashboard/instructor/evaluations/${row.id}/edit`
      }
    }));

    res.json({
      success: true,
      data: {
        evaluations,
        pagination: {
          limit,
          offset,
          total: Number(total || 0),
          pages: limit === 0 ? 0 : Math.ceil(Number(total || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Erreur liste évaluations finales:', error);
    res.status(500).json({
      success: false,
      message: 'Impossible de récupérer les évaluations finales'
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

    // Vérifier l'inscription (active uniquement)
    const [enrollments] = await pool.execute(
      'SELECT course_id FROM enrollments WHERE id = ? AND user_id = ? AND is_active = TRUE',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée ou désactivée'
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
       WHERE qq.course_evaluation_id = ? AND qq.is_active = TRUE
       ORDER BY qq.order_index ASC`,
      [evaluation.id]
    );

    // Récupérer les réponses pour chaque question (sans révéler les bonnes réponses pour l'étudiant)
    const questionsWithOptions = await Promise.all(
      questions.map(async (question) => {
        const [answers] = await pool.execute(
          `SELECT 
            id,
            answer_text,
            order_index
           FROM quiz_answers
           WHERE question_id = ?
           ORDER BY order_index ASC`,
          [question.id]
        );

        // Pour les questions à choix multiples, retourner les options
        // Pour les questions vrai/faux, utiliser les réponses de la base de données
        // Pour les questions à réponse courte, ne pas retourner de réponses
        let options = [];
        if (question.question_type === 'multiple_choice') {
          options = answers.map(a => ({
            id: a.id,
            text: a.answer_text
          }));
        } else if (question.question_type === 'true_false') {
          // Utiliser les réponses stockées dans la base (Vrai/Faux avec leurs IDs)
          options = answers.map(a => ({
            id: a.id,
            text: a.answer_text
          }));
        }

        return {
          id: question.id.toString(),
          question_text: question.question_text,
          question_type: question.question_type,
          points: Number(question.points) || 0,
          order_index: Number(question.order_index) || 0,
          options: options
        };
      })
    );

    // Récupérer les tentatives précédentes
    const [attempts] = await pool.execute(
      `SELECT * FROM quiz_attempts 
       WHERE enrollment_id = ? AND course_evaluation_id = ? 
       ORDER BY started_at DESC`,
      [enrollmentId, evaluation.id]
    );

    console.log(`[EvaluationController] 📊 Tentatives récupérées pour enrollment ${enrollmentId}, evaluation ${evaluation.id}:`, {
      attemptsCount: attempts.length,
      attempts: attempts.map(a => ({
        id: a.id,
        completed_at: a.completed_at,
        percentage: a.percentage,
        is_passed: a.is_passed,
        started_at: a.started_at
      }))
    });

    res.json({
      success: true,
      data: {
        evaluation: {
          ...evaluation,
          questions: questionsWithOptions
        },
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

    // Vérifier l'inscription (active uniquement)
    const [enrollments] = await pool.execute(
      'SELECT course_id FROM enrollments WHERE id = ? AND user_id = ? AND is_active = TRUE',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée ou désactivée'
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
    const evaluationTitle = evaluation.title || 'Évaluation finale';

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

    // Recalculer la progression du cours après la complétion de l'évaluation finale
    try {
      const ProgressService = require('../services/progressService');
      await ProgressService.updateCourseProgress(enrollmentId);
      console.log(`✅ [Evaluation] Progression recalculée pour l'enrollment ${enrollmentId} après soumission de l'évaluation finale (submitEvaluationAttempt)`);
    } catch (progressError) {
      console.error('❌ [Evaluation] Erreur lors du recalcul de la progression:', progressError);
      // Ne pas bloquer la réponse si le recalcul échoue
    }

    // Créer une notification pour l'évaluation finale soumise
    try {
      const notificationTitle = isPassed 
        ? `✅ Évaluation finale réussie : ${evaluationTitle}`
        : `❌ Évaluation finale échouée : ${evaluationTitle}`;
      const notificationMessage = isPassed
        ? `Félicitations ! Vous avez réussi l'évaluation finale "${evaluationTitle}" avec un score de ${Math.round(percentage)}%. Vous êtes éligible pour le certificat.`
        : `Vous avez obtenu ${Math.round(percentage)}% à l'évaluation finale "${evaluationTitle}". Le score minimum requis est ${evaluation.passing_score}%.`;

      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          notificationTitle,
          notificationMessage,
          isPassed ? 'evaluation_passed' : 'evaluation_failed',
          `/learn/${courseId}`,
          JSON.stringify({ 
            evaluationId: evaluation.id, 
            evaluationTitle: evaluationTitle,
            score: percentage,
            isPassed: isPassed,
            courseId: courseId
          })
        ]
      );
    } catch (notificationError) {
      console.error('Erreur lors de la création de la notification d\'évaluation finale:', notificationError);
    }

    // Enregistrer l'activité de l'évaluation finale
    try {
      const { recordActivity } = require('./gamificationController');
      const pointsEarned = isPassed ? Math.round(percentage / 5) : 0; // Points basés sur le pourcentage
      await recordActivity(
        userId,
        isPassed ? 'evaluation_passed' : 'evaluation_failed',
        pointsEarned,
        `Évaluation finale "${evaluationTitle}" : ${Math.round(percentage)}%`,
        { 
          evaluationId: evaluation.id,
          evaluationTitle: evaluationTitle,
          score: percentage,
          isPassed: isPassed,
          courseId: courseId
        }
      );
    } catch (activityError) {
      console.error('Erreur lors de l\'enregistrement de l\'activité d\'évaluation finale:', activityError);
    }

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
  checkEvaluationAttempt,
  startEvaluationAttempt,
  getEvaluationAttempts,
  submitEvaluation,
  getUserEvaluationStats,
  createEvaluation,
  listFinalEvaluations,
  getCourseEvaluations,
  updateEvaluation,
  deleteEvaluation,
  getEvaluationSubmissions,
  gradeSubmission,
  getEnrollmentEvaluation,
  submitEvaluationAttempt
};
