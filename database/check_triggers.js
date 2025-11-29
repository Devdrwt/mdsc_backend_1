// Script pour vérifier si les triggers existent
const { pool } = require('../src/config/database');

async function checkTriggers() {
  try {
    const [triggers] = await pool.execute(
      "SHOW TRIGGERS WHERE `Table` = 'courses'"
    );
    
    console.log('\n📋 Triggers existants sur la table courses:');
    if (triggers.length === 0) {
      console.log('❌ Aucun trigger trouvé');
    } else {
      console.table(triggers.map(t => ({
        Trigger: t.Trigger,
        Event: t.Event,
        Table: t.Table,
        Timing: t.Timing
      })));
    }
    
    // Vérifier spécifiquement nos triggers
    const triggerNames = triggers.map(t => t.Trigger);
    const expectedTriggers = [
      'validate_live_course_before_insert',
      'validate_live_course_before_update'
    ];
    
    console.log('\n✅ Vérification des triggers attendus:');
    expectedTriggers.forEach(name => {
      if (triggerNames.includes(name)) {
        console.log(`✅ ${name} - EXISTE`);
      } else {
        console.log(`❌ ${name} - MANQUANT`);
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await pool.end();
  }
}

checkTriggers();

