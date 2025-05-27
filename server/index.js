import express from "express";
import cors from "cors";
import fs, { access } from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();
console.log("Token carregado:", process.env.access_token?.slice(0, 10) + "...");


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET;
const DB_FILE = path.join(__dirname, "pedidos.json");

const access_token = process.env.access_token;
const ASAAS_API = "https://api-sandbox.asaas.com/";


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
    console.log("➡️ Criando cliente:", cliente);

    // Criar cliente
    const clienteRes = await fetch(`${ASAAS_API}v3/customers`, {
      method: "POST",
      headers: {
        'Content-Type': "application/json",
        access_token: process.env.access_token,
      },
      body: JSON.stringify({
        name: cliente,
        email: `${cliente.toLowerCase().replace(/\s/g, "")}@teste.com`,
        cpfCnpj: "12345678909",
        phone: "81988889999"
      })
    });

    const clienteTexto = await clienteRes.text();

    if (!clienteRes.ok) {
      throw new Error(`Erro ao criar cliente: ${clienteRes.status} - ${clienteTexto}`);
    }

    let clienteData;
    try {
      clienteData = JSON.parse(clienteTexto);
    } catch (e) {
      throw new Error(`Resposta inválida ao criar cliente: ${clienteTexto}`);
    }

    console.log("✅ Cliente criado:", clienteData.id);

    // Criar cobrança
    const cobrancaRes = await fetch(`${ASAAS_API}v3/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: process.env.access_token,
      },
      body: JSON.stringify({
  customer: clienteData.id,
  billingType: pedido.pagamento.toUpperCase(),
  value: Number(total),
  dueDate: new Date().toISOString().split("T")[0],
  description: `Pedido de pudins para ${clienteData.name}`,
  externalReference: `${clienteData.name}-${Date.now()}`
})


    });

    // Verifica se a resposta da API é válida
    const cobrancaTexto = await cobrancaRes.text();

    if (!cobrancaRes.ok) {
      throw new Error(`Erro ao criar cobrança: ${cobrancaRes.status} - ${cobrancaTexto}`);
    }

    let cobranca;
try {
  cobranca = JSON.parse(cobrancaTexto);
  console.log("📦 Resposta da cobrança:", cobranca);
} catch (e) {
  throw new Error(`Resposta inválida ao criar cobrança: ${cobrancaTexto}`);
}

console.log("✅ Cobrança criada:", cobranca.invoiceUrl);
    res.json({ url: cobranca.invoiceUrl });

  } catch (error) {
    console.error("❌ Erro ao criar cobrança:", error.message);
    res.status(500).json({ erro: error.message });
  }
});

// WhatsApp via CallMeBot
function enviarWhatsAppPedido(pedido) {
  const numero = process.env.CALLMEBOT_NUMERO;
  const apikey = process.env.CALLMEBOT_APIKEY;

 const itensTexto = pedido.itens
    .map(i => `${i.nome} x${i.quantidade}`)
    .join(" | ");
  const total = Number(pedido.total).toFixed(2);

  const mensagem = `✅ Pagamento confirmado!\nCliente: ${pedido.cliente}\nTotal: R$ ${total}\nItens: ${itensTexto}`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(numero)}&text=${encodeURIComponent(mensagem)}&apikey=${apikey}`;

  fetch(url)
    .then(() => console.log("✅ WhatsApp enviado"))
    .catch(err => console.error("Erro ao enviar WhatsApp:", err));
}

// Webhook de pagamento do Asaas
app.post("/api/pagamento-webhook", async (req, res) => {
  const body = req.body;

  try {
    if (body.event === "PAYMENT_RECEIVED") {
      const pagamento = body.payment;

      const pedido = JSON.parse(pagamento.externalReference || "{}");

      if (pedido && pedido.cliente && pedido.total) {
        enviarWhatsAppPedido(pedido);
        console.log("✅ Pagamento confirmado - WhatsApp enviado");
      } else {
        console.warn("⚠️ Dados do pedido incompletos no webhook");
      }
    }
  } catch (err) {
    console.error("Erro no webhook:", err);
  }

  res.sendStatus(200);
});

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
