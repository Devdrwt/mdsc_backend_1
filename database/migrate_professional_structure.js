require('dotenv').config();
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function migrateProfessionalStructure() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🚀 Début de la migration vers la structure professionnelle...');
    
    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, 'create_professional_structure.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Diviser les requêtes par ';' et exécuter une par une
    const queries = sqlContent
      .split(';')
      .map(query => query.trim())
      .filter(query => query.length > 0 && !query.startsWith('--') && !query.startsWith('CREATE INDEX'));
    
    console.log(`📝 Exécution de ${queries.length} requêtes CREATE TABLE...`);
    
    for (const query of queries) {
      if (query.trim()) {
        try {
          await connection.execute(query);
          console.log('✅ Table créée avec succès');
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('⚠️  Table déjà existante, ignorée');
          } else {
            console.error('❌ Erreur lors de la création de la table:', error.message);
            console.log('Requête:', query.substring(0, 100) + '...');
          }
        }
      }
    }
    
    // Exécuter les index séparément
    console.log('🔗 Création des index...');
    const indexQueries = sqlContent
      .split(';')
      .map(query => query.trim())
      .filter(query => query.startsWith('CREATE INDEX'));
    
    for (const query of indexQueries) {
      if (query.trim()) {
        try {
          await connection.execute(query);
          console.log('✅ Index créé avec succès');
        } catch (error) {
          if (error.code === 'ER_DUP_KEYNAME') {
            console.log('⚠️  Index déjà existant, ignoré');
          } else {
            console.error('❌ Erreur lors de la création de l\'index:', error.message);
          }
        }
      }
    }
    
    // Insérer des domaines d'exemple
    console.log('📚 Insertion des domaines d\'exemple...');
    
    const domains = [
      {
        name: 'Santé',
        description: 'Formations médicales et paramédicales',
        icon: 'heart-pulse',
        color: '#dc3545'
      },
      {
        name: 'Technologies de l\'Information',
        description: 'Développement, cybersécurité, intelligence artificielle',
        icon: 'laptop-code',
        color: '#0d6efd'
      },
      {
        name: 'Gestion et Management',
        description: 'Leadership, gestion de projet, ressources humaines',
        icon: 'users-cog',
        color: '#198754'
      },
      {
        name: 'Finance et Comptabilité',
        description: 'Analyse financière, comptabilité, audit',
        icon: 'chart-line',
        color: '#fd7e14'
      },
      {
        name: 'Éducation et Formation',
        description: 'Pédagogie, formation professionnelle, e-learning',
        icon: 'graduation-cap',
        color: '#6f42c1'
      }
    ];
    
    for (const domain of domains) {
      try {
        await connection.execute(
          'INSERT INTO domains (name, description, icon, color) VALUES (?, ?, ?, ?)',
          [domain.name, domain.description, domain.icon, domain.color]
        );
        console.log(`✅ Domaine "${domain.name}" créé`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Domaine "${domain.name}" existe déjà`);
        } else {
          console.error(`❌ Erreur création domaine "${domain.name}":`, error.message);
        }
      }
    }
    
    // Insérer des modules d'exemple
    console.log('📖 Insertion des modules d\'exemple...');
    
    const modules = [
      {
        domain_id: 1, // Santé
        title: 'Cardiologie Fondamentale',
        description: 'Module complet sur les maladies cardiovasculaires',
        short_description: 'Apprenez les bases de la cardiologie',
        duration_hours: 40,
        difficulty: 'intermediate',
        price: 299.99
      },
      {
        domain_id: 1, // Santé
        title: 'Neurologie Clinique',
        description: 'Diagnostic et traitement des troubles neurologiques',
        short_description: 'Formation en neurologie clinique',
        duration_hours: 35,
        difficulty: 'advanced',
        price: 399.99
      },
      {
        domain_id: 2, // IT
        title: 'Développement Web Full-Stack',
        description: 'Devenir développeur web complet',
        short_description: 'Formation complète développement web',
        duration_hours: 120,
        difficulty: 'beginner',
        price: 599.99
      },
      {
        domain_id: 2, // IT
        title: 'Cybersécurité Avancée',
        description: 'Protection des systèmes d\'information',
        short_description: 'Expert en cybersécurité',
        duration_hours: 80,
        difficulty: 'advanced',
        price: 799.99
      }
    ];
    
    for (const module of modules) {
      try {
        await connection.execute(
          `INSERT INTO modules (domain_id, title, description, short_description, 
           duration_hours, difficulty, price) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [module.domain_id, module.title, module.description, module.short_description,
           module.duration_hours, module.difficulty, module.price]
        );
        console.log(`✅ Module "${module.title}" créé`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Module "${module.title}" existe déjà`);
        } else {
          console.error(`❌ Erreur création module "${module.title}":`, error.message);
        }
      }
    }
    
    console.log('🎉 Migration vers la structure professionnelle terminée !');
    console.log('');
    console.log('📊 Résumé de la nouvelle structure :');
    console.log('🏥 Domaines (Secteurs professionnels)');
    console.log('📚 Modules (Regroupement de cours)');
    console.log('📖 Cours (Contenu pédagogique)');
    console.log('📝 Séquences (Structure du contenu)');
    console.log('📄 Contenus (PDF, Vidéos, Live)');
    console.log('✅ Mini-contrôles (Quiz de séquences)');
    console.log('🏆 Évaluations de module (Certifications)');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

migrateProfessionalStructure();
