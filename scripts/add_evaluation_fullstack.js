const { pool } = require('../src/config/database');

/**
 * Script pour ajouter une évaluation finale avec questions techniques
 * pour le cours "Formation Complète : Développement Web Full-Stack"
 */

const COURSE_ID = 47; // ID du cours "Formation Complète : Développement Web Full-Stack"
const INSTRUCTOR_ID = 75; // ID de l'instructeur

// Questions techniques pour l'évaluation finale
const evaluationQuestions = [
  {
    question_text: "Quelle est la différence principale entre let, const et var en JavaScript ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "let et const sont block-scoped, var est function-scoped",
      "var est block-scoped, let et const sont function-scoped",
      "Ils sont tous identiques",
      "let et const ne peuvent pas être réassignés"
    ],
    correct_answer: "let et const sont block-scoped, var est function-scoped"
  },
  {
    question_text: "Qu'est-ce qu'une API RESTful ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un protocole de communication",
      "Un style d'architecture pour créer des services web utilisant HTTP",
      "Un framework JavaScript",
      "Un type de base de données"
    ],
    correct_answer: "Un style d'architecture pour créer des services web utilisant HTTP"
  },
  {
    question_text: "Quel est le rôle du Virtual DOM dans React ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Améliorer les performances en minimisant les manipulations du DOM réel",
      "Créer des composants virtuels",
      "Gérer l'état des composants",
      "Compiler le code JavaScript"
    ],
    correct_answer: "Améliorer les performances en minimisant les manipulations du DOM réel"
  },
  {
    question_text: "Qu'est-ce qu'un middleware dans Express.js ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Une fonction qui a accès à l'objet request, response et next",
      "Un type de base de données",
      "Un framework frontend",
      "Un protocole de communication"
    ],
    correct_answer: "Une fonction qui a accès à l'objet request, response et next"
  },
  {
    question_text: "Quelle méthode HTTP est utilisée pour créer une nouvelle ressource ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "GET",
      "POST",
      "PUT",
      "DELETE"
    ],
    correct_answer: "POST"
  },
  {
    question_text: "Qu'est-ce que le CSS Grid Layout ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un système de mise en page bidimensionnel pour créer des grilles",
      "Un framework CSS",
      "Une méthode de sélection CSS",
      "Un préprocesseur CSS"
    ],
    correct_answer: "Un système de mise en page bidimensionnel pour créer des grilles"
  },
  {
    question_text: "Quelle est la différence entre SQL et NoSQL ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "SQL est relationnel et structuré, NoSQL est non-relationnel et flexible",
      "SQL est pour le frontend, NoSQL pour le backend",
      "Ils sont identiques",
      "SQL est plus rapide que NoSQL"
    ],
    correct_answer: "SQL est relationnel et structuré, NoSQL est non-relationnel et flexible"
  },
  {
    question_text: "Qu'est-ce qu'une Promise en JavaScript ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un objet représentant la complétion ou l'échec d'une opération asynchrone",
      "Une fonction synchrone",
      "Un type de variable",
      "Une méthode de tableau"
    ],
    correct_answer: "Un objet représentant la complétion ou l'échec d'une opération asynchrone"
  },
  {
    question_text: "Quelle est la différence entre == et === en JavaScript ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "== compare les valeurs avec conversion de type, === compare les valeurs et les types",
      "== compare les types, === compare les valeurs",
      "Ils sont identiques",
      "== est plus strict que ==="
    ],
    correct_answer: "== compare les valeurs avec conversion de type, === compare les valeurs et les types"
  },
  {
    question_text: "Qu'est-ce que le responsive design ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Une approche de design qui adapte l'affichage à différentes tailles d'écran",
      "Un framework CSS",
      "Une méthode de développement backend",
      "Un protocole de communication"
    ],
    correct_answer: "Une approche de design qui adapte l'affichage à différentes tailles d'écran"
  },
  {
    question_text: "Quel est le rôle de useEffect dans React ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Gérer les effets de bord et le cycle de vie des composants",
      "Créer des composants",
      "Gérer l'état local",
      "Styliser les composants"
    ],
    correct_answer: "Gérer les effets de bord et le cycle de vie des composants"
  },
  {
    question_text: "Qu'est-ce qu'une transaction en base de données ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Une séquence d'opérations exécutées comme une seule unité atomique",
      "Un type de requête SQL",
      "Une méthode de sauvegarde",
      "Un index de base de données"
    ],
    correct_answer: "Une séquence d'opérations exécutées comme une seule unité atomique"
  },
  {
    question_text: "Quelle est la différence entre GET et POST en HTTP ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "GET récupère des données, POST envoie des données pour traitement",
      "GET envoie des données, POST récupère des données",
      "Ils sont identiques",
      "GET est plus sécurisé que POST"
    ],
    correct_answer: "GET récupère des données, POST envoie des données pour traitement"
  },
  {
    question_text: "Qu'est-ce que le CORS (Cross-Origin Resource Sharing) ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un mécanisme permettant à un serveur de permettre l'accès à ses ressources depuis d'autres origines",
      "Un framework JavaScript",
      "Un type de base de données",
      "Un protocole de communication"
    ],
    correct_answer: "Un mécanisme permettant à un serveur de permettre l'accès à ses ressources depuis d'autres origines"
  },
  {
    question_text: "Quelle est la différence entre async/await et les Promises ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "async/await est une syntaxe plus lisible pour travailler avec les Promises",
      "async/await remplace complètement les Promises",
      "Les Promises sont plus modernes qu'async/await",
      "Ils sont identiques"
    ],
    correct_answer: "async/await est une syntaxe plus lisible pour travailler avec les Promises"
  },
  {
    question_text: "Qu'est-ce qu'un hook personnalisé (custom hook) dans React ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Une fonction JavaScript qui commence par 'use' et peut utiliser d'autres hooks",
      "Un composant React",
      "Une méthode de style",
      "Un type de state"
    ],
    correct_answer: "Une fonction JavaScript qui commence par 'use' et peut utiliser d'autres hooks"
  },
  {
    question_text: "Quelle est la différence entre localStorage et sessionStorage ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "localStorage persiste même après fermeture du navigateur, sessionStorage est effacé à la fermeture de l'onglet",
      "sessionStorage persiste après fermeture, localStorage est effacé",
      "Ils sont identiques",
      "localStorage est plus rapide"
    ],
    correct_answer: "localStorage persiste même après fermeture du navigateur, sessionStorage est effacé à la fermeture de l'onglet"
  },
  {
    question_text: "Qu'est-ce que le JWT (JSON Web Token) ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un standard pour transmettre de manière sécurisée des informations entre parties",
      "Un framework JavaScript",
      "Un type de base de données",
      "Un protocole HTTP"
    ],
    correct_answer: "Un standard pour transmettre de manière sécurisée des informations entre parties"
  },
  {
    question_text: "Quelle est la différence entre une fonction fléchée et une fonction classique en JavaScript ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Les fonctions fléchées n'ont pas leur propre 'this', elles héritent du contexte parent",
      "Les fonctions classiques n'ont pas de 'this'",
      "Ils sont identiques",
      "Les fonctions fléchées sont plus lentes"
    ],
    correct_answer: "Les fonctions fléchées n'ont pas leur propre 'this', elles héritent du contexte parent"
  },
  {
    question_text: "Qu'est-ce que le debouncing en JavaScript ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Une technique pour limiter la fréquence d'exécution d'une fonction",
      "Un type de variable",
      "Une méthode de tableau",
      "Un framework"
    ],
    correct_answer: "Une technique pour limiter la fréquence d'exécution d'une fonction"
  },
  {
    question_text: "Quelle est la différence entre SQL JOIN INNER et LEFT JOIN ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "INNER JOIN retourne seulement les lignes correspondantes, LEFT JOIN retourne toutes les lignes de la table gauche",
      "LEFT JOIN retourne seulement les correspondances, INNER JOIN retourne toutes les lignes",
      "Ils sont identiques",
      "INNER JOIN est plus rapide"
    ],
    correct_answer: "INNER JOIN retourne seulement les lignes correspondantes, LEFT JOIN retourne toutes les lignes de la table gauche"
  }
];

async function addEvaluation() {
  let connection;
  
  try {
    console.log('🚀 Début de l\'ajout de l\'évaluation finale...\n');
    
    // Vérifier que le cours existe
    const [courses] = await pool.execute(
      'SELECT id, title, instructor_id FROM courses WHERE id = ?',
      [COURSE_ID]
    );
    
    if (courses.length === 0) {
      throw new Error(`Le cours avec l'ID ${COURSE_ID} n'existe pas`);
    }
    
    const course = courses[0];
    console.log(`✅ Cours trouvé : "${course.title}" (ID: ${COURSE_ID})`);
    
    // Vérifier que l'instructeur est bien le propriétaire
    if (course.instructor_id !== INSTRUCTOR_ID) {
      console.warn(`⚠️  L'instructeur du cours est ${course.instructor_id}, pas ${INSTRUCTOR_ID}`);
    }
    
    // Vérifier si une évaluation existe déjà
    const [existing] = await pool.execute(
      'SELECT id FROM course_evaluations WHERE course_id = ?',
      [COURSE_ID]
    );
    
    if (existing.length > 0) {
      console.log(`⚠️  Une évaluation existe déjà pour ce cours (ID: ${existing[0].id})`);
      console.log('Suppression de l\'ancienne évaluation...');
      
      // Supprimer les questions existantes
      await pool.execute(
        'DELETE FROM quiz_questions WHERE course_evaluation_id = ?',
        [existing[0].id]
      );
      
      // Supprimer l'évaluation
      await pool.execute(
        'DELETE FROM course_evaluations WHERE id = ?',
        [existing[0].id]
      );
      
      console.log('✅ Ancienne évaluation supprimée\n');
    }
    
    // Créer l'évaluation finale
    console.log('📝 Création de l\'évaluation finale...');
    const [result] = await pool.execute(
      `INSERT INTO course_evaluations (
        course_id, title, description, passing_score,
        duration_minutes, max_attempts, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [
        COURSE_ID,
        'Évaluation Finale - Développement Web Full-Stack',
        'Évaluation technique complète couvrant tous les aspects du développement web full-stack : HTML/CSS, JavaScript, React, Node.js, bases de données, et bonnes pratiques. Cette évaluation teste vos connaissances théoriques et pratiques acquises tout au long de la formation.',
        70, // Score minimum pour réussir (70%)
        90, // Durée : 90 minutes
        1   // Maximum 1 tentative (une seule soumission)
      ]
    );
    
    const evaluationId = result.insertId;
    console.log(`✅ Évaluation créée avec l'ID: ${evaluationId}\n`);
    
    // Mettre à jour courses.evaluation_id si la colonne existe
    try {
      await pool.execute(
        'UPDATE courses SET evaluation_id = ? WHERE id = ?',
        [evaluationId, COURSE_ID]
      );
      console.log('✅ Colonne evaluation_id mise à jour dans courses\n');
    } catch (error) {
      console.warn('⚠️  Colonne evaluation_id non trouvée dans courses (non bloquant)\n');
    }
    
    // Créer les questions
    console.log(`📋 Création de ${evaluationQuestions.length} questions...`);
    const { sanitizeValue } = require('../src/utils/sanitize');
    
    for (let i = 0; i < evaluationQuestions.length; i++) {
      const question = evaluationQuestions[i];
      
      const [questionResult] = await pool.execute(
        `INSERT INTO quiz_questions (
          quiz_id, course_evaluation_id, question_text, question_type, points, order_index, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [
          null, // NULL pour les évaluations finales
          evaluationId,
          sanitizeValue(question.question_text),
          sanitizeValue(question.question_type),
          sanitizeValue(question.points),
          i
        ]
      );
      
      const questionId = questionResult.insertId;
      
      // Créer les réponses pour les questions à choix multiples
      if (question.question_type === 'multiple_choice' && question.options && Array.isArray(question.options)) {
        for (let j = 0; j < question.options.length; j++) {
          const option = question.options[j];
          const isCorrect = question.correct_answer === option || 
                           (typeof question.correct_answer === 'string' && question.correct_answer.trim() === option.trim());
          
          await pool.execute(
            `INSERT INTO quiz_answers (question_id, answer_text, is_correct, order_index) VALUES (?, ?, ?, ?)`,
            [questionId, sanitizeValue(option), isCorrect, j]
          );
        }
      }
      
      if ((i + 1) % 5 === 0) {
        console.log(`  ✓ ${i + 1}/${evaluationQuestions.length} questions créées...`);
      }
    }
    
    console.log(`✅ Toutes les ${evaluationQuestions.length} questions ont été créées avec succès !\n`);
    
    // Calculer le score total
    const totalPoints = evaluationQuestions.reduce((sum, q) => sum + q.points, 0);
    const passingPoints = Math.ceil((totalPoints * 70) / 100);
    
    console.log('📊 Résumé de l\'évaluation :');
    console.log(`   - Titre : Évaluation Finale - Développement Web Full-Stack`);
    console.log(`   - Nombre de questions : ${evaluationQuestions.length}`);
    console.log(`   - Points totaux : ${totalPoints}`);
    console.log(`   - Score minimum pour réussir : ${passingPoints} points (70%)`);
    console.log(`   - Durée : 90 minutes`);
    console.log(`   - Tentatives maximum : 3\n`);
    
    console.log('✅ Évaluation finale créée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'évaluation:', error);
    throw error;
  }
}

// Exécuter le script
if (require.main === module) {
  addEvaluation()
    .then(() => {
      console.log('\n🎉 Script terminé avec succès !');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { addEvaluation };

