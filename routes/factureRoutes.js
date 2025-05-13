const express = require('express');
const multer = require('multer');
const path = require('path');
const { uploadAndExtractFacture, getFactures, getFactureById } = require('../controllers/factureController');

const router = express.Router();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (_, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /pdf|jpg|jpeg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('File type not supported'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/upload', upload.single('file'), uploadAndExtractFacture);
router.get('/', getFactures);
router.get('/:id', getFactureById);

module.exports = router;
