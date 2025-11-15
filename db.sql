-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost
-- Généré le : jeu. 13 nov. 2025 à 19:00
-- Version du serveur : 10.11.13-MariaDB-0ubuntu0.24.04.1
-- Version de PHP : 8.4.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `mdsc_auth`
--

-- --------------------------------------------------------

--
-- Structure de la table `admin_2fa_codes`
--

CREATE TABLE `admin_2fa_codes` (
  `id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `code` varchar(6) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `admin_2fa_codes`
--

INSERT INTO `admin_2fa_codes` (`id`, `admin_id`, `code`, `expires_at`, `used`, `created_at`) VALUES
(1, 65, '766826', '2025-11-06 13:36:33', 0, '2025-11-06 12:26:33'),
(2, 65, '945146', '2025-11-06 13:43:39', 0, '2025-11-06 12:33:39'),
(3, 65, '191051', '2025-11-06 13:46:24', 0, '2025-11-06 12:36:24'),
(4, 65, '168665', '2025-11-06 13:49:07', 0, '2025-11-06 12:39:07'),
(5, 65, '126740', '2025-11-06 13:55:49', 0, '2025-11-06 12:45:49'),
(6, 65, '702353', '2025-11-06 13:59:07', 0, '2025-11-06 12:49:07'),
(7, 65, '185694', '2025-11-06 14:02:14', 0, '2025-11-06 12:52:14'),
(8, 65, '489244', '2025-11-06 14:06:20', 1, '2025-11-06 12:56:20'),
(9, 65, '429441', '2025-11-06 15:18:45', 1, '2025-11-06 14:08:45'),
(10, 65, '788358', '2025-11-06 15:55:49', 1, '2025-11-06 14:45:49'),
(11, 65, '681348', '2025-11-06 16:30:33', 1, '2025-11-06 15:20:33'),
(12, 65, '696028', '2025-11-06 17:32:58', 1, '2025-11-06 16:22:58'),
(13, 65, '785542', '2025-11-06 17:34:10', 1, '2025-11-06 16:24:10'),
(14, 69, '178481', '2025-11-06 18:29:30', 1, '2025-11-06 17:19:30'),
(15, 69, '426206', '2025-11-09 13:45:37', 1, '2025-11-09 12:35:37');

-- --------------------------------------------------------

--
-- Structure de la table `admin_login_logs`
--

CREATE TABLE `admin_login_logs` (
  `id` int(11) NOT NULL,
  `admin_id` int(11) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `success` tinyint(1) DEFAULT 0,
  `failure_reason` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `admin_login_logs`
--

INSERT INTO `admin_login_logs` (`id`, `admin_id`, `ip_address`, `user_agent`, `success`, `failure_reason`, `created_at`) VALUES
(1, 65, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', 1, NULL, '2025-11-06 12:26:33'),
(2, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 12:33:39'),
(3, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 12:36:24'),
(4, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 12:39:07'),
(5, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 12:45:49'),
(6, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 12:49:07'),
(7, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 12:52:14'),
(8, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 12:56:20'),
(9, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 14:08:45'),
(10, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 14:45:49'),
(11, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 15:20:34'),
(12, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 16:22:58'),
(13, 65, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 16:24:10'),
(14, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 0, 'Email non autorisé pour accès admin', '2025-11-06 17:00:48'),
(15, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 0, 'Email non autorisé pour accès admin', '2025-11-06 17:00:53'),
(16, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 0, 'Email non autorisé pour accès admin', '2025-11-06 17:01:12'),
(17, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 0, 'Email non autorisé pour accès admin', '2025-11-06 17:04:44'),
(18, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 0, 'Email non autorisé pour accès admin', '2025-11-06 17:08:21'),
(19, NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 0, 'Email non autorisé pour accès admin', '2025-11-06 17:11:08'),
(20, 69, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0', 1, NULL, '2025-11-06 17:19:33'),
(21, 69, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', 1, NULL, '2025-11-09 12:35:40');

-- --------------------------------------------------------

--
-- Structure de la table `admin_sessions`
--

CREATE TABLE `admin_sessions` (
  `id` int(11) NOT NULL,
  `admin_id` int(11) NOT NULL,
  `session_token` varchar(255) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `ai_conversations`
--

CREATE TABLE `ai_conversations` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `context` varchar(50) DEFAULT 'general',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `ai_messages`
--

CREATE TABLE `ai_messages` (
  `id` int(11) NOT NULL,
  `conversation_id` int(11) NOT NULL,
  `role` enum('user','assistant','system') NOT NULL,
  `content` longtext NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `badges`
--

CREATE TABLE `badges` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `icon` varchar(50) NOT NULL,
  `color` varchar(7) DEFAULT '#007bff',
  `points_required` int(11) DEFAULT 0,
  `criteria` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`criteria`)),
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `icon_url` varchar(500) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `badges`
--

INSERT INTO `badges` (`id`, `name`, `description`, `icon`, `color`, `points_required`, `criteria`, `is_active`, `created_at`, `icon_url`, `category`, `updated_at`) VALUES
(1, 'Premier Pas', 'Première connexion sur la plateforme', '', '#007bff', 0, '{\"type\": \"profile_completion\", \"completed\": true}', 1, '2025-10-30 14:10:28', NULL, 'general', '2025-11-03 13:26:40'),
(2, 'Étudiant Assidu', 'Compléter 5 cours', '', '#007bff', 0, '{\"type\": \"pages_visited\", \"count\": 3}', 1, '2025-10-30 14:10:28', NULL, 'general', '2025-11-03 13:25:08'),
(3, 'Expert', 'Compléter 10 cours', '', '#007bff', 0, '{\"action\": \"course_completed\", \"count\": 1}', 1, '2025-10-30 14:10:28', NULL, 'courses', '2025-11-12 10:39:00'),
(4, 'Marathonien', 'Étudier 7 jours consécutifs', '', '#007bff', 0, '{\"type\": \"courses_completed\", \"count\": 5}', 1, '2025-10-30 14:10:28', NULL, 'courses', '2025-11-03 13:25:08');

-- --------------------------------------------------------

--
-- Structure de la table `categories`
--

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `color` varchar(7) DEFAULT '#007bff',
  `icon` varchar(50) DEFAULT 'book',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `categories`
--

INSERT INTO `categories` (`id`, `name`, `description`, `color`, `icon`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Développement Web', 'Cours de programmation web et frameworks modernes', '#007bff', 'code', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(2, 'Gestion de Projet', 'Formation en management et méthodologies de projet', '#28a745', 'project', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(3, 'Marketing Digital', 'Stratégies marketing et réseaux sociaux', '#ffc107', 'megaphone', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(4, 'Entrepreneuriat', 'Création et gestion d\'entreprise', '#dc3545', 'briefcase', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(5, 'Compétences Transversales', 'Soft skills et développement personnel', '#6f42c1', 'users', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(6, 'Éducation', 'Cours de formation et d\'éducation pour la société civile', '#3498db', 'book', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(7, 'Gouvernance', 'Formation en gouvernance et leadership', '#2ecc71', 'shield', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(8, 'Environnement', 'Cours sur l\'environnement et le développement durable', '#1abc9c', 'leaf', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(9, 'Économie', 'Formation économique et financière', '#f39c12', 'dollar', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(10, 'Santé', 'Cours sur la santé publique et le bien-être', '#e74c3c', 'heart', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(11, 'Design', 'Formation en design graphique et UI/UX', '#9b59b6', 'palette', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(12, 'Communication', 'Cours de communication et médias', '#16a085', 'megaphone', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(13, 'Leadership', 'Développement des compétences en leadership', '#c0392b', 'users', 1, '2025-11-03 13:30:22', '2025-11-03 13:30:22'),
(15, 'Éducation', NULL, '#3B82F6', 'book', 1, '2025-11-13 11:47:17', '2025-11-13 11:47:17'),
(16, 'Gouvernance', NULL, '#10B981', 'book', 1, '2025-11-13 11:47:17', '2025-11-13 11:47:17'),
(17, 'Environnement', NULL, '#F59E0B', 'book', 1, '2025-11-13 11:47:17', '2025-11-13 11:47:17'),
(18, 'Économie', NULL, '#EF4444', 'book', 1, '2025-11-13 11:47:17', '2025-11-13 11:47:17'),
(19, 'Santé', NULL, '#8B5CF6', 'book', 1, '2025-11-13 11:47:17', '2025-11-13 11:47:17');

-- --------------------------------------------------------

--
-- Structure de la table `certificates`
--

CREATE TABLE `certificates` (
  `id` int(11) NOT NULL,
  `request_id` int(11) DEFAULT NULL,
  `certificate_code` varchar(100) NOT NULL COMMENT 'Pour QR code',
  `user_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `certificate_number` varchar(50) DEFAULT NULL COMMENT 'Num├®ro format├® pour affichage',
  `issued_at` timestamp NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL COMMENT 'Validit├® optionnelle',
  `verified` tinyint(1) DEFAULT 0,
  `pdf_url` varchar(500) DEFAULT NULL,
  `qr_code_url` varchar(500) DEFAULT NULL,
  `is_valid` tinyint(1) DEFAULT 1,
  `revoked_at` datetime DEFAULT NULL,
  `revoked_reason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `certificate_requests`
--

CREATE TABLE `certificate_requests` (
  `id` int(11) NOT NULL,
  `enrollment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected','issued') DEFAULT 'pending',
  `user_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`user_info`)),
  `rejection_reason` text DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `issued_at` timestamp NULL DEFAULT NULL,
  `certificate_number` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `courses`
--

CREATE TABLE `courses` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `short_description` varchar(500) DEFAULT NULL,
  `instructor_id` int(11) NOT NULL,
  `prerequisite_course_id` int(11) DEFAULT NULL,
  `category_id` int(11) DEFAULT NULL,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `video_url` varchar(500) DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT 0,
  `difficulty` enum('beginner','intermediate','advanced') DEFAULT 'beginner',
  `language` varchar(10) DEFAULT 'fr',
  `is_published` tinyint(1) DEFAULT 0,
  `is_featured` tinyint(1) DEFAULT 0,
  `price` decimal(10,2) DEFAULT 0.00,
  `currency` varchar(3) DEFAULT 'XOF',
  `max_students` int(11) DEFAULT NULL,
  `enrollment_deadline` datetime DEFAULT NULL,
  `course_start_date` datetime DEFAULT NULL,
  `course_end_date` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `status` enum('draft','pending_approval','approved','rejected','published') DEFAULT 'draft',
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `evaluation_id` int(11) DEFAULT NULL,
  `course_type` enum('live','on_demand') DEFAULT 'on_demand',
  `is_sequential` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `courses`
--

INSERT INTO `courses` (`id`, `title`, `slug`, `description`, `short_description`, `instructor_id`, `prerequisite_course_id`, `category_id`, `thumbnail_url`, `video_url`, `duration_minutes`, `difficulty`, `language`, `is_published`, `is_featured`, `price`, `currency`, `max_students`, `enrollment_deadline`, `course_start_date`, `course_end_date`, `created_at`, `updated_at`, `status`, `approved_by`, `approved_at`, `rejection_reason`, `evaluation_id`, `course_type`, `is_sequential`) VALUES
(31, 'JavaScript Avancé', 'javascript-avancé-1761896093', 'Description complète pour JavaScript Avancé', 'Court résumé JavaScript Avancé', 1, NULL, 1, NULL, NULL, 180, 'intermediate', 'fr', 1, 0, 0.00, 'XOF', 0, NULL, NULL, NULL, '2025-06-04 07:34:53', '2025-11-13 10:48:45', 'published', NULL, NULL, NULL, NULL, 'on_demand', 0),
(32, 'React & Redux', 'react-&-redux-1761896093', 'Description complète pour React & Redux', 'Court résumé React & Redux', 1, 31, 1, NULL, NULL, 240, 'intermediate', 'fr', 1, 0, 0.00, 'XOF', 0, NULL, NULL, NULL, '2025-08-19 07:34:53', '2025-11-13 10:48:49', 'published', NULL, NULL, NULL, NULL, 'on_demand', 0),
(33, 'Node.js Backend', 'node.js-backend-1761896093', 'Description complète pour Node.js Backend', 'Court résumé Node.js Backend', 1, 32, 1, NULL, NULL, 200, 'intermediate', 'fr', 1, 0, 0.00, 'XOF', 0, NULL, NULL, NULL, '2025-06-21 07:34:53', '2025-11-13 10:48:52', 'published', NULL, NULL, NULL, NULL, 'on_demand', 0),
(34, 'UI/UX Design Fundamentals', 'ui/ux-design-fundamentals-1761896093', 'Description complète pour UI/UX Design Fundamentals', 'Court résumé UI/UX Design Fundamentals', 1, NULL, 11, NULL, NULL, 150, 'intermediate', 'fr', 1, 0, 0.00, 'XOF', 0, NULL, NULL, NULL, '2025-10-27 07:34:53', '2025-11-13 10:49:04', 'published', NULL, NULL, NULL, NULL, 'on_demand', 0),
(35, 'Marketing Digital', 'marketing-digital-1761896093', 'Description complète pour Marketing Digital', 'Court résumé Marketing Digital', 1, NULL, 3, NULL, NULL, 120, 'intermediate', 'fr', 1, 0, 0.00, 'XOF', 0, NULL, NULL, NULL, '2025-08-08 07:34:53', '2025-11-13 10:49:07', 'published', NULL, NULL, NULL, NULL, 'on_demand', 0),
(36, 'Cours en brouillon', 'cours-en-brouillon-1761896093', 'Description complète pour Cours en brouillon', 'Court résumé Cours en brouillon', 1, 34, 11, NULL, NULL, 90, 'intermediate', 'fr', 1, 0, 0.00, 'XOF', 0, NULL, NULL, NULL, '2025-10-13 07:34:53', '2025-11-13 10:22:56', 'published', 75, '2025-11-13 10:22:56', NULL, NULL, 'on_demand', 0),
(40, 'La gestion des ressources humaines (GRH)', 'la-gestion-des-ressources-humaines-(grh)-1762422073', 'La gestion des ressources humaines (GRH) est l\'ensemble des pratiques visant à organiser, administrer et développer le capital humain d\'une entreprise pour aligner ses objectifs avec les besoins en personnel. Elle comprend des activités telles que le recrutement, la formation, la gestion des carrières, la paie, et l\'administration du personnel, avec pour but de maximiser le potentiel des collaborateurs, d\'améliorer les performances et de garantir la conformité avec le droit du travail.', 'La gestion des ressources humaines (GRH) est l\'ensemble des pratiques visant à organiser, administrer et développer le capital humain d\'une entreprise pour aligner ses objectifs avec les besoins en personnel.', 1, NULL, 2, 'http://localhost:5000/uploads/courses/thumbnails/1-1762422061717-745346013.jpg', '', 180, 'intermediate', 'fr', 1, 0, 1000.00, 'XOF', NULL, NULL, NULL, NULL, '2025-11-06 09:41:13', '2025-11-11 11:50:40', 'published', 65, '2025-11-06 15:21:12', NULL, 1, 'on_demand', 1),
(41, 'Gestion des projets', 'gestion-des-projets-1762445520', 'La gestion de projet est l\'ensemble des activités de planification, coordination et maîtrise nécessaires pour mener un projet de sa conception à sa réalisation finale afin d\'atteindre des objectifs spécifiques', 'La gestion de projet est l\'ensemble des activités de planification, coordination', 1, NULL, 2, 'http://localhost:5000/uploads/courses/thumbnails/1-1762445474822-406054846.jpg', '', 100, 'intermediate', 'fr', 1, 0, 0.00, 'XOF', NULL, NULL, NULL, NULL, '2025-11-06 16:12:00', '2025-11-13 10:48:56', 'published', 65, '2025-11-06 16:26:19', NULL, 2, 'on_demand', 1),
(42, 'Parcours Gestion du Temps', 'parcours-gestion-temps', 'Programme complet pour améliorer la gestion du temps, organiser ses priorités et suivre ses progrès.', 'Maîtrisez votre agenda en 3 modules', 1, NULL, 5, '/uploads/courses/thumbnails/gestion-temps.jpg', NULL, 360, 'intermediate', 'fr', 1, 0, 0.00, 'XOF', NULL, NULL, NULL, NULL, '2025-11-11 08:12:24', '2025-11-11 11:50:40', 'published', NULL, NULL, NULL, NULL, 'on_demand', 1),
(43, 'Introduction à la Gestion de Projet - Formation Gratuite', 'introduction-gestion-projet-gratuite-1762941763220', 'Cette formation gratuite vous initie aux fondamentaux de la gestion de projet. Vous apprendrez à planifier, organiser et suivre un projet de A à Z. Cette formation est idéale pour les débutants qui souhaitent acquérir les compétences essentielles en gestion de projet.', 'Formation gratuite complète sur les bases de la gestion de projet : planification, organisation et suivi.', 1, NULL, 5, NULL, NULL, 180, 'beginner', 'fr', 1, 1, 0.00, 'XOF', NULL, NULL, '2025-11-12 11:02:43', NULL, '2025-11-12 10:02:43', '2025-11-12 10:17:35', 'draft', NULL, NULL, NULL, NULL, 'on_demand', 0),
(44, 'Communication Efficace - Formation Gratuite', 'communication-efficace-gratuite-1762941763270', 'Apprenez les techniques de communication efficaces pour améliorer vos relations professionnelles et personnelles. Cette formation gratuite couvre l\'écoute active, la communication non verbale et la gestion des conflits.', 'Formation gratuite complète sur les techniques de communication efficace en milieu professionnel.', 1, NULL, 12, NULL, NULL, 150, 'beginner', 'fr', 1, 1, 0.00, 'XOF', NULL, NULL, '2025-11-12 11:02:43', NULL, '2025-11-12 10:02:43', '2025-11-12 10:17:35', 'draft', NULL, NULL, NULL, NULL, 'on_demand', 0),
(45, 'Gestion du Temps et Productivité - Formation Gratuite', 'gestion-temps-productivite-gratuite-1762941763290', 'Découvrez les méthodes et outils pour mieux gérer votre temps et augmenter votre productivité. Cette formation gratuite vous apprendra à prioriser, planifier et optimiser votre organisation quotidienne.', 'Formation gratuite complète sur la gestion du temps et l\'amélioration de la productivité.', 1, NULL, 5, NULL, NULL, 120, 'beginner', 'fr', 1, 1, 0.00, 'XOF', NULL, NULL, '2025-11-12 11:02:43', NULL, '2025-11-12 10:02:43', '2025-11-12 10:17:35', 'draft', NULL, NULL, NULL, NULL, 'on_demand', 0),
(46, 'Marketing Google Afs', 'marketing-google-afs-1763027294', 'Cette formation vous plonge dans l’univers du référencement payant (SEA) et vous apprend à concevoir, piloter et optimiser des campagnes Google Ads performantes. Vous découvrirez comment transformer un simple clic en véritable opportunité commerciale.', 'Ce cours vous apprend le marketing digital !', 75, NULL, 3, 'http://localhost:5000/api/uploads/courses/thumbnails/75-1763026919568-697364408.jpg', 'http://localhost:5000/api/uploads/courses/videos/75-1763027240435-188226035.mp4', 50, 'intermediate', 'fr', 1, 1, 0.00, 'XOF', NULL, NULL, NULL, NULL, '2025-11-13 09:48:14', '2025-11-13 10:21:42', 'published', 75, '2025-11-13 10:21:42', NULL, NULL, 'on_demand', 1),
(47, 'Formation Complète : Développement Web Full-Stack', 'formation-complète-:-développement-web-full-stack-1763031035', 'Une formation complète et moderne pour maîtriser le développement web full-stack.\n  \nCette formation couvre tous les aspects du développement web moderne, de la conception à la mise en production.\nVous apprendrez les technologies les plus demandées sur le marché : HTML5, CSS3, JavaScript, React, Node.js, et bien plus encore.\n\nObjectifs de la formation :\n- Maîtriser les fondamentaux du développement web\n- Créer des applications web modernes et responsives\n- Développer des API RESTful robustes\n- Gérer des bases de données\n- Déployer des applications en production', 'Formation complète en développement web full-stack avec projets pratiques', 75, NULL, 1, NULL, NULL, 1200, 'intermediate', 'fr', 1, 0, 0.00, 'EUR', NULL, NULL, NULL, NULL, '2025-11-13 10:50:35', '2025-11-13 10:55:13', 'published', 75, '2025-11-13 10:54:45', NULL, NULL, 'on_demand', 1);

--
-- Déclencheurs `courses`
--
DELIMITER $$
CREATE TRIGGER `generate_course_slug` BEFORE INSERT ON `courses` FOR EACH ROW BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    SET NEW.slug = LOWER(REPLACE(REPLACE(REPLACE(NEW.title, ' ', '-'), 'é', 'e'), 'è', 'e'));
  END IF;
END$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `course_analytics`
--

CREATE TABLE `course_analytics` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `total_enrollments` int(11) DEFAULT 0,
  `completion_rate` decimal(5,2) DEFAULT 0.00,
  `average_rating` decimal(3,2) DEFAULT 0.00,
  `total_views` int(11) DEFAULT 0,
  `total_enrollments_30d` int(11) DEFAULT 0,
  `total_views_30d` int(11) DEFAULT 0,
  `total_revenue_30d` decimal(12,2) DEFAULT 0.00,
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `course_approvals`
--

CREATE TABLE `course_approvals` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `admin_id` int(11) DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `rejection_reason` text DEFAULT NULL,
  `comments` text DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `course_approvals`
--

INSERT INTO `course_approvals` (`id`, `course_id`, `admin_id`, `status`, `rejection_reason`, `comments`, `reviewed_at`, `created_at`, `updated_at`) VALUES
(1, 41, 65, 'approved', NULL, '', '2025-11-06 16:26:19', '2025-11-06 16:20:31', '2025-11-06 16:26:19'),
(3, 45, 69, 'approved', NULL, 'Je vous sugere', '2025-11-13 15:26:42', '2025-11-13 15:22:33', '2025-11-13 15:26:42');

-- --------------------------------------------------------

--
-- Structure de la table `course_evaluations`
--

CREATE TABLE `course_evaluations` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `passing_score` int(11) DEFAULT 70,
  `duration_minutes` int(11) DEFAULT NULL,
  `max_attempts` int(11) DEFAULT 3,
  `is_published` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `course_evaluations`
--

INSERT INTO `course_evaluations` (`id`, `course_id`, `title`, `description`, `passing_score`, `duration_minutes`, `max_attempts`, `is_published`, `created_at`, `updated_at`) VALUES
(1, 40, 'Évaluation finale', 'La gestion des ressources humaines (GRH) est l\'ensemble des pratiques visant à organiser, administrer et développer le capital humain d\'une entreprise pour aligner ses objectifs avec les besoins en personnel.', 100, 10, 3, 1, '2025-11-06 10:46:47', '2025-11-06 11:30:23'),
(2, 41, 'Évaluation finale', 'La gestion de projet ', 100, 10, 3, 1, '2025-11-06 16:19:32', '2025-11-06 16:19:32'),
(4, 45, 'Évaluation finale', NULL, 70, NULL, 3, 1, '2025-11-13 15:22:15', '2025-11-13 15:22:15');

-- --------------------------------------------------------

--
-- Structure de la table `course_favorites`
--

CREATE TABLE `course_favorites` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `course_reviews`
--

CREATE TABLE `course_reviews` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `rating` int(11) NOT NULL CHECK (`rating` >= 1 and `rating` <= 5),
  `comment` text DEFAULT NULL,
  `is_approved` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `email_verification_tokens`
--

CREATE TABLE `email_verification_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `enrollments`
--

CREATE TABLE `enrollments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `status` enum('enrolled','in_progress','completed','certified') DEFAULT 'enrolled',
  `enrolled_at` timestamp NULL DEFAULT current_timestamp(),
  `payment_id` int(11) DEFAULT NULL,
  `started_at` timestamp NULL DEFAULT NULL,
  `progress_percentage` decimal(5,2) DEFAULT 0.00,
  `completed_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `last_accessed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `enrollments`
--

INSERT INTO `enrollments` (`id`, `user_id`, `course_id`, `status`, `enrolled_at`, `payment_id`, `started_at`, `progress_percentage`, `completed_at`, `is_active`, `last_accessed_at`) VALUES
(177, 76, 47, 'in_progress', '2025-11-13 18:51:19', NULL, '2025-11-13 17:37:26', 18.00, NULL, 0, NULL),
(178, 76, 46, 'enrolled', '2025-11-13 18:56:53', NULL, NULL, 0.00, NULL, 0, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `evaluations`
--

CREATE TABLE `evaluations` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `type` enum('quiz','assignment','exam','project') DEFAULT 'quiz',
  `course_id` int(11) NOT NULL,
  `instructor_id` int(11) NOT NULL,
  `due_date` datetime DEFAULT NULL,
  `max_score` int(11) DEFAULT 100,
  `is_published` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `is_online` tinyint(1) DEFAULT 0,
  `course_id` int(11) DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `event_attendees`
--

CREATE TABLE `event_attendees` (
  `id` int(11) NOT NULL,
  `event_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `registered_at` timestamp NULL DEFAULT current_timestamp(),
  `status` enum('registered','attended','cancelled') DEFAULT 'registered'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `lessons`
--

CREATE TABLE `lessons` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `module_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `content_type` enum('video','text','quiz','h5p','forum','assignment','document','audio','presentation') DEFAULT 'text',
  `media_file_id` int(11) DEFAULT NULL,
  `content_url` varchar(500) DEFAULT NULL,
  `content_text` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `content` text DEFAULT NULL COMMENT 'Pour type text: contenu HTML/Markdown',
  `video_url` varchar(500) DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT 0,
  `order_index` int(11) NOT NULL DEFAULT 0,
  `is_required` tinyint(1) DEFAULT 1,
  `is_published` tinyint(1) DEFAULT 1,
  `is_optional` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `lessons`
--

INSERT INTO `lessons` (`id`, `course_id`, `module_id`, `title`, `content_type`, `media_file_id`, `content_url`, `content_text`, `description`, `content`, `video_url`, `duration_minutes`, `order_index`, `is_required`, `is_published`, `is_optional`, `created_at`, `updated_at`) VALUES
(271, 31, 106, 'Leçon 1.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(272, 31, 106, 'Leçon 1.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(273, 31, 106, 'Leçon 1.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(274, 31, 107, 'Leçon 2.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(275, 31, 107, 'Leçon 2.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(276, 31, 107, 'Leçon 2.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(277, 31, 108, 'Leçon 3.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(278, 31, 108, 'Leçon 3.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(279, 31, 109, 'Leçon 4.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(280, 31, 109, 'Leçon 4.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(281, 32, 110, 'Leçon 1.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(282, 32, 110, 'Leçon 1.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(283, 32, 110, 'Leçon 1.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(284, 32, 111, 'Leçon 2.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(285, 32, 111, 'Leçon 2.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(286, 32, 111, 'Leçon 2.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(287, 32, 112, 'Leçon 3.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(288, 32, 112, 'Leçon 3.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(289, 32, 113, 'Leçon 4.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(290, 32, 113, 'Leçon 4.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(291, 33, 114, 'Leçon 1.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(292, 33, 114, 'Leçon 1.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(293, 33, 114, 'Leçon 1.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(294, 33, 115, 'Leçon 2.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(295, 33, 115, 'Leçon 2.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(296, 33, 115, 'Leçon 2.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(297, 33, 116, 'Leçon 3.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(298, 33, 116, 'Leçon 3.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(299, 33, 117, 'Leçon 4.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(300, 33, 117, 'Leçon 4.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(301, 34, 118, 'Leçon 1.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(302, 34, 118, 'Leçon 1.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(303, 34, 118, 'Leçon 1.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(307, 34, 120, 'Leçon 3.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(308, 34, 120, 'Leçon 3.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(309, 35, 121, 'Leçon 1.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(310, 35, 121, 'Leçon 1.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(311, 35, 121, 'Leçon 1.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(312, 35, 122, 'Leçon 2.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(313, 35, 122, 'Leçon 2.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(314, 35, 122, 'Leçon 2.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(315, 35, 123, 'Leçon 3.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(316, 35, 123, 'Leçon 3.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(317, 36, 124, 'Leçon 1.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(318, 36, 124, 'Leçon 1.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(319, 36, 124, 'Leçon 1.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(320, 36, 125, 'Leçon 2.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(321, 36, 125, 'Leçon 2.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(322, 36, 125, 'Leçon 2.3', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 3, 1, 1, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(323, 36, 126, 'Leçon 3.1', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 1, 1, 1, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(324, 36, 126, 'Leçon 3.2', 'text', NULL, NULL, NULL, 'Contenu démo', 'Markdown démo', NULL, 0, 2, 1, 1, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(328, 40, 130, 'Introduction au cours', 'text', NULL, NULL, NULL, 'La gestion des ressources humaines (GRH) est l\'ensemble des pratiques visant à organiser, administrer et développer le capital humain d\'une entreprise pour aligner ses objectifs avec les besoins en personnel. Elle comprend des activités telles que le recrutement, la formation, la gestion des carrières, la paie, et l\'administration du personnel, avec pour but de maximiser le potentiel des collaborateurs, d\'améliorer les performances et de garantir la conformité avec le droit du travail. \n', NULL, NULL, 6, 1, 1, 1, 0, '2025-11-06 09:44:04', '2025-11-06 09:44:04'),
(329, 40, 131, 'Déroulement du cours', 'text', NULL, NULL, NULL, 'Elle comprend des activités telles que le recrutement, la formation, la gestion des carrières, la paie, et l\'administration du personnel, avec pour but de maximiser le potentiel des collaborateurs, d\'améliorer les performances et de garantir la conformité avec le droit du travail. \n', NULL, NULL, 10, 1, 1, 1, 0, '2025-11-06 09:47:47', '2025-11-06 09:47:47'),
(330, 41, 133, 'Introduction gestion projet', 'text', NULL, NULL, NULL, 'La gestion de projet est l\'ensemble des activités de planification, coordination et maîtrise nécessaires pour mener un projet de sa conception à sa réalisation finale afin d\'atteindre des objectifs spécifiques', NULL, NULL, 10, 1, 1, 1, 0, '2025-11-06 16:15:14', '2025-11-06 16:15:14'),
(331, 41, 133, 'Gestion de projet ', 'text', NULL, NULL, NULL, 'La gestion de projet est l\'ensemble des activités de planification, coordination et maîtrise nécessaires pour mener un projet de sa conception à sa réalisation finale afin d\'atteindre des objectifs spécifiques', NULL, NULL, 5, 2, 1, 1, 0, '2025-11-06 16:15:57', '2025-11-06 16:15:57'),
(332, 42, 134, 'Observer ses journées', 'text', NULL, NULL, 'Pendant trois jours, notez chaque activité et sa durée pour repérer les tendances.', 'Exercice pratique pour analyser sa semaine type.', NULL, NULL, 20, 1, 1, 1, 0, '2025-11-11 08:12:47', '2025-11-11 08:12:47'),
(333, 42, 134, 'Identifier les priorités', 'text', NULL, NULL, 'Classez vos tâches selon leur importance et urgence avec la matrice Eisenhower.', 'Outil simple pour distinguer l\'important du secondaire.', NULL, NULL, 25, 2, 1, 1, 0, '2025-11-11 08:12:47', '2025-11-11 08:12:47'),
(334, 42, 135, 'Construire un planning hebdomadaire', 'text', NULL, NULL, 'Élaborez un planning réaliste en répartissant vos priorités sur la semaine.', 'Méthode pas à pas pour planifier efficacement.', NULL, NULL, 30, 1, 1, 1, 0, '2025-11-11 08:12:55', '2025-11-11 08:12:55'),
(335, 42, 135, 'Gérer les imprévus', 'text', NULL, NULL, 'Définissez un temps tampon quotidien pour absorber imprévus et retards.', 'Conseils pour maintenir son plan malgré les aléas.', NULL, NULL, 20, 2, 1, 1, 0, '2025-11-11 08:12:55', '2025-11-11 08:12:55'),
(336, 42, 136, 'Mettre en place des routines', 'text', NULL, NULL, 'Identifiez les routines du matin et du soir qui soutiendront vos objectifs.', 'Construire des habitudes stables au quotidien.', NULL, NULL, 25, 1, 1, 1, 0, '2025-11-11 08:13:01', '2025-11-11 08:13:01'),
(337, 42, 136, 'Suivre ses progrès', 'text', NULL, NULL, 'Utilisez un tableau de bord hebdomadaire pour suivre vos engagements et ajuster.', 'Système de mesure pour rester aligné sur ses priorités.', NULL, NULL, 25, 2, 1, 1, 0, '2025-11-11 08:13:01', '2025-11-11 08:13:01'),
(338, 43, 137, 'Leçon 1.1: Qu\'est-ce que la gestion de projet ?', 'text', NULL, NULL, NULL, 'Introduction aux concepts de base de la gestion de projet.', '<h2>Qu\'est-ce que la gestion de projet ?</h2><p>La gestion de projet est une discipline qui consiste à organiser, planifier et contrôler les ressources pour atteindre des objectifs spécifiques dans un délai déterminé.</p>', NULL, 15, 1, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(339, 43, 137, 'Leçon 1.2: Les acteurs du projet', 'text', NULL, NULL, NULL, 'Découvrez les différents rôles et responsabilités dans un projet.', '<h2>Les acteurs du projet</h2><p>Un projet implique plusieurs acteurs, chacun avec des responsabilités spécifiques.</p>', NULL, 20, 2, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(340, 43, 137, 'Leçon 1.3: Le cycle de vie d\'un projet', 'text', NULL, NULL, NULL, 'Comprenez les différentes phases d\'un projet.', '<h2>Le cycle de vie d\'un projet</h2><p>Un projet suit généralement un cycle de vie en plusieurs phases.</p>', NULL, 25, 3, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(341, 43, 138, 'Leçon 2.1: Définir les objectifs du projet', 'text', NULL, NULL, NULL, 'Apprenez à formuler des objectifs SMART pour votre projet.', '<h2>Définir les objectifs du projet</h2><p>Les objectifs SMART sont spécifiques, mesurables, atteignables, réalistes et temporels.</p>', NULL, 20, 1, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(342, 43, 138, 'Leçon 2.2: La structure de découpage du projet (WBS)', 'text', NULL, NULL, NULL, 'Découvrez comment décomposer un projet en tâches gérables.', '<h2>La structure de découpage du projet (WBS)</h2><p>Le Work Breakdown Structure permet de décomposer un projet en éléments plus petits et gérables.</p>', NULL, 30, 2, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(343, 43, 138, 'Leçon 2.3: Planification des ressources', 'text', NULL, NULL, NULL, 'Apprenez à identifier et allouer les ressources nécessaires.', '<h2>Planification des ressources</h2><p>Les ressources d\'un projet incluent les ressources humaines, matérielles, financières et temporelles.</p>', NULL, 25, 3, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(344, 43, 139, 'Leçon 3.1: Le suivi de l\'avancement', 'text', NULL, NULL, NULL, 'Découvrez les outils et techniques pour suivre l\'avancement d\'un projet.', '<h2>Le suivi de l\'avancement</h2><p>Le suivi régulier permet de détecter les écarts et de prendre des mesures correctives.</p>', NULL, 20, 1, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(345, 43, 139, 'Leçon 3.2: Gestion des risques', 'text', NULL, NULL, NULL, 'Apprenez à identifier et gérer les risques d\'un projet.', '<h2>Gestion des risques</h2><p>La gestion des risques est essentielle pour la réussite d\'un projet.</p>', NULL, 30, 2, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(346, 43, 139, 'Leçon 3.3: Clôture du projet', 'text', NULL, NULL, NULL, 'Découvrez les étapes pour clôturer efficacement un projet.', '<h2>Clôture du projet</h2><p>La clôture est une phase cruciale qui permet de capitaliser sur l\'expérience.</p>', NULL, 20, 3, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(347, 44, 140, 'Leçon 1.1: L\'importance de la communication', 'text', NULL, NULL, NULL, 'Comprenez pourquoi la communication est essentielle.', '<h2>L\'importance de la communication</h2><p>La communication est au cœur de toutes les interactions humaines.</p>', NULL, 20, 1, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(348, 44, 140, 'Leçon 1.2: L\'écoute active', 'text', NULL, NULL, NULL, 'Apprenez les techniques d\'écoute active.', '<h2>L\'écoute active</h2><p>L\'écoute active consiste à porter attention au message et reformuler pour vérifier la compréhension.</p>', NULL, 25, 2, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(349, 44, 141, 'Leçon 2.1: Le langage du corps', 'text', NULL, NULL, NULL, 'Découvrez les signaux non verbaux.', '<h2>Le langage du corps</h2><p>Les éléments clés : posture, gestes, expressions faciales, contact visuel.</p>', NULL, 30, 1, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(350, 44, 141, 'Leçon 2.2: Cohérence verbale et non verbale', 'text', NULL, NULL, NULL, 'Assurez la cohérence entre vos mots et vos gestes.', '<h2>Cohérence verbale et non verbale</h2><p>Pour être crédible, vos paroles et vos gestes doivent être alignés.</p>', NULL, 25, 2, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(351, 45, 142, 'Leçon 1.1: Identifier vos voleurs de temps', 'text', NULL, NULL, NULL, 'Apprenez à reconnaître ce qui vous fait perdre du temps.', '<h2>Identifier vos voleurs de temps</h2><p>Les principaux voleurs de temps : interruptions, multitâche inefficace, manque de priorités, procrastination.</p>', NULL, 20, 1, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(352, 45, 142, 'Leçon 1.2: La matrice d\'Eisenhower', 'text', NULL, NULL, NULL, 'Utilisez la matrice d\'Eisenhower pour prioriser vos tâches.', '<h2>La matrice d\'Eisenhower</h2><p>Quatre quadrants : Urgent+Important, Important mais pas urgent, Urgent mais pas important, Ni urgent ni important.</p>', NULL, 25, 2, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(353, 45, 143, 'Leçon 2.1: La technique Pomodoro', 'text', NULL, NULL, NULL, 'Découvrez la méthode Pomodoro pour améliorer votre concentration.', '<h2>La technique Pomodoro</h2><p>Méthode en 4 étapes : travaillez 25 minutes, pause 5 minutes, répétez 4 fois, pause longue.</p>', NULL, 20, 1, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(354, 45, 143, 'Leçon 2.2: Planification quotidienne', 'text', NULL, NULL, NULL, 'Apprenez à planifier efficacement votre journée.', '<h2>Planification quotidienne</h2><p>Planifier la veille, commencer par les tâches importantes, prévoir des créneaux pour les imprévus.</p>', NULL, 25, 2, 1, 1, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(355, 46, 144, 'Principe du référencement payant vs organique', 'text', NULL, NULL, NULL, 'Principe du référencement payant vs organique', NULL, NULL, 30, 1, 1, 1, 0, '2025-11-13 09:53:06', '2025-11-13 09:53:06'),
(356, 46, 145, 'Vue d’ensemble de Google Ads : Search, Display, YouTube, Shopping.', 'text', NULL, NULL, NULL, 'Vue d’ensemble de Google Ads : Search, Display, YouTube, Shopping.', NULL, NULL, 10, 1, 1, 1, 0, '2025-11-13 09:56:04', '2025-11-13 09:56:04'),
(357, 46, 147, 'Présentation de l’interface et des indicateurs clés (CPC, CTR, Quality Score…).', 'text', NULL, NULL, NULL, 'Présentation de l’interface et des indicateurs clés (CPC, CTR, Quality Score…).', NULL, NULL, 49, 1, 1, 1, 0, '2025-11-13 09:57:16', '2025-11-13 09:57:16'),
(358, 46, 146, 'Fonctionnement du système d’enchères Google.', 'text', NULL, NULL, NULL, 'Fonctionnement du système d’enchères Google.', NULL, NULL, 90, 1, 1, 1, 0, '2025-11-13 09:58:16', '2025-11-13 09:58:16'),
(359, 47, 148, 'Introduction au Web', 'text', NULL, NULL, '<h1>Introduction au Développement Web</h1>\n\n<section>\n  <h2>🌐 Bienvenue dans le Monde du Web</h2>\n  <p>Bienvenue dans cette formation complète sur le développement web ! Avant de plonger dans les aspects techniques, il est essentiel de comprendre les fondements du World Wide Web, son histoire, son architecture et son fonctionnement.</p>\n  \n  <p>Le développement web est l\'un des domaines les plus dynamiques et en constante évolution de l\'informatique. Que vous souhaitiez créer des sites web, des applications web modernes, ou des plateformes complexes, cette formation vous donnera toutes les compétences nécessaires.</p>\n</section>\n\n<section>\n  <h2>📚 Qu\'est-ce que le World Wide Web ?</h2>\n  \n  <h3>Définition</h3>\n  <p>Le <strong>World Wide Web (WWW)</strong>, communément appelé \"le Web\", est un système d\'information basé sur l\'hypertexte accessible via Internet. Il a été inventé en 1989 par <strong>Tim Berners-Lee</strong>, un informaticien britannique travaillant au CERN (Organisation européenne pour la recherche nucléaire) à Genève.</p>\n  \n  <h3>Concepts Fondamentaux</h3>\n  <ul>\n    <li><strong>Internet vs Web</strong> : Internet est le réseau physique de connexions, tandis que le Web est un service qui fonctionne sur Internet</li>\n    <li><strong>Hypertexte</strong> : Système de liens permettant de naviguer entre différents documents</li>\n    <li><strong>URL (Uniform Resource Locator)</strong> : Adresse unique identifiant une ressource sur le Web</li>\n    <li><strong>HTTP/HTTPS</strong> : Protocoles de communication permettant le transfert de données</li>\n  </ul>\n</section>\n\n<section>\n  <h2>🏗️ Architecture Client-Serveur</h2>\n  \n  <p>Le Web fonctionne selon une architecture <strong>client-serveur</strong> :</p>\n  \n  <h3>Le Client (Navigateur)</h3>\n  <ul>\n    <li>Demande des ressources au serveur</li>\n    <li>Affiche les pages web à l\'utilisateur</li>\n    <li>Exécute le code JavaScript côté client</li>\n    <li>Exemples : Chrome, Firefox, Safari, Edge</li>\n  </ul>\n  \n  <h3>Le Serveur</h3>\n  <ul>\n    <li>Stocke les fichiers et données</li>\n    <li>Traite les requêtes HTTP</li>\n    <li>Exécute le code backend (PHP, Node.js, Python, etc.)</li>\n    <li>Gère les bases de données</li>\n  </ul>\n  \n  <h3>Le Processus de Communication</h3>\n  <ol>\n    <li>L\'utilisateur saisit une URL dans le navigateur</li>\n    <li>Le navigateur envoie une requête HTTP au serveur</li>\n    <li>Le serveur traite la requête et renvoie une réponse (HTML, CSS, JavaScript, images, etc.)</li>\n    <li>Le navigateur interprète et affiche le contenu</li>\n  </ol>\n</section>\n\n<section>\n  <h2>📖 Historique et Évolution du Web</h2>\n  \n  <h3>Web 1.0 (1990-2000) : Le Web Statique</h3>\n  <ul>\n    <li>Pages HTML statiques</li>\n    <li>Contenu en lecture seule</li>\n    <li>Peu d\'interactivité</li>\n    <li>Exemples : Sites vitrines, pages d\'information</li>\n  </ul>\n  \n  <h3>Web 2.0 (2000-2010) : Le Web Interactif</h3>\n  <ul>\n    <li>Contenu généré par les utilisateurs</li>\n    <li>Réseaux sociaux (Facebook, Twitter)</li>\n    <li>Applications web interactives</li>\n    <li>AJAX pour des mises à jour dynamiques</li>\n  </ul>\n  \n  <h3>Web 3.0 (2010-présent) : Le Web Moderne</h3>\n  <ul>\n    <li>Applications web complexes (SPA - Single Page Applications)</li>\n    <li>Mobile-first et responsive design</li>\n    <li>APIs RESTful et GraphQL</li>\n    <li>Cloud computing et microservices</li>\n    <li>Progressive Web Apps (PWA)</li>\n    <li>Intelligence artificielle et machine learning</li>\n  </ul>\n</section>\n\n<section>\n  <h2>🛠️ Technologies du Web</h2>\n  \n  <h3>Frontend (Côté Client)</h3>\n  <ul>\n    <li><strong>HTML (HyperText Markup Language)</strong> : Structure et contenu des pages</li>\n    <li><strong>CSS (Cascading Style Sheets)</strong> : Mise en forme et design</li>\n    <li><strong>JavaScript</strong> : Interactivité et logique côté client</li>\n    <li><strong>Frameworks modernes</strong> : React, Vue.js, Angular, Svelte</li>\n  </ul>\n  \n  <h3>Backend (Côté Serveur)</h3>\n  <ul>\n    <li><strong>Langages</strong> : Node.js, PHP, Python, Ruby, Java, C#</li>\n    <li><strong>Frameworks</strong> : Express.js, Laravel, Django, Rails, Spring</li>\n    <li><strong>Bases de données</strong> : MySQL, PostgreSQL, MongoDB, Redis</li>\n    <li><strong>APIs</strong> : REST, GraphQL, WebSockets</li>\n  </ul>\n  \n  <h3>Outils et Technologies Complémentaires</h3>\n  <ul>\n    <li><strong>Version Control</strong> : Git, GitHub, GitLab</li>\n    <li><strong>Build Tools</strong> : Webpack, Vite, Parcel</li>\n    <li><strong>Containers</strong> : Docker, Kubernetes</li>\n    <li><strong>CI/CD</strong> : GitHub Actions, Jenkins, GitLab CI</li>\n  </ul>\n</section>\n\n<section>\n  <h2>🎯 Objectifs de cette Formation</h2>\n  \n  <p>À la fin de cette formation complète, vous serez capable de :</p>\n  \n  <ul>\n    <li>✅ Comprendre l\'architecture et le fonctionnement du Web</li>\n    <li>✅ Créer des pages web modernes avec HTML5 et CSS3</li>\n    <li>✅ Développer des applications interactives avec JavaScript</li>\n    <li>✅ Construire des interfaces utilisateur avec React</li>\n    <li>✅ Créer des API RESTful robustes avec Node.js</li>\n    <li>✅ Gérer des bases de données relationnelles</li>\n    <li>✅ Déployer des applications en production</li>\n    <li>✅ Appliquer les meilleures pratiques de développement</li>\n  </ul>\n</section>\n\n<section>\n  <h2>💡 Pourquoi Apprendre le Développement Web ?</h2>\n  \n  <h3>Opportunités Professionnelles</h3>\n  <ul>\n    <li>Demande élevée sur le marché du travail</li>\n    <li>Salaires compétitifs</li>\n    <li>Possibilité de travailler en freelance ou en entreprise</li>\n    <li>Opportunités de télétravail</li>\n  </ul>\n  \n  <h3>Avantages Personnels</h3>\n  <ul>\n    <li>Créativité et résolution de problèmes</li>\n    <li>Communauté active et support</li>\n    <li>Apprentissage continu et évolution constante</li>\n    <li>Possibilité de créer vos propres projets</li>\n  </ul>\n</section>\n\n<section>\n  <h2>🚀 Comment Utiliser cette Formation</h2>\n  \n  <h3>Structure Pédagogique</h3>\n  <ul>\n    <li><strong>Modules progressifs</strong> : Chaque module construit sur le précédent</li>\n    <li><strong>Leçons variées</strong> : Textes, vidéos, exercices pratiques, quiz</li>\n    <li><strong>Projets réels</strong> : Application des connaissances sur des projets concrets</li>\n    <li><strong>Support continu</strong> : Forums et ressources complémentaires</li>\n  </ul>\n  \n  <h3>Conseils pour Réussir</h3>\n  <ul>\n    <li>📝 Prenez des notes pendant les leçons</li>\n    <li>💻 Pratiquez régulièrement en codant</li>\n    <li>🔍 Explorez les ressources complémentaires</li>\n    <li>🤝 Participez aux forums de discussion</li>\n    <li>✅ Complétez tous les exercices et quiz</li>\n    <li>🚀 Créez vos propres projets pour renforcer l\'apprentissage</li>\n  </ul>\n</section>\n\n<section>\n  <h2>📋 Prérequis</h2>\n  \n  <p>Pour tirer le meilleur parti de cette formation, il est recommandé d\'avoir :</p>\n  <ul>\n    <li>Une compréhension de base de l\'utilisation d\'un ordinateur</li>\n    <li>Une motivation et une curiosité pour apprendre</li>\n    <li>Un accès à un ordinateur avec connexion Internet</li>\n    <li>Du temps à consacrer à l\'apprentissage (recommandé : 5-10 heures par semaine)</li>\n  </ul>\n  \n  <p><strong>Note importante</strong> : Aucune expérience préalable en programmation n\'est requise. Cette formation part de zéro et vous guide pas à pas.</p>\n</section>\n\n<section>\n  <h2>🎓 Prochaines Étapes</h2>\n  \n  <p>Maintenant que vous avez une vue d\'ensemble du développement web, vous êtes prêt à commencer votre parcours d\'apprentissage !</p>\n  \n  <p>Dans les prochaines leçons, vous découvrirez :</p>\n  <ol>\n    <li>Les outils essentiels du développeur web</li>\n    <li>Comment installer et configurer votre environnement de développement</li>\n    <li>Les bases du HTML5 et CSS3</li>\n    <li>Et bien plus encore...</li>\n  </ol>\n  \n  <p><strong>Bonne chance dans votre apprentissage ! 🚀</strong></p>\n</section>', 'Comprendre l\'architecture du web et son fonctionnement', '<h1>Introduction au Développement Web</h1>\n\n<section>\n  <h2>🌐 Bienvenue dans le Monde du Web</h2>\n  <p>Bienvenue dans cette formation complète sur le développement web ! Avant de plonger dans les aspects techniques, il est essentiel de comprendre les fondements du World Wide Web, son histoire, son architecture et son fonctionnement.</p>\n  \n  <p>Le développement web est l\'un des domaines les plus dynamiques et en constante évolution de l\'informatique. Que vous souhaitiez créer des sites web, des applications web modernes, ou des plateformes complexes, cette formation vous donnera toutes les compétences nécessaires.</p>\n</section>\n\n<section>\n  <h2>📚 Qu\'est-ce que le World Wide Web ?</h2>\n  \n  <h3>Définition</h3>\n  <p>Le <strong>World Wide Web (WWW)</strong>, communément appelé \"le Web\", est un système d\'information basé sur l\'hypertexte accessible via Internet. Il a été inventé en 1989 par <strong>Tim Berners-Lee</strong>, un informaticien britannique travaillant au CERN (Organisation européenne pour la recherche nucléaire) à Genève.</p>\n  \n  <h3>Concepts Fondamentaux</h3>\n  <ul>\n    <li><strong>Internet vs Web</strong> : Internet est le réseau physique de connexions, tandis que le Web est un service qui fonctionne sur Internet</li>\n    <li><strong>Hypertexte</strong> : Système de liens permettant de naviguer entre différents documents</li>\n    <li><strong>URL (Uniform Resource Locator)</strong> : Adresse unique identifiant une ressource sur le Web</li>\n    <li><strong>HTTP/HTTPS</strong> : Protocoles de communication permettant le transfert de données</li>\n  </ul>\n</section>\n\n<section>\n  <h2>🏗️ Architecture Client-Serveur</h2>\n  \n  <p>Le Web fonctionne selon une architecture <strong>client-serveur</strong> :</p>\n  \n  <h3>Le Client (Navigateur)</h3>\n  <ul>\n    <li>Demande des ressources au serveur</li>\n    <li>Affiche les pages web à l\'utilisateur</li>\n    <li>Exécute le code JavaScript côté client</li>\n    <li>Exemples : Chrome, Firefox, Safari, Edge</li>\n  </ul>\n  \n  <h3>Le Serveur</h3>\n  <ul>\n    <li>Stocke les fichiers et données</li>\n    <li>Traite les requêtes HTTP</li>\n    <li>Exécute le code backend (PHP, Node.js, Python, etc.)</li>\n    <li>Gère les bases de données</li>\n  </ul>\n  \n  <h3>Le Processus de Communication</h3>\n  <ol>\n    <li>L\'utilisateur saisit une URL dans le navigateur</li>\n    <li>Le navigateur envoie une requête HTTP au serveur</li>\n    <li>Le serveur traite la requête et renvoie une réponse (HTML, CSS, JavaScript, images, etc.)</li>\n    <li>Le navigateur interprète et affiche le contenu</li>\n  </ol>\n</section>\n\n<section>\n  <h2>📖 Historique et Évolution du Web</h2>\n  \n  <h3>Web 1.0 (1990-2000) : Le Web Statique</h3>\n  <ul>\n    <li>Pages HTML statiques</li>\n    <li>Contenu en lecture seule</li>\n    <li>Peu d\'interactivité</li>\n    <li>Exemples : Sites vitrines, pages d\'information</li>\n  </ul>\n  \n  <h3>Web 2.0 (2000-2010) : Le Web Interactif</h3>\n  <ul>\n    <li>Contenu généré par les utilisateurs</li>\n    <li>Réseaux sociaux (Facebook, Twitter)</li>\n    <li>Applications web interactives</li>\n    <li>AJAX pour des mises à jour dynamiques</li>\n  </ul>\n  \n  <h3>Web 3.0 (2010-présent) : Le Web Moderne</h3>\n  <ul>\n    <li>Applications web complexes (SPA - Single Page Applications)</li>\n    <li>Mobile-first et responsive design</li>\n    <li>APIs RESTful et GraphQL</li>\n    <li>Cloud computing et microservices</li>\n    <li>Progressive Web Apps (PWA)</li>\n    <li>Intelligence artificielle et machine learning</li>\n  </ul>\n</section>\n\n<section>\n  <h2>🛠️ Technologies du Web</h2>\n  \n  <h3>Frontend (Côté Client)</h3>\n  <ul>\n    <li><strong>HTML (HyperText Markup Language)</strong> : Structure et contenu des pages</li>\n    <li><strong>CSS (Cascading Style Sheets)</strong> : Mise en forme et design</li>\n    <li><strong>JavaScript</strong> : Interactivité et logique côté client</li>\n    <li><strong>Frameworks modernes</strong> : React, Vue.js, Angular, Svelte</li>\n  </ul>\n  \n  <h3>Backend (Côté Serveur)</h3>\n  <ul>\n    <li><strong>Langages</strong> : Node.js, PHP, Python, Ruby, Java, C#</li>\n    <li><strong>Frameworks</strong> : Express.js, Laravel, Django, Rails, Spring</li>\n    <li><strong>Bases de données</strong> : MySQL, PostgreSQL, MongoDB, Redis</li>\n    <li><strong>APIs</strong> : REST, GraphQL, WebSockets</li>\n  </ul>\n  \n  <h3>Outils et Technologies Complémentaires</h3>\n  <ul>\n    <li><strong>Version Control</strong> : Git, GitHub, GitLab</li>\n    <li><strong>Build Tools</strong> : Webpack, Vite, Parcel</li>\n    <li><strong>Containers</strong> : Docker, Kubernetes</li>\n    <li><strong>CI/CD</strong> : GitHub Actions, Jenkins, GitLab CI</li>\n  </ul>\n</section>\n\n<section>\n  <h2>🎯 Objectifs de cette Formation</h2>\n  \n  <p>À la fin de cette formation complète, vous serez capable de :</p>\n  \n  <ul>\n    <li>✅ Comprendre l\'architecture et le fonctionnement du Web</li>\n    <li>✅ Créer des pages web modernes avec HTML5 et CSS3</li>\n    <li>✅ Développer des applications interactives avec JavaScript</li>\n    <li>✅ Construire des interfaces utilisateur avec React</li>\n    <li>✅ Créer des API RESTful robustes avec Node.js</li>\n    <li>✅ Gérer des bases de données relationnelles</li>\n    <li>✅ Déployer des applications en production</li>\n    <li>✅ Appliquer les meilleures pratiques de développement</li>\n  </ul>\n</section>\n\n<section>\n  <h2>💡 Pourquoi Apprendre le Développement Web ?</h2>\n  \n  <h3>Opportunités Professionnelles</h3>\n  <ul>\n    <li>Demande élevée sur le marché du travail</li>\n    <li>Salaires compétitifs</li>\n    <li>Possibilité de travailler en freelance ou en entreprise</li>\n    <li>Opportunités de télétravail</li>\n  </ul>\n  \n  <h3>Avantages Personnels</h3>\n  <ul>\n    <li>Créativité et résolution de problèmes</li>\n    <li>Communauté active et support</li>\n    <li>Apprentissage continu et évolution constante</li>\n    <li>Possibilité de créer vos propres projets</li>\n  </ul>\n</section>\n\n<section>\n  <h2>🚀 Comment Utiliser cette Formation</h2>\n  \n  <h3>Structure Pédagogique</h3>\n  <ul>\n    <li><strong>Modules progressifs</strong> : Chaque module construit sur le précédent</li>\n    <li><strong>Leçons variées</strong> : Textes, vidéos, exercices pratiques, quiz</li>\n    <li><strong>Projets réels</strong> : Application des connaissances sur des projets concrets</li>\n    <li><strong>Support continu</strong> : Forums et ressources complémentaires</li>\n  </ul>\n  \n  <h3>Conseils pour Réussir</h3>\n  <ul>\n    <li>📝 Prenez des notes pendant les leçons</li>\n    <li>💻 Pratiquez régulièrement en codant</li>\n    <li>🔍 Explorez les ressources complémentaires</li>\n    <li>🤝 Participez aux forums de discussion</li>\n    <li>✅ Complétez tous les exercices et quiz</li>\n    <li>🚀 Créez vos propres projets pour renforcer l\'apprentissage</li>\n  </ul>\n</section>\n\n<section>\n  <h2>📋 Prérequis</h2>\n  \n  <p>Pour tirer le meilleur parti de cette formation, il est recommandé d\'avoir :</p>\n  <ul>\n    <li>Une compréhension de base de l\'utilisation d\'un ordinateur</li>\n    <li>Une motivation et une curiosité pour apprendre</li>\n    <li>Un accès à un ordinateur avec connexion Internet</li>\n    <li>Du temps à consacrer à l\'apprentissage (recommandé : 5-10 heures par semaine)</li>\n  </ul>\n  \n  <p><strong>Note importante</strong> : Aucune expérience préalable en programmation n\'est requise. Cette formation part de zéro et vous guide pas à pas.</p>\n</section>\n\n<section>\n  <h2>🎓 Prochaines Étapes</h2>\n  \n  <p>Maintenant que vous avez une vue d\'ensemble du développement web, vous êtes prêt à commencer votre parcours d\'apprentissage !</p>\n  \n  <p>Dans les prochaines leçons, vous découvrirez :</p>\n  <ol>\n    <li>Les outils essentiels du développeur web</li>\n    <li>Comment installer et configurer votre environnement de développement</li>\n    <li>Les bases du HTML5 et CSS3</li>\n    <li>Et bien plus encore...</li>\n  </ol>\n  \n  <p><strong>Bonne chance dans votre apprentissage ! 🚀</strong></p>\n</section>', NULL, 30, 1, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 11:02:37'),
(360, 47, 148, 'Les Outils du Développeur', 'document', 36, NULL, 'VS Code, Git, Chrome DevTools, et autres outils essentiels', 'Découvrez les outils essentiels pour développer', 'Guide complet des outils de développement', NULL, 45, 2, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 11:13:40'),
(361, 47, 148, 'Vidéo : Installation de l\'Environnement', 'video', NULL, NULL, 'Installation de Node.js, Git, et VS Code', 'Tutoriel vidéo pour installer votre environnement de développement', 'Tutoriel d\'installation', NULL, 20, 3, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(362, 47, 149, 'HTML5 : Structure Sémantique', 'text', NULL, NULL, 'Éléments sémantiques HTML5 pour une meilleure structure', 'Apprenez à structurer vos pages avec HTML5', '<h2>HTML5 Sémantique</h2>\n<p>HTML5 introduit de nouveaux éléments sémantiques qui améliorent la structure et l\'accessibilité :</p>\n<ul>\n  <li><code>&lt;header&gt;</code> : En-tête de page</li>\n  <li><code>&lt;nav&gt;</code> : Navigation</li>\n  <li><code>&lt;main&gt;</code> : Contenu principal</li>\n  <li><code>&lt;article&gt;</code> : Article indépendant</li>\n  <li><code>&lt;section&gt;</code> : Section thématique</li>\n  <li><code>&lt;aside&gt;</code> : Contenu complémentaire</li>\n  <li><code>&lt;footer&gt;</code> : Pied de page</li>\n</ul>', NULL, 40, 1, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(363, 47, 149, 'CSS3 : Flexbox et Grid', 'presentation', NULL, NULL, 'Techniques de mise en page avec Flexbox et CSS Grid', 'Maîtrisez les systèmes de mise en page modernes', 'Présentation sur Flexbox et CSS Grid', NULL, 60, 2, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(364, 47, 149, 'Audio : Podcast sur les Bonnes Pratiques CSS', 'audio', NULL, NULL, 'Bonnes pratiques et astuces CSS', 'Écoutez nos conseils d\'experts sur CSS', 'Podcast CSS', NULL, 25, 3, 0, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(365, 47, 150, 'JavaScript ES6+ : Les Nouvelles Fonctionnalités', 'text', NULL, NULL, 'Fonctionnalités ES6+ de JavaScript', 'Découvrez les fonctionnalités modernes de JavaScript', '<h2>JavaScript ES6+</h2>\n<h3>Nouvelles fonctionnalités :</h3>\n<ul>\n  <li><strong>Arrow Functions</strong> : <code>const add = (a, b) => a + b;</code></li>\n  <li><strong>Destructuring</strong> : <code>const {name, age} = user;</code></li>\n  <li><strong>Template Literals</strong> : <code>`Hello ${name}`</code></li>\n  <li><strong>Promises & Async/Await</strong> : Gestion asynchrone</li>\n  <li><strong>Modules</strong> : <code>import/export</code></li>\n</ul>', NULL, 50, 1, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(366, 47, 150, 'Vidéo : Projet Pratique JavaScript', 'video', NULL, NULL, 'Création d\'une application Todo List avec JavaScript', 'Créez une application JavaScript complète', 'Tutoriel projet JavaScript', NULL, 90, 2, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(368, 47, 151, 'Introduction à React', 'text', NULL, NULL, 'Introduction à React et ses concepts', 'Découvrez React et ses concepts fondamentaux', '<h2>React : Bibliothèque JavaScript</h2>\n<p>React est une bibliothèque JavaScript pour créer des interfaces utilisateur.</p>\n<h3>Concepts clés :</h3>\n<ul>\n  <li><strong>Composants</strong> : Unités réutilisables</li>\n  <li><strong>JSX</strong> : Syntaxe similaire à HTML</li>\n  <li><strong>Props</strong> : Passage de données</li>\n  <li><strong>State</strong> : Gestion de l\'état</li>\n  <li><strong>Hooks</strong> : useState, useEffect, etc.</li>\n</ul>', NULL, 45, 1, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(369, 47, 151, 'Vidéo : Créer votre Première App React', 'video', NULL, NULL, 'Création d\'une application React complète', 'Tutoriel pas à pas pour créer une app React', 'Tutoriel React', NULL, 120, 2, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(370, 47, 151, 'H5P : Interaction Interactive React', 'h5p', NULL, NULL, 'Interaction interactive pour apprendre React', 'Module interactif H5P sur React', 'Module H5P React', NULL, 40, 3, 0, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(371, 47, 152, 'Node.js : Les Fondamentaux', 'text', NULL, NULL, 'Fondamentaux de Node.js', 'Comprendre Node.js et son écosystème', '<h2>Node.js</h2>\n<p>Node.js est un environnement d\'exécution JavaScript côté serveur.</p>\n<h3>Caractéristiques :</h3>\n<ul>\n  <li>Asynchrone et non-bloquant</li>\n  <li>Basé sur le moteur V8 de Chrome</li>\n  <li>Écosystème npm riche</li>\n  <li>Idéal pour les API et applications temps réel</li>\n</ul>', NULL, 50, 1, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(372, 47, 152, 'Document : Guide API REST', 'document', NULL, NULL, 'Bonnes pratiques pour créer des API RESTful', 'Guide complet pour créer des API REST', 'Guide API REST', NULL, 60, 2, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(373, 47, 152, 'Assignment : Créer une API REST', 'assignment', NULL, NULL, 'Créez une API REST complète avec Node.js et Express', 'Projet pratique : créer votre propre API', 'Devoir : API REST', NULL, 180, 3, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(374, 47, 153, 'MySQL et Bases de Données Relationnelles', 'text', NULL, NULL, 'Fondamentaux MySQL', 'Apprenez à utiliser MySQL efficacement', '<h2>MySQL : Base de Données Relationnelle</h2>\n<p>MySQL est un système de gestion de bases de données relationnelles.</p>\n<h3>Concepts :</h3>\n<ul>\n  <li>Tables et relations</li>\n  <li>Requêtes SQL</li>\n  <li>Index et performances</li>\n  <li>Transactions</li>\n</ul>', NULL, 55, 1, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(375, 47, 153, 'Forum : Discussion sur le Déploiement', 'forum', NULL, NULL, 'Discussion sur les stratégies de déploiement', 'Échangez sur les meilleures pratiques de déploiement', 'Forum déploiement', NULL, 30, 2, 0, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(376, 47, 153, 'Vidéo : Déployer sur Production', 'video', NULL, NULL, 'Déployer une application Node.js en production', 'Tutoriel complet sur le déploiement', 'Tutoriel déploiement', NULL, 75, 3, 1, 1, 0, '2025-11-13 10:50:35', '2025-11-13 10:50:35');

-- --------------------------------------------------------

--
-- Structure de la table `lesson_progress`
--

CREATE TABLE `lesson_progress` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `lesson_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `is_completed` tinyint(1) DEFAULT 0,
  `completed_at` datetime DEFAULT NULL,
  `time_spent_minutes` int(11) DEFAULT 0,
  `last_position_seconds` int(11) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déclencheurs `lesson_progress`
--
DELIMITER $$
CREATE TRIGGER `update_course_progress` AFTER UPDATE ON `lesson_progress` FOR EACH ROW BEGIN
  DECLARE total_lessons INT;
  DECLARE completed_lessons INT;
  DECLARE progress_percentage DECIMAL(5,2);

  SELECT COUNT(*) INTO total_lessons
  FROM lessons
  WHERE course_id = NEW.course_id AND is_published = TRUE;

  SELECT COUNT(*) INTO completed_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  WHERE lp.user_id = NEW.user_id
    AND lp.course_id = NEW.course_id
    AND lp.is_completed = TRUE
    AND l.is_published = TRUE;

  IF total_lessons > 0 THEN
    SET progress_percentage = (completed_lessons / total_lessons) * 100;

    UPDATE enrollments
    SET progress_percentage = progress_percentage,
        completed_at = CASE
          WHEN progress_percentage = 100 THEN NOW()
          ELSE completed_at
        END
    WHERE user_id = NEW.user_id AND course_id = NEW.course_id;
  END IF;
END$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `media_files`
--

CREATE TABLE `media_files` (
  `id` int(11) NOT NULL,
  `lesson_id` int(11) DEFAULT NULL,
  `course_id` int(11) DEFAULT NULL,
  `filename` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `file_type` varchar(255) NOT NULL,
  `file_category` enum('video','document','audio','image','presentation','h5p','other') NOT NULL,
  `file_size` bigint(20) NOT NULL COMMENT 'en bytes',
  `storage_type` enum('minio','s3','local') DEFAULT 'local',
  `bucket_name` varchar(100) DEFAULT NULL,
  `storage_path` varchar(500) NOT NULL,
  `url` varchar(500) NOT NULL,
  `thumbnail_url` varchar(500) DEFAULT NULL,
  `duration` int(11) DEFAULT NULL COMMENT 'Pour vid├®os/audio en secondes',
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `uploaded_by` int(11) NOT NULL,
  `uploaded_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `media_files`
--

INSERT INTO `media_files` (`id`, `lesson_id`, `course_id`, `filename`, `original_filename`, `file_type`, `file_category`, `file_size`, `storage_type`, `bucket_name`, `storage_path`, `url`, `thumbnail_url`, `duration`, `metadata`, `uploaded_by`, `uploaded_at`) VALUES
(1, NULL, NULL, '1-1762177513216-14042927.png', 'Rectangle 64.png', 'image/png', 'image', 172432, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762177513216-14042927.png', 'http://localhost:5000/uploads/courses/thumbnails/1-1762177513216-14042927.png', NULL, NULL, NULL, 1, '2025-11-03 13:45:13'),
(2, NULL, NULL, '1-1762178050460-927862613.jpg', '764547b7-ec6c-4735-80d3-d3eacf6cdf6e.jpg', 'image/jpeg', 'image', 42757, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762178050460-927862613.jpg', 'http://localhost:5000/uploads/courses/thumbnails/1-1762178050460-927862613.jpg', NULL, NULL, NULL, 1, '2025-11-03 13:54:10'),
(3, NULL, NULL, '1-1762178972230-498463690.jpg', '764547b7-ec6c-4735-80d3-d3eacf6cdf6e.jpg', 'image/jpeg', 'image', 42757, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762178972230-498463690.jpg', 'http://localhost:5000/uploads/courses/thumbnails/1-1762178972230-498463690.jpg', NULL, NULL, NULL, 1, '2025-11-03 14:09:32'),
(4, NULL, NULL, '1-1762179728882-580568632.jpg', '764547b7-ec6c-4735-80d3-d3eacf6cdf6e.jpg', 'image/jpeg', 'image', 42757, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762179728882-580568632.jpg', 'http://localhost:5000/uploads/courses/thumbnails/1-1762179728882-580568632.jpg', NULL, NULL, NULL, 1, '2025-11-03 14:22:08'),
(11, NULL, NULL, 'anon-1762201342650-2676075.pdf', 'a7a99731-c52b-46a7-8328-248ad6786772.pdf', 'application/pdf', 'document', 21390, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\documents\\anon-1762201342650-2676075.pdf', '/uploads/documents/anon-1762201342650-2676075.pdf', NULL, NULL, NULL, 1, '2025-11-03 20:22:22'),
(12, NULL, NULL, 'anon-1762201353447-257005449.jpg', '764547b7-ec6c-4735-80d3-d3eacf6cdf6e.jpg', 'image/jpeg', 'image', 42757, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\images\\anon-1762201353447-257005449.jpg', '/uploads/images/anon-1762201353447-257005449.jpg', NULL, NULL, NULL, 1, '2025-11-03 20:22:33'),
(13, NULL, NULL, 'anon-1762201363965-363914386.mp4', 'RÃ©union avec Mohamed saÃ¯d Ahetan-20250815_193801-Enregistrement de la rÃ©union.mp4', 'video/mp4', 'video', 12896455, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\videos\\anon-1762201363965-363914386.mp4', '/uploads/videos/anon-1762201363965-363914386.mp4', NULL, NULL, NULL, 1, '2025-11-03 20:22:44'),
(14, NULL, NULL, 'anon-1762204057990-61293791.pdf', 'CamScanner 20-10-2025 10.08.pdf', 'application/pdf', 'document', 2348047, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\documents\\anon-1762204057990-61293791.pdf', '/uploads/documents/anon-1762204057990-61293791.pdf', NULL, NULL, NULL, 1, '2025-11-03 21:07:38'),
(15, NULL, NULL, 'anon-1762205345375-513703249.pdf', 'CamScanner 20-10-2025 10.08.pdf', 'application/pdf', 'document', 2348047, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\documents\\anon-1762205345375-513703249.pdf', '/uploads/documents/anon-1762205345375-513703249.pdf', NULL, NULL, NULL, 1, '2025-11-03 21:29:05'),
(16, NULL, NULL, 'anon-1762205825369-707627955.pdf', 'CamScanner 20-10-2025 10.08.pdf', 'application/pdf', 'document', 2348047, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\documents\\anon-1762205825369-707627955.pdf', '/uploads/documents/anon-1762205825369-707627955.pdf', NULL, NULL, NULL, 1, '2025-11-03 21:37:05'),
(17, NULL, NULL, '1-1762211289754-24504356.jpg', '92931ffb-1a09-49ad-98cd-08d53dcdcbfe.jpg', 'image/jpeg', 'image', 78742, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762211289754-24504356.jpg', 'http://localhost:5000/uploads/courses/thumbnails/1-1762211289754-24504356.jpg', NULL, NULL, NULL, 1, '2025-11-03 23:08:10'),
(18, NULL, NULL, '1-1762212050900-826440377.jpg', '764547b7-ec6c-4735-80d3-d3eacf6cdf6e.jpg', 'image/jpeg', 'image', 42757, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762212050900-826440377.jpg', 'http://localhost:5000/uploads/courses/thumbnails/1-1762212050900-826440377.jpg', NULL, NULL, NULL, 1, '2025-11-03 23:20:51'),
(19, NULL, NULL, 'anon-1762212968754-357594517.pdf', 'RÃ©capitulatif des arriÃ©rÃ©s de salaire - Feuille 1 (3).pdf', 'application/pdf', 'document', 54417, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\documents\\anon-1762212968754-357594517.pdf', '/uploads/documents/anon-1762212968754-357594517.pdf', NULL, NULL, NULL, 1, '2025-11-03 23:36:08'),
(20, NULL, NULL, '1-1762247637736-507167682.jpg', '764547b7-ec6c-4735-80d3-d3eacf6cdf6e.jpg', 'image/jpeg', 'image', 42757, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762247637736-507167682.jpg', 'http://localhost:5000/uploads/courses/thumbnails/1-1762247637736-507167682.jpg', NULL, NULL, NULL, 1, '2025-11-04 09:13:57'),
(21, NULL, NULL, 'anon-1762247988681-505062903.pdf', 'RÃ©capitulatif des arriÃ©rÃ©s de salaire - Feuille 1 (3).pdf', 'application/pdf', 'document', 54417, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\documents\\anon-1762247988681-505062903.pdf', '/uploads/documents/anon-1762247988681-505062903.pdf', NULL, NULL, NULL, 1, '2025-11-04 09:19:48'),
(22, NULL, NULL, '1-1762421070660-555014512.jpg', '764547b7-ec6c-4735-80d3-d3eacf6cdf6e.jpg', 'image/jpeg', 'image', 42757, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762421070660-555014512.jpg', 'http://localhost:5000/uploads/courses/thumbnails/1-1762421070660-555014512.jpg', NULL, NULL, NULL, 1, '2025-11-06 09:24:30'),
(23, NULL, NULL, '1-1762422061717-745346013.jpg', '764547b7-ec6c-4735-80d3-d3eacf6cdf6e.jpg', 'image/jpeg', 'image', 42757, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762422061717-745346013.jpg', 'http://localhost:5000/uploads/courses/thumbnails/1-1762422061717-745346013.jpg', NULL, NULL, NULL, 1, '2025-11-06 09:41:01'),
(24, NULL, 40, 'anon-1762422244185-507162973.pdf', 'CamScanner 20-10-2025 10.08.pdf', 'application/pdf', 'document', 2348047, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\documents\\anon-1762422244185-507162973.pdf', '/uploads/documents/anon-1762422244185-507162973.pdf', NULL, NULL, NULL, 1, '2025-11-06 09:44:04'),
(25, NULL, 40, 'anon-1762422467123-477527548.mp4', 'RÃ©union avec Mohamed saÃ¯d Ahetan-20250815_193801-Enregistrement de la rÃ©union.mp4', 'video/mp4', 'video', 12896455, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\videos\\anon-1762422467123-477527548.mp4', '/uploads/videos/anon-1762422467123-477527548.mp4', NULL, NULL, NULL, 1, '2025-11-06 09:47:47'),
(26, NULL, NULL, '1-1762445474822-406054846.jpg', '764547b7-ec6c-4735-80d3-d3eacf6cdf6e.jpg', 'image/jpeg', 'image', 42757, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762445474822-406054846.jpg', 'http://localhost:5000/uploads/courses/thumbnails/1-1762445474822-406054846.jpg', NULL, NULL, NULL, 1, '2025-11-06 16:11:14'),
(27, NULL, 41, 'anon-1762445714451-591474652.mp4', 'RÃ©union avec Mohamed saÃ¯d Ahetan-20250815_193801-Enregistrement de la rÃ©union.mp4', 'video/mp4', 'video', 12896455, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\videos\\anon-1762445714451-591474652.mp4', '/uploads/videos/anon-1762445714451-591474652.mp4', NULL, NULL, NULL, 1, '2025-11-06 16:15:14'),
(28, NULL, 41, 'anon-1762445756991-966769073.pdf', 'CamScanner 20-10-2025 10.08.pdf', 'application/pdf', 'document', 2348047, 'local', NULL, 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\documents\\anon-1762445756991-966769073.pdf', '/uploads/documents/anon-1762445756991-966769073.pdf', NULL, NULL, NULL, 1, '2025-11-06 16:15:57'),
(29, NULL, NULL, '75-1763026919568-697364408.jpg', 'ads.jpg', 'image/jpeg', 'image', 72058, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/profiles/75-1763026919568-697364408.jpg', 'http://localhost:5000/api/uploads/courses/thumbnails/75-1763026919568-697364408.jpg', NULL, NULL, NULL, 75, '2025-11-13 09:41:59'),
(30, NULL, NULL, '75-1763027240435-188226035.mp4', 'TÃ©lÃ©chargeur de VidÃ©os YouTube Gratuit - TÃ©lÃ©chargez en MP4 et MP3 | SaveFrom.net.mp4', 'video/mp4', 'video', 1741776, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/profiles/75-1763027240435-188226035.mp4', 'http://localhost:5000/api/uploads/courses/videos/75-1763027240435-188226035.mp4', NULL, NULL, NULL, 75, '2025-11-13 09:47:20'),
(31, NULL, 46, 'anon-1763027586525-13247737.pdf', 'Projet Gestion Architecture.pdf', 'application/pdf', 'document', 22602, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/documents/anon-1763027586525-13247737.pdf', '/uploads/documents/anon-1763027586525-13247737.pdf', NULL, NULL, NULL, 75, '2025-11-13 09:53:06'),
(32, NULL, 46, 'anon-1763027764414-64087292.mp3', 'musique2pub.mp3', 'audio/mpeg', 'audio', 3269983, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/audio/anon-1763027764414-64087292.mp3', '/uploads/audio/anon-1763027764414-64087292.mp3', NULL, NULL, NULL, 75, '2025-11-13 09:56:04'),
(33, NULL, 46, 'anon-1763027836573-487929512.mp4', 'TÃ©lÃ©chargeur de VidÃ©os YouTube Gratuit - TÃ©lÃ©chargez en MP4 et MP3 | SaveFrom.net.mp4', 'video/mp4', 'video', 1741776, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/videos/anon-1763027836573-487929512.mp4', '/uploads/videos/anon-1763027836573-487929512.mp4', NULL, NULL, NULL, 75, '2025-11-13 09:57:16'),
(34, NULL, 46, 'anon-1763027896017-800062089.mp3', 'musique.mp3', 'audio/mpeg', 'audio', 3621963, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/audio/anon-1763027896017-800062089.mp3', '/uploads/audio/anon-1763027896017-800062089.mp3', NULL, NULL, NULL, 75, '2025-11-13 09:58:16'),
(35, 360, 47, 'anon-1763032211535-832744732.pdf', 'Projet Gestion Architecture.pdf', 'application/pdf', 'document', 22602, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/documents/anon-1763032211535-832744732.pdf', '/uploads/documents/anon-1763032211535-832744732.pdf', NULL, NULL, NULL, 75, '2025-11-13 11:10:11'),
(36, 360, 47, 'anon-1763032258587-661061829.pdf', 'Projet Gestion Architecture.pdf', 'application/pdf', 'document', 22602, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/documents/anon-1763032258587-661061829.pdf', '/uploads/documents/anon-1763032258587-661061829.pdf', NULL, NULL, NULL, 75, '2025-11-13 11:10:58'),
(37, 360, 47, 'anon-1763032652271-459836152.pdf', 'Projet Gestion Architecture.pdf', 'application/pdf', 'document', 22602, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/documents/anon-1763032652271-459836152.pdf', '/uploads/documents/anon-1763032652271-459836152.pdf', NULL, NULL, NULL, 75, '2025-11-13 11:17:32'),
(38, 361, 47, 'anon-1763035320874-870159485.mp4', 'TÃ©lÃ©chargeur de VidÃ©os YouTube Gratuit - TÃ©lÃ©chargez en MP4 et MP3 | SaveFrom.net.mp4', 'video/mp4', 'video', 1741776, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/videos/anon-1763035320874-870159485.mp4', '/uploads/videos/anon-1763035320874-870159485.mp4', NULL, NULL, NULL, 75, '2025-11-13 12:02:00'),
(39, 363, 47, 'anon-1763036636879-785514183.pptx', 'Presentation.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'presentation', 7055201, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/presentations/anon-1763036636879-785514183.pptx', '/uploads/presentations/anon-1763036636879-785514183.pptx', NULL, NULL, NULL, 75, '2025-11-13 12:23:56'),
(40, 364, 47, 'anon-1763039229486-769299604.mp3', 'musique2pub.mp3', 'audio/mpeg', 'audio', 3269983, 'local', NULL, '/home/drwintech/Documents/mdsc_auth_api/uploads/audio/anon-1763039229486-769299604.mp3', '/uploads/audio/anon-1763039229486-769299604.mp3', NULL, NULL, NULL, 75, '2025-11-13 13:07:09');

-- --------------------------------------------------------

--
-- Structure de la table `messages`
--

CREATE TABLE `messages` (
  `id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `sender_email` varchar(255) DEFAULT NULL,
  `recipient_id` int(11) NOT NULL,
  `recipient_email` varchar(255) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `message_type` enum('direct','announcement','system') DEFAULT 'direct',
  `is_read` tinyint(1) DEFAULT 0,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `messages`
--

INSERT INTO `messages` (`id`, `sender_id`, `sender_email`, `recipient_id`, `recipient_email`, `subject`, `content`, `message_type`, `is_read`, `read_at`, `created_at`) VALUES
(1, 1, 'ahetansaid@gmail.com', 2, 'a.said@drwintech.com', 'Bonjour', 'Bonjour', 'direct', 1, '2025-11-09 12:30:04', '2025-11-06 16:44:03');

-- --------------------------------------------------------

--
-- Structure de la table `modules`
--

CREATE TABLE `modules` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `order_index` int(11) NOT NULL DEFAULT 0,
  `is_unlocked` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `modules`
--

INSERT INTO `modules` (`id`, `course_id`, `title`, `description`, `order_index`, `is_unlocked`, `created_at`, `updated_at`) VALUES
(106, 31, 'dev', 'Description module 1', 1, 1, '2025-10-31 07:34:53', '2025-10-31 09:03:42'),
(107, 31, 'Module 2', 'Description module 2', 2, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(108, 31, 'Module 3', 'Description module 3', 3, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(109, 31, 'Module 4', 'Description module 4', 4, 0, '2025-10-31 07:34:53', '2025-10-31 07:34:53'),
(110, 32, 'Module 1', 'Description module 1', 1, 1, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(111, 32, 'Module 2', 'Description module 2', 2, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(112, 32, 'Module 3', 'Description module 3', 3, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(113, 32, 'Module 4', 'Description module 4', 4, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(114, 33, 'Module 1', 'Description module 1', 1, 1, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(115, 33, 'Module 2', 'Description module 2', 2, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(116, 33, 'Module 3', 'Description module 3', 3, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(117, 33, 'Module 4', 'Description module 4', 4, 0, '2025-10-31 07:34:54', '2025-10-31 07:34:54'),
(118, 34, 'Module 4', 'Description module 1', 0, 1, '2025-10-31 07:34:54', '2025-10-31 09:02:00'),
(120, 34, 'Module 3', 'Description module 3', 3, 0, '2025-10-31 07:34:55', '2025-10-31 08:23:54'),
(121, 35, 'Module 1', 'Description module 1', 1, 1, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(122, 35, 'Module 2', 'Description module 2', 2, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(123, 35, 'Module 3', 'Description module 3', 3, 0, '2025-10-31 07:34:55', '2025-10-31 07:34:55'),
(124, 36, 'Module 1', 'Description module 1', 1, 1, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(125, 36, 'Module 2', 'Description module 2', 2, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(126, 36, 'Module 3', 'Description module 3', 3, 0, '2025-10-31 07:34:56', '2025-10-31 07:34:56'),
(130, 40, 'Introduction GRH', 'La gestion des ressources humaines (GRH) est l\'ensemble des pratiques visant à organiser, administrer et développer le capital humain d\'une entreprise pour aligner ses objectifs avec les besoins en personnel. Elle comprend des activités telles que le recrutement, la formation, la gestion des carrières, la paie, et l\'administration du personnel, avec pour but de maximiser le potentiel des collaborateurs, d\'améliorer les performances et de garantir la conformité avec le droit du travail. \n', 0, 1, '2025-11-06 09:42:29', '2025-11-06 09:42:45'),
(131, 40, 'Deroulement', 'Elle comprend des activités telles que le recrutement, la formation, la gestion des carrières, la paie, et l\'administration du personnel, avec pour but de maximiser le potentiel des collaborateurs, d\'améliorer les performances et de garantir la conformité avec le droit du travail. \n', 1, 1, '2025-11-06 09:45:56', '2025-11-06 09:45:56'),
(132, 40, 'GRH avancé', 'Elle comprend des activités telles que le recrutement, la formation, la gestion des carrières, la paie, et l\'administration du personnel, avec pour but de maximiser le potentiel des collaborateurs, d\'améliorer les performances et de garantir la conformité avec le droit du travail. \n', 2, 0, '2025-11-06 11:43:08', '2025-11-06 11:43:08'),
(133, 41, 'introduction Gestion Projet', 'La gestion de projet est l\'ensemble des activités de planification, coordination et maîtrise nécessaires pour mener un projet de sa conception à sa réalisation finale afin d\'atteindre des objectifs spécifiques', 0, 1, '2025-11-06 16:12:53', '2025-11-06 16:12:53'),
(134, 42, 'Module 1 - Diagnostiquer son temps', 'Comprendre comment vous utilisez vos journées et identifier les voleurs de temps.', 1, 1, '2025-11-11 08:12:37', '2025-11-11 08:12:37'),
(135, 42, 'Module 2 - Planifier et prioriser', 'Apprendre à hiérarchiser ses tâches et bâtir un plan réaliste.', 2, 0, '2025-11-11 08:12:37', '2025-11-11 08:12:37'),
(136, 42, 'Module 3 - Routines et suivi', 'Mettre en place des routines efficaces et suivre ses progrès dans la durée.', 3, 0, '2025-11-11 08:12:37', '2025-11-11 08:12:37'),
(137, 43, 'Module 1: Introduction à la Gestion de Projet', 'Découvrez les concepts fondamentaux de la gestion de projet et son importance dans le monde professionnel.', 1, 1, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(138, 43, 'Module 2: Planification et Organisation', 'Apprenez à planifier efficacement un projet, définir les objectifs et organiser les ressources.', 2, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(139, 43, 'Module 3: Suivi et Clôture de Projet', 'Maîtrisez les techniques de suivi de projet et apprenez à clôturer efficacement un projet.', 3, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(140, 44, 'Module 1: Les Fondamentaux de la Communication', 'Découvrez les bases de la communication interpersonnelle.', 1, 1, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(141, 44, 'Module 2: Communication Non Verbale', 'Maîtrisez le langage du corps et les signaux non verbaux.', 2, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(142, 45, 'Module 1: Les Principes de la Gestion du Temps', 'Comprenez les fondamentaux de la gestion du temps.', 1, 1, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(143, 45, 'Module 2: Techniques et Outils de Productivité', 'Découvrez des méthodes concrètes pour être plus productif.', 2, 0, '2025-11-12 10:02:43', '2025-11-12 10:02:43'),
(144, 46, 'Introduction à Google Ads et à l’écosystème SEA', 'Comprendre le fonctionnement de la publicité sur Google et ses leviers.', 0, 1, '2025-11-13 09:49:58', '2025-11-13 09:49:58'),
(145, 46, 'Recherche et sélection des mots-clés', 'Identifier les mots-clés les plus rentables et structurer une stratégie d’enchères efficace', 1, 1, '2025-11-13 09:50:25', '2025-11-13 09:50:25'),
(146, 46, 'Création et optimisation des annonces', 'Concevoir des annonces efficaces et attractives.', 2, 0, '2025-11-13 09:50:50', '2025-11-13 09:50:50'),
(147, 46, 'Paramétrage et lancement des campagnes', 'Configurer une campagne complète prête à diffuser.', 3, 0, '2025-11-13 09:51:12', '2025-11-13 09:51:12'),
(148, 47, 'Module 1 : Introduction au Développement Web', 'Découvrez les bases du développement web et les outils essentiels', 1, 1, '2025-11-13 10:50:35', '2025-11-13 11:07:16'),
(149, 47, 'Module 2 : HTML5 et CSS3 Avancés', 'Maîtrisez les langages de base du web avec des techniques avancées', 2, 1, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(150, 47, 'Module 3 : JavaScript Moderne', 'De ES6+ à TypeScript, maîtrisez JavaScript moderne', 3, 1, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(151, 47, 'Module 4 : React et le Développement Frontend', 'Créez des interfaces utilisateur modernes avec React', 4, 1, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(152, 47, 'Module 5 : Node.js et Backend', 'Développez des API robustes avec Node.js', 5, 1, '2025-11-13 10:50:35', '2025-11-13 10:50:35'),
(153, 47, 'Module 6 : Base de Données et Déploiement', 'Gérez les données et déployez vos applications', 6, 1, '2025-11-13 10:50:35', '2025-11-13 10:50:35');

-- --------------------------------------------------------

--
-- Structure de la table `module_quizzes`
--

CREATE TABLE `module_quizzes` (
  `id` int(11) NOT NULL,
  `module_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `passing_score` int(11) DEFAULT 70,
  `badge_id` int(11) DEFAULT NULL,
  `time_limit_minutes` int(11) DEFAULT NULL,
  `max_attempts` int(11) DEFAULT 3,
  `is_published` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `module_quizzes`
--

INSERT INTO `module_quizzes` (`id`, `module_id`, `title`, `description`, `passing_score`, `badge_id`, `time_limit_minutes`, `max_attempts`, `is_published`, `created_at`, `updated_at`) VALUES
(1, 131, 'Quiz du module', 'La gestion des ressources humaines (GRH) ', 70, NULL, NULL, 3, 1, '2025-11-06 10:27:14', '2025-11-06 10:27:14'),
(3, 133, 'Quiz d\'introduction', 'La gestion de projet est l\'ensemble des activités de planification, coordination et maîtrise nécessaires pour mener un projet de sa conception à sa réalisation finale afin d\'atteindre des objectifs spécifiques', 70, NULL, 5, 3, 1, '2025-11-06 16:17:20', '2025-11-06 16:17:20'),
(22, 137, 'Quiz - Module 1: Introduction à la Gestion de Projet', 'Quiz d\'évaluation pour le module \"Module 1: Introduction à la Gestion de Projet\". Répondez aux questions pour valider vos connaissances.', 70, NULL, 15, 3, 1, '2025-11-12 17:05:43', '2025-11-12 17:05:43'),
(23, 138, 'Quiz - Module 2: Planification et Organisation', 'Quiz d\'évaluation pour le module \"Module 2: Planification et Organisation\". Répondez aux questions pour valider vos connaissances.', 70, NULL, 15, 3, 1, '2025-11-12 17:05:43', '2025-11-12 17:05:43'),
(24, 139, 'Quiz - Module 3: Suivi et Clôture de Projet', 'Quiz d\'évaluation pour le module \"Module 3: Suivi et Clôture de Projet\". Répondez aux questions pour valider vos connaissances.', 70, NULL, 15, 3, 1, '2025-11-12 17:05:43', '2025-11-12 17:05:43'),
(25, 142, 'Quiz - Module 1: Les Principes de la Gestion du Temps', 'Quiz d\'évaluation pour le module \"Module 1: Les Principes de la Gestion du Temps\". Répondez aux questions pour valider vos connaissances.', 70, NULL, 15, 3, 1, '2025-11-12 17:05:43', '2025-11-12 17:05:43'),
(26, 143, 'Quiz - Module 2: Techniques et Outils de Productivité', 'Quiz d\'évaluation pour le module \"Module 2: Techniques et Outils de Productivité\". Répondez aux questions pour valider vos connaissances.', 70, NULL, 15, 3, 1, '2025-11-12 17:05:43', '2025-11-12 17:05:43'),
(27, 144, 'Quiz du module', '', 70, NULL, NULL, 3, 1, '2025-11-13 10:00:52', '2025-11-13 10:00:52'),
(28, 148, 'Quiz : Introduction au Développement Web', 'Testez vos connaissances sur les bases du développement web', 70, NULL, 15, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33'),
(29, 149, 'Quiz : HTML5 et CSS3 Avancés', 'Évaluez votre maîtrise des fonctionnalités avancées de HTML5 et CSS3', 70, NULL, 20, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33'),
(30, 150, 'Quiz : JavaScript Moderne', 'Testez vos connaissances sur JavaScript ES6+ et les concepts modernes', 70, NULL, 25, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33'),
(31, 151, 'Quiz : React et le Développement Frontend', 'Évaluez votre compréhension de React et des concepts frontend modernes', 70, NULL, 30, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33'),
(32, 152, 'Quiz : Node.js et Backend', 'Testez vos connaissances sur Node.js et le développement backend', 70, NULL, 25, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33'),
(33, 153, 'Quiz : Base de Données et Déploiement', 'Évaluez vos connaissances sur les bases de données et le déploiement', 70, NULL, 20, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33');

-- --------------------------------------------------------

--
-- Structure de la table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` enum('info','success','warning','error','reminder') DEFAULT 'info',
  `is_read` tinyint(1) DEFAULT 0,
  `action_url` varchar(500) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `read_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `oauth_role_tokens`
--

CREATE TABLE `oauth_role_tokens` (
  `id` int(11) NOT NULL,
  `token` varchar(64) NOT NULL,
  `role` varchar(20) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `oauth_role_tokens`
--

INSERT INTO `oauth_role_tokens` (`id`, `token`, `role`, `expires_at`, `created_at`) VALUES
(3, '68a8b7595fb12d47ab812775cee0bc485575dfd32c4c9c67982b7e53751107b8', 'student', '2025-11-06 23:44:35', '2025-11-06 23:39:35'),
(4, '7ed06bc88a7cc096d7a53a93d55c047927dc98caea5faff2c97e8b5f56cd3cf8', 'student', '2025-11-06 23:46:53', '2025-11-06 23:41:53'),
(5, '832b75c30abab654c2ebc2ca4f56d121d619d4e06f9c9b42815f100b65e01fe9', 'student', '2025-11-06 23:49:22', '2025-11-06 23:44:22'),
(6, '1d4768448989c68bcca3c0fa3298a1b0d68d8c7e67d58128504e230e17378e0c', 'student', '2025-11-06 23:49:37', '2025-11-06 23:44:37'),
(7, '9611d7b386bb7dc816bb43ef8f34e04bc39eab711d6fce5e1978ad0f8d2e29e5', 'instructor', '2025-11-06 23:49:55', '2025-11-06 23:44:55'),
(8, 'fe881ce876a7db341c2bc7d8682c029f57fdb369d9a2ad018a9e8e7c03d08f38', 'instructor', '2025-11-06 23:50:40', '2025-11-06 23:45:40'),
(9, '7413b7c62a4c54fa6839d74c91e7a0f0e5899e77c82e7dabfa22d75c3c2316a9', 'student', '2025-11-12 12:05:33', '2025-11-12 12:00:33');

-- --------------------------------------------------------

--
-- Structure de la table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'XOF',
  `payment_method` enum('card','mobile_money','bank_transfer','cash','other') DEFAULT 'card',
  `payment_provider` varchar(100) DEFAULT NULL,
  `provider_transaction_id` varchar(255) DEFAULT NULL,
  `status` enum('pending','processing','completed','failed','refunded','cancelled') DEFAULT 'pending',
  `payment_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payment_data`)),
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `completed_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `payments`
--

INSERT INTO `payments` (`id`, `user_id`, `course_id`, `amount`, `currency`, `payment_method`, `payment_provider`, `provider_transaction_id`, `status`, `payment_data`, `error_message`, `created_at`, `updated_at`, `completed_at`) VALUES
(1, 75, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay payOrder: Request failed with status code 500', '2025-11-10 17:33:25', '2025-11-10 17:33:27', NULL),
(2, 75, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay payOrder: Request failed with status code 500', '2025-11-10 17:33:36', '2025-11-10 17:33:37', NULL),
(3, 75, 40, 1000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay payOrder: Request failed with status code 500', '2025-11-10 17:34:01', '2025-11-10 17:34:02', NULL),
(4, 75, 40, 1000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay payOrder: Request failed with status code 500', '2025-11-10 17:36:55', '2025-11-10 17:36:56', NULL),
(5, 75, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay payOrder: Request failed with status code 500', '2025-11-10 17:38:25', '2025-11-10 17:38:27', NULL),
(6, 75, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay payOrder: Request failed with status code 500', '2025-11-10 17:42:38', '2025-11-10 17:42:40', NULL),
(7, 75, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay payOrder: Request failed with status code 500', '2025-11-10 17:50:53', '2025-11-10 17:50:55', NULL),
(8, 75, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay payOrder: Request failed with status code 500', '2025-11-10 17:55:57', '2025-11-10 17:55:58', NULL),
(9, 75, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay payOrder: Request failed with status code 500', '2025-11-10 18:01:12', '2025-11-10 18:01:14', NULL),
(10, 75, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 07:18:25', '2025-11-11 07:18:27', NULL),
(11, 76, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 07:22:43', '2025-11-11 07:22:45', NULL),
(12, 75, 35, 39.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 07:25:09', '2025-11-11 07:25:10', NULL),
(13, 76, 41, 2000.00, 'XOF', 'other', 'gobipay', NULL, 'completed', NULL, NULL, '2025-11-11 07:35:17', '2025-11-11 07:35:17', NULL),
(14, 76, 35, 39.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 08:07:17', '2025-11-11 08:07:18', NULL),
(15, 76, 40, 1000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 09:34:28', '2025-11-11 09:34:30', NULL),
(16, 76, 40, 1000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay createOrder: Request failed with status code 403', '2025-11-11 10:18:20', '2025-11-11 10:18:22', NULL),
(17, 76, 40, 1000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay createOrder: Request failed with status code 403', '2025-11-11 10:23:13', '2025-11-11 10:23:13', NULL),
(18, 76, 40, 1000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay createOrder: Request failed with status code 403', '2025-11-11 10:34:16', '2025-11-11 10:34:17', NULL),
(19, 76, 40, 1000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:02:03', '2025-11-11 11:02:04', NULL),
(20, 76, 31, 49.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:07:19', '2025-11-11 11:07:20', NULL),
(21, 76, 32, 79.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:10:54', '2025-11-11 11:10:55', NULL),
(22, 76, 32, 79.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:13:05', '2025-11-11 11:13:08', NULL),
(23, 76, 32, 79.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:21:18', '2025-11-11 11:21:20', NULL),
(24, 76, 32, 79.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:23:56', '2025-11-11 11:23:58', NULL),
(25, 76, 32, 79.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:27:04', '2025-11-11 11:27:05', NULL),
(26, 76, 32, 79.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:30:25', '2025-11-11 11:30:26', NULL),
(27, 76, 32, 79.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:31:09', '2025-11-11 11:31:11', NULL),
(28, 76, 32, 79.00, 'EUR', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:40:55', '2025-11-11 11:40:57', NULL),
(29, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:56:59', '2025-11-11 11:57:00', NULL),
(30, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:59:08', '2025-11-11 11:59:09', NULL),
(31, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:59:10', '2025-11-11 11:59:11', NULL),
(32, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:59:12', '2025-11-11 11:59:13', NULL),
(33, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 11:59:28', '2025-11-11 11:59:30', NULL),
(34, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 12:00:54', '2025-11-11 12:00:55', NULL),
(35, 76, 40, 1000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 13:06:27', '2025-11-11 13:06:29', NULL),
(36, 76, 40, 1000.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 14:26:26', '2025-11-11 14:26:28', NULL),
(37, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 15:21:45', '2025-11-11 15:21:48', NULL),
(38, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 15:37:05', '2025-11-11 15:37:07', NULL),
(39, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 15:41:28', '2025-11-11 15:41:29', NULL),
(40, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 15:54:47', '2025-11-11 15:54:49', NULL),
(41, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 15:57:14', '2025-11-11 15:57:15', NULL),
(42, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 16:06:48', '2025-11-11 16:06:50', NULL),
(43, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 16:21:06', '2025-11-11 16:21:09', NULL),
(44, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 16:22:55', '2025-11-11 16:22:57', NULL),
(45, 76, 35, 39.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 16:25:50', '2025-11-11 16:25:51', NULL),
(46, 76, 32, 79.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-11 16:49:32', '2025-11-11 16:49:34', NULL),
(47, 76, 32, 79.00, 'XOF', 'other', 'gobipay', NULL, 'failed', NULL, 'GobiPay initTransaction: Request failed with status code 500', '2025-11-12 09:02:38', '2025-11-12 09:02:41', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `performance_metrics`
--

CREATE TABLE `performance_metrics` (
  `id` int(11) NOT NULL,
  `metric_name` varchar(100) NOT NULL,
  `metric_value` decimal(12,4) NOT NULL,
  `metric_unit` varchar(20) DEFAULT NULL,
  `context` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`context`)),
  `recorded_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `progress`
--

CREATE TABLE `progress` (
  `id` int(11) NOT NULL,
  `enrollment_id` int(11) NOT NULL,
  `lesson_id` int(11) NOT NULL,
  `status` enum('not_started','in_progress','completed') DEFAULT 'not_started',
  `completion_percentage` int(11) DEFAULT 0,
  `time_spent` int(11) DEFAULT 0 COMMENT 'en secondes',
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `quizzes`
--

CREATE TABLE `quizzes` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `lesson_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `time_limit_minutes` int(11) DEFAULT NULL COMMENT 'en minutes',
  `passing_score` decimal(5,2) DEFAULT 70.00 COMMENT 'Score minimum en %',
  `max_attempts` int(11) DEFAULT 3,
  `is_final` tinyint(1) DEFAULT 0,
  `is_published` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `quizzes`
--

INSERT INTO `quizzes` (`id`, `course_id`, `lesson_id`, `title`, `description`, `time_limit_minutes`, `passing_score`, `max_attempts`, `is_final`, `is_published`, `created_at`, `updated_at`) VALUES
(3, 31, NULL, 'Quiz Final - Cours 31', 'Quiz de validation du cours', 30, 70.00, 3, 0, 1, '2025-10-31 07:35:14', '2025-10-31 07:35:14'),
(4, 32, NULL, 'Quiz Final - Cours 32', 'Quiz de validation du cours', 30, 70.00, 3, 0, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15'),
(5, 33, NULL, 'Quiz Final - Cours 33', 'Quiz de validation du cours', 30, 70.00, 3, 0, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15');

-- --------------------------------------------------------

--
-- Structure de la table `quiz_answers`
--

CREATE TABLE `quiz_answers` (
  `id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `answer_text` text NOT NULL,
  `is_correct` tinyint(1) DEFAULT 0,
  `order_index` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `quiz_answers`
--

INSERT INTO `quiz_answers` (`id`, `question_id`, `answer_text`, `is_correct`, `order_index`, `created_at`) VALUES
(1, 30, 'Vrai', 1, 0, '2025-11-06 10:40:46'),
(2, 30, 'Faux', 0, 1, '2025-11-06 10:40:46'),
(9, 34, 'Vrai', 1, 0, '2025-11-06 11:30:23'),
(10, 34, 'Faux', 0, 1, '2025-11-06 11:30:23'),
(11, 35, 'La gestion des ressources humaines (GRH) est l\'ensemble des pratiques visant à organiser, administrer et développer le capital humain d\'une entreprise pour aligner ses objectifs avec les besoins en personnel.', 1, 0, '2025-11-06 11:30:23'),
(12, 36, 'Vrai', 1, 0, '2025-11-06 11:30:23'),
(13, 36, 'Faux', 0, 1, '2025-11-06 11:30:23'),
(14, 37, 'Vrai', 1, 0, '2025-11-06 16:17:20'),
(15, 37, 'Faux', 0, 1, '2025-11-06 16:17:20'),
(16, 38, 'La gestion de projet est l\'ensemble des activités de planification, coordination et maîtrise nécessaires pour mener un projet de sa conception à sa réalisation finale afin d\'atteindre des objectifs spécifiques', 1, 0, '2025-11-06 16:17:20'),
(17, 39, 'La gestion de projet est l\'ensemble des activités de planification, coordination et maîtrise nécessaires pour mener un projet de sa conception à sa réalisation finale afin d\'atteindre des objectifs spécifiques', 1, 0, '2025-11-06 16:19:32'),
(18, 40, 'Vrai', 1, 0, '2025-11-06 16:19:32'),
(19, 40, 'Faux', 0, 1, '2025-11-06 16:19:32'),
(416, 152, 'Planification', 0, 0, '2025-11-12 17:58:57'),
(417, 152, 'Exécution', 0, 1, '2025-11-12 17:58:57'),
(418, 152, 'Initiation', 1, 2, '2025-11-12 17:58:57'),
(419, 152, 'Clôture', 0, 3, '2025-11-12 17:58:57'),
(420, 153, 'Diagramme de Gantt', 1, 0, '2025-11-12 17:58:57'),
(421, 153, 'Diagramme de Pareto', 0, 1, '2025-11-12 17:58:57'),
(422, 153, 'Matrice SWOT', 0, 2, '2025-11-12 17:58:57'),
(423, 153, 'Analyse PESTEL', 0, 3, '2025-11-12 17:58:57'),
(424, 154, 'Vrai', 1, 0, '2025-11-12 17:58:57'),
(425, 154, 'Faux', 0, 1, '2025-11-12 17:58:57'),
(426, 155, 'Identifier de nouveaux projets', 0, 0, '2025-11-12 17:58:57'),
(427, 155, 'Libérer les ressources', 0, 1, '2025-11-12 17:58:57'),
(428, 155, 'Formaliser l\'achèvement et archiver les documents', 1, 2, '2025-11-12 17:58:57'),
(429, 155, 'Évaluer la performance de l\'équipe', 0, 3, '2025-11-12 17:58:57'),
(430, 156, 'Éliminer tous les risques', 0, 0, '2025-11-12 17:58:57'),
(431, 156, 'Maximiser les opportunités et minimiser les menaces', 1, 1, '2025-11-12 17:58:57'),
(432, 156, 'Ignorer les risques mineurs', 0, 2, '2025-11-12 17:58:57'),
(433, 156, 'Transférer tous les risques à des tiers', 0, 3, '2025-11-12 17:58:57'),
(434, 157, 'Travailler sans pause', 0, 0, '2025-11-12 17:58:57'),
(435, 157, 'Prioriser les tâches importantes', 1, 1, '2025-11-12 17:58:57'),
(436, 157, 'Faire plusieurs choses en même temps', 0, 2, '2025-11-12 17:58:57'),
(437, 157, 'Ignorer les deadlines', 0, 3, '2025-11-12 17:58:57'),
(438, 158, 'Vrai', 1, 0, '2025-11-12 17:58:57'),
(439, 158, 'Faux', 0, 1, '2025-11-12 17:58:57'),
(440, 159, 'Une méthode de cuisine', 0, 0, '2025-11-12 17:58:57'),
(441, 159, 'Une technique de gestion du temps par intervalles', 1, 1, '2025-11-12 17:58:57'),
(442, 159, 'Un outil de communication', 0, 2, '2025-11-12 17:58:57'),
(443, 159, 'Une méthode de budget', 0, 3, '2025-11-12 17:58:57'),
(444, 160, 'Vrai', 0, 0, '2025-11-12 17:58:57'),
(445, 160, 'Faux', 1, 1, '2025-11-12 17:58:57'),
(446, 161, 'Réduire le stress et améliorer l\'efficacité', 1, 0, '2025-11-12 17:58:57'),
(447, 161, 'Augmenter les interruptions', 0, 1, '2025-11-12 17:58:57'),
(448, 161, 'Réduire la qualité du travail', 0, 2, '2025-11-12 17:58:57'),
(449, 161, 'Aucun avantage', 0, 3, '2025-11-12 17:58:57'),
(450, 162, 'Un simple tableau Excel', 0, 0, '2025-11-12 17:58:57'),
(451, 162, 'Un logiciel de gestion de projet', 1, 1, '2025-11-12 17:58:57'),
(452, 162, 'Des notes manuscrites', 0, 2, '2025-11-12 17:58:57'),
(453, 162, 'Un calendrier mural', 0, 3, '2025-11-12 17:58:57'),
(454, 163, 'Vrai', 0, 0, '2025-11-12 17:58:57'),
(455, 163, 'Faux', 1, 1, '2025-11-12 17:58:57'),
(456, 164, 'Un outil de communication', 0, 0, '2025-11-12 17:58:57'),
(457, 164, 'Une décomposition hiérarchique du travail du projet', 1, 1, '2025-11-12 17:58:57'),
(458, 164, 'Un type de budget', 0, 2, '2025-11-12 17:58:57'),
(459, 164, 'Une méthode de reporting', 0, 3, '2025-11-12 17:58:57'),
(460, 165, 'Cela permet d\'identifier le chemin critique', 1, 0, '2025-11-12 17:58:57'),
(461, 165, 'Cela réduit les coûts', 0, 1, '2025-11-12 17:58:57'),
(462, 165, 'Cela augmente la qualité', 0, 2, '2025-11-12 17:58:57'),
(463, 165, 'Cela n\'a pas d\'importance', 0, 3, '2025-11-12 17:58:57'),
(464, 166, 'Vrai', 1, 0, '2025-11-12 17:58:57'),
(465, 166, 'Faux', 0, 1, '2025-11-12 17:58:57'),
(466, 167, 'Un carnet personnel', 0, 0, '2025-11-12 17:58:57'),
(467, 167, 'Un outil collaboratif en ligne', 1, 1, '2025-11-12 17:58:57'),
(468, 167, 'Des post-it', 0, 2, '2025-11-12 17:58:57'),
(469, 167, 'La mémoire', 0, 3, '2025-11-12 17:58:57'),
(470, 168, 'Vrai', 1, 0, '2025-11-12 17:58:57'),
(471, 168, 'Faux', 0, 1, '2025-11-12 17:58:57'),
(472, 169, 'Un type de logiciel', 0, 0, '2025-11-12 17:58:57'),
(473, 169, 'Une séquence d\'étapes pour accomplir une tâche', 1, 1, '2025-11-12 17:58:57'),
(474, 169, 'Un outil de communication', 0, 2, '2025-11-12 17:58:57'),
(475, 169, 'Une méthode de budget', 0, 3, '2025-11-12 17:58:57'),
(476, 170, 'Vrai', 1, 0, '2025-11-12 17:58:57'),
(477, 170, 'Faux', 0, 1, '2025-11-12 17:58:57'),
(478, 171, 'Gagner du temps et améliorer l\'organisation', 1, 0, '2025-11-12 17:58:57'),
(479, 171, 'Augmenter les coûts', 0, 1, '2025-11-12 17:58:57'),
(480, 171, 'Réduire la communication', 0, 2, '2025-11-12 17:58:57'),
(481, 171, 'Compliquer les processus', 0, 3, '2025-11-12 17:58:57'),
(482, 172, 'Une fois par mois', 0, 0, '2025-11-12 17:58:57'),
(483, 172, 'Régulièrement selon la complexité du projet', 1, 1, '2025-11-12 17:58:57'),
(484, 172, 'Seulement à la fin', 0, 2, '2025-11-12 17:58:57'),
(485, 172, 'Jamais', 0, 3, '2025-11-12 17:58:57'),
(486, 173, 'Vrai', 1, 0, '2025-11-12 17:58:57'),
(487, 173, 'Faux', 0, 1, '2025-11-12 17:58:57'),
(488, 174, 'Identifier les écarts par rapport au plan', 1, 0, '2025-11-12 17:58:57'),
(489, 174, 'Augmenter le budget', 0, 1, '2025-11-12 17:58:57'),
(490, 174, 'Réduire la qualité', 0, 2, '2025-11-12 17:58:57'),
(491, 174, 'Ignorer les problèmes', 0, 3, '2025-11-12 17:58:57'),
(492, 175, 'Vrai', 1, 0, '2025-11-12 17:58:57'),
(493, 175, 'Faux', 0, 1, '2025-11-12 17:58:57'),
(494, 176, 'Tous les documents du projet', 1, 0, '2025-11-12 17:58:57'),
(495, 176, 'Seulement les factures', 0, 1, '2025-11-12 17:58:57'),
(496, 176, 'Seulement les emails', 0, 2, '2025-11-12 17:58:57'),
(497, 176, 'Aucun document', 0, 3, '2025-11-12 17:58:57'),
(498, 177, 'google', 1, 0, '2025-11-13 10:00:52'),
(499, 179, 'Un langage de programmation', 0, 0, '2025-11-13 14:53:33'),
(500, 179, 'Un langage de balisage pour structurer le contenu web', 1, 1, '2025-11-13 14:53:33'),
(501, 179, 'Un langage de style', 0, 2, '2025-11-13 14:53:33'),
(502, 179, 'Un framework JavaScript', 0, 3, '2025-11-13 14:53:33'),
(503, 180, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(504, 180, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(505, 181, 'Créer des sites web', 0, 0, '2025-11-13 14:53:33'),
(506, 181, 'Interpréter et afficher le HTML/CSS/JavaScript', 1, 1, '2025-11-13 14:53:33'),
(507, 181, 'Héberger des sites web', 0, 2, '2025-11-13 14:53:33'),
(508, 181, 'Compiler du code', 0, 3, '2025-11-13 14:53:33'),
(509, 182, 'Une balise ouvrante, du contenu et une balise fermante', 1, 0, '2025-11-13 14:53:33'),
(510, 182, 'Un attribut CSS', 0, 1, '2025-11-13 14:53:33'),
(511, 182, 'Une fonction JavaScript', 0, 2, '2025-11-13 14:53:33'),
(512, 182, 'Une variable', 0, 3, '2025-11-13 14:53:33'),
(513, 183, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(514, 183, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(515, 184, '<div>', 0, 0, '2025-11-13 14:53:33'),
(516, 184, '<main>', 1, 1, '2025-11-13 14:53:33'),
(517, 184, '<section>', 0, 2, '2025-11-13 14:53:33'),
(518, 184, '<article>', 0, 3, '2025-11-13 14:53:33'),
(519, 185, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(520, 185, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(521, 186, 'Un système de grille bidimensionnel pour créer des layouts', 1, 0, '2025-11-13 14:53:33'),
(522, 186, 'Un framework CSS', 0, 1, '2025-11-13 14:53:33'),
(523, 186, 'Une bibliothèque JavaScript', 0, 2, '2025-11-13 14:53:33'),
(524, 186, 'Un préprocesseur CSS', 0, 3, '2025-11-13 14:53:33'),
(525, 187, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(526, 187, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(527, 188, '@keyframes', 1, 0, '2025-11-13 14:53:33'),
(528, 188, '@media', 0, 1, '2025-11-13 14:53:33'),
(529, 188, '@import', 0, 2, '2025-11-13 14:53:33'),
(530, 188, '@font-face', 0, 3, '2025-11-13 14:53:33'),
(531, 189, 'Une fonction avec une syntaxe raccourcie et un this lexical', 1, 0, '2025-11-13 14:53:33'),
(532, 189, 'Une fonction asynchrone', 0, 1, '2025-11-13 14:53:33'),
(533, 189, 'Une fonction génératrice', 0, 2, '2025-11-13 14:53:33'),
(534, 189, 'Une fonction récursive', 0, 3, '2025-11-13 14:53:33'),
(535, 190, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(536, 190, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(537, 191, 'Extraire des valeurs d\'objets ou tableaux dans des variables distinctes', 1, 0, '2025-11-13 14:53:33'),
(538, 191, 'Supprimer des propriétés d\'un objet', 0, 1, '2025-11-13 14:53:33'),
(539, 191, 'Copier un objet', 0, 2, '2025-11-13 14:53:33'),
(540, 191, 'Fusionner des objets', 0, 3, '2025-11-13 14:53:33'),
(541, 192, 'Un objet représentant une opération asynchrone', 1, 0, '2025-11-13 14:53:33'),
(542, 192, 'Une fonction synchrone', 0, 1, '2025-11-13 14:53:33'),
(543, 192, 'Un type de données', 0, 2, '2025-11-13 14:53:33'),
(544, 192, 'Une méthode de tableau', 0, 3, '2025-11-13 14:53:33'),
(545, 193, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(546, 193, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(547, 194, 'Une fonction ou classe qui retourne du JSX', 1, 0, '2025-11-13 14:53:33'),
(548, 194, 'Un fichier CSS', 0, 1, '2025-11-13 14:53:33'),
(549, 194, 'Une base de données', 0, 2, '2025-11-13 14:53:33'),
(550, 194, 'Un serveur web', 0, 3, '2025-11-13 14:53:33'),
(551, 195, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(552, 195, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(553, 196, 'Une représentation JavaScript du DOM pour optimiser les mises à jour', 1, 0, '2025-11-13 14:53:33'),
(554, 196, 'Un framework CSS', 0, 1, '2025-11-13 14:53:33'),
(555, 196, 'Une bibliothèque de routing', 0, 2, '2025-11-13 14:53:33'),
(556, 196, 'Un outil de build', 0, 3, '2025-11-13 14:53:33'),
(557, 197, 'useState', 1, 0, '2025-11-13 14:53:33'),
(558, 197, 'useEffect', 0, 1, '2025-11-13 14:53:33'),
(559, 197, 'useContext', 0, 2, '2025-11-13 14:53:33'),
(560, 197, 'useReducer', 0, 3, '2025-11-13 14:53:33'),
(561, 198, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(562, 198, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(563, 199, 'Un environnement d\'exécution JavaScript côté serveur', 1, 0, '2025-11-13 14:53:33'),
(564, 199, 'Un framework frontend', 0, 1, '2025-11-13 14:53:33'),
(565, 199, 'Un langage de programmation', 0, 2, '2025-11-13 14:53:33'),
(566, 199, 'Une base de données', 0, 3, '2025-11-13 14:53:33'),
(567, 200, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(568, 200, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(569, 201, 'Une fonction qui a accès aux objets request, response et next', 1, 0, '2025-11-13 14:53:33'),
(570, 201, 'Une route', 0, 1, '2025-11-13 14:53:33'),
(571, 201, 'Un modèle de données', 0, 2, '2025-11-13 14:53:33'),
(572, 201, 'Un template', 0, 3, '2025-11-13 14:53:33'),
(573, 202, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(574, 202, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(575, 203, 'Le gestionnaire de paquets pour Node.js', 1, 0, '2025-11-13 14:53:33'),
(576, 203, 'Un framework web', 0, 1, '2025-11-13 14:53:33'),
(577, 203, 'Un serveur web', 0, 2, '2025-11-13 14:53:33'),
(578, 203, 'Un langage de programmation', 0, 3, '2025-11-13 14:53:33'),
(579, 204, 'Une base de données organisée en tables avec relations', 1, 0, '2025-11-13 14:53:33'),
(580, 204, 'Une base de données NoSQL', 0, 1, '2025-11-13 14:53:33'),
(581, 204, 'Un fichier JSON', 0, 2, '2025-11-13 14:53:33'),
(582, 204, 'Un cache mémoire', 0, 3, '2025-11-13 14:53:33'),
(583, 205, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(584, 205, 'Faux', 0, 1, '2025-11-13 14:53:33'),
(585, 206, 'Un script qui modifie la structure de la base de données de manière versionnée', 1, 0, '2025-11-13 14:53:33'),
(586, 206, 'Un backup de données', 0, 1, '2025-11-13 14:53:33'),
(587, 206, 'Une requête SELECT', 0, 2, '2025-11-13 14:53:33'),
(588, 206, 'Un index de base de données', 0, 3, '2025-11-13 14:53:33'),
(589, 207, 'Mettre l\'application en production sur un serveur accessible', 1, 0, '2025-11-13 14:53:33'),
(590, 207, 'Tester l\'application localement', 0, 1, '2025-11-13 14:53:33'),
(591, 207, 'Développer l\'application', 0, 2, '2025-11-13 14:53:33'),
(592, 207, 'Documenter l\'application', 0, 3, '2025-11-13 14:53:33'),
(593, 208, 'Vrai', 1, 0, '2025-11-13 14:53:33'),
(594, 208, 'Faux', 0, 1, '2025-11-13 14:53:33');

-- --------------------------------------------------------

--
-- Structure de la table `quiz_attempts`
--

CREATE TABLE `quiz_attempts` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `quiz_id` int(11) DEFAULT NULL,
  `answers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT '{questionId: answer}' CHECK (json_valid(`answers`)),
  `course_id` int(11) NOT NULL,
  `started_at` timestamp NULL DEFAULT current_timestamp(),
  `completed_at` datetime DEFAULT NULL,
  `score` decimal(5,2) DEFAULT 0.00,
  `total_points` decimal(5,2) DEFAULT 0.00,
  `percentage` decimal(5,2) DEFAULT 0.00,
  `is_passed` tinyint(1) DEFAULT 0,
  `time_spent_minutes` int(11) DEFAULT NULL COMMENT 'en minutes',
  `course_evaluation_id` int(11) DEFAULT NULL,
  `module_quiz_id` int(11) DEFAULT NULL,
  `enrollment_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `quiz_questions`
--

CREATE TABLE `quiz_questions` (
  `id` int(11) NOT NULL,
  `quiz_id` int(11) DEFAULT NULL,
  `question_text` text NOT NULL,
  `question_type` enum('multiple_choice','true_false','short_answer') DEFAULT 'multiple_choice',
  `options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Pour multiple_choice: [{"text": "...", "correct": true}]' CHECK (json_valid(`options`)),
  `correct_answer` text DEFAULT NULL COMMENT 'Pour true_false et short_answer',
  `points` decimal(5,2) DEFAULT 1.00,
  `order_index` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `course_evaluation_id` int(11) DEFAULT NULL,
  `module_quiz_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `quiz_questions`
--

INSERT INTO `quiz_questions` (`id`, `quiz_id`, `question_text`, `question_type`, `options`, `correct_answer`, `points`, `order_index`, `is_active`, `created_at`, `updated_at`, `course_evaluation_id`, `module_quiz_id`) VALUES
(11, 3, 'Question 1 du quiz', 'multiple_choice', NULL, NULL, 20.00, 1, 1, '2025-10-31 07:35:14', '2025-10-31 07:35:14', NULL, NULL),
(12, 3, 'Question 2 du quiz', 'multiple_choice', NULL, NULL, 20.00, 2, 1, '2025-10-31 07:35:14', '2025-10-31 07:35:14', NULL, NULL),
(13, 3, 'Question 3 du quiz', 'multiple_choice', NULL, NULL, 20.00, 3, 1, '2025-10-31 07:35:14', '2025-10-31 07:35:14', NULL, NULL),
(14, 3, 'Question 4 du quiz', 'multiple_choice', NULL, NULL, 20.00, 4, 1, '2025-10-31 07:35:14', '2025-10-31 07:35:14', NULL, NULL),
(15, 3, 'Question 5 du quiz', 'multiple_choice', NULL, NULL, 20.00, 5, 1, '2025-10-31 07:35:14', '2025-10-31 07:35:14', NULL, NULL),
(16, 4, 'Question 1 du quiz', 'multiple_choice', NULL, NULL, 20.00, 1, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(17, 4, 'Question 2 du quiz', 'multiple_choice', NULL, NULL, 20.00, 2, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(18, 4, 'Question 3 du quiz', 'multiple_choice', NULL, NULL, 20.00, 3, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(19, 4, 'Question 4 du quiz', 'multiple_choice', NULL, NULL, 20.00, 4, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(20, 4, 'Question 5 du quiz', 'multiple_choice', NULL, NULL, 20.00, 5, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(21, 5, 'Question 1 du quiz', 'multiple_choice', NULL, NULL, 20.00, 1, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(22, 5, 'Question 2 du quiz', 'multiple_choice', NULL, NULL, 20.00, 2, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(23, 5, 'Question 3 du quiz', 'multiple_choice', NULL, NULL, 20.00, 3, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(24, 5, 'Question 4 du quiz', 'multiple_choice', NULL, NULL, 20.00, 4, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(25, 5, 'Question 5 du quiz', 'multiple_choice', NULL, NULL, 20.00, 5, 1, '2025-10-31 07:35:15', '2025-10-31 07:35:15', NULL, NULL),
(28, NULL, 'La gestion des ressources humaines (GRH) est l\'ensemble des pratiques visant à organiser, administrer et développer le capital humain d\'une entreprise pour aligner ses objectifs avec les besoins en personnel. ', 'true_false', NULL, NULL, 1.00, 0, 1, '2025-11-06 10:40:46', '2025-11-06 10:40:46', NULL, 1),
(29, NULL, 'La gestion des ressources humaines (GRH) ?', 'short_answer', NULL, NULL, 1.00, 1, 1, '2025-11-06 10:40:46', '2025-11-06 10:40:46', NULL, 1),
(30, NULL, 'La gestion des ressources humaines (GRH)?', 'true_false', NULL, NULL, 1.00, 3, 1, '2025-11-06 10:40:46', '2025-11-06 10:40:46', NULL, 1),
(34, NULL, 'La gestion des ressources humaines (GRH) est l\'ensemble des pratiques visant à organiser, administrer et développer le capital humain d\'une entreprise pour aligner ses objectifs avec les besoins en personnel.', 'true_false', NULL, NULL, 3.00, 1, 1, '2025-11-06 11:30:23', '2025-11-06 11:30:23', 1, NULL),
(35, NULL, 'Definition', 'short_answer', NULL, NULL, 5.00, 2, 1, '2025-11-06 11:30:23', '2025-11-06 11:30:23', 1, NULL),
(36, NULL, 'La gestion des ressources humaines (GRH) ', 'true_false', NULL, NULL, 2.00, 3, 1, '2025-11-06 11:30:23', '2025-11-06 11:30:23', 1, NULL),
(37, NULL, 'La gestion de projet est l\'ensemble des activités de planification, coordination et maîtrise nécessaires pour mener un projet de sa conception à sa réalisation finale afin d\'atteindre des objectifs spécifiques', 'true_false', NULL, NULL, 2.00, 0, 1, '2025-11-06 16:17:20', '2025-11-06 16:17:20', NULL, 3),
(38, NULL, 'Définition?', 'short_answer', NULL, NULL, 5.00, 1, 1, '2025-11-06 16:17:20', '2025-11-06 16:17:20', NULL, 3),
(39, NULL, 'définition ', 'short_answer', NULL, NULL, 5.00, 1, 1, '2025-11-06 16:19:32', '2025-11-06 16:19:32', 2, NULL),
(40, NULL, 'La gestion de projet est l\'ensemble des activités de planification, coordination et maîtrise nécessaires pour mener un projet de sa conception à sa réalisation finale afin d\'atteindre des objectifs spécifiques', 'true_false', NULL, NULL, 2.00, 2, 1, '2025-11-06 16:19:32', '2025-11-06 16:19:32', 2, NULL),
(152, NULL, 'Quelle est la première étape de la gestion de projet selon le PMBOK ?', 'multiple_choice', NULL, NULL, 20.00, 0, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 22),
(153, NULL, 'Quel outil est couramment utilisé pour visualiser le calendrier d\'un projet ?', 'multiple_choice', NULL, NULL, 20.00, 1, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 22),
(154, NULL, 'Un jalon (milestone) est un événement significatif dans un projet.', 'true_false', NULL, NULL, 20.00, 2, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 22),
(155, NULL, 'Quelle est la principale raison de la phase de clôture d\'un projet ?', 'multiple_choice', NULL, NULL, 20.00, 3, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 22),
(156, NULL, 'Quel est l\'objectif principal de la gestion des risques dans un projet ?', 'multiple_choice', NULL, NULL, 20.00, 4, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 22),
(157, NULL, 'Quelle est la technique la plus efficace pour gérer son temps ?', 'multiple_choice', NULL, NULL, 20.00, 0, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 25),
(158, NULL, 'La matrice d\'Eisenhower permet de classer les tâches selon leur urgence et importance.', 'true_false', NULL, NULL, 20.00, 1, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 25),
(159, NULL, 'Qu\'est-ce que la technique Pomodoro ?', 'multiple_choice', NULL, NULL, 20.00, 2, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 25),
(160, NULL, 'Les interruptions constantes améliorent la productivité.', 'true_false', NULL, NULL, 20.00, 3, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 25),
(161, NULL, 'Quel est l\'avantage de planifier sa journée à l\'avance ?', 'multiple_choice', NULL, NULL, 20.00, 4, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 25),
(162, NULL, 'Quel est l\'outil le plus efficace pour organiser les tâches d\'un projet ?', 'multiple_choice', NULL, NULL, 20.00, 0, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 23),
(163, NULL, 'La planification d\'un projet doit être faite une seule fois au début.', 'true_false', NULL, NULL, 20.00, 1, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 23),
(164, NULL, 'Qu\'est-ce qu\'un WBS (Work Breakdown Structure) ?', 'multiple_choice', NULL, NULL, 20.00, 2, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 23),
(165, NULL, 'Quelle est l\'importance de définir les dépendances entre les tâches ?', 'multiple_choice', NULL, NULL, 20.00, 3, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 23),
(166, NULL, 'Un plan de projet doit inclure les ressources nécessaires.', 'true_false', NULL, NULL, 20.00, 4, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 23),
(167, NULL, 'Quel outil est le plus adapté pour la gestion de tâches en équipe ?', 'multiple_choice', NULL, NULL, 20.00, 0, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 26),
(168, NULL, 'L\'automatisation peut améliorer la productivité.', 'true_false', NULL, NULL, 20.00, 1, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 26),
(169, NULL, 'Qu\'est-ce qu\'un workflow ?', 'multiple_choice', NULL, NULL, 20.00, 2, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 26),
(170, NULL, 'Les outils de productivité doivent être adaptés à chaque équipe.', 'true_false', NULL, NULL, 20.00, 3, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 26),
(171, NULL, 'Quel est l\'avantage principal de l\'utilisation d\'outils de productivité ?', 'multiple_choice', NULL, NULL, 20.00, 4, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 26),
(172, NULL, 'Quelle est la fréquence recommandée pour le suivi d\'un projet ?', 'multiple_choice', NULL, NULL, 20.00, 0, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 24),
(173, NULL, 'Un rapport de clôture de projet doit inclure les leçons apprises.', 'true_false', NULL, NULL, 20.00, 1, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 24),
(174, NULL, 'Quel est l\'objectif principal du suivi de projet ?', 'multiple_choice', NULL, NULL, 20.00, 2, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 24),
(175, NULL, 'La clôture d\'un projet doit être formalisée.', 'true_false', NULL, NULL, 20.00, 3, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 24),
(176, NULL, 'Quels documents doivent être archivés à la clôture d\'un projet ?', 'multiple_choice', NULL, NULL, 20.00, 4, 1, '2025-11-12 17:58:57', '2025-11-12 17:58:57', NULL, 24),
(177, NULL, 'Quelle est la différence entre correspondance large et exacte ?', 'short_answer', NULL, NULL, 10.00, 0, 1, '2025-11-13 10:00:52', '2025-11-13 10:00:52', NULL, 27),
(178, NULL, 'Quel outil intégré à Google Ads permet de trouver de nouveaux mots-clés ?', 'multiple_choice', NULL, NULL, 120.00, 1, 1, '2025-11-13 10:00:52', '2025-11-13 10:00:52', NULL, 27),
(179, NULL, 'Qu\'est-ce que le HTML ?', 'multiple_choice', NULL, NULL, 2.00, 0, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 28),
(180, NULL, 'Le CSS est utilisé pour styliser les pages web', 'true_false', NULL, NULL, 1.00, 1, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 28),
(181, NULL, 'Quel est le rôle principal d\'un navigateur web ?', 'multiple_choice', NULL, NULL, 2.00, 2, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 28),
(182, NULL, 'Qu\'est-ce qu\'un élément HTML ?', 'multiple_choice', NULL, NULL, 2.00, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 28),
(183, NULL, 'HTTP signifie HyperText Transfer Protocol', 'true_false', NULL, NULL, 1.00, 4, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 28),
(184, NULL, 'Quelle balise HTML5 est utilisée pour le contenu principal d\'une page ?', 'multiple_choice', NULL, NULL, 2.00, 0, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 29),
(185, NULL, 'Flexbox permet de créer des layouts flexibles', 'true_false', NULL, NULL, 1.00, 1, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 29),
(186, NULL, 'Qu\'est-ce que CSS Grid ?', 'multiple_choice', NULL, NULL, 2.00, 2, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 29),
(187, NULL, 'Les media queries permettent de créer des designs responsives', 'true_false', NULL, NULL, 1.00, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 29),
(188, NULL, 'Quelle propriété CSS est utilisée pour créer des animations ?', 'multiple_choice', NULL, NULL, 2.00, 4, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 29),
(189, NULL, 'Qu\'est-ce qu\'une arrow function en JavaScript ?', 'multiple_choice', NULL, NULL, 2.00, 0, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 30),
(190, NULL, 'const et let sont des déclarations de variables avec portée de bloc', 'true_false', NULL, NULL, 1.00, 1, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 30),
(191, NULL, 'Qu\'est-ce que la déstructuration (destructuring) ?', 'multiple_choice', NULL, NULL, 2.00, 2, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 30),
(192, NULL, 'Qu\'est-ce qu\'une Promise en JavaScript ?', 'multiple_choice', NULL, NULL, 2.00, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 30),
(193, NULL, 'async/await est une syntaxe pour gérer les opérations asynchrones', 'true_false', NULL, NULL, 1.00, 4, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 30),
(194, NULL, 'Qu\'est-ce qu\'un composant React ?', 'multiple_choice', NULL, NULL, 2.00, 0, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 31),
(195, NULL, 'Les hooks React permettent d\'utiliser l\'état dans les composants fonctionnels', 'true_false', NULL, NULL, 1.00, 1, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 31),
(196, NULL, 'Qu\'est-ce que le Virtual DOM ?', 'multiple_choice', NULL, NULL, 2.00, 2, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 31),
(197, NULL, 'Quel hook React est utilisé pour gérer l\'état local ?', 'multiple_choice', NULL, NULL, 2.00, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 31),
(198, NULL, 'React utilise un système de props pour passer des données entre composants', 'true_false', NULL, NULL, 1.00, 4, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 31),
(199, NULL, 'Qu\'est-ce que Node.js ?', 'multiple_choice', NULL, NULL, 2.00, 0, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 32),
(200, NULL, 'Express.js est un framework web pour Node.js', 'true_false', NULL, NULL, 1.00, 1, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 32),
(201, NULL, 'Qu\'est-ce qu\'un middleware dans Express ?', 'multiple_choice', NULL, NULL, 2.00, 2, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 32),
(202, NULL, 'REST API signifie Representational State Transfer Application Programming Interface', 'true_false', NULL, NULL, 1.00, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 32),
(203, NULL, 'Qu\'est-ce que npm ?', 'multiple_choice', NULL, NULL, 2.00, 4, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 32),
(204, NULL, 'Qu\'est-ce qu\'une base de données relationnelle ?', 'multiple_choice', NULL, NULL, 2.00, 0, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 33),
(205, NULL, 'SQL signifie Structured Query Language', 'true_false', NULL, NULL, 1.00, 1, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 33),
(206, NULL, 'Qu\'est-ce qu\'une migration de base de données ?', 'multiple_choice', NULL, NULL, 2.00, 2, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 33),
(207, NULL, 'Qu\'est-ce que le déploiement d\'une application ?', 'multiple_choice', NULL, NULL, 2.00, 3, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 33),
(208, NULL, 'Docker permet de conteneuriser des applications', 'true_false', NULL, NULL, 1.00, 4, 1, '2025-11-13 14:53:33', '2025-11-13 14:53:33', NULL, 33);

-- --------------------------------------------------------

--
-- Structure de la table `recommendations`
--

CREATE TABLE `recommendations` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `recommendation_type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `priority` int(11) DEFAULT 3,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(500) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `revoked_at` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `refresh_tokens`
--

INSERT INTO `refresh_tokens` (`id`, `user_id`, `token`, `expires_at`, `created_at`, `revoked_at`, `ip_address`, `user_agent`) VALUES
(1, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MTgzNjg5MiwiZXhwIjoxNzY0NDI4ODkyfQ.3wrvJmFnhX0udd3ryzDo1NMGI3Jl6ICLQpRteLzA13M', '2025-11-29 16:08:12', '2025-10-30 15:08:12', '2025-10-30 17:00:55', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(2, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MTg0MDMwMiwiZXhwIjoxNzY0NDMyMzAyfQ.W1jGt5ekF12jzm3wovHJmG7lJ7CkCN1tg0IpkQaGx6A', '2025-11-29 17:05:02', '2025-10-30 16:05:02', '2025-10-30 17:47:28', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(3, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MTg1MzgwNywiZXhwIjoxNzY0NDQ1ODA3fQ.mfvZVcAH08Ti3LGOcEnZ2Xd4wUVuUzqIRAovjdYPlSo', '2025-11-29 20:50:07', '2025-10-30 19:50:07', NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(4, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MTg5NjMyMSwiZXhwIjoxNzY0NDg4MzIxfQ.8Y8n2h2lGedZC1jPoqNNI6voiONDXYC6Yvtefp_VoA4', '2025-11-30 08:38:41', '2025-10-31 07:38:41', '2025-10-31 09:56:22', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(5, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MTkwMTA2MCwiZXhwIjoxNzY0NDkzMDYwfQ.zM4muF-yFiMwStZW3Fp-1y1AUVFPKgsVfr40TVnKd4g', '2025-11-30 09:57:40', '2025-10-31 08:57:40', '2025-10-31 10:23:24', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(6, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MTkwMjY0MSwiZXhwIjoxNzY0NDk0NjQxfQ.1SmxfqPlgpprBQbetZzwWorxnkWwgun0qrZXtN1KeoA', '2025-11-30 10:24:01', '2025-10-31 09:24:01', '2025-10-31 10:49:22', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(7, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MTkwNDE3OSwiZXhwIjoxNzY0NDk2MTc5fQ.-rzVXnwvCwritekA3hCf4ljFVwcUSy7QtP6Z-RIosiE', '2025-11-30 10:49:39', '2025-10-31 09:49:39', '2025-10-31 11:50:48', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(8, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MTkwNzg2MywiZXhwIjoxNzY0NDk5ODYzfQ.UYto-fxYkRgDxAZc8EdPK4EVOEB93JOmy-p6kC1G05k', '2025-11-30 11:51:03', '2025-10-31 10:51:03', '2025-10-31 14:50:14', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(9, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MTkxODc1NywiZXhwIjoxNzY0NTEwNzU3fQ.WHQIUHukX08TkZBH-43RTMR1H1Q6ZQOKJFq09ER7ub4', '2025-11-30 14:52:37', '2025-10-31 13:52:37', '2025-10-31 14:53:00', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(10, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MTkxODc5NSwiZXhwIjoxNzY0NTEwNzk1fQ.hjohgdyGRdpRWkSOO8AGE8kUmZvsgxMlZRq3rc3HLpw', '2025-11-30 14:53:15', '2025-10-31 13:53:15', '2025-11-02 11:36:22', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(11, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjA4MDQ4MiwiZXhwIjoxNzY0NjcyNDgyfQ.24hLqy2uftVTwZXaMj6Sf8BC03yfK-henlIhqe0xk8w', '2025-12-02 11:48:02', '2025-11-02 10:48:02', '2025-11-02 12:16:15', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(12, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjE2ODc4MywiZXhwIjoxNzY0NzYwNzgzfQ.WfEdIVaKyB06VQhbhNJy-CkTskuL0Wxv5OCJB3-aCr8', '2025-12-03 12:19:43', '2025-11-03 11:19:43', '2025-11-04 00:39:54', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(13, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MjIwMDU0MiwiZXhwIjoxNzY0NzkyNTQyfQ.ol4kPILOKVG3lb2hn6YTIW6-fTi51YDDw7in7VRFxyo', '2025-12-03 21:09:02', '2025-11-03 20:09:02', '2025-11-04 00:03:55', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'),
(14, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MjIxMzIxNywiZXhwIjoxNzY0ODA1MjE3fQ.f6QnzxDMMW53YeKhQxoAs4k_KK_S5iaiJ2CTFQZFktM', '2025-12-04 00:40:17', '2025-11-03 23:40:17', '2025-11-04 09:33:54', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(15, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjI0NzQ4MywiZXhwIjoxNzY0ODM5NDgzfQ.RmcCf69vq4_nSRnRDgcDo71FhfFjZp3LPq34k43WAtY', '2025-12-04 10:11:23', '2025-11-04 09:11:23', '2025-11-04 10:26:38', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(16, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MjI0ODQyMCwiZXhwIjoxNzY0ODQwNDIwfQ.OMQej-3Xemy1PVVil9hjF-19YTyoDh171FZqpxPjkdM', '2025-12-04 10:27:00', '2025-11-04 09:27:00', '2025-11-04 10:30:32', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(17, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjI1MzUxNywiZXhwIjoxNzY0ODQ1NTE3fQ.N68R-hmuf6-VjRqt1uylaYr1I4lfAqSLcNdpdpBmD9U', '2025-12-04 11:51:57', '2025-11-04 10:51:57', '2025-11-05 22:24:48', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(18, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjM3Nzk5MywiZXhwIjoxNzY0OTY5OTkzfQ.MbXuZaGRwmmwvdw9nZxW5s5ku-Qw8NpCZo66tXN-O5k', '2025-12-05 22:26:33', '2025-11-05 21:26:33', '2025-11-05 23:32:35', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(19, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjQxODgxNiwiZXhwIjoxNzY1MDEwODE2fQ.tl1V8uKcodIawh4xcoi0dxJRsNb3nYx6oRF_G9i82MY', '2025-12-06 09:46:56', '2025-11-06 08:46:56', NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(20, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjQzMjMzMSwiZXhwIjoxNzY1MDI0MzMxfQ.9jFywiAfJPehAJXovjcjg47y5_BbjiHKs77treCHpys', '2025-12-06 13:32:11', '2025-11-06 12:32:11', '2025-11-06 16:21:55', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(21, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MjQ0MjUzMywiZXhwIjoxNzY1MDM0NTMzfQ.vXlh75A6DJBgmDWR4xNRjn1L8nj_CO8g5YNTMHhXcto', '2025-12-06 16:22:13', '2025-11-06 15:22:13', '2025-11-06 16:50:28', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(22, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjQ0NTI5MiwiZXhwIjoxNzY1MDM3MjkyfQ.H_FzX6RHTuUiSLeiIEPtij8mHNOE3ONnfut24NrTdDY', '2025-12-06 17:08:12', '2025-11-06 16:08:12', '2025-11-06 17:27:37', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(23, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MjQ0NjQ3MSwiZXhwIjoxNzY1MDM4NDcxfQ.Lmke0bRBRydzXPnjn86M9E63XDZTSEYJ_qbnhyyZgYw', '2025-12-06 17:27:51', '2025-11-06 16:27:51', '2025-11-06 17:33:20', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(24, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjQ0Njg1OSwiZXhwIjoxNzY1MDM4ODU5fQ.HaTVMWODuU2CaBC6c381hJroTq3X7gbTOqi9XDDDxdQ', '2025-12-06 17:34:19', '2025-11-06 16:34:19', '2025-11-06 18:23:04', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(25, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2MjY4NjM2OSwiZXhwIjoxNzY1Mjc4MzY5fQ.8Oo5lj-i59sAcWTQ0gUtx2H-NaD_gj6WrvhbWpk1hFY', '2025-12-09 12:06:09', '2025-11-09 11:06:09', '2025-11-09 13:00:23', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(26, 2, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYS5zYWlkQGRyd2ludGVjaC5jb20iLCJyb2xlIjoic3R1ZGVudCIsImlhdCI6MTc2MjY4OTYzOSwiZXhwIjoxNzY1MjgxNjM5fQ.vRA2h5E9dKdD0fE9uIzCxJs3H_t1U5fcC5X-TLsKn_M', '2025-12-09 13:00:39', '2025-11-09 12:00:39', '2025-11-09 13:34:42', '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(27, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWhldGFuc2FpZEBnbWFpbC5jb20iLCJyb2xlIjoiaW5zdHJ1Y3RvciIsImlhdCI6MTc2Mjc2Nzc5OSwiZXhwIjoxNzY1MzU5Nzk5fQ.bFh1PHpL-ZnqlKMThUdqAogKtjONK6zIgdLRyeJXHDs', '2025-12-10 10:43:19', '2025-11-10 09:43:19', NULL, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0'),
(28, 75, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc1LCJlbWFpbCI6ImFiZG91YmFjaGFiaWtvd2l5b3VAZ21haWwuY29tIiwicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3NjI3ODI3NzEsImV4cCI6MTc2NTM3NDc3MX0.Y1TPswRvmZ_74-SVXfx3HiUa0vIVheDq52KD7saQOy4', '2025-12-10 14:52:51', '2025-11-10 13:52:51', '2025-11-11 08:42:13', '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'),
(29, 76, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc2LCJlbWFpbCI6InRlc3QuZ29iaUBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYyODQ1NzMwLCJleHAiOjE3NjU0Mzc3MzB9.O8h6J2fWoz7Ql6adMiTry4nGyUAGqnh5N0IuA-e-Cxw', '2025-12-11 08:22:10', '2025-11-11 07:22:10', NULL, '::1', 'curl/8.5.0'),
(30, 76, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc2LCJlbWFpbCI6InRlc3QuZ29iaUBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYyODQ2OTQ4LCJleHAiOjE3NjU0Mzg5NDh9.8KctZ_KZXYZbls3E3TUrJ2HQWizhOlUjblnTtlcDpXM', '2025-12-11 08:42:28', '2025-11-11 07:42:28', '2025-11-11 09:26:15', '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'),
(31, 76, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc2LCJlbWFpbCI6InRlc3QuZ29iaUBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYyODQ5NTkwLCJleHAiOjE3NjU0NDE1OTB9.o7V4EnUS7djIAwuLFQimp7fDXfJBXgcmtVDKfq86X7A', '2025-12-11 09:26:30', '2025-11-11 08:26:30', '2025-11-11 09:39:53', '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'),
(32, 76, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc2LCJlbWFpbCI6InRlc3QuZ29iaUBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYyODUwNDEwLCJleHAiOjE3NjU0NDI0MTB9.K_R7PfX-Keyryyee7mpKBvuqrxYe9XTeARgBsFdXkUA', '2025-12-11 09:40:10', '2025-11-11 08:40:10', '2025-11-12 10:52:41', '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'),
(33, 76, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc2LCJlbWFpbCI6InRlc3QuZ29iaUBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYyOTQxMjExLCJleHAiOjE3NjU1MzMyMTF9.JOe-rn14XwW_u475madEz5qpAPHHtWJlqrg-83JGvt4', '2025-12-12 10:53:31', '2025-11-12 09:53:31', NULL, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'),
(34, 76, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc2LCJlbWFpbCI6InRlc3QuZ29iaUBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYzMDI1ODIzLCJleHAiOjE3NjU2MTc4MjN9.zQn1jdfDvpfippTEROrWvhpAgnYsetoNfpsLtJnA8HY', '2025-12-13 10:23:43', '2025-11-13 09:23:43', NULL, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'),
(35, 75, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc1LCJlbWFpbCI6ImFiZG91YmFjaGFiaWtvd2l5b3VAZ21haWwuY29tIiwicm9sZSI6Imluc3RydWN0b3IiLCJpYXQiOjE3NjMwMjYyMzUsImV4cCI6MTc2NTYxODIzNX0.kwZgg-JbZq2mXuDRJ7cDjxLbLJeN1Mf2LSgsoV75I_Y', '2025-12-13 10:30:35', '2025-11-13 09:30:35', '2025-11-13 11:03:34', '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'),
(36, 75, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc1LCJlbWFpbCI6ImFiZG91YmFjaGFiaWtvd2l5b3VAZ21haWwuY29tIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzYzMDI4MjI0LCJleHAiOjE3NjU2MjAyMjR9.nXuHNgDeihOwbqaHagO0RwmTaaVY0BgjKUdTmK2T5Y8', '2025-12-13 11:03:44', '2025-11-13 10:03:44', '2025-11-13 12:05:50', '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'),
(37, 76, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc2LCJlbWFpbCI6InRlc3QuZ29iaUBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYzMDMxNjMzLCJleHAiOjE3NjU2MjM2MzN9._fWtWFI0c9BajHFCaxgNR5EyPR9TydRJ3_E3OgR4c7Y', '2025-12-13 12:00:33', '2025-11-13 11:00:33', NULL, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'),
(38, 75, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc1LCJlbWFpbCI6ImFiZG91YmFjaGFiaWtvd2l5b3VAZ21haWwuY29tIiwicm9sZSI6Imluc3RydWN0b3IiLCJpYXQiOjE3NjMwMzE5NTgsImV4cCI6MTc2NTYyMzk1OH0.sFEmXAxNRGaaJ87qpYGlC_L9k-0XeCIevMJQdT_riqY', '2025-12-13 12:05:58', '2025-11-13 11:05:58', '2025-11-13 15:28:54', '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'),
(39, 76, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc2LCJlbWFpbCI6InRlc3QuZ29iaUBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYzMDQ0MDQwLCJleHAiOjE3NjU2MzYwNDB9.jtkN4j27ZMVhOkg7-FacYfKr9RTYRDW14XtrnHzbCBs', '2025-12-13 15:27:20', '2025-11-13 14:27:20', NULL, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'),
(40, 76, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc2LCJlbWFpbCI6InRlc3QuZ29iaUBleGFtcGxlLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzYzMDQ0MTgzLCJleHAiOjE3NjU2MzYxODN9.r05dl_xnl7bgNu7u9_5Psdgw052i9ZdXJCzVUEIW2nU', '2025-12-13 15:29:43', '2025-11-13 14:29:43', '2025-11-13 15:31:04', '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'),
(41, 75, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjc1LCJlbWFpbCI6ImFiZG91YmFjaGFiaWtvd2l5b3VAZ21haWwuY29tIiwicm9sZSI6Imluc3RydWN0b3IiLCJpYXQiOjE3NjMwNDQyNzMsImV4cCI6MTc2NTYzNjI3M30.7dMio17kMC8xtapfvz9oBXSpSSatHanbsAjhf0eVNBk', '2025-12-13 15:31:13', '2025-11-13 14:31:13', NULL, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36');

-- --------------------------------------------------------

--
-- Structure de la table `student_preferences`
--

CREATE TABLE `student_preferences` (
  `user_id` int(11) NOT NULL,
  `preferences` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`preferences`)),
  `updated_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `student_preferences`
--

INSERT INTO `student_preferences` (`user_id`, `preferences`, `updated_at`) VALUES
(76, '{\"language\":\"fr\",\"theme\":\"light\",\"policies\":{\"accepted\":true,\"accepted_at\":\"2025-11-11T17:50:20.526Z\",\"version\":\"2025-11-11\"},\"notifications\":{\"course_reminders\":true,\"quiz_reminders\":true,\"new_messages\":true,\"achievements\":true},\"learning\":{\"study_mode\":\"intensive\",\"time_reminder\":true}}', '2025-11-11 17:50:09');

-- --------------------------------------------------------

--
-- Structure de la table `system_events`
--

CREATE TABLE `system_events` (
  `id` int(11) NOT NULL,
  `event_type` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `user_id` int(11) DEFAULT NULL,
  `course_id` int(11) DEFAULT NULL,
  `severity` enum('info','warning','error') DEFAULT 'info'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `google_id` varchar(255) DEFAULT NULL,
  `profile_picture` varchar(500) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `npi` varchar(50) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `country` varchar(3) DEFAULT NULL,
  `is_email_verified` tinyint(1) DEFAULT 0,
  `email_verified_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `role` enum('student','instructor','admin') DEFAULT 'student',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `email`, `google_id`, `profile_picture`, `password`, `first_name`, `last_name`, `npi`, `phone`, `organization`, `country`, `is_email_verified`, `email_verified_at`, `is_active`, `role`, `created_at`, `updated_at`, `last_login_at`) VALUES
(1, 'ahetansaid@gmail.com', NULL, NULL, '$2b$12$a7dyLYWcmISCmNxr2BIE0ebn50a9sdEzJWla5D/HdwCuLVPGH57Ki', 'Davis', 'Borgia', NULL, '+225647891384', 'PNUD', 'BJ', 1, '2025-10-30 16:07:50', 1, 'instructor', '2025-10-30 15:06:45', '2025-11-10 09:43:19', '2025-11-10 10:43:19'),
(2, 'a.said@drwintech.com', NULL, NULL, '$2b$12$xhCHZ0h2R4rqsHaU3MZQIu0YSECez6YJLkMojQeh5D7WTsu/0i/Se', 'Bravo', 'Alex', NULL, '+22889977445', 'PNUD', 'BJ', 1, '2025-10-30 17:04:33', 1, 'student', '2025-10-30 16:03:09', '2025-11-09 12:00:39', '2025-11-09 13:00:39'),
(51, 'student1@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Lina', 'Rossi', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-06-29 07:35:02', '2025-10-31 07:35:02', NULL),
(52, 'student2@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Omar', 'Dupont', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-10-22 07:35:02', '2025-10-31 07:35:02', NULL),
(53, 'student3@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Zoé', 'Nguyen', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-10-07 07:35:02', '2025-10-31 07:35:02', NULL),
(54, 'student4@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Marie', 'Martin', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-05-22 07:35:02', '2025-10-31 07:35:02', NULL),
(55, 'student5@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Jean', 'Bernard', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-05-21 07:35:02', '2025-10-31 07:35:02', NULL),
(56, 'student6@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Sophie', 'Dubois', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-10-28 07:35:02', '2025-10-31 07:35:02', NULL),
(57, 'student7@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Ahmed', 'Moreau', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-10-14 07:35:02', '2025-10-31 07:35:02', NULL),
(58, 'student8@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Emma', 'Laurent', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-09-21 07:35:02', '2025-10-31 07:35:02', NULL),
(59, 'student9@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Thomas', 'Simon', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-05-16 07:35:02', '2025-10-31 07:35:02', NULL),
(60, 'student10@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Sarah', 'Lefebvre', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-07-07 07:35:02', '2025-10-31 07:35:02', NULL),
(61, 'student11@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Paul', 'Michel', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-09-19 07:35:02', '2025-10-31 07:35:02', NULL),
(62, 'student12@example.com', NULL, NULL, '$2b$12$Mme9mVbAVwGZdcmFjcbWUuwFZl6a01AYOeb7MxaXfhfhUjvKj3bb2', 'Julie', 'Garcia', NULL, NULL, NULL, NULL, 1, NULL, 1, 'student', '2025-08-27 07:35:02', '2025-10-31 07:35:02', NULL),
(65, 'admin@mdsc.org', NULL, NULL, '$2b$10$u.bJvqZ41ZNG6boMxbMfe.cDsvGUaOgOFF1iTM0S3JUpjh4QlxvsK', 'Admin', 'System', NULL, NULL, NULL, NULL, 1, '2025-11-06 13:07:34', 1, 'admin', '2025-11-06 12:07:34', '2025-11-06 12:07:34', NULL),
(69, 'admin@drwintech.com', NULL, NULL, '$2b$10$zTR.ZvnpBatB9BJK4UplNu/Um83TTLz1Xdas/NmBcVn6LKZXNT61m', 'Admin', 'Drwintech', NULL, NULL, NULL, NULL, 1, '2025-11-06 17:56:40', 1, 'admin', '2025-11-06 16:56:40', '2025-11-06 16:56:40', NULL),
(75, 'abdoubachabikowiyou@gmail.com', NULL, NULL, '$2b$12$9a2ucaRqYBv3g81iaF.liOXfAmirUQTkvGN2WA6LjS6CqJVcfPQf2', 'Abdou kowiyou', 'BACHABI', NULL, '+22997566439', 'Drwintech Inc', 'BJ', 1, '2025-11-10 14:52:34', 1, 'instructor', '2025-11-10 13:51:54', '2025-11-13 14:31:13', '2025-11-13 15:31:13'),
(76, 'test.gobi@example.com', NULL, NULL, '$2b$12$9a2ucaRqYBv3g81iaF.liOXfAmirUQTkvGN2WA6LjS6CqJVcfPQf2', 'Test', 'Gobi', NULL, '22961000000', 'TestOrg', 'BJ', 1, '2025-11-11 08:22:01', 1, 'student', '2025-11-11 07:21:32', '2025-11-13 14:29:43', '2025-11-13 15:29:43');

-- --------------------------------------------------------

--
-- Structure de la table `user_activities`
--

CREATE TABLE `user_activities` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `activity_type` varchar(100) NOT NULL,
  `points_earned` int(11) DEFAULT 0,
  `description` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `user_activities`
--

INSERT INTO `user_activities` (`id`, `user_id`, `activity_type`, `points_earned`, `description`, `metadata`, `created_at`) VALUES
(111, 76, 'course_enrolled', 10, 'Réinscription au cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"reactivated\":true}', '2025-11-13 15:30:51'),
(112, 76, 'course_unenrolled', 0, 'Désinscription du cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":\"47\",\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\"}', '2025-11-13 15:31:04'),
(113, 76, 'course_enrolled', 10, 'Réinscription au cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"reactivated\":true}', '2025-11-13 15:35:25'),
(114, 76, 'lesson_completed', 10, 'Leçon \"Introduction au Web\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"359\",\"lessonTitle\":\"Introduction au Web\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 15:38:17'),
(115, 76, 'lesson_completed', 10, 'Leçon \"Les Outils du Développeur\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"360\",\"lessonTitle\":\"Les Outils du Développeur\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 15:39:24'),
(116, 76, 'lesson_completed', 10, 'Leçon \"Vidéo : Installation de l\'Environnement\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"361\",\"lessonTitle\":\"Vidéo : Installation de l\'Environnement\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 15:40:18'),
(117, 76, 'module_completed', 25, 'Module \"Module 1 : Introduction au Développement Web\" terminé', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 15:40:18'),
(118, 76, 'course_enrolled', 10, 'Réinscription au cours \"Parcours Gestion du Temps\"', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"reactivated\":true}', '2025-11-13 15:45:25'),
(119, 76, 'lesson_completed', 10, 'Leçon \"Observer ses journées\" terminée', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"lessonId\":\"332\",\"lessonTitle\":\"Observer ses journées\",\"moduleId\":134,\"moduleTitle\":\"Module 1 - Diagnostiquer son temps\"}', '2025-11-13 15:45:44'),
(120, 76, 'lesson_completed', 10, 'Leçon \"Identifier les priorités\" terminée', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"lessonId\":\"333\",\"lessonTitle\":\"Identifier les priorités\",\"moduleId\":134,\"moduleTitle\":\"Module 1 - Diagnostiquer son temps\"}', '2025-11-13 15:45:47'),
(121, 76, 'module_completed', 25, 'Module \"Module 1 - Diagnostiquer son temps\" terminé', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"moduleId\":134,\"moduleTitle\":\"Module 1 - Diagnostiquer son temps\"}', '2025-11-13 15:45:47'),
(122, 76, 'lesson_completed', 10, 'Leçon \"Construire un planning hebdomadaire\" terminée', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"lessonId\":\"334\",\"lessonTitle\":\"Construire un planning hebdomadaire\",\"moduleId\":135,\"moduleTitle\":\"Module 2 - Planifier et prioriser\"}', '2025-11-13 15:45:55'),
(123, 76, 'lesson_completed', 10, 'Leçon \"Gérer les imprévus\" terminée', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"lessonId\":\"335\",\"lessonTitle\":\"Gérer les imprévus\",\"moduleId\":135,\"moduleTitle\":\"Module 2 - Planifier et prioriser\"}', '2025-11-13 15:45:58'),
(124, 76, 'module_completed', 25, 'Module \"Module 2 - Planifier et prioriser\" terminé', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"moduleId\":135,\"moduleTitle\":\"Module 2 - Planifier et prioriser\"}', '2025-11-13 15:45:58'),
(125, 76, 'lesson_completed', 10, 'Leçon \"Mettre en place des routines\" terminée', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"lessonId\":\"336\",\"lessonTitle\":\"Mettre en place des routines\",\"moduleId\":136,\"moduleTitle\":\"Module 3 - Routines et suivi\"}', '2025-11-13 15:46:02'),
(126, 76, 'lesson_completed', 10, 'Leçon \"Suivre ses progrès\" terminée', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"lessonId\":\"337\",\"lessonTitle\":\"Suivre ses progrès\",\"moduleId\":136,\"moduleTitle\":\"Module 3 - Routines et suivi\"}', '2025-11-13 15:46:05'),
(127, 76, 'module_completed', 25, 'Module \"Module 3 - Routines et suivi\" terminé', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\",\"moduleId\":136,\"moduleTitle\":\"Module 3 - Routines et suivi\"}', '2025-11-13 15:46:05'),
(128, 76, 'course_completed', 100, 'Cours \"Parcours Gestion du Temps\" terminé', '{\"courseId\":42,\"courseTitle\":\"Parcours Gestion du Temps\"}', '2025-11-13 15:46:05'),
(129, 76, 'lesson_completed', 10, 'Leçon \"HTML5 : Structure Sémantique\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"362\",\"lessonTitle\":\"HTML5 : Structure Sémantique\",\"moduleId\":149,\"moduleTitle\":\"Module 2 : HTML5 et CSS3 Avancés\"}', '2025-11-13 16:12:30'),
(130, 76, 'lesson_completed', 10, 'Leçon \"CSS3 : Flexbox et Grid\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"363\",\"lessonTitle\":\"CSS3 : Flexbox et Grid\",\"moduleId\":149,\"moduleTitle\":\"Module 2 : HTML5 et CSS3 Avancés\"}', '2025-11-13 16:12:38'),
(131, 76, 'lesson_completed', 10, 'Leçon \"Audio : Podcast sur les Bonnes Pratiques CSS\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"364\",\"lessonTitle\":\"Audio : Podcast sur les Bonnes Pratiques CSS\",\"moduleId\":149,\"moduleTitle\":\"Module 2 : HTML5 et CSS3 Avancés\"}', '2025-11-13 16:15:09'),
(132, 76, 'module_completed', 25, 'Module \"Module 2 : HTML5 et CSS3 Avancés\" terminé', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"moduleId\":149,\"moduleTitle\":\"Module 2 : HTML5 et CSS3 Avancés\"}', '2025-11-13 16:15:09'),
(133, 76, 'lesson_completed', 10, 'Leçon \"JavaScript ES6+ : Les Nouvelles Fonctionnalités\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"365\",\"lessonTitle\":\"JavaScript ES6+ : Les Nouvelles Fonctionnalités\",\"moduleId\":150,\"moduleTitle\":\"Module 3 : JavaScript Moderne\"}', '2025-11-13 16:21:03'),
(134, 76, 'lesson_completed', 10, 'Leçon \"Vidéo : Projet Pratique JavaScript\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"366\",\"lessonTitle\":\"Vidéo : Projet Pratique JavaScript\",\"moduleId\":150,\"moduleTitle\":\"Module 3 : JavaScript Moderne\"}', '2025-11-13 16:21:06'),
(135, 76, 'course_unenrolled', 0, 'Désinscription du cours \"Parcours Gestion du Temps\"', '{\"courseId\":\"42\",\"courseTitle\":\"Parcours Gestion du Temps\"}', '2025-11-13 16:50:24'),
(136, 76, 'course_unenrolled', 0, 'Désinscription du cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":\"47\",\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\"}', '2025-11-13 16:50:26'),
(137, 76, 'course_enrolled', 10, 'Inscription au cours \"UI/UX Design Fundamentals\"', '{\"courseId\":34,\"courseTitle\":\"UI/UX Design Fundamentals\"}', '2025-11-13 17:07:12'),
(138, 76, 'course_unenrolled', 0, 'Désinscription du cours \"UI/UX Design Fundamentals\"', '{\"courseId\":\"34\",\"courseTitle\":\"UI/UX Design Fundamentals\"}', '2025-11-13 17:07:37'),
(139, 76, 'course_enrolled', 10, 'Réinscription au cours \"UI/UX Design Fundamentals\"', '{\"courseId\":34,\"courseTitle\":\"UI/UX Design Fundamentals\",\"reactivated\":true}', '2025-11-13 17:08:51'),
(140, 76, 'course_enrolled', 10, 'Inscription au cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\"}', '2025-11-13 17:23:18'),
(141, 76, 'course_unenrolled', 0, 'Désinscription du cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":\"47\",\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\"}', '2025-11-13 17:34:16'),
(142, 76, 'course_enrolled', 10, 'Réinscription au cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"reactivated\":true}', '2025-11-13 17:37:15'),
(143, 76, 'lesson_completed', 10, 'Leçon \"Introduction au Web\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"359\",\"lessonTitle\":\"Introduction au Web\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 17:37:26'),
(144, 76, 'lesson_completed', 10, 'Leçon \"Les Outils du Développeur\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"360\",\"lessonTitle\":\"Les Outils du Développeur\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 17:37:32'),
(145, 76, 'lesson_completed', 10, 'Leçon \"Vidéo : Installation de l\'Environnement\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"361\",\"lessonTitle\":\"Vidéo : Installation de l\'Environnement\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 17:37:35'),
(146, 76, 'module_completed', 25, 'Module \"Module 1 : Introduction au Développement Web\" terminé', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 17:37:35'),
(147, 76, 'course_unenrolled', 0, 'Désinscription du cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":\"47\",\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\"}', '2025-11-13 17:38:26'),
(148, 76, 'course_enrolled', 10, 'Réinscription au cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"reactivated\":true}', '2025-11-13 18:51:19'),
(149, 76, 'badge_earned', 0, 'Badge gagné : Premier Pas', '{\"badge_id\":1,\"badge_name\":\"Premier Pas\"}', '2025-11-13 18:51:19'),
(150, 76, 'course_enrolled', 10, 'Inscription au cours \"Marketing Google Afs\"', '{\"courseId\":46,\"courseTitle\":\"Marketing Google Afs\"}', '2025-11-13 18:56:53'),
(151, 76, 'course_unenrolled', 0, 'Désinscription du cours \"Marketing Google Afs\"', '{\"courseId\":\"46\",\"courseTitle\":\"Marketing Google Afs\"}', '2025-11-13 18:57:25'),
(152, 76, 'lesson_completed', 10, 'Leçon \"Introduction au Web\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"359\",\"lessonTitle\":\"Introduction au Web\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 18:57:36'),
(153, 76, 'lesson_completed', 10, 'Leçon \"Les Outils du Développeur\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"360\",\"lessonTitle\":\"Les Outils du Développeur\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 18:57:44'),
(154, 76, 'lesson_completed', 10, 'Leçon \"Vidéo : Installation de l\'Environnement\" terminée', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"lessonId\":\"361\",\"lessonTitle\":\"Vidéo : Installation de l\'Environnement\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 18:57:47'),
(155, 76, 'module_completed', 25, 'Module \"Module 1 : Introduction au Développement Web\" terminé', '{\"courseId\":47,\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\",\"moduleId\":148,\"moduleTitle\":\"Module 1 : Introduction au Développement Web\"}', '2025-11-13 18:57:47'),
(156, 76, 'course_unenrolled', 0, 'Désinscription du cours \"Formation Complète : Développement Web Full-Stack\"', '{\"courseId\":\"47\",\"courseTitle\":\"Formation Complète : Développement Web Full-Stack\"}', '2025-11-13 18:58:58');

-- --------------------------------------------------------

--
-- Structure de la table `user_badges`
--

CREATE TABLE `user_badges` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `badge_id` int(11) NOT NULL,
  `earned_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `user_badges`
--

INSERT INTO `user_badges` (`id`, `user_id`, `badge_id`, `earned_at`) VALUES
(1, 76, 1, '2025-11-13 18:51:19');

-- --------------------------------------------------------

--
-- Structure de la table `user_evaluations`
--

CREATE TABLE `user_evaluations` (
  `id` int(11) NOT NULL,
  `evaluation_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `answers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`answers`)),
  `score` decimal(5,2) DEFAULT NULL,
  `status` enum('not_started','in_progress','submitted','graded') DEFAULT 'not_started',
  `feedback` text DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `graded_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `user_files`
--

CREATE TABLE `user_files` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `file_type` enum('profile_picture','identity_document','certificate','other') NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` int(11) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `is_verified` tinyint(1) DEFAULT 0,
  `verified_at` timestamp NULL DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `user_files`
--

INSERT INTO `user_files` (`id`, `user_id`, `file_type`, `file_name`, `original_name`, `file_path`, `file_size`, `mime_type`, `is_verified`, `verified_at`, `verified_by`, `created_at`, `updated_at`) VALUES
(8, 1, 'identity_document', '1-file-1761907372588-81690842.pdf', 'a7a99731-c52b-46a7-8328-248ad6786772.pdf', 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-file-1761907372588-81690842.pdf', 21390, 'application/pdf', 0, NULL, NULL, '2025-10-31 10:42:52', '2025-10-31 10:42:52'),
(9, 2, 'profile_picture', '2-file-1761908932990-317171436.jpeg', 'apprenant.jpeg', 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\2-file-1761908932990-317171436.jpeg', 274965, 'image/jpeg', 0, NULL, NULL, '2025-10-31 11:08:53', '2025-10-31 11:08:53'),
(10, 2, 'identity_document', '2-file-1761909322415-21966064.pdf', 'a7a99731-c52b-46a7-8328-248ad6786772.pdf', 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\2-file-1761909322415-21966064.pdf', 21390, 'application/pdf', 0, NULL, NULL, '2025-10-31 11:15:22', '2025-10-31 11:15:22'),
(19, 1, 'profile_picture', '1-1762445571355-228997364.jpg', '92931ffb-1a09-49ad-98cd-08d53dcdcbfe.jpg', 'C:\\xampp\\htdocs\\deploy_mdsc\\mdsc_backend_1\\uploads\\profiles\\1-1762445571355-228997364.jpg', 78742, 'image/jpeg', 0, NULL, NULL, '2025-11-06 16:12:51', '2025-11-06 16:12:51'),
(23, 75, 'profile_picture', '75-1763027470757-118317876.jpg', 'ads.jpg', '/home/drwintech/Documents/mdsc_auth_api/uploads/profiles/75-1763027470757-118317876.jpg', 72058, 'image/jpeg', 0, NULL, NULL, '2025-11-13 09:51:10', '2025-11-13 09:51:10');

-- --------------------------------------------------------

--
-- Structure de la table `user_points`
--

CREATE TABLE `user_points` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `points` int(11) DEFAULT 0,
  `level` int(11) DEFAULT 1,
  `total_points_earned` int(11) DEFAULT 0,
  `last_activity_at` timestamp NULL DEFAULT current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `user_quiz_answers`
--

CREATE TABLE `user_quiz_answers` (
  `id` int(11) NOT NULL,
  `attempt_id` int(11) NOT NULL,
  `question_id` int(11) NOT NULL,
  `answer_id` int(11) DEFAULT NULL,
  `answer_text` text DEFAULT NULL,
  `is_correct` tinyint(1) DEFAULT 0,
  `points_earned` decimal(5,2) DEFAULT 0.00,
  `answered_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure de la table `user_sessions`
--

CREATE TABLE `user_sessions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `login_at` datetime NOT NULL,
  `logout_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `user_sessions`
--

INSERT INTO `user_sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `login_at`, `logout_at`) VALUES
(25, 1, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-09 12:06:09', NULL),
(26, 2, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-09 13:00:39', NULL),
(27, 1, '::ffff:127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0', '2025-11-10 10:43:19', NULL),
(28, 75, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', '2025-11-10 14:52:51', NULL),
(29, 76, '::1', 'curl/8.5.0', '2025-11-11 08:22:11', NULL),
(30, 76, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', '2025-11-11 08:42:28', NULL),
(31, 76, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', '2025-11-11 09:26:30', NULL),
(32, 76, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', '2025-11-11 09:40:10', NULL),
(33, 76, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', '2025-11-12 10:53:31', NULL),
(34, 76, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', '2025-11-13 10:23:43', NULL),
(35, 75, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', '2025-11-13 10:30:35', NULL),
(36, 75, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', '2025-11-13 11:03:44', NULL),
(37, 76, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', '2025-11-13 12:00:33', NULL),
(38, 75, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', '2025-11-13 12:05:58', NULL),
(39, 76, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', '2025-11-13 15:27:20', NULL),
(40, 76, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', '2025-11-13 15:29:43', NULL),
(41, 75, '::1', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', '2025-11-13 15:31:13', NULL);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `admin_2fa_codes`
--
ALTER TABLE `admin_2fa_codes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_admin_id` (`admin_id`),
  ADD KEY `idx_code` (`code`),
  ADD KEY `idx_expires_at` (`expires_at`),
  ADD KEY `idx_used` (`used`);

--
-- Index pour la table `admin_login_logs`
--
ALTER TABLE `admin_login_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_admin_id` (`admin_id`),
  ADD KEY `idx_success` (`success`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Index pour la table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `session_token` (`session_token`),
  ADD KEY `idx_admin_id` (`admin_id`),
  ADD KEY `idx_session_token` (`session_token`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Index pour la table `ai_conversations`
--
ALTER TABLE `ai_conversations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_active` (`is_active`);

--
-- Index pour la table `ai_messages`
--
ALTER TABLE `ai_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_conversation` (`conversation_id`),
  ADD KEY `idx_role` (`role`);

--
-- Index pour la table `badges`
--
ALTER TABLE `badges`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_points` (`points_required`),
  ADD KEY `idx_active` (`is_active`);

--
-- Index pour la table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_name` (`name`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Index pour la table `certificates`
--
ALTER TABLE `certificates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `certificate_code` (`certificate_code`),
  ADD UNIQUE KEY `certificate_number` (`certificate_number`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_certificate_number` (`certificate_number`),
  ADD KEY `idx_issued_at` (`issued_at`),
  ADD KEY `idx_valid` (`is_valid`),
  ADD KEY `idx_certificate_code` (`certificate_code`),
  ADD KEY `idx_verified` (`verified`),
  ADD KEY `idx_request_id` (`request_id`);

--
-- Index pour la table `certificate_requests`
--
ALTER TABLE `certificate_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_enrollment_id` (`enrollment_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_course_id` (`course_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_reviewed_by` (`reviewed_by`);

--
-- Index pour la table `courses`
--
ALTER TABLE `courses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`),
  ADD KEY `idx_instructor` (`instructor_id`),
  ADD KEY `idx_category` (`category_id`),
  ADD KEY `idx_published` (`is_published`),
  ADD KEY `idx_featured` (`is_featured`),
  ADD KEY `idx_difficulty` (`difficulty`),
  ADD KEY `idx_language` (`language`),
  ADD KEY `idx_slug` (`slug`),
  ADD KEY `idx_prerequisite` (`prerequisite_course_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_approved_by` (`approved_by`),
  ADD KEY `idx_course_type` (`course_type`);

--
-- Index pour la table `course_analytics`
--
ALTER TABLE `course_analytics`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_course` (`course_id`),
  ADD KEY `idx_course_analytics_views` (`total_views`),
  ADD KEY `idx_course_analytics_updated` (`updated_at`);

--
-- Index pour la table `course_approvals`
--
ALTER TABLE `course_approvals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_course_id` (`course_id`),
  ADD KEY `idx_admin_id` (`admin_id`),
  ADD KEY `idx_status` (`status`);

--
-- Index pour la table `course_evaluations`
--
ALTER TABLE `course_evaluations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `course_id` (`course_id`),
  ADD KEY `idx_course_id` (`course_id`),
  ADD KEY `idx_is_published` (`is_published`);

--
-- Index pour la table `course_favorites`
--
ALTER TABLE `course_favorites`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_favorite` (`user_id`,`course_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_course` (`course_id`);

--
-- Index pour la table `course_reviews`
--
ALTER TABLE `course_reviews`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_review` (`user_id`,`course_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_rating` (`rating`),
  ADD KEY `idx_approved` (`is_approved`);

--
-- Index pour la table `email_verification_tokens`
--
ALTER TABLE `email_verification_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Index pour la table `enrollments`
--
ALTER TABLE `enrollments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_enrollment` (`user_id`,`course_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_progress` (`progress_percentage`),
  ADD KEY `idx_completed` (`completed_at`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_payment_id` (`payment_id`);

--
-- Index pour la table `evaluations`
--
ALTER TABLE `evaluations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_instructor` (`instructor_id`),
  ADD KEY `idx_due_date` (`due_date`);

--
-- Index pour la table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_events_start_date` (`start_date`),
  ADD KEY `idx_events_course` (`course_id`),
  ADD KEY `idx_events_creator` (`created_by`);

--
-- Index pour la table `event_attendees`
--
ALTER TABLE `event_attendees`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_event_attendee` (`event_id`,`user_id`),
  ADD KEY `idx_event_attendees_event` (`event_id`),
  ADD KEY `idx_event_attendees_user` (`user_id`);

--
-- Index pour la table `lessons`
--
ALTER TABLE `lessons`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_order` (`course_id`,`order_index`),
  ADD KEY `idx_published` (`is_published`),
  ADD KEY `idx_module` (`module_id`),
  ADD KEY `idx_content_type` (`content_type`),
  ADD KEY `idx_media_file` (`media_file_id`),
  ADD KEY `idx_is_optional` (`is_optional`);

--
-- Index pour la table `lesson_progress`
--
ALTER TABLE `lesson_progress`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_lesson_progress` (`user_id`,`lesson_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_lesson` (`lesson_id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_completed` (`is_completed`);

--
-- Index pour la table `media_files`
--
ALTER TABLE `media_files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_lesson` (`lesson_id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_category` (`file_category`),
  ADD KEY `idx_uploaded_by` (`uploaded_by`);

--
-- Index pour la table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sender` (`sender_id`),
  ADD KEY `idx_recipient` (`recipient_id`),
  ADD KEY `idx_unread` (`recipient_id`,`is_read`),
  ADD KEY `idx_created` (`created_at`),
  ADD KEY `idx_sender_email` (`sender_email`),
  ADD KEY `idx_recipient_email` (`recipient_email`);

--
-- Index pour la table `modules`
--
ALTER TABLE `modules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_order` (`course_id`,`order_index`),
  ADD KEY `idx_unlocked` (`is_unlocked`);

--
-- Index pour la table `module_quizzes`
--
ALTER TABLE `module_quizzes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `module_id` (`module_id`),
  ADD KEY `idx_module_id` (`module_id`),
  ADD KEY `idx_badge_id` (`badge_id`),
  ADD KEY `idx_is_published` (`is_published`);

--
-- Index pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_user` (`user_id`),
  ADD KEY `idx_notifications_type` (`type`),
  ADD KEY `idx_notifications_is_read` (`is_read`),
  ADD KEY `idx_notifications_created_at` (`created_at`),
  ADD KEY `idx_notifications_expires_at` (`expires_at`);

--
-- Index pour la table `oauth_role_tokens`
--
ALTER TABLE `oauth_role_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Index pour la table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Index pour la table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payments_user_id` (`user_id`),
  ADD KEY `idx_payments_course_id` (`course_id`),
  ADD KEY `idx_payments_status` (`status`),
  ADD KEY `idx_payments_provider_tx` (`provider_transaction_id`),
  ADD KEY `idx_payments_completed_at` (`completed_at`);

--
-- Index pour la table `performance_metrics`
--
ALTER TABLE `performance_metrics`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_performance_metrics_name` (`metric_name`),
  ADD KEY `idx_performance_metrics_recorded_at` (`recorded_at`);

--
-- Index pour la table `progress`
--
ALTER TABLE `progress`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_progress` (`enrollment_id`,`lesson_id`),
  ADD KEY `idx_enrollment` (`enrollment_id`),
  ADD KEY `idx_lesson` (`lesson_id`),
  ADD KEY `idx_status` (`status`);

--
-- Index pour la table `quizzes`
--
ALTER TABLE `quizzes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_lesson` (`lesson_id`),
  ADD KEY `idx_published` (`is_published`);

--
-- Index pour la table `quiz_answers`
--
ALTER TABLE `quiz_answers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_question` (`question_id`),
  ADD KEY `idx_correct` (`is_correct`),
  ADD KEY `idx_order` (`question_id`,`order_index`);

--
-- Index pour la table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_quiz` (`quiz_id`),
  ADD KEY `idx_course` (`course_id`),
  ADD KEY `idx_score` (`score`),
  ADD KEY `idx_passed` (`is_passed`),
  ADD KEY `idx_course_evaluation_id` (`course_evaluation_id`),
  ADD KEY `idx_module_quiz_id` (`module_quiz_id`),
  ADD KEY `idx_enrollment_id` (`enrollment_id`);

--
-- Index pour la table `quiz_questions`
--
ALTER TABLE `quiz_questions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_quiz` (`quiz_id`),
  ADD KEY `idx_order` (`quiz_id`,`order_index`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_course_evaluation_id` (`course_evaluation_id`),
  ADD KEY `idx_module_quiz_id` (`module_quiz_id`);

--
-- Index pour la table `recommendations`
--
ALTER TABLE `recommendations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_type` (`recommendation_type`);

--
-- Index pour la table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Index pour la table `student_preferences`
--
ALTER TABLE `student_preferences`
  ADD PRIMARY KEY (`user_id`);

--
-- Index pour la table `system_events`
--
ALTER TABLE `system_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `course_id` (`course_id`),
  ADD KEY `idx_system_events_type` (`event_type`),
  ADD KEY `idx_system_events_created_at` (`created_at`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `google_id` (`google_id`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `idx_npi` (`npi`),
  ADD KEY `idx_country` (`country`),
  ADD KEY `idx_organization` (`organization`),
  ADD KEY `idx_google_id` (`google_id`);

--
-- Index pour la table `user_activities`
--
ALTER TABLE `user_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_activities_user` (`user_id`),
  ADD KEY `idx_user_activities_type` (`activity_type`),
  ADD KEY `idx_user_activities_created_at` (`created_at`);

--
-- Index pour la table `user_badges`
--
ALTER TABLE `user_badges`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_badge` (`user_id`,`badge_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_badge` (`badge_id`),
  ADD KEY `idx_earned_at` (`earned_at`);

--
-- Index pour la table `user_evaluations`
--
ALTER TABLE `user_evaluations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_evaluation` (`evaluation_id`,`user_id`),
  ADD KEY `idx_evaluation` (`evaluation_id`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_status` (`status`);

--
-- Index pour la table `user_files`
--
ALTER TABLE `user_files`
  ADD PRIMARY KEY (`id`),
  ADD KEY `verified_by` (`verified_by`),
  ADD KEY `idx_user` (`user_id`),
  ADD KEY `idx_type` (`file_type`),
  ADD KEY `idx_verified` (`is_verified`);

--
-- Index pour la table `user_points`
--
ALTER TABLE `user_points`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user` (`user_id`);

--
-- Index pour la table `user_quiz_answers`
--
ALTER TABLE `user_quiz_answers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `answer_id` (`answer_id`),
  ADD KEY `idx_attempt` (`attempt_id`),
  ADD KEY `idx_question` (`question_id`),
  ADD KEY `idx_correct` (`is_correct`);

--
-- Index pour la table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_login_at` (`login_at`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `admin_2fa_codes`
--
ALTER TABLE `admin_2fa_codes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT pour la table `admin_login_logs`
--
ALTER TABLE `admin_login_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT pour la table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `ai_conversations`
--
ALTER TABLE `ai_conversations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `ai_messages`
--
ALTER TABLE `ai_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `badges`
--
ALTER TABLE `badges`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT pour la table `certificates`
--
ALTER TABLE `certificates`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `certificate_requests`
--
ALTER TABLE `certificate_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `courses`
--
ALTER TABLE `courses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT pour la table `course_analytics`
--
ALTER TABLE `course_analytics`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `course_approvals`
--
ALTER TABLE `course_approvals`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT pour la table `course_evaluations`
--
ALTER TABLE `course_evaluations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `course_favorites`
--
ALTER TABLE `course_favorites`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `course_reviews`
--
ALTER TABLE `course_reviews`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `email_verification_tokens`
--
ALTER TABLE `email_verification_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `enrollments`
--
ALTER TABLE `enrollments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=179;

--
-- AUTO_INCREMENT pour la table `evaluations`
--
ALTER TABLE `evaluations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `event_attendees`
--
ALTER TABLE `event_attendees`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `lessons`
--
ALTER TABLE `lessons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=377;

--
-- AUTO_INCREMENT pour la table `lesson_progress`
--
ALTER TABLE `lesson_progress`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=186;

--
-- AUTO_INCREMENT pour la table `media_files`
--
ALTER TABLE `media_files`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=41;

--
-- AUTO_INCREMENT pour la table `messages`
--
ALTER TABLE `messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `modules`
--
ALTER TABLE `modules`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=154;

--
-- AUTO_INCREMENT pour la table `module_quizzes`
--
ALTER TABLE `module_quizzes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT pour la table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `oauth_role_tokens`
--
ALTER TABLE `oauth_role_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT pour la table `performance_metrics`
--
ALTER TABLE `performance_metrics`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `progress`
--
ALTER TABLE `progress`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=295;

--
-- AUTO_INCREMENT pour la table `quizzes`
--
ALTER TABLE `quizzes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `quiz_answers`
--
ALTER TABLE `quiz_answers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=595;

--
-- AUTO_INCREMENT pour la table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT pour la table `quiz_questions`
--
ALTER TABLE `quiz_questions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=209;

--
-- AUTO_INCREMENT pour la table `recommendations`
--
ALTER TABLE `recommendations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT pour la table `system_events`
--
ALTER TABLE `system_events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=77;

--
-- AUTO_INCREMENT pour la table `user_activities`
--
ALTER TABLE `user_activities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=157;

--
-- AUTO_INCREMENT pour la table `user_badges`
--
ALTER TABLE `user_badges`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `user_evaluations`
--
ALTER TABLE `user_evaluations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `user_files`
--
ALTER TABLE `user_files`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT pour la table `user_points`
--
ALTER TABLE `user_points`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `user_quiz_answers`
--
ALTER TABLE `user_quiz_answers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `user_sessions`
--
ALTER TABLE `user_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `admin_2fa_codes`
--
ALTER TABLE `admin_2fa_codes`
  ADD CONSTRAINT `admin_2fa_codes_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `admin_login_logs`
--
ALTER TABLE `admin_login_logs`
  ADD CONSTRAINT `admin_login_logs_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `admin_sessions`
--
ALTER TABLE `admin_sessions`
  ADD CONSTRAINT `admin_sessions_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `ai_conversations`
--
ALTER TABLE `ai_conversations`
  ADD CONSTRAINT `ai_conversations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `ai_messages`
--
ALTER TABLE `ai_messages`
  ADD CONSTRAINT `ai_messages_ibfk_1` FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `certificates`
--
ALTER TABLE `certificates`
  ADD CONSTRAINT `certificates_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `certificates_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_certificates_request` FOREIGN KEY (`request_id`) REFERENCES `certificate_requests` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `certificate_requests`
--
ALTER TABLE `certificate_requests`
  ADD CONSTRAINT `certificate_requests_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `certificate_requests_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `certificate_requests_ibfk_3` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `certificate_requests_ibfk_4` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `courses`
--
ALTER TABLE `courses`
  ADD CONSTRAINT `courses_ibfk_1` FOREIGN KEY (`instructor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `courses_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `courses_ibfk_3` FOREIGN KEY (`prerequisite_course_id`) REFERENCES `courses` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `course_analytics`
--
ALTER TABLE `course_analytics`
  ADD CONSTRAINT `course_analytics_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `course_approvals`
--
ALTER TABLE `course_approvals`
  ADD CONSTRAINT `course_approvals_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `course_approvals_ibfk_2` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `course_evaluations`
--
ALTER TABLE `course_evaluations`
  ADD CONSTRAINT `course_evaluations_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `course_favorites`
--
ALTER TABLE `course_favorites`
  ADD CONSTRAINT `course_favorites_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `course_favorites_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `course_reviews`
--
ALTER TABLE `course_reviews`
  ADD CONSTRAINT `course_reviews_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `course_reviews_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `email_verification_tokens`
--
ALTER TABLE `email_verification_tokens`
  ADD CONSTRAINT `email_verification_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `enrollments`
--
ALTER TABLE `enrollments`
  ADD CONSTRAINT `enrollments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `enrollments_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_enrollments_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `evaluations`
--
ALTER TABLE `evaluations`
  ADD CONSTRAINT `evaluations_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `evaluations_ibfk_2` FOREIGN KEY (`instructor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `events`
--
ALTER TABLE `events`
  ADD CONSTRAINT `events_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `events_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `event_attendees`
--
ALTER TABLE `event_attendees`
  ADD CONSTRAINT `event_attendees_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `event_attendees_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `lessons`
--
ALTER TABLE `lessons`
  ADD CONSTRAINT `lessons_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `lessons_ibfk_2` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `lessons_ibfk_3` FOREIGN KEY (`media_file_id`) REFERENCES `media_files` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `lesson_progress`
--
ALTER TABLE `lesson_progress`
  ADD CONSTRAINT `lesson_progress_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `lesson_progress_ibfk_2` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `lesson_progress_ibfk_3` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `media_files`
--
ALTER TABLE `media_files`
  ADD CONSTRAINT `media_files_ibfk_1` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `media_files_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `media_files_ibfk_3` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `messages`
--
ALTER TABLE `messages`
  ADD CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `modules`
--
ALTER TABLE `modules`
  ADD CONSTRAINT `modules_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `module_quizzes`
--
ALTER TABLE `module_quizzes`
  ADD CONSTRAINT `module_quizzes_ibfk_1` FOREIGN KEY (`module_id`) REFERENCES `modules` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `module_quizzes_ibfk_2` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD CONSTRAINT `password_reset_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `progress`
--
ALTER TABLE `progress`
  ADD CONSTRAINT `progress_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `progress_ibfk_2` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `quizzes`
--
ALTER TABLE `quizzes`
  ADD CONSTRAINT `quizzes_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `quizzes_ibfk_2` FOREIGN KEY (`lesson_id`) REFERENCES `lessons` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `quiz_answers`
--
ALTER TABLE `quiz_answers`
  ADD CONSTRAINT `quiz_answers_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `quiz_attempts`
--
ALTER TABLE `quiz_attempts`
  ADD CONSTRAINT `fk_quiz_attempts_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `quiz_attempts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `quiz_attempts_ibfk_2` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `quiz_attempts_ibfk_3` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `quiz_questions`
--
ALTER TABLE `quiz_questions`
  ADD CONSTRAINT `fk_quiz_questions_module_quiz` FOREIGN KEY (`module_quiz_id`) REFERENCES `module_quizzes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `quiz_questions_ibfk_1` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `recommendations`
--
ALTER TABLE `recommendations`
  ADD CONSTRAINT `recommendations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `system_events`
--
ALTER TABLE `system_events`
  ADD CONSTRAINT `system_events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `system_events_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `user_activities`
--
ALTER TABLE `user_activities`
  ADD CONSTRAINT `user_activities_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `user_badges`
--
ALTER TABLE `user_badges`
  ADD CONSTRAINT `user_badges_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_badges_ibfk_2` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `user_evaluations`
--
ALTER TABLE `user_evaluations`
  ADD CONSTRAINT `user_evaluations_ibfk_1` FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_evaluations_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `user_files`
--
ALTER TABLE `user_files`
  ADD CONSTRAINT `user_files_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_files_ibfk_2` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `user_points`
--
ALTER TABLE `user_points`
  ADD CONSTRAINT `user_points_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `user_quiz_answers`
--
ALTER TABLE `user_quiz_answers`
  ADD CONSTRAINT `user_quiz_answers_ibfk_1` FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_quiz_answers_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `quiz_questions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_quiz_answers_ibfk_3` FOREIGN KEY (`answer_id`) REFERENCES `quiz_answers` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `user_sessions`
--
ALTER TABLE `user_sessions`
  ADD CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;