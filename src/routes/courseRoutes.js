const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const enrollmentController = require('../controllers/enrollmentController');
const quizController = require('../controllers/quizController');
const certificateController = require('../controllers/certificateController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { 
  validateCourse, 
  validateEnrollment, 
  validateQuizAttempt,
  handleValidationErrors 
} = require('../middleware/validation');

// Routes publiques pour les cours
router.get('/', courseController.getAllCourses);
router.get('/search', courseController.searchCourses);
router.get('/featured', courseController.getFeaturedCourses);

// Routes protégées pour les cours de l'utilisateur (AVANT les routes avec paramètres)
router.get('/my', authenticateToken, courseController.getMyCourses);

// Routes pour les cours d'un instructeur spécifique
router.get('/instructor/:instructorId', authenticateToken, courseController.getInstructorCourses);

// Routes avec paramètres (après les routes spécifiques)
router.get('/category/:categoryId', courseController.getCoursesByCategory);
router.get('/popular', courseController.getPopularCourses);
router.get('/recommended', authenticateToken, courseController.getRecommendedCourses);
router.get('/slug/:slug', courseController.getCourseBySlug);
router.get('/:id/check-enrollment', authenticateToken, courseController.checkEnrollment);
router.get('/:id', optionalAuth, courseController.getCourseById); // Route avec authentification optionnelle
// Liste des inscrits d'un cours (protégée)
router.get('/:courseId/enrollments', authenticateToken, courseController.getCourseEnrollments);

// Routes protégées pour les cours (instructeurs/admins)
router.post('/', authenticateToken, validateCourse, handleValidationErrors, courseController.createCourse);
router.put('/:id', authenticateToken, validateCourse, handleValidationErrors, courseController.updateCourse);
router.delete('/:id', authenticateToken, courseController.deleteCourse);
router.post('/:id/lessons', authenticateToken, courseController.addLesson);
router.put('/:courseId/lessons/:lessonId', authenticateToken, courseController.updateLesson);
router.delete('/:courseId/lessons/:lessonId', authenticateToken, courseController.deleteLesson);

// Routes d'inscription aux cours
router.post('/enrollments', authenticateToken, validateEnrollment, handleValidationErrors, enrollmentController.enrollInCourse);
router.get('/enrollments/my-courses', authenticateToken, enrollmentController.getMyCourses);
router.get('/enrollments/:courseId/progress', authenticateToken, enrollmentController.getCourseProgress);
router.put('/enrollments/:courseId/lesson/:lessonId/progress', authenticateToken, enrollmentController.updateLessonProgress);
router.delete('/enrollments/:courseId', authenticateToken, enrollmentController.unenrollFromCourse);

// Routes de progression des cours
router.get('/:courseId/progress', authenticateToken, enrollmentController.getCourseProgress);
router.put('/:courseId/lessons/:lessonId/complete', authenticateToken, enrollmentController.updateLessonProgress);
router.get('/:courseId/lessons', authenticateToken, courseController.getCourseLessons);

// Routes pour les quiz
router.get('/:courseId/quizzes', authenticateToken, quizController.getCourseQuizzes);
router.get('/quizzes/:quizId', authenticateToken, quizController.getQuizById);
router.post('/quizzes/:quizId/attempt', authenticateToken, validateQuizAttempt, handleValidationErrors, quizController.startQuizAttempt);
router.put('/quizzes/attempts/:attemptId', authenticateToken, quizController.submitQuizAttempt);
router.get('/quizzes/attempts/:attemptId', authenticateToken, quizController.getQuizAttempt);
router.get('/quizzes/attempts/my-attempts', authenticateToken, quizController.getMyQuizAttempts);

// Routes pour les certificats
router.get('/certificates/my-certificates', authenticateToken, certificateController.getMyCertificates);
router.get('/certificates/:certificateId', authenticateToken, certificateController.getCertificateById);
router.get('/certificates/:certificateId/download', authenticateToken, certificateController.downloadCertificate);

// Routes pour les favoris
router.post('/courses/:courseId/favorite', authenticateToken, courseController.addToFavorites);
router.delete('/courses/:courseId/favorite', authenticateToken, courseController.removeFromFavorites);
router.get('/courses/favorites', authenticateToken, courseController.getFavoriteCourses);

// Routes pour les avis
router.post('/courses/:courseId/review', authenticateToken, courseController.addReview);
router.get('/courses/:courseId/reviews', courseController.getCourseReviews);
router.put('/courses/:courseId/reviews/:reviewId', authenticateToken, courseController.updateReview);
router.delete('/courses/:courseId/reviews/:reviewId', authenticateToken, courseController.deleteReview);

module.exports = router;
