/**
 * Script complet pour configurer les prérequis de cours par catégorie
 * 1. Met à jour les category_id des cours pour pointer vers les catégories existantes
 * 2. Définit les prérequis selon la difficulté dans chaque catégorie
 */

const { pool } = require('../src/config/database');

async function setupPrerequisitesComplete() {
  console.log('🔗 Configuration complète des cours prérequis\n');
  console.log('=' .repeat(60));
  
  try {
    // Étape 1: Récupérer les catégories disponibles
    const [categories] = await pool.execute('SELECT id, name FROM categories WHERE is_active = 1 ORDER BY id');
    
    if (categories.length === 0) {
      console.log('⚠️  Aucune catégorie trouvée. Veuillez d\'abord créer des catégories.');
      await pool.end();
      return;
    }
    
    console.log(`📋 ${categories.length} catégorie(s) disponible(s):\n`);
    categories.forEach(cat => {
      console.log(`   - ID ${cat.id}: "${cat.name}"`);
    });
    
    // Étape 2: Récupérer tous les cours
    const [allCourses] = await pool.execute(`
      SELECT 
        c.id, 
        c.title, 
        c.difficulty, 
        c.category_id, 
        c.prerequisite_course_id
      FROM courses c
      ORDER BY c.id
    `);
    
    if (allCourses.length === 0) {
      console.log('\n⚠️  Aucun cours trouvé dans la base de données');
      await pool.end();
      return;
    }
    
    console.log(`\n📚 ${allCourses.length} cours trouvé(s)\n`);
    console.log('=' .repeat(60));
    
    // Étape 3: Mapper les cours aux catégories (par titre ou catégorie existante)
    // Mapping intelligent basé sur les mots-clés dans le titre
    const categoryMapping = {
      'Développement Web': ['javascript', 'react', 'node', 'web', 'développement', 'backend', 'frontend'],
      'Design': ['design', 'ui', 'ux', 'graphique'],
      'Marketing Digital': ['marketing', 'digital'],
      'Gestion de Projet': ['projet', 'management', 'gestion'],
      'Entrepreneuriat': ['entrepreneur', 'business'],
      'Compétences Transversales': ['compétence', 'transversal', 'soft skill'],
      'Éducation': ['éducation', 'formation'],
      'Gouvernance': ['gouvernance', 'leadership'],
      'Environnement': ['environnement', 'développement durable'],
      'Économie': ['économie', 'financier'],
      'Santé': ['santé', 'bien-être'],
      'Communication': ['communication', 'médias'],
      'Leadership': ['leadership']
    };
    
    let coursesAssigned = 0;
    
    console.log('\n🔗 Attribution des catégories aux cours...\n');
    
    for (const course of allCourses) {
      let assignedCategoryId = course.category_id;
      
      // Si le cours n'a pas de catégorie ou catégorie invalide, essayer de la trouver
      if (!assignedCategoryId || !categories.find(c => c.id === assignedCategoryId)) {
        const courseTitleLower = (course.title || '').toLowerCase();
        
        // Chercher une correspondance par mots-clés
        for (const [categoryName, keywords] of Object.entries(categoryMapping)) {
          const foundCategory = categories.find(c => c.name === categoryName);
          if (!foundCategory) continue;
          
          if (keywords.some(keyword => courseTitleLower.includes(keyword))) {
            assignedCategoryId = foundCategory.id;
            await pool.execute(
              'UPDATE courses SET category_id = ? WHERE id = ?',
              [assignedCategoryId, course.id]
            );
            console.log(`   ✅ "${course.title}" → Catégorie: "${categoryName}"`);
            coursesAssigned++;
            break;
          }
        }
        
        // Si aucune correspondance, assigner à "Développement Web" par défaut (si existe)
        if (!assignedCategoryId || !categories.find(c => c.id === assignedCategoryId)) {
          const defaultCategory = categories.find(c => c.name === 'Développement Web');
          if (defaultCategory) {
            await pool.execute(
              'UPDATE courses SET category_id = ? WHERE id = ?',
              [defaultCategory.id, course.id]
            );
            console.log(`   ✅ "${course.title}" → Catégorie par défaut: "Développement Web"`);
            coursesAssigned++;
          }
        }
      }
    }
    
    if (coursesAssigned > 0) {
      console.log(`\n📊 ${coursesAssigned} cours assigné(s) à des catégories\n`);
    }
    
    // Étape 4: Réinitialiser tous les prérequis existants (optionnel)
    console.log('🔄 Réinitialisation des prérequis...\n');
    await pool.execute('UPDATE courses SET prerequisite_course_id = NULL');
    console.log('   ✅ Tous les prérequis réinitialisés\n');
    
    // Étape 5: Créer les prérequis par catégorie
    console.log('🔗 Création des prérequis par catégorie...\n');
    
    // Récupérer les cours avec leurs catégories mises à jour
    const [coursesWithCategories] = await pool.execute(`
      SELECT 
        c.id, 
        c.title, 
        c.difficulty, 
        c.category_id, 
        cat.name as category_name
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.category_id IS NOT NULL
      ORDER BY c.category_id, 
        CASE c.difficulty 
          WHEN 'beginner' THEN 1 
          WHEN 'intermediate' THEN 2 
          WHEN 'advanced' THEN 3 
          ELSE 4 
        END,
        c.id
    `);
    
    // Grouper par catégorie
    const coursesByCategory = {};
    coursesWithCategories.forEach(course => {
      const catId = course.category_id;
      const catName = course.category_name || 'Sans catégorie';
      
      if (!coursesByCategory[catId]) {
        coursesByCategory[catId] = {
          name: catName,
          courses: []
        };
      }
      coursesByCategory[catId].courses.push(course);
    });
    
    let updated = 0;
    
    for (const [categoryId, categoryData] of Object.entries(coursesByCategory)) {
      const sortedCourses = categoryData.courses;
      
      if (sortedCourses.length < 2) {
        console.log(`   ⏭️  "${categoryData.name}": Pas assez de cours (${sortedCourses.length})`);
        continue;
      }
      
      console.log(`\n📁 Catégorie: "${categoryData.name}" (${sortedCourses.length} cours)`);
      
      // Créer une chaîne de prérequis
      for (let i = 1; i < sortedCourses.length; i++) {
        const currentCourse = sortedCourses[i];
        const prerequisiteCourse = sortedCourses[i - 1];
        
        // Définir le prérequis
        await pool.execute(
          'UPDATE courses SET prerequisite_course_id = ? WHERE id = ?',
          [prerequisiteCourse.id, currentCourse.id]
        );
        
        console.log(`   ✅ "${currentCourse.title}" (${currentCourse.difficulty || 'N/A'})`);
        console.log(`      → Prérequis: "${prerequisiteCourse.title}" (${prerequisiteCourse.difficulty || 'N/A'})`);
        updated++;
      }
    }
    
    // Résultats finaux
    console.log('\n' + '=' .repeat(60));
    console.log(`\n📊 Résumé:`);
    console.log(`   - ${coursesAssigned} cours assigné(s) à des catégories`);
    console.log(`   - ${updated} prérequis créé(s)\n`);
    
    // Afficher la structure finale
    console.log('📋 Structure finale des prérequis par catégorie:\n');
    
    const [finalStructure] = await pool.execute(`
      SELECT 
        cat.name as category_name,
        c.id,
        c.title,
        c.difficulty,
        p.title as prerequisite_title
      FROM courses c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN courses p ON c.prerequisite_course_id = p.id
      WHERE c.category_id IS NOT NULL
      ORDER BY c.category_id, c.difficulty, c.id
    `);
    
    let currentCategory = null;
    finalStructure.forEach(course => {
      if (course.category_name !== currentCategory) {
        currentCategory = course.category_name;
        console.log(`\n📁 ${currentCategory}:`);
      }
      if (course.prerequisite_title) {
        console.log(`   ├─ "${course.title}" (${course.difficulty || 'N/A'})`);
        console.log(`   │  → Prérequis: "${course.prerequisite_title}"`);
      } else {
        console.log(`   └─ "${course.title}" (${course.difficulty || 'N/A'}) [Début de chaîne]`);
      }
    });
    
    console.log('\n✅ Configuration terminée avec succès !\n');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupPrerequisitesComplete().catch(console.error);

