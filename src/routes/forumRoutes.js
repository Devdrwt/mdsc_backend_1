const express = require('express');
const router = express.Router();
const forumController = require('../controllers/forumController');
const { authenticateToken } = require('../middleware/auth');

/**
 * @route   GET /api/courses/:courseId/forum
 * @desc    Récupérer ou créer le forum d'un cours
 * @access  Private
 */
router.get('/courses/:courseId/forum', authenticateToken, forumController.getCourseForum);

/**
 * @route   GET /api/forums/:forumId/topics
 * @desc    Lister les topics d'un forum
 * @access  Private
 */
router.get('/forums/:forumId/topics', authenticateToken, forumController.getForumTopics);

/**
 * @route   POST /api/forums/:forumId/topics
 * @desc    Créer un topic dans un forum
 * @access  Private
 */
router.post('/forums/:forumId/topics', authenticateToken, forumController.createTopic);

/**
 * @route   GET /api/topics/:topicId
 * @desc    Récupérer un topic par son ID
 * @access  Private
 */
router.get('/topics/:topicId', authenticateToken, forumController.getTopicById);

/**
 * @route   GET /api/topics/:topicId/replies
 * @desc    Lister les réponses d'un topic
 * @access  Private
 */
router.get('/topics/:topicId/replies', authenticateToken, forumController.getTopicReplies);

/**
 * @route   POST /api/topics/:topicId/replies
 * @desc    Créer une réponse à un topic
 * @access  Private
 */
router.post('/topics/:topicId/replies', authenticateToken, forumController.createReply);

/**
 * @route   POST /api/replies/:replyId/reactions
 * @desc    Ajouter une réaction (upvote/downvote) à une réponse
 * @access  Private
 */
router.post('/replies/:replyId/reactions', authenticateToken, forumController.addReaction);

/**
 * @route   POST /api/replies/:replyId/mark-solution
 * @desc    Marquer une réponse comme solution
 * @access  Private
 */
router.post('/replies/:replyId/mark-solution', authenticateToken, forumController.markAsSolution);

module.exports = router;

