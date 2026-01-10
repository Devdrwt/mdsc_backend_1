const express = require('express');
const router = express.Router();
const { sendContactMessage } = require('../controllers/contactController');

/**
 * @route   POST /api/contact/send
 * @desc    Envoyer un message de contact
 * @access  Public
 */
router.post('/send', sendContactMessage);

module.exports = router;

