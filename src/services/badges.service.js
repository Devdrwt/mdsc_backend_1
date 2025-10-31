const db = require('../config/database');
const dbPool = db.pool;
const GamificationService = require('./GamificationService');
const { eventEmitter, EVENTS } = require('../middleware/eventEmitter');

class BadgeService {
  static async getAllBadges() {
    const query = `
      SELECT 
        b.*,
        COUNT(ub.user_id) as earned_count
      FROM badges b
      LEFT JOIN user_badges ub ON b.id = ub.badge_id
      GROUP BY b.id
      ORDER BY b.category, b.name
    `;
    const [badges] = await dbPool.execute(query);
    return badges;
  }

  static async getBadgeById(badgeId) {
    const [badges] = await dbPool.execute('SELECT * FROM badges WHERE id = ?', [badgeId]);
    return badges.length > 0 ? badges[0] : null;
  }

  static async getUserBadges(userId) {
    const query = `
      SELECT 
        b.*,
        ub.earned_at
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = ?
      ORDER BY ub.earned_at DESC
    `;
    const [badges] = await dbPool.execute(query, [userId]);
    return badges;
  }

  static async awardBadge(userId, badgeId) {
    const [existing] = await dbPool.execute('SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?', [userId, badgeId]);
    if (existing.length > 0) {
      return { success: false, message: 'Badge déjà obtenu' };
    }
    await dbPool.execute(`INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, NOW())`, [userId, badgeId]);
    await GamificationService.addXP(userId, 200, 'Badge obtenu');
    const [badgeRows] = await dbPool.execute('SELECT name, icon_url FROM badges WHERE id = ?', [badgeId]);
    const badge = badgeRows[0] || {};
    eventEmitter.emit(EVENTS.BADGE_EARNED, { userId, badgeId, badgeName: badge.name, badgeIcon: badge.icon_url });
    return { success: true, message: 'Badge attribué avec succès' };
  }

  static async checkBadgeEligibility(userId, badgeIdOrContext) {
    if (typeof badgeIdOrContext === 'number' || typeof badgeIdOrContext === 'string') {
      const badge = await this.getBadgeById(badgeIdOrContext);
      if (!badge) throw new Error('Badge non trouvé');
      const [existing] = await dbPool.execute('SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?', [userId, badge.id]);
      if (existing.length > 0) return { eligible: false, reason: 'Badge déjà obtenu' };
      return { eligible: true };
    }
    const [rows] = await dbPool.execute('SELECT id FROM badges WHERE is_active = TRUE LIMIT 1');
    if (rows.length) {
      await this.awardBadge(userId, rows[0].id);
    }
    return { eligible: true };
  }

  static async checkAndAwardBadges(userId) {
    const badges = await this.getAllBadges();
    const awarded = [];
    for (const badge of badges) {
      const eligibility = await this.checkBadgeEligibility(userId, badge.id);
      if (eligibility.eligible) {
        const result = await this.awardBadge(userId, badge.id);
        if (result.success) awarded.push(badge);
      }
    }
    return awarded;
  }
}

module.exports = BadgeService;
