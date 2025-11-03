/**
 * Script pour définir les cours prérequis dans la base de données
 * Basé sur les catégories et les niveaux de difficulté
 */

const { pool } = require('../src/config/database');

async function setupPrerequisites() {
  console.log('🔗 Configuration des cours prérequis par catégorie\n');
  console.log('=' .repeat(60));
  
  try {
    // Récupérer tous les cours avec leurs informations
    const [courses] = await pool.execute(`
      SELECT 
        c.id, 
        c.title, 
        c.difficulty, 
        c.category_id, 
        c.prerequisite_course_id,
        cat.name as category_name
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      ORDER BY c.category_id, c.difficulty, c.id
    `);
    
    if (courses.length === 0) {
      console.log('⚠️  Aucun cours trouvé dans la base de données');
      await pool.end();
      return;
    }
    
    console.log(`📋 ${courses.length} cours trouvé(s)\n`);
    
    // Grouper les cours par catégorie
    const coursesByCategory = {};
    courses.forEach(course => {
      const catId = course.category_id || 'uncategorized';
      const catName = course.category_name || 'Sans catégorie';
      
      if (!coursesByCategory[catId]) {
        coursesByCategory[catId] = {
          name: catName,
          courses: []
        };
      }
      coursesByCategory[catId].courses.push(course);
    });
    
    console.log('📊 Répartition par catégorie:\n');
    Object.entries(coursesByCategory).forEach(([catId, data]) => {
      console.log(`   ${data.name} (${data.courses.length} cours)`);
    });
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n🔗 Établissement des prérequis...\n');
    
    let updated = 0;
    let skipped = 0;
    
    // Pour chaque catégorie, créer une chaîne de prérequis basée sur la difficulté
    for (const [categoryId, categoryData] of Object.entries(coursesByCategory)) {
      const categoryCourses = categoryData.courses;
      
      if (categoryCourses.length < 2) {
        console.log(`   ⏭️  "${categoryData.name}": Pas assez de cours pour créer des prérequis (${categoryCourses.length} cours)`);
        continue;
      }
      
      // Trier par difficulté : beginner -> intermediate -> advanced
      const difficultyOrder = { 'beginner': 1, 'intermediate': 2, 'advanced': 3 };
      const sortedCourses = categoryCourses.sort((a, b) => {
        const aOrder = difficultyOrder[a.difficulty] || 0;
        const bOrder = difficultyOrder[b.difficulty] || 0;
        
        // Si même difficulté, trier par ID
        if (aOrder === bOrder) {
          return a.id - b.id;
        }
        return aOrder - bOrder;
      });
      
      console.log(`\n📁 Catégorie: "${categoryData.name}" (${sortedCourses.length} cours)`);
      
      // Créer une chaîne de prérequis
      for (let i = 1; i < sortedCourses.length; i++) {
        const currentCourse = sortedCourses[i];
        const prerequisiteCourse = sortedCourses[i - 1];
        
        // Ne pas créer de prérequis si le cours actuel a déjà un prérequis défini
        if (currentCourse.prerequisite_course_id) {
          console.log(`   ⏭️  "${currentCourse.title}" (ID: ${currentCourse.id}) a déjà un prérequis`);
          skipped++;
          continue;
        }
        
        // Vérifier qu'on ne crée pas de cycle (le prérequis ne doit pas avoir le cours actuel comme prérequis)
        let hasCycle = false;
        let checkPrereq = prerequisiteCourse.id;
        const checked = new Set([currentCourse.id]);
        
        while (checkPrereq) {
          if (checked.has(checkPrereq)) {
            hasCycle = true;
            break;
          }
          checked.add(checkPrereq);
          
          const [prereqInfo] = await pool.execute(
            'SELECT prerequisite_course_id FROM courses WHERE id = ?',
            [checkPrereq]
          );
          
          if (prereqInfo.length > 0) {
            checkPrereq = prereqInfo[0].prerequisite_course_id;
          } else {
            break;
          }
        }
        
        if (hasCycle) {
          console.log(`   ⚠️  Cycle détecté pour "${currentCourse.title}" - prérequis ignoré`);
          continue;
        }
        
        // Définir le prérequis
        await pool.execute(
          'UPDATE courses SET prerequisite_course_id = ? WHERE id = ?',
          [prerequisiteCourse.id, currentCourse.id]
        );
        
        console.log(`   ✅ "${currentCourse.title}" (ID: ${currentCourse.id}, ${currentCourse.difficulty || 'N/A'})`);
        console.log(`      → Prérequis: "${prerequisiteCourse.title}" (ID: ${prerequisiteCourse.id}, ${prerequisiteCourse.difficulty || 'N/A'})`);
        updated++;
      }
    }
    
    // Afficher les résultats finaux
    console.log('\n' + '=' .repeat(60));
    console.log(`\n📊 Résumé:`);
    console.log(`   - ${updated} cours mis à jour avec des prérequis`);
    console.log(`   - ${skipped} cours ignorés (prérequis déjà défini)`);
    console.log('');
    
    console.log('📋 Vue d\'ensemble des prérequis:\n');
    
    const [coursesWithPrereq] = await pool.execute(`
      SELECT 
        c.id,
        c.title,
        c.difficulty,
        c.prerequisite_course_id,
        p.title as prerequisite_title,
        p.difficulty as prerequisite_difficulty,
        cat.name as category_name
      FROM courses c
      LEFT JOIN courses p ON c.prerequisite_course_id = p.id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.prerequisite_course_id IS NOT NULL
      ORDER BY c.category_id, c.difficulty
    `);
    
    if (coursesWithPrereq.length > 0) {
      let currentCategory = null;
      coursesWithPrereq.forEach(course => {
        if (course.category_name !== currentCategory) {
          currentCategory = course.category_name;
          console.log(`\n📁 ${currentCategory || 'Sans catégorie'}:`);
        }
        console.log(`   - "${course.title}" (${course.difficulty || 'N/A'})`);
        console.log(`     → Prérequis: "${course.prerequisite_title}" (${course.prerequisite_difficulty || 'N/A'})`);
      });
    } else {
      console.log('   ⚠️  Aucun cours avec prérequis trouvé');
    }
    
    // Statistiques
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_courses,
        COUNT(prerequisite_course_id) as courses_with_prerequisite,
        COUNT(DISTINCT category_id) as categories_count
      FROM courses
    `);
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 Statistiques globales:');
    console.log(`   - Total cours: ${stats[0].total_courses}`);
    console.log(`   - Cours avec prérequis: ${stats[0].courses_with_prerequisite}`);
    console.log(`   - Cours sans prérequis: ${stats[0].total_courses - stats[0].courses_with_prerequisite}`);
    console.log(`   - Catégories: ${stats[0].categories_count}`);
    
    console.log('\n✅ Configuration des prérequis terminée !\n');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupPrerequisites().catch(console.error);

