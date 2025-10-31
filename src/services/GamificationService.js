const { pool } = require('../config/database');
const { eventEmitter, EVENTS } = require('../middleware/eventEmitter');

class GamificationService {
  static async getUserXP(userId) {
    const [rows] = await pool.execute(
      'SELECT points as total_xp, level FROM user_points WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (rows.length === 0) {
      return { total_xp: 0, level: 1 };
    }
    return { total_xp: rows[0].total_xp || 0, level: rows[0].level || 1 };
  }

  static async addXP(userId, amount, reason = '') {
    // Upsert XP
    await pool.execute(
      `INSERT INTO user_points (user_id, points, level, total_points_earned, updated_at)
       VALUES (?, ?, 1, ?, NOW())
       ON DUPLICATE KEY UPDATE points = points + VALUES(points), total_points_earned = total_points_earned + VALUES(total_points_earned), updated_at = NOW()`,
      [userId, amount, amount]
    );

    const xp = await this.getUserXP(userId);
    eventEmitter.emit(EVENTS.XP_GAINED, { userId, amount, reason, total_xp: xp.total_xp });
    return xp;
  }
}

module.exports = GamificationService;


