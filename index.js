const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// ENV
const ZAPSIGN_API_KEY =
  process.env.ZAPSIGN_API_KEY ||
  "af4b7afb-147a-4504-8ec2-9df65cd6fa7e75b82cc1-6f79-4eb3-8770-3b8a63e62035";
const PRESTADOR_EMAIL =
  process.env.PRESTADOR_EMAIL || "contato@shyyxnsolucion.com";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// CORS
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Parsers (JSON, urlencoded e texto cru — fallback)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*", limit: "10mb" })); // fallback para quando não mandam Content-Type correto

// Rota para checar versão
app.get("/__version", (_req, res) => {
  res.json({ ok: true, version: "zap-sign-v1" });
});

// Util: normaliza qualquer formato de body
function resolveBody(req) {
  if (req.is("application/json")) return req.body || {};
  if (req.is("application/x-www-form-urlencoded")) return req.body || {};

  // Se veio como texto cru, tenta parsear como JSON ou querystring
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      // tenta querystring (a=b&c=d)
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

// Rota principal: criar documento na ZapSign
app.post("/api/enviar-contrato", async (req, res) => {
  try {
    const ct = req.headers["content-type"] || "";
    const raw = resolveBody(req);

    // Normaliza nomes
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
        contentType: ct,
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
          {
            name: nome,
            email,
            autofill_email_subject: "Assine seu contrato de desbloqueio",
          },
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
    console.error("Erro ZapSign:", detail);
    return res.status(500).json({ success: false, error: detail });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
