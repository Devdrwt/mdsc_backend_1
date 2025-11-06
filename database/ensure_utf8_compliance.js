/**
 * Script de vérification et correction continue UTF-8
 * À exécuter périodiquement pour s'assurer que toutes les données sont correctement encodées
 */

const { pool } = require('../src/config/database');

// Caractères suspects indiquant une mauvaise encodage
const suspiciousPatterns = [
  /[?]{2,}/g,           // Plusieurs ? consécutifs
  /Ôö£/g,               // Caractère de corruption commun
  /├/g,                 // Autre caractère de corruption
  /â€™/g,               // Apostrophe mal encodée
  /â€œ/g,               // Guillemets mal encodés
  /â€\x9d/g,           // Guillemets mal encodés
];

// Corrections automatiques basées sur le contexte
const smartCorrections = {
  // Catégories
  'Développement Web': ['D??veloppement Web', 'D├®veloppement Web', 'DÔö£┬«veloppement Web'],
  'Compétences Transversales': ['Comp??tences Transversales', 'Comp├®tences Transversales'],
  'Éducation': ['Ôö£├½ducation', '├ëducation', 'Ôö£┬«ducation'],
  'Économie': ['Ôö£├½conomie', '├ëconomie', 'Ôö£┬«conomie'],
  'Santé': ['SantÔö£┬«', 'Sant├®', 'Sant?'],
  
  // Mots courants
  'méthodologies': ['mÔö£┬«thodologies', 'm?thodologies'],
  'stratégies': ['stratÔö£┬«gies', 'strat?gies'],
  'réseaux': ['rÔö£┬«seaux', 'r?seaux'],
  'création': ['crÔö£┬«ation', 'cr?ation'],
  'développement': ['dÔö£┬«veloppement', 'd?veloppement'],
  'étudiant': ['?tudiant', 'Ôö£┬«tudiant'],
  'engagé': ['engag??', 'engag?'],
};

async function checkDatabaseEncoding() {
  console.log('🔍 Vérification de l\'encodage de la base de données...\n');
  
  try {
    const [variables] = await pool.execute("SHOW VARIABLES LIKE 'character_set%'");
    const [collation] = await pool.execute("SHOW VARIABLES LIKE 'collation%'");
    
    console.log('📊 Variables de caractères:');
    variables.forEach(v => {
      console.log(`   ${v.Variable_name}: ${v.Value}`);
    });
    
    console.log('\n📊 Collations:');
    collation.forEach(c => {
      console.log(`   ${c.Variable_name}: ${c.Value}`);
    });
    
    // Vérifier que la base utilise utf8mb4
    const dbCharset = variables.find(v => v.Variable_name === 'character_set_database');
    if (dbCharset && dbCharset.Value === 'utf8mb4') {
      console.log('\n✅ Base de données en utf8mb4');
    } else {
      console.log('\n⚠️  Base de données n\'est pas en utf8mb4');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }
}

async function scanAllTables() {
  console.log('\n🔍 Scan de toutes les tables pour détecter les problèmes...\n');
  
  const tables = [
    'categories', 'courses', 'badges', 'lessons', 
    'modules', 'course_reviews', 'users'
  ];
  
  const issues = [];
  
  for (const table of tables) {
    try {
      // Vérifier si la table existe
      const [tableExists] = await pool.execute(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [table]
      );
      
      if (tableExists[0].count === 0) {
        console.log(`   ⏭️  Table ${table} n'existe pas`);
        continue;
      }
      
      // Obtenir les colonnes de texte de la table
      const [columns] = await pool.execute(
        `SELECT COLUMN_NAME, DATA_TYPE 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = ? 
         AND DATA_TYPE IN ('varchar', 'text', 'longtext', 'mediumtext', 'tinytext')`,
        [table]
      );
      
      for (const col of columns) {
        // Chercher les problèmes
        for (const pattern of suspiciousPatterns) {
          const patternStr = pattern.source.replace(/[\/\\^$*+?.()|[\]{}]/g, '');
          const [rows] = await pool.execute(
            `SELECT COUNT(*) as count FROM ${table} 
             WHERE ${col.COLUMN_NAME} REGEXP ?`,
            [patternStr]
          );
          
          if (rows[0].count > 0) {
            issues.push({
              table,
              column: col.COLUMN_NAME,
              pattern: patternStr,
              count: rows[0].count
            });
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Erreur pour table ${table}:`, error.message);
    }
  }
  
  if (issues.length === 0) {
    console.log('   ✅ Aucun problème détecté dans les tables');
  } else {
    console.log(`   ⚠️  ${issues.length} type(s) de problème(s) détecté(s)`);
    issues.forEach(issue => {
      console.log(`      - ${issue.table}.${issue.column}: ${issue.count} occurrence(s) avec "${issue.pattern}"`);
    });
  }
  
  return issues;
}

async function applySmartCorrections() {
  console.log('\n🔧 Application des corrections intelligentes...\n');
  
  let totalFixed = 0;
  
  for (const [correct, variations] of Object.entries(smartCorrections)) {
    for (const wrong of variations) {
      // Chercher dans toutes les tables concernées
      const tables = [
        { table: 'categories', columns: ['name', 'description'] },
        { table: 'courses', columns: ['title', 'description', 'short_description'] },
        { table: 'badges', columns: ['name', 'description'] },
        { table: 'lessons', columns: ['title', 'description'] },
      ];
      
      for (const { table, columns } of tables) {
        for (const column of columns) {
          try {
            const [rows] = await pool.execute(
              `SELECT id, ${column} FROM ${table} WHERE ${column} LIKE ?`,
              [`%${wrong}%`]
            );
            
            for (const row of rows) {
              const newValue = row[column].replace(new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), correct);
              
              if (newValue !== row[column]) {
                await pool.execute(
                  `UPDATE ${table} SET ${column} = ? WHERE id = ?`,
                  [newValue, row.id]
                );
                console.log(`   ✅ ${table}.${column} (ID ${row.id}): "${wrong}" → "${correct}"`);
                totalFixed++;
              }
            }
          } catch (error) {
            // Ignore les colonnes qui n'existent pas
          }
        }
      }
    }
  }
  
  return totalFixed;
}

async function main() {
  console.log('🔧 Script de vérification et correction UTF-8\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Vérifier l'encodage de la base
    await checkDatabaseEncoding();
    
    // 2. Scanner toutes les tables
    const issues = await scanAllTables();
    
    // 3. Appliquer les corrections intelligentes
    const fixed = await applySmartCorrections();
    
    // 4. Résumé
    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 Résumé:');
    console.log(`   - ${issues.length} type(s) de problème(s) détecté(s)`);
    console.log(`   - ${fixed} correction(s) appliquée(s)`);
    
    if (issues.length === 0 && fixed === 0) {
      console.log('\n✅ TOUTES LES DONNÉES SONT CORRECTEMENT ENCODÉES\n');
    } else if (issues.length > 0) {
      console.log('\n⚠️  Certains problèmes nécessitent une attention manuelle\n');
    } else {
      console.log('\n✅ Corrections appliquées avec succès\n');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);

