/**
 * Script complet pour corriger tous les problèmes d'encodage UTF-8 dans la base de données
 * Identifie et corrige toutes les données avec des caractères mal encodés
 */

const { pool } = require('../src/config/database');

// Mapping des corrections pour les données courantes
const commonFixes = {
  // Catégories
  'D??veloppement': 'Développement',
  'Comp??tences': 'Compétences',
  'Ôö£├½ducation': 'Éducation',
  'Ôö£├½conomie': 'Économie',
  'SantÔö£┬«': 'Santé',
  'Sant├®': 'Santé',
  'D├®veloppement': 'Développement',
  'Comp├®tences': 'Compétences',
  '├ëducation': 'Éducation',
  '├ëconomie': 'Économie',
  '?tudiant': 'Étudiant',
  'Engag??': 'Engagé',
  'MÔö£┬«thodologies': 'Méthodologies',
  'StratÔö£┬«gies': 'Stratégies',
  'rÔö£┬«seaux': 'réseaux',
  'CrÔö£┬«ation': 'Création',
  'dÔö£┬«veloppement': 'développement',
  'DÔö£┬«veloppement': 'Développement',
  'Ôö£┬«ducation': 'éducation',
  'Ôö£┬«conomique': 'économique',
  'financiÔö£┬┐re': 'financière',
};

// Tables à vérifier avec leurs colonnes de texte
const tablesToFix = [
  { table: 'categories', columns: ['name', 'description'] },
  { table: 'courses', columns: ['title', 'description', 'short_description'] },
  { table: 'badges', columns: ['name', 'description'] },
  { table: 'lessons', columns: ['title', 'description', 'content'] },
  { table: 'modules', columns: ['title', 'description'] },
  { table: 'course_reviews', columns: ['comment'] },
  { table: 'users', columns: ['first_name', 'last_name', 'organization'] },
];

async function findCorruptedData() {
  console.log('🔍 Recherche des données corrompues...\n');
  
  const corrupted = [];
  
  for (const { table, columns } of tablesToFix) {
    for (const column of columns) {
      try {
        // Chercher les enregistrements avec des caractères suspects
        const [rows] = await pool.execute(
          `SELECT id, ${column} FROM ${table} WHERE ${column} LIKE '%?%' OR ${column} LIKE '%Ôö£%' OR ${column} LIKE '%├%'`
        );
        
        if (rows.length > 0) {
          corrupted.push({
            table,
            column,
            count: rows.length,
            examples: rows.slice(0, 5).map(r => ({ id: r.id, value: r[column] }))
          });
        }
      } catch (error) {
        console.log(`⚠️  Erreur lors de la vérification de ${table}.${column}:`, error.message);
      }
    }
  }
  
  return corrupted;
}

async function fixCorruptedData(corrupted) {
  console.log('🔧 Correction des données corrompues...\n');
  
  let totalFixed = 0;
  
  for (const { table, column, examples } of corrupted) {
    console.log(`📋 Table: ${table}, Colonne: ${column}`);
    
    for (const example of examples) {
      let fixedValue = example.value;
      let wasFixed = false;
      
      // Appliquer les corrections courantes
      for (const [wrong, correct] of Object.entries(commonFixes)) {
        if (fixedValue.includes(wrong)) {
          fixedValue = fixedValue.replace(new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
          wasFixed = true;
        }
      }
      
      // Si la valeur a été corrigée, mettre à jour
      if (wasFixed && fixedValue !== example.value) {
        try {
          await pool.execute(
            `UPDATE ${table} SET ${column} = ? WHERE id = ?`,
            [fixedValue, example.id]
          );
          console.log(`   ✅ ID ${example.id}: "${example.value}" → "${fixedValue}"`);
          totalFixed++;
        } catch (error) {
          console.log(`   ❌ Erreur pour ID ${example.id}:`, error.message);
        }
      }
    }
  }
  
  return totalFixed;
}

async function fixAllCategories() {
  console.log('\n📝 Correction spécifique des catégories...\n');
  
  const categoryFixes = [
    { id: 1, name: 'Développement Web', description: 'Cours de programmation web et frameworks modernes' },
    { id: 2, name: 'Gestion de Projet', description: 'Formation en management et méthodologies de projet' },
    { id: 3, name: 'Marketing Digital', description: 'Stratégies marketing et réseaux sociaux' },
    { id: 4, name: 'Entrepreneuriat', description: 'Création et gestion d\'entreprise' },
    { id: 5, name: 'Compétences Transversales', description: 'Soft skills et développement personnel' },
    { id: 6, name: 'Éducation', description: 'Cours de formation et d\'éducation pour la société civile' },
    { id: 7, name: 'Gouvernance', description: 'Formation en gouvernance et leadership' },
    { id: 8, name: 'Environnement', description: 'Cours sur l\'environnement et le développement durable' },
    { id: 9, name: 'Économie', description: 'Formation économique et financière' },
    { id: 10, name: 'Santé', description: 'Cours sur la santé publique et le bien-être' },
    { id: 11, name: 'Design', description: 'Formation en design graphique et UI/UX' },
    { id: 12, name: 'Communication', description: 'Cours de communication et médias' },
    { id: 13, name: 'Leadership', description: 'Développement des compétences en leadership' },
  ];
  
  let fixed = 0;
  
  for (const fix of categoryFixes) {
    try {
      const [existing] = await pool.execute('SELECT id, name, description FROM categories WHERE id = ?', [fix.id]);
      
      if (existing.length > 0) {
        const current = existing[0];
        if (current.name !== fix.name || (current.description !== fix.description && fix.description)) {
          await pool.execute(
            'UPDATE categories SET name = ?, description = ? WHERE id = ?',
            [fix.name, fix.description, fix.id]
          );
          console.log(`   ✅ Catégorie ID ${fix.id}: "${fix.name}"`);
          fixed++;
        }
      }
    } catch (error) {
      console.log(`   ❌ Erreur pour catégorie ID ${fix.id}:`, error.message);
    }
  }
  
  return fixed;
}

async function fixAllBadges() {
  console.log('\n🏆 Correction spécifique des badges...\n');
  
  const badgeFixes = [
    { id: 1, name: 'Premier Pas', description: 'Première connexion sur la plateforme' },
    { id: 2, name: 'Étudiant Assidu', description: 'Compléter 5 cours' },
    { id: 3, name: 'Expert', description: 'Compléter 10 cours' },
    { id: 4, name: 'Marathonien', description: 'Étudier 7 jours consécutifs' },
    { id: 5, name: 'Social', description: 'Participer à 5 discussions' },
    { id: 6, name: 'Perfectionniste', description: 'Obtenir 100% dans un cours' },
    { id: 7, name: 'Explorateur', description: 'Découvrir 3 nouvelles catégories' },
    { id: 8, name: 'Premiers pas', description: 'Compléter son profil utilisateur' },
    { id: 9, name: 'Explorateur MdSC', description: 'Visiter au moins 3 pages différentes' },
    { id: 10, name: 'Engagé', description: 'S\'inscrire à son premier cours' },
    { id: 11, name: 'Marathonien', description: 'Compléter 5 cours' },
  ];
  
  let fixed = 0;
  
  for (const fix of badgeFixes) {
    try {
      const [existing] = await pool.execute('SELECT id, name, description FROM badges WHERE id = ?', [fix.id]);
      
      if (existing.length > 0) {
        const current = existing[0];
        if (current.name !== fix.name || (current.description !== fix.description && fix.description)) {
          await pool.execute(
            'UPDATE badges SET name = ?, description = ? WHERE id = ?',
            [fix.name, fix.description, fix.id]
          );
          console.log(`   ✅ Badge ID ${fix.id}: "${fix.name}"`);
          fixed++;
        }
      }
    } catch (error) {
      console.log(`   ❌ Erreur pour badge ID ${fix.id}:`, error.message);
    }
  }
  
  return fixed;
}

async function verifyAllData() {
  console.log('\n🔍 Vérification finale...\n');
  
  let totalProblems = 0;
  
  for (const { table, columns } of tablesToFix) {
    for (const column of columns) {
      try {
        const [rows] = await pool.execute(
          `SELECT COUNT(*) as count FROM ${table} WHERE ${column} LIKE '%?%' OR ${column} LIKE '%Ôö£%' OR ${column} LIKE '%├%'`
        );
        
        if (rows[0].count > 0) {
          console.log(`   ⚠️  ${table}.${column}: ${rows[0].count} problème(s) restant(s)`);
          totalProblems += rows[0].count;
        }
      } catch (error) {
        // Ignore les erreurs de colonnes qui n'existent pas
      }
    }
  }
  
  if (totalProblems === 0) {
    console.log('   ✅ Toutes les données sont correctement encodées en UTF-8');
  } else {
    console.log(`   ⚠️  ${totalProblems} problème(s) restant(s)`);
  }
  
  return totalProblems;
}

async function main() {
  console.log('🔧 Script complet de correction UTF-8\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Rechercher les données corrompues
    const corrupted = await findCorruptedData();
    
    if (corrupted.length > 0) {
      console.log(`\n📊 ${corrupted.length} type(s) de données corrompues trouvé(s)\n`);
      
      // 2. Corriger les données corrompues
      const fixed = await fixCorruptedData(corrupted);
      console.log(`\n✅ ${fixed} enregistrement(s) corrigé(s)\n`);
    }
    
    // 3. Correction spécifique des catégories
    const categoriesFixed = await fixAllCategories();
    console.log(`📊 ${categoriesFixed} catégorie(s) mise(s) à jour\n`);
    
    // 4. Correction spécifique des badges
    const badgesFixed = await fixAllBadges();
    console.log(`📊 ${badgesFixed} badge(s) mis à jour\n`);
    
    // 5. Vérification finale
    const remainingProblems = await verifyAllData();
    
    console.log('\n' + '=' .repeat(60));
    if (remainingProblems === 0) {
      console.log('\n✅ TOUTES LES DONNÉES SONT CORRECTEMENT ENCODÉES EN UTF-8\n');
    } else {
      console.log(`\n⚠️  ${remainingProblems} problème(s) restant(s) nécessitant une attention manuelle\n`);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

