const express = require('express');
const router = express.Router();
const adminEventController = require('../controllers/adminEventController');
const { authenticateToken, authorize } = require('../middleware/auth');

const requireAdmin = [
  authenticateToken,
  authorize(['admin'])
];

router.get(
  '/',
  requireAdmin,
  adminEventController.listEvents
);

router.post(
  '/',
  requireAdmin,
  adminEventController.createEvent
);

router.put(
  '/:id',
  requireAdmin,
  adminEventController.updateEvent
);

router.delete(
  '/:id',
  requireAdmin,
  adminEventController.deleteEvent
);

module.exports = router;

