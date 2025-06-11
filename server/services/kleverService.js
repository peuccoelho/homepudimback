import fetch from "node-fetch";

export async function criarCobrancaKlever(total, pedidoId, cliente, enderecoKlever) {
  // Valor em KLV (1 KLV = 0.02 BRL, ajuste conforme cotação real)
  const valorKLV = (total / 0.02).toFixed(6);

  // Documentação: https://docs.klever.finance/kleverpay/api-reference/create-payment
  const response = await fetch("https://api.klever.finance/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Se necessário, adicione autenticação via Bearer token aqui
      // "Authorization": "Bearer SEU_TOKEN_KLEVER"
    },
    body: JSON.stringify({
      amount: valorKLV,
      coin: "KLV",
      receiver: enderecoKlever,
      reference: pedidoId,
      description: `Pedido Papudim para ${cliente}`,
      // Adicione outros campos conforme a documentação da KleverPay
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Erro ao criar cobrança Klever");
  }
  return data;
}