const express = require('express');
const router = express.Router();
const adminDashboardController = require('../controllers/adminDashboardController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.get('/overview', authenticateToken, authorize(['admin']), adminDashboardController.getOverview);
router.get(
  '/system-metrics',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getSystemMetrics
);
router.get(
  '/recent-activity',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getRecentActivity
);
router.get(
  '/alerts',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getAlerts
);
router.get(
  '/services/status',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getServicesStatus
);
router.get(
  '/courses/top',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getTopCourses
);
router.get(
  '/instructors/top',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getTopInstructors
);
router.get(
  '/payments/recent',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getRecentPayments
);
router.get(
  '/support/tickets',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getPendingSupportTickets
);
router.get(
  '/moderation/pending',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getPendingModeration
);
router.get(
  '/ai/usage',
  authenticateToken,
  authorize(['admin']),
  adminDashboardController.getAiUsage
);

module.exports = router;

