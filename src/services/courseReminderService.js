const { pool } = require('../config/database');
const emailService = require('./emailService');

/**
 * Service de rappel par email pour les étudiants avec des cours en progression
 */
class CourseReminderService {
  // Périodes de rappel en jours (après la dernière activité)
  static REMINDER_PERIODS = [3, 7, 14]; // 3 jours, 7 jours, 14 jours

  /**
   * Récupère les étudiants avec des cours en progression inactifs
   * @param {number} daysInactive - Nombre de jours d'inactivité
   * @param {boolean} isRecurring - Si true, cherche les multiples de 14 jours après le premier rappel à 14 jours
   * @returns {Promise<Array>} Liste des enrollments à rappeler
   */
  static async getInactiveProgressEnrollments(daysInactive, isRecurring = false) {
    if (isRecurring) {
      // Pour les rappels répétitifs après 14 jours, chercher les enrollments qui :
      // 1. Ont déjà reçu au moins un rappel à 14 jours
      // 2. Ont >= 28 jours d'inactivité (14 jours après le premier rappel à 14 jours)
      // 3. Sont à un multiple de 14 jours depuis le dernier rappel à 14 jours
      const query = `
        SELECT 
          e.id as enrollment_id,
          e.user_id,
          e.course_id,
          e.progress_percentage,
          e.last_accessed_at,
          e.enrolled_at,
          u.email,
          u.first_name,
          u.last_name,
          c.title as course_title,
          c.instructor_id,
          DATEDIFF(NOW(), COALESCE(e.last_accessed_at, e.enrolled_at)) as days_since_last_access,
          MAX(crl.sent_at) as last_reminder_sent_at
        FROM enrollments e
        INNER JOIN users u ON e.user_id = u.id
        INNER JOIN courses c ON e.course_id = c.id
        LEFT JOIN course_reminder_logs crl ON e.id = crl.enrollment_id AND crl.reminder_days = 14 AND crl.success = 1
        WHERE 
          e.is_active = TRUE
          AND e.completed_at IS NULL
          AND e.progress_percentage > 0
          AND e.progress_percentage < 100
          AND DATEDIFF(NOW(), COALESCE(e.last_accessed_at, e.enrolled_at)) >= 28
          AND crl.sent_at IS NOT NULL
          AND DATEDIFF(NOW(), crl.sent_at) >= 14
          AND MOD(DATEDIFF(NOW(), crl.sent_at), 14) = 0
          AND u.is_active = TRUE
          AND u.is_email_verified = TRUE
        GROUP BY e.id, e.user_id, e.course_id, e.progress_percentage, e.last_accessed_at, e.enrolled_at,
                 u.email, u.first_name, u.last_name, c.title, c.instructor_id
        ORDER BY e.last_accessed_at ASC, e.enrolled_at ASC
      `;

      const [enrollments] = await pool.execute(query);
      return enrollments;
    } else {
      // Pour les rappels normaux (3 et 7 jours), chercher exactement ce nombre de jours
      const query = `
        SELECT 
          e.id as enrollment_id,
          e.user_id,
          e.course_id,
          e.progress_percentage,
          e.last_accessed_at,
          e.enrolled_at,
          u.email,
          u.first_name,
          u.last_name,
          c.title as course_title,
          c.instructor_id,
          DATEDIFF(NOW(), COALESCE(e.last_accessed_at, e.enrolled_at)) as days_since_last_access
        FROM enrollments e
        INNER JOIN users u ON e.user_id = u.id
        INNER JOIN courses c ON e.course_id = c.id
        WHERE 
          e.is_active = TRUE
          AND e.completed_at IS NULL
          AND e.progress_percentage > 0
          AND e.progress_percentage < 100
          AND DATEDIFF(NOW(), COALESCE(e.last_accessed_at, e.enrolled_at)) = ?
          AND u.is_active = TRUE
          AND u.is_email_verified = TRUE
        ORDER BY e.last_accessed_at ASC, e.enrolled_at ASC
      `;

      const [enrollments] = await pool.execute(query, [daysInactive]);
      return enrollments;
    }
  }

  /**
   * Vérifie si un rappel a déjà été envoyé pour cet enrollment à cette période
   * @param {number} enrollmentId - ID de l'enrollment
   * @param {number} daysInactive - Nombre de jours d'inactivité
   * @param {boolean} isRecurring - Si c'est un rappel répétitif (après 14 jours)
   * @returns {Promise<boolean>} True si un rappel a déjà été envoyé récemment
   */
  static async hasReminderBeenSent(enrollmentId, daysInactive, isRecurring = false) {
    // Créer la table si elle n'existe pas
    await this.ensureReminderLogTable();

    if (isRecurring) {
      // Pour les rappels répétitifs (après le premier rappel à 14 jours)
      // Vérifier le dernier rappel de 14 jours et s'assurer qu'au moins 14 jours se sont écoulés
      const query = `
        SELECT sent_at FROM course_reminder_logs
        WHERE enrollment_id = ? AND reminder_days = 14 AND success = 1
        ORDER BY sent_at DESC
        LIMIT 1
      `;
      const [results] = await pool.execute(query, [enrollmentId]);
      
      if (results.length > 0) {
        const lastSent = new Date(results[0].sent_at);
        const daysSinceLastSent = Math.floor((Date.now() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
        // Si moins de 14 jours se sont écoulés depuis le dernier rappel, ne pas renvoyer
        // Si exactement 14 jours ou un multiple de 14, on peut renvoyer
        return daysSinceLastSent < 14 || daysSinceLastSent % 14 !== 0;
      }
      // Si aucun rappel de 14 jours n'a été envoyé, on ne doit pas envoyer de rappel répétitif
      // (le premier rappel à 14 jours est géré par la période normale)
      return true;
    } else {
      // Pour les rappels normaux (3 et 7 jours), vérifier les 24 dernières heures
      // Pour le premier rappel à 14 jours, vérifier aussi les 24 dernières heures
      const query = `
        SELECT id FROM course_reminder_logs
        WHERE enrollment_id = ? AND reminder_days = ? AND sent_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        LIMIT 1
      `;
      const [results] = await pool.execute(query, [enrollmentId, daysInactive]);
      return results.length > 0;
    }
  }

  /**
   * Enregistre qu'un rappel a été envoyé
   * @param {number} enrollmentId - ID de l'enrollment
   * @param {number} daysInactive - Nombre de jours d'inactivité
   * @param {boolean} success - Si l'envoi a réussi
   */
  static async logReminderSent(enrollmentId, daysInactive, success = true) {
    await this.ensureReminderLogTable();

    const query = `
      INSERT INTO course_reminder_logs (enrollment_id, reminder_days, sent_at, success)
      VALUES (?, ?, NOW(), ?)
    `;

    await pool.execute(query, [enrollmentId, daysInactive, success ? 1 : 0]);
  }

  /**
   * Crée la table de logs des rappels si elle n'existe pas
   */
  static async ensureReminderLogTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS course_reminder_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enrollment_id INT NOT NULL,
        reminder_days INT NOT NULL,
        sent_at DATETIME NOT NULL,
        success TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_enrollment (enrollment_id),
        INDEX idx_sent_at (sent_at),
        INDEX idx_reminder_days (reminder_days),
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;

    try {
      await pool.execute(createTableQuery);
    } catch (error) {
      // Table existe peut-être déjà, ignorer l'erreur
      if (!error.message.includes('already exists')) {
        console.error('Erreur lors de la création de la table course_reminder_logs:', error);
      }
    }
  }

  /**
   * Génère le template HTML pour l'email de rappel
   */
  static getReminderEmailTemplate(firstName, courseTitle, progressPercentage, daysInactive, courseUrl) {
    const progressBar = Math.round(progressPercentage);
    const progressColor = progressPercentage < 30 ? '#f59e0b' : progressPercentage < 70 ? '#3b82f6' : '#10b981';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Open Sans', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #006599 0%, #3B7C8A 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
          .progress-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .progress-bar-container { background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden; margin: 10px 0; }
          .progress-bar { height: 100%; background: ${progressColor}; transition: width 0.3s ease; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; }
          .button { display: inline-block; padding: 15px 30px; background: #006599; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; transition: all .2s ease; }
          .button:hover { background: #3B7C8A !important; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .highlight { color: #006599; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📚 Maison de la Société Civile</h1>
            <p>Rappel de cours</p>
          </div>
          <div class="content">
            <h2>Bonjour ${firstName},</h2>
            <p>Nous avons remarqué que vous avez commencé le cours <span class="highlight">"${courseTitle}"</span> mais que vous ne l'avez pas terminé.</p>
            
            <div class="progress-section">
              <p style="margin: 0 0 10px 0; font-weight: bold;">Votre progression actuelle :</p>
              <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progressBar}%;">
                  ${progressBar}%
                </div>
              </div>
              <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                Il vous reste ${100 - progressBar}% à compléter pour obtenir votre certificat !
              </p>
            </div>

            <p>Vous n'avez pas accédé à ce cours depuis <span class="highlight">${daysInactive} jour${daysInactive > 1 ? 's' : ''}</span>.</p>
            
            <p>Ne laissez pas votre apprentissage s'arrêter ! Reprenez votre formation dès maintenant :</p>
            
            <div style="text-align: center;">
              <a href="${courseUrl}" class="button">Continuer mon cours</a>
            </div>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #666;">
              💡 <strong>Astuce :</strong> Consacrez 15 minutes par jour à votre formation pour progresser régulièrement.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Maison de la Société Civile. Tous droits réservés.</p>
            <p>Crédibilité, Innovation, Engagement</p>
            <p style="font-size: 11px; color: #999; margin-top: 10px;">
              Vous recevez cet email car vous avez un cours en progression. 
              <a href="#" style="color: #006599;">Gérer mes préférences</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Envoie un rappel pour un enrollment spécifique
   * @param {Object} enrollment - Données de l'enrollment
   * @param {number} daysInactive - Nombre de jours d'inactivité
   * @param {boolean} isRecurring - Si c'est un rappel répétitif (14 jours)
   * @returns {Promise<boolean>} True si l'envoi a réussi
   */
  static async sendReminderForEnrollment(enrollment, daysInactive, isRecurring = false) {
    try {
      // Vérifier si un rappel a déjà été envoyé récemment
      const alreadySent = await this.hasReminderBeenSent(enrollment.enrollment_id, daysInactive, isRecurring);
      if (alreadySent) {
        console.log(`⏭️  Rappel déjà envoyé pour enrollment ${enrollment.enrollment_id} (${daysInactive} jours)`);
        return false;
      }

      // Construire l'URL du cours
      const baseUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
      const courseUrl = `${baseUrl}/learn/${enrollment.course_id}`;

      // Générer le template d'email
      const emailHtml = this.getReminderEmailTemplate(
        enrollment.first_name || 'Étudiant',
        enrollment.course_title,
        enrollment.progress_percentage,
        daysInactive,
        courseUrl
      );

      const subject = `📚 Rappel : Continuez votre formation "${enrollment.course_title}"`;

      // Envoyer l'email
      await emailService.sendEmail({
        to: enrollment.email,
        subject: subject,
        html: emailHtml,
      });

      // Enregistrer le rappel
      // Pour les rappels répétitifs, toujours enregistrer avec reminder_days = 14
      // même si le nombre réel de jours est 28, 42, etc.
      const reminderDaysToLog = isRecurring ? 14 : daysInactive;
      await this.logReminderSent(enrollment.enrollment_id, reminderDaysToLog, true);

      const daysLabel = isRecurring 
        ? `${daysInactive} jours (rappel répétitif)` 
        : `${daysInactive} jours`;
      console.log(`✅ Rappel envoyé à ${enrollment.email} pour le cours "${enrollment.course_title}" (${daysLabel} d'inactivité)`);
      return true;
    } catch (error) {
      console.error(`❌ Erreur lors de l'envoi du rappel pour enrollment ${enrollment.enrollment_id}:`, error);
      
      // Enregistrer l'échec
      try {
        const reminderDaysToLog = isRecurring ? 14 : daysInactive;
        await this.logReminderSent(enrollment.enrollment_id, reminderDaysToLog, false);
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de l\'échec:', logError);
      }

      return false;
    }
  }

  /**
   * Envoie les rappels pour une période spécifique
   * @param {number} daysInactive - Nombre de jours d'inactivité
   * @param {boolean} forceRecurring - Forcer le mode répétitif (pour les rappels après 14 jours)
   * @returns {Promise<Object>} Statistiques d'envoi
   */
  static async sendRemindersForPeriod(daysInactive, forceRecurring = false) {
    // Pour 14 jours, utiliser la logique normale (premier rappel)
    // Les rappels répétitifs sont gérés séparément
    const isRecurring = forceRecurring;
    const enrollments = await this.getInactiveProgressEnrollments(daysInactive, isRecurring);
    
    const periodLabel = isRecurring 
      ? `${daysInactive} jours (répétitif - multiples de ${daysInactive})` 
      : `${daysInactive} jours`;
    
    console.log(`📧 Envoi de rappels pour ${periodLabel} : ${enrollments.length} enrollment(s) trouvé(s)`);

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const enrollment of enrollments) {
      // Utiliser days_since_last_access pour les rappels répétitifs
      const actualDays = isRecurring ? enrollment.days_since_last_access : daysInactive;
      const sent = await this.sendReminderForEnrollment(enrollment, actualDays, isRecurring);
      if (sent) {
        successCount++;
      } else {
        // Vérifier si c'était un skip (déjà envoyé) ou une erreur
        const alreadySent = await this.hasReminderBeenSent(enrollment.enrollment_id, actualDays, isRecurring);
        if (alreadySent) {
          skippedCount++;
        } else {
          failureCount++;
        }
      }

      // Petite pause pour éviter de surcharger le serveur email
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      period: daysInactive,
      isRecurring: isRecurring,
      total: enrollments.length,
      success: successCount,
      failure: failureCount,
      skipped: skippedCount
    };
  }

  /**
   * Envoie tous les rappels pour toutes les périodes configurées
   * @returns {Promise<Object>} Statistiques globales
   */
  static async sendAllReminders() {
    console.log('🚀 Démarrage du processus de rappel des cours en progression...');
    
    // S'assurer que la table de logs existe
    await this.ensureReminderLogTable();

    const allStats = {
      totalEnrollments: 0,
      totalSuccess: 0,
      totalFailure: 0,
      totalSkipped: 0,
      periods: []
    };

    // Envoyer les rappels normaux (3, 7, 14 jours - premier rappel)
    for (const days of this.REMINDER_PERIODS) {
      const stats = await this.sendRemindersForPeriod(days);
      allStats.periods.push(stats);
      allStats.totalEnrollments += stats.total;
      allStats.totalSuccess += stats.success;
      allStats.totalFailure += stats.failure;
      allStats.totalSkipped += stats.skipped;
    }

    // Envoyer les rappels répétitifs (tous les 14 jours après le premier rappel à 14 jours)
    console.log('\n🔄 Envoi des rappels répétitifs (tous les 14 jours après le premier rappel)...');
    const recurringStats = await this.sendRemindersForPeriod(14, true);
    allStats.periods.push({
      period: '14+ (répétitif)',
      isRecurring: true,
      total: recurringStats.total,
      success: recurringStats.success,
      failure: recurringStats.failure,
      skipped: recurringStats.skipped
    });
    allStats.totalEnrollments += recurringStats.total;
    allStats.totalSuccess += recurringStats.success;
    allStats.totalFailure += recurringStats.failure;
    allStats.totalSkipped += recurringStats.skipped;

    console.log('✅ Processus de rappel terminé:', {
      total: allStats.totalEnrollments,
      succès: allStats.totalSuccess,
      échecs: allStats.totalFailure,
      ignorés: allStats.totalSkipped
    });

    return allStats;
  }
}

module.exports = CourseReminderService;

