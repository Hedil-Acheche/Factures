const Facture = require('../models/Facture');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function extractTextFromImage(imagePath) {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng+fra', {
      logger: m => console.log(m)
    });
    return text;
  } catch (error) {
    console.error('Tesseract OCR error:', error);
    throw new Error('Failed to extract text from image');
  }
}

// Function to call Google Gemini API with API key as query parameter
async function callGoogleGeminiAPI(prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  try {
    const response = await axios.post(
      url,
      {
        prompt: {
          text: prompt
        },
        temperature: 0.2,
        maxOutputTokens: 1024
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.candidates[0].output;
  } catch (error) {
    console.error('Google Gemini API error:', error.response ? error.response.data : error.message);
    throw new Error('Failed to fetch from Google Gemini API');
  }
}

exports.uploadAndExtractFacture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let text = '';

    if (ext === '.pdf') {
      const dataBuffer = await fs.readFile(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      text = await extractTextFromImage(req.file.path);
    } else {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ message: 'Only PDF, JPG, JPEG, PNG files are supported' });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not set. Skipping AI parsing.');
      const facture = new Facture({
        fichierOriginal: req.file.path,
        texteExtrait: text,
        fournisseur: '',
        montant: 0,
        numero: '',
        date: null
      });
      await facture.save();
      return res.status(201).json({ facture, texteExtrait: text });
    }

    const prompt = `Extract the following fields from this invoice text in JSON format:
- fournisseur (supplier name)
- montant (total amount, as a number with decimals)
- numero (invoice number)
- date (date in DD/MM/YYYY format)
Text: ${text}
Return only the JSON object.`;

    let factureData = {};
    try {
      const apiResponse = await callGoogleGeminiAPI(prompt, process.env.GEMINI_API_KEY);
      factureData = JSON.parse(apiResponse);
    } catch (apiError) {
      console.error('Google Gemini API parsing error:', apiError);
      const facture = new Facture({
        fichierOriginal: req.file.path,
        texteExtrait: text,
        fournisseur: '',
        montant: 0,
        numero: '',
        date: null
      });
      await facture.save();
      return res.status(201).json({ facture, texteExtrait: text, warning: 'AI parsing failed, saved without parsed fields.' });
    }

    if (factureData.montant) {
      factureData.montant = parseFloat(factureData.montant);
      if (isNaN(factureData.montant)) {
        factureData.montant = 0;
      }
    } else {
      factureData.montant = 0;
    }

    if (factureData.date) {
      const parts = factureData.date.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        factureData.date = new Date(year, month, day);
      } else {
        factureData.date = null;
      }
    } else {
      factureData.date = null;
    }

    const facture = new Facture({
      ...factureData,
      fichierOriginal: req.file.path,
      texteExtrait: text
    });
    await facture.save();

    res.status(201).json({ facture, texteExtrait: text });
  } catch (err) {
    console.error('Error in uploadAndExtractFacture:', err);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ message: err.message });
  }
};

exports.getFactures = async (req, res) => {
  try {
    const factures = await Facture.find().sort({ dateAjout: -1 });
    res.json(factures);
  } catch (err) {
    console.error('Error fetching factures:', err);
    res.status(500).json({ message: 'Failed to fetch factures' });
  }
};

exports.getFactureById = async (req, res) => {
  try {
    const facture = await Facture.findById(req.params.id);
    if (!facture) {
      return res.status(404).json({ message: 'Facture not found' });
    }
    res.json(facture);
  } catch (err) {
    console.error('Error fetching facture by ID:', err);
    res.status(500).json({ message: 'Failed to fetch facture' });
  }
};
