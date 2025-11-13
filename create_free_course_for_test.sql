-- Script pour créer 3 cours gratuits complets (sans inscription)
-- L'utilisateur 76 pourra s'inscrire depuis son tableau de bord

USE mdsc_auth;

-- ============================================
-- COURS 1: Introduction à la Gestion de Projet
-- ============================================

-- 1. Créer le premier cours gratuit
INSERT INTO courses (
  title,
  slug,
  description,
  short_description,
  instructor_id,
  category_id,
  price,
  currency,
  difficulty,
  language,
  is_published,
  is_featured,
  duration_minutes,
  max_students,
  course_start_date,
  course_end_date,
  created_at,
  updated_at
) VALUES (
  'Introduction à la Gestion de Projet - Formation Gratuite',
  CONCAT('introduction-gestion-projet-gratuite-', UNIX_TIMESTAMP()),
  'Cette formation gratuite vous initie aux fondamentaux de la gestion de projet. Vous apprendrez à planifier, organiser et suivre un projet de A à Z. Cette formation est idéale pour les débutants qui souhaitent acquérir les compétences essentielles en gestion de projet.',
  'Formation gratuite complète sur les bases de la gestion de projet : planification, organisation et suivi.',
  1, -- Instructeur Davis Borgia
  5, -- Catégorie: Compétences Transversales
  0.00, -- COURS GRATUIT
  'XOF',
  'beginner',
  'fr',
  TRUE, -- Publié
  TRUE, -- En vedette
  180, -- 3 heures (180 minutes)
  NULL, -- Pas de limite d'étudiants
  NOW(), -- Début immédiat
  DATE_ADD(NOW(), INTERVAL 6 MONTH), -- Fin dans 6 mois
  NOW(),
  NOW()
);

-- Récupérer l'ID du cours créé
SET @course_id = LAST_INSERT_ID();

-- 2. Créer les modules
-- Module 1: Introduction
INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
VALUES (
  @course_id,
  'Module 1: Introduction à la Gestion de Projet',
  'Découvrez les concepts fondamentaux de la gestion de projet et son importance dans le monde professionnel.',
  1,
  TRUE, -- Débloqué dès le début
  NOW(),
  NOW()
);

SET @module1_id = LAST_INSERT_ID();

-- Module 2: Planification
INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
VALUES (
  @course_id,
  'Module 2: Planification et Organisation',
  'Apprenez à planifier efficacement un projet, définir les objectifs et organiser les ressources.',
  2,
  FALSE, -- Débloqué après le module 1
  NOW(),
  NOW()
);

SET @module2_id = LAST_INSERT_ID();

-- Module 3: Suivi et Clôture
INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
VALUES (
  @course_id,
  'Module 3: Suivi et Clôture de Projet',
  'Maîtrisez les techniques de suivi de projet et apprenez à clôturer efficacement un projet.',
  3,
  FALSE, -- Débloqué après le module 2
  NOW(),
  NOW()
);

SET @module3_id = LAST_INSERT_ID();

-- 3. Créer les leçons pour le Module 1
INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
VALUES
(
  @course_id, @module1_id,
  'Leçon 1.1: Qu\'est-ce que la gestion de projet ?',
  'Introduction aux concepts de base de la gestion de projet.',
  '<h2>Qu\'est-ce que la gestion de projet ?</h2>
<p>La gestion de projet est une discipline qui consiste à organiser, planifier et contrôler les ressources pour atteindre des objectifs spécifiques dans un délai déterminé.</p>
<h3>Objectifs d\'apprentissage :</h3>
<ul>
<li>Comprendre la définition de la gestion de projet</li>
<li>Identifier les caractéristiques d\'un projet</li>
<li>Distinguer un projet d\'une activité opérationnelle</li>
</ul>
<h3>Contenu détaillé :</h3>
<p>Un projet se caractérise par :</p>
<ul>
<li>Un objectif unique et spécifique</li>
<li>Des ressources limitées (temps, budget, personnel)</li>
<li>Un début et une fin définis</li>
<li>Des livrables concrets</li>
</ul>',
  15,
  1,
  'text',
  TRUE,
  NOW(),
  NOW()
),
(
  @course_id, @module1_id,
  'Leçon 1.2: Les acteurs du projet',
  'Découvrez les différents rôles et responsabilités dans un projet.',
  '<h2>Les acteurs du projet</h2>
<p>Un projet implique plusieurs acteurs, chacun avec des responsabilités spécifiques.</p>
<h3>Rôles principaux :</h3>
<ul>
<li><strong>Chef de projet</strong> : Responsable de la planification, de l\'exécution et de la clôture du projet</li>
<li><strong>Équipe projet</strong> : Les membres qui exécutent les tâches</li>
<li><strong>Sponsor</strong> : Le commanditaire qui finance et valide le projet</li>
<li><strong>Stakeholders</strong> : Les parties prenantes affectées par le projet</li>
</ul>',
  20,
  2,
  'text',
  TRUE,
  NOW(),
  NOW()
),
(
  @course_id, @module1_id,
  'Leçon 1.3: Le cycle de vie d\'un projet',
  'Comprenez les différentes phases d\'un projet.',
  '<h2>Le cycle de vie d\'un projet</h2>
<p>Un projet suit généralement un cycle de vie en plusieurs phases :</p>
<ol>
<li><strong>Initiation</strong> : Définition du projet et validation</li>
<li><strong>Planification</strong> : Élaboration du plan de projet</li>
<li><strong>Exécution</strong> : Réalisation des travaux</li>
<li><strong>Suivi et contrôle</strong> : Surveillance de l\'avancement</li>
<li><strong>Clôture</strong> : Finalisation et livraison</li>
</ol>',
  25,
  3,
  'text',
  TRUE,
  NOW(),
  NOW()
);

-- 4. Créer les leçons pour le Module 2
INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
VALUES
(
  @course_id, @module2_id,
  'Leçon 2.1: Définir les objectifs du projet',
  'Apprenez à formuler des objectifs SMART pour votre projet.',
  '<h2>Définir les objectifs du projet</h2>
<p>Les objectifs SMART sont :</p>
<ul>
<li><strong>S</strong>pécifiques : Clairs et précis</li>
<li><strong>M</strong>esurables : Quantifiables</li>
<li><strong>A</strong>tteignables : Réalisables</li>
<li><strong>R</strong>éalistes : Conformes aux ressources disponibles</li>
<li><strong>T</strong>emporels : Avec une échéance définie</li>
</ul>
<h3>Exemple :</h3>
<p>❌ Mauvais objectif : "Améliorer la communication"</p>
<p>✅ Bon objectif : "Augmenter le taux de satisfaction client de 10% d\'ici 6 mois"</p>',
  20,
  1,
  'text',
  TRUE,
  NOW(),
  NOW()
),
(
  @course_id, @module2_id,
  'Leçon 2.2: La structure de découpage du projet (WBS)',
  'Découvrez comment décomposer un projet en tâches gérables.',
  '<h2>La structure de découpage du projet (WBS)</h2>
<p>Le Work Breakdown Structure (WBS) permet de décomposer un projet en éléments plus petits et gérables.</p>
<h3>Avantages du WBS :</h3>
<ul>
<li>Facilite la planification</li>
<li>Améliore l\'estimation des coûts et délais</li>
<li>Permet une meilleure allocation des ressources</li>
<li>Aide à identifier les risques</li>
</ul>
<h3>Structure hiérarchique :</h3>
<pre>
Projet
├── Phase 1
│   ├── Tâche 1.1
│   └── Tâche 1.2
└── Phase 2
    ├── Tâche 2.1
    └── Tâche 2.2
</pre>',
  30,
  2,
  'text',
  TRUE,
  NOW(),
  NOW()
),
(
  @course_id, @module2_id,
  'Leçon 2.3: Planification des ressources',
  'Apprenez à identifier et allouer les ressources nécessaires.',
  '<h2>Planification des ressources</h2>
<p>Les ressources d\'un projet incluent :</p>
<ul>
<li><strong>Ressources humaines</strong> : L\'équipe et ses compétences</li>
<li><strong>Ressources matérielles</strong> : Équipements et outils</li>
<li><strong>Ressources financières</strong> : Budget alloué</li>
<li><strong>Ressources temporelles</strong> : Délais disponibles</li>
</ul>
<h3>Bonnes pratiques :</h3>
<ul>
<li>Identifier toutes les ressources nécessaires</li>
<li>Vérifier leur disponibilité</li>
<li>Planifier leur allocation dans le temps</li>
<li>Prévoir des réserves pour les imprévus</li>
</ul>',
  25,
  3,
  'text',
  TRUE,
  NOW(),
  NOW()
);

-- 5. Créer les leçons pour le Module 3
INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
VALUES
(
  @course_id, @module3_id,
  'Leçon 3.1: Le suivi de l\'avancement',
  'Découvrez les outils et techniques pour suivre l\'avancement d\'un projet.',
  '<h2>Le suivi de l\'avancement</h2>
<p>Le suivi régulier permet de détecter les écarts et de prendre des mesures correctives.</p>
<h3>Indicateurs clés :</h3>
<ul>
<li><strong>Avancement physique</strong> : Pourcentage de tâches complétées</li>
<li><strong>Avancement financier</strong> : Budget consommé vs prévu</li>
<li><strong>Avancement temporel</strong> : Délais respectés ou non</li>
</ul>
<h3>Outils de suivi :</h3>
<ul>
<li>Tableaux de bord</li>
<li>Rapports d\'avancement</li>
<li>Réunions de suivi</li>
<li>Outils de gestion de projet</li>
</ul>',
  20,
  1,
  'text',
  TRUE,
  NOW(),
  NOW()
),
(
  @course_id, @module3_id,
  'Leçon 3.2: Gestion des risques',
  'Apprenez à identifier et gérer les risques d\'un projet.',
  '<h2>Gestion des risques</h2>
<p>La gestion des risques est essentielle pour la réussite d\'un projet.</p>
<h3>Processus de gestion des risques :</h3>
<ol>
<li><strong>Identification</strong> : Lister tous les risques potentiels</li>
<li><strong>Analyse</strong> : Évaluer la probabilité et l\'impact</li>
<li><strong>Planification</strong> : Définir les stratégies de réponse</li>
<li><strong>Suivi</strong> : Surveiller et ajuster</li>
</ol>
<h3>Stratégies de réponse :</h3>
<ul>
<li><strong>Éviter</strong> : Éliminer le risque</li>
<li><strong>Atténuer</strong> : Réduire la probabilité ou l\'impact</li>
<li><strong>Transférer</strong> : Déléguer à un tiers (assurance, sous-traitance)</li>
<li><strong>Accepter</strong> : Assumer le risque</li>
</ul>',
  30,
  2,
  'text',
  TRUE,
  NOW(),
  NOW()
),
(
  @course_id, @module3_id,
  'Leçon 3.3: Clôture du projet',
  'Découvrez les étapes pour clôturer efficacement un projet.',
  '<h2>Clôture du projet</h2>
<p>La clôture est une phase cruciale qui permet de capitaliser sur l\'expérience.</p>
<h3>Étapes de clôture :</h3>
<ol>
<li><strong>Livraison finale</strong> : Remise des livrables au client</li>
<li><strong>Validation</strong> : Acceptation formelle du projet</li>
<li><strong>Documentation</strong> : Archivage de tous les documents</li>
<li><strong>Rétrospective</strong> : Analyse des succès et échecs</li>
<li><strong>Libération des ressources</strong> : Réaffectation de l\'équipe</li>
</ol>
<h3>Livrables de clôture :</h3>
<ul>
<li>Rapport de clôture</li>
<li>Documentation technique</li>
<li>Retour d\'expérience (REX)</li>
<li>Archives du projet</li>
</ul>',
  20,
  3,
  'text',
  TRUE,
  NOW(),
  NOW()
);

-- Sauvegarder l'ID du premier cours
SET @course1_id = @course_id;

-- ============================================
-- COURS 2: Communication Efficace
-- ============================================

-- Créer le deuxième cours gratuit
INSERT INTO courses (
  title,
  slug,
  description,
  short_description,
  instructor_id,
  category_id,
  price,
  currency,
  difficulty,
  language,
  is_published,
  is_featured,
  duration_minutes,
  max_students,
  course_start_date,
  course_end_date,
  created_at,
  updated_at
) VALUES (
  'Communication Efficace - Formation Gratuite',
  CONCAT('communication-efficace-gratuite-', UNIX_TIMESTAMP()),
  'Apprenez les techniques de communication efficaces pour améliorer vos relations professionnelles et personnelles. Cette formation gratuite couvre l\'écoute active, la communication non verbale et la gestion des conflits.',
  'Formation gratuite complète sur les techniques de communication efficace en milieu professionnel.',
  1,
  12, -- Catégorie: Communication
  0.00,
  'XOF',
  'beginner',
  'fr',
  TRUE,
  TRUE,
  150,
  NULL,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 6 MONTH),
  NOW(),
  NOW()
);

SET @course_id = LAST_INSERT_ID();

-- Module 1: Les bases de la communication
INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
VALUES (@course_id, 'Module 1: Les Fondamentaux de la Communication', 'Découvrez les bases de la communication interpersonnelle.', 1, TRUE, NOW(), NOW());
SET @module1_id = LAST_INSERT_ID();

-- Module 2: Communication non verbale
INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
VALUES (@course_id, 'Module 2: Communication Non Verbale', 'Maîtrisez le langage du corps et les signaux non verbaux.', 2, FALSE, NOW(), NOW());
SET @module2_id = LAST_INSERT_ID();

-- Leçons Module 1
INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
VALUES
(@course_id, @module1_id, 'Leçon 1.1: L\'importance de la communication', 'Comprenez pourquoi la communication est essentielle.', '<h2>L\'importance de la communication</h2><p>La communication est au cœur de toutes les interactions humaines. Une communication efficace permet de :</p><ul><li>Établir des relations de confiance</li><li>Résoudre les conflits</li><li>Transmettre des informations clairement</li><li>Motiver et inspirer</li></ul>', 20, 1, 'text', TRUE, NOW(), NOW()),
(@course_id, @module1_id, 'Leçon 1.2: L\'écoute active', 'Apprenez les techniques d\'écoute active.', '<h2>L\'écoute active</h2><p>L\'écoute active consiste à :</p><ul><li>Porter attention au message</li><li>Reformuler pour vérifier la compréhension</li><li>Poser des questions pertinentes</li><li>Éviter les interruptions</li></ul>', 25, 2, 'text', TRUE, NOW(), NOW());

-- Leçons Module 2
INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
VALUES
(@course_id, @module2_id, 'Leçon 2.1: Le langage du corps', 'Découvrez les signaux non verbaux.', '<h2>Le langage du corps</h2><p>Les éléments clés :</p><ul><li>Posture et gestes</li><li>Expressions faciales</li><li>Contact visuel</li><li>Distance interpersonnelle</li></ul>', 30, 1, 'text', TRUE, NOW(), NOW()),
(@course_id, @module2_id, 'Leçon 2.2: Cohérence verbale et non verbale', 'Assurez la cohérence entre vos mots et vos gestes.', '<h2>Cohérence verbale et non verbale</h2><p>Pour être crédible, vos paroles et vos gestes doivent être alignés.</p>', 25, 2, 'text', TRUE, NOW(), NOW());

SET @course2_id = @course_id;

-- ============================================
-- COURS 3: Gestion du Temps et Productivité
-- ============================================

-- Créer le troisième cours gratuit
INSERT INTO courses (
  title,
  slug,
  description,
  short_description,
  instructor_id,
  category_id,
  price,
  currency,
  difficulty,
  language,
  is_published,
  is_featured,
  duration_minutes,
  max_students,
  course_start_date,
  course_end_date,
  created_at,
  updated_at
) VALUES (
  'Gestion du Temps et Productivité - Formation Gratuite',
  CONCAT('gestion-temps-productivite-gratuite-', UNIX_TIMESTAMP()),
  'Découvrez les méthodes et outils pour mieux gérer votre temps et augmenter votre productivité. Cette formation gratuite vous apprendra à prioriser, planifier et optimiser votre organisation quotidienne.',
  'Formation gratuite complète sur la gestion du temps et l\'amélioration de la productivité.',
  1,
  5, -- Catégorie: Compétences Transversales
  0.00,
  'XOF',
  'beginner',
  'fr',
  TRUE,
  TRUE,
  120,
  NULL,
  NOW(),
  DATE_ADD(NOW(), INTERVAL 6 MONTH),
  NOW(),
  NOW()
);

SET @course_id = LAST_INSERT_ID();

-- Module 1: Les principes de base
INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
VALUES (@course_id, 'Module 1: Les Principes de la Gestion du Temps', 'Comprenez les fondamentaux de la gestion du temps.', 1, TRUE, NOW(), NOW());
SET @module1_id = LAST_INSERT_ID();

-- Module 2: Techniques et outils
INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
VALUES (@course_id, 'Module 2: Techniques et Outils de Productivité', 'Découvrez des méthodes concrètes pour être plus productif.', 2, FALSE, NOW(), NOW());
SET @module2_id = LAST_INSERT_ID();

-- Leçons Module 1
INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
VALUES
(@course_id, @module1_id, 'Leçon 1.1: Identifier vos voleurs de temps', 'Apprenez à reconnaître ce qui vous fait perdre du temps.', '<h2>Identifier vos voleurs de temps</h2><p>Les principaux voleurs de temps :</p><ul><li>Interruptions fréquentes</li><li>Multitâche inefficace</li><li>Manque de priorités</li><li>Procrastination</li><li>Réunions non productives</li></ul>', 20, 1, 'text', TRUE, NOW(), NOW()),
(@course_id, @module1_id, 'Leçon 1.2: La matrice d\'Eisenhower', 'Utilisez la matrice d\'Eisenhower pour prioriser vos tâches.', '<h2>La matrice d\'Eisenhower</h2><p>Quatre quadrants :</p><ul><li><strong>Urgent + Important</strong> : À faire immédiatement</li><li><strong>Important mais pas urgent</strong> : À planifier</li><li><strong>Urgent mais pas important</strong> : À déléguer</li><li><strong>Ni urgent ni important</strong> : À éliminer</li></ul>', 25, 2, 'text', TRUE, NOW(), NOW());

-- Leçons Module 2
INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
VALUES
(@course_id, @module2_id, 'Leçon 2.1: La technique Pomodoro', 'Découvrez la méthode Pomodoro pour améliorer votre concentration.', '<h2>La technique Pomodoro</h2><p>Méthode en 4 étapes :</p><ol><li>Travaillez 25 minutes sans interruption</li><li>Prenez une pause de 5 minutes</li><li>Répétez 4 fois</li><li>Prenez une pause longue de 15-30 minutes</li></ol>', 20, 1, 'text', TRUE, NOW(), NOW()),
(@course_id, @module2_id, 'Leçon 2.2: Planification quotidienne', 'Apprenez à planifier efficacement votre journée.', '<h2>Planification quotidienne</h2><p>Bonnes pratiques :</p><ul><li>Planifier la veille au soir</li><li>Commencer par les tâches importantes</li><li>Prévoir des créneaux pour les imprévus</li><li>Réviser en fin de journée</li></ul>', 25, 2, 'text', TRUE, NOW(), NOW());

SET @course3_id = @course_id;

-- ============================================
-- RÉSUMÉ
-- ============================================

SELECT 
  '✅ Cours gratuits créés avec succès !' as message,
  @course1_id as cours_1_id,
  (SELECT title FROM courses WHERE id = @course1_id) as cours_1_titre,
  (SELECT COUNT(*) FROM modules WHERE course_id = @course1_id) as cours_1_modules,
  (SELECT COUNT(*) FROM lessons WHERE course_id = @course1_id) as cours_1_lecons,
  @course2_id as cours_2_id,
  (SELECT title FROM courses WHERE id = @course2_id) as cours_2_titre,
  (SELECT COUNT(*) FROM modules WHERE course_id = @course2_id) as cours_2_modules,
  (SELECT COUNT(*) FROM lessons WHERE course_id = @course2_id) as cours_2_lecons,
  @course3_id as cours_3_id,
  (SELECT title FROM courses WHERE id = @course3_id) as cours_3_titre,
  (SELECT COUNT(*) FROM modules WHERE course_id = @course3_id) as cours_3_modules,
  (SELECT COUNT(*) FROM lessons WHERE course_id = @course3_id) as cours_3_lecons;

