const { pool } = require('../config/database');

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

    // Récupérer la progression des leçons
    const progressQuery = `
      SELECT 
        p.*,
        l.id as lesson_id,
        l.title as lesson_title,
        l.module_id,
        l.content_type,
        l.duration_minutes,
        l.order_index as lesson_order,
        m.title as module_title,
        m.order_index as module_order
      FROM progress p
      JOIN lessons l ON p.lesson_id = l.id
      LEFT JOIN modules m ON l.module_id = m.id
      WHERE p.enrollment_id = ?
      ORDER BY COALESCE(m.order_index, 0), l.order_index
    `;

    const [progress] = await pool.execute(progressQuery, [enrollmentId]);

    // Récupérer les modules et leur statut
    const modulesQuery = `
      SELECT 
        m.*,
        COUNT(l.id) as total_lessons,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_lessons
      FROM modules m
      LEFT JOIN lessons l ON m.id = l.module_id AND l.is_published = TRUE
      LEFT JOIN progress p ON l.id = p.lesson_id AND p.enrollment_id = ?
      WHERE m.course_id = ?
      GROUP BY m.id
      ORDER BY m.order_index
    `;

    const [modules] = await pool.execute(modulesQuery, [enrollmentId, enrollment.course_id]);

    return {
      enrollment,
      progress,
      modules,
      summary: {
        total_lessons: progress.length,
        completed_lessons: progress.filter(p => p.status === 'completed').length,
        in_progress: progress.filter(p => p.status === 'in_progress').length,
        not_started: progress.filter(p => p.status === 'not_started').length
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

    // Vérifier que la leçon appartient au cours
    const lessonQuery = 'SELECT id, course_id FROM lessons WHERE id = ?';
    const [lessons] = await pool.execute(lessonQuery, [lessonId]);
    
    if (lessons.length === 0) {
      throw new Error('Leçon non trouvée');
    }

    if (lessons[0].course_id !== enrollment.course_id) {
      throw new Error('La leçon n\'appartient pas à ce cours');
    }

    // Vérifier si la progression existe
    const existingQuery = 'SELECT id FROM progress WHERE enrollment_id = ? AND lesson_id = ?';
    const [existing] = await pool.execute(existingQuery, [enrollmentId, lessonId]);

    let progressId;
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
      await pool.execute(updateQuery, [timeSpent, enrollmentId, lessonId]);
      progressId = existing[0].id;
    } else {
      // Créer
      const insertQuery = `
        INSERT INTO progress (
          enrollment_id, lesson_id, status, completion_percentage, 
          time_spent, completed_at
        ) VALUES (?, ?, 'completed', 100, ?, NOW())
      `;
      const [result] = await pool.execute(insertQuery, [enrollmentId, lessonId, timeSpent]);
      progressId = result.insertId;
    }

    // Mettre à jour aussi lesson_progress pour compatibilité
    const lessonProgressQuery = `
      INSERT INTO lesson_progress (
        user_id, lesson_id, course_id, is_completed, 
        completed_at, time_spent_minutes, updated_at
      ) VALUES (?, ?, ?, TRUE, NOW(), ?, NOW())
      ON DUPLICATE KEY UPDATE
        is_completed = TRUE,
        completed_at = NOW(),
        time_spent_minutes = time_spent_minutes + ?,
        updated_at = NOW()
    `;
    
    await pool.execute(lessonProgressQuery, [
      enrollment.user_id,
      lessonId,
      enrollment.course_id,
      Math.floor(timeSpent / 60),
      Math.floor(timeSpent / 60)
    ]);

    // Recalculer la progression globale du cours
    await this.updateCourseProgress(enrollmentId);

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

    const existingQuery = 'SELECT id FROM progress WHERE enrollment_id = ? AND lesson_id = ?';
    const [existing] = await pool.execute(existingQuery, [enrollmentId, lessonId]);

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
      await pool.execute(updateQuery, [
        status, completionPercentage, timeSpent, completionPercentage,
        enrollmentId, lessonId
      ]);
    } else {
      const insertQuery = `
        INSERT INTO progress (
          enrollment_id, lesson_id, status, completion_percentage, 
          time_spent, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      await pool.execute(insertQuery, [
        enrollmentId,
        lessonId,
        status,
        completionPercentage,
        timeSpent,
        completionPercentage === 100 ? new Date() : null
      ]);
    }

    // Recalculer la progression globale
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

    const progressPercentage = Math.round((completedLessons / totalLessons) * 100);

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
    const enrollmentQuery = 'SELECT * FROM enrollments WHERE id = ?';
    const [enrollments] = await pool.execute(enrollmentQuery, [enrollmentId]);
    
    if (enrollments.length === 0) {
      throw new Error('Inscription non trouvée');
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

    const [previousLessons] = await pool.execute(
      `SELECT l.id FROM lessons l
       LEFT JOIN progress p ON p.lesson_id = l.id AND p.enrollment_id = ?
       WHERE l.module_id = ? AND l.is_published = TRUE AND l.is_optional = FALSE
         AND l.order_index < ?
       AND COALESCE(p.status, 'not_started') != 'completed'
       ORDER BY l.order_index`,
      [enrollmentId, lesson.module_id, lesson.order_index]
    );

    if (previousLessons.length > 0) {
      return {
        hasAccess: false,
        reason: 'Vous devez compléter les leçons précédentes',
        requiredLessonId: previousLessons[0].id,
      };
    }

    if (!lesson.module_id) {
      return { hasAccess: true, reason: 'Leçon sans module' };
    }

    const [moduleOrder] = await pool.execute(
      'SELECT order_index FROM modules WHERE id = ?',
      [lesson.module_id]
    );

    const moduleOrderIndex = moduleOrder[0]?.order_index ?? 0;

    if (moduleOrderIndex > 1) {
      const [previousModules] = await pool.execute(
        `SELECT id FROM modules WHERE course_id = ? AND order_index < ? ORDER BY order_index`,
        [lesson.course_id, moduleOrderIndex]
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

