-- Migration : Activation du provider Gobipay dans la configuration
-- Date : 2025-02-XX
-- Description : Ajoute 'gobipay' aux colonnes ENUM nécessaires pour la gestion des providers

-- Étendre la liste des providers configurables
ALTER TABLE payment_providers
MODIFY COLUMN provider_name ENUM('kkiapay', 'fedapay', 'gobipay') NOT NULL;

-- S'assurer que la table payments accepte le mode de paiement Gobipay
ALTER TABLE payments 
MODIFY COLUMN payment_method ENUM('card', 'mobile_money', 'bank_transfer', 'cash', 'other', 'kkiapay', 'gobipay', 'fedapay') DEFAULT 'card';

