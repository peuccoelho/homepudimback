import fetch from "node-fetch";

export function gerarPayloadKlever(total, pedidoId, enderecoKlever) {
  const valorKLV = (total / 0.02).toFixed(6);
  const amount = Math.round(Number(valorKLV) * 1e6);

  return {
    amount: String(amount),
    receiver: enderecoKlever,
    kda: "KLV",
    
  };
}

