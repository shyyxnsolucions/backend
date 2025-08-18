const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cors = require('cors');

const app = express();

// ✅ CORS: autoriza seu frontend na Vercel
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
);

// headers CORS + resposta ao preflight
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '10mb' }));

const AUTENTIQUE_API_KEY =
  process.env.AUTENTIQUE_API_KEY ||
  '40ffa6b380d2171082955abceeea9808255e92a7371d830015fb058aa12752fd';

const PRESTADOR_EMAIL =
  process.env.PRESTADOR_EMAIL || 'contato@shyyxnsolucion.com';

// opcional: confirmar a versão no ar
app.get('/__version', (_req, res) => {
  res.json({ ok: true, version: 'v3-graphql' });
});

app.post('/api/enviar-contrato', async (req, res) => {
  try {
    // Normalização do payload vindo do front
    const body = req.body || {};
    const nome =
      body.nome || body.name || body.fullName || body.cliente || '';
    const email = body.email || body.mail || '';
    const tipo =
      body.tipo ||
      body.tipoDesbloqueio ||
      body.type ||
      body.desbloqueio ||
      body.servico ||
      '';

    if (!nome || !email || !tipo) {
      return res.status(400).json({
        success: false,
        error: 'Dados incompletos. Esperado: { nome, email, tipo }',
        received: body,
      });
    }

    // carrega e personaliza HTML do contrato
    const contractPath = path.join(__dirname, 'contract.html');
    let contractHtml = fs.readFileSync(contractPath, 'utf8');
    contractHtml = contractHtml
      .replace(/{{NOME_CLIENTE}}/g, nome)
      .replace(/{{TIPO_DESBLOQUEIO}}/g, tipo);

    const contentBase64 = Buffer.from(contractHtml).toString('base64');

    // === Envio para Autentique via GraphQL v2 ===
    const mutation = `
      mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!) {
        createDocument(document: $document, signers: $signers) {
          id
          name
          url
          signers { id email name }
        }
      }
    `;

    const variables = {
      document: {
        name: `Contrato de Desbloqueio - ${nome}`,
        file: {
          base64: contentBase64,
          filename: 'contrato.html',
          mimetype: 'text/html',
        },
      },
      signers: [
        { email, name: nome, action: 'SIGN' },
        { email: PRESTADOR_EMAIL, name: 'Shyyxn Solucion', action: 'SIGN' },
      ],
    };

    const response = await axios.post(
      'https://api.autentique.com.br/v2/graphql',
      { query: mutation, variables },
      {
        headers: {
          Authorization: `Bearer ${AUTENTIQUE_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 30000,
      }
    );

    // ⛔️ IMPORTANTE: removida a chamada antiga para /v2/documents (REST)
    // Isso que estava gerando o log “The route v2/documents could not be found.”

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
