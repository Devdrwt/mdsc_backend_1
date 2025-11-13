const { pool } = require('../config/database');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

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
    const filePath = path.join(__dirname, '../../', mediaFile.url);
    
    // Vérifier que le fichier existe
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Fichier physique non trouvé'
      });
    }
    
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
    
    // Créer un dossier temporaire pour les images
    const outputDir = path.join(__dirname, '../../uploads/presentations', `slides_${id}`);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Convertir le PPTX en images avec LibreOffice
    // Format: --convert-to png --outdir <outputDir> <inputFile>
    const command = `libreoffice --headless --convert-to png --outdir "${outputDir}" "${filePath}"`;
    
    try {
      await execAsync(command, { timeout: 60000 }); // Timeout de 60 secondes
    } catch (error) {
      console.error('Erreur lors de la conversion:', error);
      // Nettoyer le dossier de sortie en cas d'erreur
      try {
        await fs.rmdir(outputDir, { recursive: true });
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la conversion du fichier PowerPoint'
      });
    }
    
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
    
    // Construire les URLs des images
    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const images = imageFiles.map((file, index) => ({
      slideNumber: index + 1,
      url: `${apiUrl}/uploads/presentations/slides_${id}/${file}`,
      filename: file
    }));
    
    res.json({
      success: true,
      data: {
        mediaFileId: id,
        originalFilename: mediaFile.original_filename,
        slides: images,
        totalSlides: images.length
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la conversion PPTX:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la conversion du fichier PowerPoint'
    });
  }
};

/**
 * Servir une image de slide
 */
const getSlideImage = async (req, res) => {
  try {
    const { id, filename } = req.params;
    
    const imagePath = path.join(__dirname, '../../uploads/presentations', `slides_${id}`, filename);
    
    // Vérifier que le fichier existe
    try {
      await fs.access(imagePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Image de slide non trouvée'
      });
    }
    
    // Servir l'image avec les bons headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache 1 an
    res.sendFile(path.resolve(imagePath));
    
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'image:', error);
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

