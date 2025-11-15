const { pool } = require('../config/database');

/**
 * Service de nettoyage automatique des paiements
 * Nettoie les paiements abandonnés, échoués ou expirés
 */
class PaymentCleanupService {
  /**
   * Nettoyer les paiements abandonnés (pending/processing trop anciens)
   * @param {number} maxAgeMinutes - Âge maximum en minutes (défaut: 30)
   */
  static async cleanupAbandonedPayments(maxAgeMinutes = 30) {
    try {
      const threshold = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
      
      const [result] = await pool.execute(
        `UPDATE payments 
         SET status = 'cancelled', 
             error_message = CONCAT('Paiement abandonné (timeout après ', TIMESTAMPDIFF(MINUTE, created_at, NOW()), ' minutes)')
         WHERE status IN ('pending', 'processing') 
           AND created_at < ?
           AND (completed_at IS NULL OR completed_at < created_at)`,
        [threshold]
      );

      console.log(`[PaymentCleanup] 🧹 ${result.affectedRows} paiement(s) abandonné(s) nettoyé(s)`);
      return result.affectedRows;
    } catch (error) {
      console.error('[PaymentCleanup] ❌ Erreur lors du nettoyage des paiements abandonnés:', error);
      throw error;
    }
  }

  /**
   * Nettoyer les anciens paiements échoués (pour libérer de l'espace)
   * @param {number} maxAgeDays - Âge maximum en jours (défaut: 90)
   */
  static async cleanupOldFailedPayments(maxAgeDays = 90) {
    try {
      const threshold = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
      
      const [result] = await pool.execute(
        `DELETE FROM payments 
         WHERE status IN ('failed', 'cancelled') 
           AND created_at < ?`,
        [threshold]
      );

      console.log(`[PaymentCleanup] 🗑️  ${result.affectedRows} ancien(s) paiement(s) échoué(s) supprimé(s)`);
      return result.affectedRows;
    } catch (error) {
      console.error('[PaymentCleanup] ❌ Erreur lors du nettoyage des anciens paiements échoués:', error);
      throw error;
    }
  }

  /**
   * Nettoyage complet (abandonnés + anciens échoués)
   */
  static async cleanupAll(options = {}) {
    const {
      maxAgeMinutes = 30,
      maxAgeDays = 90,
      cleanupOldFailed = true
    } = options;

    try {
      const abandoned = await this.cleanupAbandonedPayments(maxAgeMinutes);
      let oldFailed = 0;
      
      if (cleanupOldFailed) {
        oldFailed = await this.cleanupOldFailedPayments(maxAgeDays);
      }

      return {
        abandoned,
        oldFailed,
        total: abandoned + oldFailed
      };
    } catch (error) {
      console.error('[PaymentCleanup] ❌ Erreur lors du nettoyage complet:', error);
      throw error;
    }
  }

  /**
   * Obtenir les statistiques des paiements à nettoyer
   */
  static async getCleanupStats() {
    try {
      const [abandoned] = await pool.execute(
        `SELECT COUNT(*) as count 
         FROM payments 
         WHERE status IN ('pending', 'processing') 
           AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
      );

      const [oldFailed] = await pool.execute(
        `SELECT COUNT(*) as count 
         FROM payments 
         WHERE status IN ('failed', 'cancelled') 
           AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`
      );

      return {
        abandoned: abandoned[0].count,
        oldFailed: oldFailed[0].count,
        total: Number(abandoned[0].count) + Number(oldFailed[0].count)
      };
    } catch (error) {
      console.error('[PaymentCleanup] ❌ Erreur lors de la récupération des stats:', error);
      throw error;
    }
  }
}

module.exports = PaymentCleanupService;

