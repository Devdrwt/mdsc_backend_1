const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');
const { 
  validateAIConversation,
  validateAIMessage,
  handleValidationErrors 
} = require('../middleware/validation');

// Routes pour l'IA et ChatIA
router.post('/conversations', authenticateToken, validateAIConversation, handleValidationErrors, aiController.createConversation);
router.get('/conversations', authenticateToken, aiController.getUserConversations);
router.get('/conversations/:conversationId', authenticateToken, aiController.getConversationHistory);
router.post('/conversations/:conversationId/messages', authenticateToken, validateAIMessage, handleValidationErrors, aiController.sendMessage);

// Routes pour les fonctionnalités IA avancées
router.post('/courses/:courseId/summary', authenticateToken, aiController.generateCourseSummary);
router.get('/recommendations', authenticateToken, aiController.getPersonalizedRecommendations);

module.exports = router;
