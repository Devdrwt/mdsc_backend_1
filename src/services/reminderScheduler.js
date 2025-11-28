const CourseReminderService = require('./courseReminderService');

/**
 * Scheduler automatique pour les rappels de cours
 * Envoie les rappels automatiquement une fois par jour
 */
class ReminderScheduler {
  static intervalId = null;
  static isRunning = false;
  static lastRun = null;

  /**
   * Calcule le prochain moment pour exécuter les rappels (9h00 du matin)
   */
  static getNextRunTime() {
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(9, 0, 0, 0); // 9h00 du matin

    // Si on a déjà passé 9h00 aujourd'hui, programmer pour demain
    if (now >= nextRun) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }

  /**
   * Calcule le délai en millisecondes jusqu'au prochain run
   */
  static getDelayUntilNextRun() {
    const nextRun = this.getNextRunTime();
    const now = new Date();
    return nextRun.getTime() - now.getTime();
  }

  /**
   * Exécute les rappels
   */
  static async executeReminders() {
    if (this.isRunning) {
      console.log('⏭️  Rappels déjà en cours d\'exécution, skip...');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();

    try {
      console.log('\n🚀 [SCHEDULER] Démarrage de l\'envoi automatique des rappels...');
      console.log(`📅 [SCHEDULER] Date: ${startTime.toISOString()}`);

      const stats = await CourseReminderService.sendAllReminders();

      const duration = (Date.now() - startTime.getTime()) / 1000;
      console.log(`✅ [SCHEDULER] Rappels terminés en ${duration.toFixed(2)}s`);
      console.log(`📊 [SCHEDULER] Résultats: ${stats.totalSuccess} succès, ${stats.totalFailure} échecs, ${stats.totalSkipped} ignorés`);

      this.lastRun = startTime;
    } catch (error) {
      console.error('❌ [SCHEDULER] Erreur lors de l\'envoi des rappels:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Démarre le scheduler automatique
   * @param {boolean} runImmediately - Si true, exécute immédiatement, sinon attend le prochain horaire
   */
  static start(runImmediately = false) {
    // Vérifier si le scheduler est activé via variable d'environnement
    if (process.env.REMINDER_SCHEDULER_ENABLED === 'false') {
      console.log('ℹ️  [SCHEDULER] Scheduler des rappels désactivé (REMINDER_SCHEDULER_ENABLED=false)');
      return;
    }

    if (this.intervalId) {
      console.log('⚠️  [SCHEDULER] Scheduler déjà démarré');
      return;
    }

    console.log('🔄 [SCHEDULER] Démarrage du scheduler automatique des rappels...');

    // Exécuter immédiatement si demandé (pour les tests)
    if (runImmediately) {
      console.log('⚡ [SCHEDULER] Exécution immédiate activée');
      this.executeReminders();
    }

    // Programmer la première exécution
    const scheduleNextRun = () => {
      const delay = this.getDelayUntilNextRun();
      const nextRun = this.getNextRunTime();

      console.log(`⏰ [SCHEDULER] Prochaine exécution programmée: ${nextRun.toLocaleString()}`);
      console.log(`⏳ [SCHEDULER] Délai: ${Math.round(delay / 1000 / 60)} minutes`);

      // Utiliser setTimeout pour la première exécution
      setTimeout(() => {
        this.executeReminders();

        // Ensuite, programmer une exécution quotidienne (24 heures)
        this.intervalId = setInterval(() => {
          this.executeReminders();
        }, 24 * 60 * 60 * 1000); // 24 heures en millisecondes

        console.log('✅ [SCHEDULER] Scheduler configuré pour s\'exécuter quotidiennement à 9h00');
      }, delay);
    };

    scheduleNextRun();
  }

  /**
   * Arrête le scheduler
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 [SCHEDULER] Scheduler arrêté');
    }
  }

  /**
   * Obtient le statut du scheduler
   */
  static getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.intervalId !== null,
      lastRun: this.lastRun,
      nextRun: this.intervalId ? this.getNextRunTime() : null
    };
  }
}

module.exports = ReminderScheduler;

