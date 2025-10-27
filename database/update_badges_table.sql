-- Script pour ajouter la table badges et les données par défaut

-- Créer la table badges si elle n'existe pas
CREATE TABLE IF NOT EXISTS badges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#007bff',
    points_required INT DEFAULT 0,
    criteria JSON, -- Critères pour obtenir le badge
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_points (points_required)
);

-- Insérer quelques badges par défaut
INSERT IGNORE INTO badges (name, description, icon, color, points_required, criteria) VALUES
('Premier Pas', 'Première connexion sur la plateforme', '👋', '#28a745', 10, '{"type": "first_login"}'),
('Étudiant Assidu', 'Compléter 5 cours', '📚', '#007bff', 50, '{"type": "courses_completed", "count": 5}'),
('Expert', 'Compléter 10 cours', '🎓', '#6f42c1', 100, '{"type": "courses_completed", "count": 10}'),
('Marathonien', 'Étudier 7 jours consécutifs', '🏃', '#fd7e14', 75, '{"type": "consecutive_days", "count": 7}'),
('Social', 'Participer à 5 discussions', '💬', '#20c997', 25, '{"type": "discussions", "count": 5}'),
('Perfectionniste', 'Obtenir 100% dans un cours', '⭐', '#ffc107', 30, '{"type": "perfect_score"}'),
('Explorateur', 'Découvrir 3 nouvelles catégories', '🗺️', '#17a2b8', 40, '{"type": "categories_explored", "count": 3}');
