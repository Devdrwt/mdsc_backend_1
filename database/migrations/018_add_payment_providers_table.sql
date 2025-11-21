-- Migration : Table de configuration des providers de paiement
-- Date : 2025-01-XX
-- Description : Permet aux admins de configurer dynamiquement Kkiapay et Fedapay

CREATE TABLE IF NOT EXISTS payment_providers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider_name ENUM('kkiapay', 'fedapay') NOT NULL,
  public_key TEXT NOT NULL COMMENT 'Clé publique (chiffrée)',
  secret_key TEXT NOT NULL COMMENT 'Clé secrète (chiffrée)',
  private_key TEXT NULL COMMENT 'Clé privée (chiffrée, optionnelle)',
  is_active BOOLEAN DEFAULT FALSE COMMENT 'Activer/désactiver le provider',
  is_sandbox BOOLEAN DEFAULT TRUE COMMENT 'Mode sandbox (true) ou live (false)',
  base_url VARCHAR(500) NULL COMMENT 'URL personnalisée si nécessaire',
  metadata JSON NULL COMMENT 'Configurations supplémentaires',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_provider_name (provider_name),
  INDEX idx_is_active (is_active),
  INDEX idx_provider_name (provider_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ajouter 'fedapay' à l'ENUM payment_method dans la table payments
ALTER TABLE payments 
MODIFY COLUMN payment_method ENUM('card', 'mobile_money', 'bank_transfer', 'cash', 'other', 'kkiapay', 'gobipay', 'fedapay') DEFAULT 'card';

