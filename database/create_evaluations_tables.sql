-- Tables pour les évaluations et devoirs

-- Table des évaluations
CREATE TABLE IF NOT EXISTS evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('quiz', 'assignment', 'exam', 'project') DEFAULT 'quiz',
    course_id INT NOT NULL,
    instructor_id INT NOT NULL,
    due_date DATETIME,
    max_score INT DEFAULT 100,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_course (course_id),
    INDEX idx_instructor (instructor_id),
    INDEX idx_due_date (due_date)
);

-- Table des soumissions d'évaluations par les utilisateurs
CREATE TABLE IF NOT EXISTS user_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluation_id INT NOT NULL,
    user_id INT NOT NULL,
    answers JSON,
    score DECIMAL(5,2),
    status ENUM('not_started', 'in_progress', 'submitted', 'graded') DEFAULT 'not_started',
    feedback TEXT,
    submitted_at TIMESTAMP NULL,
    graded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (evaluation_id) REFERENCES evaluations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_evaluation (evaluation_id, user_id),
    INDEX idx_evaluation (evaluation_id),
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);

-- Insérer quelques évaluations d'exemple
INSERT IGNORE INTO evaluations (title, description, type, course_id, instructor_id, due_date, max_score, is_published) VALUES
('Quiz Introduction', 'Quiz sur les concepts de base', 'quiz', 1, 11, DATE_ADD(NOW(), INTERVAL 7 DAY), 20, TRUE),
('Devoir Pratique', 'Exercice pratique à réaliser', 'assignment', 1, 11, DATE_ADD(NOW(), INTERVAL 14 DAY), 50, TRUE),
('Examen Final', 'Examen de fin de cours', 'exam', 1, 11, DATE_ADD(NOW(), INTERVAL 30 DAY), 100, TRUE),
('Projet Final', 'Projet de fin de formation', 'project', 1, 11, DATE_ADD(NOW(), INTERVAL 45 DAY), 80, TRUE);
