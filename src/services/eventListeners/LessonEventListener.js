const { eventEmitter, EVENTS } = require('../../middleware/eventEmitter');
const GamificationService = require('../GamificationService');
const BadgeService = require('../badges.service');

eventEmitter.on(EVENTS.LESSON_COMPLETED, async ({ userId, courseId, lessonId, lessonTitle, timeSpent }) => {
  try {
    await GamificationService.addXP(userId, 50, `Leçon complétée: ${lessonTitle || lessonId}`);
    await BadgeService.checkBadgeEligibility(userId, { type: 'lesson_completed', lessonId, courseId });
  } catch (e) {
    console.error('Erreur LessonEventListener:', e.message);
  }
});

module.exports = {};


