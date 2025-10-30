/*
  Seeder de données démo pour un instructeur existant.
  Utilisation: npm run seed:demo
  Prérequis: un utilisateur instructeur existe avec l'email fourni ci-dessous.
*/
require('dotenv').config({ override: true });
const { pool } = require('../src/config/database');

const INSTRUCTOR_EMAIL = process.env.SEED_INSTRUCTOR_EMAIL || 'a.said@drwintech.com';

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

async function ensureCategory(connection, name = 'Développement', color = '#4F46E5') {
  const [rows] = await connection.execute('SELECT id FROM categories WHERE name = ? LIMIT 1', [name]);
  if (rows.length) return rows[0].id;
  const [res] = await connection.execute(
    'INSERT INTO categories (name, color, created_at, updated_at) VALUES (?, ?, NOW(), NOW())',
    [name, color]
  );
  return res.insertId;
}

async function ensureStudents(connection) {
  // Créer 3 élèves de test s'ils n'existent pas (mots de passe non requis pour les tests instructeur)
  const seeds = [
    { email: 'student1@example.com', first_name: 'Lina', last_name: 'Rossi' },
    { email: 'student2@example.com', first_name: 'Omar', last_name: 'Dupont' },
    { email: 'student3@example.com', first_name: 'Zoé', last_name: 'Nguyen' }
  ];
  const ids = [];
  for (const s of seeds) {
    const [u] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [s.email]);
    if (u.length) { ids.push(u[0].id); continue; }
    const [res] = await connection.execute(
      `INSERT INTO users (first_name, last_name, email, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, 'student', TRUE, NOW(), NOW())`,
      [s.first_name, s.last_name, s.email]
    );
    ids.push(res.insertId);
  }
  return ids;
}

async function seed() {
  const instructorQuery = 'SELECT id, first_name, last_name FROM users WHERE email = ? AND (role = "instructor" OR role = "admin") LIMIT 1';
  const [instructors] = await pool.execute(instructorQuery, [INSTRUCTOR_EMAIL]);
  if (instructors.length === 0) {
    throw new Error(`Instructeur introuvable avec l'email ${INSTRUCTOR_EMAIL}. Créez-le d'abord.`);
  }
  const instructorId = instructors[0].id;

  await withTransaction(async (conn) => {
    console.log('→ Vérification catégorie & cours...');

    // Auto-fix: retirer courses.domain_id si présent (héritage ancien schéma)
    const [[hasDomainId]] = await conn.query("SHOW COLUMNS FROM courses LIKE 'domain_id'");
    if (hasDomainId) {
      console.log("→ Colonne courses.domain_id détectée. Tentative d'assouplissement (NULL DEFAULT)...");
      try { await conn.execute("ALTER TABLE courses MODIFY domain_id INT NULL DEFAULT NULL"); } catch {}
      // Si la DROP est possible, on la tente également (selon contraintes)
      try { await conn.execute("ALTER TABLE courses DROP COLUMN domain_id"); } catch {}
    }
    const categoryId = await ensureCategory(conn);

    // Choisir un cours existant de l'instructeur si présent, sinon tenter d'en créer un
    let courseId;
    const [anyCourse] = await conn.execute('SELECT id FROM courses WHERE instructor_id = ? LIMIT 1', [instructorId]);
    if (anyCourse.length) {
      courseId = anyCourse[0].id;
    } else {
      try {
        const [courseRes] = await conn.execute(
          `INSERT INTO courses (
            title, description, short_description, instructor_id, category_id,
            thumbnail_url, video_url, duration_minutes, difficulty, language,
            price, currency, max_students, is_published, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'beginner', 'fr', ?, 'EUR', 0, TRUE, NOW(), NOW())`,
          [
            'Cours Démo - Introduction au DnD',
            'Cours démo pour tester le dashboard, les modules et la liste des inscrits.',
            'Démo DnD + analytics',
            instructorId,
            categoryId,
            null,
            null,
            120,
            0
          ]
        );
        courseId = courseRes.insertId;
      } catch (e) {
        throw new Error("Création de cours impossible (colonne requise manquante, ex: domain_id). Crée au moins un cours manuellement pour cet instructeur, puis relance le seeder.");
      }
    }

    // Créer 3 modules
    console.log('→ Vérification structure modules...');
    const [[modulesHasCourseCol]] = await conn.query("SHOW COLUMNS FROM modules LIKE 'course_id'");
    if (!modulesHasCourseCol) {
      console.log("→ Ajout de la colonne modules.course_id (auto-fix dev)...");
      try {
        await conn.execute("ALTER TABLE modules ADD COLUMN course_id INT NOT NULL AFTER id");
      } catch {}
      try {
        await conn.execute("CREATE INDEX idx_course ON modules (course_id)");
      } catch {}
      try {
        await conn.execute("ALTER TABLE modules ADD CONSTRAINT fk_modules_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE");
      } catch {}
    }
    const [[modulesHasOrderIndex]] = await conn.query("SHOW COLUMNS FROM modules LIKE 'order_index'");
    if (!modulesHasOrderIndex) {
      console.log("→ Ajout de modules.order_index...");
      try { await conn.execute("ALTER TABLE modules ADD COLUMN order_index INT NOT NULL DEFAULT 0 AFTER description"); } catch {}
      try { await conn.execute("CREATE INDEX idx_order ON modules (course_id, order_index)"); } catch {}
    }
    const [[modulesHasUnlocked]] = await conn.query("SHOW COLUMNS FROM modules LIKE 'is_unlocked'");
    if (!modulesHasUnlocked) {
      console.log("→ Ajout de modules.is_unlocked...");
      try { await conn.execute("ALTER TABLE modules ADD COLUMN is_unlocked TINYINT(1) NOT NULL DEFAULT 0 AFTER order_index"); } catch {}
      try { await conn.execute("CREATE INDEX idx_unlocked ON modules (is_unlocked)"); } catch {}
    }
    const [[modulesHasCreatedAt]] = await conn.query("SHOW COLUMNS FROM modules LIKE 'created_at'");
    if (!modulesHasCreatedAt) {
      console.log("→ Ajout de modules.created_at/updated_at...");
      try { await conn.execute("ALTER TABLE modules ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP"); } catch {}
      try { await conn.execute("ALTER TABLE modules ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch {}
    }
    const moduleTitles = ['Prise en main', 'Concepts clés', 'Atelier pratique'];
    const moduleIds = [];
    for (let i = 0; i < moduleTitles.length; i++) {
      const [m] = await conn.execute(
        'SELECT id FROM modules WHERE course_id = ? AND title = ? LIMIT 1',
        [courseId, moduleTitles[i]]
      );
      if (m.length) { moduleIds.push(m[0].id); continue; }
      const [mr] = await conn.execute(
        `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [courseId, moduleTitles[i], null, i + 1, i === 0]
      );
      moduleIds.push(mr.insertId);
    }

    // S'assurer des colonnes attendues sur lessons
    const [[lessonsHasModuleId]] = await conn.query("SHOW COLUMNS FROM lessons LIKE 'module_id'");
    if (!lessonsHasModuleId) {
      console.log("→ Ajout de lessons.module_id...");
      try { await conn.execute("ALTER TABLE lessons ADD COLUMN module_id INT NULL AFTER course_id"); } catch {}
      try { await conn.execute("CREATE INDEX idx_module ON lessons (module_id)"); } catch {}
    }
    const [[lessonsHasOrderIndex]] = await conn.query("SHOW COLUMNS FROM lessons LIKE 'order_index'");
    if (!lessonsHasOrderIndex) {
      console.log("→ Ajout de lessons.order_index...");
      try { await conn.execute("ALTER TABLE lessons ADD COLUMN order_index INT NOT NULL DEFAULT 0"); } catch {}
    }
    const [[lessonsHasIsPublished]] = await conn.query("SHOW COLUMNS FROM lessons LIKE 'is_published'");
    if (!lessonsHasIsPublished) {
      console.log("→ Ajout de lessons.is_published...");
      try { await conn.execute("ALTER TABLE lessons ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 1"); } catch {}
    }
    const [[lessonsHasCreatedAt]] = await conn.query("SHOW COLUMNS FROM lessons LIKE 'created_at'");
    if (!lessonsHasCreatedAt) {
      console.log("→ Ajout de lessons.created_at/updated_at...");
      try { await conn.execute("ALTER TABLE lessons ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP"); } catch {}
      try { await conn.execute("ALTER TABLE lessons ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"); } catch {}
    }

    // Créer 2 leçons par module
    console.log('→ Création leçons démo...');
    for (let i = 0; i < moduleIds.length; i++) {
      for (let j = 0; j < 2; j++) {
        const title = `Leçon ${i + 1}.${j + 1}`;
        const [l] = await conn.execute(
          'SELECT id FROM lessons WHERE module_id = ? AND title = ? LIMIT 1',
          [moduleIds[i], title]
        );
        if (l.length) continue;
        await conn.execute(
          `INSERT INTO lessons (course_id, module_id, title, description, content, order_index, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
          [
            courseId,
            moduleIds[i],
            title,
            'Contenu de démonstration',
            'Markdown/texte de démonstration',
            j + 1
          ]
        );
      }
    }

    // Créer 3 élèves et les inscrire
    console.log('→ Création élèves & inscriptions...');
    const studentIds = await ensureStudents(conn);
    for (const sid of studentIds) {
      const [enr] = await conn.execute(
        'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1',
        [sid, courseId]
      );
      if (!enr.length) {
        await conn.execute(
          `INSERT INTO enrollments (user_id, course_id, status, enrolled_at, is_active, progress_percentage, created_at, updated_at)
           VALUES (?, ?, 'enrolled', NOW(), TRUE, ?, NOW(), NOW())`,
          [sid, courseId, Math.floor(Math.random() * 60) + 10]
        );
      }
    }

    // Marquer quelques progressions pour le premier étudiant (compatibilité progress/lesson_progress)
    console.log('→ Marquage progression démo...');
    const firstStudentId = studentIds[0];

    // Détecter structure des tables
    const [[lessonHasCourseCol]] = await conn.query("SHOW COLUMNS FROM lessons LIKE 'course_id'");
    const lessonsSelect = lessonHasCourseCol
      ? 'SELECT id FROM lessons WHERE course_id = ? ORDER BY id ASC LIMIT 3'
      : 'SELECT l.id FROM lessons l JOIN modules m ON l.module_id = m.id WHERE m.course_id = ? ORDER BY l.id ASC LIMIT 3';
    const [lessons] = await conn.execute(lessonsSelect, [courseId]);

    // Récupérer enrollment_id pour ce student et ce cours
    const [enrollRow] = await conn.execute('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1', [firstStudentId, courseId]);
    const enrollmentId = enrollRow.length ? enrollRow[0].id : null;

    // Vérifier quelle table de progression utiliser
    const [[hasProgress]] = await conn.query("SHOW TABLES LIKE 'progress'");
    const [[hasLessonProgress]] = await conn.query("SHOW TABLES LIKE 'lesson_progress'");

    for (const row of lessons) {
      if (hasProgress) {
        if (!enrollmentId) continue;
        await conn.execute(
          `INSERT INTO progress (enrollment_id, lesson_id, status, completion_percentage, time_spent, completed_at, created_at, updated_at)
           VALUES (?, ?, 'completed', 100, 900, NOW(), NOW(), NOW())
           ON DUPLICATE KEY UPDATE status = VALUES(status), completion_percentage = VALUES(completion_percentage), completed_at = VALUES(completed_at), updated_at = NOW()`,
          [enrollmentId, row.id]
        );
      } else if (hasLessonProgress) {
        await conn.execute(
          `INSERT INTO lesson_progress (user_id, lesson_id, course_id, is_completed, completed_at, time_spent_minutes, last_position_seconds, created_at, updated_at)
           VALUES (?, ?, ?, TRUE, NOW(), 15, 0, NOW(), NOW())
           ON DUPLICATE KEY UPDATE is_completed = VALUES(is_completed), completed_at = VALUES(completed_at), updated_at = NOW()`,
          [firstStudentId, row.id, courseId]
        );
      }
    }

    console.log(`✔ Données démo prêtes. CourseId=${courseId}`);
  });
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erreur seed:', err.message);
    process.exit(1);
  });


