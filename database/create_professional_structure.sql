-- Structure professionnelle pour MdSC MOOC
-- Domaine > Module > Cours > Séquences > Contenus

-- 1. DOMAINES (Secteurs professionnels)
CREATE TABLE IF NOT EXISTS domains (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    color VARCHAR(7) DEFAULT '#007bff',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. MODULES (Regroupement de cours)
CREATE TABLE IF NOT EXISTS modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    domain_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    thumbnail_url VARCHAR(500),
    duration_hours INT DEFAULT 0,
    difficulty ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
    language VARCHAR(10) DEFAULT 'fr',
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'EUR',
    max_students INT,
    enrollment_deadline DATETIME,
    module_start_date DATETIME,
    module_end_date DATETIME,
    certification_required BOOLEAN DEFAULT TRUE,
    certification_criteria TEXT, -- Critères pour obtenir la certification
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

-- 3. SÉQUENCES (Structure du contenu des cours)
CREATE TABLE IF NOT EXISTS sequences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    sequence_order INT NOT NULL,
    estimated_duration_minutes INT DEFAULT 0,
    has_mini_control BOOLEAN DEFAULT FALSE,
    mini_control_points INT DEFAULT 0, -- Points pour réussir le mini-contrôle
    is_required BOOLEAN DEFAULT TRUE, -- Séquences obligatoires
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_course_sequence_order (course_id, sequence_order)
);

-- 4. CONTENUS (PDF, Vidéos, Live)
CREATE TABLE IF NOT EXISTS contents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sequence_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type ENUM('pdf', 'video', 'live', 'text', 'quiz', 'exercise') NOT NULL,
    content_url VARCHAR(500), -- URL du fichier ou lien
    file_path VARCHAR(500), -- Chemin local du fichier
    file_size_bytes INT,
    mime_type VARCHAR(100),
    duration_minutes INT DEFAULT 0,
    content_order INT NOT NULL,
    is_downloadable BOOLEAN DEFAULT TRUE,
    is_required BOOLEAN DEFAULT TRUE,
    access_level ENUM('free', 'premium', 'certified') DEFAULT 'free',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
    UNIQUE KEY unique_sequence_content_order (sequence_id, content_order)
);

-- 5. MINI-CONTRÔLES (Quiz de séquences)
CREATE TABLE IF NOT EXISTS mini_controls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sequence_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    question_type ENUM('multiple_choice', 'true_false', 'text', 'file_upload') DEFAULT 'multiple_choice',
    questions JSON NOT NULL, -- Structure des questions
    passing_score INT DEFAULT 70, -- Score minimum pour réussir (%)
    max_attempts INT DEFAULT 3,
    time_limit_minutes INT DEFAULT 30,
    points_awarded INT DEFAULT 10,
    badge_id INT, -- Badge à attribuer si réussi
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE SET NULL
);

-- 6. RÉSULTATS DES MINI-CONTRÔLES
CREATE TABLE IF NOT EXISTS mini_control_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    mini_control_id INT NOT NULL,
    attempt_number INT NOT NULL,
    score INT NOT NULL,
    max_score INT NOT NULL,
    answers JSON NOT NULL, -- Réponses de l'utilisateur
    time_spent_minutes INT DEFAULT 0,
    is_passed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (mini_control_id) REFERENCES mini_controls(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_control_attempt (user_id, mini_control_id, attempt_number)
);

-- 7. ÉVALUATIONS DE MODULE (Certifications)
CREATE TABLE IF NOT EXISTS module_evaluations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    evaluation_type ENUM('exam', 'project', 'portfolio', 'practical') DEFAULT 'exam',
    questions JSON NOT NULL,
    passing_score INT DEFAULT 70,
    max_attempts INT DEFAULT 2,
    time_limit_minutes INT DEFAULT 120,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- 8. RÉSULTATS DES ÉVALUATIONS DE MODULE
CREATE TABLE IF NOT EXISTS module_evaluation_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_evaluation_id INT NOT NULL,
    attempt_number INT NOT NULL,
    score INT NOT NULL,
    max_score INT NOT NULL,
    answers JSON NOT NULL,
    time_spent_minutes INT DEFAULT 0,
    is_passed BOOLEAN DEFAULT FALSE,
    certified_at TIMESTAMP NULL,
    certificate_url VARCHAR(500),
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (module_evaluation_id) REFERENCES module_evaluations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_evaluation_attempt (user_id, module_evaluation_id, attempt_number)
);

-- 9. INSCRIPTIONS AUX MODULES
CREATE TABLE IF NOT EXISTS module_enrollments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    completed_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_module_enrollment (user_id, module_id)
);

-- 10. PROGRESSION DES SÉQUENCES
CREATE TABLE IF NOT EXISTS sequence_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sequence_id INT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    progress_percentage DECIMAL(5,2) DEFAULT 0.00,
    time_spent_minutes INT DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_sequence_progress (user_id, sequence_id)
);

-- Modification de la table courses pour intégrer les modules
ALTER TABLE courses 
ADD COLUMN module_id INT,
ADD FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL;

-- Modification de la table categories pour intégrer les domaines
ALTER TABLE categories 
ADD COLUMN domain_id INT,
ADD FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL;

-- Index pour optimiser les performances
CREATE INDEX idx_modules_domain ON modules(domain_id);
CREATE INDEX idx_sequences_course ON sequences(course_id);
CREATE INDEX idx_contents_sequence ON contents(sequence_id);
CREATE INDEX idx_mini_controls_sequence ON mini_controls(sequence_id);
CREATE INDEX idx_module_evaluations_module ON module_evaluations(module_id);
CREATE INDEX idx_courses_module ON courses(module_id);
CREATE INDEX idx_categories_domain ON categories(domain_id);
