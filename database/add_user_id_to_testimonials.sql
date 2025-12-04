-- Migration pour ajouter user_id et rejection_reason à la table testimonials
-- Permet de lier directement les témoignages aux utilisateurs et de stocker les raisons de rejet

-- Ajouter la colonne user_id (optionnel, NULL pour les témoignages créés par les admins manuellement)
ALTER TABLE testimonials 
ADD COLUMN user_id INT NULL COMMENT 'ID de l\'utilisateur qui a créé le témoignage (NULL pour témoignages admin)' AFTER course_id;

-- Ajouter la colonne rejection_reason pour stocker la raison du rejet
ALTER TABLE testimonials 
ADD COLUMN rejection_reason TEXT NULL COMMENT 'Raison du rejet du témoignage (si status = rejected)' AFTER status;

-- Ajouter la clé étrangère vers users
ALTER TABLE testimonials 
ADD CONSTRAINT fk_testimonials_user 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Ajouter un index sur user_id pour améliorer les performances
CREATE INDEX idx_user_id ON testimonials(user_id);

