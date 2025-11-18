/*
  Seeder pour créer deux formations complètes : Développement Web et Blockchain
  Utilisation: node database/seed_complete_courses.js
  Crée: formations complètes avec modules, leçons, quiz et évaluations finales
*/
require('dotenv').config({ override: true });
const { pool } = require('../src/config/database');

const INSTRUCTOR_EMAIL = 'groupflexy1@gmail.com';

async function withTransaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    try { await connection.rollback(); } catch {}
    throw err;
  } finally {
    connection.release();
  }
}

async function ensureInstructor(connection) {
  const [instructors] = await connection.execute(
    'SELECT id, first_name, last_name, email FROM users WHERE email = ? AND (role = "instructor" OR role = "admin") LIMIT 1',
    [INSTRUCTOR_EMAIL]
  );
  
  if (instructors.length > 0) {
    console.log(`✔ Instructeur trouvé: ${instructors[0].email} (ID: ${instructors[0].id})`);
    return instructors[0].id;
  }
  
  // Créer l'instructeur
  console.log(`→ Création instructeur ${INSTRUCTOR_EMAIL}...`);
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('Password123@', 12);
  const [newInstructor] = await connection.execute(
    `INSERT INTO users (first_name, last_name, email, password, role, is_active, is_email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'instructor', TRUE, TRUE, NOW(), NOW())`,
    ['GroupFlexy', 'Instructor', INSTRUCTOR_EMAIL, hashedPassword]
  );
  console.log(`✔ Instructeur créé (ID: ${newInstructor.insertId})`);
  return newInstructor.insertId;
}

async function ensureCategory(connection, name, color = '#4F46E5', icon = 'book') {
  const [rows] = await connection.execute('SELECT id FROM categories WHERE name = ? LIMIT 1', [name]);
  if (rows.length) {
    console.log(`✔ Catégorie "${name}" existe déjà`);
    return rows[0].id;
  }
  const [res] = await connection.execute(
    'INSERT INTO categories (name, description, color, icon, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
    [name, `Catégorie ${name}`, color, icon]
  );
  console.log(`✔ Catégorie "${name}" créée (ID: ${res.insertId})`);
  return res.insertId;
}

async function createCourse(connection, courseData, instructorId, categoryId) {
  const [existing] = await connection.execute(
    'SELECT id FROM courses WHERE title = ? AND instructor_id = ? LIMIT 1',
    [courseData.title, instructorId]
  );
  
  if (existing.length > 0) {
    console.log(`⚠️  Cours "${courseData.title}" existe déjà, mise à jour...`);
    await connection.execute(
      `UPDATE courses SET 
        description = ?, short_description = ?, category_id = ?,
        duration_minutes = ?, difficulty = ?, price = ?, currency = ?,
        is_published = TRUE, status = 'approved', updated_at = NOW()
       WHERE id = ?`,
      [
        courseData.description,
        courseData.short_description,
        categoryId,
        courseData.duration_minutes,
        courseData.difficulty,
        courseData.price,
        courseData.currency,
        existing[0].id
      ]
    );
    return existing[0].id;
  }
  
  const [res] = await connection.execute(
    `INSERT INTO courses (
      title, description, short_description, instructor_id, category_id,
      duration_minutes, difficulty, language, price, currency,
      is_published, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'fr', ?, ?, TRUE, 'approved', NOW(), NOW())`,
    [
      courseData.title,
      courseData.description,
      courseData.short_description,
      instructorId,
      categoryId,
      courseData.duration_minutes,
      courseData.difficulty,
      courseData.price,
      courseData.currency
    ]
  );
  console.log(`✔ Cours "${courseData.title}" créé (ID: ${res.insertId})`);
  return res.insertId;
}

async function createModule(connection, courseId, moduleData) {
  const [existing] = await connection.execute(
    'SELECT id FROM modules WHERE course_id = ? AND title = ? LIMIT 1',
    [courseId, moduleData.title]
  );
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  const [res] = await connection.execute(
    `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [courseId, moduleData.title, moduleData.description, moduleData.order_index, moduleData.is_unlocked || false]
  );
  return res.insertId;
}

async function createLesson(connection, courseId, moduleId, lessonData) {
  const [existing] = await connection.execute(
    'SELECT id FROM lessons WHERE module_id = ? AND title = ? LIMIT 1',
    [moduleId, lessonData.title]
  );
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  const [res] = await connection.execute(
    `INSERT INTO lessons (
      course_id, module_id, title, description, content, duration_minutes,
      order_index, is_published, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
    [
      courseId,
      moduleId,
      lessonData.title,
      lessonData.description,
      lessonData.content || lessonData.description,
      lessonData.duration_minutes,
      lessonData.order_index
    ]
  );
  return res.insertId;
}

async function createModuleQuiz(connection, moduleId, quizData) {
  const [existing] = await connection.execute(
    'SELECT id FROM module_quizzes WHERE module_id = ? LIMIT 1',
    [moduleId]
  );
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  const [res] = await connection.execute(
    `INSERT INTO module_quizzes (
      module_id, title, description, passing_score, time_limit_minutes,
      max_attempts, is_published, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
    [
      moduleId,
      quizData.title,
      quizData.description,
      quizData.passing_score || 70,
      quizData.time_limit_minutes,
      quizData.max_attempts || 3
    ]
  );
  return res.insertId;
}

async function createQuizQuestion(connection, questionData, courseEvaluationId = null, moduleQuizId = null) {
  const [res] = await connection.execute(
    `INSERT INTO quiz_questions (
      quiz_id, module_quiz_id, course_evaluation_id, question_text, question_type,
      points, order_index, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
    [
      null, // quiz_id est NULL pour les quiz de modules et évaluations finales
      moduleQuizId,
      courseEvaluationId,
      questionData.question_text,
      questionData.question_type || 'multiple_choice',
      questionData.points || 1.0,
      questionData.order_index
    ]
  );
  return res.insertId;
}

async function createQuizAnswer(connection, questionId, answerData) {
  const [res] = await connection.execute(
    `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [questionId, answerData.answer_text, answerData.is_correct || false, answerData.order_index]
  );
  return res.insertId;
}

async function createCourseEvaluation(connection, courseId, evaluationData) {
  const [existing] = await connection.execute(
    'SELECT id FROM course_evaluations WHERE course_id = ? LIMIT 1',
    [courseId]
  );
  
  if (existing.length > 0) {
    return existing[0].id;
  }
  
  const [res] = await connection.execute(
    `INSERT INTO course_evaluations (
      course_id, title, description, passing_score, duration_minutes,
      max_attempts, is_published, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
    [
      courseId,
      evaluationData.title,
      evaluationData.description,
      evaluationData.passing_score || 70,
      evaluationData.duration_minutes,
      evaluationData.max_attempts || 3
    ]
  );
  return res.insertId;
}

// Données pour la formation Développement Web
const webDevelopmentCourse = {
  title: 'Développement Web Full Stack',
  description: 'Formation complète pour devenir développeur web full stack. Apprenez HTML, CSS, JavaScript, Node.js, bases de données, React et le déploiement.',
  short_description: 'Maîtrisez le développement web de A à Z',
  duration_minutes: 2400, // 40 heures
  difficulty: 'intermediate',
  price: 180000,
  currency: 'XOF',
  modules: [
    {
      title: 'Fondamentaux du Web (HTML/CSS/JavaScript)',
      description: 'Apprenez les bases du développement web avec HTML, CSS et JavaScript',
      order_index: 1,
      is_unlocked: true,
      lessons: [
        { title: 'Introduction au HTML5', description: 'Structure et sémantique HTML5', duration_minutes: 60, order_index: 1 },
        { title: 'CSS3 et Responsive Design', description: 'Styles modernes et design adaptatif', duration_minutes: 90, order_index: 2 },
        { title: 'JavaScript ES6+', description: 'Variables, fonctions, objets et classes', duration_minutes: 90, order_index: 3 },
        { title: 'DOM et Manipulation', description: 'Interagir avec le DOM', duration_minutes: 75, order_index: 4 },
        { title: 'Asynchrone et Promises', description: 'Async/await et gestion asynchrone', duration_minutes: 90, order_index: 5 },
        { title: 'Projet pratique : Site web', description: 'Création d\'un site web complet', duration_minutes: 90, order_index: 6 }
      ],
      quiz: {
        title: 'Quiz Module 1 : Fondamentaux du Web',
        description: 'Évaluez vos connaissances sur HTML, CSS et JavaScript',
        time_limit_minutes: 25,
        questions: [
          {
            question_text: 'Qu\'est-ce que le HTML5 apporte de nouveau par rapport au HTML4 ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 1,
            answers: [
              { answer_text: 'Nouvelles balises sémantiques (header, nav, section, article)', is_correct: true, order_index: 1 },
              { answer_text: 'Support natif de la vidéo et audio', is_correct: true, order_index: 2 },
              { answer_text: 'Canvas et SVG pour les graphiques', is_correct: true, order_index: 3 },
              { answer_text: 'Tout ce qui précède', is_correct: false, order_index: 4 }
            ]
          },
          {
            question_text: 'Qu\'est-ce que le responsive design ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 2,
            answers: [
              { answer_text: 'Un design qui s\'adapte à différentes tailles d\'écran', is_correct: true, order_index: 1 },
              { answer_text: 'Un design rapide à charger', is_correct: false, order_index: 2 },
              { answer_text: 'Un design avec beaucoup d\'animations', is_correct: false, order_index: 3 },
              { answer_text: 'Un design en noir et blanc', is_correct: false, order_index: 4 }
            ]
          },
          {
            question_text: 'Quelle est la différence entre let et var en JavaScript ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 3,
            answers: [
              { answer_text: 'let a un scope de bloc, var a un scope de fonction', is_correct: true, order_index: 1 },
              { answer_text: 'Il n\'y a pas de différence', is_correct: false, order_index: 2 },
              { answer_text: 'var est plus moderne que let', is_correct: false, order_index: 3 },
              { answer_text: 'let ne peut pas être réassigné', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    },
    {
      title: 'Backend avec Node.js et Express',
      description: 'Créez des serveurs et APIs avec Node.js et Express',
      order_index: 2,
      is_unlocked: false,
      lessons: [
        { title: 'Introduction à Node.js', description: 'Environnement Node.js et npm', duration_minutes: 90, order_index: 1 },
        { title: 'Express.js et Routes', description: 'Framework Express et gestion des routes', duration_minutes: 120, order_index: 2 },
        { title: 'Middleware et Authentification', description: 'Création de middleware et JWT', duration_minutes: 120, order_index: 3 },
        { title: 'API RESTful', description: 'Conception et implémentation d\'APIs REST', duration_minutes: 120, order_index: 4 },
        { title: 'Gestion des erreurs et validation', description: 'Gestion robuste des erreurs', duration_minutes: 90, order_index: 5 }
      ],
      quiz: {
        title: 'Quiz Module 2 : Backend Node.js',
        description: 'Testez vos connaissances sur Node.js et Express',
        time_limit_minutes: 30,
        questions: [
          {
            question_text: 'Qu\'est-ce qu\'un middleware dans Express ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 1,
            answers: [
              { answer_text: 'Une fonction qui a accès à req, res et next', is_correct: true, order_index: 1 },
              { answer_text: 'Un serveur séparé', is_correct: false, order_index: 2 },
              { answer_text: 'Une base de données', is_correct: false, order_index: 3 },
              { answer_text: 'Un framework frontend', is_correct: false, order_index: 4 }
            ]
          },
          {
            question_text: 'Quelle méthode HTTP est utilisée pour créer une ressource ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 2,
            answers: [
              { answer_text: 'POST', is_correct: true, order_index: 1 },
              { answer_text: 'GET', is_correct: false, order_index: 2 },
              { answer_text: 'PUT', is_correct: false, order_index: 3 },
              { answer_text: 'DELETE', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    },
    {
      title: 'Bases de données (MySQL/MongoDB)',
      description: 'Apprenez à utiliser MySQL et MongoDB pour stocker vos données',
      order_index: 3,
      is_unlocked: false,
      lessons: [
        { title: 'Introduction aux bases de données', description: 'Concepts SQL et NoSQL', duration_minutes: 75, order_index: 1 },
        { title: 'MySQL : Requêtes et jointures', description: 'Requêtes SQL complexes', duration_minutes: 90, order_index: 2 },
        { title: 'ORM avec Sequelize', description: 'Utilisation de Sequelize pour MySQL', duration_minutes: 90, order_index: 3 },
        { title: 'MongoDB et Mongoose', description: 'Bases de données NoSQL', duration_minutes: 90, order_index: 4 },
        { title: 'Optimisation et indexation', description: 'Performance des bases de données', duration_minutes: 75, order_index: 5 }
      ],
      quiz: {
        title: 'Quiz Module 3 : Bases de données',
        description: 'Évaluez vos connaissances sur MySQL et MongoDB',
        time_limit_minutes: 25,
        questions: [
          {
            question_text: 'Quelle est la différence principale entre SQL et NoSQL ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 1,
            answers: [
              { answer_text: 'SQL est relationnel, NoSQL est non-relationnel', is_correct: true, order_index: 1 },
              { answer_text: 'SQL est plus rapide', is_correct: false, order_index: 2 },
              { answer_text: 'NoSQL ne stocke pas de données', is_correct: false, order_index: 3 },
              { answer_text: 'Il n\'y a pas de différence', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    },
    {
      title: 'Frameworks Frontend (React)',
      description: 'Développez des interfaces modernes avec React',
      order_index: 4,
      is_unlocked: false,
      lessons: [
        { title: 'Introduction à React', description: 'Composants et JSX', duration_minutes: 90, order_index: 1 },
        { title: 'State et Props', description: 'Gestion de l\'état dans React', duration_minutes: 120, order_index: 2 },
        { title: 'Hooks React', description: 'useState, useEffect et hooks personnalisés', duration_minutes: 120, order_index: 3 },
        { title: 'Routing avec React Router', description: 'Navigation dans une app React', duration_minutes: 90, order_index: 4 },
        { title: 'State Management avec Redux', description: 'Gestion globale de l\'état', duration_minutes: 120, order_index: 5 },
        { title: 'Projet : Application React complète', description: 'Création d\'une application complète', duration_minutes: 120, order_index: 6 }
      ],
      quiz: {
        title: 'Quiz Module 4 : React',
        description: 'Testez vos connaissances sur React',
        time_limit_minutes: 30,
        questions: [
          {
            question_text: 'Qu\'est-ce qu\'un composant React ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 1,
            answers: [
              { answer_text: 'Une fonction ou classe qui retourne du JSX', is_correct: true, order_index: 1 },
              { answer_text: 'Un fichier CSS', is_correct: false, order_index: 2 },
              { answer_text: 'Une base de données', is_correct: false, order_index: 3 },
              { answer_text: 'Un serveur', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    },
    {
      title: 'Déploiement et DevOps',
      description: 'Déployez vos applications en production',
      order_index: 5,
      is_unlocked: false,
      lessons: [
        { title: 'Git et GitHub', description: 'Versioning et collaboration', duration_minutes: 60, order_index: 1 },
        { title: 'CI/CD avec GitHub Actions', description: 'Automatisation du déploiement', duration_minutes: 60, order_index: 2 },
        { title: 'Déploiement sur Vercel/Netlify', description: 'Hébergement frontend', duration_minutes: 45, order_index: 3 },
        { title: 'Docker et conteneurisation', description: 'Conteneurs et orchestration', duration_minutes: 75, order_index: 4 }
      ],
      quiz: {
        title: 'Quiz Module 5 : DevOps',
        description: 'Évaluez vos connaissances sur le déploiement',
        time_limit_minutes: 20,
        questions: [
          {
            question_text: 'Qu\'est-ce que Docker ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 1,
            answers: [
              { answer_text: 'Une plateforme de conteneurisation', is_correct: true, order_index: 1 },
              { answer_text: 'Un framework JavaScript', is_correct: false, order_index: 2 },
              { answer_text: 'Une base de données', is_correct: false, order_index: 3 },
              { answer_text: 'Un serveur web', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    }
  ],
  finalEvaluation: {
    title: 'Évaluation Finale : Développement Web Full Stack',
    description: 'Évaluation complète de vos compétences en développement web',
    duration_minutes: 90,
    passing_score: 70,
    max_attempts: 3,
    questions: [
      {
        question_text: 'Quelle est la meilleure pratique pour sécuriser une API REST ?',
        question_type: 'multiple_choice',
        points: 5,
        order_index: 1,
        answers: [
          { answer_text: 'Utiliser JWT pour l\'authentification', is_correct: true, order_index: 1 },
          { answer_text: 'Exposer toutes les routes publiquement', is_correct: false, order_index: 2 },
          { answer_text: 'Ne pas valider les données', is_correct: false, order_index: 3 },
          { answer_text: 'Stocker les mots de passe en clair', is_correct: false, order_index: 4 }
        ]
      },
      {
        question_text: 'Expliquez la différence entre SQL et NoSQL (question ouverte)',
        question_type: 'short_answer',
        points: 10,
        order_index: 2,
        answers: [
          { answer_text: 'SQL est relationnel avec schéma fixe, NoSQL est flexible et non-relationnel', is_correct: true, order_index: 1 }
        ]
      }
    ]
  }
};

// Données pour la formation Blockchain
const blockchainCourse = {
  title: 'Blockchain et Smart Contracts',
  description: 'Formation complète sur la blockchain, la cryptographie, le développement de smart contracts avec Solidity et la création d\'applications décentralisées.',
  short_description: 'Maîtrisez la blockchain et les smart contracts',
  duration_minutes: 2700, // 45 heures
  difficulty: 'advanced',
  price: 250000,
  currency: 'XOF',
  modules: [
    {
      title: 'Introduction à la Blockchain',
      description: 'Comprendre les concepts fondamentaux de la blockchain',
      order_index: 1,
      is_unlocked: true,
      lessons: [
        { title: 'Histoire et origine de la blockchain', description: 'Bitcoin, Satoshi Nakamoto et l\'évolution', duration_minutes: 75, order_index: 1 },
        { title: 'Architecture de la blockchain', description: 'Blocs, hash, chaînage', duration_minutes: 75, order_index: 2 },
        { title: 'Consensus et validation', description: 'Proof of Work, Proof of Stake', duration_minutes: 60, order_index: 3 },
        { title: 'Types de blockchains', description: 'Publique, privée, consortium', duration_minutes: 60, order_index: 4 },
        { title: 'Cas d\'usage et applications', description: 'Cryptomonnaies, DeFi, NFT', duration_minutes: 60, order_index: 5 }
      ],
      quiz: {
        title: 'Quiz Module 1 : Introduction Blockchain',
        description: 'Testez vos connaissances sur les bases de la blockchain',
        time_limit_minutes: 30,
        questions: [
          {
            question_text: 'Qu\'est-ce qu\'un bloc dans une blockchain ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 1,
            answers: [
              { answer_text: 'Un conteneur de transactions avec un hash unique', is_correct: true, order_index: 1 },
              { answer_text: 'Une base de données SQL', is_correct: false, order_index: 2 },
              { answer_text: 'Un serveur web', is_correct: false, order_index: 3 },
              { answer_text: 'Un framework JavaScript', is_correct: false, order_index: 4 }
            ]
          },
          {
            question_text: 'Quelle est la différence entre Proof of Work et Proof of Stake ?',
            question_type: 'multiple_choice',
            points: 3,
            order_index: 2,
            answers: [
              { answer_text: 'PoW nécessite de la puissance de calcul, PoS nécessite des tokens', is_correct: true, order_index: 1 },
              { answer_text: 'Il n\'y a pas de différence', is_correct: false, order_index: 2 },
              { answer_text: 'PoS est plus ancien que PoW', is_correct: false, order_index: 3 },
              { answer_text: 'PoW est plus sécurisé que PoS', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    },
    {
      title: 'Cryptographie et Sécurité',
      description: 'Fondamentaux de la cryptographie appliquée à la blockchain',
      order_index: 2,
      is_unlocked: false,
      lessons: [
        { title: 'Cryptographie symétrique et asymétrique', description: 'Clés publiques et privées', duration_minutes: 90, order_index: 1 },
        { title: 'Fonctions de hachage', description: 'SHA-256, Keccak-256', duration_minutes: 75, order_index: 2 },
        { title: 'Signatures numériques', description: 'ECDSA et signatures cryptographiques', duration_minutes: 90, order_index: 3 },
        { title: 'Wallets et gestion des clés', description: 'Portefeuilles cryptographiques', duration_minutes: 75, order_index: 4 },
        { title: 'Sécurité des smart contracts', description: 'Vulnérabilités communes', duration_minutes: 90, order_index: 5 },
        { title: 'Bonnes pratiques de sécurité', description: 'Audit et tests de sécurité', duration_minutes: 60, order_index: 6 }
      ],
      quiz: {
        title: 'Quiz Module 2 : Cryptographie',
        description: 'Évaluez vos connaissances en cryptographie',
        time_limit_minutes: 35,
        questions: [
          {
            question_text: 'Qu\'est-ce qu\'une fonction de hachage ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 1,
            answers: [
              { answer_text: 'Une fonction qui transforme des données en une chaîne de caractères fixe', is_correct: true, order_index: 1 },
              { answer_text: 'Une fonction de chiffrement réversible', is_correct: false, order_index: 2 },
              { answer_text: 'Un algorithme de consensus', is_correct: false, order_index: 3 },
              { answer_text: 'Un type de blockchain', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    },
    {
      title: 'Développement Smart Contracts (Solidity)',
      description: 'Apprenez à développer des smart contracts avec Solidity',
      order_index: 3,
      is_unlocked: false,
      lessons: [
        { title: 'Introduction à Solidity', description: 'Syntaxe et structure de base', duration_minutes: 120, order_index: 1 },
        { title: 'Types de données et variables', description: 'uint, string, mapping, struct', duration_minutes: 120, order_index: 2 },
        { title: 'Fonctions et modificateurs', description: 'public, private, view, pure', duration_minutes: 120, order_index: 3 },
        { title: 'Héritage et interfaces', description: 'Réutilisabilité du code', duration_minutes: 90, order_index: 4 },
        { title: 'Events et logs', description: 'Émission d\'événements on-chain', duration_minutes: 90, order_index: 5 },
        { title: 'Projet : Token ERC-20', description: 'Création d\'un token personnalisé', duration_minutes: 120, order_index: 6 }
      ],
      quiz: {
        title: 'Quiz Module 3 : Solidity',
        description: 'Testez vos compétences en développement Solidity',
        time_limit_minutes: 35,
        questions: [
          {
            question_text: 'Qu\'est-ce qu\'un smart contract ?',
            question_type: 'multiple_choice',
            points: 3,
            order_index: 1,
            answers: [
              { answer_text: 'Un programme auto-exécutable sur la blockchain', is_correct: true, order_index: 1 },
              { answer_text: 'Un contrat papier signé', is_correct: false, order_index: 2 },
              { answer_text: 'Une base de données', is_correct: false, order_index: 3 },
              { answer_text: 'Un framework frontend', is_correct: false, order_index: 4 }
            ]
          },
          {
            question_text: 'Quelle est la différence entre view et pure en Solidity ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 2,
            answers: [
              { answer_text: 'view lit l\'état, pure ne lit ni n\'écrit l\'état', is_correct: true, order_index: 1 },
              { answer_text: 'Il n\'y a pas de différence', is_correct: false, order_index: 2 },
              { answer_text: 'pure est plus rapide', is_correct: false, order_index: 3 },
              { answer_text: 'view est obsolète', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    },
    {
      title: 'Plateformes Blockchain (Ethereum, Binance Smart Chain)',
      description: 'Découvrez les principales plateformes blockchain',
      order_index: 4,
      is_unlocked: false,
      lessons: [
        { title: 'Ethereum : Architecture et EVM', description: 'Machine virtuelle Ethereum', duration_minutes: 120, order_index: 1 },
        { title: 'Gas et frais de transaction', description: 'Optimisation des coûts', duration_minutes: 90, order_index: 2 },
        { title: 'Binance Smart Chain (BSC)', description: 'Alternative à Ethereum', duration_minutes: 90, order_index: 3 },
        { title: 'Outils de développement', description: 'Truffle, Hardhat, Remix', duration_minutes: 120, order_index: 4 },
        { title: 'Testnets et déploiement', description: 'Déployer sur testnet et mainnet', duration_minutes: 90, order_index: 5 }
      ],
      quiz: {
        title: 'Quiz Module 4 : Plateformes',
        description: 'Évaluez vos connaissances sur Ethereum et BSC',
        time_limit_minutes: 30,
        questions: [
          {
            question_text: 'Qu\'est-ce que l\'EVM (Ethereum Virtual Machine) ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 1,
            answers: [
              { answer_text: 'L\'environnement d\'exécution des smart contracts sur Ethereum', is_correct: true, order_index: 1 },
              { answer_text: 'Un wallet', is_correct: false, order_index: 2 },
              { answer_text: 'Une cryptomonnaie', is_correct: false, order_index: 3 },
              { answer_text: 'Un exchange', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    },
    {
      title: 'Applications Décentralisées (DApps)',
      description: 'Créez des applications décentralisées complètes',
      order_index: 5,
      is_unlocked: false,
      lessons: [
        { title: 'Architecture d\'une DApp', description: 'Frontend, backend et blockchain', duration_minutes: 90, order_index: 1 },
        { title: 'Web3.js et Ethers.js', description: 'Interagir avec la blockchain depuis JavaScript', duration_minutes: 90, order_index: 2 },
        { title: 'MetaMask et connexion wallet', description: 'Intégration de wallets', duration_minutes: 75, order_index: 3 },
        { title: 'Projet : DApp de vote', description: 'Application de vote décentralisée', duration_minutes: 120, order_index: 4 },
        { title: 'Projet : Marketplace NFT', description: 'Création d\'un marché NFT', duration_minutes: 120, order_index: 5 },
        { title: 'Déploiement et maintenance', description: 'Mettre en production une DApp', duration_minutes: 90, order_index: 6 }
      ],
      quiz: {
        title: 'Quiz Module 5 : DApps',
        description: 'Testez vos connaissances sur les DApps',
        time_limit_minutes: 30,
        questions: [
          {
            question_text: 'Qu\'est-ce qu\'une DApp ?',
            question_type: 'multiple_choice',
            points: 2,
            order_index: 1,
            answers: [
              { answer_text: 'Une application décentralisée fonctionnant sur la blockchain', is_correct: true, order_index: 1 },
              { answer_text: 'Une application mobile', is_correct: false, order_index: 2 },
              { answer_text: 'Un framework backend', is_correct: false, order_index: 3 },
              { answer_text: 'Une base de données', is_correct: false, order_index: 4 }
            ]
          }
        ]
      }
    }
  ],
  finalEvaluation: {
    title: 'Évaluation Finale : Blockchain et Smart Contracts',
    description: 'Évaluation complète de vos compétences en blockchain',
    duration_minutes: 120,
    passing_score: 70,
    max_attempts: 3,
    questions: [
      {
        question_text: 'Expliquez le processus de validation d\'une transaction blockchain (question ouverte)',
        question_type: 'short_answer',
        points: 15,
        order_index: 1,
        answers: [
          { answer_text: 'La transaction est vérifiée, ajoutée à un bloc, le bloc est miné/validé, puis ajouté à la chaîne', is_correct: true, order_index: 1 }
        ]
      },
      {
        question_text: 'Quelles sont les principales vulnérabilités des smart contracts ?',
        question_type: 'multiple_choice',
        points: 10,
        order_index: 2,
        answers: [
          { answer_text: 'Reentrancy, overflow, accès non autorisé', is_correct: true, order_index: 1 },
          { answer_text: 'Problèmes de design uniquement', is_correct: false, order_index: 2 },
          { answer_text: 'Aucune vulnérabilité possible', is_correct: false, order_index: 3 },
          { answer_text: 'Seulement les erreurs de syntaxe', is_correct: false, order_index: 4 }
        ]
      }
    ]
  }
};

async function seedCourse(connection, courseData, instructorId, categoryId) {
  console.log(`\n📚 Création de la formation : ${courseData.title}`);
  
  // Créer le cours
  const courseId = await createCourse(connection, courseData, instructorId, categoryId);
  
  // Créer une entrée dans course_approvals pour l'historique (si la table existe)
  try {
    const [[hasCourseApprovals]] = await connection.query("SHOW TABLES LIKE 'course_approvals'");
    if (hasCourseApprovals) {
      const [existingApproval] = await connection.execute(
        'SELECT id FROM course_approvals WHERE course_id = ? LIMIT 1',
        [courseId]
      );
      if (!existingApproval.length) {
        await connection.execute(
          `INSERT INTO course_approvals (course_id, admin_id, status, reviewed_at, created_at, updated_at)
           VALUES (?, NULL, 'approved', NOW(), NOW(), NOW())`,
          [courseId]
        );
        console.log(`  → Entrée d'approbation créée dans l'historique`);
      }
    }
  } catch (err) {
    // Table n'existe peut-être pas, ce n'est pas critique
    console.log(`  ⚠️  Impossible de créer l'entrée d'approbation: ${err.message}`);
  }
  
  // Créer les modules
  console.log(`  → Création de ${courseData.modules.length} modules...`);
  for (const moduleData of courseData.modules) {
    const moduleId = await createModule(connection, courseId, moduleData);
    console.log(`    ✔ Module créé : ${moduleData.title}`);
    
    // Créer les leçons du module
    for (const lessonData of moduleData.lessons) {
      await createLesson(connection, courseId, moduleId, lessonData);
    }
    console.log(`      → ${moduleData.lessons.length} leçons créées`);
    
    // Créer le quiz du module
    if (moduleData.quiz) {
      const quizId = await createModuleQuiz(connection, moduleId, moduleData.quiz);
      console.log(`      → Quiz créé : ${moduleData.quiz.title}`);
      
      // Créer les questions du quiz
      for (const questionData of moduleData.quiz.questions) {
        const questionId = await createQuizQuestion(connection, questionData, null, quizId);
        
        // Créer les réponses
        for (const answerData of questionData.answers) {
          await createQuizAnswer(connection, questionId, answerData);
        }
      }
      console.log(`        → ${moduleData.quiz.questions.length} questions créées`);
    }
  }
  
  // Créer l'évaluation finale
  if (courseData.finalEvaluation) {
    const evaluationId = await createCourseEvaluation(connection, courseId, courseData.finalEvaluation);
    console.log(`  → Évaluation finale créée : ${courseData.finalEvaluation.title}`);
    
    // Créer les questions de l'évaluation finale
    for (const questionData of courseData.finalEvaluation.questions) {
      const questionId = await createQuizQuestion(connection, questionData, evaluationId, null);
      
      // Créer les réponses
      for (const answerData of questionData.answers) {
        await createQuizAnswer(connection, questionId, answerData);
      }
    }
    console.log(`    → ${courseData.finalEvaluation.questions.length} questions créées`);
  }
  
  console.log(`✔ Formation "${courseData.title}" complétée !\n`);
}

async function seed() {
  console.log('🚀 Démarrage du seeding des formations complètes...\n');
  
  await withTransaction(async (conn) => {
    // Vérifier et créer la colonne status dans courses si nécessaire
    try {
      const [[hasStatus]] = await conn.query("SHOW COLUMNS FROM courses LIKE 'status'");
      if (!hasStatus) {
        console.log('→ Ajout de la colonne status à courses...');
        await conn.execute("ALTER TABLE courses ADD COLUMN status ENUM('draft', 'pending_approval', 'approved', 'rejected', 'published') DEFAULT 'draft'");
        await conn.execute("CREATE INDEX idx_status ON courses(status)");
        console.log('✔ Colonne status ajoutée');
      }
    } catch (err) {
      console.log('⚠️  Vérification structure courses:', err.message);
    }
    
    // Vérifier et créer la colonne module_quiz_id si nécessaire
    try {
      const [[hasModuleQuizId]] = await conn.query("SHOW COLUMNS FROM quiz_questions LIKE 'module_quiz_id'");
      if (!hasModuleQuizId) {
        console.log('→ Ajout de la colonne module_quiz_id à quiz_questions...');
        await conn.execute("ALTER TABLE quiz_questions ADD COLUMN module_quiz_id INT NULL AFTER quiz_id");
        await conn.execute("CREATE INDEX idx_module_quiz_id ON quiz_questions (module_quiz_id)");
        await conn.execute("ALTER TABLE quiz_questions ADD CONSTRAINT fk_quiz_questions_module_quiz FOREIGN KEY (module_quiz_id) REFERENCES module_quizzes(id) ON DELETE CASCADE");
        console.log('✔ Colonne module_quiz_id ajoutée');
      }
      
      // S'assurer que quiz_id peut être NULL
      const [[quizIdInfo]] = await conn.query("SHOW COLUMNS FROM quiz_questions WHERE Field = 'quiz_id'");
      if (quizIdInfo && quizIdInfo.Null === 'NO') {
        console.log('→ Modification de quiz_id pour permettre NULL...');
        await conn.execute("ALTER TABLE quiz_questions MODIFY COLUMN quiz_id INT NULL");
        console.log('✔ quiz_id peut maintenant être NULL');
      }
    } catch (err) {
      console.log('⚠️  Vérification structure quiz_questions:', err.message);
    }
    
    // 1. Vérifier/Créer l'instructeur
    const instructorId = await ensureInstructor(conn);
    
    // 2. Créer les catégories
    const webCategoryId = await ensureCategory(conn, 'Développement Web', '#007bff', 'code');
    const blockchainCategoryId = await ensureCategory(conn, 'Blockchain', '#8b5cf6', 'blockchain');
    
    // 3. Créer la formation Développement Web
    await seedCourse(conn, webDevelopmentCourse, instructorId, webCategoryId);
    
    // 4. Créer la formation Blockchain
    await seedCourse(conn, blockchainCourse, instructorId, blockchainCategoryId);
    
    console.log('✅ Seeding terminé avec succès !');
  });
}

seed()
  .then(() => {
    console.log('\n✨ Toutes les formations ont été créées avec succès !');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erreur lors du seeding:', err);
    process.exit(1);
  });

