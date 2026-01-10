/**
 * Script de migration pour corriger les file_category dans media_files
 * 
 * Problème : Les fichiers uploadés ont file_category='other' au lieu de 'video', 'audio', etc.
 * Solution : Mettre à jour file_category basé sur file_type (MIME type)
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMediaCategories() {
  let connection;
  
  try {
    console.log('🔧 [FIX] Connexion à la base de données...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'mdsc_db'
    });

    console.log('✅ [FIX] Connecté à la base de données');

    // Corriger les vidéos
    const [videoResult] = await connection.execute(`
      UPDATE media_files 
      SET file_category = 'video' 
      WHERE (file_type LIKE 'video/%' OR storage_path LIKE '%.mp4' OR storage_path LIKE '%.webm' OR storage_path LIKE '%.mov')
      AND file_category = 'other'
    `);
    console.log(`✅ [FIX] ${videoResult.affectedRows} fichiers vidéo corrigés`);

    // Corriger les audios
    const [audioResult] = await connection.execute(`
      UPDATE media_files 
      SET file_category = 'audio' 
      WHERE (file_type LIKE 'audio/%' OR storage_path LIKE '%.mp3' OR storage_path LIKE '%.wav' OR storage_path LIKE '%.ogg')
      AND file_category = 'other'
    `);
    console.log(`✅ [FIX] ${audioResult.affectedRows} fichiers audio corrigés`);

    // Corriger les documents PDF
    const [pdfResult] = await connection.execute(`
      UPDATE media_files 
      SET file_category = 'document' 
      WHERE (file_type = 'application/pdf' OR storage_path LIKE '%.pdf')
      AND file_category = 'other'
    `);
    console.log(`✅ [FIX] ${pdfResult.affectedRows} fichiers PDF corrigés`);

    // Corriger les présentations
    const [presentationResult] = await connection.execute(`
      UPDATE media_files 
      SET file_category = 'presentation' 
      WHERE (file_type LIKE '%presentation%' OR storage_path LIKE '%.ppt%')
      AND file_category = 'other'
    `);
    console.log(`✅ [FIX] ${presentationResult.affectedRows} fichiers présentation corrigés`);

    // Corriger les images
    const [imageResult] = await connection.execute(`
      UPDATE media_files 
      SET file_category = 'image' 
      WHERE (file_type LIKE 'image/%' OR storage_path LIKE '%.jpg' OR storage_path LIKE '%.png' OR storage_path LIKE '%.jpeg' OR storage_path LIKE '%.gif')
      AND file_category = 'other'
    `);
    console.log(`✅ [FIX] ${imageResult.affectedRows} fichiers image corrigés`);

    // Afficher un résumé
    const [summary] = await connection.execute(`
      SELECT file_category, COUNT(*) as count 
      FROM media_files 
      GROUP BY file_category 
      ORDER BY count DESC
    `);
    
    console.log('\n📊 [FIX] Résumé des catégories de fichiers:');
    summary.forEach(row => {
      console.log(`   - ${row.file_category}: ${row.count} fichiers`);
    });

    console.log('\n✅ [FIX] Migration terminée avec succès !');
    
  } catch (error) {
    console.error('❌ [FIX] Erreur:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 [FIX] Connexion fermée');
    }
  }
}

// Exécuter le script
fixMediaCategories();
