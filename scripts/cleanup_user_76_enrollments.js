/**
 * Script de nettoyage complet des inscriptions de l'utilisateur 76
 * Ce script désactive toutes les inscriptions et supprime toutes les données de progression
 * 
 * Usage: node scripts/cleanup_user_76_enrollments.js
 */

require('dotenv').config();
const { pool } = require('../src/config/database');

const USER_ID = 76;

async function cleanupUserEnrollments() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('✅ Connexion à la base de données établie\n');

    // 1. Afficher les inscriptions actuelles avant nettoyage
    console.log('📋 Inscriptions actuelles de l\'utilisateur 76:');
    const [currentEnrollments] = await connection.execute(
      `SELECT 
        e.id as enrollment_id,
        e.course_id,
        c.title as course_title,
        e.is_active,
        e.status,
        e.progress_percentage,
        e.enrolled_at,
        e.completed_at
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ?`,
      [USER_ID]
    );

    if (currentEnrollments.length === 0) {
      console.log('ℹ️  Aucune inscription trouvée pour l\'utilisateur 76');
      return;
    }

    console.table(currentEnrollments);
    console.log(`\n📊 Total: ${currentEnrollments.length} inscription(s)\n`);

    // 2. Récupérer les IDs des inscriptions
    const [enrollmentIds] = await connection.execute(
      'SELECT id FROM enrollments WHERE user_id = ?',
      [USER_ID]
    );
    const enrollmentIdList = enrollmentIds.map(e => e.id);

    if (enrollmentIdList.length === 0) {
      console.log('ℹ️  Aucune inscription à nettoyer');
      return;
    }

    console.log(`🔍 ${enrollmentIdList.length} inscription(s) trouvée(s) pour nettoyage\n`);

    // 3. Compter les données de progression avant suppression
    let progressRecords = 0;
    if (enrollmentIdList.length > 0) {
      const placeholders = enrollmentIdList.map(() => '?').join(',');
      const [progressCount] = await connection.execute(
        `SELECT COUNT(*) as count FROM progress WHERE enrollment_id IN (${placeholders})`,
        enrollmentIdList
      );
      progressRecords = progressCount[0]?.count || 0;
    }

    const [lessonProgressCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = ?',
      [USER_ID]
    );
    const lessonProgressRecords = lessonProgressCount[0]?.count || 0;

    console.log(`📊 Données à supprimer:`);
    console.log(`   - Progression (progress): ${progressRecords} enregistrement(s)`);
    console.log(`   - Progression des leçons (lesson_progress): ${lessonProgressRecords} enregistrement(s)\n`);

    // Démarrer une transaction
    await connection.beginTransaction();
    console.log('🔄 Démarrage de la transaction...\n');

    // 4. Supprimer toutes les données de progression (progress)
    if (enrollmentIdList.length > 0) {
      const placeholders = enrollmentIdList.map(() => '?').join(',');
      const [progressResult] = await connection.execute(
        `DELETE FROM progress WHERE enrollment_id IN (${placeholders})`,
        enrollmentIdList
      );
      console.log(`✅ Progression supprimée: ${progressResult.affectedRows} enregistrement(s)`);
    }

    // 5. Supprimer toutes les données de progression des leçons (lesson_progress)
    const [lessonProgressResult] = await connection.execute(
      'DELETE FROM lesson_progress WHERE user_id = ?',
      [USER_ID]
    );
    console.log(`✅ Progression des leçons supprimée: ${lessonProgressResult.affectedRows} enregistrement(s)`);

    // 6. Désactiver toutes les inscriptions
    // Note: Le statut reste inchangé, on désactive seulement avec is_active = FALSE
    const [enrollmentResult] = await connection.execute(
      `UPDATE enrollments 
       SET is_active = FALSE
       WHERE user_id = ?`,
      [USER_ID]
    );
    console.log(`✅ Inscriptions désactivées: ${enrollmentResult.affectedRows} inscription(s)\n`);

    // Valider la transaction
    await connection.commit();
    console.log('✅ Transaction validée avec succès !\n');

    // 7. Afficher le résultat final
    console.log('📊 Résumé du nettoyage:');
    const [finalStats] = await connection.execute(
      `SELECT 
        COUNT(*) as total_enrollments,
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_enrollments,
        SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive_enrollments
      FROM enrollments 
      WHERE user_id = ?`,
      [USER_ID]
    );

    console.table(finalStats[0]);

    // 8. Vérifier qu'il n'y a plus de progression
    let remainingProgressCount = 0;
    if (enrollmentIdList.length > 0) {
      const placeholders = enrollmentIdList.map(() => '?').join(',');
      const [remainingProgress] = await connection.execute(
        `SELECT COUNT(*) as count FROM progress WHERE enrollment_id IN (${placeholders})`,
        enrollmentIdList
      );
      remainingProgressCount = remainingProgress[0]?.count || 0;
    }

    const [remainingLessonProgress] = await connection.execute(
      'SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = ?',
      [USER_ID]
    );

    console.log('\n🔍 Vérification finale:');
    console.log(`   - Progression restante (progress): ${remainingProgressCount} enregistrement(s)`);
    console.log(`   - Progression des leçons restante: ${remainingLessonProgress[0]?.count || 0} enregistrement(s)`);

    if (remainingProgressCount === 0 && (remainingLessonProgress[0]?.count || 0) === 0) {
      console.log('\n✅ Nettoyage complet réussi ! Toutes les données de progression ont été supprimées.');
      console.log('💡 L\'utilisateur 76 peut maintenant s\'inscrire à nouveau aux formations.');
    } else {
      console.log('\n⚠️  Certaines données de progression peuvent encore exister.');
    }

    console.log('\n📝 Note: Les certificats et badges sont conservés car ils représentent des accomplissements permanents.');

  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.error('❌ Erreur lors du nettoyage, transaction annulée');
    }
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Exécuter le script
cleanupUserEnrollments()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });

