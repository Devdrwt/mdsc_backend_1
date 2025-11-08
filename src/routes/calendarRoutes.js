const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { authenticateToken } = require('../middleware/auth');

router.get(
  '/',
  authenticateToken,
  calendarController.getEvents
);

router.get(
  '/:id',
  authenticateToken,
  calendarController.getEventById
);

module.exports = router;

