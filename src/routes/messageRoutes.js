const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/auth');

// Routes pour les messages (tous les rôles authentifiés)
router.get('/search', authenticateToken, messageController.searchUserByEmail);
router.post('/send', authenticateToken, messageController.sendMessage);
router.get('/received', authenticateToken, messageController.getReceivedMessages);
router.get('/sent', authenticateToken, messageController.getSentMessages);
router.get('/conversations', authenticateToken, messageController.getMyConversations);
router.get('/conversations/:email', authenticateToken, messageController.getConversationByEmail);
router.get('/stats', authenticateToken, messageController.getMessageStats);
router.get('/:messageId', authenticateToken, messageController.getMessage);
router.put('/:messageId/read', authenticateToken, messageController.markAsRead);
router.delete('/:messageId', authenticateToken, messageController.deleteMessage);

module.exports = router;
