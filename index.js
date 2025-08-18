const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();

// ✅ Configure CORS corretamente para o seu frontend na Vercel
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // troque para sua URL da Vercel no Render
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false
}));

// middleware para garantir headers CORS e responder preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '10mb' }));

const AUTENTIQUE_API_KEY = process.env.AUTENTIQUE_API_KEY || '40ffa6b380d2171082955abceeea9808255e92a7371d830015fb058aa12752fd';
const PRESTADOR_EMAIL = process.env.PRESTADOR_EMAIL || 'contato@shyyxnsolucion.com';

app.post('/api/enviar-contrato', async (req, res) => {
  try {
    const { nome, email, tipo } = req.body;
    if (!nome || !email || !tipo) {
      return res.status(400).json({ success: false, error: 'Dados incompletos.' });
    }

    // carrega e personaliza html do contrato
    const contractPath = path.join(__dirname, 'contract.html');
    let contractHtml = fs.readFileSync(contractPath, 'utf8');
    contractHtml = contractHtml
      .replace(/{{NOME_CLIENTE}}/g, nome)
      .replace(/{{TIPO_DESBLOQUEIO}}/g, tipo);

    const contentBase64 = Buffer.from(contractHtml).toString('base64');

    const payload = {
      document: {
        name: `Contrato de Desbloqueio - ${nome}`,
        content_base64: contentBase64
      },
      signers: [
        { email, name: nome, action: 'SIGN', delivery_method: 'email' },
        { email: PRESTADOR_EMAIL, name: 'Shyyxn Solucion', action: 'SIGN', delivery_method: 'email' }
      ]
    };

    const response = await axios.post('https://api.autentique.com.br/v2/documents', payload, {
      headers: {
        Authorization: `Bearer ${AUTENTIQUE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('Erro ao enviar contrato para Autentique:', detail);
    return res.status(500).json({ success: false, error: detail });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
