
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/api/enviar-contrato', async (req, res) => {
  try {
    const { nome, email, tipo } = req.body;

    const contractPath = path.join(__dirname, 'contract.html');
    let contractHtml = fs.readFileSync(contractPath, 'utf8');

    contractHtml = contractHtml
      .replace('{{NOME_CLIENTE}}', nome)
      .replace('{{TIPO_DESBLOQUEIO}}', tipo);

    const contentBase64 = Buffer.from(contractHtml).toString('base64');

    const response = await axios.post('https://api.autentique.com.br/v2/documents', {
      document: {
        name: `Contrato de Desbloqueio - ${nome}`,
        content_base64: contentBase64,
        signers: [
          {
            email,
            action: 'SIGN',
            name: nome
          }
        ]
      }
    }, {
      headers: {
        Authorization: 'Bearer 40ffa6b380d2171082955abceeea9808255e92a7371d830015fb058aa12752fd',
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error('Erro ao enviar contrato para Autentique:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
