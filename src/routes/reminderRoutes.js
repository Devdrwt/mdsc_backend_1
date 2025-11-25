const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * Routes pour la gestion des rappels de cours
 * Toutes les routes nécessitent une authentification admin
 */

// Envoyer tous les rappels (pour toutes les périodes configurées)
router.post(
  '/send-all',
  authenticateToken,
  authorize(['admin']),
  reminderController.sendAllReminders
);

// Envoyer les rappels pour une période spécifique (en jours)
router.post(
  '/send/:days',
  authenticateToken,
  authorize(['admin']),
  reminderController.sendRemindersForPeriod
);

// Obtenir les statistiques des rappels
router.get(
  '/stats',
  authenticateToken,
  authorize(['admin']),
  reminderController.getReminderStats
);

// Obtenir le statut du scheduler
router.get(
  '/scheduler/status',
  authenticateToken,
  authorize(['admin']),
  reminderController.getSchedulerStatus
);

// Démarrer le scheduler
router.post(
  '/scheduler/start',
  authenticateToken,
  authorize(['admin']),
  reminderController.startScheduler
);

// Arrêter le scheduler
router.post(
  '/scheduler/stop',
  authenticateToken,
  authorize(['admin']),
  reminderController.stopScheduler
);

module.exports = router;

