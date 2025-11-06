const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const { eventEmitter, EVENTS } = require('../middleware/eventEmitter');

/**
 * Créer un quiz pour un module
 */
const createModuleQuiz = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const {
      title,
      description,
      passing_score = 70,
      badge_id,
      time_limit_minutes,
      duration_minutes, // Alias accepté depuis le frontend
      max_attempts = 3,
      questions
    } = req.body;
    
    // Utiliser duration_minutes si time_limit_minutes n'est pas fourni
    const timeLimit = time_limit_minutes || duration_minutes;

    const instructorId = req.user.userId;

    // Vérifier que le module appartient à l'instructeur
    const [modules] = await pool.execute(
      'SELECT m.* FROM modules m JOIN courses c ON m.course_id = c.id WHERE m.id = ? AND c.instructor_id = ?',
      [moduleId, instructorId]
    );

    if (modules.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à créer un quiz pour ce module'
      });
    }

    // Vérifier qu'un quiz n'existe pas déjà
    const [existing] = await pool.execute(
      'SELECT id FROM module_quizzes WHERE module_id = ?',
      [moduleId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un quiz existe déjà pour ce module. Utilisez PUT pour le modifier.'
      });
    }

    // Créer le quiz
    const [quizResult] = await pool.execute(
      `INSERT INTO module_quizzes (
        module_id, title, description, passing_score, badge_id,
        time_limit_minutes, max_attempts, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [
        moduleId,
        sanitizeValue(title),
        sanitizeValue(description),
        passing_score,
        sanitizeValue(badge_id),
        sanitizeValue(timeLimit),
        max_attempts
      ]
    );

    const quizId = quizResult.insertId;

    // Créer les questions si fournies
    if (questions && Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        // Pour les quiz de modules, on utilise module_quiz_id (quiz_id peut être NULL)
        const [questionResult] = await pool.execute(
          `INSERT INTO quiz_questions (
            quiz_id, module_quiz_id, question_text, question_type, points, order_index, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
          [
            null, // NULL pour les quiz de modules (quiz_id est maintenant nullable)
            quizId, // Lien vers le quiz de module via module_quiz_id
            sanitizeValue(question.question_text),
            sanitizeValue(question.question_type || 'multiple_choice'),
            sanitizeValue(question.points || 1),
            i
          ]
        );

        const questionId = questionResult.insertId;

        // Gérer les réponses selon le type de question
        if (question.question_type === 'multiple_choice' && question.answers && Array.isArray(question.answers)) {
          // QCM : créer plusieurs réponses
          for (let j = 0; j < question.answers.length; j++) {
            const answer = question.answers[j];
            await pool.execute(
              `INSERT INTO quiz_answers (
                question_id, answer_text, is_correct, order_index
              ) VALUES (?, ?, ?, ?)`,
              [
                questionId,
                sanitizeValue(answer.answer_text),
                answer.is_correct || false,
                j
              ]
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
      message: 'Quiz de module créé avec succès',
      data: {
        id: quizId,
        module_id: moduleId
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du quiz:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du quiz'
    });
  }
};

/**
 * Récupérer le quiz d'un module (instructeur ou admin)
 */
const getModuleQuiz = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // Vérifier les permissions : instructeur du cours ou admin
    let modules;
    if (userRole === 'admin') {
      // Admin peut accéder à tous les quiz
      [modules] = await pool.execute(
        'SELECT m.* FROM modules m WHERE m.id = ?',
        [moduleId]
      );
    } else {
      // Instructeur : vérifier qu'il est propriétaire du cours
      [modules] = await pool.execute(
        'SELECT m.* FROM modules m JOIN courses c ON m.course_id = c.id WHERE m.id = ? AND c.instructor_id = ?',
        [moduleId, userId]
      );
    }

    if (modules.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé'
      });
    }

    // Récupérer le quiz
    const [quizzes] = await pool.execute(
      'SELECT * FROM module_quizzes WHERE module_id = ?',
      [moduleId]
    );

    if (quizzes.length === 0) {
      // Retourner 200 avec data: null au lieu de 404 pour permettre au frontend de gérer l'absence de quiz
      return res.json({
        success: true,
        data: null,
        message: 'Aucun quiz créé pour ce module'
      });
    }

    const quiz = quizzes[0];

    // Récupérer les questions liées au quiz de module
    const [questions] = await pool.execute(
      `SELECT 
        qq.id,
        qq.question_text,
        qq.question_type,
        qq.points,
        qq.order_index,
        qq.is_active
       FROM quiz_questions qq
       WHERE qq.module_quiz_id = ?
       ORDER BY qq.order_index ASC`,
      [quiz.id]
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

        return {
          ...question,
          answers: answers
        };
      })
    );

    res.json({
      success: true,
      data: {
        ...quiz,
        questions: questionsWithAnswers
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
 * Récupérer le quiz d'un module pour un étudiant
 */
const getModuleQuizForStudent = async (req, res) => {
  try {
    const { enrollmentId, moduleId } = req.params;
    const userId = req.user.userId;

    // Vérifier l'inscription
    const [enrollments] = await pool.execute(
      'SELECT * FROM enrollments WHERE id = ? AND user_id = ?',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    // Récupérer le quiz
    const [quizzes] = await pool.execute(
      'SELECT * FROM module_quizzes WHERE module_id = ? AND is_published = TRUE',
      [moduleId]
    );

    if (quizzes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé'
      });
    }

    const quiz = quizzes[0];

    // Récupérer les tentatives précédentes
    const [attempts] = await pool.execute(
      `SELECT * FROM quiz_attempts 
       WHERE enrollment_id = ? AND module_quiz_id = ? 
       ORDER BY started_at DESC`,
      [enrollmentId, quiz.id]
    );

    res.json({
      success: true,
      data: {
        quiz,
        previous_attempts: attempts,
        can_attempt: attempts.length < quiz.max_attempts
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
 * Soumettre une tentative de quiz de module
 */
const submitModuleQuizAttempt = async (req, res) => {
  try {
    const { enrollmentId, moduleId } = req.params;
    const { answers } = req.body;
    const userId = req.user.userId;

    // Vérifier l'inscription
    const [enrollments] = await pool.execute(
      'SELECT * FROM enrollments WHERE id = ? AND user_id = ?',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    // Récupérer le quiz
    const [quizzes] = await pool.execute(
      'SELECT * FROM module_quizzes WHERE module_id = ? AND is_published = TRUE',
      [moduleId]
    );

    if (quizzes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé'
      });
    }

    const quiz = quizzes[0];

    // Vérifier les tentatives
    const [attemptsResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM quiz_attempts WHERE enrollment_id = ? AND module_quiz_id = ?',
      [enrollmentId, quiz.id]
    );

    if (attemptsResult[0].count >= quiz.max_attempts) {
      return res.status(400).json({
        success: false,
        message: 'Nombre maximum de tentatives atteint'
      });
    }

    // Créer la tentative (utiliser module_quiz_id pour les quiz de modules)
    const [attemptResult] = await pool.execute(
      `INSERT INTO quiz_attempts (
        user_id, quiz_id, course_id, module_quiz_id, enrollment_id, started_at
      ) VALUES (?, NULL, ?, ?, ?, NOW())`,
      [userId, enrollments[0].course_id, quiz.id, enrollmentId]
    );

    const attemptId = attemptResult.insertId;

    // Calculer le score (similaire à quizController)
    // Pour simplifier, on réutilise la logique existante
    // TODO: Adapter selon votre structure de questions

    let totalPoints = 0;
    let earnedPoints = 0;
    let correctAnswers = 0;

    // Traiter les réponses
    for (const answer of answers) {
      const { question_id, answer_id, answer_text } = answer;

      // Récupérer la question (vérifier qu'elle appartient au quiz de module)
      const [questions] = await pool.execute(
        'SELECT points FROM quiz_questions WHERE id = ? AND module_quiz_id = ?',
        [question_id, quiz.id]
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
            correctAnswers++;
          }
        }
      }
    }

    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const isPassed = percentage >= quiz.passing_score;

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

    // Si réussi et badge associé, attribuer le badge
    if (isPassed && quiz.badge_id) {
      try {
        // Vérifier si le badge n'est pas déjà attribué
        const [existingBadges] = await pool.execute(
          'SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?',
          [userId, quiz.badge_id]
        );

        if (existingBadges.length === 0) {
          await pool.execute(
            'INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, NOW())',
            [userId, quiz.badge_id]
          );

          eventEmitter.emit(EVENTS.BADGE_EARNED, {
            userId,
            badgeId: quiz.badge_id
          });
        }
      } catch (badgeError) {
        console.warn('Erreur lors de l\'attribution du badge:', badgeError);
      }
    }

    res.json({
      success: true,
      message: 'Quiz soumis avec succès',
      data: {
        attempt_id: attemptId,
        score: earnedPoints,
        total_points: totalPoints,
        percentage: percentage,
        is_passed: isPassed,
        correct_answers: correctAnswers,
        badge_earned: isPassed && quiz.badge_id ? true : false
      }
    });

  } catch (error) {
    console.error('Erreur lors de la soumission:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la soumission'
    });
  }
};

/**
 * Mettre à jour un quiz de module
 */
const updateModuleQuiz = async (req, res) => {
  try {
    // Support des deux formats : /modules/:moduleId/quiz/:quizId ou /quizzes/:quizId avec module_id dans body
    const { moduleId, quizId } = req.params;
    const {
      module_id, // Support pour le format /quizzes/:quizId
      title,
      description,
      passing_score,
      badge_id,
      time_limit_minutes,
      duration_minutes, // Alias accepté depuis le frontend
      max_attempts,
      is_published,
      questions // Support pour mettre à jour les questions
    } = req.body;
    
    // Utiliser duration_minutes si time_limit_minutes n'est pas fourni
    const timeLimit = time_limit_minutes !== undefined ? time_limit_minutes : duration_minutes;
    
    // Déterminer le moduleId et quizId
    const finalModuleId = moduleId || module_id;
    let finalQuizId = quizId || req.params.id; // Support pour /quizzes/:id

    const instructorId = req.user.userId;

    // Si on n'a pas le quizId mais qu'on a le moduleId, récupérer le quiz depuis le module
    if (!finalQuizId && finalModuleId) {
      const [quizzes] = await pool.execute(
        'SELECT id FROM module_quizzes WHERE module_id = ?',
        [finalModuleId]
      );
      if (quizzes.length > 0) {
        finalQuizId = quizzes[0].id;
      } else {
        return res.status(404).json({
          success: false,
          message: 'Aucun quiz trouvé pour ce module'
        });
      }
    }

    // Si on n'a pas le moduleId, le récupérer depuis le quiz
    let actualModuleId = finalModuleId;
    if (!actualModuleId && finalQuizId) {
      const [quizzes] = await pool.execute(
        'SELECT module_id FROM module_quizzes WHERE id = ?',
        [finalQuizId]
      );
      if (quizzes.length > 0) {
        actualModuleId = quizzes[0].module_id;
      }
    }

    if (!actualModuleId) {
      return res.status(400).json({
        success: false,
        message: 'module_id est requis'
      });
    }

    // Vérifier les permissions
    const [modules] = await pool.execute(
      'SELECT m.* FROM modules m JOIN courses c ON m.course_id = c.id WHERE m.id = ? AND c.instructor_id = ?',
      [actualModuleId, instructorId]
    );

    if (modules.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé'
      });
    }

    // Vérifier que le quiz existe et appartient au module
    if (finalQuizId) {
      const [quizzes] = await pool.execute(
        'SELECT id FROM module_quizzes WHERE id = ? AND module_id = ?',
        [finalQuizId, actualModuleId]
      );
      if (quizzes.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Quiz non trouvé'
        });
      }
    }

    // Mettre à jour le quiz
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
      values.push(passing_score);
    }
    if (badge_id !== undefined) {
      updateFields.push('badge_id = ?');
      values.push(sanitizeValue(badge_id));
    }
    if (timeLimit !== undefined) {
      updateFields.push('time_limit_minutes = ?');
      values.push(sanitizeValue(timeLimit));
    }
    if (max_attempts !== undefined) {
      updateFields.push('max_attempts = ?');
      values.push(max_attempts);
    }
    if (is_published !== undefined) {
      updateFields.push('is_published = ?');
      values.push(is_published);
    }

    if (updateFields.length > 0 && finalQuizId) {
      values.push(finalQuizId);
      await pool.execute(
        `UPDATE module_quizzes SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Mettre à jour les questions si fournies
    if (questions && Array.isArray(questions) && finalQuizId) {
      // Supprimer les anciennes questions
      await pool.execute(
        'DELETE FROM quiz_answers WHERE question_id IN (SELECT id FROM quiz_questions WHERE module_quiz_id = ?)',
        [finalQuizId]
      );
      await pool.execute(
        'DELETE FROM quiz_questions WHERE module_quiz_id = ?',
        [finalQuizId]
      );

      // Créer les nouvelles questions (même logique que createModuleQuiz)
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        
        const [questionResult] = await pool.execute(
          `INSERT INTO quiz_questions (
            quiz_id, module_quiz_id, question_text, question_type, points, order_index, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
          [
            null,
            finalQuizId,
            sanitizeValue(question.question_text),
            sanitizeValue(question.question_type || 'multiple_choice'),
            sanitizeValue(question.points || 1),
            question.order_index !== undefined ? question.order_index : i
          ]
        );

        const questionId = questionResult.insertId;

        // Gérer les réponses selon le type de question
        if (question.question_type === 'multiple_choice' && question.answers && Array.isArray(question.answers)) {
          for (let j = 0; j < question.answers.length; j++) {
            const answer = question.answers[j];
            await pool.execute(
              `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
              [questionId, sanitizeValue(answer.answer_text), answer.is_correct || false, j]
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
      message: 'Quiz mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour'
    });
  }
};

/**
 * Supprimer un quiz de module
 */
const deleteModuleQuiz = async (req, res) => {
  try {
    const { moduleId, quizId } = req.params;
    const instructorId = req.user.userId;

    // Si quizId n'est pas fourni, le récupérer depuis moduleId
    let finalQuizId = quizId;
    if (!finalQuizId && moduleId) {
      const [quizzes] = await pool.execute(
        'SELECT id FROM module_quizzes WHERE module_id = ?',
        [moduleId]
      );
      if (quizzes.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Aucun quiz trouvé pour ce module'
        });
      }
      finalQuizId = quizzes[0].id;
    }

    if (!moduleId || !finalQuizId) {
      return res.status(400).json({
        success: false,
        message: 'moduleId et quizId sont requis'
      });
    }

    // Vérifier les permissions
    const [modules] = await pool.execute(
      'SELECT m.* FROM modules m JOIN courses c ON m.course_id = c.id WHERE m.id = ? AND c.instructor_id = ?',
      [moduleId, instructorId]
    );

    if (modules.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé'
      });
    }

    // Vérifier que le quiz appartient au module
    const [quizzes] = await pool.execute(
      'SELECT id FROM module_quizzes WHERE id = ? AND module_id = ?',
      [finalQuizId, moduleId]
    );

    if (quizzes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé pour ce module'
      });
    }

    // Supprimer les réponses des questions
    await pool.execute(
      'DELETE FROM quiz_answers WHERE question_id IN (SELECT id FROM quiz_questions WHERE module_quiz_id = ?)',
      [finalQuizId]
    );

    // Supprimer les questions
    await pool.execute(
      'DELETE FROM quiz_questions WHERE module_quiz_id = ?',
      [finalQuizId]
    );

    // Supprimer le quiz
    await pool.execute(
      'DELETE FROM module_quizzes WHERE id = ? AND module_id = ?',
      [finalQuizId, moduleId]
    );

    res.json({
      success: true,
      message: 'Quiz supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression'
    });
  }
};

module.exports = {
  createModuleQuiz,
  getModuleQuiz,
  updateModuleQuiz,
  deleteModuleQuiz,
  getModuleQuizForStudent,
  submitModuleQuizAttempt
};

