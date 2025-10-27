-- Exemple concret de la structure professionnelle
-- Module "Cardiologie Fondamentale" dans le domaine "Santé"

-- 1. Créer le module Cardiologie
INSERT INTO modules (
  domain_id, title, description, short_description, 
  duration_hours, difficulty, price, certification_required
) VALUES (
  1, -- Domaine Santé
  'Cardiologie Fondamentale',
  'Module complet sur les maladies cardiovasculaires, leur diagnostic et traitement',
  'Apprenez les bases de la cardiologie moderne',
  40,
  'intermediate',
  299.99,
  TRUE
);

-- 2. Créer les cours du module
INSERT INTO courses (
  module_id, title, description, instructor_id, category_id,
  difficulty, language, price, duration_minutes
) VALUES 
(1, 'Anatomie du Cœur', 'Structure et fonction du système cardiovasculaire', 11, 1, 'beginner', 'fr', 0, 180),
(1, 'Physiologie Cardiaque', 'Mécanismes de fonctionnement du cœur', 11, 1, 'intermediate', 'fr', 0, 240),
(1, 'Pathologies Cardiovasculaires', 'Maladies et troubles du système cardiovasculaire', 11, 1, 'advanced', 'fr', 0, 300);

-- 3. Créer les séquences pour le cours "Anatomie du Cœur"
INSERT INTO sequences (
  course_id, title, description, sequence_order, 
  estimated_duration_minutes, has_mini_control, mini_control_points
) VALUES 
(1, 'Introduction à l\'Anatomie', 'Vue d\'ensemble du système cardiovasculaire', 1, 45, TRUE, 10),
(1, 'Structure du Cœur', 'Anatomie détaillée du cœur', 2, 60, TRUE, 15),
(1, 'Vaisseaux Sanguins', 'Artères, veines et capillaires', 3, 45, TRUE, 10),
(1, 'Système de Conduction', 'Impulsions électriques du cœur', 4, 30, FALSE, 0);

-- 4. Créer les contenus pour la première séquence
INSERT INTO contents (
  sequence_id, title, description, content_type, content_order,
  duration_minutes, is_required, access_level
) VALUES 
(1, 'PDF - Introduction Cardiologie', 'Document de base sur l\'anatomie cardiovasculaire', 'pdf', 1, 30, TRUE, 'free'),
(1, 'Vidéo - Dissection Virtuelle', 'Visualisation 3D du cœur humain', 'video', 2, 15, TRUE, 'free'),
(1, 'Quiz - Anatomie de Base', 'Questions sur les concepts fondamentaux', 'quiz', 3, 10, TRUE, 'free');

-- 5. Créer un mini-contrôle pour la première séquence
INSERT INTO mini_controls (
  sequence_id, title, description, question_type, questions,
  passing_score, max_attempts, time_limit_minutes, points_awarded
) VALUES (
  1,
  'Contrôle Anatomie Introduction',
  'Évaluation des connaissances de base en anatomie cardiovasculaire',
  'multiple_choice',
  JSON_OBJECT(
    'questions', JSON_ARRAY(
      JSON_OBJECT(
        'id', 1,
        'question', 'Combien de cavités possède le cœur humain ?',
        'options', JSON_ARRAY('2', '3', '4', '5'),
        'correct_answer', 2,
        'points', 5
      ),
      JSON_OBJECT(
        'id', 2,
        'question', 'Quelle est la fonction principale du ventricule gauche ?',
        'options', JSON_ARRAY(
          'Recevoir le sang des poumons',
          'Pomper le sang vers le corps',
          'Recevoir le sang du corps',
          'Pomper le sang vers les poumons'
        ),
        'correct_answer', 1,
        'points', 5
      )
    ),
    'total_points', 10
  ),
  70,
  3,
  20,
  10
);

-- 6. Créer l'évaluation finale du module
INSERT INTO module_evaluations (
  module_id, title, description, evaluation_type, questions,
  passing_score, max_attempts, time_limit_minutes
) VALUES (
  1,
  'Examen Final Cardiologie',
  'Évaluation complète des connaissances en cardiologie fondamentale',
  'exam',
  JSON_OBJECT(
    'questions', JSON_ARRAY(
      JSON_OBJECT(
        'id', 1,
        'question', 'Décrivez le cycle cardiaque complet',
        'type', 'text',
        'points', 25
      ),
      JSON_OBJECT(
        'id', 2,
        'question', 'Quelles sont les principales causes d\'infarctus du myocarde ?',
        'type', 'multiple_choice',
        'options', JSON_ARRAY(
          'Athérosclérose',
          'Hypertension',
          'Diabète',
          'Toutes les réponses ci-dessus'
        ),
        'correct_answer', 3,
        'points', 15
      ),
      JSON_OBJECT(
        'id', 3,
        'question', 'Expliquez le mécanisme de l\'insuffisance cardiaque',
        'type', 'text',
        'points', 30
      )
    ),
    'total_points', 70
  ),
  70,
  2,
  120
);
