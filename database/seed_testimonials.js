/**
 * Seeder pour ajouter des témoignages à la base de données
 * Usage: node database/seed_testimonials.js
 */

require('dotenv').config({ override: true });
const { pool } = require('../src/config/database');

const testimonials = [
  {
    quote: "Les formations MdSC m'ont permis d'acquérir des compétences essentielles en management. Je recommande vivement cette plateforme !",
    author: "CC Christelle Cakpa",
    title: "Formatrice certifiée",
    avatar: "CC",
    rating: 5,
    is_active: true,
    display_order: 0
  },
  {
    quote: "Une plateforme excellente avec des cours de qualité. Les certificats ont renforcé la confiance de mes apprenants.",
    author: "CC Christelle Cakpa",
    title: "Formatrice certifiée",
    avatar: "CC",
    rating: 5,
    is_active: true,
    display_order: 1
  },
  {
    quote: "Interface intuitive, contenu riche et accompagnement de qualité. C'est un outil indispensable pour la société civile.",
    author: "CC Christelle Cakpa",
    title: "Formatrice certifiée",
    avatar: "CC",
    rating: 5,
    is_active: true,
    display_order: 2
  },
  {
    quote: "Grâce à MdSC, j'ai pu développer mes compétences en gestion de projet et obtenir une certification reconnue. L'expérience d'apprentissage est vraiment exceptionnelle.",
    author: "Marie Dubois",
    title: "Chef de projet ONG",
    avatar: "MD",
    rating: 5,
    is_active: true,
    display_order: 3
  },
  {
    quote: "Les modules sont bien structurés et les quiz permettent de valider nos connaissances. Je suis très satisfait de la qualité pédagogique.",
    author: "Jean Kouassi",
    title: "Responsable formation",
    avatar: "JK",
    rating: 5,
    is_active: true,
    display_order: 4
  },
  {
    quote: "Une plateforme qui répond parfaitement aux besoins de formation continue. Les certificats délivrés sont valorisants pour notre carrière.",
    author: "Aminata Diallo",
    title: "Consultante en développement",
    avatar: "AD",
    rating: 5,
    is_active: true,
    display_order: 5
  },
  {
    quote: "J'apprécie particulièrement la flexibilité des cours en ligne et le suivi personnalisé. MdSC a transformé ma façon d'apprendre.",
    author: "Pierre Martin",
    title: "Formateur indépendant",
    avatar: "PM",
    rating: 4,
    is_active: true,
    display_order: 6
  }
];

async function seedTestimonials() {
  try {
    console.log('🌱 Démarrage du seeding des témoignages...\n');

    let inserted = 0;
    let skipped = 0;

    for (const testimonial of testimonials) {
      try {
        // Vérifier si le témoignage existe déjà (par quote et author)
        const [existing] = await pool.execute(
          'SELECT id FROM testimonials WHERE quote = ? AND author = ? LIMIT 1',
          [testimonial.quote, testimonial.author]
        );

        if (existing.length > 0) {
          console.log(`⏭️  Témoignage déjà existant pour "${testimonial.author}" - ignoré`);
          skipped++;
          continue;
        }

        // Insérer le témoignage
        await pool.execute(
          `INSERT INTO testimonials (quote, author, title, avatar, rating, is_active, display_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            testimonial.quote,
            testimonial.author,
            testimonial.title,
            testimonial.avatar,
            testimonial.rating,
            testimonial.is_active,
            testimonial.display_order
          ]
        );

        console.log(`✅ Témoignage ajouté: "${testimonial.author}" (${testimonial.title})`);
        inserted++;

      } catch (error) {
        console.error(`❌ Erreur lors de l'insertion du témoignage pour "${testimonial.author}":`, error.message);
      }
    }

    console.log('\n📊 Résumé du seeding:');
    console.log(`   ✅ ${inserted} témoignage(s) ajouté(s)`);
    console.log(`   ⏭️  ${skipped} témoignage(s) ignoré(s) (déjà existants)`);
    console.log(`   📝 Total: ${testimonials.length} témoignage(s) traité(s)\n`);

    // Afficher le nombre total de témoignages actifs
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM testimonials WHERE is_active = TRUE'
    );
    console.log(`📈 Total de témoignages actifs dans la base: ${countResult[0].total}\n`);

    console.log('✅ Seeding des témoignages terminé avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors du seeding des témoignages:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter le seeding
seedTestimonials();

