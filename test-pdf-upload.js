require('dotenv').config();
const MinioService = require('./src/services/minioService');
const fs = require('fs').promises;
const path = require('path');

async function testPDFUpload() {
  try {
    console.log('🧪 [TEST] Démarrage...');
    MinioService.initialize();
    if (!MinioService.isAvailable()) throw new Error('MinIO non disponible');
    
    const pdfPath = './LEÇON2.pdf';
    const fileBuffer = await fs.readFile(pdfPath);
    const stats = await fs.stat(pdfPath);
    
    const file = {
      buffer: fileBuffer,
      size: stats.size,
      mimetype: 'application/pdf',
      originalname: 'LEÇON2.pdf'
    };
    
    const objectName = MinioService.generateObjectName('documents', file.originalname, 'test');
    console.log('📤 [TEST] Upload LEÇON2.pdf...');
    
    const result = await MinioService.uploadFile(file, objectName, 'application/pdf');
    console.log('✅ [TEST] SUCCÈS!', result.url);
    process.exit(0);
  } catch (error) {
    console.error('❌ [TEST] ERREUR:', error.message);
    if (error.code) console.error('Code:', error.code);
    process.exit(1);
  }
}

testPDFUpload();
