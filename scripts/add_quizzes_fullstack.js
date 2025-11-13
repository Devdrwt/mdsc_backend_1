const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mdsc_auth',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Quiz pour chaque module avec questions pertinentes
const quizzes = [
  {
    moduleId: 148, // Module 1 : Introduction au Développement Web
    title: 'Quiz : Introduction au Développement Web',
    description: 'Testez vos connaissances sur les bases du développement web',
    passing_score: 70,
    time_limit_minutes: 15,
    max_attempts: 3,
    questions: [
      {
        question_text: 'Qu\'est-ce que le HTML ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Un langage de programmation', is_correct: false },
          { answer_text: 'Un langage de balisage pour structurer le contenu web', is_correct: true },
          { answer_text: 'Un langage de style', is_correct: false },
          { answer_text: 'Un framework JavaScript', is_correct: false }
        ]
      },
      {
        question_text: 'Le CSS est utilisé pour styliser les pages web',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      },
      {
        question_text: 'Quel est le rôle principal d\'un navigateur web ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Créer des sites web', is_correct: false },
          { answer_text: 'Interpréter et afficher le HTML/CSS/JavaScript', is_correct: true },
          { answer_text: 'Héberger des sites web', is_correct: false },
          { answer_text: 'Compiler du code', is_correct: false }
        ]
      },
      {
        question_text: 'Qu\'est-ce qu\'un élément HTML ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Une balise ouvrante, du contenu et une balise fermante', is_correct: true },
          { answer_text: 'Un attribut CSS', is_correct: false },
          { answer_text: 'Une fonction JavaScript', is_correct: false },
          { answer_text: 'Une variable', is_correct: false }
        ]
      },
      {
        question_text: 'HTTP signifie HyperText Transfer Protocol',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      }
    ]
  },
  {
    moduleId: 149, // Module 2 : HTML5 et CSS3 Avancés
    title: 'Quiz : HTML5 et CSS3 Avancés',
    description: 'Évaluez votre maîtrise des fonctionnalités avancées de HTML5 et CSS3',
    passing_score: 70,
    time_limit_minutes: 20,
    max_attempts: 3,
    questions: [
      {
        question_text: 'Quelle balise HTML5 est utilisée pour le contenu principal d\'une page ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: '<div>', is_correct: false },
          { answer_text: '<main>', is_correct: true },
          { answer_text: '<section>', is_correct: false },
          { answer_text: '<article>', is_correct: false }
        ]
      },
      {
        question_text: 'Flexbox permet de créer des layouts flexibles',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      },
      {
        question_text: 'Qu\'est-ce que CSS Grid ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Un système de grille bidimensionnel pour créer des layouts', is_correct: true },
          { answer_text: 'Un framework CSS', is_correct: false },
          { answer_text: 'Une bibliothèque JavaScript', is_correct: false },
          { answer_text: 'Un préprocesseur CSS', is_correct: false }
        ]
      },
      {
        question_text: 'Les media queries permettent de créer des designs responsives',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      },
      {
        question_text: 'Quelle propriété CSS est utilisée pour créer des animations ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: '@keyframes', is_correct: true },
          { answer_text: '@media', is_correct: false },
          { answer_text: '@import', is_correct: false },
          { answer_text: '@font-face', is_correct: false }
        ]
      }
    ]
  },
  {
    moduleId: 150, // Module 3 : JavaScript Moderne
    title: 'Quiz : JavaScript Moderne',
    description: 'Testez vos connaissances sur JavaScript ES6+ et les concepts modernes',
    passing_score: 70,
    time_limit_minutes: 25,
    max_attempts: 3,
    questions: [
      {
        question_text: 'Qu\'est-ce qu\'une arrow function en JavaScript ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Une fonction avec une syntaxe raccourcie et un this lexical', is_correct: true },
          { answer_text: 'Une fonction asynchrone', is_correct: false },
          { answer_text: 'Une fonction génératrice', is_correct: false },
          { answer_text: 'Une fonction récursive', is_correct: false }
        ]
      },
      {
        question_text: 'const et let sont des déclarations de variables avec portée de bloc',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      },
      {
        question_text: 'Qu\'est-ce que la déstructuration (destructuring) ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Extraire des valeurs d\'objets ou tableaux dans des variables distinctes', is_correct: true },
          { answer_text: 'Supprimer des propriétés d\'un objet', is_correct: false },
          { answer_text: 'Copier un objet', is_correct: false },
          { answer_text: 'Fusionner des objets', is_correct: false }
        ]
      },
      {
        question_text: 'Qu\'est-ce qu\'une Promise en JavaScript ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Un objet représentant une opération asynchrone', is_correct: true },
          { answer_text: 'Une fonction synchrone', is_correct: false },
          { answer_text: 'Un type de données', is_correct: false },
          { answer_text: 'Une méthode de tableau', is_correct: false }
        ]
      },
      {
        question_text: 'async/await est une syntaxe pour gérer les opérations asynchrones',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      }
    ]
  },
  {
    moduleId: 151, // Module 4 : React et le Développement Frontend
    title: 'Quiz : React et le Développement Frontend',
    description: 'Évaluez votre compréhension de React et des concepts frontend modernes',
    passing_score: 70,
    time_limit_minutes: 30,
    max_attempts: 3,
    questions: [
      {
        question_text: 'Qu\'est-ce qu\'un composant React ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Une fonction ou classe qui retourne du JSX', is_correct: true },
          { answer_text: 'Un fichier CSS', is_correct: false },
          { answer_text: 'Une base de données', is_correct: false },
          { answer_text: 'Un serveur web', is_correct: false }
        ]
      },
      {
        question_text: 'Les hooks React permettent d\'utiliser l\'état dans les composants fonctionnels',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      },
      {
        question_text: 'Qu\'est-ce que le Virtual DOM ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Une représentation JavaScript du DOM pour optimiser les mises à jour', is_correct: true },
          { answer_text: 'Un framework CSS', is_correct: false },
          { answer_text: 'Une bibliothèque de routing', is_correct: false },
          { answer_text: 'Un outil de build', is_correct: false }
        ]
      },
      {
        question_text: 'Quel hook React est utilisé pour gérer l\'état local ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'useState', is_correct: true },
          { answer_text: 'useEffect', is_correct: false },
          { answer_text: 'useContext', is_correct: false },
          { answer_text: 'useReducer', is_correct: false }
        ]
      },
      {
        question_text: 'React utilise un système de props pour passer des données entre composants',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      }
    ]
  },
  {
    moduleId: 152, // Module 5 : Node.js et Backend
    title: 'Quiz : Node.js et Backend',
    description: 'Testez vos connaissances sur Node.js et le développement backend',
    passing_score: 70,
    time_limit_minutes: 25,
    max_attempts: 3,
    questions: [
      {
        question_text: 'Qu\'est-ce que Node.js ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Un environnement d\'exécution JavaScript côté serveur', is_correct: true },
          { answer_text: 'Un framework frontend', is_correct: false },
          { answer_text: 'Un langage de programmation', is_correct: false },
          { answer_text: 'Une base de données', is_correct: false }
        ]
      },
      {
        question_text: 'Express.js est un framework web pour Node.js',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      },
      {
        question_text: 'Qu\'est-ce qu\'un middleware dans Express ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Une fonction qui a accès aux objets request, response et next', is_correct: true },
          { answer_text: 'Une route', is_correct: false },
          { answer_text: 'Un modèle de données', is_correct: false },
          { answer_text: 'Un template', is_correct: false }
        ]
      },
      {
        question_text: 'REST API signifie Representational State Transfer Application Programming Interface',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      },
      {
        question_text: 'Qu\'est-ce que npm ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Le gestionnaire de paquets pour Node.js', is_correct: true },
          { answer_text: 'Un framework web', is_correct: false },
          { answer_text: 'Un serveur web', is_correct: false },
          { answer_text: 'Un langage de programmation', is_correct: false }
        ]
      }
    ]
  },
  {
    moduleId: 153, // Module 6 : Base de Données et Déploiement
    title: 'Quiz : Base de Données et Déploiement',
    description: 'Évaluez vos connaissances sur les bases de données et le déploiement',
    passing_score: 70,
    time_limit_minutes: 20,
    max_attempts: 3,
    questions: [
      {
        question_text: 'Qu\'est-ce qu\'une base de données relationnelle ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Une base de données organisée en tables avec relations', is_correct: true },
          { answer_text: 'Une base de données NoSQL', is_correct: false },
          { answer_text: 'Un fichier JSON', is_correct: false },
          { answer_text: 'Un cache mémoire', is_correct: false }
        ]
      },
      {
        question_text: 'SQL signifie Structured Query Language',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      },
      {
        question_text: 'Qu\'est-ce qu\'une migration de base de données ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Un script qui modifie la structure de la base de données de manière versionnée', is_correct: true },
          { answer_text: 'Un backup de données', is_correct: false },
          { answer_text: 'Une requête SELECT', is_correct: false },
          { answer_text: 'Un index de base de données', is_correct: false }
        ]
      },
      {
        question_text: 'Qu\'est-ce que le déploiement d\'une application ?',
        question_type: 'multiple_choice',
        points: 2,
        answers: [
          { answer_text: 'Mettre l\'application en production sur un serveur accessible', is_correct: true },
          { answer_text: 'Tester l\'application localement', is_correct: false },
          { answer_text: 'Développer l\'application', is_correct: false },
          { answer_text: 'Documenter l\'application', is_correct: false }
        ]
      },
      {
        question_text: 'Docker permet de conteneuriser des applications',
        question_type: 'true_false',
        points: 1,
        correct_answer: true
      }
    ]
  }
];

async function createQuiz(quizData) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Vérifier si un quiz existe déjà
    const [existing] = await connection.execute(
      'SELECT id FROM module_quizzes WHERE module_id = ?',
      [quizData.moduleId]
    );

    if (existing.length > 0) {
      console.log(`⚠️  Quiz existe déjà pour le module ${quizData.moduleId}, passage au suivant...`);
      return;
    }

    // Créer le quiz
    const [quizResult] = await connection.execute(
      `INSERT INTO module_quizzes (
        module_id, title, description, passing_score,
        time_limit_minutes, max_attempts, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [
        quizData.moduleId,
        quizData.title,
        quizData.description,
        quizData.passing_score,
        quizData.time_limit_minutes,
        quizData.max_attempts
      ]
    );

    const quizId = quizResult.insertId;
    console.log(`✅ Quiz créé (ID: ${quizId}) pour le module ${quizData.moduleId}`);

    // Créer les questions
    for (let i = 0; i < quizData.questions.length; i++) {
      const question = quizData.questions[i];
      
      const [questionResult] = await connection.execute(
        `INSERT INTO quiz_questions (
          quiz_id, module_quiz_id, question_text, question_type, points, order_index, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [
          null, // NULL pour les quiz de modules
          quizId,
          question.question_text,
          question.question_type,
          question.points,
          i
        ]
      );

      const questionId = questionResult.insertId;

      // Créer les réponses selon le type
      if (question.question_type === 'multiple_choice' && question.answers) {
        for (let j = 0; j < question.answers.length; j++) {
          const answer = question.answers[j];
          await connection.execute(
            `INSERT INTO quiz_answers (
              question_id, answer_text, is_correct, order_index
            ) VALUES (?, ?, ?, ?)`,
            [questionId, answer.answer_text, answer.is_correct ? 1 : 0, j]
          );
        }
      } else if (question.question_type === 'true_false' && question.correct_answer !== undefined) {
        const correctAnswer = question.correct_answer === true || question.correct_answer === 'true';
        await connection.execute(
          `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
          [questionId, 'Vrai', correctAnswer ? 1 : 0, 0]
        );
        await connection.execute(
          `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
          [questionId, 'Faux', !correctAnswer ? 1 : 0, 1]
        );
      }

      console.log(`  ✅ Question ${i + 1} créée (ID: ${questionId})`);
    }

    await connection.commit();
    console.log(`✅ Quiz complet créé pour le module ${quizData.moduleId}\n`);
  } catch (error) {
    await connection.rollback();
    console.error(`❌ Erreur lors de la création du quiz pour le module ${quizData.moduleId}:`, error.message);
    throw error;
  } finally {
    connection.release();
  }
}

async function main() {
  console.log('🚀 Début de la création des quiz pour la formation Full-Stack...\n');

  for (const quiz of quizzes) {
    try {
      await createQuiz(quiz);
    } catch (error) {
      console.error(`Erreur avec le quiz du module ${quiz.moduleId}:`, error);
    }
  }

  console.log('✨ Création des quiz terminée !');
  await pool.end();
}

main().catch(console.error);

