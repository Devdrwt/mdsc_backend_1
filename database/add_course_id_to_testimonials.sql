-- Migration pour ajouter course_id et status à la table testimonials
-- Permet de lier les témoignages à un cours spécifique et de gérer leur statut de modération

-- Ajouter la colonne course_id (optionnel, NULL pour les témoignages généraux)
ALTER TABLE testimonials 
ADD COLUMN course_id INT NULL COMMENT 'ID du cours associé (NULL pour témoignages généraux)' AFTER display_order;

-- Ajouter la colonne status pour gérer la modération
ALTER TABLE testimonials 
ADD COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved' COMMENT 'Statut de modération du témoignage' AFTER course_id;

-- Ajouter la clé étrangère vers courses
ALTER TABLE testimonials 
ADD CONSTRAINT fk_testimonials_course 
FOREIGN KEY (course_id) REFERENCES courses(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Ajouter un index sur course_id pour améliorer les performances
CREATE INDEX idx_course_id ON testimonials(course_id);

-- Ajouter un index sur status pour filtrer les témoignages en attente
CREATE INDEX idx_status ON testimonials(status);

-- Mettre à jour les témoignages existants pour qu'ils soient approuvés par défaut
UPDATE testimonials SET status = 'approved' WHERE status IS NULL;

