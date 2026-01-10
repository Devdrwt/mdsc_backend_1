const { pool } = require('../config/database');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const MinioService = require('../services/minioService');
const os = require('os');

/**
 * Convertir un fichier PPTX en images (une par slide)
 */
const convertPptxToImages = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer les informations du fichier depuis la base de données
    const [files] = await pool.execute(
      `SELECT id, filename, original_filename, url, file_type, file_size 
       FROM media_files 
       WHERE id = ?`,
      [id]
    );
    
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fichier non trouvé'
      });
    }
    
    const mediaFile = files[0];
    
    // Vérifier que c'est un fichier PowerPoint
    const isPptx = mediaFile.file_type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                   mediaFile.filename.toLowerCase().endsWith('.pptx') ||
                   mediaFile.filename.toLowerCase().endsWith('.ppt');
    
    if (!isPptx) {
      return res.status(400).json({
        success: false,
        message: 'Le fichier n\'est pas un fichier PowerPoint'
      });
    }

    // Vérifier que MinIO est disponible
    if (!MinioService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.'
      });
    }

    // Créer un dossier temporaire pour le traitement
    const tempDir = path.join(os.tmpdir(), `pptx_${id}_${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    let tempPptxPath = null;
    let outputDir = null;

    try {
      // Télécharger le fichier PPTX depuis MinIO
      if (mediaFile.storage_type === 'minio' && mediaFile.storage_path) {
        console.log('📥 [PPTX] Téléchargement depuis MinIO:', mediaFile.storage_path);
        const fileStream = await MinioService.downloadFile(mediaFile.storage_path);
        
        // Sauvegarder temporairement pour LibreOffice
        tempPptxPath = path.join(tempDir, mediaFile.filename);
        const writeStream = require('fs').createWriteStream(tempPptxPath);
        fileStream.pipe(writeStream);
        
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        });
      } else {
        // Fallback pour les anciens fichiers locaux (ne devrait plus arriver)
        const filePath = path.join(__dirname, '../../', mediaFile.url);
        try {
          await fs.access(filePath);
          tempPptxPath = filePath;
        } catch (error) {
          return res.status(404).json({
            success: false,
            message: 'Fichier non trouvé dans MinIO'
          });
        }
      }
      
      // Créer un dossier temporaire pour les images
      outputDir = path.join(tempDir, 'slides');
      await fs.mkdir(outputDir, { recursive: true });
      
      // Convertir le PPTX en images avec LibreOffice
      const command = `libreoffice --headless --convert-to png --outdir "${outputDir}" "${tempPptxPath}"`;
      
      await execAsync(command, { timeout: 60000 }); // Timeout de 60 secondes
      
      // Lister les images générées
      const filesInDir = await fs.readdir(outputDir);
      const imageFiles = filesInDir
        .filter(file => file.toLowerCase().endsWith('.png'))
        .sort((a, b) => {
          // Trier par numéro de slide
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB;
        });
      
      // Uploader toutes les images vers MinIO
      const images = [];
      for (let index = 0; index < imageFiles.length; index++) {
        const file = imageFiles[index];
        const imagePath = path.join(outputDir, file);
        const imageBuffer = await fs.readFile(imagePath);
        
        // Upload vers MinIO
        const objectName = MinioService.generateObjectName(
          `presentations/slides/${id}`,
          `slide_${index + 1}_${file}`,
          null
        );
        const uploadResult = await MinioService.uploadFile(imageBuffer, objectName, 'image/png');
        
        images.push({
          slideNumber: index + 1,
          url: uploadResult.url,
          filename: file
        });
      }
      
      res.json({
        success: true,
        data: {
          mediaFileId: id,
          originalFilename: mediaFile.original_filename,
          slides: images,
          totalSlides: images.length
        }
      });
    } finally {
      // Nettoyer les fichiers temporaires
      try {
        if (tempDir && await fs.access(tempDir).then(() => true).catch(() => false)) {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log('✅ [PPTX] Fichiers temporaires nettoyés');
        }
      } catch (cleanupError) {
        console.warn('⚠️  [PPTX] Erreur lors du nettoyage:', cleanupError);
      }
    }
    
  } catch (error) {
    console.error('❌ [PPTX] Erreur lors de la conversion PPTX:', error);
    res.status(500).json({
      success: false,
      message: `Erreur lors de la conversion du fichier PowerPoint: ${error.message}`
    });
  }
};

/**
 * Servir une image de slide depuis MinIO
 */
const getSlideImage = async (req, res) => {
  try {
    const { id, filename } = req.params;
    
    if (!MinioService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'MinIO n\'est pas disponible'
      });
    }

    // Construire le nom d'objet MinIO
    const objectName = `presentations/slides/${id}/${filename}`;
    
    try {
      // Télécharger depuis MinIO
      const fileStream = await MinioService.downloadFile(objectName);
      
      // Servir l'image avec les bons headers
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
      
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error('❌ [PPTX] Erreur lors du streaming:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération de l\'image'
          });
        }
      });
    } catch (error) {
      if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
        return res.status(404).json({
          success: false,
          message: 'Image de slide non trouvée dans MinIO'
        });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('❌ [PPTX] Erreur lors de la récupération de l\'image:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'image'
    });
  }
};

module.exports = {
  convertPptxToImages,
  getSlideImage
};

