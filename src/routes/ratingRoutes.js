const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   POST /api/courses/:courseId/ratings
 * @desc    Créer une notation pour un cours
 * @access  Private
 */
router.post('/courses/:courseId/ratings', authenticateToken, ratingController.createRating);

/**
 * @route   GET /api/courses/:courseId/ratings
 * @desc    Lister les notations d'un cours
 * @access  Public
 */
router.get('/courses/:courseId/ratings', ratingController.getCourseRatings);

/**
 * @route   GET /api/courses/:courseId/ratings/stats
 * @desc    Obtenir les statistiques des notations d'un cours
 * @access  Public
 */
router.get('/courses/:courseId/ratings/stats', ratingController.getRatingStats);

/**
 * @route   GET /api/enrollments/:enrollmentId/can-rate
 * @desc    Vérifier si l'étudiant peut noter le cours
 * @access  Private
 */
router.get('/enrollments/:enrollmentId/can-rate', authenticateToken, ratingController.canRate);

module.exports = router;

