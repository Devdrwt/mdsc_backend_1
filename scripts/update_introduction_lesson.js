const { pool } = require('../src/config/database');

/**
 * Script pour mettre à jour la leçon "Introduction au Web" avec un contenu complet
 */

const LESSON_ID = 359; // ID de la leçon "Introduction au Web"

const enhancedContent = `<h1>Introduction au Développement Web</h1>

<section>
  <h2>🌐 Bienvenue dans le Monde du Web</h2>
  <p>Bienvenue dans cette formation complète sur le développement web ! Avant de plonger dans les aspects techniques, il est essentiel de comprendre les fondements du World Wide Web, son histoire, son architecture et son fonctionnement.</p>
  
  <p>Le développement web est l'un des domaines les plus dynamiques et en constante évolution de l'informatique. Que vous souhaitiez créer des sites web, des applications web modernes, ou des plateformes complexes, cette formation vous donnera toutes les compétences nécessaires.</p>
</section>

<section>
  <h2>📚 Qu'est-ce que le World Wide Web ?</h2>
  
  <h3>Définition</h3>
  <p>Le <strong>World Wide Web (WWW)</strong>, communément appelé "le Web", est un système d'information basé sur l'hypertexte accessible via Internet. Il a été inventé en 1989 par <strong>Tim Berners-Lee</strong>, un informaticien britannique travaillant au CERN (Organisation européenne pour la recherche nucléaire) à Genève.</p>
  
  <h3>Concepts Fondamentaux</h3>
  <ul>
    <li><strong>Internet vs Web</strong> : Internet est le réseau physique de connexions, tandis que le Web est un service qui fonctionne sur Internet</li>
    <li><strong>Hypertexte</strong> : Système de liens permettant de naviguer entre différents documents</li>
    <li><strong>URL (Uniform Resource Locator)</strong> : Adresse unique identifiant une ressource sur le Web</li>
    <li><strong>HTTP/HTTPS</strong> : Protocoles de communication permettant le transfert de données</li>
  </ul>
</section>

<section>
  <h2>🏗️ Architecture Client-Serveur</h2>
  
  <p>Le Web fonctionne selon une architecture <strong>client-serveur</strong> :</p>
  
  <h3>Le Client (Navigateur)</h3>
  <ul>
    <li>Demande des ressources au serveur</li>
    <li>Affiche les pages web à l'utilisateur</li>
    <li>Exécute le code JavaScript côté client</li>
    <li>Exemples : Chrome, Firefox, Safari, Edge</li>
  </ul>
  
  <h3>Le Serveur</h3>
  <ul>
    <li>Stocke les fichiers et données</li>
    <li>Traite les requêtes HTTP</li>
    <li>Exécute le code backend (PHP, Node.js, Python, etc.)</li>
    <li>Gère les bases de données</li>
  </ul>
  
  <h3>Le Processus de Communication</h3>
  <ol>
    <li>L'utilisateur saisit une URL dans le navigateur</li>
    <li>Le navigateur envoie une requête HTTP au serveur</li>
    <li>Le serveur traite la requête et renvoie une réponse (HTML, CSS, JavaScript, images, etc.)</li>
    <li>Le navigateur interprète et affiche le contenu</li>
  </ol>
</section>

<section>
  <h2>📖 Historique et Évolution du Web</h2>
  
  <h3>Web 1.0 (1990-2000) : Le Web Statique</h3>
  <ul>
    <li>Pages HTML statiques</li>
    <li>Contenu en lecture seule</li>
    <li>Peu d'interactivité</li>
    <li>Exemples : Sites vitrines, pages d'information</li>
  </ul>
  
  <h3>Web 2.0 (2000-2010) : Le Web Interactif</h3>
  <ul>
    <li>Contenu généré par les utilisateurs</li>
    <li>Réseaux sociaux (Facebook, Twitter)</li>
    <li>Applications web interactives</li>
    <li>AJAX pour des mises à jour dynamiques</li>
  </ul>
  
  <h3>Web 3.0 (2010-présent) : Le Web Moderne</h3>
  <ul>
    <li>Applications web complexes (SPA - Single Page Applications)</li>
    <li>Mobile-first et responsive design</li>
    <li>APIs RESTful et GraphQL</li>
    <li>Cloud computing et microservices</li>
    <li>Progressive Web Apps (PWA)</li>
    <li>Intelligence artificielle et machine learning</li>
  </ul>
</section>

<section>
  <h2>🛠️ Technologies du Web</h2>
  
  <h3>Frontend (Côté Client)</h3>
  <ul>
    <li><strong>HTML (HyperText Markup Language)</strong> : Structure et contenu des pages</li>
    <li><strong>CSS (Cascading Style Sheets)</strong> : Mise en forme et design</li>
    <li><strong>JavaScript</strong> : Interactivité et logique côté client</li>
    <li><strong>Frameworks modernes</strong> : React, Vue.js, Angular, Svelte</li>
  </ul>
  
  <h3>Backend (Côté Serveur)</h3>
  <ul>
    <li><strong>Langages</strong> : Node.js, PHP, Python, Ruby, Java, C#</li>
    <li><strong>Frameworks</strong> : Express.js, Laravel, Django, Rails, Spring</li>
    <li><strong>Bases de données</strong> : MySQL, PostgreSQL, MongoDB, Redis</li>
    <li><strong>APIs</strong> : REST, GraphQL, WebSockets</li>
  </ul>
  
  <h3>Outils et Technologies Complémentaires</h3>
  <ul>
    <li><strong>Version Control</strong> : Git, GitHub, GitLab</li>
    <li><strong>Build Tools</strong> : Webpack, Vite, Parcel</li>
    <li><strong>Containers</strong> : Docker, Kubernetes</li>
    <li><strong>CI/CD</strong> : GitHub Actions, Jenkins, GitLab CI</li>
  </ul>
</section>

<section>
  <h2>🎯 Objectifs de cette Formation</h2>
  
  <p>À la fin de cette formation complète, vous serez capable de :</p>
  
  <ul>
    <li>✅ Comprendre l'architecture et le fonctionnement du Web</li>
    <li>✅ Créer des pages web modernes avec HTML5 et CSS3</li>
    <li>✅ Développer des applications interactives avec JavaScript</li>
    <li>✅ Construire des interfaces utilisateur avec React</li>
    <li>✅ Créer des API RESTful robustes avec Node.js</li>
    <li>✅ Gérer des bases de données relationnelles</li>
    <li>✅ Déployer des applications en production</li>
    <li>✅ Appliquer les meilleures pratiques de développement</li>
  </ul>
</section>

<section>
  <h2>💡 Pourquoi Apprendre le Développement Web ?</h2>
  
  <h3>Opportunités Professionnelles</h3>
  <ul>
    <li>Demande élevée sur le marché du travail</li>
    <li>Salaires compétitifs</li>
    <li>Possibilité de travailler en freelance ou en entreprise</li>
    <li>Opportunités de télétravail</li>
  </ul>
  
  <h3>Avantages Personnels</h3>
  <ul>
    <li>Créativité et résolution de problèmes</li>
    <li>Communauté active et support</li>
    <li>Apprentissage continu et évolution constante</li>
    <li>Possibilité de créer vos propres projets</li>
  </ul>
</section>

<section>
  <h2>🚀 Comment Utiliser cette Formation</h2>
  
  <h3>Structure Pédagogique</h3>
  <ul>
    <li><strong>Modules progressifs</strong> : Chaque module construit sur le précédent</li>
    <li><strong>Leçons variées</strong> : Textes, vidéos, exercices pratiques, quiz</li>
    <li><strong>Projets réels</strong> : Application des connaissances sur des projets concrets</li>
    <li><strong>Support continu</strong> : Forums et ressources complémentaires</li>
  </ul>
  
  <h3>Conseils pour Réussir</h3>
  <ul>
    <li>📝 Prenez des notes pendant les leçons</li>
    <li>💻 Pratiquez régulièrement en codant</li>
    <li>🔍 Explorez les ressources complémentaires</li>
    <li>🤝 Participez aux forums de discussion</li>
    <li>✅ Complétez tous les exercices et quiz</li>
    <li>🚀 Créez vos propres projets pour renforcer l'apprentissage</li>
  </ul>
</section>

<section>
  <h2>📋 Prérequis</h2>
  
  <p>Pour tirer le meilleur parti de cette formation, il est recommandé d'avoir :</p>
  <ul>
    <li>Une compréhension de base de l'utilisation d'un ordinateur</li>
    <li>Une motivation et une curiosité pour apprendre</li>
    <li>Un accès à un ordinateur avec connexion Internet</li>
    <li>Du temps à consacrer à l'apprentissage (recommandé : 5-10 heures par semaine)</li>
  </ul>
  
  <p><strong>Note importante</strong> : Aucune expérience préalable en programmation n'est requise. Cette formation part de zéro et vous guide pas à pas.</p>
</section>

<section>
  <h2>🎓 Prochaines Étapes</h2>
  
  <p>Maintenant que vous avez une vue d'ensemble du développement web, vous êtes prêt à commencer votre parcours d'apprentissage !</p>
  
  <p>Dans les prochaines leçons, vous découvrirez :</p>
  <ol>
    <li>Les outils essentiels du développeur web</li>
    <li>Comment installer et configurer votre environnement de développement</li>
    <li>Les bases du HTML5 et CSS3</li>
    <li>Et bien plus encore...</li>
  </ol>
  
  <p><strong>Bonne chance dans votre apprentissage ! 🚀</strong></p>
</section>`;

const enhancedContentText = `Introduction complète au développement web : histoire, architecture client-serveur, évolution du Web (1.0, 2.0, 3.0), technologies frontend et backend, objectifs de la formation, opportunités professionnelles, conseils pour réussir, et prochaines étapes.`;

/**
 * Fonction principale
 */
async function updateIntroductionLesson() {
  try {
    console.log('🔄 Mise à jour de la leçon "Introduction au Web"...\n');
    
    // Vérifier que la leçon existe
    const [lessons] = await pool.execute('SELECT id, title FROM lessons WHERE id = ?', [LESSON_ID]);
    if (lessons.length === 0) {
      throw new Error(`La leçon avec l'ID ${LESSON_ID} n'existe pas`);
    }
    console.log(`✅ Leçon trouvée : "${lessons[0].title}" (ID: ${LESSON_ID})\n`);

    // Mettre à jour le contenu
    // IMPORTANT: Le frontend utilise content_text pour afficher le contenu des leçons de type "text"
    // Donc on met le contenu complet dans content_text ET content pour compatibilité
    await pool.execute(
      `UPDATE lessons 
       SET content = ?, content_text = ?, updated_at = NOW() 
       WHERE id = ?`,
      [enhancedContent, enhancedContent, LESSON_ID]
    );

    console.log('✅ Contenu mis à jour avec succès !\n');
    console.log(`📊 Statistiques du nouveau contenu :`);
    console.log(`   - Longueur HTML : ${enhancedContent.length} caractères`);
    console.log(`   - Nombre de sections : ${(enhancedContent.match(/<section>/g) || []).length}`);
    console.log(`   - Nombre de listes : ${(enhancedContent.match(/<ul>|<ol>/g) || []).length}`);
    console.log(`\n🔗 Leçon disponible à : http://localhost:3000/learn/47?module=148&lesson=${LESSON_ID}`);

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour :', error);
    throw error;
  }
}

// Exécuter le script
if (require.main === module) {
  updateIntroductionLesson()
    .then(() => {
      console.log('\n✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur fatale :', error);
      process.exit(1);
    });
}

module.exports = { updateIntroductionLesson };

