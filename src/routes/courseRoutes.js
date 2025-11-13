const express = require('express');
const router = express.Router();
const courseController = require('../controllers/courseController');
const enrollmentController = require('../controllers/enrollmentController');
const quizController = require('../controllers/quizController');
const certificateController = require('../controllers/certificateController');
const evaluationController = require('../controllers/evaluationController');
const instructorDashboardController = require('../controllers/instructorDashboardController');
const { authenticateToken, optionalAuth, authorize } = require('../middleware/auth');
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

// Route de désinscription (doit être AVANT /:id pour éviter les conflits)
router.delete('/:courseId/unenroll', 
  (req, res, next) => {
    console.log('🔵 [ROUTE COURSES] DELETE /courses/:courseId/unenroll appelée');
    console.log('🔵 [ROUTE COURSES] courseId:', req.params.courseId);
    next();
  },
  authenticateToken, 
  enrollmentController.unenrollFromCourse
);

// Route pour les analytics d'un cours (doit être avant /:id pour éviter les conflits)
router.get('/:courseId/analytics', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  instructorDashboardController.getCoursePerformance
);
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

// Routes pour les évaluations finales (alias pour compatibilité frontend)
router.get('/:courseId/evaluation', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  evaluationController.getCourseEvaluations
);

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
