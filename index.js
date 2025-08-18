const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cors = require("cors");

const app = express();

// ✅ Configure CORS corretamente para o seu frontend na Vercel
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; 
app.use(cors({
  origin: ALLOWED_ORIGIN,
  methods: ["GET","POST","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: false
}));

// middleware para garantir headers CORS e responder preflight
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "10mb" }));

// 🔑 Token da ZapSign
const ZAPSIGN_API_KEY = process.env.ZAPSIGN_API_KEY || "af4b7afb-147a-4504-8ec2-9df65cd6fa7e75b82cc1-6f79-4eb3-8770-3b8a63e62035";

// Email do prestador (você)
const PRESTADOR_EMAIL = process.env.PRESTADOR_EMAIL || "contato@shyyxnsolucion.com";

// === Rota para enviar contrato ===
app.post("/api/enviar-contrato", async (req, res) => {
  try {
    const { nome, email, tipo } = req.body;

    if (!nome || !email || !tipo) {
      return res.status(400).json({
        success: false,
        error: "Dados incompletos. Esperado: { nome, email, tipo }"
      });
    }

    // Carrega e personaliza HTML do contrato
    const contractPath = path.join(__dirname, "contract.html");
    let contractHtml = fs.readFileSync(contractPath, "utf8");
    contractHtml = contractHtml
      .replace(/{{NOME_CLIENTE}}/g, nome)
      .replace(/{{TIPO_DESBLOQUEIO}}/g, tipo);

    // Cria documento na ZapSign
    const response = await axios.post(
      "https://api.zapsign.com.br/api/v1/docs/",
      {
        name: `Contrato de Desbloqueio - ${nome}`,
        content_base64: Buffer.from(contractHtml).toString("base64"),
        signers: [
          { name: nome, email, autofill_email_subject: "Assine seu contrato de desbloqueio" },
          { name: "Shyyxn Solucion", email: PRESTADOR_EMAIL }
        ]
      },
      {
        headers: {
          Authorization: `Token ${ZAPSIGN_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error("Erro ao enviar contrato para ZapSign:", detail);
    return res.status(500).json({ success: false, error: detail });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
