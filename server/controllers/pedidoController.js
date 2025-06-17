import pkg from "@klever/sdk";
const Transaction = pkg.Transaction;
import fetch from "node-fetch";
import { sanitizeInput } from "../utils/sanitize.js";
import { criarClienteAsaas, criarCobrancaAsaas } from "../services/asaasService.js";
import { gerarPayloadKlever } from "../services/kleverService.js";
import { Account, TransactionType } from "@klever/sdk-node";

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

  const pedidoId = pedido.id || `pedido-${Date.now()}`;
  pedido.id = pedidoId;
  pedido.status = "pendente";
  pedido.itens = itensSanitizados;
  pedido.total = totalCalculado;

  if (pedido.pagamento === "CRIPTO" && req.body.txHash) {
    pedido.txHash = req.body.txHash;
    await pedidosCollection.doc(pedidoId).set(pedido);

    // monitoramento do hash
    monitorarTransacaoKlever(pedidoId, pedido.txHash, pedidosCollection);

    return res.json({
      mensagem: "Pedido registrado. Aguardando confirmação na blockchain.",
      pedidoId
    });
  }

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
        await pedidosCollection.doc(pedidoId).update({ status: "a fazer" }); 
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

export async function atualizarStatusPedido(req, res) {
  const { pedidosCollection } = req.app.locals;
  console.log("Body recebido para atualizar status:", req.body); 
  const { id, status } = req.body;
  const statusValidos = ["a fazer", "em produção", "pronto", "pendente", "pago"];

  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: "Status inválido." });
  }

  try {
    await pedidosCollection.doc(id).update({ status });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: "Erro ao atualizar status" });
  }
}

export async function criarPedidoCripto(req, res) {
  const { pedidosCollection } = req.app.locals;
  const pedido = req.body;
  const { cliente, email, celular, pagamento, itens, total, destino } = pedido;

  const pedidoId = `pedido-${Date.now()}`;
  const enderecoDestino = destino || process.env.ENDERECO_KLEVER;
  const chavePrivada = process.env.PRIVATE_KEY_KLEVER;

  try {
    // cotação KLV/BRL com retry
    let cotacao = null;
    let tentativas = 0;
    while (
      tentativas < 3 &&
      (!cotacao || !cotacao.klever || typeof cotacao.klever.brl !== "number" || cotacao.klever.brl <= 0)
    ) {
      const cotacaoResp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=klever&vs_currencies=brl");
      const texto = await cotacaoResp.text();
      try {
        cotacao = JSON.parse(texto);
      } catch (e) {
        cotacao = null;
      }
      console.log("Resposta da cotação CoinGecko:", texto);
      tentativas++;
      if (!cotacao || !cotacao.klever || typeof cotacao.klever.brl !== "number" || cotacao.klever.brl <= 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (
      !cotacao ||
      !cotacao.klever ||
      typeof cotacao.klever.brl !== "number" ||
      cotacao.klever.brl <= 0
    ) {
      return res.status(503).json({
        erro: "Cotação do KLV indisponível no momento. Tente novamente em instantes.",
        detalhe: cotacao
      });
    }

    const valorKLV = total / cotacao.klever.brl;
    const valorInteiro = Math.floor(valorKLV * 1e6); 

    // transação usando o SDK 
    const account = new Account(chavePrivada);
    await account.ready;

    const payload = {
      amount: valorInteiro.toString(),
      receiver: enderecoDestino,
      kda: "KLV"
    };

    const result = await account.quickSend([
      {
        payload,
        type: TransactionType.Transfer
      }
    ]);

    const hash = result?.data?.txsHashes?.[0];
    if (!hash) {
      throw new Error("Erro ao transmitir transação");
    }

    // pedido com hash
    const pedidoSalvo = {
      id: pedidoId,
      cliente,
      email,
      celular,
      pagamento,
      itens,
      total,
      status: "pendente",
      txHash: hash,
      destino: enderecoDestino
    };

    await pedidosCollection.doc(pedidoId).set(pedidoSalvo);

    // polling para confirmar
    monitorarTransacaoKlever(hash, pedidoId, pedidosCollection, pedidoSalvo);

    res.json({ pedidoId, hash });
  } catch (erro) {
    console.error("Erro ao criar pedido com cripto:", erro);
    res.status(500).json({ erro: "Falha ao processar pagamento com Klever" });
  }
}

async function monitorarTransacaoKlever(hash, pedidoId, pedidosCollection, pedidoOriginal) {
  let tentativas = 0;
  const max = 30;

  const intervalo = setInterval(async () => {
    try {
      // Troque para o domínio atualizado da KleverChain Mainnet
      const res = await fetch(`https://api.klever.finance/v1/transaction/${hash}`);
      const tx = await res.json();

      if (tx.status === "success") {
        console.log("Transação confirmada:", hash);
        await pedidosCollection.doc(pedidoId).update({ status: "a fazer" });
        enviarWhatsAppPedido(pedidoOriginal);
        clearInterval(intervalo);
      }
    } catch (e) {
      console.warn("Erro monitorando hash:", hash, e.message);
    }

    if (++tentativas >= max) {
      clearInterval(intervalo);
      console.warn("Timeout ao monitorar hash:", hash);
    }
  }, 10000);
}