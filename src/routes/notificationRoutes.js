const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

router.get(
  '/',
  authenticateToken,
  notificationController.getNotifications
);

router.put(
  '/:id/read',
  authenticateToken,
  notificationController.markNotificationAsRead
);

router.put(
  '/read-all',
  authenticateToken,
  notificationController.markAllNotificationsAsRead
);

router.delete(
  '/:id',
  authenticateToken,
  notificationController.deleteNotification
);

module.exports = router;

