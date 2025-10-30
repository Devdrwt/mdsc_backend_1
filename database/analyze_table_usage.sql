-- Script pour analyser l'utilisation des tables
USE mdsc_auth;

-- Afficher toutes les tables avec leur nombre de lignes
SELECT 
    TABLE_NAME as 'Table',
    TABLE_ROWS as 'Nombre de lignes',
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Taille (MB)'
FROM 
    information_schema.TABLES 
WHERE 
    TABLE_SCHEMA = 'mdsc_auth'
ORDER BY 
    TABLE_ROWS DESC;

