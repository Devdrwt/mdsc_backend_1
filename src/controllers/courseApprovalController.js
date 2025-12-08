const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const { buildMediaUrl } = require('../utils/media');

/**
 * Demander la publication d'un cours
 */
const requestPublication = async (req, res) => {
  try {
    // Support pour les deux formats : id ou courseId
    const courseId = req.params.id || req.params.courseId;
    const instructorId = req.user.userId;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'ID du cours requis'
      });
    }

    // Vérifier que le cours appartient à l'instructeur
    const [courses] = await pool.execute(
      'SELECT * FROM courses WHERE id = ? AND instructor_id = ?',
      [courseId, instructorId]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];

    // Vérifier que le cours n'est pas déjà en attente ou publié
    if (course.status === 'pending_approval') {
      return res.status(400).json({
        success: false,
        message: 'Une demande de publication est déjà en cours'
      });
    }

    if (course.status === 'published' || course.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Ce cours est déjà publié'
      });
    }

    // Vérifier les conditions de publication
    const validationErrors = [];

    // 1. Au moins un module avec au moins une leçon (uniquement pour les cours on_demand)
    // Les cours en live n'ont pas besoin de modules/leçons, seulement l'évaluation finale
    if (course.course_type !== 'live') {
      const [modules] = await pool.execute(
        `SELECT m.id FROM modules m
         JOIN lessons l ON m.id = l.module_id
         WHERE m.course_id = ? AND l.is_published = TRUE
         GROUP BY m.id`,
        [courseId]
      );

      if (modules.length === 0) {
        validationErrors.push('Le cours doit contenir au moins un module avec au moins une leçon publiée');
      }
    }

    // 2. Évaluation finale créée
    const [evaluations] = await pool.execute(
      'SELECT id FROM course_evaluations WHERE course_id = ? AND is_published = TRUE',
      [courseId]
    );

    if (evaluations.length === 0) {
      validationErrors.push('Une évaluation finale est obligatoire');
    }

    // 3. Si cours Live : dates et max_students
    if (course.course_type === 'live') {
      if (!course.course_start_date || !course.course_end_date) {
        validationErrors.push('Les dates de début et fin sont obligatoires pour un cours Live');
      }
      if (!course.max_students || course.max_students <= 0) {
        validationErrors.push('Le nombre maximum d\'étudiants est obligatoire pour un cours Live');
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Le cours ne peut pas être publié',
        errors: validationErrors
      });
    }

    // Mettre à jour le statut
    await pool.execute(
      'UPDATE courses SET status = "pending_approval" WHERE id = ?',
      [courseId]
    );

    // Créer une entrée dans course_approvals
    await pool.execute(
      'INSERT INTO course_approvals (course_id, admin_id, status) VALUES (?, NULL, "pending")',
      [courseId]
    ).catch(() => {
      // Si la table n'existe pas encore, continuer quand même
      console.warn('⚠️ Table course_approvals non trouvée. Migration nécessaire.');
    });

    // Récupérer les informations de l'instructeur
    const [instructors] = await pool.execute(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [instructorId]
    );
    const instructor = instructors[0] || {};
    const instructorName = `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || 'Un instructeur';

    // Créer une notification pour tous les admins
    try {
      const [admins] = await pool.execute(
        'SELECT id FROM users WHERE role = "admin"'
      );

      const notificationTitle = 'Nouvelle demande de publication de cours';
      const notificationMessage = `Le cours "${course.title}" a été soumis pour validation par ${instructorName}.`;
      const actionUrl = `/dashboard/admin/courses?courseId=${courseId}`;
      const metadata = JSON.stringify({
        course_id: courseId,
        course_title: course.title,
        instructor_id: instructorId,
        instructor_name: instructorName,
        action: 'review_required',
        link: actionUrl
      });

      // Créer une notification pour chaque admin
      for (const admin of admins) {
        await pool.execute(
          `INSERT INTO notifications (
            user_id, title, message, type, is_read, action_url, metadata
          ) VALUES (?, ?, ?, 'info', FALSE, ?, ?)`,
          [admin.id, notificationTitle, notificationMessage, actionUrl, metadata]
        );
      }

      console.log(`✅ Notifications créées pour ${admins.length} admin(s) concernant le cours "${course.title}"`);
    } catch (notificationError) {
      // Ne pas faire échouer la demande si la création de notification échoue
      console.error('⚠️ Erreur lors de la création des notifications admin:', notificationError);
    }

    res.json({
      success: true,
      message: 'Demande de publication soumise avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la demande de publication:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la demande'
    });
  }
};

/**
 * Demander la suppression d'un cours
 */
const requestDeletion = async (req, res) => {
  try {
    // Support pour les deux formats : id ou courseId
    const courseId = req.params.id || req.params.courseId;
    const instructorId = req.user.userId;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'ID du cours requis'
      });
    }

    // Vérifier que le cours appartient à l'instructeur
    const [courses] = await pool.execute(
      'SELECT * FROM courses WHERE id = ? AND instructor_id = ?',
      [courseId, instructorId]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];

    // Vérifier s'il y a des étudiants inscrits
    const [enrollments] = await pool.execute(
      'SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?',
      [courseId]
    );

    const enrollmentCount = enrollments[0]?.count || 0;

    // Vérifier si une demande de suppression est déjà en cours
    const [existingApprovals] = await pool.execute(
      'SELECT id, comments FROM course_approvals WHERE course_id = ? AND status = "pending" AND comments LIKE "%demande de suppression%"',
      [courseId]
    );

    if (existingApprovals.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Une demande de suppression est déjà en cours'
      });
    }

    // Mettre à jour le statut à pending_approval (on utilise ce statut pour toutes les demandes)
    await pool.execute(
      'UPDATE courses SET status = "pending_approval" WHERE id = ?',
      [courseId]
    );

    // Créer une entrée dans course_approvals pour la suppression avec un commentaire
    await pool.execute(
      'INSERT INTO course_approvals (course_id, admin_id, status, comments, created_at) VALUES (?, NULL, "pending", ?, NOW())',
      [courseId, `Demande de suppression - ${enrollmentCount} étudiant(s) inscrit(s)`]
    ).catch(() => {
      // Si la table n'existe pas encore, continuer quand même
      console.warn('⚠️ Table course_approvals non trouvée. Migration nécessaire.');
    });

    // Récupérer les informations de l'instructeur
    const [instructors] = await pool.execute(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [instructorId]
    );
    const instructor = instructors[0] || {};
    const instructorName = `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || 'Un instructeur';

    // Créer une notification pour tous les admins
    try {
      const [admins] = await pool.execute(
        'SELECT id FROM users WHERE role = "admin"'
      );

      const notificationTitle = 'Nouvelle demande de suppression de cours';
      const notificationMessage = `Le cours "${course.title}" a été soumis pour suppression par ${instructorName}.${enrollmentCount > 0 ? ` ${enrollmentCount} étudiant(s) inscrit(s).` : ''}`;
      const actionUrl = `/dashboard/admin/courses?courseId=${courseId}`;
      const metadata = JSON.stringify({
        course_id: courseId,
        course_title: course.title,
        instructor_id: instructorId,
        instructor_name: instructorName,
        enrollment_count: enrollmentCount,
        action: 'deletion_review_required',
        link: actionUrl
      });

      // Créer une notification pour chaque admin
      for (const admin of admins) {
        await pool.execute(
          `INSERT INTO notifications (
            user_id, title, message, type, is_read, action_url, metadata
          ) VALUES (?, ?, ?, 'warning', FALSE, ?, ?)`,
          [admin.id, notificationTitle, notificationMessage, actionUrl, metadata]
        );
      }

      console.log(`✅ Notifications créées pour ${admins.length} admin(s) concernant la suppression du cours "${course.title}"`);
    } catch (notificationError) {
      // Ne pas faire échouer la demande si la création de notification échoue
      console.error('⚠️ Erreur lors de la création des notifications admin:', notificationError);
    }

    res.json({
      success: true,
      message: 'Demande de suppression soumise avec succès',
      data: {
        course_id: courseId,
        enrollment_count: enrollmentCount
      }
    });

  } catch (error) {
    console.error('Erreur lors de la demande de suppression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la demande de suppression'
    });
  }
};

/**
 * Mettre un cours en attente de validation (Admin)
 */
const setCoursePending = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId || req.user.id;

    // Vérifier que le cours existe
    const [courses] = await pool.execute(
      'SELECT id, status, instructor_id FROM courses WHERE id = ?',
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];
    const oldStatus = course.status || 'draft';

    // Ne pas mettre en attente si déjà approuvé ou publié
    if (course.status === 'approved' || course.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Ce cours est déjà approuvé ou publié'
      });
    }

    // Mettre le cours en attente
    await pool.execute(
      'UPDATE courses SET status = "pending_approval" WHERE id = ?',
      [id]
    );

    // Créer ou mettre à jour l'entrée dans course_approvals
    const [existingApprovals] = await pool.execute(
      'SELECT id FROM course_approvals WHERE course_id = ?',
      [id]
    );

    if (existingApprovals.length > 0) {
      await pool.execute(
        `UPDATE course_approvals SET 
          status = 'pending',
          reviewed_at = NULL
         WHERE course_id = ?`,
        [id]
      );
    } else {
      await pool.execute(
        'INSERT INTO course_approvals (course_id, admin_id, status) VALUES (?, NULL, "pending")',
        [id]
      ).catch(() => {
        console.warn('⚠️ Table course_approvals non trouvée');
      });
    }

    console.log(`✅ [ADMIN] Cours ${id} mis en attente de validation par l'admin ${adminId} (ancien statut: ${oldStatus})`);

    res.json({
      success: true,
      message: 'Cours mis en attente de validation',
      data: {
        course_id: id,
        old_status: oldStatus,
        new_status: 'pending_approval'
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Erreur lors de la mise en attente:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise en attente',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Liste des cours en attente (Admin) - inclut les cours en draft et pending_approval
 */
const getPendingCourses = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Inclure les cours en draft et pending_approval
    const [courses] = await pool.execute(
      `SELECT 
        c.id,
        c.title,
        c.description,
        COALESCE(c.status, 'draft') as status,
        c.course_type,
        c.created_at as course_created_at,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        COALESCE(ca.created_at, c.created_at) as request_date
       FROM courses c
       JOIN users u ON c.instructor_id = u.id
       LEFT JOIN course_approvals ca ON c.id = ca.course_id AND ca.status = 'pending'
       WHERE (c.status = 'pending_approval' OR c.status = 'draft' OR c.status IS NULL)
       ORDER BY 
         CASE WHEN c.status = 'pending_approval' THEN 1 ELSE 2 END,
         COALESCE(ca.created_at, c.created_at) ASC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    // Compter le total (draft + pending_approval)
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM courses 
       WHERE (status = 'pending_approval' OR status = 'draft' OR status IS NULL)`
    );

    res.json({
      success: true,
      data: {
        courses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

/**
 * Récupérer les détails d'un cours pour approbation (Admin)
 */
const getCourseForApproval = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID du cours requis'
      });
    }

    console.log('🔍 [COURSE APPROVAL] Récupération détails cours:', id);

    // Récupérer le cours avec les informations de l'instructeur
    const [courses] = await pool.execute(
      `SELECT 
        c.*,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email,
        ca.status as approval_status,
        ca.comments as approval_comments,
        ca.created_at as request_date
       FROM courses c
       JOIN users u ON c.instructor_id = u.id
       LEFT JOIN course_approvals ca ON c.id = ca.course_id AND ca.status = 'pending'
       WHERE c.id = ?`,
      [id]
    );

    if (courses.length === 0) {
      console.log('❌ [COURSE APPROVAL] Cours non trouvé:', id);
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];
    console.log('✅ [COURSE APPROVAL] Cours trouvé:', course.title);

    // Récupérer les modules avec leurs leçons
    const [modules] = await pool.execute(
      `SELECT 
        m.*,
        COUNT(l.id) as lessons_count
       FROM modules m
       LEFT JOIN lessons l ON m.id = l.module_id
       WHERE m.course_id = ?
       GROUP BY m.id
       ORDER BY m.order_index ASC`,
      [id]
    );

    // Récupérer les leçons pour chaque module
    for (const module of modules) {
      const [lessons] = await pool.execute(
        'SELECT * FROM lessons WHERE module_id = ? ORDER BY order_index ASC',
        [module.id]
      );
      module.lessons = lessons || [];
    }

    // Récupérer l'évaluation finale avec ses questions
    let finalEvaluation = null;
    try {
      const [evaluations] = await pool.execute(
        `SELECT ce.* 
         FROM course_evaluations ce
         WHERE ce.course_id = ?`,
        [id]
      );

      if (evaluations && evaluations.length > 0) {
        finalEvaluation = evaluations[0];
        
        // Récupérer les questions de l'évaluation
        const [questions] = await pool.execute(
          `SELECT qq.*, 
                  GROUP_CONCAT(DISTINCT qa.answer_text ORDER BY qa.is_correct DESC, qa.id SEPARATOR '|||') as answers
           FROM quiz_questions qq
           LEFT JOIN quiz_answers qa ON qq.id = qa.question_id
           WHERE qq.course_evaluation_id = ?
           GROUP BY qq.id
           ORDER BY qq.order_index ASC`,
          [finalEvaluation.id]
        );

        // Formater les questions avec leurs réponses
        finalEvaluation.questions = questions.map(q => {
          const question = {
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            points: q.points,
            order_index: q.order_index
          };

          // Formater les réponses selon le type de question
          if (q.answers) {
            const answers = q.answers.split('|||').filter(Boolean);
            if (q.question_type === 'multiple_choice') {
              question.options = answers;
            } else if (q.question_type === 'true_false') {
              question.correct_answer = answers[0] === 'Vrai' || answers[0] === 'true';
            } else if (q.question_type === 'short_answer') {
              question.correct_answer = answers[0];
            }
          }

          return question;
        });

        console.log('✅ [COURSE APPROVAL] Évaluation finale trouvée avec', finalEvaluation.questions.length, 'questions');
      }
    } catch (error) {
      console.log('⚠️ [COURSE APPROVAL] Erreur lors de la récupération de l\'évaluation:', error.message);
    }

    // Récupérer les quiz de modules avec leurs questions
    let moduleQuizzes = [];
    try {
      const [quizzes] = await pool.execute(
        `SELECT mq.*, m.title as module_title, m.id as module_id
         FROM module_quizzes mq
         JOIN modules m ON mq.module_id = m.id
         WHERE m.course_id = ?`,
        [id]
      );

      // Pour chaque quiz, récupérer les questions
      for (const quiz of quizzes) {
        const [questions] = await pool.execute(
          `SELECT qq.*, 
                  GROUP_CONCAT(DISTINCT qa.answer_text ORDER BY qa.is_correct DESC, qa.id SEPARATOR '|||') as answers
           FROM quiz_questions qq
           LEFT JOIN quiz_answers qa ON qq.id = qa.question_id
           WHERE qq.module_quiz_id = ?
           GROUP BY qq.id
           ORDER BY qq.order_index ASC`,
          [quiz.id]
        );

        // Formater les questions
        quiz.questions = questions.map(q => {
          const question = {
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            points: q.points,
            order_index: q.order_index
          };

          if (q.answers) {
            const answers = q.answers.split('|||').filter(Boolean);
            if (q.question_type === 'multiple_choice') {
              question.options = answers;
            } else if (q.question_type === 'true_false') {
              question.correct_answer = answers[0] === 'Vrai' || answers[0] === 'true';
            } else if (q.question_type === 'short_answer') {
              question.correct_answer = answers[0];
            }
          }

          return question;
        });
      }

      moduleQuizzes = quizzes;
      console.log('✅ [COURSE APPROVAL] Quiz de modules trouvés:', moduleQuizzes.length);
    } catch (error) {
      console.log('⚠️ [COURSE APPROVAL] Erreur lors de la récupération des quiz:', error.message);
    }

    // Formater l'URL de l'image si elle existe
    if (course.thumbnail_url) {
      const originalUrl = course.thumbnail_url;
      const fs = require('fs');
      const path = require('path');
      
      // Si l'URL contient déjà le domaine complet (http://localhost:5000/...), extraire le chemin
      if (course.thumbnail_url.startsWith('http://') || course.thumbnail_url.startsWith('https://')) {
        // Extraire le chemin après le domaine
        try {
          const urlObj = new URL(course.thumbnail_url);
          course.thumbnail_url = urlObj.pathname; // Ex: /uploads/courses/thumbnails/...
          console.log('✅ [COURSE APPROVAL] URL complète convertie en chemin relatif:', {
            original: originalUrl,
            converted: course.thumbnail_url
          });
        } catch (e) {
          console.log('⚠️ [COURSE APPROVAL] Erreur parsing URL:', e.message);
        }
      } 
      // Si l'URL commence par /uploads, elle est déjà correcte
      else if (course.thumbnail_url.startsWith('/uploads/')) {
        // Déjà formatée correctement
        console.log('✅ [COURSE APPROVAL] URL relative correcte:', course.thumbnail_url);
      }
      // Si l'URL est juste le chemin relatif (ex: courses/thumbnails/...)
      else if (course.thumbnail_url.includes('courses/thumbnails') || course.thumbnail_url.includes('courses/videos')) {
        // Ajouter le préfixe /uploads/
        course.thumbnail_url = `/uploads/${course.thumbnail_url}`;
        console.log('✅ [COURSE APPROVAL] URL formatée:', course.thumbnail_url);
      }
      // Sinon, essayer de construire l'URL complète
      else {
        // Si c'est juste un nom de fichier, chercher dans différents dossiers
        const filename = course.thumbnail_url.split('/').pop(); // Extraire juste le nom du fichier
        const possiblePaths = [
          path.join(__dirname, '../../uploads/courses/thumbnails', filename),
          path.join(__dirname, '../../uploads/profiles', filename),
          path.join(__dirname, '../../uploads/images', filename)
        ];
        
        let foundPath = null;
        for (const filePath of possiblePaths) {
          if (fs.existsSync(filePath)) {
            // Extraire le chemin relatif depuis uploads
            const relativePath = filePath.replace(path.join(__dirname, '../../uploads'), '').replace(/\\/g, '/');
            foundPath = `/uploads${relativePath}`;
            console.log('✅ [COURSE APPROVAL] Fichier trouvé:', foundPath);
            break;
          }
        }
        
        if (foundPath) {
          course.thumbnail_url = foundPath;
        } else {
          // Par défaut, essayer courses/thumbnails
          course.thumbnail_url = `/uploads/courses/thumbnails/${filename}`;
          console.log('⚠️ [COURSE APPROVAL] Fichier non trouvé, utilisation chemin par défaut:', course.thumbnail_url);
        }
      }
    }

    const responseData = {
      ...course,
      thumbnail_url: buildMediaUrl(course.thumbnail_url),
      modules: modules || [],
      final_evaluation: finalEvaluation,
      module_quizzes: moduleQuizzes
    };

    console.log('✅ [COURSE APPROVAL] Données préparées:', {
      courseId: course.id,
      modulesCount: modules.length,
      hasEvaluation: !!responseData.final_evaluation,
      evaluationQuestions: responseData.final_evaluation?.questions?.length || 0,
      quizzesCount: moduleQuizzes.length,
      thumbnailUrl: course.thumbnail_url
    });

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('❌ [COURSE APPROVAL] Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Approuver un cours (Admin)
 */
const approveCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const adminId = req.user.userId || req.user.id;

    // Vérifier que le cours existe et est en attente, en brouillon ou NULL
    const [courses] = await pool.execute(
      'SELECT * FROM courses WHERE id = ? AND (status = "pending_approval" OR status = "draft" OR status IS NULL)',
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé ou déjà approuvé'
      });
    }

    // Mettre à jour le cours
    await pool.execute(
      `UPDATE courses SET 
        status = 'approved',
        approved_by = ?,
        approved_at = NOW(),
        is_published = TRUE
       WHERE id = ?`,
      [adminId, id]
    );

    // Mettre à jour course_approvals
    await pool.execute(
      `UPDATE course_approvals SET 
        admin_id = ?,
        status = 'approved',
        comments = ?,
        reviewed_at = NOW()
       WHERE course_id = ? AND status = 'pending'`,
      [adminId, sanitizeValue(comments), id]
    ).catch(() => {
      // Si la table n'existe pas, créer l'entrée
      pool.execute(
        'INSERT INTO course_approvals (course_id, admin_id, status, comments, reviewed_at) VALUES (?, ?, "approved", ?, NOW())',
        [id, adminId, sanitizeValue(comments)]
      ).catch(() => {});
    });

    // Mettre à jour le statut final
    await pool.execute(
      'UPDATE courses SET status = "published" WHERE id = ?',
      [id]
    );

    // Créer une notification pour l'instructeur
    try {
      const course = courses[0];
      const instructorId = course.instructor_id;
      
      // Récupérer les informations de l'admin
      const [admins] = await pool.execute(
        'SELECT first_name, last_name FROM users WHERE id = ?',
        [adminId]
      );
      const admin = admins[0] || {};
      const adminName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Un administrateur';

      const notificationTitle = 'Cours approuvé et publié';
      const notificationMessage = comments 
        ? `Votre cours "${course.title}" a été approuvé et publié par ${adminName}. Commentaire : ${comments}`
        : `Votre cours "${course.title}" a été approuvé et publié par ${adminName}.`;
      const actionUrl = `/dashboard/instructor/courses/${id}`;
      const metadata = JSON.stringify({
        course_id: id,
        course_title: course.title,
        admin_id: adminId,
        admin_name: adminName,
        action: 'course_approved',
        comments: comments || null,
        link: actionUrl
      });

      await pool.execute(
        `INSERT INTO notifications (
          user_id, title, message, type, is_read, action_url, metadata
        ) VALUES (?, ?, ?, 'success', FALSE, ?, ?)`,
        [instructorId, notificationTitle, notificationMessage, actionUrl, metadata]
      );

      console.log(`✅ Notification créée pour l'instructeur ${instructorId} concernant l'approbation du cours "${course.title}"`);
    } catch (notificationError) {
      // Ne pas faire échouer l'approbation si la création de notification échoue
      console.error('⚠️ Erreur lors de la création de la notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'Cours approuvé et publié avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de l\'approbation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'approbation'
    });
  }
};

/**
 * Rejeter un cours (Admin)
 */
const rejectCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, comments } = req.body;
    const adminId = req.user.userId;

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'La raison du rejet est obligatoire'
      });
    }

    // Vérifier que le cours est en attente
    const [courses] = await pool.execute(
      'SELECT * FROM courses WHERE id = ? AND status = "pending_approval"',
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé ou déjà traité'
      });
    }

    // Mettre à jour le cours
    await pool.execute(
      `UPDATE courses SET 
        status = 'rejected',
        approved_by = ?,
        approved_at = NOW(),
        rejection_reason = ?
       WHERE id = ?`,
      [adminId, sanitizeValue(rejection_reason), id]
    );

    // Mettre à jour course_approvals
    await pool.execute(
      `UPDATE course_approvals SET 
        admin_id = ?,
        status = 'rejected',
        rejection_reason = ?,
        comments = ?,
        reviewed_at = NOW()
       WHERE course_id = ? AND status = 'pending'`,
      [adminId, sanitizeValue(rejection_reason), sanitizeValue(comments), id]
    ).catch(() => {
      // Si la table n'existe pas, créer l'entrée
      pool.execute(
        'INSERT INTO course_approvals (course_id, admin_id, status, rejection_reason, comments, reviewed_at) VALUES (?, ?, "rejected", ?, ?, NOW())',
        [id, adminId, sanitizeValue(rejection_reason), sanitizeValue(comments)]
      ).catch(() => {});
    });

    // Créer une notification pour l'instructeur
    try {
      const course = courses[0];
      const instructorId = course.instructor_id;
      
      // Récupérer les informations de l'admin
      const [admins] = await pool.execute(
        'SELECT first_name, last_name FROM users WHERE id = ?',
        [adminId]
      );
      const admin = admins[0] || {};
      const adminName = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || 'Un administrateur';

      // Construire le message avec la raison du rejet et le commentaire
      let notificationMessage = `Votre cours "${course.title}" a été rejeté par ${adminName}.`;
      notificationMessage += `\n\nRaison : ${rejection_reason}`;
      if (comments) {
        notificationMessage += `\n\nCommentaire : ${comments}`;
      }

      const notificationTitle = 'Cours rejeté';
      const actionUrl = `/dashboard/instructor/courses/${id}`;
      const metadata = JSON.stringify({
        course_id: id,
        course_title: course.title,
        admin_id: adminId,
        admin_name: adminName,
        action: 'course_rejected',
        rejection_reason: rejection_reason,
        comments: comments || null,
        link: actionUrl
      });

      await pool.execute(
        `INSERT INTO notifications (
          user_id, title, message, type, is_read, action_url, metadata
        ) VALUES (?, ?, ?, 'error', FALSE, ?, ?)`,
        [instructorId, notificationTitle, notificationMessage, actionUrl, metadata]
      );

      console.log(`✅ Notification créée pour l'instructeur ${instructorId} concernant le rejet du cours "${course.title}"`);
    } catch (notificationError) {
      // Ne pas faire échouer le rejet si la création de notification échoue
      console.error('⚠️ Erreur lors de la création de la notification:', notificationError);
    }

    res.json({
      success: true,
      message: 'Cours rejeté avec succès'
    });

  } catch (error) {
    console.error('Erreur lors du rejet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet'
    });
  }
};

/**
 * Mettre à jour le statut d'un cours (Admin)
 */
const updateCourseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comments } = req.body;
    const adminId = req.user.userId || req.user.id;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Le statut est requis'
      });
    }

    // Valider le statut
    const validStatuses = ['draft', 'pending_approval', 'approved', 'rejected', 'published'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Statuts valides: ${validStatuses.join(', ')}`
      });
    }

    // Vérifier que le cours existe
    const [courses] = await pool.execute(
      'SELECT id, status, instructor_id FROM courses WHERE id = ?',
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cours non trouvé'
      });
    }

    const course = courses[0];
    const oldStatus = course.status || 'draft';

    // Préparer les champs à mettre à jour
    const updateFields = ['status = ?'];
    const updateValues = [status];

    // Si on approuve ou publie, mettre à jour les champs d'approbation
    if (status === 'approved' || status === 'published') {
      updateFields.push('approved_by = ?', 'approved_at = NOW()');
      updateValues.push(adminId);
      
      // Si on publie, activer is_published
      if (status === 'published') {
        updateFields.push('is_published = TRUE');
      }
    }

    // Si on rejette, permettre de définir la raison
    if (status === 'rejected' && req.body.rejection_reason) {
      updateFields.push('rejection_reason = ?');
      updateValues.push(sanitizeValue(req.body.rejection_reason));
      updateFields.push('approved_by = ?', 'approved_at = NOW()');
      updateValues.push(adminId);
    }

    // Si on met en brouillon, désactiver la publication
    if (status === 'draft') {
      updateFields.push('is_published = FALSE');
    }

    updateValues.push(id);

    // Mettre à jour le cours
    await pool.execute(
      `UPDATE courses SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Mettre à jour ou créer l'entrée dans course_approvals si nécessaire
    if (status === 'approved' || status === 'published' || status === 'rejected') {
      const approvalStatus = status === 'rejected' ? 'rejected' : 'approved';
      
      // Vérifier si une entrée existe déjà
      const [existingApprovals] = await pool.execute(
        'SELECT id FROM course_approvals WHERE course_id = ?',
        [id]
      );

      if (existingApprovals.length > 0) {
        // Mettre à jour l'entrée existante
        const rejectionReasonField = status === 'rejected' && req.body.rejection_reason ? 'rejection_reason = ?,' : '';
        await pool.execute(
          `UPDATE course_approvals SET 
            admin_id = ?,
            status = ?,
            comments = ?,
            ${rejectionReasonField}
            reviewed_at = NOW()
           WHERE course_id = ?`,
          status === 'rejected' && req.body.rejection_reason
            ? [adminId, approvalStatus, sanitizeValue(comments || ''), sanitizeValue(req.body.rejection_reason), id]
            : [adminId, approvalStatus, sanitizeValue(comments || ''), id]
        );
      } else {
        // Créer une nouvelle entrée
        await pool.execute(
          `INSERT INTO course_approvals (course_id, admin_id, status, comments, ${status === 'rejected' && req.body.rejection_reason ? 'rejection_reason, ' : ''}reviewed_at) 
           VALUES (?, ?, ?, ?, ${status === 'rejected' && req.body.rejection_reason ? '?, ' : ''}NOW())`,
          status === 'rejected' && req.body.rejection_reason
            ? [id, adminId, approvalStatus, sanitizeValue(comments || ''), sanitizeValue(req.body.rejection_reason)]
            : [id, adminId, approvalStatus, sanitizeValue(comments || '')]
        ).catch(() => {
          // Si la table n'existe pas, continuer quand même
          console.warn('⚠️ Table course_approvals non trouvée');
        });
      }
    }

    console.log(`✅ [ADMIN] Statut du cours ${id} changé de "${oldStatus}" à "${status}" par l'admin ${adminId}`);

    res.json({
      success: true,
      message: `Statut du cours mis à jour avec succès: ${status}`,
      data: {
        course_id: id,
        old_status: oldStatus,
        new_status: status
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Erreur lors de la mise à jour du statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Récupérer tous les cours (Admin) - pour modération
 */
const getAllCourses = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        c.id,
        c.title,
        c.description,
        c.status,
        c.course_type,
        c.is_published,
        c.price,
        c.currency,
        c.difficulty,
        c.created_at,
        c.updated_at,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email
      FROM courses c
      JOIN users u ON c.instructor_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // Filtre par statut
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    // Recherche par titre
    if (search) {
      query += ' AND (c.title LIKE ? OR c.description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [courses] = await pool.execute(query, params);

    // Compter le total
    let countQuery = `
      SELECT COUNT(*) as total
      FROM courses c
      JOIN users u ON c.instructor_id = u.id
      WHERE 1=1
    `;
    const countParams = [];

    if (status) {
      countQuery += ' AND c.status = ?';
      countParams.push(status);
    }

    if (search) {
      countQuery += ' AND (c.title LIKE ? OR c.description LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern);
    }

    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      success: true,
      data: {
        courses,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

module.exports = {
  requestPublication,
  requestDeletion,
  getPendingCourses,
  getCourseForApproval,
  getAllCourses,
  approveCourse,
  rejectCourse,
  updateCourseStatus,
  setCoursePending
};

