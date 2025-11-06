const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progressController');
const { authenticateToken } = require('../middleware/auth');

// Routes protégées
router.get('/enrollment/:enrollmentId', 
  authenticateToken, 
  progressController.getProgressByEnrollment
);

router.get('/course/:courseId', 
  authenticateToken, 
  progressController.getCourseProgress
);

router.get('/lesson/:lessonId', 
  authenticateToken, 
  progressController.getLessonProgress
);

router.put('/enrollment/:enrollmentId/lesson/:lessonId', 
  authenticateToken, 
  progressController.updateLessonProgress
);

router.post('/enrollment/:enrollmentId/lesson/:lessonId/complete', 
  authenticateToken, 
  progressController.markLessonCompleted
);

// Nouvelle route pour compléter une leçon (avec déverrouillage)
router.post('/enrollment/:enrollmentId/lesson/:lessonId/complete-sequential', 
  authenticateToken, 
  progressController.completeLesson
);

// Nouvelle route pour vérifier l'accès à une leçon (progression séquentielle)
router.get('/enrollment/:enrollmentId/lesson/:lessonId/access', 
  authenticateToken, 
  progressController.checkLessonAccess
);

module.exports = router;

