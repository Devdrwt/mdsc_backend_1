-- Script de nettoyage complet des inscriptions de l'utilisateur 76
-- Ce script désactive toutes les inscriptions et supprime toutes les données de progression

SET @user_id = 76;

-- 1. Afficher les inscriptions actuelles avant nettoyage
SELECT 
    e.id as enrollment_id,
    e.course_id,
    c.title as course_title,
    e.is_active,
    e.status,
    e.progress_percentage,
    e.enrolled_at,
    e.completed_at
FROM enrollments e
JOIN courses c ON e.course_id = c.id
WHERE e.user_id = @user_id;

-- 2. Récupérer les IDs des inscriptions pour le nettoyage
SET @enrollment_ids = (
    SELECT GROUP_CONCAT(id) 
    FROM enrollments 
    WHERE user_id = @user_id
);

-- 3. Désactiver toutes les inscriptions
UPDATE enrollments 
SET 
    is_active = FALSE,
    status = 'unenrolled',
    updated_at = NOW()
WHERE user_id = @user_id;

SELECT CONCAT('✅ ', ROW_COUNT(), ' inscription(s) désactivée(s)') as result;

-- 4. Supprimer toutes les données de progression (progress)
DELETE FROM progress 
WHERE enrollment_id IN (
    SELECT id FROM enrollments WHERE user_id = @user_id
);

SELECT CONCAT('✅ Progression supprimée (', ROW_COUNT(), ' enregistrement(s))') as result;

-- 5. Supprimer toutes les données de progression des leçons (lesson_progress)
DELETE FROM lesson_progress 
WHERE user_id = @user_id;

SELECT CONCAT('✅ Progression des leçons supprimée (', ROW_COUNT(), ' enregistrement(s))') as result;

-- 6. Afficher le résultat final
SELECT 
    'Résumé du nettoyage' as info,
    COUNT(*) as total_enrollments,
    SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_enrollments,
    SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive_enrollments
FROM enrollments 
WHERE user_id = @user_id;

-- 7. Vérifier qu'il n'y a plus de progression
SELECT 
    'Vérification progression' as info,
    COUNT(*) as remaining_progress_records
FROM progress 
WHERE enrollment_id IN (
    SELECT id FROM enrollments WHERE user_id = @user_id
);

SELECT 
    'Vérification lesson_progress' as info,
    COUNT(*) as remaining_lesson_progress_records
FROM lesson_progress 
WHERE user_id = @user_id;

-- Note: Les certificats et badges sont conservés car ils représentent des accomplissements permanents

