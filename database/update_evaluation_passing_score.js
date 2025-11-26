/*
  Script pour mettre à jour le score minimum de passage de l'évaluation finale
  Usage: node database/update_evaluation_passing_score.js
*/
require('dotenv').config({ override: true });
const { pool } = require('../src/config/database');

async function updatePassingScore() {
  try {
    console.log('🔍 Recherche de l\'évaluation finale "Développement Web Full Stack"...');
    
    // Trouver l'évaluation
    const [evaluations] = await pool.execute(
      `SELECT ce.id, ce.title, ce.passing_score, c.title as course_title, 
              (SELECT SUM(points) FROM quiz_questions WHERE course_evaluation_id = ce.id AND is_active = TRUE) as total_points
       FROM course_evaluations ce
       JOIN courses c ON ce.course_id = c.id
       WHERE c.title LIKE '%Développement Web Full Stack%' 
       LIMIT 1`
    );

    if (evaluations.length === 0) {
      console.error('❌ Évaluation non trouvée');
      process.exit(1);
    }

    const evaluation = evaluations[0];
    const totalPoints = evaluation.total_points || 15; // Par défaut 15 points
    const newPassingScore = 10; // 10 points minimum
    
    // Calculer le pourcentage équivalent (10 points sur 15 = 66.67%)
    const percentageEquivalent = Math.round((newPassingScore / totalPoints) * 100);
    
    console.log(`\n📊 Évaluation trouvée:`);
    console.log(`   ID: ${evaluation.id}`);
    console.log(`   Titre: ${evaluation.title}`);
    console.log(`   Cours: ${evaluation.course_title}`);
    console.log(`   Score actuel: ${evaluation.passing_score}%`);
    console.log(`   Total de points: ${totalPoints}`);
    console.log(`\n🔄 Mise à jour:`);
    console.log(`   Nouveau score minimum: ${newPassingScore} points (${percentageEquivalent}%)`);
    
    // Mettre à jour le passing_score
    await pool.execute(
      'UPDATE course_evaluations SET passing_score = ? WHERE id = ?',
      [percentageEquivalent, evaluation.id]
    );
    
    console.log(`\n✅ Score minimum mis à jour avec succès !`);
    console.log(`   Le score minimum est maintenant de ${newPassingScore} points (${percentageEquivalent}%) sur ${totalPoints} points total.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

updatePassingScore();

