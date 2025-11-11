/**
 * Script pour créer 3 cours gratuits complets
 * Usage: node scripts/create_free_courses.js
 */

require('dotenv').config();
const { pool } = require('../src/config/database');

async function createFreeCourses() {
  let connection;
  
  try {
    connection = await pool.getConnection();
    console.log('✅ Connexion à la base de données établie');

    // Démarrer une transaction
    await connection.beginTransaction();

    // ============================================
    // COURS 1: Introduction à la Gestion de Projet
    // ============================================
    console.log('\n📚 Création du cours 1: Introduction à la Gestion de Projet...');
    
    const [course1Result] = await connection.execute(
      `INSERT INTO courses (
        title, slug, description, short_description, instructor_id, category_id,
        price, currency, difficulty, language, is_published, is_featured,
        duration_minutes, max_students, course_start_date, course_end_date,
        enrollment_deadline, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        'Introduction à la Gestion de Projet - Formation Gratuite',
        `introduction-gestion-projet-gratuite-${Date.now()}`,
        'Cette formation gratuite vous initie aux fondamentaux de la gestion de projet. Vous apprendrez à planifier, organiser et suivre un projet de A à Z. Cette formation est idéale pour les débutants qui souhaitent acquérir les compétences essentielles en gestion de projet.',
        'Formation gratuite complète sur les bases de la gestion de projet : planification, organisation et suivi.',
        1, // Instructeur Davis Borgia
        5, // Catégorie: Compétences Transversales
        0.00, // COURS GRATUIT
        'XOF',
        'beginner',
        'fr',
        true, // Publié
        true, // En vedette
        180, // 3 heures
        null, // Pas de limite d'étudiants
        new Date(), // Date de début
        null, // Pas de date de fin pour les cours gratuits
        null  // Pas de date limite d'inscription pour les cours gratuits
      ]
    );

    const course1Id = course1Result.insertId;
    console.log(`✅ Cours 1 créé avec l'ID: ${course1Id}`);

    // Module 1
    const [module1Result] = await connection.execute(
      `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [course1Id, 'Module 1: Introduction à la Gestion de Projet', 'Découvrez les concepts fondamentaux de la gestion de projet et son importance dans le monde professionnel.', 1, true]
    );
    const module1Id = module1Result.insertId;

    // Module 2
    const [module2Result] = await connection.execute(
      `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [course1Id, 'Module 2: Planification et Organisation', 'Apprenez à planifier efficacement un projet, définir les objectifs et organiser les ressources.', 2, false]
    );
    const module2Id = module2Result.insertId;

    // Module 3
    const [module3Result] = await connection.execute(
      `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [course1Id, 'Module 3: Suivi et Clôture de Projet', 'Maîtrisez les techniques de suivi de projet et apprenez à clôturer efficacement un projet.', 3, false]
    );
    const module3Id = module3Result.insertId;

    // Leçons Module 1
    const lessons1 = [
      [course1Id, module1Id, 'Leçon 1.1: Qu\'est-ce que la gestion de projet ?', 'Introduction aux concepts de base de la gestion de projet.', '<h2>Qu\'est-ce que la gestion de projet ?</h2><p>La gestion de projet est une discipline qui consiste à organiser, planifier et contrôler les ressources pour atteindre des objectifs spécifiques dans un délai déterminé.</p>', 15, 1],
      [course1Id, module1Id, 'Leçon 1.2: Les acteurs du projet', 'Découvrez les différents rôles et responsabilités dans un projet.', '<h2>Les acteurs du projet</h2><p>Un projet implique plusieurs acteurs, chacun avec des responsabilités spécifiques.</p>', 20, 2],
      [course1Id, module1Id, 'Leçon 1.3: Le cycle de vie d\'un projet', 'Comprenez les différentes phases d\'un projet.', '<h2>Le cycle de vie d\'un projet</h2><p>Un projet suit généralement un cycle de vie en plusieurs phases.</p>', 25, 3]
    ];

    for (const lesson of lessons1) {
      await connection.execute(
        `INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'text', TRUE, NOW(), NOW())`,
        lesson
      );
    }

    // Leçons Module 2
    const lessons2 = [
      [course1Id, module2Id, 'Leçon 2.1: Définir les objectifs du projet', 'Apprenez à formuler des objectifs SMART pour votre projet.', '<h2>Définir les objectifs du projet</h2><p>Les objectifs SMART sont spécifiques, mesurables, atteignables, réalistes et temporels.</p>', 20, 1],
      [course1Id, module2Id, 'Leçon 2.2: La structure de découpage du projet (WBS)', 'Découvrez comment décomposer un projet en tâches gérables.', '<h2>La structure de découpage du projet (WBS)</h2><p>Le Work Breakdown Structure permet de décomposer un projet en éléments plus petits et gérables.</p>', 30, 2],
      [course1Id, module2Id, 'Leçon 2.3: Planification des ressources', 'Apprenez à identifier et allouer les ressources nécessaires.', '<h2>Planification des ressources</h2><p>Les ressources d\'un projet incluent les ressources humaines, matérielles, financières et temporelles.</p>', 25, 3]
    ];

    for (const lesson of lessons2) {
      await connection.execute(
        `INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'text', TRUE, NOW(), NOW())`,
        lesson
      );
    }

    // Leçons Module 3
    const lessons3 = [
      [course1Id, module3Id, 'Leçon 3.1: Le suivi de l\'avancement', 'Découvrez les outils et techniques pour suivre l\'avancement d\'un projet.', '<h2>Le suivi de l\'avancement</h2><p>Le suivi régulier permet de détecter les écarts et de prendre des mesures correctives.</p>', 20, 1],
      [course1Id, module3Id, 'Leçon 3.2: Gestion des risques', 'Apprenez à identifier et gérer les risques d\'un projet.', '<h2>Gestion des risques</h2><p>La gestion des risques est essentielle pour la réussite d\'un projet.</p>', 30, 2],
      [course1Id, module3Id, 'Leçon 3.3: Clôture du projet', 'Découvrez les étapes pour clôturer efficacement un projet.', '<h2>Clôture du projet</h2><p>La clôture est une phase cruciale qui permet de capitaliser sur l\'expérience.</p>', 20, 3]
    ];

    for (const lesson of lessons3) {
      await connection.execute(
        `INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'text', TRUE, NOW(), NOW())`,
        lesson
      );
    }

    console.log(`✅ Cours 1: 3 modules, 9 leçons créées`);

    // ============================================
    // COURS 2: Communication Efficace
    // ============================================
    console.log('\n📚 Création du cours 2: Communication Efficace...');
    
    const [course2Result] = await connection.execute(
      `INSERT INTO courses (
        title, slug, description, short_description, instructor_id, category_id,
        price, currency, difficulty, language, is_published, is_featured,
        duration_minutes, max_students, course_start_date, course_end_date,
        enrollment_deadline, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        'Communication Efficace - Formation Gratuite',
        `communication-efficace-gratuite-${Date.now()}`,
        'Apprenez les techniques de communication efficaces pour améliorer vos relations professionnelles et personnelles. Cette formation gratuite couvre l\'écoute active, la communication non verbale et la gestion des conflits.',
        'Formation gratuite complète sur les techniques de communication efficace en milieu professionnel.',
        1,
        12, // Catégorie: Communication
        0.00,
        'XOF',
        'beginner',
        'fr',
        true,
        true,
        150,
        null,
        new Date(),
        null, // Pas de date de fin pour les cours gratuits
        null  // Pas de date limite d'inscription pour les cours gratuits
      ]
    );

    const course2Id = course2Result.insertId;
    console.log(`✅ Cours 2 créé avec l'ID: ${course2Id}`);

    // Modules et leçons pour le cours 2
    const [module2_1Result] = await connection.execute(
      `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [course2Id, 'Module 1: Les Fondamentaux de la Communication', 'Découvrez les bases de la communication interpersonnelle.', 1, true]
    );
    const module2_1Id = module2_1Result.insertId;

    const [module2_2Result] = await connection.execute(
      `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [course2Id, 'Module 2: Communication Non Verbale', 'Maîtrisez le langage du corps et les signaux non verbaux.', 2, false]
    );
    const module2_2Id = module2_2Result.insertId;

    const lessons2_1 = [
      [course2Id, module2_1Id, 'Leçon 1.1: L\'importance de la communication', 'Comprenez pourquoi la communication est essentielle.', '<h2>L\'importance de la communication</h2><p>La communication est au cœur de toutes les interactions humaines.</p>', 20, 1],
      [course2Id, module2_1Id, 'Leçon 1.2: L\'écoute active', 'Apprenez les techniques d\'écoute active.', '<h2>L\'écoute active</h2><p>L\'écoute active consiste à porter attention au message et reformuler pour vérifier la compréhension.</p>', 25, 2]
    ];

    const lessons2_2 = [
      [course2Id, module2_2Id, 'Leçon 2.1: Le langage du corps', 'Découvrez les signaux non verbaux.', '<h2>Le langage du corps</h2><p>Les éléments clés : posture, gestes, expressions faciales, contact visuel.</p>', 30, 1],
      [course2Id, module2_2Id, 'Leçon 2.2: Cohérence verbale et non verbale', 'Assurez la cohérence entre vos mots et vos gestes.', '<h2>Cohérence verbale et non verbale</h2><p>Pour être crédible, vos paroles et vos gestes doivent être alignés.</p>', 25, 2]
    ];

    for (const lesson of [...lessons2_1, ...lessons2_2]) {
      await connection.execute(
        `INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'text', TRUE, NOW(), NOW())`,
        lesson
      );
    }

    console.log(`✅ Cours 2: 2 modules, 4 leçons créées`);

    // ============================================
    // COURS 3: Gestion du Temps et Productivité
    // ============================================
    console.log('\n📚 Création du cours 3: Gestion du Temps et Productivité...');
    
    const [course3Result] = await connection.execute(
      `INSERT INTO courses (
        title, slug, description, short_description, instructor_id, category_id,
        price, currency, difficulty, language, is_published, is_featured,
        duration_minutes, max_students, course_start_date, course_end_date,
        enrollment_deadline, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        'Gestion du Temps et Productivité - Formation Gratuite',
        `gestion-temps-productivite-gratuite-${Date.now()}`,
        'Découvrez les méthodes et outils pour mieux gérer votre temps et augmenter votre productivité. Cette formation gratuite vous apprendra à prioriser, planifier et optimiser votre organisation quotidienne.',
        'Formation gratuite complète sur la gestion du temps et l\'amélioration de la productivité.',
        1,
        5, // Catégorie: Compétences Transversales
        0.00,
        'XOF',
        'beginner',
        'fr',
        true,
        true,
        120,
        null,
        new Date(),
        null, // Pas de date de fin pour les cours gratuits
        null  // Pas de date limite d'inscription pour les cours gratuits
      ]
    );

    const course3Id = course3Result.insertId;
    console.log(`✅ Cours 3 créé avec l'ID: ${course3Id}`);

    // Modules et leçons pour le cours 3
    const [module3_1Result] = await connection.execute(
      `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [course3Id, 'Module 1: Les Principes de la Gestion du Temps', 'Comprenez les fondamentaux de la gestion du temps.', 1, true]
    );
    const module3_1Id = module3_1Result.insertId;

    const [module3_2Result] = await connection.execute(
      `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [course3Id, 'Module 2: Techniques et Outils de Productivité', 'Découvrez des méthodes concrètes pour être plus productif.', 2, false]
    );
    const module3_2Id = module3_2Result.insertId;

    const lessons3_1 = [
      [course3Id, module3_1Id, 'Leçon 1.1: Identifier vos voleurs de temps', 'Apprenez à reconnaître ce qui vous fait perdre du temps.', '<h2>Identifier vos voleurs de temps</h2><p>Les principaux voleurs de temps : interruptions, multitâche inefficace, manque de priorités, procrastination.</p>', 20, 1],
      [course3Id, module3_1Id, 'Leçon 1.2: La matrice d\'Eisenhower', 'Utilisez la matrice d\'Eisenhower pour prioriser vos tâches.', '<h2>La matrice d\'Eisenhower</h2><p>Quatre quadrants : Urgent+Important, Important mais pas urgent, Urgent mais pas important, Ni urgent ni important.</p>', 25, 2]
    ];

    const lessons3_2 = [
      [course3Id, module3_2Id, 'Leçon 2.1: La technique Pomodoro', 'Découvrez la méthode Pomodoro pour améliorer votre concentration.', '<h2>La technique Pomodoro</h2><p>Méthode en 4 étapes : travaillez 25 minutes, pause 5 minutes, répétez 4 fois, pause longue.</p>', 20, 1],
      [course3Id, module3_2Id, 'Leçon 2.2: Planification quotidienne', 'Apprenez à planifier efficacement votre journée.', '<h2>Planification quotidienne</h2><p>Planifier la veille, commencer par les tâches importantes, prévoir des créneaux pour les imprévus.</p>', 25, 2]
    ];

    for (const lesson of [...lessons3_1, ...lessons3_2]) {
      await connection.execute(
        `INSERT INTO lessons (course_id, module_id, title, description, content, duration_minutes, order_index, content_type, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'text', TRUE, NOW(), NOW())`,
        lesson
      );
    }

    console.log(`✅ Cours 3: 2 modules, 4 leçons créées`);

    // Valider la transaction
    await connection.commit();
    console.log('\n✅ Transaction validée avec succès !');

    // Afficher le résumé
    console.log('\n📊 RÉSUMÉ DES COURS CRÉÉS :');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Cours 1 (ID: ${course1Id}): Introduction à la Gestion de Projet`);
    console.log(`   - 3 modules, 9 leçons, 180 minutes`);
    console.log(`✅ Cours 2 (ID: ${course2Id}): Communication Efficace`);
    console.log(`   - 2 modules, 4 leçons, 150 minutes`);
    console.log(`✅ Cours 3 (ID: ${course3Id}): Gestion du Temps et Productivité`);
    console.log(`   - 2 modules, 4 leçons, 120 minutes`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🎉 Tous les cours gratuits ont été créés avec succès !');
    console.log('💡 L\'utilisateur 76 peut maintenant s\'inscrire depuis son tableau de bord.');

  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.error('❌ Erreur lors de la création, transaction annulée');
    }
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Exécuter le script
createFreeCourses()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });

