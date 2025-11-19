const { pool } = require('../src/config/database');
const path = require('path');
const fs = require('fs');

/**
 * Script pour créer une formation complète avec différents formats
 * pour l'utilisateur 75 (instructeur)
 */

const INSTRUCTOR_ID = 75;

// Structure de la formation complète
const courseData = {
  title: "Formation Complète : Développement Web Full-Stack",
  description: `Une formation complète et moderne pour maîtriser le développement web full-stack.
  
Cette formation couvre tous les aspects du développement web moderne, de la conception à la mise en production.
Vous apprendrez les technologies les plus demandées sur le marché : HTML5, CSS3, JavaScript, React, Node.js, et bien plus encore.

Objectifs de la formation :
- Maîtriser les fondamentaux du développement web
- Créer des applications web modernes et responsives
- Développer des API RESTful robustes
- Gérer des bases de données
- Déployer des applications en production`,
  short_description: "Formation complète en développement web full-stack avec projets pratiques",
  category_id: null, // Sera récupéré ou créé
  thumbnail_url: null, // Sera ajouté si fichier fourni
  video_url: null,
  duration_minutes: 1200, // 20 heures
  difficulty: "intermediate",
  language: "fr",
  price: 299.99,
  currency: "EUR",
  max_students: null,
  enrollment_deadline: null,
  course_start_date: null,
  course_end_date: null,
  course_type: "on_demand",
  is_sequential: true,
  status: "draft"
};

// Modules avec leurs leçons
const modulesData = [
  {
    title: "Module 1 : Introduction au Développement Web",
    description: "Découvrez les bases du développement web et les outils essentiels",
    order_index: 1,
    lessons: [
      {
        title: "Introduction au Web",
        description: "Comprendre l'architecture du web et son fonctionnement",
        content_type: "text",
        content: `<h2>Introduction au Web</h2>
<p>Le World Wide Web (WWW) est un système d'information basé sur l'hypertexte accessible via Internet.</p>
<h3>Concepts clés :</h3>
<ul>
  <li><strong>Client-Serveur</strong> : Architecture où le client demande des ressources au serveur</li>
  <li><strong>HTTP/HTTPS</strong> : Protocoles de communication</li>
  <li><strong>HTML/CSS/JavaScript</strong> : Technologies frontend</li>
</ul>
<h3>Historique</h3>
<p>Le web a été créé en 1989 par Tim Berners-Lee au CERN. Depuis, il a évolué pour devenir la plateforme principale de communication et de commerce.</p>`,
        content_text: "Introduction au Web - Concepts clés du développement web moderne",
        duration_minutes: 30,
        order_index: 1,
        is_required: true,
        is_published: true
      },
      {
        title: "Les Outils du Développeur",
        description: "Découvrez les outils essentiels pour développer",
        content_type: "document",
        content: "Guide complet des outils de développement",
        content_text: "VS Code, Git, Chrome DevTools, et autres outils essentiels",
        duration_minutes: 45,
        order_index: 2,
        is_required: true,
        is_published: true,
        media_file_id: null // Sera ajouté si fichier fourni
      },
      {
        title: "Vidéo : Installation de l'Environnement",
        description: "Tutoriel vidéo pour installer votre environnement de développement",
        content_type: "video",
        content: "Tutoriel d'installation",
        content_text: "Installation de Node.js, Git, et VS Code",
        duration_minutes: 20,
        order_index: 3,
        is_required: true,
        is_published: true,
        video_url: null, // Sera ajouté si fichier fourni
        media_file_id: null
      }
    ]
  },
  {
    title: "Module 2 : HTML5 et CSS3 Avancés",
    description: "Maîtrisez les langages de base du web avec des techniques avancées",
    order_index: 2,
    lessons: [
      {
        title: "HTML5 : Structure Sémantique",
        description: "Apprenez à structurer vos pages avec HTML5",
        content_type: "text",
        content: `<h2>HTML5 Sémantique</h2>
<p>HTML5 introduit de nouveaux éléments sémantiques qui améliorent la structure et l'accessibilité :</p>
<ul>
  <li><code>&lt;header&gt;</code> : En-tête de page</li>
  <li><code>&lt;nav&gt;</code> : Navigation</li>
  <li><code>&lt;main&gt;</code> : Contenu principal</li>
  <li><code>&lt;article&gt;</code> : Article indépendant</li>
  <li><code>&lt;section&gt;</code> : Section thématique</li>
  <li><code>&lt;aside&gt;</code> : Contenu complémentaire</li>
  <li><code>&lt;footer&gt;</code> : Pied de page</li>
</ul>`,
        content_text: "Éléments sémantiques HTML5 pour une meilleure structure",
        duration_minutes: 40,
        order_index: 1,
        is_required: true,
        is_published: true
      },
      {
        title: "CSS3 : Flexbox et Grid",
        description: "Maîtrisez les systèmes de mise en page modernes",
        content_type: "presentation",
        content: "Présentation sur Flexbox et CSS Grid",
        content_text: "Techniques de mise en page avec Flexbox et CSS Grid",
        duration_minutes: 60,
        order_index: 2,
        is_required: true,
        is_published: true,
        media_file_id: null
      },
      {
        title: "Audio : Podcast sur les Bonnes Pratiques CSS",
        description: "Écoutez nos conseils d'experts sur CSS",
        content_type: "audio",
        content: "Podcast CSS",
        content_text: "Bonnes pratiques et astuces CSS",
        duration_minutes: 25,
        order_index: 3,
        is_required: false,
        is_published: true,
        media_file_id: null
      }
    ]
  },
  {
    title: "Module 3 : JavaScript Moderne",
    description: "De ES6+ à TypeScript, maîtrisez JavaScript moderne",
    order_index: 3,
    lessons: [
      {
        title: "JavaScript ES6+ : Les Nouvelles Fonctionnalités",
        description: "Découvrez les fonctionnalités modernes de JavaScript",
        content_type: "text",
        content: `<h2>JavaScript ES6+</h2>
<h3>Nouvelles fonctionnalités :</h3>
<ul>
  <li><strong>Arrow Functions</strong> : <code>const add = (a, b) => a + b;</code></li>
  <li><strong>Destructuring</strong> : <code>const {name, age} = user;</code></li>
  <li><strong>Template Literals</strong> : <code>\`Hello \${name}\`</code></li>
  <li><strong>Promises & Async/Await</strong> : Gestion asynchrone</li>
  <li><strong>Modules</strong> : <code>import/export</code></li>
</ul>`,
        content_text: "Fonctionnalités ES6+ de JavaScript",
        duration_minutes: 50,
        order_index: 1,
        is_required: true,
        is_published: true
      },
      {
        title: "Vidéo : Projet Pratique JavaScript",
        description: "Créez une application JavaScript complète",
        content_type: "video",
        content: "Tutoriel projet JavaScript",
        content_text: "Création d'une application Todo List avec JavaScript",
        duration_minutes: 90,
        order_index: 2,
        is_required: true,
        is_published: true,
        video_url: null,
        media_file_id: null
      },
      {
        title: "Quiz : Testez vos Connaissances JavaScript",
        description: "Évaluez votre compréhension de JavaScript",
        content_type: "quiz",
        content: "Quiz JavaScript",
        content_text: "Questions sur JavaScript ES6+",
        duration_minutes: 30,
        order_index: 3,
        is_required: true,
        is_published: true
      }
    ]
  },
  {
    title: "Module 4 : React et le Développement Frontend",
    description: "Créez des interfaces utilisateur modernes avec React",
    order_index: 4,
    lessons: [
      {
        title: "Introduction à React",
        description: "Découvrez React et ses concepts fondamentaux",
        content_type: "text",
        content: `<h2>React : Bibliothèque JavaScript</h2>
<p>React est une bibliothèque JavaScript pour créer des interfaces utilisateur.</p>
<h3>Concepts clés :</h3>
<ul>
  <li><strong>Composants</strong> : Unités réutilisables</li>
  <li><strong>JSX</strong> : Syntaxe similaire à HTML</li>
  <li><strong>Props</strong> : Passage de données</li>
  <li><strong>State</strong> : Gestion de l'état</li>
  <li><strong>Hooks</strong> : useState, useEffect, etc.</li>
</ul>`,
        content_text: "Introduction à React et ses concepts",
        duration_minutes: 45,
        order_index: 1,
        is_required: true,
        is_published: true
      },
      {
        title: "Vidéo : Créer votre Première App React",
        description: "Tutoriel pas à pas pour créer une app React",
        content_type: "video",
        content: "Tutoriel React",
        content_text: "Création d'une application React complète",
        duration_minutes: 120,
        order_index: 2,
        is_required: true,
        is_published: true,
        video_url: null,
        media_file_id: null
      },
      {
        title: "H5P : Interaction Interactive React",
        description: "Module interactif H5P sur React",
        content_type: "h5p",
        content: "Module H5P React",
        content_text: "Interaction interactive pour apprendre React",
        duration_minutes: 40,
        order_index: 3,
        is_required: false,
        is_published: true,
        content_url: null,
        media_file_id: null
      }
    ]
  },
  {
    title: "Module 5 : Node.js et Backend",
    description: "Développez des API robustes avec Node.js",
    order_index: 5,
    lessons: [
      {
        title: "Node.js : Les Fondamentaux",
        description: "Comprendre Node.js et son écosystème",
        content_type: "text",
        content: `<h2>Node.js</h2>
<p>Node.js est un environnement d'exécution JavaScript côté serveur.</p>
<h3>Caractéristiques :</h3>
<ul>
  <li>Asynchrone et non-bloquant</li>
  <li>Basé sur le moteur V8 de Chrome</li>
  <li>Écosystème npm riche</li>
  <li>Idéal pour les API et applications temps réel</li>
</ul>`,
        content_text: "Fondamentaux de Node.js",
        duration_minutes: 50,
        order_index: 1,
        is_required: true,
        is_published: true
      },
      {
        title: "Document : Guide API REST",
        description: "Guide complet pour créer des API REST",
        content_type: "document",
        content: "Guide API REST",
        content_text: "Bonnes pratiques pour créer des API RESTful",
        duration_minutes: 60,
        order_index: 2,
        is_required: true,
        is_published: true,
        media_file_id: null
      },
      {
        title: "Assignment : Créer une API REST",
        description: "Projet pratique : créer votre propre API",
        content_type: "assignment",
        content: "Devoir : API REST",
        content_text: "Créez une API REST complète avec Node.js et Express",
        duration_minutes: 180,
        order_index: 3,
        is_required: true,
        is_published: true
      }
    ]
  },
  {
    title: "Module 6 : Base de Données et Déploiement",
    description: "Gérez les données et déployez vos applications",
    order_index: 6,
    lessons: [
      {
        title: "MySQL et Bases de Données Relationnelles",
        description: "Apprenez à utiliser MySQL efficacement",
        content_type: "text",
        content: `<h2>MySQL : Base de Données Relationnelle</h2>
<p>MySQL est un système de gestion de bases de données relationnelles.</p>
<h3>Concepts :</h3>
<ul>
  <li>Tables et relations</li>
  <li>Requêtes SQL</li>
  <li>Index et performances</li>
  <li>Transactions</li>
</ul>`,
        content_text: "Fondamentaux MySQL",
        duration_minutes: 55,
        order_index: 1,
        is_required: true,
        is_published: true
      },
      {
        title: "Forum : Discussion sur le Déploiement",
        description: "Échangez sur les meilleures pratiques de déploiement",
        content_type: "forum",
        content: "Forum déploiement",
        content_text: "Discussion sur les stratégies de déploiement",
        duration_minutes: 30,
        order_index: 2,
        is_required: false,
        is_published: true
      },
      {
        title: "Vidéo : Déployer sur Production",
        description: "Tutoriel complet sur le déploiement",
        content_type: "video",
        content: "Tutoriel déploiement",
        content_text: "Déployer une application Node.js en production",
        duration_minutes: 75,
        order_index: 3,
        is_required: true,
        is_published: true,
        video_url: null,
        media_file_id: null
      }
    ]
  }
];

/**
 * Fonction principale
 */
async function createCompleteCourse() {
  let connection;
  
  try {
    console.log('🚀 Début de la création de la formation complète...\n');
    
    // Vérifier que l'utilisateur 75 existe
    const [users] = await pool.execute('SELECT id, first_name, last_name, role FROM users WHERE id = ?', [INSTRUCTOR_ID]);
    if (users.length === 0) {
      throw new Error(`L'utilisateur ${INSTRUCTOR_ID} n'existe pas`);
    }
    console.log(`✅ Instructeur trouvé : ${users[0].first_name} ${users[0].last_name} (ID: ${INSTRUCTOR_ID})\n`);

    // Récupérer ou créer une catégorie
    let categoryId;
    const [categories] = await pool.execute("SELECT id FROM categories WHERE name LIKE '%Développement%' OR name LIKE '%Web%' LIMIT 1");
    if (categories.length > 0) {
      categoryId = categories[0].id;
      console.log(`✅ Catégorie trouvée : ID ${categoryId}`);
    } else {
      // Créer une catégorie par défaut
      const [result] = await pool.execute(
        "INSERT INTO categories (name, description, color, icon, is_active) VALUES (?, ?, ?, ?, ?)",
        ['Développement Web', 'Formations en développement web', '#007bff', 'code', true]
      );
      categoryId = result.insertId;
      console.log(`✅ Catégorie créée : ID ${categoryId}`);
    }
    courseData.category_id = categoryId;

    // Créer le cours
    console.log('\n📚 Création du cours...');
    const [courseResult] = await pool.execute(
      `INSERT INTO courses (
        title, description, short_description, instructor_id, category_id,
        thumbnail_url, video_url, duration_minutes, difficulty, language,
        price, currency, course_type, is_sequential, status, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        courseData.title,
        courseData.description,
        courseData.short_description,
        INSTRUCTOR_ID,
        courseData.category_id,
        courseData.thumbnail_url,
        courseData.video_url,
        courseData.duration_minutes,
        courseData.difficulty,
        courseData.language,
        courseData.price,
        courseData.currency,
        courseData.course_type,
        courseData.is_sequential,
        courseData.status,
        false // is_published
      ]
    );
    const courseId = courseResult.insertId;
    console.log(`✅ Cours créé : ID ${courseId} - "${courseData.title}"\n`);

    // Créer les modules et leurs leçons
    console.log('📦 Création des modules et leçons...\n');
    for (const moduleData of modulesData) {
      // Créer le module
      const [moduleResult] = await pool.execute(
        `INSERT INTO modules (course_id, title, description, order_index, is_unlocked)
         VALUES (?, ?, ?, ?, ?)`,
        [courseId, moduleData.title, moduleData.description, moduleData.order_index, true]
      );
      const moduleId = moduleResult.insertId;
      console.log(`  ✅ Module créé : "${moduleData.title}" (ID: ${moduleId})`);

      // Créer les leçons du module
      for (const lessonData of moduleData.lessons) {
        const [lessonResult] = await pool.execute(
          `INSERT INTO lessons (
            course_id, module_id, title, description, content_type, 
            content, content_text, video_url, media_file_id, content_url,
            duration_minutes, order_index, is_required, is_published
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            courseId,
            moduleId,
            lessonData.title,
            lessonData.description,
            lessonData.content_type,
            lessonData.content || null,
            lessonData.content_text || null,
            lessonData.video_url || null,
            lessonData.media_file_id || null,
            lessonData.content_url || null,
            lessonData.duration_minutes,
            lessonData.order_index,
            lessonData.is_required,
            lessonData.is_published
          ]
        );
        console.log(`    ✅ Leçon créée : "${lessonData.title}" (${lessonData.content_type})`);
      }
      console.log('');
    }

    console.log('\n🎉 Formation complète créée avec succès !\n');
    console.log(`📊 Résumé :`);
    console.log(`   - Cours : "${courseData.title}" (ID: ${courseId})`);
    console.log(`   - Modules : ${modulesData.length}`);
    console.log(`   - Leçons totales : ${modulesData.reduce((sum, m) => sum + m.lessons.length, 0)}`);
    console.log(`   - Formats utilisés : ${[...new Set(modulesData.flatMap(m => m.lessons.map(l => l.content_type)))].join(', ')}`);
    console.log(`\n🔗 URL du cours : http://localhost:3000/learn/${courseId}`);
    console.log(`\n⚠️  Note : Les fichiers médias doivent être ajoutés manuellement via l'interface ou un script séparé.`);

  } catch (error) {
    console.error('❌ Erreur lors de la création :', error);
    throw error;
  }
}

// Exécuter le script
if (require.main === module) {
  createCompleteCourse()
    .then(() => {
      console.log('\n✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur fatale :', error);
      process.exit(1);
    });
}

module.exports = { createCompleteCourse };

