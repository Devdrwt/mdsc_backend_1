const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authenticateToken } = require('../middleware/auth');

// Routes pour les quiz (avec authentification)
router.get('/course/:courseId', authenticateToken, quizController.getCourseQuizzes);
router.get('/:id', authenticateToken, quizController.getQuizById);
router.post('/:quizId/attempt', authenticateToken, quizController.startQuizAttempt);
router.put('/attempts/:attemptId', authenticateToken, quizController.submitQuizAttempt);
router.get('/attempts/:attemptId', authenticateToken, quizController.getQuizAttempt);
router.get('/my-attempts', authenticateToken, quizController.getMyQuizAttempts);

module.exports = router;