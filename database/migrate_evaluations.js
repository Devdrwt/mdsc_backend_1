// Script Node.js pour créer les tables d'évaluations
const { pool } = require('../src/config/database');

async function migrateEvaluations() {
  try {
    console.log('🔄 Création des tables d\'évaluations...');
    
    // Créer la table evaluations
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type ENUM('quiz', 'assignment', 'exam', 'project') DEFAULT 'quiz',
        course_id INT NOT NULL,
        instructor_id INT NOT NULL,
        due_date DATETIME,
        max_score INT DEFAULT 100,
        is_published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_course (course_id),
        INDEX idx_instructor (instructor_id),
        INDEX idx_due_date (due_date)
      )
    `);
    
    console.log('✅ Table evaluations créée');
    
    // Créer la table user_evaluations
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_evaluations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        evaluation_id INT NOT NULL,
        user_id INT NOT NULL,
        answers JSON,
        score DECIMAL(5,2),
        status ENUM('not_started', 'in_progress', 'submitted', 'graded') DEFAULT 'not_started',
        feedback TEXT,
        submitted_at TIMESTAMP NULL,
        graded_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_evaluation (evaluation_id, user_id),
        INDEX idx_evaluation (evaluation_id),
        INDEX idx_user (user_id),
        INDEX idx_status (status)
      )
    `);
    
    console.log('✅ Table user_evaluations créée');
    
    // Insérer quelques évaluations d'exemple
    console.log('📝 Insertion des évaluations d\'exemple...');
    
    const evaluations = [
      ['Quiz Introduction', 'Quiz sur les concepts de base', 'quiz', 1, 11, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 20, true],
      ['Devoir Pratique', 'Exercice pratique à réaliser', 'assignment', 1, 11, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), 50, true],
      ['Examen Final', 'Examen de fin de cours', 'exam', 1, 11, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 100, true],
      ['Projet Final', 'Projet de fin de formation', 'project', 1, 11, new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), 80, true]
    ];
    
    for (const [title, description, type, course_id, instructor_id, due_date, max_score, is_published] of evaluations) {
      await pool.execute(`
        INSERT IGNORE INTO evaluations (title, description, type, course_id, instructor_id, due_date, max_score, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [title, description, type, course_id, instructor_id, due_date, max_score, is_published]);
    }
    
    console.log('✅ Évaluations d\'exemple insérées');
    
    // Vérifier les tables créées
    const [evaluationsCount] = await pool.execute('SELECT COUNT(*) as count FROM evaluations');
    const [userEvaluationsCount] = await pool.execute('SELECT COUNT(*) as count FROM user_evaluations');
    
    console.log(`📊 Total évaluations: ${evaluationsCount[0].count}`);
    console.log(`📊 Total soumissions: ${userEvaluationsCount[0].count}`);
    
    console.log('🎉 Migration des évaluations terminée avec succès!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

migrateEvaluations();
