const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { verifyToken } = require('../middlewares/authMiddleware');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Verifica o Bearer Token antes do upload
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo de imagem enviado.' });
    }

    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: 'cantina_produtos',
    });

    return res.json({ imageUrl: result.secure_url });
  } catch (error) {
    console.error('Erro no Cloudinary:', error);
    return res.status(500).json({ error: 'Falha ao enviar imagem para a nuvem.' });
  }
});

module.exports = router;