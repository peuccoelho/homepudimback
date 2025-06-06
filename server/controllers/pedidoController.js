import fetch from "node-fetch";
import { sanitizeInput } from "../utils/sanitize.js";
import { criarClienteAsaas, criarCobrancaAsaas } from "../services/asaasService.js";

const PRECOS_PRODUTOS = {
  "Pudim de Café": 8.6,
  "Pudim de Doce de Leite": 8.9,
  "Pudim Tradicional": 7.9,
  "Chocolate Branco c/ Calda de Caramelo": 9.5,
  "Chocolate Branco c/ Calda de Morango": 10.6,
  "Pudim de Coco": 9.3,
  "Pudim de Leite Ninho": 9.1,
  "Chocolate ao Leite c/ Calda de Maracujá": 9.9,
  "Chocolate ao Leite c/ Calda de Caramelo": 9.9,
  "Pudim de Abacaxi": 8.9
};

export async function criarPedido(req, res) {
  console.log("Recebido pedido:", req.body); 
  const { pedidosCollection, ASAAS_API } = req.app.locals;
  const pedido = req.body;

  // validação 
  if (
    !pedido.cliente ||
    !pedido.email ||
    !pedido.celular ||
    !pedido.pagamento ||
    !Array.isArray(pedido.itens) ||
    pedido.itens.length === 0
  ) {
    return res.status(400).json({ erro: "Dados do pedido inválidos." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pedido.email)) {
    return res.status(400).json({ erro: "E-mail inválido." });
  }
  if (!/^\d{10,11}$/.test(pedido.celular)) {
    return res.status(400).json({ erro: "Celular inválido. Use DDD + número, só números." });
  }

  pedido.cliente = sanitizeInput(pedido.cliente);
  pedido.email = sanitizeInput(pedido.email);
  pedido.celular = sanitizeInput(pedido.celular.replace(/\D/g, "")); 

  if (!/^\d{11}$/.test(pedido.celular)) {
    return res.status(400).json({ erro: "Celular inválido. Use DDD + número, só números (ex: 71999999999)." });
  }

  let totalCalculado = 0;
  const itensSanitizados = [];

  for (const item of pedido.itens) {
    const precoOficial = PRECOS_PRODUTOS[item.nome];
    if (
      !precoOficial ||
      typeof item.quantidade !== "number" ||
      item.quantidade < 1
    ) {
      return res.status(400).json({ erro: "Itens do pedido inválidos." });
    }
    totalCalculado += precoOficial * item.quantidade;
    itensSanitizados.push({
      nome: sanitizeInput(item.nome),
      preco: precoOficial,
      peso: sanitizeInput(item.peso || ""),
      quantidade: item.quantidade
    });
  }

  totalCalculado = Number(totalCalculado.toFixed(2));

  const totalUnidades = itensSanitizados.reduce((sum, item) => sum + item.quantidade, 0);
  if (totalUnidades < 20) {
    return res.status(400).json({ erro: "A quantidade mínima para pedidos é de 20 unidades." });
  }

  pedido.itens = itensSanitizados;
  pedido.total = totalCalculado;

  const pedidoId = `pedido-${Date.now()}`;
  pedido.id = pedidoId;
  pedido.status = "pendente"; 

  await pedidosCollection.doc(pedidoId).set(pedido);

  const { cliente, email, celular, total, pagamento, parcelas } = pedido;

  try {
    // cliente Asaas
    const clienteData = await criarClienteAsaas(
      ASAAS_API,
      process.env.access_token,
      cliente,
      email,
      celular
    );

    // cobrança Asaas
    const cobranca = await criarCobrancaAsaas(
      ASAAS_API,
      process.env.access_token,
      clienteData.id,
      pagamento,
      total,
      pedidoId,
      clienteData.name,
      pedido.parcelas 
    );

    res.json({
      url: cobranca.invoiceUrl,
      pedidoId: pedidoId
    });

  } catch (error) {
    console.error("Erro ao criar pedido:", error); 
    res.status(500).json({ erro: error.message });
  }
}

function enviarWhatsAppPedido(pedido) {
  const numero = process.env.CALLMEBOT_NUMERO;
  const apikey = process.env.CALLMEBOT_APIKEY;

  const itensTexto = pedido.itens
    .map(i => `${i.nome} x${i.quantidade}`)
    .join(" | ");
  const total = Number(pedido.total).toFixed(2);


  let infoParcelas = "";
  if (
    pedido.pagamento &&
    pedido.pagamento.toUpperCase() === "CREDIT_CARD" &&
    Number(pedido.parcelas) > 1
  ) {
    infoParcelas = `\nPagamento parcelado em ${pedido.parcelas}x no cartão.`;
  }

  const mensagem = `✅ Pagamento confirmado!
Cliente: ${pedido.cliente}
E-mail: ${pedido.email}
Celular: ${pedido.celular}
Total: R$ ${total}
Itens: ${itensTexto}${infoParcelas}`;

  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(numero)}&text=${encodeURIComponent(mensagem)}&apikey=${apikey}`;

  fetch(url)
    .then(res => res.text())
    .then(resposta => console.log("Resposta CallMeBot:", resposta))
    .catch(err => console.error("Erro ao enviar WhatsApp:", err));
}

export async function pagamentoWebhook(req, res) {
  const { pedidosCollection } = req.app.locals;
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
}

export async function statusPedido(req, res) {
  const { pedidosCollection } = req.app.locals;
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
}

export async function adminPedidos(req, res) {
  const { pedidosCollection } = req.app.locals;
  try {
    const snapshot = await pedidosCollection.get();
    const pedidos = snapshot.docs.map(doc => doc.data());
    res.json(pedidos);
  } catch (error) {
    console.error("Erro ao listar pedidos:", error);
    res.status(500).json({ erro: "Erro ao buscar pedidos" });
  }
}