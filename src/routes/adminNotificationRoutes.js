const express = require('express');
const router = express.Router();
const adminNotificationController = require('../controllers/adminNotificationController');
const { authenticateToken, authorize } = require('../middleware/auth');

const requireAdmin = [
  authenticateToken,
  authorize(['admin'])
];

router.get(
  '/',
  requireAdmin,
  adminNotificationController.listNotifications
);

router.post(
  '/',
  requireAdmin,
  adminNotificationController.createNotification
);

router.put(
  '/:id',
  requireAdmin,
  adminNotificationController.updateNotification
);

router.delete(
  '/:id',
  requireAdmin,
  adminNotificationController.deleteNotification
);

module.exports = router;

