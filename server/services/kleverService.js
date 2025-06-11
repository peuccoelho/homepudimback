import fetch from "node-fetch";

export function gerarPayloadKlever(total, pedidoId, enderecoKlever) {
  // Valor em KLV (ajuste para a cotação real)
  const valorKLV = (total / 0.02).toFixed(6);
  // O valor deve ser inteiro em "satoshis" (1 KLV = 10^6 satoshis)
  const amount = Math.round(Number(valorKLV) * 1e6);

  return {
    amount,
    receiver: enderecoKlever,
    kda: "KLV",
    reference: pedidoId,
  };
}

