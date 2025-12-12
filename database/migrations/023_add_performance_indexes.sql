-- Migration 023: Ajout d'index pour optimiser les performances des requêtes
-- Date: 2025-01-12
-- Description: Ajout d'index sur les colonnes fréquemment utilisées dans les jointures
-- pour améliorer les performances de getCourseProgress et getUserEvaluations

-- Index pour optimiser les requêtes de progression des cours
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_course ON lesson_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_user ON lesson_progress(lesson_id, user_id);
CREATE INDEX IF NOT EXISTS idx_progress_enrollment_lesson ON progress(enrollment_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_progress_enrollment_status ON progress(enrollment_id, status);
CREATE INDEX IF NOT EXISTS idx_media_files_course_lesson ON media_files(course_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_module_quiz ON quiz_questions(module_quiz_id, is_active);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_course_eval ON quiz_questions(course_evaluation_id, is_active);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question ON quiz_answers(question_id, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON quiz_attempts(user_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_enrollment_module ON quiz_attempts(enrollment_id, module_quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_enrollment_course_eval ON quiz_attempts(enrollment_id, course_evaluation_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed ON quiz_attempts(user_id, completed_at);

-- Index pour optimiser les requêtes d'évaluations
CREATE INDEX IF NOT EXISTS idx_lessons_module_published ON lessons(module_id, is_published);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_active ON enrollments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_active ON enrollments(course_id, is_active);

-- Index composites pour les requêtes complexes
CREATE INDEX IF NOT EXISTS idx_lessons_course_published_order ON lessons(course_id, is_published, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_completed ON quiz_attempts(user_id, completed_at, module_quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_course_eval_completed ON quiz_attempts(user_id, course_evaluation_id, completed_at);

