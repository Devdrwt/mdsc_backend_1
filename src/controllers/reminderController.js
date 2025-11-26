const CourseReminderService = require('../services/courseReminderService');
const ReminderScheduler = require('../services/reminderScheduler');

/**
 * Contrôleur pour la gestion des rappels de cours
 */

// Envoyer tous les rappels
const sendAllReminders = async (req, res) => {
  try {
    // Vérifier les permissions (admin uniquement)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent déclencher les rappels.'
      });
    }

    const stats = await CourseReminderService.sendAllReminders();

    res.json({
      success: true,
      message: 'Rappels envoyés avec succès',
      data: stats
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi des rappels:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi des rappels',
      error: error.message
    });
  }
};

// Envoyer les rappels pour une période spécifique
const sendRemindersForPeriod = async (req, res) => {
  try {
    // Vérifier les permissions (admin uniquement)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent déclencher les rappels.'
      });
    }

    const { days } = req.params;
    const daysInactive = parseInt(days, 10);

    if (isNaN(daysInactive) || daysInactive < 1) {
      return res.status(400).json({
        success: false,
        message: 'Le nombre de jours doit être un entier positif'
      });
    }

    const stats = await CourseReminderService.sendRemindersForPeriod(daysInactive);

    res.json({
      success: true,
      message: `Rappels envoyés pour ${daysInactive} jours d'inactivité`,
      data: stats
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi des rappels:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi des rappels',
      error: error.message
    });
  }
};

// Obtenir les statistiques des rappels
const getReminderStats = async (req, res) => {
  try {
    // Vérifier les permissions (admin uniquement)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent consulter les statistiques.'
      });
    }

    const { pool } = require('../config/database');
    
    // Statistiques globales
    const [totalStats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT enrollment_id) as total_enrollments,
        COUNT(*) as total_reminders_sent,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_reminders,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_reminders
      FROM course_reminder_logs
      WHERE sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    // Statistiques par période
    const [periodStats] = await pool.execute(`
      SELECT 
        reminder_days,
        COUNT(*) as count,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count,
        MAX(sent_at) as last_sent
      FROM course_reminder_logs
      WHERE sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY reminder_days
      ORDER BY reminder_days
    `);

    res.json({
      success: true,
      data: {
        total: totalStats[0] || {},
        byPeriod: periodStats
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

// Obtenir le statut du scheduler
const getSchedulerStatus = async (req, res) => {
  try {
    // Vérifier les permissions (admin uniquement)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent consulter le statut du scheduler.'
      });
    }

    const status = ReminderScheduler.getStatus();

    res.json({
      success: true,
      data: {
        ...status,
        schedulerEnabled: process.env.REMINDER_SCHEDULER_ENABLED !== 'false'
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut',
      error: error.message
    });
  }
};

// Démarrer le scheduler manuellement
const startScheduler = async (req, res) => {
  try {
    // Vérifier les permissions (admin uniquement)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent contrôler le scheduler.'
      });
    }

    const { runImmediately } = req.body || {};

    ReminderScheduler.start(runImmediately === true);

    res.json({
      success: true,
      message: runImmediately 
        ? 'Scheduler démarré et exécution immédiate déclenchée'
        : 'Scheduler démarré'
    });
  } catch (error) {
    console.error('Erreur lors du démarrage du scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du démarrage du scheduler',
      error: error.message
    });
  }
};

// Arrêter le scheduler
const stopScheduler = async (req, res) => {
  try {
    // Vérifier les permissions (admin uniquement)
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Seuls les administrateurs peuvent contrôler le scheduler.'
      });
    }

    ReminderScheduler.stop();

    res.json({
      success: true,
      message: 'Scheduler arrêté'
    });
  } catch (error) {
    console.error('Erreur lors de l\'arrêt du scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'arrêt du scheduler',
      error: error.message
    });
  }
};

module.exports = {
  sendAllReminders,
  sendRemindersForPeriod,
  getReminderStats,
  getSchedulerStatus,
  startScheduler,
  stopScheduler
};

