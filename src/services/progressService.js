const { pool } = require('../config/database');
const { buildMediaUrl } = require('../utils/media');

const createNotification = async ({
  userId,
  title,
  message,
  type,
  actionUrl = null,
  metadata = null,
}) => {
  if (!userId) return;

  try {
    const serializedMetadata =
      metadata && Object.keys(metadata || {}).length > 0
        ? JSON.stringify(metadata)
        : null;

    await pool.execute(
      `
        INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [userId, title, message, type, actionUrl, serializedMetadata]
    );
  } catch (error) {
    console.error('Erreur lors de la création de la notification (progression):', error);
  }
};

const getModuleCompletionStats = async (enrollmentId, moduleId) => {
  if (!moduleId) {
    return { total: 0, completed: 0 };
  }

  // Récupérer l'enrollment pour obtenir le user_id et course_id
  const [enrollments] = await pool.execute(
    'SELECT user_id, course_id FROM enrollments WHERE id = ?',
    [enrollmentId]
  );
  
  if (enrollments.length === 0) {
    return { total: 0, completed: 0 };
  }

  const { user_id, course_id } = enrollments[0];

  // Utiliser les deux tables de progression pour une meilleure compatibilité
  // Vérifier d'abord dans progress, puis dans lesson_progress
  const [rows] = await pool.execute(
    `
      SELECT 
        COUNT(DISTINCT l.id) AS total,
        SUM(
          CASE 
            WHEN p.status = 'completed' THEN 1
            WHEN lp.is_completed = TRUE THEN 1
            ELSE 0
          END
        ) AS completed
      FROM lessons l
      LEFT JOIN progress p ON p.lesson_id = l.id AND p.enrollment_id = ?
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ? AND lp.course_id = ?
      WHERE l.module_id = ? AND l.is_published = TRUE
    `,
    [enrollmentId, user_id, course_id, moduleId]
  );

  const result = rows[0] || { total: 0, completed: 0 };
  
  // S'assurer que completed ne dépasse pas total
  if (result.completed > result.total) {
    result.completed = result.total;
  }

  return result;
};

/**
 * Service de gestion de la progression
 */
class ProgressService {
  /**
   * Récupérer la progression détaillée d'une inscription
   */
  static async getProgressByEnrollment(enrollmentId) {
    const enrollmentQuery = `
      SELECT 
        e.*,
        c.title as course_title,
        c.id as course_id,
        u.first_name,
        u.last_name
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      JOIN users u ON e.user_id = u.id
      WHERE e.id = ?
    `;

    const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);
    if (enrollments.length === 0) {
      throw new Error('Inscription non trouvée');
    }

    const enrollment = enrollments[0];

    // Récupérer la progression des leçons (inclure les leçons sans enregistrement de progression)
    // Vérifier les deux tables progress et lesson_progress pour une meilleure compatibilité
    // Inclure aussi les médias uploadés par l'instructeur
    const progressQuery = `
      SELECT 
        l.id AS lesson_id,
        l.title AS lesson_title,
        l.module_id,
        l.content_type,
        l.duration_minutes,
        l.order_index AS lesson_order,
        l.content,
        l.content_text,
        l.content_url,
        l.video_url,
        l.description,
        l.is_required,
        m.title AS module_title,
        m.order_index AS module_order,
        COALESCE(p.id, lp.id) AS progress_id,
        CASE 
          WHEN p.status = 'completed' THEN 'completed'
          WHEN lp.is_completed = TRUE THEN 'completed'
          WHEN p.status = 'in_progress' THEN 'in_progress'
          WHEN lp.time_spent_minutes > 0 THEN 'in_progress'
          WHEN p.status IS NOT NULL THEN p.status
          ELSE 'not_started'
        END AS status,
        CASE 
          WHEN p.status = 'completed' OR lp.is_completed = TRUE THEN 100
          WHEN p.completion_percentage IS NOT NULL THEN p.completion_percentage
          WHEN lp.time_spent_minutes > 0 THEN 50
          ELSE 0
        END AS completion_percentage,
        COALESCE(
          p.time_spent,
          (lp.time_spent_minutes * 60),
          0
        ) AS time_spent,
        COALESCE(p.completed_at, lp.completed_at) AS completed_at,
        COALESCE(p.updated_at, lp.updated_at) AS updated_at,
        mf.id AS media_file_id,
        mf.url AS media_url,
        mf.thumbnail_url,
        mf.file_category,
        mf.filename,
        mf.original_filename,
        mf.file_size,
        mf.file_type,
        mf.duration AS media_duration
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      LEFT JOIN progress p 
        ON p.lesson_id = l.id 
        AND p.enrollment_id = ?
      LEFT JOIN lesson_progress lp 
        ON lp.lesson_id = l.id 
        AND lp.user_id = ? 
        AND lp.course_id = ?
      LEFT JOIN media_files mf ON (
        l.media_file_id = mf.id 
        OR (l.id = mf.lesson_id AND l.media_file_id IS NULL)
      )
      WHERE l.course_id = ?
        AND l.is_published = TRUE
      ORDER BY COALESCE(m.order_index, 0), l.order_index, mf.uploaded_at DESC
    `;

    const [progress] = await pool.execute(progressQuery, [
      enrollmentId, 
      enrollment.user_id, 
      enrollment.course_id, 
      enrollment.course_id
    ]);
    
    console.log(`[ProgressService] 📊 Récupération progression pour enrollment ${enrollmentId}:`, {
      totalLessons: progress.length,
      completedFromProgress: progress.filter(r => r.status === 'completed').length,
      completedFromLP: progress.filter(r => {
        // Vérifier si la leçon est marquée comme complétée dans lesson_progress
        return r.status === 'completed';
      }).length,
      sampleRows: progress.slice(0, 3).map(r => ({
        lesson_id: r.lesson_id,
        status: r.status,
        completion_percentage: r.completion_percentage,
        hasProgress: !!r.progress_id
      }))
    });
    
    // Grouper les résultats par leçon (une leçon peut avoir plusieurs médias)
    const lessonsMap = new Map();
    
    progress.forEach((row) => {
      const lessonId = row.lesson_id;
      
      if (!lessonsMap.has(lessonId)) {
        // Créer l'entrée de base pour la leçon
        lessonsMap.set(lessonId, {
          id: lessonId,
          title: row.lesson_title,
          module_id: row.module_id,
          content_type: row.content_type,
          duration_minutes: row.duration_minutes,
          order_index: row.lesson_order,
          content: row.content,
          content_text: row.content_text,
          content_url: row.content_url,
          video_url: row.video_url ? buildMediaUrl(row.video_url) : null,
          description: row.description,
          is_required: Boolean(row.is_required),
          module_title: row.module_title,
          module_order: row.module_order,
          progress: {
            id: row.progress_id,
            status: row.status,
            completion_percentage: row.completion_percentage,
            time_spent: row.time_spent,
            completed_at: row.completed_at,
            updated_at: row.updated_at
          },
          media: [] // Tableau pour stocker tous les médias
        });
      }
      
      // Ajouter le média s'il existe
      if (row.media_file_id) {
        const lesson = lessonsMap.get(lessonId);
        lesson.media.push({
          id: row.media_file_id,
          url: buildMediaUrl(row.media_url),
          thumbnail_url: row.thumbnail_url ? buildMediaUrl(row.thumbnail_url) : null,
          file_category: row.file_category,
          filename: row.filename,
          original_filename: row.original_filename,
          file_size: row.file_size,
          file_type: row.file_type,
          duration: row.media_duration
        });
      }
    });
    
    // Convertir la Map en tableau et formater les médias
    const formattedProgress = Array.from(lessonsMap.values()).map((lesson) => {
      // Si un seul média, retourner l'objet directement, sinon retourner le tableau
      if (lesson.media.length === 0) {
        lesson.media = null;
      } else if (lesson.media.length === 1) {
        lesson.media = lesson.media[0];
      }
      // Si plusieurs médias, garder le tableau
      return lesson;
    });

    // Récupérer les modules et leur statut
    // Utiliser les deux tables de progression pour une meilleure compatibilité
    const modulesQuery = `
      SELECT 
        m.*,
        COUNT(DISTINCT l.id) as total_lessons,
        SUM(
          CASE 
            WHEN p.status = 'completed' THEN 1
            WHEN lp.is_completed = TRUE THEN 1
            ELSE 0
          END
        ) as completed_lessons
      FROM modules m
      LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
      LEFT JOIN progress p ON l.id = p.lesson_id AND p.enrollment_id = ?
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ? AND lp.course_id = ?
      WHERE m.course_id = ?
      GROUP BY m.id, m.title, m.description, m.order_index, m.created_at, m.updated_at
      ORDER BY m.order_index
    `;

    const [modules] = await pool.execute(modulesQuery, [
      enrollmentId, 
      enrollment.user_id, 
      enrollment.course_id, 
      enrollment.course_id
    ]);

    return {
      enrollment,
      progress: formattedProgress,
      modules,
      summary: {
        total_lessons: formattedProgress.length,
        completed_lessons: formattedProgress.filter(p => p.progress.status === 'completed').length,
        in_progress: formattedProgress.filter(p => p.progress.status === 'in_progress').length,
        not_started: formattedProgress.filter(p => p.progress.status === 'not_started').length
      }
    };
  }

  /**
   * Marquer une leçon comme complétée
   */
  static async markLessonCompleted(enrollmentId, lessonId, timeSpent = 0) {
    // Récupérer l'inscription
    const enrollmentQuery = 'SELECT * FROM enrollments WHERE id = ?';
    const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);
    
    if (enrollments.length === 0) {
      throw new Error('Inscription non trouvée');
    }

    const enrollment = enrollments[0];
    const wasCourseCompletedBefore = enrollment.status === 'completed';

    // Vérifier que la leçon appartient au cours
    const lessonQuery = `
      SELECT 
        l.id,
        l.course_id,
        l.module_id,
        l.title AS lesson_title,
        m.title AS module_title
      FROM lessons l
      LEFT JOIN modules m ON l.module_id = m.id
      WHERE l.id = ?
    `;
    const [lessons] = await pool.execute(lessonQuery, [lessonId]);
    
    if (lessons.length === 0) {
      throw new Error('Leçon non trouvée');
    }

    if (lessons[0].course_id !== enrollment.course_id) {
      throw new Error('La leçon n\'appartient pas à ce cours');
    }

    // Vérifier si la progression existe
    const existingQuery = 'SELECT id, status FROM progress WHERE enrollment_id = ? AND lesson_id = ?';
    const [existing] = await pool.execute(existingQuery, [enrollmentId, lessonId]);
    const wasLessonAlreadyCompleted =
      existing.length > 0 && existing[0].status === 'completed';

    let moduleStatsBefore = { total: 0, completed: 0 };
    if (lessons[0].module_id) {
      moduleStatsBefore = await getModuleCompletionStats(
        enrollmentId,
        lessons[0].module_id
      );
    }

    // Utiliser une transaction pour garantir la cohérence des deux tables
    const connection = await pool.getConnection();
    let progressId;
    
    try {
      await connection.beginTransaction();
      
      if (existing.length > 0) {
        // Mettre à jour
        const updateQuery = `
          UPDATE progress
          SET status = 'completed',
              completion_percentage = 100,
              time_spent = time_spent + ?,
              completed_at = NOW(),
              updated_at = NOW()
          WHERE enrollment_id = ? AND lesson_id = ?
        `;
        await connection.execute(updateQuery, [timeSpent, enrollmentId, lessonId]);
        progressId = existing[0].id;
        console.log(`✅ [ProgressService] Progression mise à jour dans 'progress' pour enrollment ${enrollmentId}, lesson ${lessonId}`);
      } else {
        // Créer
        const insertQuery = `
          INSERT INTO progress (
            enrollment_id, lesson_id, status, completion_percentage, 
            time_spent, completed_at
          ) VALUES (?, ?, 'completed', 100, ?, NOW())
        `;
        const [result] = await connection.execute(insertQuery, [enrollmentId, lessonId, timeSpent]);
        progressId = result.insertId;
        console.log(`✅ [ProgressService] Progression créée dans 'progress' pour enrollment ${enrollmentId}, lesson ${lessonId} (ID: ${progressId})`);
      }

      // Mettre à jour aussi lesson_progress pour compatibilité
      const lessonProgressQuery = `
        INSERT INTO lesson_progress (
          user_id, lesson_id, course_id, is_completed, 
          completed_at, time_spent_minutes, updated_at
        ) VALUES (?, ?, ?, TRUE, NOW(), ?, NOW())
        ON DUPLICATE KEY UPDATE
          is_completed = TRUE,
          completed_at = CASE 
            WHEN completed_at IS NULL THEN NOW()
            ELSE completed_at
          END,
          time_spent_minutes = time_spent_minutes + ?,
          updated_at = NOW()
      `;
      
      const timeSpentMinutes = Math.floor(timeSpent / 60);
      const [lessonProgressResult] = await connection.execute(lessonProgressQuery, [
        enrollment.user_id,
        lessonId,
        enrollment.course_id,
        timeSpentMinutes,
        timeSpentMinutes
      ]);
      
      console.log(`✅ [ProgressService] Progression sauvegardée dans 'lesson_progress' pour user ${enrollment.user_id}, lesson ${lessonId}, course ${enrollment.course_id}`);
      
      // Vérifier que les données sont bien sauvegardées
      const [verifyProgress] = await connection.execute(
        'SELECT id, status FROM progress WHERE enrollment_id = ? AND lesson_id = ?',
        [enrollmentId, lessonId]
      );
      const [verifyLessonProgress] = await connection.execute(
        'SELECT id, is_completed FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
        [enrollment.user_id, lessonId]
      );
      
      if (verifyProgress.length === 0) {
        throw new Error('La progression n\'a pas été sauvegardée dans la table progress');
      }
      if (verifyLessonProgress.length === 0) {
        throw new Error('La progression n\'a pas été sauvegardée dans la table lesson_progress');
      }
      
      if (verifyProgress[0].status !== 'completed') {
        throw new Error(`Le statut de progression est incorrect: ${verifyProgress[0].status} au lieu de 'completed'`);
      }
      if (!verifyLessonProgress[0].is_completed) {
        throw new Error('La leçon n\'est pas marquée comme complétée dans lesson_progress');
      }
      
      await connection.commit();
      console.log(`✅ [ProgressService] Transaction commitée avec succès pour enrollment ${enrollmentId}, lesson ${lessonId}`);
      
    } catch (error) {
      await connection.rollback();
      console.error(`❌ [ProgressService] Erreur lors de la sauvegarde de progression, rollback effectué:`, error);
      throw error;
    } finally {
      connection.release();
    }

    // Recalculer la progression globale du cours
    const courseProgressResult = await this.updateCourseProgress(enrollmentId);

    // Créer les notifications pertinentes (si c'est une nouvelle complétion)
    const [[courseRow = {}]] = await pool.execute(
      'SELECT title FROM courses WHERE id = ?',
      [enrollment.course_id]
    );

    if (!wasLessonAlreadyCompleted) {
      // Enregistrer l'activité pour les points et badges
      try {
        const { recordActivity } = require('../controllers/gamificationController');
        const pointsEarned = 10; // Points pour compléter une leçon
        await recordActivity(
          enrollment.user_id,
          'lesson_completed',
          pointsEarned,
          `Leçon "${lessons[0].lesson_title || 'Sans titre'}" terminée`,
          {
            courseId: enrollment.course_id,
            courseTitle: courseRow.title || 'Votre formation',
            lessonId: lessonId,
            lessonTitle: lessons[0].lesson_title || 'Sans titre',
            moduleId: lessons[0].module_id || null,
            moduleTitle: lessons[0].module_title || null,
          }
        );
      } catch (activityError) {
        console.error('Erreur lors de l\'enregistrement de l\'activité de leçon:', activityError);
      }

      // Créer la notification de leçon terminée
      await createNotification({
        userId: enrollment.user_id,
        title: '✅ Leçon terminée',
        message: `Vous avez terminé la leçon "${lessons[0].lesson_title || 'Sans titre'}" du cours "${courseRow.title || 'Votre formation'}". Vous avez gagné 10 points !`,
        type: 'lesson_completed',
        actionUrl: lessons[0].module_id
          ? `/learn/${enrollment.course_id}?module=${lessons[0].module_id}&lesson=${lessonId}`
          : `/learn/${enrollment.course_id}`,
        metadata: {
          courseId: enrollment.course_id,
          lessonId,
          moduleId: lessons[0].module_id || null,
        },
      });
    }

    let moduleCompleted = false;
    if (lessons[0].module_id) {
      const moduleStatsAfter = await getModuleCompletionStats(
        enrollmentId,
        lessons[0].module_id
      );
      moduleCompleted =
        moduleStatsAfter.total > 0 &&
        moduleStatsAfter.completed >= moduleStatsAfter.total;

      const moduleWasCompletedBefore =
        moduleStatsBefore.total > 0 &&
        moduleStatsBefore.completed >= moduleStatsBefore.total;

      if (moduleCompleted && !moduleWasCompletedBefore) {
        // Enregistrer l'activité pour les points et badges
        try {
          const { recordActivity } = require('../controllers/gamificationController');
          const pointsEarned = 25; // Points pour compléter un module
          await recordActivity(
            enrollment.user_id,
            'module_completed',
            pointsEarned,
            `Module "${lessons[0].module_title || 'Module'}" terminé`,
            {
              courseId: enrollment.course_id,
              courseTitle: courseRow.title || 'Votre formation',
              moduleId: lessons[0].module_id,
              moduleTitle: lessons[0].module_title || 'Module',
            }
          );
        } catch (activityError) {
          console.error('Erreur lors de l\'enregistrement de l\'activité de module:', activityError);
        }

        // Créer la notification de module terminé
        await createNotification({
          userId: enrollment.user_id,
          title: '🎯 Module terminé',
          message: `Bravo, vous avez terminé le module "${lessons[0].module_title || 'Module'}" dans le cours "${courseRow.title || 'Votre formation'}". Vous avez gagné 25 points !`,
          type: 'module_completed',
          actionUrl: `/learn/${enrollment.course_id}?module=${lessons[0].module_id}`,
          metadata: {
            courseId: enrollment.course_id,
            moduleId: lessons[0].module_id,
          },
        });
      }
    }

    if (
      !wasCourseCompletedBefore &&
      courseProgressResult?.status === 'completed'
    ) {
      // Enregistrer l'activité pour les points et badges
      try {
        const { recordActivity } = require('../controllers/gamificationController');
        const pointsEarned = 100; // Points bonus pour compléter un cours
        await recordActivity(
          enrollment.user_id,
          'course_completed',
          pointsEarned,
          `Cours "${courseRow.title || 'Votre formation'}" terminé`,
          {
            courseId: enrollment.course_id,
            courseTitle: courseRow.title || 'Votre formation',
          }
        );
      } catch (activityError) {
        console.error('Erreur lors de l\'enregistrement de l\'activité de cours:', activityError);
      }

      // Créer la notification de cours terminé
      await createNotification({
        userId: enrollment.user_id,
        title: '🥳 Cours terminé',
        message: `Félicitations ! Vous avez terminé le cours "${courseRow.title || 'Votre formation'}". Vous avez gagné 100 points bonus !`,
        type: 'course_completed',
        actionUrl: `/dashboard/student/courses`,
        metadata: {
          courseId: enrollment.course_id,
        },
      });
    }

    return {
      id: progressId,
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      status: 'completed',
      completion_percentage: 100,
      time_spent: timeSpent,
      completed_at: new Date()
    };
  }

  /**
   * Mettre à jour la progression d'une leçon (in_progress)
   */
  static async updateLessonProgress(enrollmentId, lessonId, completionPercentage, timeSpent = 0) {
    const enrollmentQuery = 'SELECT * FROM enrollments WHERE id = ?';
    const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);
    
    if (enrollments.length === 0) {
      throw new Error('Inscription non trouvée');
    }

    const enrollment = enrollments[0];

    const status = completionPercentage === 100 ? 'completed' : 
                   completionPercentage > 0 ? 'in_progress' : 'not_started';

    // Utiliser une transaction pour garantir la cohérence des deux tables
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      console.log(`🔄 [ProgressService] Transaction démarrée pour updateLessonProgress enrollment ${enrollmentId}, lesson ${lessonId}`);

      const existingQuery = 'SELECT id FROM progress WHERE enrollment_id = ? AND lesson_id = ?';
      const [existing] = await connection.execute(existingQuery, [enrollmentId, lessonId]);

      if (existing.length > 0) {
        const updateQuery = `
          UPDATE progress
          SET status = ?,
              completion_percentage = ?,
              time_spent = time_spent + ?,
              completed_at = CASE WHEN ? = 100 THEN NOW() ELSE completed_at END,
              updated_at = NOW()
          WHERE enrollment_id = ? AND lesson_id = ?
        `;
        await connection.execute(updateQuery, [
          status, completionPercentage, timeSpent, completionPercentage,
          enrollmentId, lessonId
        ]);
        console.log(`✅ [ProgressService] progress mis à jour (UPDATE) pour enrollment ${enrollmentId}, lesson ${lessonId}`);
      } else {
        const insertQuery = `
          INSERT INTO progress (
            enrollment_id, lesson_id, status, completion_percentage, 
            time_spent, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        await connection.execute(insertQuery, [
          enrollmentId,
          lessonId,
          status,
          completionPercentage,
          timeSpent,
          completionPercentage === 100 ? new Date() : null
        ]);
        console.log(`✅ [ProgressService] progress créé (INSERT) pour enrollment ${enrollmentId}, lesson ${lessonId}`);
      }

      // IMPORTANT: Synchroniser aussi avec lesson_progress pour cohérence
      const isCompleted = completionPercentage === 100;
      const timeSpentMinutes = Math.floor(timeSpent / 60);
      
      const lessonProgressQuery = `
        INSERT INTO lesson_progress (
          user_id, lesson_id, course_id, is_completed, 
          completed_at, time_spent_minutes, last_position_seconds, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          is_completed = VALUES(is_completed),
          completed_at = CASE 
            WHEN VALUES(is_completed) = TRUE AND completed_at IS NULL THEN NOW()
            WHEN VALUES(is_completed) = FALSE THEN NULL
            ELSE completed_at
          END,
          time_spent_minutes = time_spent_minutes + VALUES(time_spent_minutes),
          last_position_seconds = CASE 
            WHEN VALUES(is_completed) = TRUE THEN 0
            ELSE last_position_seconds
          END,
          updated_at = NOW()
      `;
      
      await connection.execute(lessonProgressQuery, [
        enrollment.user_id,
        lessonId,
        enrollment.course_id,
        isCompleted,
        isCompleted ? new Date() : null,
        timeSpentMinutes,
        0 // last_position_seconds
      ]);
      console.log(`✅ [ProgressService] lesson_progress synchronisé pour user ${enrollment.user_id}, lesson ${lessonId}, course ${enrollment.course_id}`);

      // Vérifier que les données sont bien sauvegardées
      const [verifyProgress] = await connection.execute(
        'SELECT id, status, completion_percentage FROM progress WHERE enrollment_id = ? AND lesson_id = ?',
        [enrollmentId, lessonId]
      );
      const [verifyLessonProgress] = await connection.execute(
        'SELECT id, is_completed FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
        [enrollment.user_id, lessonId]
      );
      
      if (verifyProgress.length === 0) {
        throw new Error('La progression n\'a pas été sauvegardée dans la table progress');
      }
      if (verifyLessonProgress.length === 0) {
        throw new Error('La progression n\'a pas été sauvegardée dans la table lesson_progress');
      }
      
      if (isCompleted && verifyProgress[0].status !== 'completed') {
        throw new Error(`Le statut de progression est incorrect: ${verifyProgress[0].status} au lieu de 'completed'`);
      }
      if (isCompleted && !verifyLessonProgress[0].is_completed) {
        throw new Error('La leçon n\'est pas marquée comme complétée dans lesson_progress');
      }
      
      await connection.commit();
      console.log(`✅ [ProgressService] Transaction commitée avec succès pour updateLessonProgress enrollment ${enrollmentId}, lesson ${lessonId}`);
      
    } catch (error) {
      await connection.rollback();
      console.error(`❌ [ProgressService] Erreur lors de updateLessonProgress, rollback effectué:`, error);
      throw error;
    } finally {
      connection.release();
    }

    // Recalculer la progression globale du cours après la transaction
    await this.updateCourseProgress(enrollmentId);

    return { success: true };
  }

  /**
   * Recalculer la progression globale d'un cours pour une inscription
   */
  static async updateCourseProgress(enrollmentId) {
    const enrollmentQuery = 'SELECT * FROM enrollments WHERE id = ?';
    const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);
    
    if (enrollments.length === 0) return;

    const enrollment = enrollments[0];

    // Compter le total des leçons publiées
    const totalLessonsQuery = `
      SELECT COUNT(*) as total
      FROM lessons
      WHERE course_id = ? AND is_published = TRUE
    `;
    const [totalResult] = await pool.execute(totalLessonsQuery, [enrollment.course_id]);
    const totalLessons = totalResult[0].total;

    if (totalLessons === 0) return;

    // Compter les leçons complétées
    const completedQuery = `
      SELECT COUNT(*) as completed
      FROM progress
      WHERE enrollment_id = ? AND status = 'completed'
    `;
    const [completedResult] = await pool.execute(completedQuery, [enrollmentId]);
    const completedLessons = completedResult[0].completed;

    // Calculer la progression basée sur les leçons (90% max si évaluation finale existe)
    let progressFromLessons = Math.round((completedLessons / totalLessons) * 100);

    // Vérifier si une évaluation finale existe pour ce cours
    const finalEvaluationQuery = `
      SELECT id FROM course_evaluations 
      WHERE course_id = ? AND is_published = TRUE
      LIMIT 1
    `;
    const [finalEvaluations] = await pool.execute(finalEvaluationQuery, [enrollment.course_id]);
    const hasFinalEvaluation = finalEvaluations.length > 0;

    // Vérifier si l'évaluation finale est complétée (peu importe si réussie ou échouée)
    let finalEvaluationCompleted = false;
    if (hasFinalEvaluation) {
      const finalEvaluationId = finalEvaluations[0].id;
      // Vérifier via enrollment_id (prioritaire) ou user_id + course_id (fallback)
      const evaluationAttemptQuery = `
        SELECT COUNT(*) as completed_count
        FROM quiz_attempts
        WHERE course_evaluation_id = ? 
          AND (
            enrollment_id = ?
            OR (user_id = ? AND course_id = ?)
          )
          AND completed_at IS NOT NULL
      `;
      const [attemptResult] = await pool.execute(evaluationAttemptQuery, [
        finalEvaluationId,
        enrollmentId,
        enrollment.user_id,
        enrollment.course_id
      ]);
      finalEvaluationCompleted = attemptResult[0].completed_count > 0;
      
      console.log(`[ProgressService] 🔍 Vérification évaluation finale pour enrollment ${enrollmentId}:`, {
        finalEvaluationId,
        enrollmentId,
        userId: enrollment.user_id,
        courseId: enrollment.course_id,
        completedCount: attemptResult[0].completed_count,
        finalEvaluationCompleted
      });
    }

    // Calculer la progression finale
    let progressPercentage;
    if (hasFinalEvaluation) {
      // Si évaluation finale existe :
      // - Modules complétés = 90% max
      // - Évaluation finale complétée (réussie OU échouée) = 100%
      if (progressFromLessons >= 100) {
        // Tous les modules sont complétés
        if (finalEvaluationCompleted) {
          // Évaluation finale complétée (peu importe le résultat)
          progressPercentage = 100;
          console.log(`[ProgressService] ✅ Progression calculée à 100% (évaluation finale complétée) pour enrollment ${enrollmentId}`);
        } else {
          // Modules complétés mais évaluation finale pas encore complétée
          progressPercentage = 90;
          console.log(`[ProgressService] ⚠️ Progression limitée à 90% (évaluation finale non complétée) pour enrollment ${enrollmentId}`);
        }
      } else {
        // Pas tous les modules complétés
        progressPercentage = progressFromLessons;
        console.log(`[ProgressService] 📊 Progression basée sur les leçons: ${progressPercentage}% pour enrollment ${enrollmentId}`);
      }
    } else {
      // Pas d'évaluation finale, progression normale
      progressPercentage = progressFromLessons;
      console.log(`[ProgressService] 📊 Progression normale (pas d'évaluation finale): ${progressPercentage}% pour enrollment ${enrollmentId}`);
    }
    
    // Arrondir la progression finale
    progressPercentage = Math.round(progressPercentage);

    // Déterminer le statut
    let status = 'in_progress';
    let completedAt = null;

    if (progressPercentage === 100) {
      status = 'completed';
      completedAt = new Date();
      
      // Mettre à jour aussi completed_at dans enrollment si pas encore défini
      if (!enrollment.completed_at) {
        const updateQuery = `
          UPDATE enrollments
          SET status = 'completed',
              completed_at = NOW()
          WHERE id = ?
        `;
        await pool.execute(updateQuery, [enrollmentId]);

        // Vérifier et attribuer des badges lors de la complétion du cours
        try {
          const { checkAndAwardBadges } = require('../controllers/gamificationController');
          await checkAndAwardBadges(enrollment.user_id);
        } catch (badgeError) {
          console.error('Erreur lors de la vérification des badges:', badgeError);
          // Ne pas bloquer la complétion si la vérification des badges échoue
        }
      }
    }

    // Mettre à jour l'inscription
    const updateQuery = `
      UPDATE enrollments
      SET progress_percentage = ?,
          status = ?,
          completed_at = ?,
          started_at = COALESCE(started_at, NOW())
      WHERE id = ?
    `;
    await pool.execute(updateQuery, [
      progressPercentage,
      status,
      completedAt,
      enrollmentId
    ]);

    return {
      progress_percentage: progressPercentage,
      status,
      completed_lessons: completedLessons,
      total_lessons: totalLessons
    };
  }

  /**
   * Récupérer la progression d'un cours pour un utilisateur
   */
  static async getCourseProgress(courseId, userId) {
    // Récupérer l'inscription
    const enrollmentQuery = `
      SELECT * FROM enrollments
      WHERE user_id = ? AND course_id = ?
    `;
    const [enrollments] = await pool.execute(enrollmentQuery, [userId, courseId]);

    if (enrollments.length === 0) {
      return null;
    }

    return this.getProgressByEnrollment(enrollments[0].id);
  }

  /**
   * Récupérer la progression d'une leçon spécifique
   */
  static async getLessonProgress(lessonId, userId) {
    const query = `
      SELECT 
        p.*,
        e.course_id,
        l.title as lesson_title
      FROM progress p
      JOIN enrollments e ON p.enrollment_id = e.id
      JOIN lessons l ON p.lesson_id = l.id
      WHERE e.user_id = ? AND p.lesson_id = ?
      LIMIT 1
    `;

    const [progress] = await pool.execute(query, [userId, lessonId]);

    return progress.length > 0 ? progress[0] : null;
  }

  /**
   * Vérifier l'accès à une leçon (progression séquentielle)
   */
  static async checkLessonAccess(enrollmentId, lessonId) {
    const enrollmentQuery = 'SELECT * FROM enrollments WHERE id = ? AND is_active = TRUE';
    const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);
    
    if (enrollments.length === 0) {
      throw new Error('Inscription non trouvée ou inactive');
    }

    const enrollment = enrollments[0];

    // Récupérer le cours
    const [courses] = await pool.execute(
      'SELECT is_sequential FROM courses WHERE id = ?',
      [enrollment.course_id]
    );

    if (courses.length === 0) {
      throw new Error('Cours non trouvé');
    }

    const course = courses[0];

    // Si progression non séquentielle, autoriser l'accès
    if (!course.is_sequential) {
      return { hasAccess: true, reason: 'Progression non séquentielle' };
    }

    // Récupérer la leçon
    const [lessons] = await pool.execute(
      'SELECT id, module_id, order_index, is_optional FROM lessons WHERE id = ?',
      [lessonId]
    );

    if (lessons.length === 0) {
      throw new Error('Leçon non trouvée');
    }

    const lesson = lessons[0];

    const moduleId = lesson.module_id ?? lesson.moduleId ?? null;
    const lessonOrder = lesson.order_index ?? lesson.orderIndex ?? 0;
    const courseId = lesson.course_id ?? lesson.courseId ?? null;

    if (!moduleId) {
      return { hasAccess: true, reason: 'Leçon sans module' };
    }

    const [previousLessons] = await pool.execute(
      `SELECT l.id FROM lessons l
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.enrollment_id = ?
       WHERE l.module_id = ? AND l.is_published = TRUE AND l.is_optional = FALSE
         AND l.order_index < ?
       AND COALESCE(p.status, 'not_started') != 'completed'
       ORDER BY l.order_index`,
      [enrollmentId, moduleId, lessonOrder]
    );

    if (previousLessons.length > 0) {
      return {
        hasAccess: false,
        reason: 'Vous devez compléter les leçons précédentes',
        requiredLessonId: previousLessons[0].id,
      };
    }

    const [moduleOrder] = await pool.execute(
      'SELECT order_index FROM modules WHERE id = ?',
      [moduleId]
    );

    const moduleOrderIndex = moduleOrder[0]?.order_index ?? 0;

    if (moduleOrderIndex > 1) {
      const [previousModules] = await pool.execute(
        `SELECT id FROM modules WHERE course_id = ? AND order_index < ? ORDER BY order_index`,
        [courseId, moduleOrderIndex]
      );

      for (const moduleRow of previousModules) {
        const [moduleLessons] = await pool.execute(
          `SELECT l.id FROM lessons l
           WHERE l.module_id = ? AND l.is_published = TRUE AND l.is_optional = FALSE`,
          [moduleRow.id]
        );

        if (moduleLessons.length === 0) {
          continue;
        }

        const lessonIds = moduleLessons.map((item) => item.id);
        const [completedLessons] = await pool.execute(
          `SELECT lesson_id FROM progress WHERE enrollment_id = ? AND lesson_id IN (?) AND status = 'completed'`,
          [enrollmentId, lessonIds]
        );

        const completedLessonSet = new Set(completedLessons.map((row) => row.lesson_id));
        const missingLesson = lessonIds.find((id) => !completedLessonSet.has(id));

        if (missingLesson) {
          return {
            hasAccess: false,
            reason: 'Vous devez compléter le module précédent',
            requiredModuleId: moduleRow.id,
            requiredLessonId: missingLesson,
          };
        }
      }
    }

    return { hasAccess: true, reason: 'Accès autorisé' };
  }

  static async unlockNextLesson(enrollmentId, lessonId) {
    const [lessons] = await pool.execute(
      'SELECT module_id, order_index, course_id FROM lessons WHERE id = ?',
      [lessonId]
    );

    if (lessons.length === 0) return null;

    const lesson = lessons[0];

    const [nextLessons] = await pool.execute(
      `SELECT id FROM lessons 
       WHERE module_id = ? 
         AND order_index = ? + 1
         AND is_published = TRUE
       LIMIT 1`,
      [lesson.module_id, lesson.order_index]
    );

    if (nextLessons.length > 0) {
      return { unlockedLessonId: nextLessons[0].id };
    }

    const [currentModule] = await pool.execute(
      'SELECT order_index FROM modules WHERE id = ?',
      [lesson.module_id]
    );

    if (currentModule.length === 0) {
      return null;
    }

    const [nextModules] = await pool.execute(
      `SELECT id FROM modules 
       WHERE course_id = ? 
         AND order_index = ? + 1
       ORDER BY order_index
       LIMIT 1`,
      [lesson.course_id, currentModule[0].order_index]
    );

    if (nextModules.length === 0) {
      return null;
    }

    const [firstLessons] = await pool.execute(
      `SELECT id FROM lessons 
       WHERE module_id = ? 
         AND is_published = TRUE
       ORDER BY order_index
       LIMIT 1`,
      [nextModules[0].id]
    );

    if (firstLessons.length === 0) {
      return null;
    }

    return { unlockedLessonId: firstLessons[0].id };
  }
}

module.exports = ProgressService;

