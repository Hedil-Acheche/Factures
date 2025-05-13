const mongoose = require('mongoose');

const factureSchema = new mongoose.Schema({
  fournisseur: { type: String, default: '' },
  montant: { type: Number, default: 0 },
  numero: { type: String, default: '' },
  date: { type: Date, default: null },
  fichierOriginal: { type: String, required: true },
  texteExtrait: { type: String, default: '' },
  dateAjout: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Facture', factureSchema);
