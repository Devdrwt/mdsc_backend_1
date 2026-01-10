-- Script de correction de la table user_files
-- Ajoute la colonne storage_type si elle n'existe pas
-- Et s'assure que id est bien AUTO_INCREMENT

-- Vérifier la structure actuelle
DESCRIBE user_files;

-- Ajouter storage_type si elle n'existe pas
ALTER TABLE user_files 
ADD COLUMN IF NOT EXISTS storage_type VARCHAR(50) DEFAULT 'local' 
AFTER mime_type;

-- S'assurer que id est AUTO_INCREMENT
ALTER TABLE user_files 
MODIFY COLUMN id INT AUTO_INCREMENT;

-- Vérifier la structure après modification
DESCRIBE user_files;

-- Afficher un exemple de données
SELECT * FROM user_files LIMIT 1;
