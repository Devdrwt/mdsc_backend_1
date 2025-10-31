/*
  Seeder enrichi pour tester le dashboard instructeur
  Utilisation: npm run seed:dashboard
  Génère: cours multiples, étudiants, enrollments avec dates variées, quiz, progressions
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

async function createMultipleStudents(connection, count = 12) {
  const students = [];
  const firstNames = ['Lina', 'Omar', 'Zoé', 'Marie', 'Jean', 'Sophie', 'Ahmed', 'Emma', 'Thomas', 'Sarah', 'Paul', 'Julie'];
  const lastNames = ['Rossi', 'Dupont', 'Nguyen', 'Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Simon', 'Lefebvre', 'Michel', 'Garcia'];
  const bcrypt = require('bcryptjs');
  const defaultPassword = await bcrypt.hash('Student123@', 12);
  
  for (let i = 0; i < count; i++) {
    const email = `student${i + 1}@example.com`;
    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length) {
      students.push(existing[0].id);
      continue;
    }
    const [res] = await connection.execute(
      `INSERT INTO users (first_name, last_name, email, password, role, is_active, is_email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'student', TRUE, TRUE, DATE_SUB(NOW(), INTERVAL ? DAY), NOW())`,
      [
        firstNames[i % firstNames.length],
        lastNames[i % lastNames.length],
        email,
        defaultPassword,
        Math.floor(Math.random() * 180) // Création échelonnée sur 6 mois
      ]
    );
    students.push(res.insertId);
  }
  return students;
}

function randomDateInRange(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function seed() {
  // Chercher un instructeur existant
  let instructorQuery = 'SELECT id, first_name, last_name, email FROM users WHERE (role = "instructor" OR role = "admin") LIMIT 1';
  let [instructors] = await pool.execute(instructorQuery);
  
  // Si aucun instructeur trouvé, en chercher un avec l'email spécifique
  if (instructors.length === 0) {
    instructorQuery = 'SELECT id, first_name, last_name, email FROM users WHERE email = ? LIMIT 1';
    [instructors] = await pool.execute(instructorQuery, [INSTRUCTOR_EMAIL]);
  }
  
  // Si toujours rien, créer l'instructeur
  let instructorId;
  if (instructors.length === 0) {
    console.log(`→ Création instructeur ${INSTRUCTOR_EMAIL}...`);
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Password123@', 12);
    const [newInstructor] = await pool.execute(
      `INSERT INTO users (first_name, last_name, email, password, role, is_active, is_email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'instructor', TRUE, TRUE, NOW(), NOW())`,
      ['Ahmed', 'Said', INSTRUCTOR_EMAIL, hashedPassword]
    );
    instructorId = newInstructor.insertId;
    console.log(`✔ Instructeur créé (ID: ${instructorId})`);
  } else {
    instructorId = instructors[0].id;
    console.log(`✔ Instructeur trouvé: ${instructors[0].email} (ID: ${instructorId})`);
  }

  await withTransaction(async (conn) => {
    console.log('→ Création catégories...');
    const cat1Id = await ensureCategory(conn, 'Développement', '#4F46E5');
    const cat2Id = await ensureCategory(conn, 'Design', '#10B981');
    const cat3Id = await ensureCategory(conn, 'Marketing', '#F59E0B');

    console.log('→ Création cours multiples...');
    const courses = [
      { title: 'JavaScript Avancé', category: cat1Id, published: true, price: 49, duration: 180 },
      { title: 'React & Redux', category: cat1Id, published: true, price: 79, duration: 240 },
      { title: 'Node.js Backend', category: cat1Id, published: true, price: 69, duration: 200 },
      { title: 'UI/UX Design Fundamentals', category: cat2Id, published: true, price: 59, duration: 150 },
      { title: 'Marketing Digital', category: cat3Id, published: true, price: 39, duration: 120 },
      { title: 'Cours en brouillon', category: cat1Id, published: false, price: 0, duration: 90 }
    ];
    const courseIds = [];
    for (const course of courses) {
      const [existing] = await conn.execute('SELECT id FROM courses WHERE title = ? AND instructor_id = ? LIMIT 1', [course.title, instructorId]);
      if (existing.length) {
        courseIds.push(existing[0].id);
        continue;
      }
      const [res] = await conn.execute(
        `INSERT INTO courses (
          title, description, short_description, instructor_id, category_id,
          thumbnail_url, video_url, duration_minutes, difficulty, language,
          price, currency, max_students, is_published, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'intermediate', 'fr', ?, 'EUR', 0, ?, DATE_SUB(NOW(), INTERVAL ? DAY), NOW())`,
        [
          course.title,
          `Description complète pour ${course.title}`,
          `Court résumé ${course.title}`,
          instructorId,
          course.category,
          null,
          null,
          course.duration,
          course.price,
          course.published ? 1 : 0,
          Math.floor(Math.random() * 180) // Création échelonnée
        ]
      );
      courseIds.push(res.insertId);
    }
    const publishedCourseIds = courseIds.slice(0, 5); // Les 5 premiers sont publiés

    console.log('→ Création modules et leçons...');
    for (let cIdx = 0; cIdx < courseIds.length; cIdx++) {
      const courseId = courseIds[cIdx];
      const moduleCount = cIdx < 3 ? 4 : 3; // Plus de modules pour les premiers cours
      for (let mIdx = 0; mIdx < moduleCount; mIdx++) {
        const moduleTitle = `Module ${mIdx + 1}`;
        let moduleId;
        const [mExisting] = await conn.execute('SELECT id FROM modules WHERE course_id = ? AND title = ? LIMIT 1', [courseId, moduleTitle]);
        if (mExisting.length) {
          moduleId = mExisting[0].id;
        } else {
          const [mRes] = await conn.execute(
            `INSERT INTO modules (course_id, title, description, order_index, is_unlocked, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [courseId, moduleTitle, `Description module ${mIdx + 1}`, mIdx + 1, mIdx === 0]
          );
          moduleId = mRes.insertId;
        }
        // 2-3 leçons par module
        const lessonCount = mIdx < 2 ? 3 : 2;
        for (let lIdx = 0; lIdx < lessonCount; lIdx++) {
          const lessonTitle = `Leçon ${mIdx + 1}.${lIdx + 1}`;
          const [lExisting] = await conn.execute('SELECT id FROM lessons WHERE module_id = ? AND title = ? LIMIT 1', [moduleId, lessonTitle]);
          if (!lExisting.length) {
            await conn.execute(
              `INSERT INTO lessons (course_id, module_id, title, description, content, order_index, is_published, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
              [courseId, moduleId, lessonTitle, 'Contenu démo', 'Markdown démo', lIdx + 1]
            );
          }
        }
      }
    }

    console.log('→ Création étudiants...');
    const studentIds = await createMultipleStudents(conn, 12);

    console.log('→ Création enrollments avec dates variées...');
    for (const courseId of publishedCourseIds) {
      // Chaque cours a 60-90% des étudiants inscrits
      const enrollmentRate = 0.6 + Math.random() * 0.3;
      const enrolledStudents = studentIds.slice(0, Math.floor(studentIds.length * enrollmentRate));
      
      for (const studentId of enrolledStudents) {
        const [enrExisting] = await conn.execute(
          'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1',
          [studentId, courseId]
        );
        if (enrExisting.length) continue;
        
        const daysAgo = Math.floor(Math.random() * 180); // Inscription dans les 6 derniers mois
        const progress = Math.floor(Math.random() * 100);
        const isCompleted = progress === 100;
        
        await conn.execute(
          `INSERT INTO enrollments (
            user_id, course_id, status, enrolled_at, is_active, progress_percentage,
            completed_at
          ) VALUES (?, ?, 'enrolled', DATE_SUB(NOW(), INTERVAL ? DAY), TRUE, ?, ?)`,
          [studentId, courseId, daysAgo, progress, isCompleted ? randomDateInRange(Math.floor(Math.random() * 30)) : null]
        );
      }
    }

    console.log('→ Création progressions leçons...');
    // Récupérer toutes les leçons des cours publiés
    const placeholders = publishedCourseIds.map(() => '?').join(',');
    const [lessons] = await conn.execute(
      `SELECT l.id, l.course_id, e.user_id, e.id as enrollment_id
       FROM lessons l
       JOIN modules m ON l.module_id = m.id
       JOIN enrollments e ON l.course_id = e.course_id
       WHERE l.course_id IN (${placeholders})
       ORDER BY RAND()
       LIMIT 50`,
      publishedCourseIds
    );
    
    for (const lesson of lessons) {
      const isCompleted = Math.random() > 0.5;
      // Utiliser la table appropriée (progress ou lesson_progress)
      const [[hasProgress]] = await conn.query("SHOW TABLES LIKE 'progress'");
      const [[hasLessonProgress]] = await conn.query("SHOW TABLES LIKE 'lesson_progress'");
      
      if (hasProgress && lesson.enrollment_id) {
        await conn.execute(
          `INSERT INTO progress (enrollment_id, lesson_id, status, completion_percentage, time_spent, completed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE status = VALUES(status), completion_percentage = VALUES(completion_percentage)`,
          [
            lesson.enrollment_id,
            lesson.id,
            isCompleted ? 'completed' : 'in_progress',
            isCompleted ? 100 : Math.floor(Math.random() * 80) + 20,
            Math.floor(Math.random() * 600) + 300,
            isCompleted ? randomDateInRange(Math.floor(Math.random() * 30)) : null
          ]
        );
      } else if (hasLessonProgress) {
        await conn.execute(
          `INSERT INTO lesson_progress (user_id, lesson_id, course_id, is_completed, completed_at, time_spent_minutes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE is_completed = VALUES(is_completed)`,
          [
            lesson.user_id,
            lesson.id,
            lesson.course_id,
            isCompleted ? 1 : 0,
            isCompleted ? randomDateInRange(Math.floor(Math.random() * 30)) : null,
            Math.floor(Math.random() * 30) + 10
          ]
        );
      }
    }

    console.log('→ Création quiz et tentatives...');
    for (const courseId of publishedCourseIds.slice(0, 3)) { // Quiz pour 3 cours
      const [quizExisting] = await conn.execute('SELECT id FROM quizzes WHERE course_id = ? LIMIT 1', [courseId]);
      let quizId;
      if (quizExisting.length) {
        quizId = quizExisting[0].id;
      } else {
        const [qRes] = await conn.execute(
          `INSERT INTO quizzes (course_id, title, description, passing_score, time_limit_minutes, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
          [courseId, `Quiz Final - Cours ${courseId}`, 'Quiz de validation du cours', 70, 30]
        );
        quizId = qRes.insertId;
        
        // Questions du quiz
        for (let q = 1; q <= 5; q++) {
          await conn.execute(
            `INSERT INTO quiz_questions (quiz_id, question_text, question_type, points, order_index, created_at)
             VALUES (?, ?, 'multiple_choice', 20, ?, NOW())`,
            [quizId, `Question ${q} du quiz`, q]
          );
        }
      }
      
      // Tentatives de quiz par étudiants inscrits
      const [enrollments] = await conn.execute(
        'SELECT user_id FROM enrollments WHERE course_id = ? LIMIT 5',
        [courseId]
      );
      for (const enr of enrollments) {
        const score = Math.floor(Math.random() * 40) + 50; // 50-90%
        const isPassed = score >= 70;
        await conn.execute(
          `INSERT INTO quiz_attempts (user_id, quiz_id, course_id, percentage, is_passed, started_at, completed_at)
           VALUES (?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))
           ON DUPLICATE KEY UPDATE percentage = VALUES(percentage)`,
          [enr.user_id, quizId, courseId, score, isPassed ? 1 : 0, Math.floor(Math.random() * 30), Math.floor(Math.random() * 30)]
        );
      }
    }

    console.log(`✔ Dashboard seed terminé !`);
    console.log(`  - ${courseIds.length} cours créés (${publishedCourseIds.length} publiés)`);
    console.log(`  - ${studentIds.length} étudiants`);
    console.log(`  - Enrollments répartis sur 6 mois`);
    console.log(`  - Progressions et quiz générés`);
  });
}

seed()
  .then(() => {
    console.log('✅ Seed dashboard réussi !');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erreur seed:', err.message);
    console.error(err.stack);
    process.exit(1);
  });

