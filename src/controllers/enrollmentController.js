const { pool } = require('../config/database');
const { eventEmitter, EVENTS } = require('../middleware/eventEmitter');

// S'inscrire à un cours
const enrollInCourse = async (req, res) => {
  try {
    // Accepter courseId (camelCase) ou course_id (snake_case)
    const courseId = req.body.courseId || req.body.course_id;
    const userId = req.user?.id ?? req.user?.userId;

    // Debug: logger le body reçu
    console.log('🔍 [ENROLLMENT] Body reçu:', JSON.stringify(req.body));
    console.log('🔍 [ENROLLMENT] courseId extrait:', courseId);
    console.log('🔍 [ENROLLMENT] userId:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'ID du cours requis (courseId ou course_id)',
        receivedBody: req.body
      });
    }

    // Vérifier que le cours existe et est publié (ou si l'utilisateur est l'instructeur/admin)
    const userRole = req.user?.role;
    let courseQuery = `
      SELECT id, max_students, enrollment_deadline, course_start_date, prerequisite_course_id, instructor_id
      FROM courses 
      WHERE id = ?
    `;
    
    // Si l'utilisateur n'est pas instructeur/admin, ne montrer que les cours publiés
    if (userRole !== 'instructor' && userRole !== 'admin') {
      courseQuery += ' AND is_published = TRUE';
    }
    
    const [courses] = await pool.execute(courseQuery, [courseId]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé ou non publié'
      });
    }

    const course = courses[0];

    // Vérifier la date limite d'inscription
    if (course.enrollment_deadline && new Date(course.enrollment_deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'La date limite d\'inscription est dépassée'
      });
    }

    // Vérifier le nombre maximum d'étudiants
    if (course.max_students) {
      const enrollmentCountQuery = 'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ? AND is_active = TRUE';
      const [countResult] = await pool.execute(enrollmentCountQuery, [courseId]);
      
      if (countResult[0].count >= course.max_students) {
        return res.status(400).json({
          success: false,
          message: 'Le cours a atteint le nombre maximum d\'étudiants'
        });
      }
    }

    // Vérifier les prérequis si nécessaire (sauf pour les admins et instructeurs du cours)
    const isInstructor = course.instructor_id && parseInt(course.instructor_id) === parseInt(userId);
    const isAdmin = userRole === 'admin';
    
    if (course.prerequisite_course_id && !isAdmin && !isInstructor) {
      // Vérifier si l'utilisateur a complété le prérequis OU est au moins inscrit
      const prerequisiteQuery = `
        SELECT id, status, progress_percentage 
        FROM enrollments 
        WHERE user_id = ? AND course_id = ?
      `;
      const [prerequisiteEnrollments] = await pool.execute(prerequisiteQuery, [
        userId, 
        course.prerequisite_course_id
      ]);

      if (prerequisiteEnrollments.length === 0) {
        // Récupérer le titre du cours prérequis
        const prereqCourseQuery = 'SELECT title FROM courses WHERE id = ?';
        const [prereqCourses] = await pool.execute(prereqCourseQuery, [course.prerequisite_course_id]);
        const prereqTitle = prereqCourses.length > 0 ? prereqCourses[0].title : 'cours prérequis';

        return res.status(400).json({
          success: false,
          message: `Vous devez d'abord vous inscrire au cours prérequis: ${prereqTitle}`,
          prerequisite_course_id: course.prerequisite_course_id,
          prerequisite_title: prereqTitle
        });
      }
      
      // Vérifier si le prérequis est complété
      const prerequisiteEnrollment = prerequisiteEnrollments[0];
      if (prerequisiteEnrollment.status !== 'completed') {
        const prereqCourseQuery = 'SELECT title FROM courses WHERE id = ?';
        const [prereqCourses] = await pool.execute(prereqCourseQuery, [course.prerequisite_course_id]);
        const prereqTitle = prereqCourses.length > 0 ? prereqCourses[0].title : 'cours prérequis';
        
        const progress = prerequisiteEnrollment.progress_percentage || 0;
        
        // Option: permettre l'inscription même si le prérequis n'est pas complété
        // Définir cette variable d'environnement pour activer l'inscription avec avertissement
        const allowEnrollmentWithWarning = process.env.ALLOW_ENROLLMENT_WITH_INCOMPLETE_PREREQUISITE === 'true';
        
        if (!allowEnrollmentWithWarning) {
          return res.status(400).json({
            success: false,
            message: `Vous devez d'abord compléter le cours prérequis: ${prereqTitle} (Progression: ${progress}%)`,
            prerequisite_course_id: course.prerequisite_course_id,
            prerequisite_title: prereqTitle,
            prerequisite_status: prerequisiteEnrollment.status,
            prerequisite_progress: progress
          });
        }
        
        // Si autorisé, on continue avec un avertissement (le message sera ajouté dans la réponse)
        console.log(`⚠️  Inscription autorisée malgré prérequis incomplet: ${prereqTitle} (${progress}%)`);
      }
    }

    // Vérifier si l'utilisateur est déjà inscrit
    const existingEnrollmentQuery = 'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?';
    const [existingEnrollments] = await pool.execute(existingEnrollmentQuery, [userId, courseId]);

    if (existingEnrollments.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Vous êtes déjà inscrit à ce cours'
      });
    }

    // Créer l'inscription avec status 'enrolled'
    const enrollmentQuery = `
      INSERT INTO enrollments (user_id, course_id, status, enrolled_at)
      VALUES (?, ?, 'enrolled', NOW())
    `;
    await pool.execute(enrollmentQuery, [userId, courseId]);

    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: {
        course_id: courseId,
        enrolled_at: new Date()
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription au cours'
    });
  }
};

// Récupérer mes cours
const getMyCourses = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;
    const { status = 'all' } = req.query; // all, active, completed

    let whereClause = 'WHERE e.user_id = ?';
    let params = [userId];

    if (status === 'active') {
      whereClause += ' AND e.completed_at IS NULL';
    } else if (status === 'completed') {
      whereClause += ' AND e.completed_at IS NOT NULL';
    }

    const query = `
      SELECT 
        c.*,
        e.enrolled_at,
        e.progress_percentage,
        e.completed_at,
        e.last_accessed_at,
        cat.name as category_name,
        cat.color as category_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN users u ON c.instructor_id = u.id
      ${whereClause}
      ORDER BY e.enrolled_at DESC
    `;

    const [courses] = await pool.execute(query, params);

    res.json({
      success: true,
      data: courses
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des cours:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cours'
    });
  }
};

// Récupérer la progression d'un cours
const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    // Vérifier que l'utilisateur est inscrit au cours
    const enrollmentQuery = `
      SELECT * FROM enrollments 
      WHERE user_id = ? AND course_id = ? AND is_active = TRUE
    `;
    const [enrollments] = await pool.execute(enrollmentQuery, [userId, courseId]);

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours'
      });
    }

    // Récupérer les leçons du cours
    const lessonsQuery = `
      SELECT l.*, lp.is_completed, lp.completed_at, lp.time_spent_minutes
      FROM lessons l
      LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ?
      WHERE l.course_id = ? AND l.is_published = TRUE
      ORDER BY l.order_index ASC
    `;
    const [lessons] = await pool.execute(lessonsQuery, [userId, courseId]);

    // Récupérer les quiz du cours
    const quizzesQuery = `
      SELECT q.*, qa.score, qa.is_passed, qa.completed_at
      FROM quizzes q
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.user_id = ?
      WHERE q.course_id = ? AND q.is_published = TRUE
    `;
    const [quizzes] = await pool.execute(quizzesQuery, [userId, courseId]);

    // Calculer les statistiques
    const totalLessons = lessons.length;
    const completedLessons = lessons.filter(lesson => lesson.is_completed).length;
    const totalQuizzes = quizzes.length;
    const passedQuizzes = quizzes.filter(quiz => quiz.is_passed).length;

    res.json({
      success: true,
      data: {
        enrollment: enrollments[0],
        lessons,
        quizzes,
        statistics: {
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          total_quizzes: totalQuizzes,
          passed_quizzes: passedQuizzes,
          progress_percentage: enrollments[0].progress_percentage
        }
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

// Mettre à jour la progression d'une leçon
const updateLessonProgress = async (req, res) => {
  try {
    const { courseId, lessonId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { is_completed, time_spent_minutes, last_position_seconds } = req.body;

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

    // Vérifier que la leçon appartient au cours
    const lessonQuery = 'SELECT id FROM lessons WHERE id = ? AND course_id = ?';
    const [lessons] = await pool.execute(lessonQuery, [lessonId, courseId]);

    if (lessons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Leçon non trouvée dans ce cours'
      });
    }

    // Mettre à jour ou créer la progression
    const upsertQuery = `
      INSERT INTO lesson_progress (
        user_id, lesson_id, course_id, is_completed, 
        completed_at, time_spent_minutes, last_position_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        is_completed = VALUES(is_completed),
        completed_at = CASE 
          WHEN VALUES(is_completed) = TRUE AND completed_at IS NULL THEN NOW()
          WHEN VALUES(is_completed) = FALSE THEN NULL
          ELSE completed_at
        END,
        time_spent_minutes = VALUES(time_spent_minutes),
        last_position_seconds = VALUES(last_position_seconds),
        updated_at = NOW()
    `;

    const completedAt = is_completed ? new Date() : null;
    await pool.execute(upsertQuery, [
      userId, lessonId, courseId, is_completed, 
      completedAt, time_spent_minutes, last_position_seconds
    ]);

    if (is_completed) {
      eventEmitter.emit(EVENTS.LESSON_COMPLETED, {
        userId,
        courseId,
        lessonId,
        lessonTitle: undefined,
        timeSpent: time_spent_minutes || 0
      });
    }

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

// Se désinscrire d'un cours
const unenrollFromCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

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

    // Désactiver l'inscription
    await pool.execute(
      'UPDATE enrollments SET is_active = FALSE WHERE user_id = ? AND course_id = ?',
      [userId, courseId]
    );

    res.json({
      success: true,
      message: 'Désinscription réussie'
    });

  } catch (error) {
    console.error('Erreur lors de la désinscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désinscription'
    });
  }
};

module.exports = {
  enrollInCourse,
  getMyCourses,
  getCourseProgress,
  updateLessonProgress,
  unenrollFromCourse
};
