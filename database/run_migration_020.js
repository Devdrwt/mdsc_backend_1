// Script pour exécuter la migration 020_add_course_type_validation_trigger.sql
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;
  try {
    console.log('🔄 Exécution de la migration 020_add_course_type_validation_trigger.sql...');
    
    // Obtenir une connexion avec support des délimiteurs multiples
    connection = await pool.getConnection();
    
    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, 'migrations/020_add_course_type_validation_trigger.sql');
    let sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Supprimer la commande USE (déjà connecté à la bonne base)
    sql = sql.replace(/USE mdsc_auth;/gi, '');
    
    // Diviser le SQL en statements (en tenant compte de DELIMITER)
    const statements = [];
    let currentStatement = '';
    let delimiter = ';';
    let inDelimiterBlock = false;
    
    const lines = sql.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('DELIMITER')) {
        if (line.includes('$$')) {
          delimiter = '$$';
          inDelimiterBlock = true;
        } else {
          delimiter = ';';
          inDelimiterBlock = false;
        }
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Si on atteint le délimiteur, on ajoute le statement
      if (line.endsWith(delimiter)) {
        currentStatement = currentStatement.replace(new RegExp(delimiter + '$'), '').trim();
        if (currentStatement) {
          statements.push(currentStatement);
        }
        currentStatement = '';
      }
    }
    
    // Exécuter chaque statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() && !statement.startsWith('--')) {
        try {
          // Pour les CREATE TRIGGER, on doit utiliser query() au lieu de execute()
          if (statement.toUpperCase().includes('CREATE TRIGGER') || 
              statement.toUpperCase().includes('DROP TRIGGER')) {
            await connection.query(statement);
            console.log(`✅ Statement ${i + 1}/${statements.length} exécuté`);
          } else if (statement.toUpperCase().startsWith('SELECT')) {
            // Pour SELECT, on affiche les résultats
            const [results] = await connection.query(statement);
            console.log('\n📊 Résultats de la vérification:');
            console.table(results);
          } else {
            await connection.query(statement);
            console.log(`✅ Statement ${i + 1}/${statements.length} exécuté`);
          }
        } catch (error) {
          // Ignorer les erreurs "already exists" pour DROP TRIGGER
          if (error.message.includes('does not exist') || 
              error.message.includes('Unknown trigger')) {
            console.log(`⚠️  Trigger n'existe pas encore (normal): ${error.message}`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('\n✅ Migration 020 exécutée avec succès!');
    console.log('✅ Triggers de validation créés pour les cours live');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution de la migration:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

runMigration();

