const { eventEmitter, EVENTS } = require('../../middleware/eventEmitter');
const GamificationService = require('../GamificationService');
const BadgeService = require('../badges.service');
const CertificateService = require('../CertificateService');

eventEmitter.on(EVENTS.COURSE_COMPLETED, async ({ userId, courseId }) => {
  try {
    await GamificationService.addXP(userId, 500, `Cours complété (#${courseId})`);
    await BadgeService.checkBadgeEligibility(userId, { type: 'course_completion', courseId });
    await CertificateService.generateCertificate(userId, courseId);
  } catch (e) {
    console.error('Erreur CourseEventListener:', e.message);
  }
});

module.exports = {};


