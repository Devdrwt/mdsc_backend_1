const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const moduleQuizController = require('../controllers/moduleQuizController');
const courseApprovalController = require('../controllers/courseApprovalController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes pour les instructeurs - alias pour compatibilité frontend
// Ces routes pointent vers les mêmes contrôleurs que les routes principales

// Route pour créer une évaluation finale d'un cours
router.post('/courses/:courseId/evaluation',
  (req, res, next) => {
    console.log('📝 [INSTRUCTOR ROUTE] POST /courses/:courseId/evaluation - Route matched');
    next();
  },
  authenticateToken,
  authorize(['instructor', 'admin']),
  evaluationController.createEvaluation
);

// Route pour récupérer l'évaluation finale d'un cours
router.get('/courses/:courseId/evaluation',
  authenticateToken,
  authorize(['instructor', 'admin']),
  evaluationController.getCourseEvaluations
);

// Route pour mettre à jour un quiz de module (format /quizzes/:id)
router.put('/quizzes/:id',
  authenticateToken,
  authorize(['instructor', 'admin']),
  moduleQuizController.updateModuleQuiz
);

// Route pour mettre à jour une évaluation finale
router.put('/evaluations/:id',
  authenticateToken,
  authorize(['instructor', 'admin']),
  evaluationController.updateEvaluation
);

// Route pour demander la publication d'un cours
router.post('/courses/:courseId/request-publication',
  authenticateToken,
  authorize(['instructor', 'admin']),
  courseApprovalController.requestPublication
);

// Route pour demander la suppression d'un cours
router.post('/courses/:courseId/request-deletion',
  authenticateToken,
  authorize(['instructor', 'admin']),
  courseApprovalController.requestDeletion
);

module.exports = router;

