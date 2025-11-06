-- Migration : Messagerie par email
-- Date : 2024-01-XX

-- Ajouter colonnes email dans messages
ALTER TABLE messages 
ADD COLUMN sender_email VARCHAR(255) NULL AFTER sender_id,
ADD COLUMN recipient_email VARCHAR(255) NULL AFTER recipient_id,
ADD INDEX idx_sender_email (sender_email),
ADD INDEX idx_recipient_email (recipient_email);

-- Populer les emails depuis users (si la table messages existe déjà)
UPDATE messages m
INNER JOIN users sender ON m.sender_id = sender.id
INNER JOIN users recipient ON m.recipient_id = recipient.id
SET m.sender_email = sender.email,
    m.recipient_email = recipient.email
WHERE m.sender_email IS NULL OR m.recipient_email IS NULL;

