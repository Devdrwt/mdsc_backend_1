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

module.exports = router;

