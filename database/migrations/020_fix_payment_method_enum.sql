-- Migration : Corriger l'ENUM payment_method pour inclure tous les providers
-- Date : 2025-01-XX
-- Problème : L'erreur "Data truncated for column 'payment_method'" indique que la colonne n'a pas été mise à jour en production

-- Mettre à jour l'ENUM payment_method pour inclure tous les providers
-- Cette commande peut échouer si des valeurs invalides existent déjà dans la table
ALTER TABLE payments 
MODIFY COLUMN payment_method ENUM('card', 'mobile_money', 'bank_transfer', 'cash', 'other', 'kkiapay', 'gobipay', 'fedapay') DEFAULT 'card';

-- Si l'ALTER TABLE échoue, exécutez d'abord cette requête pour vérifier les valeurs existantes :
-- SELECT DISTINCT payment_method FROM payments;

-- Si des valeurs invalides existent, corrigez-les avant de réessayer :
-- UPDATE payments SET payment_method = 'other' WHERE payment_method NOT IN ('card', 'mobile_money', 'bank_transfer', 'cash', 'other', 'kkiapay', 'gobipay', 'fedapay');



