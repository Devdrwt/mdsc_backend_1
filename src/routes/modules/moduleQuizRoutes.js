const express = require('express');
const router = express.Router();
const moduleQuizController = require('../../controllers/moduleQuizController');
const { authenticateToken, authorize } = require('../../middleware/auth');

// Routes instructeur
router.post('/modules/:moduleId/quiz', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.createModuleQuiz
);

router.get('/modules/:moduleId/quiz', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.getModuleQuiz
);

// Routes avec quizId (format original)
router.put('/modules/:moduleId/quiz/:quizId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.updateModuleQuiz
);

router.delete('/modules/:moduleId/quiz/:quizId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.deleteModuleQuiz
);

// Routes sans quizId (format frontend - récupère le quiz depuis module_id)
router.put('/modules/:moduleId/quiz', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.updateModuleQuiz
);

router.delete('/modules/:moduleId/quiz', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleQuizController.deleteModuleQuiz
);

// Routes étudiant
router.get('/enrollments/:enrollmentId/modules/:moduleId/quiz', 
  authenticateToken, 
  moduleQuizController.getModuleQuizForStudent
);

router.post('/enrollments/:enrollmentId/modules/:moduleId/quiz/attempt', 
  authenticateToken, 
  moduleQuizController.submitModuleQuizAttempt
);

module.exports = router;

