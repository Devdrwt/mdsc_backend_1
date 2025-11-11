const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes pour la gamification
router.get('/profile', authenticateToken, gamificationController.getUserGamificationProfile);
router.get('/leaderboard', authenticateToken, gamificationController.getLeaderboard);
router.get('/badges', authenticateToken, gamificationController.getAllBadges);
router.get('/activities', authenticateToken, gamificationController.getUserActivities);

// Alias XP (compatibilité avec le frontend)
router.get('/xp/profile', authenticateToken, gamificationController.getUserGamificationProfile);
router.get('/xp/leaderboard', authenticateToken, gamificationController.getLeaderboard);
router.get('/xp/badges', authenticateToken, gamificationController.getAllBadges);
router.get('/xp/activities', authenticateToken, gamificationController.getUserActivities);
router.get('/xp/users/:userId', authenticateToken, gamificationController.getUserProgress);

// Route pour récupérer la progression d'un utilisateur spécifique
router.get('/users/:userId/progress', authenticateToken, gamificationController.getUserProgress);

// Vérifier et attribuer automatiquement les badges
router.post(
  '/badges/check-and-award',
  authenticateToken,
  authorize(['instructor', 'admin']),
  gamificationController.checkAndAwardBadgesHandler
);

// Routes pour les badges personnalisés (instructeurs)
router.post('/badges', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  gamificationController.createCustomBadge
);

router.put('/badges/:badgeId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  gamificationController.updateCustomBadge
);

router.delete('/badges/:badgeId', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  gamificationController.deleteCustomBadge
);

router.post('/users/:userId/badges/:badgeId/award', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  gamificationController.awardBadge
);

module.exports = router;
