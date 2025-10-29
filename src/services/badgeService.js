const { pool } = require('../config/database');

/**
 * Service de gestion des badges
 */
class BadgeService {
  /**
   * Récupérer tous les badges disponibles
   */
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

    const [badges] = await pool.execute(query);
    return badges;
  }

  /**
   * Récupérer un badge par ID
   */
  static async getBadgeById(badgeId) {
    const query = 'SELECT * FROM badges WHERE id = ?';
    const [badges] = await pool.execute(query, [badgeId]);
    return badges.length > 0 ? badges[0] : null;
  }

  /**
   * Récupérer les badges d'un utilisateur
   */
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

    const [badges] = await pool.execute(query, [userId]);
    return badges;
  }

  /**
   * Vérifier l'éligibilité d'un utilisateur pour un badge
   */
  static async checkBadgeEligibility(userId, badgeId) {
    const badge = await this.getBadgeById(badgeId);
    if (!badge) {
      throw new Error('Badge non trouvé');
    }

    // Vérifier si déjà obtenu
    const checkQuery = 'SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?';
    const [existing] = await pool.execute(checkQuery, [userId, badgeId]);
    
    if (existing.length > 0) {
      return { eligible: false, reason: 'Badge déjà obtenu' };
    }

    const criteria = typeof badge.criteria === 'string' ? 
                     JSON.parse(badge.criteria) : badge.criteria;

    let isEligible = false;
    let currentValue = 0;

    switch (criteria.type) {
      case 'profile_completion':
        // Vérifier si le profil est complété
        const userQuery = 'SELECT * FROM users WHERE id = ?';
        const [users] = await pool.execute(userQuery, [userId]);
        if (users.length > 0) {
          const user = users[0];
          isEligible = !!(user.first_name && user.last_name && user.email && user.phone);
        }
        break;

      case 'pages_visited':
        // Cette logique devrait être implémentée avec un système de tracking
        // Pour l'instant, on considère que c'est toujours false
        isEligible = false;
        currentValue = 0;
        break;

      case 'courses_enrolled':
        // Compter les inscriptions
        const enrollQuery = 'SELECT COUNT(*) as count FROM enrollments WHERE user_id = ?';
        const [enrollResult] = await pool.execute(enrollQuery, [userId]);
        currentValue = enrollResult[0].count;
        isEligible = currentValue >= (criteria.count || 1);
        break;

      case 'courses_completed':
        // Compter les cours complétés
        const completedQuery = `
          SELECT COUNT(*) as count 
          FROM enrollments 
          WHERE user_id = ? AND status = 'completed'
        `;
        const [completedResult] = await pool.execute(completedQuery, [userId]);
        currentValue = completedResult[0].count;
        isEligible = currentValue >= (criteria.count || 1);
        break;

      case 'course_completion':
        // Vérifier si un cours spécifique est complété
        if (criteria.course_category) {
          const categoryQuery = `
            SELECT COUNT(*) as count
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            JOIN categories cat ON c.category_id = cat.id
            WHERE e.user_id = ? 
              AND e.status = 'completed'
              AND cat.name = ?
          `;
          const [categoryResult] = await pool.execute(categoryQuery, [
            userId, 
            criteria.course_category
          ]);
          currentValue = categoryResult[0].count;
          isEligible = currentValue >= (criteria.value || 1);
        }
        break;

      default:
        isEligible = false;
    }

    return {
      eligible: isEligible,
      badge: badge,
      criteria: criteria,
      current_value: currentValue,
      required_value: criteria.count || criteria.value || 1
    };
  }

  /**
   * Attribuer un badge à un utilisateur
   */
  static async awardBadge(userId, badgeId) {
    // Vérifier si déjà obtenu
    const checkQuery = 'SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?';
    const [existing] = await pool.execute(checkQuery, [userId, badgeId]);
    
    if (existing.length > 0) {
      return { success: false, message: 'Badge déjà obtenu' };
    }

    // Attribuer le badge
    const insertQuery = `
      INSERT INTO user_badges (user_id, badge_id, earned_at)
      VALUES (?, ?, NOW())
    `;

    await pool.execute(insertQuery, [userId, badgeId]);

    return { success: true, message: 'Badge attribué avec succès' };
  }

  /**
   * Vérifier et attribuer automatiquement les badges éligibles
   */
  static async checkAndAwardBadges(userId) {
    const badges = await this.getAllBadges();
    const awarded = [];

    for (const badge of badges) {
      const eligibility = await this.checkBadgeEligibility(userId, badge.id);
      if (eligibility.eligible) {
        const result = await this.awardBadge(userId, badge.id);
        if (result.success) {
          awarded.push(badge);
        }
      }
    }

    return awarded;
  }
}

module.exports = BadgeService;

