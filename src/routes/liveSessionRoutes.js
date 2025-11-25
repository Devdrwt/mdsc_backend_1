const express = require('express');
const router = express.Router();
const liveSessionController = require('../controllers/liveSessionController');
const { authenticateToken, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/courses/:courseId/live-sessions
 * @desc    Créer une session live pour un cours
 * @access  Private (Instructeur)
 */
router.post('/courses/:courseId/live-sessions', 
  authenticateToken, 
  authorize(['instructor', 'admin']),
  liveSessionController.createSession
);

/**
 * @route   GET /api/courses/:courseId/live-sessions
 * @desc    Récupérer toutes les sessions d'un cours
 * @access  Private
 */
router.get('/courses/:courseId/live-sessions', 
  authenticateToken, 
  liveSessionController.getCourseSessions
);

/**
 * @route   GET /api/live-sessions/:sessionId
 * @desc    Récupérer les détails d'une session
 * @access  Private
 */
router.get('/live-sessions/:sessionId', 
  authenticateToken, 
  liveSessionController.getSessionById
);

/**
 * @route   PUT /api/live-sessions/:sessionId
 * @desc    Mettre à jour une session
 * @access  Private (Instructeur)
 */
router.put('/live-sessions/:sessionId', 
  authenticateToken, 
  authorize(['instructor', 'admin']),
  liveSessionController.updateSession
);

/**
 * @route   DELETE /api/live-sessions/:sessionId
 * @desc    Supprimer une session
 * @access  Private (Instructeur)
 */
router.delete('/live-sessions/:sessionId', 
  authenticateToken, 
  authorize(['instructor', 'admin']),
  liveSessionController.deleteSession
);

/**
 * @route   POST /api/live-sessions/:sessionId/start
 * @desc    Démarrer une session (instructeur uniquement)
 * @access  Private (Instructeur)
 */
router.post('/live-sessions/:sessionId/start', 
  authenticateToken, 
  authorize(['instructor', 'admin']),
  liveSessionController.startSession
);

/**
 * @route   POST /api/live-sessions/:sessionId/end
 * @desc    Terminer une session (instructeur uniquement)
 * @access  Private (Instructeur)
 */
router.post('/live-sessions/:sessionId/end', 
  authenticateToken, 
  authorize(['instructor', 'admin']),
  liveSessionController.endSession
);

/**
 * @route   GET /api/live-sessions/:sessionId/participants
 * @desc    Récupérer les participants d'une session
 * @access  Private
 */
router.get('/live-sessions/:sessionId/participants', 
  authenticateToken, 
  liveSessionController.getParticipants
);

/**
 * @route   POST /api/live-sessions/:sessionId/join
 * @desc    Rejoindre une session (étudiant inscrit)
 * @access  Private
 */
router.post('/live-sessions/:sessionId/join', 
  authenticateToken, 
  liveSessionController.joinSession
);

/**
 * @route   POST /api/live-sessions/:sessionId/leave
 * @desc    Quitter une session
 * @access  Private
 */
router.post('/live-sessions/:sessionId/leave', 
  authenticateToken, 
  liveSessionController.leaveSession
);

/**
 * @route   GET /api/student/live-sessions
 * @desc    Récupérer les sessions live de l'étudiant connecté
 * @access  Private
 */
router.get('/student/live-sessions', 
  authenticateToken, 
  liveSessionController.getStudentSessions
);

/**
 * @route   POST /api/live-sessions/:sessionId/jitsi-token
 * @desc    Générer un JWT pour rejoindre Jitsi
 * @access  Private
 */
router.post('/live-sessions/:sessionId/jitsi-token', 
  authenticateToken, 
  liveSessionController.getJitsiToken
);

/**
 * @route   GET /api/student/calendar/live-sessions
 * @desc    Récupérer les sessions live pour le calendrier
 * @access  Private
 */
router.get('/student/calendar/live-sessions', 
  authenticateToken, 
  liveSessionController.getCalendarSessions
);

module.exports = router;

