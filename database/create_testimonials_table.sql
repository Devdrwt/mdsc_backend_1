-- Table pour gérer les témoignages affichés sur la page d'accueil
CREATE TABLE IF NOT EXISTS testimonials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quote TEXT NOT NULL COMMENT 'Le texte du témoignage',
  author VARCHAR(255) NOT NULL COMMENT 'Le nom de l\'auteur du témoignage',
  title VARCHAR(255) NULL COMMENT 'Titre/fonction de l\'auteur (ex: Formatrice certifiée)',
  avatar VARCHAR(2) NULL COMMENT 'Initiales pour l\'avatar (optionnel, peut être généré depuis le nom)',
  rating TINYINT DEFAULT 5 COMMENT 'Note sur 5 étoiles (1-5)',
  is_active BOOLEAN DEFAULT TRUE COMMENT 'Si le témoignage est actif et visible sur le site',
  display_order INT DEFAULT 0 COMMENT 'Ordre d\'affichage (pour trier les témoignages)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_is_active (is_active),
  INDEX idx_display_order (display_order),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Données de test (optionnel)
INSERT INTO testimonials (quote, author, title, avatar, rating, is_active, display_order) VALUES
('Les formations MdSC m\'ont permis d\'acquérir des compétences essentielles en management. Je recommande vivement cette plateforme !', 'CC Christelle Cakpa', 'Formatrice certifiée', 'CC', 5, TRUE, 0),
('Une plateforme excellente avec des cours de qualité. Les certificats ont renforcé la confiance de mes apprenants.', 'CC Christelle Cakpa', 'Formatrice certifiée', 'CC', 5, TRUE, 1),
('Interface intuitive, contenu riche et accompagnement de qualité. C\'est un outil indispensable pour la société civile.', 'CC Christelle Cakpa', 'Formatrice certifiée', 'CC', 5, TRUE, 2)
ON DUPLICATE KEY UPDATE id=id;

