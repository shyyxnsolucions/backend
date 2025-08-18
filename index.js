import express from "express";
import cors from "cors";
import axios from "axios";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Variáveis de ambiente
const ZAPSIGN_API_KEY = process.env.ZAPSIGN_API_KEY;
const PRESTADOR_EMAIL = process.env.PRESTADOR_EMAIL || "seuemail@provedor.com";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Rota principal (teste rápido)
app.get("/", (req, res) => {
  res.send("API rodando com sucesso 🚀");
});

// Rota para enviar contrato
app.post("/api/enviar-contrato", async (req, res) => {
  try {
    const ct = req.headers["content-type"] || "";

    // Normaliza os campos do body
    const body = req.body || {};
    const nome =
      body.nome || body.name || body.fullName || body.cliente || body["nomeCompleto"] || "";
    const email = body.email || body.mail || body["e-mail"] || "";
    const tipo =
      body.tipo || body.tipoDesbloqueio || body.type || body.desbloqueio || body.servico || "";

    if (!nome || !email || !tipo) {
      return res.status(400).json({
        success: false,
        error: "Dados incompletos. Esperado: { nome, email, tipo }",
        received: body,
        contentType: ct,
      });
    }

    // Lê e personaliza HTML do contrato
    const contractPath = path.join(process.cwd(), "contract.html");
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
          { name: "Shyyxn Solucion", email: PRESTADOR_EMAIL },
        ],
      },
      {
        headers: {
          Authorization: `Token ${ZAPSIGN_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error("Erro ao enviar contrato para ZapSign:", detail);
    return res.status(500).json({ success: false, error: detail });
  }
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
