-- Migration : Ajouter 'kkiapay' comme méthode de paiement
-- Date : 2025-11-15

-- Ajouter 'kkiapay' à l'ENUM payment_method
ALTER TABLE payments 
MODIFY COLUMN payment_method ENUM('card', 'mobile_money', 'bank_transfer', 'cash', 'other', 'kkiapay', 'gobipay') DEFAULT 'card';

