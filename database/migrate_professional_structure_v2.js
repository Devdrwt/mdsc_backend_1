require('dotenv').config();
const { pool } = require('../src/config/database');

async function migrateProfessionalStructure() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🚀 Début de la migration vers la structure professionnelle...');
    
    // 1. Créer la table domains
    console.log('📚 Création de la table domains...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS domains (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(100),
        color VARCHAR(7) DEFAULT '#007bff',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table domains créée');
    
    // 2. Créer la table modules
    console.log('📖 Création de la table modules...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS modules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        domain_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        short_description VARCHAR(500),
        thumbnail_url VARCHAR(500),
        duration_hours INT DEFAULT 0,
        difficulty ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
        language VARCHAR(10) DEFAULT 'fr',
        price DECIMAL(10,2) DEFAULT 0.00,
        currency VARCHAR(3) DEFAULT 'EUR',
        max_students INT,
        enrollment_deadline DATETIME,
        module_start_date DATETIME,
        module_end_date DATETIME,
        certification_required BOOLEAN DEFAULT TRUE,
        certification_criteria TEXT,
        is_published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Table modules créée');
    
    // 3. Créer la table sequences
    console.log('📝 Création de la table sequences...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sequences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        sequence_order INT NOT NULL,
        estimated_duration_minutes INT DEFAULT 0,
        has_mini_control BOOLEAN DEFAULT FALSE,
        mini_control_points INT DEFAULT 0,
        is_required BOOLEAN DEFAULT TRUE,
        is_published BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        UNIQUE KEY unique_course_sequence_order (course_id, sequence_order)
      )
    `);
    console.log('✅ Table sequences créée');
    
    // 4. Créer la table contents
    console.log('📄 Création de la table contents...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sequence_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content_type ENUM('pdf', 'video', 'live', 'text', 'quiz', 'exercise') NOT NULL,
        content_url VARCHAR(500),
        file_path VARCHAR(500),
        file_size_bytes INT,
        mime_type VARCHAR(100),
        duration_minutes INT DEFAULT 0,
        content_order INT NOT NULL,
        is_downloadable BOOLEAN DEFAULT TRUE,
        is_required BOOLEAN DEFAULT TRUE,
        access_level ENUM('free', 'premium', 'certified') DEFAULT 'free',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
        UNIQUE KEY unique_sequence_content_order (sequence_id, content_order)
      )
    `);
    console.log('✅ Table contents créée');
    
    // 5. Créer la table mini_controls
    console.log('✅ Création de la table mini_controls...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS mini_controls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sequence_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        question_type ENUM('multiple_choice', 'true_false', 'text', 'file_upload') DEFAULT 'multiple_choice',
        questions JSON NOT NULL,
        passing_score INT DEFAULT 70,
        max_attempts INT DEFAULT 3,
        time_limit_minutes INT DEFAULT 30,
        points_awarded INT DEFAULT 10,
        badge_id INT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Table mini_controls créée');
    
    // 6. Créer la table mini_control_results
    console.log('📊 Création de la table mini_control_results...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS mini_control_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        mini_control_id INT NOT NULL,
        attempt_number INT NOT NULL,
        score INT NOT NULL,
        max_score INT NOT NULL,
        answers JSON NOT NULL,
        time_spent_minutes INT DEFAULT 0,
        is_passed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (mini_control_id) REFERENCES mini_controls(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_control_attempt (user_id, mini_control_id, attempt_number)
      )
    `);
    console.log('✅ Table mini_control_results créée');
    
    // 7. Créer la table module_evaluations
    console.log('🏆 Création de la table module_evaluations...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS module_evaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        module_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        evaluation_type ENUM('exam', 'project', 'portfolio', 'practical') DEFAULT 'exam',
        questions JSON NOT NULL,
        passing_score INT DEFAULT 70,
        max_attempts INT DEFAULT 2,
        time_limit_minutes INT DEFAULT 120,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Table module_evaluations créée');
    
    // 8. Créer la table module_evaluation_results
    console.log('📈 Création de la table module_evaluation_results...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS module_evaluation_results (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        module_evaluation_id INT NOT NULL,
        attempt_number INT NOT NULL,
        score INT NOT NULL,
        max_score INT NOT NULL,
        answers JSON NOT NULL,
        time_spent_minutes INT DEFAULT 0,
        is_passed BOOLEAN DEFAULT FALSE,
        certified_at TIMESTAMP NULL,
        certificate_url VARCHAR(500),
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (module_evaluation_id) REFERENCES module_evaluations(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_evaluation_attempt (user_id, module_evaluation_id, attempt_number)
      )
    `);
    console.log('✅ Table module_evaluation_results créée');
    
    // 9. Créer la table module_enrollments
    console.log('📋 Création de la table module_enrollments...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS module_enrollments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        module_id INT NOT NULL,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        progress_percentage DECIMAL(5,2) DEFAULT 0.00,
        completed_at TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_module_enrollment (user_id, module_id)
      )
    `);
    console.log('✅ Table module_enrollments créée');
    
    // 10. Créer la table sequence_progress
    console.log('📊 Création de la table sequence_progress...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sequence_progress (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        sequence_id INT NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        progress_percentage DECIMAL(5,2) DEFAULT 0.00,
        time_spent_minutes INT DEFAULT 0,
        is_completed BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_sequence_progress (user_id, sequence_id)
      )
    `);
    console.log('✅ Table sequence_progress créée');
    
    // 11. Modifier la table courses pour ajouter module_id
    console.log('🔗 Modification de la table courses...');
    try {
      await connection.execute('ALTER TABLE courses ADD COLUMN module_id INT');
      await connection.execute('ALTER TABLE courses ADD FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL');
      console.log('✅ Colonne module_id ajoutée à courses');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Colonne module_id existe déjà dans courses');
      } else {
        console.error('❌ Erreur modification courses:', error.message);
      }
    }
    
    // 12. Modifier la table categories pour ajouter domain_id
    console.log('🔗 Modification de la table categories...');
    try {
      await connection.execute('ALTER TABLE categories ADD COLUMN domain_id INT');
      await connection.execute('ALTER TABLE categories ADD FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL');
      console.log('✅ Colonne domain_id ajoutée à categories');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Colonne domain_id existe déjà dans categories');
      } else {
        console.error('❌ Erreur modification categories:', error.message);
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
