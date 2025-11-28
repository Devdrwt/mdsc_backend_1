#!/usr/bin/env node

/**
 * Script pour envoyer automatiquement les rappels de cours en progression
 * À exécuter via cron job (par exemple, tous les jours à 9h00)
 * 
 * Exemple de configuration cron :
 * 0 9 * * * cd /path/to/mdsc_auth_api && node scripts/sendCourseReminders.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const CourseReminderService = require('../src/services/courseReminderService');

async function main() {
  console.log('🚀 Démarrage du script de rappel des cours en progression...');
  console.log(`📅 Date: ${new Date().toISOString()}`);

  try {
    const stats = await CourseReminderService.sendAllReminders();

    console.log('\n📊 Statistiques finales:');
    console.log(`   Total d'enrollments traités: ${stats.totalEnrollments}`);
    console.log(`   Rappels envoyés avec succès: ${stats.totalSuccess}`);
    console.log(`   Échecs: ${stats.totalFailure}`);
    console.log(`   Ignorés (déjà envoyés): ${stats.totalSkipped}`);

    console.log('\n📋 Détails par période:');
    stats.periods.forEach(period => {
      console.log(`   ${period.period} jours: ${period.success} succès, ${period.failure} échecs, ${period.skipped} ignorés`);
    });

    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution du script:', error);
    process.exit(1);
  }
}

// Exécuter le script
main();

