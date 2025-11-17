const { pool } = require('../config/database');

/**
 * Service de synchronisation entre le suivi de progression et le calendrier
 */
class CalendarSyncService {
  /**
   * Générer le planning initial pour une inscription
   * @param {number} enrollmentId - ID de l'inscription
   * @param {number} courseId - ID du cours
   * @param {number} userId - ID de l'utilisateur
   * @returns {Promise<Object>} Résultat de la génération
   */
  static async generateSchedule(enrollmentId, courseId, userId) {
    try {
      console.log(`📅 [CALENDAR SYNC] Génération du planning pour enrollment ${enrollmentId}, cours ${courseId}`);

      // 1. Récupérer les informations du cours
      const [courses] = await pool.execute(
        'SELECT * FROM courses WHERE id = ?',
        [courseId]
      );
      if (courses.length === 0) {
        throw new Error('Cours non trouvé');
      }
      const course = courses[0];

      // 2. Récupérer les préférences de l'étudiant
      const [preferences] = await pool.execute(
        'SELECT preferences FROM student_preferences WHERE user_id = ?',
        [userId]
      );
      const userPreferences = preferences.length > 0 
        ? JSON.parse(preferences[0].preferences || '{}')
        : {};

      // 3. Récupérer la structure du cours (modules, leçons, quiz)
      const [modules] = await pool.execute(
        `SELECT m.*, 
         COUNT(DISTINCT l.id) as lesson_count,
         SUM(l.duration_minutes) as total_duration
         FROM modules m
         LEFT JOIN lessons l ON l.module_id = m.id AND l.is_published = TRUE
         WHERE m.course_id = ?
         GROUP BY m.id
         ORDER BY m.order_index ASC`,
        [courseId]
      );

      const [lessons] = await pool.execute(
        `SELECT l.*, m.order_index as module_order
         FROM lessons l
         LEFT JOIN modules m ON l.module_id = m.id
         WHERE l.course_id = ? AND l.is_published = TRUE
         ORDER BY COALESCE(m.order_index, 0), l.order_index ASC`,
        [courseId]
      );

      const [quizzes] = await pool.execute(
        `SELECT q.*, m.order_index as module_order, m.id as module_id
         FROM module_quizzes q
         JOIN modules m ON q.module_id = m.id
         WHERE m.course_id = ? AND q.is_published = TRUE
         ORDER BY m.order_index ASC, q.created_at ASC`,
        [courseId]
      );

      // 4. Calculer le planning optimal
      const schedule = this.calculateOptimalSchedule({
        course,
        modules,
        lessons,
        quizzes,
        userPreferences,
        enrollmentId
      });

      // 5. Créer les schedule_items
      const createdItems = [];
      for (const item of schedule) {
        const [result] = await pool.execute(
          `INSERT INTO course_schedule_items (
            enrollment_id, course_id, lesson_id, quiz_id, module_id,
            item_type, scheduled_date, estimated_duration_minutes,
            priority, status, auto_generated, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', TRUE, ?)`,
          [
            enrollmentId,
            courseId,
            item.lesson_id || null,
            item.quiz_id || null,
            item.module_id || null,
            item.type,
            item.scheduled_date,
            item.duration_minutes || 30,
            item.priority || 'medium',
            item.metadata ? JSON.stringify(item.metadata) : null
          ]
        );
        createdItems.push(result.insertId);

        // 6. Créer l'événement calendrier correspondant
        await this.createCalendarEventFromScheduleItem(result.insertId, userId);
      }

      console.log(`✅ [CALENDAR SYNC] Planning généré : ${createdItems.length} items créés`);

      return {
        success: true,
        itemsCreated: createdItems.length,
        scheduleItems: createdItems
      };
    } catch (error) {
      console.error('❌ [CALENDAR SYNC] Erreur lors de la génération du planning:', error);
      throw error;
    }
  }

  /**
   * Calculer le planning optimal basé sur les préférences et la structure du cours
   */
  static calculateOptimalSchedule({ course, modules, lessons, quizzes, userPreferences, enrollmentId }) {
    const schedule = [];
    const startDate = new Date();
    
    // Extraire les préférences
    const preferredStudyDays = userPreferences?.learning?.study_days || [1, 2, 3, 4, 5]; // Lun-Ven par défaut
    const preferredStudyTime = userPreferences?.learning?.preferred_time || '09:00';
    const dailyStudyMinutes = userPreferences?.learning?.daily_study_minutes || 60;
    const studyMode = userPreferences?.learning?.study_mode || 'regular'; // intensive, regular, extensive

    // Calculer la date de fin souhaitée
    const totalMinutes = lessons.reduce((sum, l) => sum + (l.duration_minutes || 30), 0);
    const totalDays = Math.ceil(totalMinutes / dailyStudyMinutes);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalDays * (studyMode === 'intensive' ? 1 : studyMode === 'extensive' ? 2 : 1.5));

    // Fonction pour obtenir le prochain jour d'étude valide
    const getNextStudyDay = (currentDate) => {
      let date = new Date(currentDate);
      while (!preferredStudyDays.includes(date.getDay() || 7)) {
        date.setDate(date.getDate() + 1);
      }
      return date;
    };

    // Distribuer les leçons
    let currentDate = getNextStudyDay(startDate);
    let dailyMinutesUsed = 0;

    for (const lesson of lessons) {
      const lessonDuration = lesson.duration_minutes || 30;

      // Si on dépasse le quota quotidien, passer au jour suivant
      if (dailyMinutesUsed + lessonDuration > dailyStudyMinutes) {
        currentDate = getNextStudyDay(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000));
        dailyMinutesUsed = 0;
      }

      // Créer l'item de planning
      const scheduledDateTime = new Date(currentDate);
      const [hours, minutes] = preferredStudyTime.split(':');
      scheduledDateTime.setHours(parseInt(hours) || 9, parseInt(minutes) || 0, 0, 0);

      schedule.push({
        type: 'lesson',
        lesson_id: lesson.id,
        module_id: lesson.module_id,
        scheduled_date: scheduledDateTime.toISOString().slice(0, 19).replace('T', ' '),
        duration_minutes: lessonDuration,
        priority: lesson.is_required ? 'high' : 'medium',
        metadata: {
          module_order: lesson.module_order || 0,
          lesson_order: lesson.order_index || 0
        }
      });

      dailyMinutesUsed += lessonDuration;
    }

    // Ajouter les quiz après chaque module
    for (const quiz of quizzes) {
      // Trouver la dernière leçon du module pour placer le quiz après
      const moduleLessons = lessons.filter(l => l.module_id === quiz.module_id);
      if (moduleLessons.length > 0) {
        const lastLesson = moduleLessons[moduleLessons.length - 1];
        const lastLessonItem = schedule.find(s => s.lesson_id === lastLesson.id);
        
        if (lastLessonItem) {
          const quizDate = new Date(lastLessonItem.scheduled_date);
          quizDate.setDate(quizDate.getDate() + 1); // Quiz le lendemain de la dernière leçon
          const scheduledDateTime = getNextStudyDay(quizDate);
          scheduledDateTime.setHours(parseInt(preferredStudyTime.split(':')[0]) || 9, 0, 0, 0);

          schedule.push({
            type: 'quiz',
            quiz_id: quiz.id,
            module_id: quiz.module_id,
            scheduled_date: scheduledDateTime.toISOString().slice(0, 19).replace('T', ' '),
            duration_minutes: quiz.time_limit_minutes || 20,
            priority: 'high',
            metadata: {
              module_order: quiz.module_order || 0,
              passing_score: quiz.passing_score || 70
            }
          });
        }
      }
    }

    // Ajouter des milestones (fin de module)
    for (const module of modules) {
      const moduleLessons = lessons.filter(l => l.module_id === module.id);
      if (moduleLessons.length > 0) {
        const lastLesson = moduleLessons[moduleLessons.length - 1];
        const lastLessonItem = schedule.find(s => s.lesson_id === lastLesson.id);
        
        if (lastLessonItem) {
          const milestoneDate = new Date(lastLessonItem.scheduled_date);
          milestoneDate.setDate(milestoneDate.getDate() + 1);

          schedule.push({
            type: 'milestone',
            module_id: module.id,
            scheduled_date: milestoneDate.toISOString().slice(0, 19).replace('T', ' '),
            duration_minutes: 0,
            priority: 'medium',
            metadata: {
              milestone_type: 'module_completion',
              module_title: module.title,
              module_order: module.order_index || 0
            }
          });
        }
      }
    }

    // Trier par date
    schedule.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

    return schedule;
  }

  /**
   * Créer un événement calendrier depuis un schedule_item
   */
  static async createCalendarEventFromScheduleItem(scheduleItemId, userId) {
    try {
      const [items] = await pool.execute(
        `SELECT csi.*, 
         l.title as lesson_title,
         q.title as quiz_title,
         m.title as module_title,
         c.title as course_title
         FROM course_schedule_items csi
         JOIN courses c ON csi.course_id = c.id
         LEFT JOIN lessons l ON csi.lesson_id = l.id
         LEFT JOIN quizzes q ON csi.quiz_id = q.id
         LEFT JOIN modules m ON csi.module_id = m.id
         WHERE csi.id = ?`,
        [scheduleItemId]
      );

      if (items.length === 0) return null;

      const item = items[0];
      let title = '';
      let description = '';

      switch (item.item_type) {
        case 'lesson':
          title = `📚 ${item.lesson_title || 'Leçon'}`;
          description = `Session d'apprentissage : ${item.lesson_title}\nDurée estimée : ${item.estimated_duration_minutes} minutes`;
          break;
        case 'quiz':
          title = `📝 Quiz : ${item.quiz_title || 'Quiz'}`;
          description = `Quiz à passer : ${item.quiz_title}\nDurée : ${item.estimated_duration_minutes} minutes`;
          break;
        case 'milestone':
          const metadata = item.metadata ? JSON.parse(item.metadata) : {};
          title = `🎯 ${metadata.milestone_type === 'module_completion' ? 'Module terminé' : 'Milestone'}`;
          description = metadata.module_title 
            ? `Félicitations ! Vous avez terminé le module "${metadata.module_title}"`
            : 'Milestone atteint';
          break;
        case 'deadline':
          title = `⏰ Deadline : ${item.course_title}`;
          description = 'Date limite pour compléter cette étape';
          break;
        case 'reminder':
          title = `🔔 Rappel`;
          description = item.metadata ? JSON.parse(item.metadata).message : 'Rappel';
          break;
      }

      const endDate = new Date(item.scheduled_date);
      endDate.setMinutes(endDate.getMinutes() + item.estimated_duration_minutes);

      const [result] = await pool.execute(
        `INSERT INTO events (
          title, description, event_type, start_date, end_date,
          course_id, created_by, is_public, schedule_item_id, auto_sync
        ) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, ?, TRUE)`,
        [
          title,
          description,
          item.item_type === 'lesson' ? 'course_start' : 
          item.item_type === 'quiz' ? 'quiz_scheduled' : 'announcement',
          item.scheduled_date,
          endDate.toISOString().slice(0, 19).replace('T', ' '),
          item.course_id,
          userId,
          scheduleItemId
        ]
      );

      return result.insertId;
    } catch (error) {
      console.error('❌ [CALENDAR SYNC] Erreur lors de la création de l\'événement:', error);
      return null;
    }
  }

  /**
   * Synchroniser la progression vers le calendrier
   */
  static async syncProgressToCalendar({ type, lessonId, quizId, enrollmentId, completedAt, moduleId = null }) {
    try {
      console.log(`📅 [CALENDAR SYNC] Synchronisation progression → calendrier (type: ${type})`);

      // Trouver le schedule_item correspondant
      let scheduleItem = null;
      
      if (type === 'lesson_completed' && lessonId) {
        const [items] = await pool.execute(
          'SELECT * FROM course_schedule_items WHERE enrollment_id = ? AND lesson_id = ? AND status != "completed"',
          [enrollmentId, lessonId]
        );
        scheduleItem = items[0] || null;
      } else if (type === 'quiz_completed' && quizId) {
        const [items] = await pool.execute(
          'SELECT * FROM course_schedule_items WHERE enrollment_id = ? AND quiz_id = ? AND status != "completed"',
          [enrollmentId, quizId]
        );
        scheduleItem = items[0] || null;
      }

      if (!scheduleItem) {
        console.log(`⚠️ [CALENDAR SYNC] Aucun schedule_item trouvé pour ${type}`);
        return null;
      }

      // Mettre à jour le schedule_item
      await pool.execute(
        `UPDATE course_schedule_items 
         SET status = 'completed', completed_at = ?, updated_at = NOW()
         WHERE id = ?`,
        [completedAt || new Date(), scheduleItem.id]
      );

      // Mettre à jour l'événement calendrier correspondant
      if (scheduleItem.id) {
        const [events] = await pool.execute(
          'SELECT id FROM events WHERE schedule_item_id = ?',
          [scheduleItem.id]
        );
        
        if (events.length > 0) {
          // Marquer l'événement comme complété (on peut ajouter un champ ou utiliser metadata)
          await pool.execute(
            `UPDATE events 
             SET description = CONCAT(description, '\n✅ Complété le ', DATE_FORMAT(?, '%d/%m/%Y à %H:%i'))
             WHERE id = ?`,
            [completedAt || new Date(), events[0].id]
          );
        }
      }

      // Vérifier si un module est terminé et créer un milestone
      if (moduleId) {
        await this.checkAndCreateModuleMilestone(enrollmentId, moduleId);
      }

      // Vérifier si on est en avance et ajuster le planning
      await this.adjustScheduleIfAhead(enrollmentId);

      console.log(`✅ [CALENDAR SYNC] Progression synchronisée avec le calendrier`);
      return scheduleItem.id;
    } catch (error) {
      console.error('❌ [CALENDAR SYNC] Erreur lors de la synchronisation:', error);
      return null;
    }
  }

  /**
   * Vérifier et créer un milestone de module terminé
   */
  static async checkAndCreateModuleMilestone(enrollmentId, moduleId) {
    try {
      // Vérifier si toutes les leçons du module sont complétées
      const [enrollment] = await pool.execute(
        'SELECT course_id FROM enrollments WHERE id = ?',
        [enrollmentId]
      );
      if (enrollment.length === 0) return;

      const [stats] = await pool.execute(
        `SELECT 
          COUNT(l.id) as total,
          COUNT(CASE WHEN csi.status = 'completed' THEN 1 END) as completed
         FROM lessons l
         LEFT JOIN course_schedule_items csi ON csi.lesson_id = l.id AND csi.enrollment_id = ?
         WHERE l.module_id = ? AND l.is_published = TRUE`,
        [enrollmentId, moduleId]
      );

      if (stats[0].total > 0 && stats[0].completed >= stats[0].total) {
        // Vérifier si le milestone existe déjà
        const [existing] = await pool.execute(
          `SELECT id FROM course_schedule_items 
           WHERE enrollment_id = ? AND module_id = ? AND item_type = 'milestone'`,
          [enrollmentId, moduleId]
        );

        if (existing.length === 0) {
          // Créer le milestone
          const [module] = await pool.execute('SELECT * FROM modules WHERE id = ?', [moduleId]);
          const [result] = await pool.execute(
            `INSERT INTO course_schedule_items (
              enrollment_id, course_id, module_id, item_type,
              scheduled_date, priority, status, auto_generated, metadata
            ) VALUES (?, ?, ?, 'milestone', NOW(), 'medium', 'completed', TRUE, ?)`,
            [
              enrollmentId,
              enrollment[0].course_id,
              moduleId,
              JSON.stringify({
                milestone_type: 'module_completion',
                module_title: module[0]?.title || 'Module',
                auto_created: true
              })
            ]
          );

          // Créer l'événement calendrier
          const [user] = await pool.execute(
            'SELECT user_id FROM enrollments WHERE id = ?',
            [enrollmentId]
          );
          if (user.length > 0) {
            await this.createCalendarEventFromScheduleItem(result.insertId, user[0].user_id);
          }
        }
      }
    } catch (error) {
      console.error('❌ [CALENDAR SYNC] Erreur lors de la vérification du milestone:', error);
    }
  }

  /**
   * Ajuster le planning si l'étudiant est en avance
   */
  static async adjustScheduleIfAhead(enrollmentId) {
    try {
      // Trouver les items pending qui sont dans le futur mais dont les prérequis sont complétés
      const [pendingItems] = await pool.execute(
        `SELECT csi.* 
         FROM course_schedule_items csi
         WHERE csi.enrollment_id = ? 
         AND csi.status = 'pending'
         AND csi.scheduled_date > NOW()
         ORDER BY csi.scheduled_date ASC
         LIMIT 5`,
        [enrollmentId]
      );

      // Si l'étudiant a complété des items récents, on peut suggérer d'avancer les suivants
      // (Cette logique peut être étendue selon les besoins)
      
    } catch (error) {
      console.error('❌ [CALENDAR SYNC] Erreur lors de l\'ajustement:', error);
    }
  }

  /**
   * Synchroniser les modifications du calendrier vers la progression
   */
  static async syncCalendarToProgress(eventId, updates) {
    try {
      console.log(`📅 [CALENDAR SYNC] Synchronisation calendrier → progression (event: ${eventId})`);

      // Récupérer l'événement et son schedule_item
      const [events] = await pool.execute(
        'SELECT * FROM events WHERE id = ? AND schedule_item_id IS NOT NULL',
        [eventId]
      );

      if (events.length === 0) {
        console.log(`⚠️ [CALENDAR SYNC] Événement ${eventId} n'a pas de schedule_item associé`);
        return null;
      }

      const event = events[0];

      // Mettre à jour le schedule_item
      if (updates.newDate) {
        await pool.execute(
          `UPDATE course_schedule_items 
           SET scheduled_date = ?, updated_at = NOW()
           WHERE id = ?`,
          [updates.newDate, event.schedule_item_id]
        );

        // Recalculer les dates suivantes si nécessaire
        await this.recalculateFollowingItems(event.schedule_item_id, updates.newDate);
      }

      if (updates.newStatus) {
        await pool.execute(
          `UPDATE course_schedule_items 
           SET status = ?, updated_at = NOW()
           WHERE id = ?`,
          [updates.newStatus, event.schedule_item_id]
        );
      }

      console.log(`✅ [CALENDAR SYNC] Calendrier synchronisé avec la progression`);
      return event.schedule_item_id;
    } catch (error) {
      console.error('❌ [CALENDAR SYNC] Erreur lors de la synchronisation calendrier → progression:', error);
      return null;
    }
  }

  /**
   * Recalculer les dates des items suivants
   */
  static async recalculateFollowingItems(scheduleItemId, newDate) {
    try {
      // Récupérer l'item modifié
      const [items] = await pool.execute(
        'SELECT * FROM course_schedule_items WHERE id = ?',
        [scheduleItemId]
      );
      if (items.length === 0) return;

      const modifiedItem = items[0];

      // Récupérer les items suivants du même enrollment
      const [followingItems] = await pool.execute(
        `SELECT * FROM course_schedule_items 
         WHERE enrollment_id = ? 
         AND scheduled_date > ?
         AND status = 'pending'
         ORDER BY scheduled_date ASC`,
        [modifiedItem.enrollment_id, modifiedItem.scheduled_date]
      );

      // Ajuster les dates si nécessaire (maintenir les intervalles)
      // Cette logique peut être personnalisée selon les besoins
      
    } catch (error) {
      console.error('❌ [CALENDAR SYNC] Erreur lors du recalcul:', error);
    }
  }

  /**
   * Récupérer le planning d'un étudiant pour un cours
   */
  static async getStudentSchedule(enrollmentId) {
    try {
      const [items] = await pool.execute(
        `SELECT csi.*,
         l.title as lesson_title,
         q.title as quiz_title,
         m.title as module_title,
         e.id as event_id,
         e.title as event_title
         FROM course_schedule_items csi
         LEFT JOIN lessons l ON csi.lesson_id = l.id
         LEFT JOIN quizzes q ON csi.quiz_id = q.id
         LEFT JOIN modules m ON csi.module_id = m.id
         LEFT JOIN events e ON e.schedule_item_id = csi.id
         WHERE csi.enrollment_id = ?
         ORDER BY csi.scheduled_date ASC`,
        [enrollmentId]
      );

      return items.map(item => ({
        id: item.id,
        type: item.item_type,
        title: item.lesson_title || item.quiz_title || item.module_title || 'Élément',
        scheduled_date: item.scheduled_date,
        duration_minutes: item.estimated_duration_minutes,
        priority: item.priority,
        status: item.status,
        completed_at: item.completed_at,
        event_id: item.event_id,
        lesson_id: item.lesson_id,
        quiz_id: item.quiz_id,
        module_id: item.module_id,
        metadata: item.metadata ? JSON.parse(item.metadata) : null
      }));
    } catch (error) {
      console.error('❌ [CALENDAR SYNC] Erreur lors de la récupération du planning:', error);
      throw error;
    }
  }

  /**
   * Détecter et marquer les items en retard
   */
  static async markOverdueItems(enrollmentId) {
    try {
      const [result] = await pool.execute(
        `UPDATE course_schedule_items 
         SET status = 'overdue', updated_at = NOW()
         WHERE enrollment_id = ?
         AND status = 'pending'
         AND scheduled_date < NOW()`,
        [enrollmentId]
      );

      // Créer des notifications pour les items en retard
      if (result.affectedRows > 0) {
        const [enrollment] = await pool.execute(
          'SELECT user_id, course_id FROM enrollments WHERE id = ?',
          [enrollmentId]
        );
        
        if (enrollment.length > 0) {
          const [course] = await pool.execute('SELECT title FROM courses WHERE id = ?', [enrollment[0].course_id]);
          
          await pool.execute(
            `INSERT INTO notifications (user_id, title, message, type, action_url, metadata)
             VALUES (?, ?, ?, 'warning', ?, ?)`,
            [
              enrollment[0].user_id,
              '⏰ Éléments en retard',
              `Vous avez ${result.affectedRows} élément(s) en retard dans le cours "${course[0]?.title || 'votre cours'}".`,
              `/learn/${enrollment[0].course_id}`,
              JSON.stringify({
                enrollment_id: enrollmentId,
                course_id: enrollment[0].course_id,
                overdue_count: result.affectedRows
              })
            ]
          );
        }
      }

      return result.affectedRows;
    } catch (error) {
      console.error('❌ [CALENDAR SYNC] Erreur lors du marquage des items en retard:', error);
      return 0;
    }
  }
}

module.exports = CalendarSyncService;

