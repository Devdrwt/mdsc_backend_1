require('dotenv').config();
const { pool } = require('../src/config/database');
const ProgressService = require('../src/services/progressService');

async function recalculateAllProgress() {
  try {
    console.log('📊 Recalcul de la progression de tous les enrollments...\n');
    
    // Récupérer tous les enrollments actifs
    const [enrollments] = await pool.execute(
      'SELECT id, user_id, course_id, progress_percentage FROM enrollments WHERE is_active = TRUE'
    );
    
    console.log(`📝 ${enrollments.length} enrollment(s) trouvé(s)\n`);
    
    let corrected = 0;
    let unchanged = 0;
    
    for (const enrollment of enrollments) {
      try {
        const oldProgress = enrollment.progress_percentage;
        
        // Recalculer la progression
        const result = await ProgressService.updateCourseProgress(enrollment.id);
        
        const newProgress = result.progress_percentage;
        
        if (oldProgress !== newProgress) {
          console.log(`✅ Enrollment ${enrollment.id} (User: ${enrollment.user_id}, Course: ${enrollment.course_id})`);
          console.log(`   Ancienne progression: ${oldProgress}% → Nouvelle progression: ${newProgress}%`);
          corrected++;
        } else {
          unchanged++;
        }
      } catch (error) {
        console.error(`❌ Erreur pour enrollment ${enrollment.id}:`, error.message);
      }
    }
    
    console.log(`\n📊 Résumé:`);
    console.log(`   ✅ ${corrected} enrollment(s) corrigé(s)`);
    console.log(`   ℹ️  ${unchanged} enrollment(s) inchangé(s)\n`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await pool.end();
  }
}

recalculateAllProgress();

