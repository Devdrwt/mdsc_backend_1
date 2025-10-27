const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes pour les étudiants
router.get('/user/:userId', authenticateToken, evaluationController.getUserEvaluations);
router.get('/user/:userId/stats', authenticateToken, evaluationController.getUserEvaluationStats);
router.get('/:id', authenticateToken, evaluationController.getEvaluation);
router.post('/:id/submit', authenticateToken, evaluationController.submitEvaluation);

// Routes pour les instructeurs
router.post('/courses/:courseId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  evaluationController.createEvaluation
);

router.get('/courses/:courseId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  evaluationController.getCourseEvaluations
);

router.put('/:evaluationId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  evaluationController.updateEvaluation
);

router.delete('/:evaluationId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  evaluationController.deleteEvaluation
);

router.get('/:evaluationId/submissions', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  evaluationController.getEvaluationSubmissions
);

router.put('/submissions/:submissionId/grade', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  evaluationController.gradeSubmission
);

module.exports = router;
