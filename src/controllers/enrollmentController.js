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
    const { paymentId } = req.body; // NOUVEAU : Support paiement
    let courseQuery = `
      SELECT id, max_students, enrollment_deadline, course_start_date, prerequisite_course_id, instructor_id, price, status, is_published
      FROM courses 
      WHERE id = ?
    `;
    
    // Si l'utilisateur n'est pas instructeur/admin, ne montrer que les cours publiés, approuvés et non en brouillon
    if (userRole !== 'instructor' && userRole !== 'admin') {
      courseQuery += ` AND is_published = TRUE 
        AND (COALESCE(status, 'draft') = 'approved' OR COALESCE(status, 'draft') = 'published') 
        AND COALESCE(status, 'draft') != 'draft'`;
    }
    
    const [courses] = await pool.execute(courseQuery, [courseId]);

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé ou non disponible pour inscription'
      });
    }

    const course = courses[0];
    
    // Vérification supplémentaire du statut pour les utilisateurs non-admin/instructeur
    if (userRole !== 'instructor' && userRole !== 'admin') {
      const courseStatus = course.status || 'draft';
      const isDraft = courseStatus === 'draft';
      const isApproved = courseStatus === 'approved' || courseStatus === 'published';
      
      if (!course.is_published || isDraft || !isApproved) {
        return res.status(403).json({
          success: false,
          message: 'Ce cours n\'est pas disponible pour inscription. Il doit être approuvé par un administrateur.'
        });
      }
    }

    // NOUVEAU : Vérifier le paiement si cours payant
    if (course.price && course.price > 0) {
      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: 'Ce cours est payant. Un paiement est requis.',
          requires_payment: true
        });
      }

      // Vérifier que le paiement est complété
      const [payments] = await pool.execute(
        'SELECT id, status FROM payments WHERE id = ? AND user_id = ? AND course_id = ?',
        [paymentId, userId, courseId]
      );

      if (payments.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Paiement non trouvé'
        });
      }

      if (payments[0].status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Le paiement n\'est pas complété. Statut: ' + payments[0].status
        });
      }
    }

    // Vérifier la date limite d'inscription
    if (course.enrollment_deadline && new Date(course.enrollment_deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'La date limite d\'inscription est dépassée'
      });
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

    // Utiliser une transaction avec verrou pour éviter les conflits de concurrence
    let connection = null;
    
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      // Vérifier le nombre maximum d'étudiants DANS la transaction avec verrou pour éviter les dépassements
      if (course.max_students) {
        // Verrouiller le cours pour éviter les race conditions sur max_students
        const [courseLock] = await connection.execute(
          'SELECT max_students FROM courses WHERE id = ? FOR UPDATE',
          [courseId]
        );
        
        const enrollmentCountQuery = 'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ? AND is_active = TRUE';
        const [countResult] = await connection.execute(enrollmentCountQuery, [courseId]);
        
        if (countResult[0].count >= course.max_students) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Le cours a atteint le nombre maximum d\'étudiants'
          });
        }
      }
      
      // Vérifier si l'utilisateur est déjà inscrit (tous statuts) avec verrou
      const existingEnrollmentQuery = `
        SELECT id, is_active, status FROM enrollments 
        WHERE user_id = ? AND course_id = ?
        LIMIT 1 FOR UPDATE
      `;
      const [existingEnrollments] = await connection.execute(existingEnrollmentQuery, [userId, courseId]);

      if (existingEnrollments.length > 0) {
        const existingEnrollment = existingEnrollments[0];
        
        // Si l'inscription existe mais est inactive OU a le statut 'in_progress', la supprimer complètement pour repartir à zéro
        const isInactive = !existingEnrollment.is_active;
        const isInProgress = existingEnrollment.status === 'in_progress';
        
        if (isInactive || isInProgress) {
          console.log(`🗑️ [ENROLLMENT] Suppression de l'inscription pour repartir à zéro (enrollment ${existingEnrollment.id}, reason: ${isInactive ? 'inactive' : 'in_progress'}, status: ${existingEnrollment.status})`);
          
          try {
            // Supprimer toutes les données de progression restantes
            const [quizDeleted] = await connection.execute(
              `DELETE FROM quiz_attempts 
               WHERE (enrollment_id = ?) OR (user_id = ? AND course_id = ?)`,
              [existingEnrollment.id, userId, courseId]
            );
            console.log(`✅ [ENROLLMENT] ${quizDeleted.affectedRows} tentative(s) de quiz supprimée(s)`);

            const [progressDeleted] = await connection.execute(
              'DELETE FROM progress WHERE enrollment_id = ?',
              [existingEnrollment.id]
            );
            console.log(`✅ [ENROLLMENT] ${progressDeleted.affectedRows} enregistrement(s) de progression supprimé(s)`);

            const [lessonProgressDeleted] = await connection.execute(
              'DELETE FROM lesson_progress WHERE user_id = ? AND course_id = ?',
              [userId, courseId]
            );
            console.log(`✅ [ENROLLMENT] ${lessonProgressDeleted.affectedRows} enregistrement(s) de progression de leçon supprimé(s)`);
            
            // Supprimer complètement l'enrollment inactif
            await connection.execute(
              'DELETE FROM enrollments WHERE id = ?',
              [existingEnrollment.id]
            );
            console.log(`✅ [ENROLLMENT] Enrollment inactif supprimé, création d'un nouveau`);
          } catch (cleanupError) {
            console.error('❌ [ENROLLMENT] Erreur lors du nettoyage de l\'enrollment inactif:', cleanupError);
            // Continuer pour créer un nouvel enrollment
          }
          // Continuer pour créer un nouvel enrollment (pas de return ici)
        } else {
          // Si l'inscription est active, on refuse
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Vous êtes déjà inscrit à ce cours'
          });
        }
      }

      // Créer l'inscription avec status 'enrolled' et payment_id si applicable
      try {
        const enrollmentQuery = `
          INSERT INTO enrollments (user_id, course_id, status, enrolled_at, payment_id)
          VALUES (?, ?, 'enrolled', NOW(), ?)
        `;
        await connection.execute(enrollmentQuery, [userId, courseId, course.price > 0 ? paymentId : null]);
      } catch (insertError) {
        // Si erreur UNIQUE constraint (un autre thread a créé l'enrollment entre temps)
        if (insertError.code === 'ER_DUP_ENTRY' || insertError.errno === 1062) {
          console.log('[ENROLLMENT] ⚠️ Enrollment already exists (race condition)');
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: 'Vous êtes déjà inscrit à ce cours'
          });
        } else {
          throw insertError; // Re-lancer l'erreur si ce n'est pas une erreur UNIQUE
        }
      }
      
      await connection.commit();
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }

    // Récupérer le titre du cours pour la notification
    const [courseTitleResult] = await pool.execute(
      'SELECT title FROM courses WHERE id = ?',
      [courseId]
    );
    const courseTitle = courseTitleResult.length > 0 ? courseTitleResult[0].title : 'Votre formation';

    // Créer une notification d'inscription
    try {
      await pool.execute(
        `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          '🎓 Inscription réussie',
          `Vous êtes maintenant inscrit au cours "${courseTitle}". Commencez votre apprentissage dès maintenant !`,
          'course_enrolled',
          `/learn/${courseId}`,
          JSON.stringify({ courseId: courseId, courseTitle: courseTitle })
        ]
      );
    } catch (notificationError) {
      console.error('Erreur lors de la création de la notification d\'inscription:', notificationError);
      // Ne pas bloquer l'inscription si la notification échoue
    }

    // Enregistrer l'activité d'inscription pour les "Activités récentes"
    // Note: recordActivity appelle déjà checkAndAwardBadges, donc pas besoin de l'appeler deux fois
    try {
      const { recordActivity } = require('./gamificationController');
      await recordActivity(
        userId,
        'course_enrolled',
        10, // Points pour l'inscription
        `Inscription au cours "${courseTitle}"`,
        { courseId: courseId, courseTitle: courseTitle }
      );
      console.log(`✅ [ENROLLMENT] Activité d'inscription enregistrée pour le cours ${courseId}`);
    } catch (activityError) {
      console.error('❌ [ENROLLMENT] Erreur lors de l\'enregistrement de l\'activité d\'inscription:', activityError);
      // Ne pas bloquer l'inscription si l'activité échoue
    }

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

    let whereClause = 'WHERE e.user_id = ? AND e.is_active = TRUE';
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

    // Récupérer les leçons du cours avec progression (vérifier les deux tables)
    const enrollmentId = enrollments[0].id;
    const lessonsQuery = `
      SELECT 
        l.*, 
        COALESCE(lp.is_completed, CASE WHEN p.status = 'completed' THEN TRUE ELSE FALSE END, FALSE) as is_completed,
        COALESCE(lp.completed_at, p.completed_at) as completed_at,
        COALESCE(lp.time_spent_minutes, FLOOR(p.time_spent / 60), 0) as time_spent_minutes
      FROM lessons l
      LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id AND lp.user_id = ? AND lp.course_id = ?
      LEFT JOIN progress p ON l.id = p.lesson_id AND p.enrollment_id = ?
      WHERE l.course_id = ? AND l.is_published = TRUE
      ORDER BY l.order_index ASC
    `;
    const [lessons] = await pool.execute(lessonsQuery, [userId, courseId, enrollmentId, courseId]);

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
    const { is_completed, time_spent_minutes, last_position_seconds, completion_percentage } = req.body;

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

    const enrollmentId = enrollments[0].id;
    const enrollment = enrollments[0];

    // Utiliser une transaction pour garantir la cohérence des deux tables
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      console.log(`🔄 [Enrollment] Transaction démarrée pour mise à jour progression lesson ${lessonId}, enrollment ${enrollmentId}`);

      // Mettre à jour ou créer la progression dans lesson_progress
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
      const [lessonProgressResult] = await connection.execute(upsertQuery, [
        userId, lessonId, courseId, is_completed, 
        completedAt, time_spent_minutes, last_position_seconds
      ]);
      console.log(`✅ [Enrollment] lesson_progress mis à jour pour user ${userId}, lesson ${lessonId}`);

      // IMPORTANT: Synchroniser aussi avec la table progress pour cohérence
      if (is_completed) {
        // Vérifier si un enregistrement existe dans progress
        const [existingProgress] = await connection.execute(
          'SELECT id FROM progress WHERE enrollment_id = ? AND lesson_id = ?',
          [enrollmentId, lessonId]
        );

        if (existingProgress.length > 0) {
          // Mettre à jour
          await connection.execute(
            `UPDATE progress 
             SET status = 'completed',
                 completion_percentage = 100,
                 time_spent = time_spent + ?,
                 completed_at = NOW(),
                 updated_at = NOW()
             WHERE enrollment_id = ? AND lesson_id = ?`,
            [(time_spent_minutes || 0) * 60, enrollmentId, lessonId]
          );
          console.log(`✅ [Enrollment] progress mis à jour (UPDATE) pour enrollment ${enrollmentId}, lesson ${lessonId}`);
        } else {
          // Créer
          await connection.execute(
            `INSERT INTO progress (
              enrollment_id, lesson_id, status, completion_percentage, 
              time_spent, completed_at
            ) VALUES (?, ?, 'completed', 100, ?, NOW())`,
            [enrollmentId, lessonId, (time_spent_minutes || 0) * 60]
          );
          console.log(`✅ [Enrollment] progress créé (INSERT) pour enrollment ${enrollmentId}, lesson ${lessonId}`);
        }

        // Vérifier que les données sont bien sauvegardées
        const [verifyProgress] = await connection.execute(
          'SELECT id, status, completion_percentage FROM progress WHERE enrollment_id = ? AND lesson_id = ?',
          [enrollmentId, lessonId]
        );
        const [verifyLessonProgress] = await connection.execute(
          'SELECT id, is_completed FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
          [userId, lessonId]
        );
        
        if (verifyProgress.length === 0 || verifyProgress[0].status !== 'completed') {
          throw new Error(`La progression n'a pas été correctement sauvegardée dans progress: status=${verifyProgress[0]?.status}`);
        }
        if (verifyLessonProgress.length === 0 || !verifyLessonProgress[0].is_completed) {
          throw new Error(`La progression n'a pas été correctement sauvegardée dans lesson_progress: is_completed=${verifyLessonProgress[0]?.is_completed}`);
        }
        
        console.log(`✅ [Enrollment] Vérification réussie: progression sauvegardée dans les deux tables`);
      } else {
        // Si la leçon n'est pas complétée, mettre à jour le pourcentage dans progress
        const completionPercentage = last_position_seconds && last_position_seconds > 0 ? 50 : 0;
        const [existingProgress] = await connection.execute(
          'SELECT id FROM progress WHERE enrollment_id = ? AND lesson_id = ?',
          [enrollmentId, lessonId]
        );

        if (existingProgress.length > 0) {
          await connection.execute(
            `UPDATE progress 
             SET completion_percentage = ?,
                 status = CASE 
                   WHEN ? >= 100 THEN 'completed'
                   WHEN ? > 0 THEN 'in_progress'
                   ELSE 'not_started'
                 END,
                 updated_at = NOW()
             WHERE enrollment_id = ? AND lesson_id = ?`,
            [completionPercentage, completionPercentage, completionPercentage, enrollmentId, lessonId]
          );
        } else {
          await connection.execute(
            `INSERT INTO progress (
              enrollment_id, lesson_id, status, completion_percentage, 
              time_spent
            ) VALUES (?, ?, ?, ?, ?)`,
            [
              enrollmentId, 
              lessonId, 
              completionPercentage >= 100 ? 'completed' : (completionPercentage > 0 ? 'in_progress' : 'not_started'),
              completionPercentage,
              (time_spent_minutes || 0) * 60
            ]
          );
        }
      }

      await connection.commit();
      console.log(`✅ [Enrollment] Transaction commitée avec succès pour lesson ${lessonId}, enrollment ${enrollmentId}`);

      // Recalculer la progression globale du cours après la transaction
      if (is_completed) {
        const ProgressService = require('../services/progressService');
        await ProgressService.updateCourseProgress(enrollmentId);
        console.log(`✅ [Enrollment] Progression globale recalculée pour enrollment ${enrollmentId} après complétion de la leçon ${lessonId}`);
      }
      
    } catch (error) {
      await connection.rollback();
      console.error(`❌ [Enrollment] Erreur lors de la sauvegarde de progression, rollback effectué:`, error);
      throw error;
    } finally {
      connection.release();
    }

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
  // Logs au tout début pour vérifier que la fonction est appelée
  console.log('🚀 [UNENROLL] Fonction appelée');
  console.log('🚀 [UNENROLL] req.params:', req.params);
  console.log('🚀 [UNENROLL] req.user:', req.user ? { id: req.user.id, userId: req.user.userId, role: req.user.role } : 'null');
  console.log('🚀 [UNENROLL] req.method:', req.method);
  console.log('🚀 [UNENROLL] req.url:', req.url);
  
  try {
    // Accepter courseId ou id comme paramètre
    const courseId = req.params.courseId || req.params.id;
    const userId = req.user?.id ?? req.user?.userId;

    console.log('🔍 [UNENROLL] courseId extrait:', courseId);
    console.log('🔍 [UNENROLL] userId extrait:', userId);

    if (!courseId) {
      console.error('❌ [UNENROLL] courseId manquant');
      return res.status(400).json({
        success: false,
        message: 'ID du cours requis'
      });
    }

    if (!userId) {
      console.error('❌ [UNENROLL] userId manquant - utilisateur non authentifié');
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    console.log('✅ [UNENROLL] Paramètres validés - courseId:', courseId, 'userId:', userId);

    // Vérifier que l'utilisateur est inscrit au cours (tous statuts, y compris completed)
    // Permettre la désinscription même si le cours est complété à 100%
    const enrollmentQuery = `
      SELECT id, status, progress_percentage FROM enrollments 
      WHERE user_id = ? AND course_id = ? 
      AND is_active = TRUE
    `;
    const [enrollments] = await pool.execute(enrollmentQuery, [userId, courseId]);

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Vous n\'êtes pas inscrit à ce cours'
      });
    }

    const enrollmentId = enrollments[0].id;

    // Récupérer le titre du cours pour la notification
    const [courseTitleResult] = await pool.execute(
      'SELECT title FROM courses WHERE id = ?',
      [courseId]
    );
    const courseTitle = courseTitleResult.length > 0 ? courseTitleResult[0].title : 'Votre formation';

    // Nettoyer toutes les données de progression liées à cette inscription
    console.log(`🧹 [UNENROLL] Nettoyage des données de progression pour l'inscription ${enrollmentId}`);
    
    // Utiliser une transaction pour garantir que tout est supprimé ou rien
    let connection = null;
    
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      console.log(`🔄 [UNENROLL] Transaction démarrée`);

      // 1. Supprimer TOUTES les tentatives de quiz liées à cet enrollment ou cet utilisateur pour ce cours
      // Cela inclut : quiz de cours, quiz de modules, et évaluations
      // IMPORTANT: Faire cela EN PREMIER car les autres tables peuvent avoir des foreign keys
      const [quizAttemptsDeleted] = await connection.execute(
        `DELETE FROM quiz_attempts 
         WHERE (enrollment_id = ?) 
         OR (user_id = ? AND course_id = ?)`,
        [enrollmentId, userId, courseId]
      );
      console.log(`✅ [UNENROLL] ${quizAttemptsDeleted.affectedRows} tentative(s) de quiz supprimée(s) (tous types)`);

      // 2. Supprimer ou désactiver les enregistrements de progression (progress)
      const [progressDeleted] = await connection.execute(
        'DELETE FROM progress WHERE enrollment_id = ?',
        [enrollmentId]
      );
      console.log(`✅ [UNENROLL] ${progressDeleted.affectedRows} enregistrement(s) de progression supprimé(s)`);

      // 3. Supprimer les enregistrements de lesson_progress pour ce cours
      const [lessonProgressDeleted] = await connection.execute(
        'DELETE FROM lesson_progress WHERE user_id = ? AND course_id = ?',
        [userId, courseId]
      );
      console.log(`✅ [UNENROLL] ${lessonProgressDeleted.affectedRows} enregistrement(s) de progression de leçon supprimé(s)`);

      // 4. Supprimer les activités utilisateur liées au cours
      try {
        const [activitiesDeleted] = await connection.execute(
          `DELETE FROM user_activities 
           WHERE user_id = ? 
           AND (metadata->>'$.courseId' = ? OR metadata->>'$.course_id' = ?)`,
          [userId, courseId, courseId]
        );
        console.log(`✅ [UNENROLL] ${activitiesDeleted.affectedRows} activité(s) utilisateur supprimée(s)`);
      } catch (activityError) {
        // La table peut ne pas exister, continuer
        console.log(`ℹ️ [UNENROLL] Pas d'activités utilisateur à supprimer: ${activityError.message}`);
      }

      // 5. SUPPRIMER complètement l'inscription (en dernier pour garder la référence pendant les suppressions)
      await connection.execute(
        'DELETE FROM enrollments WHERE id = ?',
        [enrollmentId]
      );
      console.log(`✅ [UNENROLL] Inscription supprimée complètement`);

      // Commit de la transaction
      await connection.commit();
      console.log(`✅ [UNENROLL] Transaction commitée avec succès`);

      // Vérification : compter les données restantes pour confirmer la suppression (avant de libérer la connexion)
      try {
        const [remainingQuizAttempts] = await connection.execute(
          `SELECT COUNT(*) as count FROM quiz_attempts 
           WHERE (enrollment_id = ?) OR (user_id = ? AND course_id = ?)`,
          [enrollmentId, userId, courseId]
        );
        const [remainingProgress] = await connection.execute(
          'SELECT COUNT(*) as count FROM progress WHERE enrollment_id = ?',
          [enrollmentId]
        );
        const [remainingLessonProgress] = await connection.execute(
          'SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = ? AND course_id = ?',
          [userId, courseId]
        );
        
        console.log(`📊 [UNENROLL] Vérification après suppression:`);
        console.log(`   - Tentatives de quiz restantes: ${remainingQuizAttempts[0].count}`);
        console.log(`   - Progression restante: ${remainingProgress[0].count}`);
        console.log(`   - Progression de leçons restante: ${remainingLessonProgress[0].count}`);
        
        if (remainingQuizAttempts[0].count > 0 || remainingProgress[0].count > 0 || remainingLessonProgress[0].count > 0) {
          console.warn(`⚠️ [UNENROLL] ATTENTION: Il reste des données non supprimées!`);
        }
      } catch (verifyError) {
        console.error('❌ [UNENROLL] Erreur lors de la vérification:', verifyError.message);
      }

      // Note: On garde les certificats et badges car ils représentent des accomplissements
      // même si l'utilisateur se désinscrit, il a mérité ces récompenses

      // 6. Créer une notification de désinscription (après la transaction)
      try {
        await pool.execute(
          `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            userId,
            '📤 Désinscription effectuée',
            `Vous avez été désinscrit du cours "${courseTitle}". Toutes vos données de progression, tentatives de quiz et activités ont été supprimées.`,
            'course_unenrolled',
            `/dashboard/student/courses`,
            JSON.stringify({ courseId: courseId, courseTitle: courseTitle })
          ]
        );
        console.log(`✅ [UNENROLL] Notification de désinscription créée`);
      } catch (notificationError) {
        console.error('❌ [UNENROLL] Erreur lors de la création de la notification:', notificationError);
      }

      // 7. Enregistrer l'activité de désinscription
      try {
        const { recordActivity } = require('./gamificationController');
        await recordActivity(
          userId,
          'course_unenrolled',
          0, // Pas de points pour la désinscription
          `Désinscription du cours "${courseTitle}"`,
          { courseId: courseId, courseTitle: courseTitle }
        );
        console.log(`✅ [UNENROLL] Activité de désinscription enregistrée`);
      } catch (activityError) {
        console.error('❌ [UNENROLL] Erreur lors de l\'enregistrement de l\'activité:', activityError);
      }

      console.log(`✅ [UNENROLL] Désinscription complète réussie pour le cours ${courseId}`);

      res.json({
        success: true,
        message: 'Désinscription réussie. Toutes vos données de progression, tentatives de quiz et activités ont été supprimées.'
      });

    } catch (cleanupError) {
      console.error('❌ [UNENROLL] Erreur lors du nettoyage des données:', cleanupError);
      console.error('❌ [UNENROLL] Stack:', cleanupError.stack);
      
      // Rollback de la transaction en cas d'erreur
      if (connection) {
        try {
          await connection.rollback();
          console.log(`🔄 [UNENROLL] Transaction rollback effectué`);
        } catch (rollbackError) {
          console.error('❌ [UNENROLL] Erreur lors du rollback:', rollbackError);
        }
      }
      
      // Retourner une erreur au lieu de confirmer
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression des données. La désinscription a été annulée.',
        error: process.env.NODE_ENV === 'development' ? cleanupError.message : undefined
      });
    } finally {
      // Libérer la connexion
      if (connection) {
        connection.release();
      }
    }

  } catch (error) {
    console.error('❌ [UNENROLL] Erreur globale lors de la désinscription:', error);
    console.error('❌ [UNENROLL] Stack:', error.stack);
    console.error('❌ [UNENROLL] Message:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la désinscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
