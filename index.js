// index.js (CommonJS)

const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   Variáveis de Ambiente
========================= */
const ZAPSIGN_API_KEY =
  process.env.ZAPSIGN_API_KEY ||
  "SEU_TOKEN_AQUI"; // defina no Render (não deixe fixo em produção)

const PRESTADOR_EMAIL =
  process.env.PRESTADOR_EMAIL || "shyyxnsolucion@gmail.com";

const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || "https://projetoassina.vercel.app";

/* =========================
   CORS (lista de origens + preflight)
========================= */
const ALLOWED_ORIGINS = [
  ALLOWED_ORIGIN,         // produção
  "http://localhost:3000", // dev
  "http://localhost:5173"  // dev (Vite)
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite requisições sem origin (ex.: Postman/cURL) ou origin da lista
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS: " + origin), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false
  })
);

// Garante headers no preflight (OPTIONS) e nas respostas
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* =========================
   Parsers de body
========================= */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Fallback para texto cru quando o front não manda Content-Type correto
app.use(express.text({ type: "*/*", limit: "10mb" }));

/* =========================
   Utils
========================= */
function resolveBody(req) {
  if (req.is("application/json")) return req.body || {};
  if (req.is("application/x-www-form-urlencoded")) return req.body || {};

  // Se veio como texto cru, tenta JSON e depois querystring (a=b&c=d)
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      try {
        const params = new URLSearchParams(req.body);
        const obj = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        return obj;
      } catch {
        return {};
      }
    }
  }
  return req.body || {};
}

/* =========================
   Health/Version
========================= */
app.get("/__version", (_req, res) => {
  res.json({ ok: true, version: "zap-sign-v1" });
});

/* =========================
   Rota: Enviar contrato
========================= */
app.post("/api/enviar-contrato", async (req, res) => {
  try {
    const ct = req.headers["content-type"] || "";
    const raw = resolveBody(req);

    // Normaliza possíveis nomes
    const nome =
      raw.nome ||
      raw.name ||
      raw.fullName ||
      raw.cliente ||
      raw.nomeCompleto ||
      "";
    const email = raw.email || raw.mail || raw["e-mail"] || "";
    const tipo =
      raw.tipo ||
      raw.tipoDesbloqueio ||
      raw.type ||
      raw.desbloqueio ||
      raw.servico ||
      "";

    if (!nome || !email || !tipo) {
      return res.status(400).json({
        success: false,
        error: "Dados incompletos. Esperado: { nome, email, tipo }",
        received: raw,
        contentType: ct
      });
    }

    // Carrega e personaliza o HTML do contrato
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
    console.error("Erro ZapSign:", detail);
    return res.status(500).json({ success: false, error: detail });
  }
});

/* =========================
   Start
========================= */
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
