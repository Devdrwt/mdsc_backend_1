const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lessonController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes pour les leçons (instructeurs seulement)
router.post('/courses/:courseId/lessons', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  lessonController.createLesson
);

router.get('/courses/:courseId/lessons', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  lessonController.getCourseLessons
);

router.get('/courses/:courseId/lessons/:lessonId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  lessonController.getLesson
);

router.put('/courses/:courseId/lessons/:lessonId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  lessonController.updateLesson
);

router.delete('/courses/:courseId/lessons/:lessonId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  lessonController.deleteLesson
);

router.put('/courses/:courseId/lessons/reorder', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  lessonController.reorderLessons
);

module.exports = router;
