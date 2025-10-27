// Script Node.js pour créer la table messages
const { pool } = require('../src/config/database');

async function migrateMessages() {
  try {
    console.log('🔄 Création de la table messages...');
    
    // Créer la table messages
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        recipient_id INT NOT NULL,
        subject VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        message_type ENUM('direct', 'announcement', 'system') DEFAULT 'direct',
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_sender (sender_id),
        INDEX idx_recipient (recipient_id),
        INDEX idx_unread (recipient_id, is_read),
        INDEX idx_created (created_at)
      )
    `);
    
    console.log('✅ Table messages créée');
    
    // Insérer quelques messages d'exemple
    console.log('📝 Insertion de messages d\'exemple...');
    
    const messages = [
      [11, 12, 'Bienvenue sur la plateforme', 'Bonjour ! Bienvenue sur la plateforme MdSC MOOC. Nous sommes ravis de vous avoir parmi nous.', 'system'],
      [12, 11, 'Question sur le cours', 'Bonjour instructeur, j\'ai une question concernant la leçon 3 du cours.', 'direct'],
      [11, 12, 'Réponse à votre question', 'Merci pour votre question. Je vais vous répondre dans les plus brefs délais.', 'direct']
    ];
    
    for (const [sender_id, recipient_id, subject, content, message_type] of messages) {
      await pool.execute(`
        INSERT IGNORE INTO messages (sender_id, recipient_id, subject, content, message_type)
        VALUES (?, ?, ?, ?, ?)
      `, [sender_id, recipient_id, subject, content, message_type]);
    }
    
    console.log('✅ Messages d\'exemple insérés');
    
    // Vérifier les messages créés
    const [messagesCount] = await pool.execute('SELECT COUNT(*) as count FROM messages');
    console.log(`📊 Total messages: ${messagesCount[0].count}`);
    
    console.log('🎉 Migration des messages terminée avec succès!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

migrateMessages();
