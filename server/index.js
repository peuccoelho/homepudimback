import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();
console.log("Token carregado:", process.env.ASAAS_TOKEN?.slice(0, 10) + "...");


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET;
const DB_FILE = path.join(__dirname, "pedidos.json");

const ASAAS_TOKEN = process.env.ASAAS_TOKEN;
const ASAAS_API = "https://sandbox.asaas.com/api/v3";

app.use(cors());
app.use(express.json());

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, "[]");
}

// Login
app.post("/api/login", (req, res) => {
  const { senha } = req.body;
  if (senha === "papudim123") {
    const token = jwt.sign({ admin: true }, SECRET_KEY, { expiresIn: "2h" });
    return res.json({ token });
  }
  return res.status(401).json({ erro: "Senha incorreta" });
});

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ erro: "Token ausente" });

  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    res.status(403).json({ erro: "Token inválido" });
  }
}

// Criar pedido 
app.post("/api/pagar", async (req, res) => {
  const pedido = req.body;
  const { cliente, total } = pedido;

  try {
    // Criar cliente
    const clienteRes = await fetch(`${ASAAS_API}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ASAAS_TOKEN}`
      },
      body: JSON.stringify({
        name: cliente,
        email: "teste@email.com",
        cpfCnpj: "00000000000",
        phone: "81999999999"
      })
    });

    if (!clienteRes.ok) {
      const erroTexto = await clienteRes.text();
      throw new Error(`Erro ao criar cliente: ${clienteRes.status} - ${erroTexto}`);
    }

    const clienteData = await clienteRes.json();

    // Criar cobrança
    const cobrancaRes = await fetch(`${ASAAS_API}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ASAAS_TOKEN}`
      },
      body: JSON.stringify({
        customer: clienteData.id,
        billingType: "PIX",
        value: Number(total),
        dueDate: new Date().toISOString().split("T")[0],
        description: `Pedido de pudins para ${cliente}`,
        externalReference: JSON.stringify(pedido),
        callback: "http://localhost:3000/api/pagamento-webhook"
      })
    });

    if (!cobrancaRes.ok) {
      const erroTexto = await cobrancaRes.text();
      throw new Error(`Erro ao criar cobrança: ${cobrancaRes.status} - ${erroTexto}`);
    }

    const cobranca = await cobrancaRes.json();
    res.json({ url: cobranca.invoiceUrl });

  } catch (error) {
    console.error("❌ Erro ao criar cobrança:", error.message);
    res.status(500).json({ erro: error.message });
  }
});

// Webhook de pagamento do Asaas
app.post("/api/pagamento-webhook", async (req, res) => {
  const body = req.body;

  try {
    if (body.event === "PAYMENT_RECEIVED") {
      const pedido = JSON.parse(body.payment.externalReference || "{}");
      const info = `Pedido de ${pedido.cliente}\nTotal: R$ ${Number(pedido.total).toFixed(2)}\nItens: ${pedido.itens.map(i => `${i.nome} x${i.quantidade}`).join(" | ")}`;
      enviarWhatsApp(`✅ Pagamento recebido!\n${info}`);
    }
  } catch (err) {
    console.error("Erro no webhook:", err);
  }

  res.sendStatus(200);
});

// WhatsApp via CallMeBot
function enviarWhatsApp(mensagem) {
  const numero = process.env.CALLMEBOT_NUMERO;
  const apikey = process.env.CALLMEBOT_APIKEY;

  if (!numero || !apikey || numero.includes("SEUNUMERO")) {
    console.log("⚠️ WhatsApp não configurado.");
    return;
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${numero}&text=${encodeURIComponent(mensagem)}&apikey=${apikey}`;

  fetch(url)
    .then(() => console.log("✅ WhatsApp enviado"))
    .catch(err => console.error("Erro ao enviar WhatsApp:", err));
}

// Admin: listar pedidos
app.get("/api/pedidos", autenticar, (req, res) => {
  const pedidos = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  res.json(pedidos);
});

// Admin: alterar status
app.post("/api/pedido-status", autenticar, (req, res) => {
  const { index, status } = req.body;
  const pedidos = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  if (typeof index !== "number" || !pedidos[index]) {
    return res.status(400).json({ erro: "Índice inválido ou pedido não encontrado" });
  }
  pedidos[index].status = status;
  fs.writeFileSync(DB_FILE, JSON.stringify(pedidos, null, 2));
  res.json({ sucesso: true });
});

app.listen(PORT, () => {
  console.log(`✅ Papudim backend rodando em http://localhost:${PORT}`);
});
