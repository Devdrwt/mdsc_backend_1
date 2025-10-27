// Script Node.js pour créer la table badges
const { pool } = require('../src/config/database');

async function migrateBadges() {
  try {
    console.log('🔄 Création de la table badges...');
    
    // Créer la table badges
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS badges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        icon VARCHAR(50) NOT NULL,
        color VARCHAR(7) DEFAULT '#007bff',
        points_required INT DEFAULT 0,
        criteria JSON,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_points (points_required)
      )
    `);
    
    console.log('✅ Table badges créée');
    
    // Insérer les badges par défaut
    console.log('📝 Insertion des badges par défaut...');
    
    const badges = [
      ['Premier Pas', 'Première connexion sur la plateforme', '👋', '#28a745', 10, '{"type": "first_login"}'],
      ['Étudiant Assidu', 'Compléter 5 cours', '📚', '#007bff', 50, '{"type": "courses_completed", "count": 5}'],
      ['Expert', 'Compléter 10 cours', '🎓', '#6f42c1', 100, '{"type": "courses_completed", "count": 10}'],
      ['Marathonien', 'Étudier 7 jours consécutifs', '🏃', '#fd7e14', 75, '{"type": "consecutive_days", "count": 7}'],
      ['Social', 'Participer à 5 discussions', '💬', '#20c997', 25, '{"type": "discussions", "count": 5}'],
      ['Perfectionniste', 'Obtenir 100% dans un cours', '⭐', '#ffc107', 30, '{"type": "perfect_score"}'],
      ['Explorateur', 'Découvrir 3 nouvelles catégories', '🗺️', '#17a2b8', 40, '{"type": "categories_explored", "count": 3}']
    ];
    
    for (const [name, description, icon, color, points_required, criteria] of badges) {
      await pool.execute(`
        INSERT IGNORE INTO badges (name, description, icon, color, points_required, criteria)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [name, description, icon, color, points_required, criteria]);
    }
    
    console.log('✅ Badges insérés avec succès');
    
    // Vérifier les badges créés
    const [result] = await pool.execute('SELECT COUNT(*) as count FROM badges');
    console.log(`📊 Total badges: ${result[0].count}`);
    
    console.log('🎉 Migration terminée avec succès!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

migrateBadges();
