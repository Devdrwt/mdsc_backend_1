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
      // Normaliser les questions : convertir différents formats en format standard
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const questionType = question.question_type || 'multiple_choice';
        
        // Pour les QCM : convertir options + correct_answer en format answers
        if (questionType === 'multiple_choice' && question.options && Array.isArray(question.options) && !question.answers) {
          question.answers = question.options.map(option => ({
            answer_text: option,
            is_correct: option === question.correct_answer || option.trim() === (question.correct_answer || '').trim()
          }));
        }
        
        // Pour les questions Vrai/Faux : normaliser correct_answer
        if (questionType === 'true_false' && question.correct_answer !== undefined) {
          // Accepter différents formats : true/false, "true"/"false", "Vrai"/"Faux", 1/0
          if (typeof question.correct_answer === 'string') {
            const answerLower = question.correct_answer.toLowerCase().trim();
            if (answerLower === 'vrai' || answerLower === 'true' || answerLower === '1') {
              question.correct_answer = true;
            } else if (answerLower === 'faux' || answerLower === 'false' || answerLower === '0') {
              question.correct_answer = false;
            }
          } else if (question.correct_answer === 1 || question.correct_answer === '1') {
            question.correct_answer = true;
          } else if (question.correct_answer === 0 || question.correct_answer === '0') {
            question.correct_answer = false;
          }
        }
        
        // Pour les questions à réponse courte : s'assurer que correct_answer est une chaîne
        if (questionType === 'short_answer' && question.correct_answer !== undefined) {
          if (typeof question.correct_answer !== 'string') {
            question.correct_answer = String(question.correct_answer);
          }
        }
      }
      
      // Valider les questions avant de les créer
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const questionType = question.question_type || 'multiple_choice';
        
        // Validation : s'assurer que les questions ont les données nécessaires
        if (!question.question_text || question.question_text.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: `La question ${i + 1} doit avoir un texte`
          });
        }
        
        // Validation pour les questions à choix multiples
        if (questionType === 'multiple_choice') {
          // Filtrer les réponses vides avant de compter
          const validAnswers = question.answers ? question.answers.filter(a => {
            const answerText = typeof a === 'string' ? a : (a.answer_text || a.text || '');
            return answerText && answerText.trim().length > 0;
          }) : [];
          
          if (!question.answers || !Array.isArray(question.answers) || validAnswers.length < 2) {
            return res.status(400).json({
              success: false,
              message: `La question ${i + 1} (QCM) doit avoir au moins 2 réponses`
            });
          }
          // Vérifier qu'au moins une réponse est correcte
          const hasCorrectAnswer = question.answers.some(a => a.is_correct === true || a.is_correct === 'true' || a.isCorrect === true);
          if (!hasCorrectAnswer) {
            return res.status(400).json({
              success: false,
              message: `La question ${i + 1} (QCM) doit avoir au moins une réponse correcte`
            });
          }
        }
        
        // Validation pour les questions vrai/faux
        if (questionType === 'true_false') {
          // Accepter différents formats après normalisation
          if (question.correct_answer === undefined || 
              (typeof question.correct_answer === 'string' && question.correct_answer.trim().length === 0)) {
            return res.status(400).json({
              success: false,
              message: `La question ${i + 1} (Vrai/Faux) doit avoir une réponse correcte définie (true/false, "Vrai"/"Faux", ou 1/0)`
            });
          }
        }
        
        // Validation pour les questions à réponse courte
        if (questionType === 'short_answer') {
          const correctAnswer = question.correct_answer !== undefined 
            ? (typeof question.correct_answer === 'string' ? question.correct_answer : String(question.correct_answer))
            : '';
          if (!correctAnswer || correctAnswer.trim().length === 0) {
            return res.status(400).json({
              success: false,
              message: `La question ${i + 1} (Réponse courte) doit avoir une réponse correcte`
            });
          }
        }
      }
      
      // Créer les questions après validation
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const questionType = question.question_type || 'multiple_choice';
        
        // Pour les quiz de modules, on utilise module_quiz_id (quiz_id peut être NULL)
        const [questionResult] = await pool.execute(
          `INSERT INTO quiz_questions (
            quiz_id, module_quiz_id, question_text, question_type, points, order_index, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
          [
            null, // NULL pour les quiz de modules (quiz_id est maintenant nullable)
            quizId, // Lien vers le quiz de module via module_quiz_id
            sanitizeValue(question.question_text),
            sanitizeValue(questionType),
            sanitizeValue(question.points || 1),
            i
          ]
        );

        const questionId = questionResult.insertId;

        // Gérer les réponses selon le type de question
        if (questionType === 'multiple_choice' && question.answers && Array.isArray(question.answers)) {
          // QCM : créer plusieurs réponses
          for (let j = 0; j < question.answers.length; j++) {
            const answer = question.answers[j];
            // Gérer les différents formats : objet {answer_text, is_correct} ou chaîne simple
            const answerText = typeof answer === 'string' ? answer : (answer.answer_text || answer.text || '');
            const isCorrect = typeof answer === 'string' 
              ? (answer === question.correct_answer || answer.trim() === (question.correct_answer || '').trim())
              : (answer.is_correct === true || answer.is_correct === 'true' || answer.isCorrect === true);
            
            await pool.execute(
              `INSERT INTO quiz_answers (
                question_id, answer_text, is_correct, order_index
              ) VALUES (?, ?, ?, ?)`,
              [
                questionId,
                sanitizeValue(answerText),
                isCorrect,
                j
              ]
            );
          }
        } else if (questionType === 'true_false' && question.correct_answer !== undefined) {
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
        } else if (questionType === 'short_answer' && question.correct_answer) {
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
       WHERE qq.module_quiz_id = ? AND qq.is_active = TRUE
       ORDER BY qq.order_index ASC`,
      [quiz.id]
    );

    // Récupérer les réponses pour chaque question (sans révéler les bonnes réponses)
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
        // Pour les questions vrai/faux, retourner ['Vrai', 'Faux']
        // Pour les questions à réponse courte, ne pas retourner de réponses
        let options = [];
        if (question.question_type === 'multiple_choice') {
          options = answers.map(a => a.answer_text);
        } else if (question.question_type === 'true_false') {
          options = ['Vrai', 'Faux'];
        }

        return {
          id: question.id.toString(),
          question_text: question.question_text,
          question_type: question.question_type,
          points: question.points,
          order_index: question.order_index,
          options: options
        };
      })
    );

    // Récupérer les tentatives précédentes
    const [attempts] = await pool.execute(
      `SELECT * FROM quiz_attempts 
       WHERE enrollment_id = ? AND module_quiz_id = ? 
       ORDER BY started_at DESC`,
      [enrollmentId, quiz.id]
    );

    const attemptsCount = attempts.length || 0;
    const maxAttempts = Number(quiz.max_attempts) || 0;
    const remainingAttempts = Math.max(0, maxAttempts - attemptsCount);
    
    res.json({
      success: true,
      data: {
        quiz: {
          ...quiz,
          questions: questionsWithOptions,
          max_attempts: maxAttempts,
          attempts_count: attemptsCount, // Nombre de tentatives effectuées
          remaining_attempts: remainingAttempts // Nombre de tentatives restantes
        },
        previous_attempts: attempts,
        can_attempt: remainingAttempts > 0
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
  // Extraire les paramètres au début pour qu'ils soient accessibles dans le catch
  const enrollmentId = req.params?.enrollmentId;
  const moduleId = req.params?.moduleId;
  const userId = req.user?.userId;
  
  try {
    const { answers } = req.body;

    // Logs de débogage
    console.log('📥 [Backend] Soumission quiz reçue:', {
      enrollmentId,
      moduleId,
      userId,
      answersType: typeof answers,
      answersIsArray: Array.isArray(answers),
      answersKeys: answers && typeof answers === 'object' ? Object.keys(answers) : null,
      answersPreview: answers && typeof answers === 'object' ? Object.entries(answers).slice(0, 3) : answers
    });

    // Vérifier l'inscription
    const [enrollments] = await pool.execute(
      'SELECT * FROM enrollments WHERE id = ? AND user_id = ?',
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      console.error('❌ [Backend] Inscription non trouvée:', { enrollmentId, userId });
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
      console.error('❌ [Backend] Quiz non trouvé:', { moduleId });
      return res.status(404).json({
        success: false,
        message: 'Quiz non trouvé'
      });
    }

    const quiz = quizzes[0];
    console.log('✅ [Backend] Quiz trouvé:', { quizId: quiz.id, title: quiz.title });

    // Vérifier les tentatives
    const [attemptsResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM quiz_attempts WHERE enrollment_id = ? AND module_quiz_id = ?',
      [enrollmentId, quiz.id]
    );

    if (attemptsResult[0].count >= quiz.max_attempts) {
      console.warn('⚠️ [Backend] Nombre maximum de tentatives atteint:', { 
        count: attemptsResult[0].count, 
        max: quiz.max_attempts 
      });
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
    console.log('✅ [Backend] Tentative créée:', { attemptId });

    // Calculer le score
    // Les réponses peuvent être un objet {questionId: answer} ou un tableau
    let totalPoints = 0;
    let earnedPoints = 0;
    let correctAnswers = 0;
    let totalQuestions = 0;

    // Récupérer toutes les questions du quiz
    const [allQuestions] = await pool.execute(
      'SELECT id, points, question_type FROM quiz_questions WHERE module_quiz_id = ? AND is_active = TRUE',
      [quiz.id]
    );

    console.log('📋 [Backend] Questions du quiz:', {
      count: allQuestions.length,
      questionIds: allQuestions.map(q => q.id)
    });

    // Convertir answers en format standard si c'est un objet
    let answersArray = [];
    if (Array.isArray(answers)) {
      answersArray = answers;
      console.log('📋 [Backend] Réponses reçues comme tableau:', answersArray.length);
    } else if (typeof answers === 'object' && answers !== null) {
      // Convertir l'objet {questionId: answer} en tableau
      answersArray = Object.entries(answers).map(([questionId, answerText]) => ({
        question_id: String(questionId), // S'assurer que c'est une string pour la comparaison
        answer_text: String(answerText || '') // S'assurer que c'est une string
      }));
      console.log('📋 [Backend] Réponses converties depuis objet:', {
        originalKeys: Object.keys(answers),
        convertedCount: answersArray.length,
        converted: answersArray.slice(0, 3)
      });
    } else {
      console.error('❌ [Backend] Format de réponses invalide:', typeof answers);
      return res.status(400).json({
        success: false,
        message: 'Format de réponses invalide'
      });
    }

    // Traiter chaque question
    for (const question of allQuestions) {
      // Convertir les points en nombre pour éviter la concaténation de strings
      const questionPoints = Number(question.points) || 0;
      totalPoints += questionPoints;
      totalQuestions++;

      // Trouver la réponse de l'utilisateur pour cette question
      // Comparer les IDs en tant que strings pour éviter les problèmes de type
      const questionIdStr = String(question.id);
      const userAnswer = answersArray.find(a => {
        const answerQuestionId = String(a.question_id || a.questionId || '');
        return answerQuestionId === questionIdStr;
      });

      if (userAnswer) {
        const answerText = String(userAnswer.answer_text || userAnswer.answerText || '').trim();
        
        // Récupérer les bonnes réponses pour cette question
        const [correctAnswersList] = await pool.execute(
          'SELECT answer_text, is_correct FROM quiz_answers WHERE question_id = ? AND is_correct = 1',
          [question.id]
        );

        // Vérifier si la réponse est correcte
        let isCorrect = false;
        if (question.question_type === 'true_false') {
          // Pour vrai/faux, normaliser et comparer (insensible à la casse)
          const normalizedAnswer = answerText.toLowerCase();
          // Normaliser les réponses de la base de données aussi
          const normalizedCorrectAnswers = correctAnswersList.map(ca => ca.answer_text.toLowerCase().trim());
          
          // Vérifier si la réponse correspond à "vrai" ou "faux" (ou variations)
          isCorrect = normalizedCorrectAnswers.some(ca => {
            const caNormalized = ca.toLowerCase().trim();
            return (
              caNormalized === normalizedAnswer ||
              (normalizedAnswer === 'vrai' && (caNormalized === 'vrai' || caNormalized.includes('vrai'))) ||
              (normalizedAnswer === 'faux' && (caNormalized === 'faux' || caNormalized.includes('faux'))) ||
              (normalizedAnswer === 'true' && (caNormalized === 'true' || caNormalized === 'vrai')) ||
              (normalizedAnswer === 'false' && (caNormalized === 'false' || caNormalized === 'faux'))
            );
          });
          
          console.log(`🔍 [Backend] Question ${question.id} (vrai/faux):`, {
            userAnswer: normalizedAnswer,
            correctAnswers: normalizedCorrectAnswers,
            isCorrect
          });
        } else if (question.question_type === 'multiple_choice') {
          // Pour QCM, comparer le texte exact (mais normaliser les espaces)
          isCorrect = correctAnswersList.some(ca => 
            ca.answer_text.trim() === answerText.trim()
          );
          
          console.log(`🔍 [Backend] Question ${question.id} (QCM):`, {
            userAnswer: answerText,
            correctAnswers: correctAnswersList.map(ca => ca.answer_text.trim()),
            isCorrect
          });
        } else {
          // Pour réponse courte, comparaison insensible à la casse
          isCorrect = correctAnswersList.some(ca => 
            ca.answer_text.toLowerCase().trim() === answerText.toLowerCase().trim()
          );
          
          console.log(`🔍 [Backend] Question ${question.id} (réponse courte):`, {
            userAnswer: answerText,
            correctAnswers: correctAnswersList.map(ca => ca.answer_text.trim()),
            isCorrect
          });
        }

        if (isCorrect) {
          // Utiliser questionPoints au lieu de question.points pour éviter les problèmes de type
          earnedPoints += questionPoints;
          correctAnswers++;
        }
      } else {
        console.log(`⚠️ [Backend] Pas de réponse pour la question ${question.id}`);
      }
    }

    const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    // S'assurer que passing_score est un nombre pour la comparaison
    const passingScore = Number(quiz.passing_score) || 0;
    const isPassed = percentage >= passingScore;

    console.log('📊 [Backend] Calcul du score:', {
      earnedPoints: Number(earnedPoints),
      totalPoints: Number(totalPoints),
      percentage: Math.round(percentage * 100) / 100,
      correctAnswers,
      totalQuestions,
      isPassed,
      passingScore: passingScore
    });

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

    // Vérifier si un badge a été attribué
    let badgeEarned = false;
    let badgeName = null;
    if (isPassed && quiz.badge_id) {
      const [badges] = await pool.execute(
        'SELECT name FROM badges WHERE id = ?',
        [quiz.badge_id]
      );
      if (badges.length > 0) {
        badgeEarned = true;
        badgeName = badges[0].name;
      }
    }

    const responseData = {
      attempt_id: attemptId,
      score: earnedPoints,
      total_points: totalPoints,
      percentage: Math.round(percentage * 100) / 100, // Arrondir à 2 décimales
      passed: isPassed,
      is_passed: isPassed, // Pour compatibilité
      correct_answers: correctAnswers,
      total_questions: totalQuestions,
      badge_earned: badgeEarned,
      badge_name: badgeName
    };

    console.log('✅ [Backend] Réponse envoyée:', responseData);

    res.json({
      success: true,
      message: 'Quiz soumis avec succès',
      data: responseData
    });

  } catch (error) {
    // Les variables sont déjà définies au début de la fonction
    console.error('❌ [Backend] Erreur lors de la soumission:', {
      error: error.message,
      stack: error.stack,
      enrollmentId: enrollmentId,
      moduleId: moduleId,
      userId: userId
    });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la soumission',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      // Normaliser les questions : convertir différents formats en format standard
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const questionType = question.question_type || 'multiple_choice';
        
        // Pour les QCM : convertir options + correct_answer en format answers
        if (questionType === 'multiple_choice' && question.options && Array.isArray(question.options) && !question.answers) {
          question.answers = question.options.map(option => ({
            answer_text: option,
            is_correct: option === question.correct_answer || option.trim() === (question.correct_answer || '').trim()
          }));
        }
        
        // Pour les questions Vrai/Faux : normaliser correct_answer
        if (questionType === 'true_false' && question.correct_answer !== undefined) {
          // Accepter différents formats : true/false, "true"/"false", "Vrai"/"Faux", 1/0
          if (typeof question.correct_answer === 'string') {
            const answerLower = question.correct_answer.toLowerCase().trim();
            if (answerLower === 'vrai' || answerLower === 'true' || answerLower === '1') {
              question.correct_answer = true;
            } else if (answerLower === 'faux' || answerLower === 'false' || answerLower === '0') {
              question.correct_answer = false;
            }
          } else if (question.correct_answer === 1 || question.correct_answer === '1') {
            question.correct_answer = true;
          } else if (question.correct_answer === 0 || question.correct_answer === '0') {
            question.correct_answer = false;
          }
        }
        
        // Pour les questions à réponse courte : s'assurer que correct_answer est une chaîne
        if (questionType === 'short_answer' && question.correct_answer !== undefined) {
          if (typeof question.correct_answer !== 'string') {
            question.correct_answer = String(question.correct_answer);
          }
        }
      }
      
      // Valider les questions avant de les créer (même logique que createModuleQuiz)
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const questionType = question.question_type || 'multiple_choice';
        
        // Validation : s'assurer que les questions ont les données nécessaires
        if (!question.question_text || question.question_text.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: `La question ${i + 1} doit avoir un texte`
          });
        }
        
        // Validation pour les questions à choix multiples
        if (questionType === 'multiple_choice') {
          // Filtrer les réponses vides avant de compter
          const validAnswers = question.answers ? question.answers.filter(a => {
            const answerText = typeof a === 'string' ? a : (a.answer_text || a.text || '');
            return answerText && answerText.trim().length > 0;
          }) : [];
          
          if (!question.answers || !Array.isArray(question.answers) || validAnswers.length < 2) {
            return res.status(400).json({
              success: false,
              message: `La question ${i + 1} (QCM) doit avoir au moins 2 réponses`
            });
          }
          // Vérifier qu'au moins une réponse est correcte
          const hasCorrectAnswer = question.answers.some(a => a.is_correct === true || a.is_correct === 'true' || a.isCorrect === true);
          if (!hasCorrectAnswer) {
            return res.status(400).json({
              success: false,
              message: `La question ${i + 1} (QCM) doit avoir au moins une réponse correcte`
            });
          }
        }
        
        // Validation pour les questions vrai/faux
        if (questionType === 'true_false') {
          // Accepter différents formats après normalisation
          if (question.correct_answer === undefined || 
              (typeof question.correct_answer === 'string' && question.correct_answer.trim().length === 0)) {
            return res.status(400).json({
              success: false,
              message: `La question ${i + 1} (Vrai/Faux) doit avoir une réponse correcte définie (true/false, "Vrai"/"Faux", ou 1/0)`
            });
          }
        }
        
        // Validation pour les questions à réponse courte
        if (questionType === 'short_answer') {
          const correctAnswer = question.correct_answer !== undefined 
            ? (typeof question.correct_answer === 'string' ? question.correct_answer : String(question.correct_answer))
            : '';
          if (!correctAnswer || correctAnswer.trim().length === 0) {
            return res.status(400).json({
              success: false,
              message: `La question ${i + 1} (Réponse courte) doit avoir une réponse correcte`
            });
          }
        }
      }
      
      // Supprimer les anciennes questions après validation
      await pool.execute(
        'DELETE FROM quiz_answers WHERE question_id IN (SELECT id FROM quiz_questions WHERE module_quiz_id = ?)',
        [finalQuizId]
      );
      await pool.execute(
        'DELETE FROM quiz_questions WHERE module_quiz_id = ?',
        [finalQuizId]
      );

      // Créer les nouvelles questions après validation
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const questionType = question.question_type || 'multiple_choice';
        
        const [questionResult] = await pool.execute(
          `INSERT INTO quiz_questions (
            quiz_id, module_quiz_id, question_text, question_type, points, order_index, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
          [
            null,
            finalQuizId,
            sanitizeValue(question.question_text),
            sanitizeValue(questionType),
            sanitizeValue(question.points || 1),
            question.order_index !== undefined ? question.order_index : i
          ]
        );

        const questionId = questionResult.insertId;

        // Gérer les réponses selon le type de question
        if (questionType === 'multiple_choice' && question.answers && Array.isArray(question.answers)) {
          for (let j = 0; j < question.answers.length; j++) {
            const answer = question.answers[j];
            // Gérer les différents formats : objet {answer_text, is_correct} ou chaîne simple
            const answerText = typeof answer === 'string' ? answer : (answer.answer_text || answer.text || '');
            const isCorrect = typeof answer === 'string' 
              ? (answer === question.correct_answer || answer.trim() === (question.correct_answer || '').trim())
              : (answer.is_correct === true || answer.is_correct === 'true' || answer.isCorrect === true);
            
            await pool.execute(
              `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
              [questionId, sanitizeValue(answerText), isCorrect, j]
            );
          }
        } else if (questionType === 'true_false' && question.correct_answer !== undefined) {
          const correctAnswer = question.correct_answer === true || question.correct_answer === 'true';
          await pool.execute(
            `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [questionId, 'Vrai', correctAnswer, 0]
          );
          await pool.execute(
            `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [questionId, 'Faux', !correctAnswer, 1]
          );
        } else if (questionType === 'short_answer' && question.correct_answer) {
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

