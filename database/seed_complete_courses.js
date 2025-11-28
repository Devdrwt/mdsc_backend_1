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
        {
          title: 'Introduction au HTML5',
          description: 'Structure et sémantique HTML5',
          duration_minutes: 60,
          order_index: 1,
          content: `
            <p>Dans cette première immersion, nous revisitons entièrement l'histoire du HTML en expliquant pourquoi HTML5 a marqué une rupture avec l'époque des documents purement descriptifs. Nous détaillons la relation entre structure logique et accessibilité, et nous montrons comment les balises sémantiques facilitent l'ancrage SEO et le travail des lecteurs d'écran.</p>
            <p>Chaque concept est illustré par des exemples complets incluant l'utilisation des balises <code>&lt;header&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;article&gt;</code>, ainsi que l'intégration de micro-données pour enrichir vos pages. Vous apprendrez aussi à préparer des squelettes de pages robustes pour les futures intégrations CSS et JavaScript.</p>
            <ul>
              <li>Analyse approfondie d'une page HTML5 réelle avec annotations ligne par ligne</li>
              <li>Bonnes pratiques d'organisation des sections et des ressources média</li>
              <li>Mini-exercice guidé : transformer une page HTML4 en structure HTML5 moderne</li>
            </ul>
            <p>La leçon se conclut par un atelier où vous bâtissez un document complet en intégrant formulaires, tableaux accessibles et éléments interactifs natifs.</p>
          `
        },
        {
          title: 'CSS3 et Responsive Design',
          description: 'Styles modernes et design adaptatif',
          duration_minutes: 90,
          order_index: 2,
          content: `
            <p>Nous décortiquons les fondations du cascadeur CSS, en mettant l'accent sur la spécificité, l'héritage et l'ordre des déclarations. À travers une série d'exemples détaillés, vous apprendrez à structurer vos feuilles de style en modules réutilisables et à tirer parti des variables CSS personnalisées.</p>
            <p>La seconde partie se concentre sur le responsive design : points de rupture, grilles fluides, unités relatives et systèmes typographiques adaptatifs. Nous construisons ensemble une page qui passe progressivement d'une colonne à un layout complexe en plusieurs panneaux.</p>
            <ul>
              <li>Création d'une grille CSS moderne avec <code>display: grid</code> et <code>flexbox</code></li>
              <li>Atelier media queries : concevoir pour mobile-first avec des exemples concrets</li>
              <li>Étude de cas : refactorisation d'une page figée vers une interface totalement responsive</li>
            </ul>
            <p>Chaque section contient des captures de code détaillées et des check-lists pour tester votre design sur différents appareils.</p>
          `
        },
        {
          title: 'JavaScript ES6+',
          description: 'Variables, fonctions, objets et classes',
          duration_minutes: 90,
          order_index: 3,
          content: `
            <p>Nous passons en revue les nouveautés majeures introduites à partir d'ES6 : let/const, templates, destructuration, opérateurs rest/spread et modules. Les exemples sont contextualisés dans des scénarios réalistes (gestion d'état, manipulation de collections, composition de fonctions).</p>
            <p>Une large section est dédiée aux classes, à l'héritage prototypal et à la façon de concevoir des API JavaScript maintenables. Vous découvrirez comment structurer vos fichiers en modules import/export et comment utiliser les fonctionnalités de bundlers modernes.</p>
            <ul>
              <li>Mini-lab : transformer une librairie héritée en syntaxe ES6+</li>
              <li>Tableaux comparatifs var/let/const avec cas limites expliqués</li>
              <li>Recettes pour créer des utilitaires réutilisables avec des fonctions fléchées</li>
            </ul>
            <p>La leçon se termine par des exercices guidés où vous implémentez un gestionnaire de formulaires et un module de notifications entièrement modulaires.</p>
          `
        },
        {
          title: 'DOM et Manipulation',
          description: 'Interagir avec le DOM',
          duration_minutes: 75,
          order_index: 4,
          content: `
            <p>Nous explorons en profondeur l'API DOM moderne : sélection, création, clonage et insertion d'éléments, ainsi que la gestion des attributs et des datasets. Les exemples couvrent également l'API MutationObserver pour réagir aux changements structuraux.</p>
            <p>Une partie importante est consacrée à la délégation d'événements, à la prévention des fuites mémoire et à la configuration des interactions clavier/souris accessibles. Nous mettons en place une liste dynamique, un carrousel et un module d'onglets pour illustrer les patterns.</p>
            <ul>
              <li>Comparaison détaillée entre <code>innerHTML</code>, <code>textContent</code> et les méthodes de template</li>
              <li>Gestion fine des transitions CSS déclenchées en JavaScript</li>
              <li>Exercice : création d'un gestionnaire de formulaires réactif avec validation en direct</li>
            </ul>
            <p>Vous repartirez avec un toolkit complet de snippets que vous pourrez réutiliser dans votre projet final.</p>
          `
        },
        {
          title: 'Asynchrone et Promises',
          description: 'Async/await et gestion asynchrone',
          duration_minutes: 90,
          order_index: 5,
          content: `
            <p>Nous mettons en place une progression claire depuis les callbacks jusqu'aux promises et à <code>async/await</code>. Chaque concept est accompagné d'exemples détaillant la gestion des erreurs, des annulations et des timeouts.</p>
            <p>La leçon introduit également les Web APIs modernes (Fetch, AbortController, Streams) et montre comment architecturer une couche d'accès réseau résiliente. Nous analysons les patterns de concurrence (Promise.all, allSettled, race) et les stratégies de retry.</p>
            <ul>
              <li>Étude d'un module de service qui centralise toutes les requêtes HTTP</li>
              <li>Mise en place d'un indicateur de chargement global et d'une journalisation centralisée</li>
              <li>Atelier pratique : création d'un mini-dashboard alimenté par plusieurs APIs publiques</li>
            </ul>
            <p>Les annexes incluent un guide de debugging des opérations asynchrones dans Chrome DevTools.</p>
          `
        },
        {
          title: 'Projet pratique : Site web',
          description: 'Création d\'un site web complet',
          duration_minutes: 90,
          order_index: 6,
          content: `
            <p>Ce projet récapitulatif vous fait passer du cahier des charges à un site complet comprenant plusieurs pages, un design responsive et des interactions dynamiques. Nous détaillons chaque étape : wireframes, maquettes, découpage, intégration puis optimisation.</p>
            <p>Vous apprendrez à structurer votre code, à créer une arborescence de composants réutilisables et à configurer un outil de build léger (Vite ou Parcel). L'accent est mis sur la documentation et la livraison d'un livrable professionnel.</p>
            <ul>
              <li>Checklist de qualité couvrant accessibilité, performance et SEO</li>
              <li>Intégration d'un formulaire avec validation côté client et message de confirmation animé</li>
              <li>Guide pour publier le site sur un hébergement gratuit puis sur un domaine personnalisé</li>
            </ul>
            <p>En bonus, vous ajoutez une section blog générée dynamiquement à partir d'un fichier JSON local afin de manipuler la logique JavaScript dans un contexte réaliste.</p>
          `
        }
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
        {
          title: 'Introduction à Node.js',
          description: 'Environnement Node.js et npm',
          duration_minutes: 90,
          order_index: 1,
          content: `
            <p>Nous commençons par décortiquer l'architecture de Node.js : boucle d'événements, thread pool, moteur V8 et système de modules. Vous comprendrez comment Node gère l'I/O non bloquante et pourquoi il excelle dans les applications réseau.</p>
            <p>Nous installons ensuite un environnement de travail professionnel : nvm, npm, scripts, variables d'environnement et outils de debugging. Vous apprendrez à structurer un projet dès les premières lignes pour faciliter la montée en charge.</p>
            <ul>
              <li>Analyse d'un package.json complet avec scripts de build, lint et test</li>
              <li>Création d'un CLI minimaliste qui interagit avec le système de fichiers</li>
              <li>Guide de résolution des erreurs Node courantes (ports occupés, modules manquants, etc.)</li>
            </ul>
            <p>La leçon inclut des sections "pour aller plus loin" présentant TypeScript, pnpm et les modules ES dans Node.</p>
          `
        },
        {
          title: 'Express.js et Routes',
          description: 'Framework Express et gestion des routes',
          duration_minutes: 120,
          order_index: 2,
          content: `
            <p>Nous construisons une API Express étape par étape : définition des routes, paramétrage des middlewares, gestion des réponses JSON et organisation des contrôleurs. Chaque exemple inclut des tests de requêtes avec curl et Postman.</p>
            <p>La leçon couvre aussi la configuration avancée : routers modulaires, modèles d'organisation (feature-based vs layered), templating, gestion des fichiers statiques et intégration avec des moteurs de vue.</p>
            <ul>
              <li>Atelier : création d'un routeur REST complet pour la gestion des utilisateurs</li>
              <li>Tableau de comparaison entre Express, Fastify et NestJS pour comprendre les choix techniques</li>
              <li>Configuration d'un middleware de journalisation et d'un système de CORS robuste</li>
            </ul>
            <p>En bonus, nous ajoutons un pipeline de tests automatisés avec Jest/Supertest pour sécuriser vos routes.</p>
          `
        },
        {
          title: 'Middleware et Authentification',
          description: 'Création de middleware et JWT',
          duration_minutes: 120,
          order_index: 3,
          content: `
            <p>Cette leçon explique la chaîne des middlewares Express et comment injecter des traitements transversaux (logs, métriques, compression, sécurité). Nous construisons plusieurs middlewares personnalisés avec gestion d'erreurs centralisée.</p>
            <p>La deuxième partie plonge dans l'authentification : JWT, cookies, rafraîchissement de tokens, rôles et permissions. Nous détaillons la sécurisation des routes, la rotation de clés et la gestion des sessions côté client.</p>
            <ul>
              <li>Implémentation complète d'un middleware d'autorisation par rôle</li>
              <li>Schémas sequence diagram pour comprendre le cycle login / logout / refresh</li>
              <li>Recettes pour protéger contre les attaques courantes (CSRF, XSS, timing attack)</li>
            </ul>
            <p>Vous repartirez avec un module d'auth prêt à l'emploi, documenté et testé.</p>
          `
        },
        {
          title: 'API RESTful',
          description: 'Conception et implémentation d\'APIs REST',
          duration_minutes: 120,
          order_index: 4,
          content: `
            <p>Nous étudions le design d'API REST : conventions d'URL, codes HTTP, filtrage, pagination, tri et hypermédias. Chaque règle est démontrée dans une API de gestion de catalogue comprenant des relations complexes.</p>
            <p>Nous abordons également la documentation (OpenAPI/Swagger), l'automatisation des tests contractuels et la versioning strategy. Une section dédiée montre comment monitorer les performances et détecter les endpoints lents.</p>
            <ul>
              <li>Atelier : conception d'un schéma OpenAPI 3 complet puis génération automatique du client</li>
              <li>Mise en place d'une couche de validation via Joi/Zod avec messages d'erreur contextualisés</li>
              <li>Exemples de réponses normalisées incluant métadonnées, liens et messages d'aide</li>
            </ul>
            <p>Nous terminons par un déploiement simulé sur une plateforme cloud avec configuration d'un reverse-proxy.</p>
          `
        },
        {
          title: 'Gestion des erreurs et validation',
          description: 'Gestion robuste des erreurs',
          duration_minutes: 90,
          order_index: 5,
          content: `
            <p>Nous construisons une stratégie globale de gestion d'erreurs : classification (client, serveur, dépendance), structure de réponse unifiée et journaux contextualisés. Les exemples montrent comment chaîner les erreurs pour faciliter le debugging.</p>
            <p>Vous apprendrez à valider les entrées/sorties à plusieurs niveaux (requêtes HTTP, schémas de base de données, réponses). Nous mettons en place des tests d'intégration pour garantir la cohérence de bout en bout.</p>
            <ul>
              <li>Création d'un middleware d'erreur Express avec suivi des corrélations</li>
              <li>Intégration d'un service de traçage (OpenTelemetry) afin de relier logs et spans</li>
              <li>Checklist de validation couvrant les données sensibles, les fichiers uploadés et les webhooks</li>
            </ul>
            <p>Une section finale montre comment préparer l'application pour la production avec alertes proactives et dashboards.</p>
          `
        }
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
        {
          title: 'Introduction aux bases de données',
          description: 'Concepts SQL et NoSQL',
          duration_minutes: 75,
          order_index: 1,
          content: `
            <p>Nous revisitons les fondations de la persistance des données : modèles relationnels, clé primaire, intégrité référentielle, normalisation ainsi que l'émergence des modèles NoSQL (document, colonne, graphe, clé-valeur).</p>
            <p>Chaque concept est accompagné de diagrammes UML, de scripts SQL/Mongo et d'analogies concrètes pour choisir la bonne technologie selon les besoins métier.</p>
            <ul>
              <li>Tableau comparatif détaillé des moteurs populaires (MySQL, PostgreSQL, MongoDB, Redis)</li>
              <li>Étude de cas : cahier des charges d'une application et justification du choix de la base</li>
              <li>Atelier : modéliser un schéma mixte hybride relationnel + document pour un produit e-commerce</li>
            </ul>
            <p>Nous couvrons également les bonnes pratiques de versioning de schéma et d'automatisation des migrations.</p>
          `
        },
        {
          title: 'MySQL : Requêtes et jointures',
          description: 'Requêtes SQL complexes',
          duration_minutes: 90,
          order_index: 2,
          content: `
            <p>Nous approfondissons SQL via des requêtes avancées : jointures multiples, sous-requêtes corrélées, CTE, fonctions de fenêtre et vues matérialisées. Chaque requête est expliquée ligne par ligne avec plan d'exécution.</p>
            <p>Nous travaillons sur un dataset complet (utilisateurs, commandes, paiements) pour démontrer les patterns d'analytics temps réel et de rapports consolidés.</p>
            <ul>
              <li>Guide d'optimisation des requêtes avec EXPLAIN et indices composites</li>
              <li>Exercices : transformer des règles métier en requêtes SQL lisibles et performantes</li>
              <li>Recette : créer un pipeline de rapports quotidiens directement dans MySQL</li>
            </ul>
            <p>La leçon inclut un module sur la gestion des transactions, des verrous et de l'isolation.</p>
          `
        },
        {
          title: 'ORM avec Sequelize',
          description: 'Utilisation de Sequelize pour MySQL',
          duration_minutes: 90,
          order_index: 3,
          content: `
            <p>Nous introduisons Sequelize, ses modèles, migrations et seeders. Vous apprendrez à définir des relations complexes, des hooks et des validateurs personnalisés.</p>
            <p>Nous configurons ensuite un service Node complet qui expose des repository patterns, gère les transactions et intègre des tests unitaires avec une base en mémoire.</p>
            <ul>
              <li>Création d'un modèle polymorphe avec scopes dynamiques et pagination prête à l'emploi</li>
              <li>Exemple de migration évolutive avec rollback sécurisé</li>
              <li>Conseils pour maintenir la cohérence entre schéma code et schéma réel</li>
            </ul>
            <p>Nous montrons aussi comment mélanger ORM et requêtes brutes pour les cas critiques.</p>
          `
        },
        {
          title: 'MongoDB et Mongoose',
          description: 'Bases de données NoSQL',
          duration_minutes: 90,
          order_index: 4,
          content: `
            <p>Nous détaillons l'écosystème MongoDB : documents BSON, collections, indexes, pipeline d'agrégation et transactions multi-documents. Chaque section comprend des exemples concrets issus d'applications réelles.</p>
            <p>Avec Mongoose, nous créons des schémas stricts, des middlewares, des virtuals et des query helpers. Nous abordons aussi la validation, les discriminators et la gestion des relations référencées.</p>
            <ul>
              <li>Exemple complet d'agrégation (match, unwind, group, project) pour construire un dashboard</li>
              <li>Pattern bucket + TTL pour stocker des logs analytiques</li>
              <li>Comparaison des stratégies d'indexation et d'architecture shardée</li>
            </ul>
            <p>Nous terminons par un atelier où vous migrez une fonctionnalité SQL vers MongoDB en détaillant les concessions.</p>
          `
        },
        {
          title: 'Optimisation et indexation',
          description: 'Performance des bases de données',
          duration_minutes: 75,
          order_index: 5,
          content: `
            <p>Cette leçon se concentre sur les performances : typologie des index, couverture, statistiques, partitionnement et caching applicatif. Nous démontrons l'impact des choix d'index sur des requêtes concrètes via des benchmarks.</p>
            <p>Nous analysons également la surveillance (slow query log, Performance Schema, Profiler Mongo) et construisons un plan de maintenance régulier.</p>
            <ul>
              <li>Atelier : identifier et corriger trois requêtes problématiques d'une application existante</li>
              <li>Stratégies de cache côté application (Redis) et invalidation maîtrisée</li>
              <li>Checklist de préparation avant passage en production</li>
            </ul>
            <p>En conclusion, nous présentons des outils open-source pour automatiser les audits de performance.</p>
          `
        }
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
        {
          title: 'Introduction à React',
          description: 'Composants et JSX',
          duration_minutes: 90,
          order_index: 1,
          content: `
            <p>Nous démarrons par la philosophie React : UI déclarative, état minimal, synchronisation unidirectionnelle des données. Vous comprendrez comment JSX est transformé en appels <code>React.createElement</code> et comment React orchestre le rendu.</p>
            <p>Nous construisons plusieurs composants (stateless, stateful, composés) en montrant la différence entre composition et héritage, et en introduisant les PropTypes/TypeScript pour formaliser les contrats.</p>
            <ul>
              <li>Construction d'un design system miniature avec boutons, alertes et cartes</li>
              <li>Patrons pour partager du code entre composants via composition</li>
              <li>Checklist d'accessibilité à appliquer sur chaque composant</li>
            </ul>
            <p>La leçon inclut des extraits de code commentés et des explications sur le Virtual DOM.</p>
          `
        },
        {
          title: 'State et Props',
          description: 'Gestion de l\'état dans React',
          duration_minutes: 120,
          order_index: 2,
          content: `
            <p>Nous explorons les différents types d'état : local, dérivé, mémorisé et contrôlé. Chaque scénario est illustré par des cas d'usage (formulaires, modales, listes dynamiques) et des anti-patterns à éviter.</p>
            <p>Nous comparons aussi les stratégies de levée d'état, de contextes et d'optimisations (memo, useMemo, useCallback). L'objectif est de vous donner une grille de lecture pour choisir la bonne approche.</p>
            <ul>
              <li>Atelier : refactoriser un formulaire complexe pour éliminer les re-renders inutiles</li>
              <li>Exemple complet de composant contrôlé vs non contrôlé</li>
              <li>Tableaux décisionnels pour choisir entre props drilling, context ou store global</li>
            </ul>
            <p>Nous concluons par l'intégration d'un système de notifications global basé sur un reducer.</p>
          `
        },
        {
          title: 'Hooks React',
          description: 'useState, useEffect et hooks personnalisés',
          duration_minutes: 120,
          order_index: 3,
          content: `
            <p>Nous détaillons les hooks essentiels (useState, useEffect, useMemo, useReducer, useRef) via des démonstrations progressives. L'accent est mis sur la compréhension des dépendances et des cycles de vie.</p>
            <p>Vous apprendrez à écrire vos propres hooks pour encapsuler des comportements complexes (fetch, timers, synchronisation avec localStorage). Nous couvrons également les pièges fréquents (boucles infinies, state stale).</p>
            <ul>
              <li>Construction d'un hook useFetch complet avec annulation et mise en cache</li>
              <li>Exemples d'utilisation de useReducer pour gérer des formulaires dynamiques</li>
              <li>Guide pour tester les hooks avec React Testing Library</li>
            </ul>
            <p>Chaque section inclut des diagrammes décrivant le déroulement des effets et la manière de les nettoyer.</p>
          `
        },
        {
          title: 'Routing avec React Router',
          description: 'Navigation dans une app React',
          duration_minutes: 90,
          order_index: 4,
          content: `
            <p>Nous mettons en place une navigation avancée : routes imbriquées, paramètres dynamiques, loaders, actions et gestion des erreurs. Vous apprendrez à structurer un router pour différentes zones de l'application.</p>
            <p>Nous voyons aussi comment protéger des routes, gérer les redirections après authentification et synchroniser les requêtes réseau avec les transitions de pages.</p>
            <ul>
              <li>Création d'un layout principal avec sidebar, header et zones enfants</li>
              <li>Implémentation d'un breadcrumb dynamique basé sur la configuration du router</li>
              <li>Hooks personnalisés pour manipuler l'historique et la recherche</li>
            </ul>
            <p>Une section bonus montre comment combiner React Router avec React Query pour charger les données intelligemment.</p>
          `
        },
        {
          title: 'State Management avec Redux',
          description: 'Gestion globale de l\'état',
          duration_minutes: 120,
          order_index: 5,
          content: `
            <p>Nous replaçons Redux dans le paysage des solutions de state management, puis nous construisons un store complet avec Redux Toolkit : slices, reducers, actions, middleware et sélecteurs mémorisés.</p>
            <p>Nous abordons aussi RTK Query pour gérer les requêtes réseau et le cache global. Les exemples montrent comment orchestrer des flux temps réel, des notifications et des entités normalisées.</p>
            <ul>
              <li>Pattern feature-based : organisation du dossier Redux par domaine</li>
              <li>Gestion des erreurs globales et synchronisation avec la couche UI</li>
              <li>Tests unitaires de reducers et de selectors avec scénarios réalistes</li>
            </ul>
            <p>La leçon se termine par l'interconnexion Redux & React Router pour gérer les transitions complexes.</p>
          `
        },
        {
          title: 'Projet : Application React complète',
          description: 'Création d\'une application complète',
          duration_minutes: 120,
          order_index: 6,
          content: `
            <p>Vous développez une application de gestion de cours incluant authentification, dashboard, formulaires dynamiques, synchronisation API et mode hors-ligne. Chaque étape est détaillée avec un plan de développement et des livrables.</p>
            <p>Nous configurons également les tests end-to-end (Playwright/Cypress), l'analyse de performance (Lighthouse) et la préparation à la production (chunk splitting, lazy loading, monitoring).</p>
            <ul>
              <li>Roadmap par sprint pour organiser le travail en équipe</li>
              <li>Intégration d'un thème personnalisable et d'un système d'internationalisation</li>
              <li>Guide de déploiement sur Vercel avec variables d'environnement sécurisées</li>
            </ul>
            <p>Vous terminez la leçon avec un dépôt Git complet, prêt à être présenté à un recruteur ou à un client.</p>
          `
        }
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
        {
          title: 'Git et GitHub',
          description: 'Versioning et collaboration',
          duration_minutes: 60,
          order_index: 1,
          content: `
            <p>Nous dépassons les commandes basiques pour explorer des workflows professionnels : GitFlow, trunk-based, release branches. Chaque stratégie est illustrée par des diagrammes et des scénarios collaboratifs.</p>
            <p>Nous analysons aussi les outils GitHub (issues, projects, templates, protections de branch) afin de transformer un dépôt en espace de travail organisé.</p>
            <ul>
              <li>Atelier : résolution d'un conflit complexe avec rebase interactif</li>
              <li>Configuration des hooks pré-commit et des contrôles automatiques</li>
              <li>Guide pour sécuriser les secrets et auditer l'historique</li>
            </ul>
            <p>La leçon inclut un plan de communication pour les revues de code efficaces.</p>
          `
        },
        {
          title: 'CI/CD avec GitHub Actions',
          description: 'Automatisation du déploiement',
          duration_minutes: 60,
          order_index: 2,
          content: `
            <p>Nous construisons plusieurs pipelines CI/CD : lint + tests, build frontend, déploiement backend. Chaque workflow YAML est expliqué étape par étape avec les bonnes pratiques de cache, de matrice et de secrets.</p>
            <p>Nous abordons également les stratégies de déploiement progressif (staging, production, preview) et la mise en place de notifications Slack/Teams.</p>
            <ul>
              <li>Création d'actions réutilisables pour centraliser la logique de build</li>
              <li>Mise en place d'un job conditionnel déclenché seulement sur les tags</li>
              <li>Surveillance des pipelines avec des dashboards et alertes personnalisées</li>
            </ul>
            <p>En bonus, nous couplons GitHub Actions avec des conteneurs Docker pour garantir des builds reproductibles.</p>
          `
        },
        {
          title: 'Déploiement sur Vercel/Netlify',
          description: 'Hébergement frontend',
          duration_minutes: 45,
          order_index: 3,
          content: `
            <p>Nous comparons les plateformes serverless populaires et réalisons plusieurs déploiements en direct. Vous apprendrez à configurer les environnements, les redirections, les previews et les optimisations d'image.</p>
            <p>Nous intégrons également un backend Node via serverless functions, montrant comment partager du code entre le frontend et l'API.</p>
            <ul>
              <li>Checklist de préparation avant push (variables, analytics, monitoring)</li>
              <li>Configuration des protections (headers de sécurité, rate limiting)</li>
              <li>Automatisation des tests Lighthouse dans la pipeline de déploiement</li>
            </ul>
            <p>La leçon se conclut par un plan de rollback rapide en cas d'incident.</p>
          `
        },
        {
          title: 'Docker et conteneurisation',
          description: 'Conteneurs et orchestration',
          duration_minutes: 75,
          order_index: 4,
          content: `
            <p>Nous expliquons le modèle des conteneurs, la construction d'images optimisées et la gestion des multi-stage builds. Nous créons ensuite un docker-compose pour orchestrer frontend, backend et base de données.</p>
            <p>Nous couvrons également les notions d'orchestration (Kubernetes, ECS) et fournissons un guide pour migrer progressivement vers ces plateformes.</p>
            <ul>
              <li>Création d'une image Node ultra-légère avec distroless</li>
              <li>Configuration d'un registre privé et automatisation du push depuis GitHub Actions</li>
              <li>Surveillance des conteneurs avec des probes et des métriques personnalisées</li>
            </ul>
            <p>La leçon inclut un plan de durcissement sécurité (scans d'images, signatures, politiques réseau).</p>
          `
        }
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

