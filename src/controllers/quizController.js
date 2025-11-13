const { pool } = require('../config/database');
const { eventEmitter, EVENTS } = require('../middleware/eventEmitter');

// Récupérer les quiz d'un cours
const getCourseQuizzes = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Vérifier que l'utilisateur est inscrit au cours
    const enrollmentQuery = `
      SELECT id FROM enrollments 
      WHERE user_id = ? AND course_id = ? AND is_active = TRUE
    `;
    const [enrollments] = await pool.execute(enrollmentQuery, [userId, courseId]);

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours'
      });
    }

    const query = `
      SELECT 
        q.*,
        COUNT(qq.id) as question_count,
        qa.score as best_score,
        qa.is_passed as is_passed,
        qa.completed_at as last_attempt_date
      FROM quizzes q
      LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id AND qq.is_active = TRUE
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.user_id = ?
      WHERE q.course_id = ? AND q.is_published = TRUE
      GROUP BY q.id
      ORDER BY q.is_final DESC, q.created_at ASC
    `;

    const [quizzes] = await pool.execute(query, [userId, courseId]);

    res.json({
      success: true,
      data: quizzes
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des quiz'
    });
  }
};

// Récupérer un quiz par ID avec ses questions
const getQuizById = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;

    // Récupérer le quiz
    const quizQuery = `
      SELECT q.*, c.title as course_title
      FROM quizzes q
      JOIN courses c ON q.course_id = c.id
      WHERE q.id = ? AND q.is_published = TRUE
    `;
    const [quizzes] = await pool.execute(quizQuery, [quizId]);

    if (quizzes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé'
      });
    }

    // Vérifier que l'utilisateur est inscrit au cours
    const enrollmentQuery = `
      SELECT id FROM enrollments 
      WHERE user_id = ? AND course_id = ? AND is_active = TRUE
    `;
    const [enrollments] = await pool.execute(enrollmentQuery, [userId, quizzes[0].course_id]);

    if (enrollments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours'
      });
    }

    // Récupérer les questions et réponses
    const questionsQuery = `
      SELECT 
        qq.*,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', qa.id,
            'answer_text', qa.answer_text,
            'is_correct', qa.is_correct,
            'order_index', qa.order_index
          )
        ) as answers
      FROM quiz_questions qq
      LEFT JOIN quiz_answers qa ON qq.id = qa.question_id
      WHERE qq.quiz_id = ? AND qq.is_active = TRUE
      GROUP BY qq.id
      ORDER BY qq.order_index ASC
    `;
    const [questions] = await pool.execute(questionsQuery, [quizId]);

    // Récupérer les tentatives précédentes
    const attemptsQuery = `
      SELECT * FROM quiz_attempts 
      WHERE user_id = ? AND quiz_id = ? 
      ORDER BY started_at DESC
    `;
    const [attempts] = await pool.execute(attemptsQuery, [userId, quizId]);

    res.json({
      success: true,
      data: {
        quiz: quizzes[0],
        questions,
        previous_attempts: attempts
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du quiz'
    });
  }
};

// Commencer une tentative de quiz
const startQuizAttempt = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user.id;

    // Récupérer les informations du quiz
    const quizQuery = `
      SELECT q.*, c.title as course_title
      FROM quizzes q
      JOIN courses c ON q.course_id = c.id
      WHERE q.id = ? AND q.is_published = TRUE
    `;
    const [quizzes] = await pool.execute(quizQuery, [quizId]);

    if (quizzes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé'
      });
    }

    const quiz = quizzes[0];

    // Vérifier que l'utilisateur est inscrit au cours
    const enrollmentQuery = `
      SELECT id FROM enrollments 
      WHERE user_id = ? AND course_id = ? AND is_active = TRUE
    `;
    const [enrollments] = await pool.execute(enrollmentQuery, [userId, quiz.course_id]);

    if (enrollments.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours'
      });
    }

    // Vérifier le nombre maximum de tentatives
    if (quiz.max_attempts) {
      const attemptsQuery = `
        SELECT COUNT(*) as attempt_count 
        FROM quiz_attempts 
        WHERE user_id = ? AND quiz_id = ?
      `;
      const [attemptsResult] = await pool.execute(attemptsQuery, [userId, quizId]);
      
      if (attemptsResult[0].attempt_count >= quiz.max_attempts) {
        return res.status(400).json({
          success: false,
          message: 'Nombre maximum de tentatives atteint'
        });
      }
    }

    // Créer une nouvelle tentative
    const attemptQuery = `
      INSERT INTO quiz_attempts (user_id, quiz_id, course_id, started_at)
      VALUES (?, ?, ?, NOW())
    `;
    const [result] = await pool.execute(attemptQuery, [userId, quizId, quiz.course_id]);

    res.status(201).json({
      success: true,
      message: 'Tentative de quiz démarrée',
      data: {
        attempt_id: result.insertId,
        quiz: quiz,
        started_at: new Date()
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

// Soumettre une tentative de quiz
const submitQuizAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers } = req.body; // Array of {question_id, answer_id, answer_text}
    const userId = req.user.id;

    // Vérifier que la tentative appartient à l'utilisateur
    const attemptQuery = `
      SELECT qa.*, q.passing_score, q.time_limit_minutes
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ? AND qa.user_id = ? AND qa.completed_at IS NULL
    `;
    const [attempts] = await pool.execute(attemptQuery, [attemptId, userId]);

    if (attempts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tentative non trouvée ou déjà terminée'
      });
    }

    const attempt = attempts[0];

    // Vérifier la limite de temps
    if (attempt.time_limit_minutes) {
      const startTime = new Date(attempt.started_at);
      const currentTime = new Date();
      const elapsedMinutes = (currentTime - startTime) / (1000 * 60);
      
      if (elapsedMinutes > attempt.time_limit_minutes) {
        return res.status(400).json({
          success: false,
          message: 'Temps limite dépassé'
        });
      }
    }

    let totalPoints = 0;
    let earnedPoints = 0;
    let correctAnswers = 0;
    let totalQuestions = 0;

    // Traiter chaque réponse
    for (const answer of answers) {
      const { question_id, answer_id, answer_text } = answer;

      // Récupérer la question et ses réponses correctes
      const questionQuery = `
        SELECT qq.points, qa.is_correct, qa.answer_text as correct_answer
        FROM quiz_questions qq
        LEFT JOIN quiz_answers qa ON qq.id = qa.question_id
        WHERE qq.id = ?
      `;
      const [questions] = await pool.execute(questionQuery, [question_id]);

      if (questions.length > 0) {
        const question = questions[0];
        totalPoints += question.points;
        totalQuestions++;

        let isCorrect = false;
        let pointsEarned = 0;

        if (answer_id) {
          // Réponse à choix multiple
          const correctAnswerQuery = `
            SELECT is_correct FROM quiz_answers 
            WHERE id = ? AND question_id = ?
          `;
          const [correctAnswers] = await pool.execute(correctAnswerQuery, [answer_id, question_id]);
          
          if (correctAnswers.length > 0 && correctAnswers[0].is_correct) {
            isCorrect = true;
            pointsEarned = question.points;
            correctAnswers++;
          }
        } else if (answer_text) {
          // Réponse texte (comparaison simple)
          const correctAnswerQuery = `
            SELECT answer_text FROM quiz_answers 
            WHERE question_id = ? AND is_correct = TRUE
          `;
          const [correctAnswers] = await pool.execute(correctAnswerQuery, [question_id]);
          
          if (correctAnswers.length > 0) {
            const correctText = correctAnswers[0].answer_text.toLowerCase().trim();
            const userText = answer_text.toLowerCase().trim();
            
            if (correctText === userText) {
              isCorrect = true;
              pointsEarned = question.points;
              correctAnswers++;
            }
          }
        }

        earnedPoints += pointsEarned;

        // Enregistrer la réponse de l'utilisateur
        const userAnswerQuery = `
          INSERT INTO user_quiz_answers (
            attempt_id, question_id, answer_id, answer_text, 
            is_correct, points_earned
          ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        await pool.execute(userAnswerQuery, [
          attemptId, question_id, answer_id, answer_text, 
          isCorrect, pointsEarned
        ]);
      }
    }

    // Calculer le score et le pourcentage
    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const isPassed = percentage >= attempt.passing_score;

    // Préparer le JSON des réponses (pour compatibilité avec architecture)
    const answersJson = {};
    answers.forEach(answer => {
      answersJson[answer.question_id] = answer.answer_id || answer.answer_text || '';
    });

    // Mettre à jour la tentative avec JSON answers
    const timeSpent = Math.round((new Date() - new Date(attempt.started_at)) / (1000 * 60));
    
    const updateAttemptQuery = `
      UPDATE quiz_attempts 
      SET completed_at = NOW(), answers = ?, score = ?, total_points = ?, 
          percentage = ?, is_passed = ?, time_spent_minutes = ?
      WHERE id = ?
    `;
    await pool.execute(updateAttemptQuery, [
      JSON.stringify(answersJson),
      earnedPoints, 
      totalPoints, 
      percentage, 
      isPassed, 
      timeSpent, 
      attemptId
    ]);

    // Récupérer les informations du quiz pour les notifications
    const quizQuery = 'SELECT id, title, is_final, course_id FROM quizzes WHERE id = ?';
    const [quizzes] = await pool.execute(quizQuery, [attempt.quiz_id]);
    const quiz = quizzes.length > 0 ? quizzes[0] : null;
    const quizTitle = quiz?.title || 'Quiz';

    // Si le quiz est final et réussi, vérifier si on peut générer le certificat
    if (quiz && quiz.is_final && isPassed) {
      const { generateCertificateForCourseInternal } = require('./certificateController');
      try {
        await generateCertificateForCourseInternal(userId, quiz.course_id);
      } catch (certError) {
        console.warn('Erreur lors de la génération automatique du certificat:', certError.message);
        // Ne pas faire échouer la soumission du quiz si le certificat ne peut pas être généré
      }
    }

    // Créer une notification pour le quiz soumis
    try {
      const notificationTitle = isPassed 
        ? `✅ Quiz réussi : ${quizTitle}`
        : `❌ Quiz échoué : ${quizTitle}`;
      const notificationMessage = isPassed
        ? `Félicitations ! Vous avez réussi le quiz "${quizTitle}" avec un score de ${Math.round(percentage)}% (${correctAnswers}/${totalQuestions} bonnes réponses).`
        : `Vous avez obtenu ${Math.round(percentage)}% au quiz "${quizTitle}" (${correctAnswers}/${totalQuestions} bonnes réponses). Le score minimum requis est ${attempt.passing_score}%.`;

      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          notificationTitle,
          notificationMessage,
          isPassed ? 'quiz_passed' : 'quiz_failed',
          quiz?.course_id ? `/learn/${quiz.course_id}` : '/dashboard/student',
          JSON.stringify({ 
            quizId: attempt.quiz_id, 
            quizTitle: quizTitle,
            score: percentage,
            isPassed: isPassed,
            correctAnswers: correctAnswers,
            totalQuestions: totalQuestions
          })
        ]
      );
    } catch (notificationError) {
      console.error('Erreur lors de la création de la notification de quiz:', notificationError);
    }

    // Enregistrer l'activité du quiz
    try {
      const { recordActivity } = require('./gamificationController');
      const pointsEarned = isPassed ? Math.round(percentage / 10) : 0; // Points basés sur le pourcentage
      await recordActivity(
        userId,
        isPassed ? 'quiz_passed' : 'quiz_failed',
        pointsEarned,
        `Quiz "${quizTitle}" : ${Math.round(percentage)}% (${correctAnswers}/${totalQuestions} bonnes réponses)`,
        { 
          quizId: attempt.quiz_id,
          quizTitle: quizTitle,
          score: percentage,
          isPassed: isPassed,
          correctAnswers: correctAnswers,
          totalQuestions: totalQuestions
        }
      );
    } catch (activityError) {
      console.error('Erreur lors de l\'enregistrement de l\'activité de quiz:', activityError);
    }

    res.json({
      success: true,
      message: 'Quiz soumis avec succès',
      data: {
        score: earnedPoints,
        total_points: totalPoints,
        percentage: percentage,
        is_passed: isPassed,
        correct_answers: correctAnswers,
        total_questions: totalQuestions,
        time_spent_minutes: timeSpent
      }
    });

    // Émettre l'événement en arrière-plan
    try {
      if (isPassed) {
        const isPerfect = Math.round(percentage) === 100;
        eventEmitter.emit(EVENTS.QUIZ_PASSED, { userId, quizId: attempt.quiz_id, score: percentage, isPerfect });
      } else {
        eventEmitter.emit(EVENTS.QUIZ_FAILED, { userId, quizId: attempt.quiz_id, score: percentage });
      }
    } catch (e) {
      // ignorer
    }

  } catch (error) {
    console.error('Erreur lors de la soumission du quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la soumission du quiz'
    });
  }
};

// Récupérer une tentative de quiz
const getQuizAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    const query = `
      SELECT 
        qa.*,
        q.title as quiz_title,
        c.title as course_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN courses c ON qa.course_id = c.id
      WHERE qa.id = ? AND qa.user_id = ?
    `;
    const [attempts] = await pool.execute(query, [attemptId, userId]);

    if (attempts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tentative non trouvée'
      });
    }

    // Récupérer les réponses détaillées
    const answersQuery = `
      SELECT 
        uqa.*,
        qq.question_text,
        qq.question_type,
        qa.answer_text as selected_answer_text
      FROM user_quiz_answers uqa
      JOIN quiz_questions qq ON uqa.question_id = qq.id
      LEFT JOIN quiz_answers qa ON uqa.answer_id = qa.id
      WHERE uqa.attempt_id = ?
      ORDER BY qq.order_index ASC
    `;
    const [answers] = await pool.execute(answersQuery, [attemptId]);

    res.json({
      success: true,
      data: {
        attempt: attempts[0],
        answers
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la tentative:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la tentative'
    });
  }
};

// Récupérer mes tentatives de quiz
const getMyQuizAttempts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { quizId, courseId } = req.query;

    let whereClause = 'WHERE qa.user_id = ?';
    let params = [userId];

    if (quizId) {
      whereClause += ' AND qa.quiz_id = ?';
      params.push(quizId);
    }

    if (courseId) {
      whereClause += ' AND qa.course_id = ?';
      params.push(courseId);
    }

    const query = `
      SELECT 
        qa.*,
        q.title as quiz_title,
        c.title as course_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN courses c ON qa.course_id = c.id
      ${whereClause}
      ORDER BY qa.started_at DESC
    `;

    const [attempts] = await pool.execute(query, params);

    res.json({
      success: true,
      data: attempts
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des tentatives:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tentatives'
    });
  }
};

module.exports = {
  getCourseQuizzes,
  getQuizById,
  startQuizAttempt,
  submitQuizAttempt,
  getQuizAttempt,
  getMyQuizAttempts
};
