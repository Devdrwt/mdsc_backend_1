const { eventEmitter, EVENTS } = require('../../middleware/eventEmitter');
const GamificationService = require('../GamificationService');
const BadgeService = require('../badges.service');

eventEmitter.on(EVENTS.QUIZ_PASSED, async ({ userId, quizId, score, isPerfect }) => {
  try {
    await GamificationService.addXP(userId, isPerfect ? 150 : 100, `Quiz ${isPerfect ? 'parfait' : 'réussi'} (#${quizId})`);
    await BadgeService.checkBadgeEligibility(userId, { type: 'quiz_passed', quizId, isPerfect, score });
  } catch (e) {
    console.error('Erreur QuizEventListener:', e.message);
  }
});

eventEmitter.on(EVENTS.QUIZ_FAILED, async ({ userId, quizId, score }) => {
  // Optionnel: aucune action pour l'instant
});

module.exports = {};


