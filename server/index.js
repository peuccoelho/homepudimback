import 'dotenv/config';
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;
const SECRET_KEY = "papudimsecreto123";
const DB_FILE = path.join(__dirname, "pedidos.json");

// Mercado Pago SDK v2
const mp = new MercadoPagoConfig({ accessToken: process.env.accessToken });
const preference = new Preference(mp);
const payment = new Payment(mp);

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
  } catch (err) {
    res.status(403).json({ erro: "Token inválido" });
  }
}

// Pagamento Mercado Pago
app.post("/api/pagar", async (req, res) => {
  const pedido = req.body;

  try {
    const items = pedido.itens.map(produto => ({
      title: produto.nome,
      quantity: produto.quantidade,
      unit_price: Number(produto.preco),
      currency_id: "BRL"
    }));

    const response = await preference.create({
      body: {
        items,
        payer: {
          name: pedido.cliente,
          email: "teste@email.com"
        },
        back_urls: {
          success: "https://papudim.com.br/pagamento-sucesso.html",
          failure: "https://papudim.com.br/pagamento-erro.html"
        },
        auto_return: "approved",
        notification_url: "http://localhost:3000/api/pagamento-webhook",
        metadata: pedido
      }
    });

    res.json({ url: response.init_point });
  } catch (error) {
    console.error("Erro ao criar pagamento:", error);
    res.status(500).json({ erro: "Erro ao criar pagamento." });
  }
});

// Webhook, Confirma pagamento e envia WhatsApp
app.post("/api/pagamento-webhook", async (req, res) => {
  const { data, type } = req.body;
  if (type !== "payment") return res.sendStatus(200);

  try {
    const pagamento = await payment.get({ id: data.id });
    const status = pagamento.body.status;

    if (status === "approved") {
      const metadata = pagamento.body.metadata;
      const pedidoInfo = `Pedido de ${metadata.cliente}\nTotal: R$ ${Number(metadata.total).toFixed(2)}\nItens: ${metadata.itens.map(i => `${i.nome} x${i.quantidade}`).join(" | ")}`;
      enviarWhatsApp(`✅ Pagamento confirmado!\n${pedidoInfo}`);
    }
  } catch (err) {
    console.error("Erro ao validar pagamento:", err);
  }

  res.sendStatus(200);
});

// CallMeBot
function enviarWhatsApp(mensagem) {
  const numero = "5581SEUNUMERO"; // Ex: 558199999999
  const apikey = "suachave";      // Gere no site do CallMeBot

  if (!numero || !apikey || numero.includes("SEUNUMERO")) {
    console.log("⚠️ WhatsApp não configurado.");
    return;
  }

  const url = `https://api.callmebot.com/whatsapp.php?phone=${numero}&text=${encodeURIComponent(mensagem)}&apikey=${apikey}`;

  fetch(url)
    .then(() => console.log("✅ WhatsApp enviado"))
    .catch(err => console.error("Erro ao enviar WhatsApp:", err));
}

// Admin, listar pedidos
app.get("/api/pedidos", autenticar, (req, res) => {
  const pedidos = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  res.json(pedidos);
});

// Admin, alterar status
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

// Inicia servidor
app.listen(PORT, () => {
  console.log(`✅ Papudim backend rodando em http://localhost:${PORT}`);
});
