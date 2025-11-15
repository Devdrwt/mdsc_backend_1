const { pool } = require('../src/config/database');

/**
 * Script pour ajouter une évaluation finale avec questions techniques
 * pour le cours "Marketing Google Afs"
 */

const COURSE_ID = 46; // ID du cours "Marketing Google Afs"
const INSTRUCTOR_ID = 75; // ID de l'instructeur

// Questions techniques pour l'évaluation finale sur Google Ads
const evaluationQuestions = [
  {
    question_text: "Qu'est-ce que Google Ads (anciennement Google AdWords) ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un moteur de recherche",
      "Une plateforme publicitaire en ligne permettant de créer et gérer des annonces",
      "Un réseau social",
      "Un outil d'analyse de données"
    ],
    correct_answer: "Une plateforme publicitaire en ligne permettant de créer et gérer des annonces"
  },
  {
    question_text: "Qu'est-ce qu'un mot-clé dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un mot utilisé pour décrire votre annonce",
      "Un terme ou une phrase que les utilisateurs recherchent et qui déclenche votre annonce",
      "Un titre d'annonce",
      "Une description de produit"
    ],
    correct_answer: "Un terme ou une phrase que les utilisateurs recherchent et qui déclenche votre annonce"
  },
  {
    question_text: "Qu'est-ce que le Quality Score dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Le nombre de clics sur votre annonce",
      "Une métrique qui évalue la pertinence de vos annonces, mots-clés et pages de destination",
      "Le montant dépensé par jour",
      "Le nombre d'impressions"
    ],
    correct_answer: "Une métrique qui évalue la pertinence de vos annonces, mots-clés et pages de destination"
  },
  {
    question_text: "Quelle est la différence entre une campagne de recherche et une campagne Display ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Les campagnes de recherche apparaissent sur les résultats de recherche, les campagnes Display sur les sites web partenaires",
      "Il n'y a pas de différence",
      "Les campagnes Display sont plus chères",
      "Les campagnes de recherche sont gratuites"
    ],
    correct_answer: "Les campagnes de recherche apparaissent sur les résultats de recherche, les campagnes Display sur les sites web partenaires"
  },
  {
    question_text: "Qu'est-ce que le CPC (Coût par Clic) ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Le coût total de la campagne",
      "Le montant que vous payez chaque fois qu'un utilisateur clique sur votre annonce",
      "Le nombre de clics reçus",
      "Le taux de conversion"
    ],
    correct_answer: "Le montant que vous payez chaque fois qu'un utilisateur clique sur votre annonce"
  },
  {
    question_text: "Qu'est-ce qu'une enchère dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Le processus de détermination de qui voit votre annonce et combien vous payez par clic",
      "Un type de campagne",
      "Un mot-clé",
      "Une annonce"
    ],
    correct_answer: "Le processus de détermination de qui voit votre annonce et combien vous payez par clic"
  },
  {
    question_text: "Qu'est-ce que le CTR (Taux de Clic) ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Le nombre total de clics",
      "Le pourcentage de personnes qui cliquent sur votre annonce après l'avoir vue",
      "Le coût par clic",
      "Le nombre d'impressions"
    ],
    correct_answer: "Le pourcentage de personnes qui cliquent sur votre annonce après l'avoir vue"
  },
  {
    question_text: "Qu'est-ce qu'une extension d'annonce ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un type de mot-clé",
      "Des informations supplémentaires que vous pouvez ajouter à votre annonce (numéro de téléphone, liens, etc.)",
      "Un budget supplémentaire",
      "Une campagne supplémentaire"
    ],
    correct_answer: "Des informations supplémentaires que vous pouvez ajouter à votre annonce (numéro de téléphone, liens, etc.)"
  },
  {
    question_text: "Qu'est-ce que le remarketing dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Créer de nouvelles annonces",
      "Cibler les personnes qui ont déjà visité votre site web avec des annonces personnalisées",
      "Supprimer des campagnes",
      "Changer les mots-clés"
    ],
    correct_answer: "Cibler les personnes qui ont déjà visité votre site web avec des annonces personnalisées"
  },
  {
    question_text: "Qu'est-ce qu'une audience dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un groupe de personnes que vous ciblez avec vos annonces",
      "Un type de campagne",
      "Un mot-clé",
      "Une annonce"
    ],
    correct_answer: "Un groupe de personnes que vous ciblez avec vos annonces"
  },
  {
    question_text: "Qu'est-ce que le budget quotidien dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Le montant total dépensé sur la campagne",
      "Le montant moyen que vous êtes prêt à dépenser par jour pour une campagne",
      "Le coût par clic",
      "Le nombre de clics par jour"
    ],
    correct_answer: "Le montant moyen que vous êtes prêt à dépenser par jour pour une campagne"
  },
  {
    question_text: "Qu'est-ce qu'une correspondance de mot-clé exacte (exact match) ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un mot-clé qui correspond exactement à la recherche de l'utilisateur",
      "Un mot-clé similaire",
      "Un mot-clé générique",
      "Un mot-clé négatif"
    ],
    correct_answer: "Un mot-clé qui correspond exactement à la recherche de l'utilisateur"
  },
  {
    question_text: "Qu'est-ce qu'un mot-clé négatif dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un mot-clé qui empêche votre annonce d'apparaître pour certaines recherches",
      "Un mot-clé avec un score faible",
      "Un mot-clé supprimé",
      "Un mot-clé inactif"
    ],
    correct_answer: "Un mot-clé qui empêche votre annonce d'apparaître pour certaines recherches"
  },
  {
    question_text: "Qu'est-ce que le ROAS (Return on Ad Spend) ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Le revenu généré pour chaque euro dépensé en publicité",
      "Le nombre de clics",
      "Le coût par clic",
      "Le budget quotidien"
    ],
    correct_answer: "Le revenu généré pour chaque euro dépensé en publicité"
  },
  {
    question_text: "Qu'est-ce qu'une conversion dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un clic sur une annonce",
      "Une action que vous considérez comme précieuse (achat, inscription, téléchargement, etc.)",
      "Une impression",
      "Un mot-clé"
    ],
    correct_answer: "Une action que vous considérez comme précieuse (achat, inscription, téléchargement, etc.)"
  },
  {
    question_text: "Qu'est-ce que Google Analytics et comment s'intègre-t-il avec Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Un outil d'analyse qui permet de suivre le comportement des visiteurs et d'optimiser les campagnes Google Ads",
      "Un type de campagne",
      "Un mot-clé",
      "Une annonce"
    ],
    correct_answer: "Un outil d'analyse qui permet de suivre le comportement des visiteurs et d'optimiser les campagnes Google Ads"
  },
  {
    question_text: "Qu'est-ce qu'une campagne Shopping dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Une campagne qui affiche des produits avec images, prix et descriptions dans les résultats de recherche Google",
      "Une campagne de recherche standard",
      "Une campagne Display",
      "Une campagne vidéo"
    ],
    correct_answer: "Une campagne qui affiche des produits avec images, prix et descriptions dans les résultats de recherche Google"
  },
  {
    question_text: "Qu'est-ce que l'enchère automatique dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Google ajuste automatiquement vos enchères pour maximiser vos conversions ou votre budget",
      "Un type de mot-clé",
      "Une campagne automatique",
      "Un budget fixe"
    ],
    correct_answer: "Google ajuste automatiquement vos enchères pour maximiser vos conversions ou votre budget"
  },
  {
    question_text: "Qu'est-ce que le réseau de recherche Google ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Les sites web où vos annonces peuvent apparaître lors de recherches",
      "Un type de campagne",
      "Un outil d'analyse",
      "Un budget"
    ],
    correct_answer: "Les sites web où vos annonces peuvent apparaître lors de recherches"
  },
  {
    question_text: "Qu'est-ce qu'une annonce responsive dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "Une annonce qui s'adapte automatiquement à différents formats et emplacements",
      "Une annonce mobile uniquement",
      "Une annonce desktop uniquement",
      "Une annonce avec images"
    ],
    correct_answer: "Une annonce qui s'adapte automatiquement à différents formats et emplacements"
  },
  {
    question_text: "Qu'est-ce que le ciblage géographique dans Google Ads ?",
    question_type: "multiple_choice",
    points: 5,
    options: [
      "La possibilité de choisir où vos annonces apparaissent en fonction de la localisation des utilisateurs",
      "Un type de campagne",
      "Un mot-clé géographique",
      "Un budget par région"
    ],
    correct_answer: "La possibilité de choisir où vos annonces apparaissent en fonction de la localisation des utilisateurs"
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
        'Évaluation Finale - Marketing Google Ads',
        'Évaluation technique complète sur Google Ads couvrant les campagnes publicitaires, les mots-clés, les enchères, le ciblage, les audiences, le remarketing, et les stratégies d\'optimisation. Cette évaluation teste vos connaissances théoriques et pratiques acquises tout au long de la formation.',
        70, // Score minimum pour réussir (70%)
        60, // Durée : 60 minutes
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
    console.log(`   - Titre : Évaluation Finale - Marketing Google Ads`);
    console.log(`   - Nombre de questions : ${evaluationQuestions.length}`);
    console.log(`   - Points totaux : ${totalPoints}`);
    console.log(`   - Score minimum pour réussir : ${passingPoints} points (70%)`);
    console.log(`   - Durée : 60 minutes`);
    console.log(`   - Tentatives maximum : 1\n`);
    
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

