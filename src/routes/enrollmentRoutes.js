const express = require('express');
const router = express.Router();
const enrollmentController = require('../controllers/enrollmentController');
const { authenticateToken } = require('../middleware/auth');

// Routes pour les inscriptions (avec authentification)
router.post('/', authenticateToken, enrollmentController.enrollInCourse);
router.get('/my-courses', authenticateToken, enrollmentController.getMyCourses);
router.get('/:courseId/progress', authenticateToken, enrollmentController.getCourseProgress);
router.put('/:courseId/lesson/:lessonId/progress', authenticateToken, enrollmentController.updateLessonProgress);
router.delete('/:courseId', authenticateToken, enrollmentController.unenrollFromCourse);

module.exports = router;