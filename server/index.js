import express from "express";
import cors from "cors";
import fs, { access } from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import admin from "firebase-admin";
import helmet from "helmet";

dotenv.config();
console.log("Token carregado:", process.env.access_token?.slice(0, 10) + "...");

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const pedidosCollection = db.collection("pedidos");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
const SECRET_KEY = process.env.JWT_SECRET;
const DB_FILE = path.join(__dirname, "pedidos.json");

const access_token = process.env.access_token;
const ASAAS_API = "https://api-sandbox.asaas.com/";


app.use(cors({
  origin: "https://papudim.netlify.app",
  credentials: true,
}));
app.use(express.json({ limit: "200kb" }));
app.use(helmet());

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, "[]");
}

const tentativasLogin = {};
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 10;

// login simples
app.post("/api/login", (req, res) => {
  const ip = req.ip;
  tentativasLogin[ip] = tentativasLogin[ip] || { count: 0, bloqueadoAte: null };

  if (tentativasLogin[ip].bloqueadoAte && Date.now() < tentativasLogin[ip].bloqueadoAte) {
    return res.status(429).json({ erro: "Muitas tentativas. Tente novamente mais tarde." });
  }

  const { senha } = req.body;
  if (senha === "papudim123") {
    tentativasLogin[ip] = { count: 0, bloqueadoAte: null };
    const token = jwt.sign({ admin: true }, SECRET_KEY, { expiresIn: "12h" });
    return res.json({ token });
  }

  tentativasLogin[ip].count++;
  if (tentativasLogin[ip].count >= MAX_TENTATIVAS) {
    tentativasLogin[ip].bloqueadoAte = Date.now() + BLOQUEIO_MINUTOS * 60 * 1000;
  }
  return res.status(401).json({ erro: "Senha incorreta" });
});

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log("Authorization header recebido:", authHeader);

  if (!authHeader) {
    console.warn("Token ausente");
    return res.status(401).json({ erro: "Token ausente" });
  }

  const token = authHeader.split(" ")[1];
  console.log("Token recebido:", token);

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    console.log("Token decodificado:", decoded);
    next();
  } catch (err) {
    console.error("Erro ao verificar token:", err);
    res.status(403).json({ erro: "Token inválido ou expirado" });
  }
}


// Criar pedido
app.post("/api/pagar", async (req, res) => {
  const pedido = req.body;

  // Validação básica
  if (
    !pedido.cliente ||
    !pedido.email ||
    !pedido.celular ||
    !pedido.pagamento ||
    !Array.isArray(pedido.itens) ||
    pedido.itens.length === 0 ||
    !pedido.total ||
    typeof pedido.total !== "number"
  ) {
    return res.status(400).json({ erro: "Dados do pedido inválidos." });
  }

  // Validação de e-mail e celular
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pedido.email)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  if (!/^\d{10,15}$/.test(pedido.celular.replace(/\D/g, ""))) {
    return res.status(400).json({ erro: "Celular inválido." });
  }

  function sanitizeInput(str) {
    if (typeof str !== "string") return "";
    return str.replace(/[<>"'`\\;]/g, "");
  }

  // No início do endpoint /api/pagar, sanitize os campos:
  pedido.cliente = sanitizeInput(pedido.cliente);
  pedido.email = sanitizeInput(pedido.email);
  pedido.celular = sanitizeInput(pedido.celular);

  const pedidoId = `pedido-${Date.now()}`;
pedido.id = pedidoId;
pedido.status = "pendente"; 

await pedidosCollection.doc(pedidoId).set(pedido);


  const { cliente, email, celular, total } = pedido;

  try {
    console.log("Criando cliente:", cliente);

    // Criar cliente
    const clienteRes = await fetch(`${ASAAS_API}v3/customers`, {
      method: "POST",
      headers: {
        'Content-Type': "application/json",
        access_token: process.env.access_token,
      },
      body: JSON.stringify({
        name: cliente,
        email: email,
        cpfCnpj: "12345678909",
        mobilePhone: celular
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

    console.log("Cliente criado:", clienteData.id);

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
  externalReference: pedidoId, 
  callback:{
    successUrl: "https://papudim.netlify.app/aguardando.html?id=" + pedidoId,
  }

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
  console.log("Resposta da cobrança:", cobranca);
} catch (e) {
  throw new Error(`Resposta inválida ao criar cobrança: ${cobrancaTexto}`);
}

console.log("Cobrança criada:", cobranca.invoiceUrl);
    res.json({
  url: cobranca.invoiceUrl,  
  pedidoId: pedidoId        
});


  } catch (error) {
    console.error("Erro ao criar cobrança:", error.message);
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

  const mensagem = `✅ Pagamento confirmado!
Cliente: ${pedido.cliente}
E-mail: ${pedido.email}
Celular: ${pedido.celular}
Total: R$ ${total}
Itens: ${itensTexto}`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(numero)}&text=${encodeURIComponent(mensagem)}&apikey=${apikey}`;

  fetch(url)
    .then(res => res.text())
    .then(resposta => console.log("Resposta CallMeBot:", resposta))
    .catch(err => console.error("Erro ao enviar WhatsApp:", err));
}

// Webhook de pagamento do Asaas
app.post("/api/pagamento-webhook", async (req, res) => {
  const body = req.body;

  try {
    if (body.event === "PAYMENT_CONFIRMED") {
      const pagamento = body.payment;
      const pedidoId = pagamento.externalReference;

      const pedidoDoc = await pedidosCollection.doc(pedidoId).get();
      const pedido = pedidoDoc.data();

      if (pedido && pedido.cliente && pedido.total) {
        await pedidosCollection.doc(pedidoId).update({ status: "pago" });

        enviarWhatsAppPedido(pedido);

        console.log("Pagamento confirmado - status atualizado e WhatsApp enviado");
      } else {
        console.warn("Pedido não encontrado ou incompleto no webhook:", pedidoId);
      }
    }
  } catch (err) {
    console.error("Erro no webhook:", err);
  }

  res.sendStatus(200);
});

app.get("/api/status-pedido", async (req, res) => {
  const { id } = req.query;

  try {
    const pedidoDoc = await pedidosCollection.doc(id).get();

    if (!pedidoDoc.exists) {
      return res.status(404).json({ erro: "Pedido não encontrado" });
    }

    const pedido = pedidoDoc.data();
    res.json({ status: pedido.status });
  } catch (error) {
    console.error("Erro ao consultar pedido:", error);
    res.status(500).json({ erro: "Erro ao consultar status" });
  }
});

//admin:pedidos
app.get("/api/admin-pedidos", autenticar, async (req, res) => {
  try {
    const snapshot = await pedidosCollection.get();
    const pedidos = snapshot.docs.map(doc => doc.data());
    res.json(pedidos);
  } catch (error) {
    console.error("Erro ao listar pedidos:", error);
    res.status(500).json({ erro: "Erro ao buscar pedidos" });
  }
});


app.listen(PORT, () => {
  console.log(`Papudim backend rodando em http://localhost:${PORT}`);
});
