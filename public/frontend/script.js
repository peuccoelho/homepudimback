const cardapio = [
  { nome: "Pudim de Café", preco: 8.6, peso: "120g" },
  { nome: "Pudim de Doce de Leite", preco: 8.9, peso: "120g" },
  { nome: "Pudim Tradicional", preco: 7.9, peso: "120g" },
  { nome: "Chocolate Branco c/ Calda de Caramelo", preco: 9.5, peso: "120g" },
  { nome: "Chocolate Branco c/ Calda de Morango", preco: 10.6, peso: "120g" },
  { nome: "Pudim de Coco", preco: 9.3, peso: "120g" },
  { nome: "Pudim de Leite Ninho", preco: 9.1, peso: "120g" },
  { nome: "Chocolate ao Leite c/ Calda de Maracujá", preco: 9.9, peso: "120g" },
  { nome: "Chocolate ao Leite c/ Calda de Caramelo", preco: 9.9, peso: "120g" },
  { nome: "Pudim de Abacaxi", preco: 8.9, peso: "120g" }
];

const carrinho = [];

const cardapioContainer = document.getElementById("cardapio");
const carrinhoContainer = document.getElementById("carrinho");
const nomeClienteInput = document.getElementById("nomeCliente");
const formaPagamentoInput = document.getElementById("formaPagamento");
const btnFinalizar = document.getElementById("finalizarPedido");
const toggleInfo = document.getElementById("toggleInfo");
const infoSection = document.getElementById("infoSection");
const statusDiv = document.getElementById("status");
const barraProgresso = document.getElementById("barraProgresso");

toggleInfo?.addEventListener("click", () => {
  infoSection.classList.toggle("hidden");
});

function verificarHorarioFuncionamento() {
  const agora = new Date();
  const diaSemana = agora.getDay();
  const hora = agora.getHours();
  const aberto = diaSemana >= 1 && diaSemana <= 5 && hora >= 9 && hora < 17;

  if (statusDiv) {
    statusDiv.textContent = aberto ? "Aberto agora" : "Fechado no momento";
    statusDiv.classList.remove("bg-gray-400");
    statusDiv.classList.toggle("bg-green-600", aberto);
    statusDiv.classList.toggle("bg-red-600", !aberto);
  }

  return aberto;
}

cardapio.forEach((item, index) => {
  const card = document.createElement("div");
  card.className =
    "bg-white rounded-2xl p-5 shadow-md hover:shadow-xl cursor-pointer transition-all transform hover:scale-105 border border-[#c9b8a2] duration-300 opacity-0 animate-fade-in";
  card.innerHTML = `
    <h3 class="text-lg font-semibold mb-1">${item.nome}</h3>
    <p class="text-sm text-gray-600 mb-2">Peso: ${item.peso}</p>
    <p class="mb-4 font-medium">R$ ${item.preco.toFixed(2).replace(".", ",")}</p>
    <div class="flex gap-2">
      <input type="number" min="1" value="1" class="quantidadeInput w-16 text-center border rounded" id="quantidade-${index}" />
      <button class="bg-[#a47551] hover:bg-[#916546] text-white px-4 py-2 rounded-xl transition" onclick="adicionarAoCarrinho(${index})">
        Adicionar
      </button>
    </div>
  `;
  cardapioContainer.appendChild(card);
});

function adicionarAoCarrinho(index) {
  const item = cardapio[index];
  const quantidadeInput = document.getElementById(`quantidade-${index}`);
  const quantidade = Math.max(1, parseInt(quantidadeInput?.value || "1"));

  const existente = carrinho.find(p => p.nome === item.nome);
  if (existente) {
    existente.quantidade += quantidade;
  } else {
    carrinho.push({ ...item, quantidade });
  }

  exibirToast(`${item.nome} adicionado!`);
  atualizarCarrinho();
}

function removerDoCarrinho(i) {
  carrinho.splice(i, 1);
  atualizarCarrinho();
}

function atualizarQuantidade(index, novaQuantidade) {
  const quantidade = parseInt(novaQuantidade);
  carrinho[index].quantidade = !isNaN(quantidade) && quantidade > 0 ? quantidade : 1;
  atualizarCarrinho();
}

function atualizarCarrinho() {
  carrinhoContainer.innerHTML = "";

  if (carrinho.length === 0) {
    carrinhoContainer.innerHTML =
      '<li class="text-gray-500 italic">Nenhum item no carrinho</li>';
    const aviso = document.getElementById("avisoMinimo");
    if (aviso) aviso.classList.add("hidden");
    validarFormulario();
    return;
  }

  carrinho.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center gap-4";
    li.innerHTML = `
      <span class="flex-1">${item.nome} (${item.peso})</span>
      <input type="number" min="1" value="${item.quantidade}" onchange="atualizarQuantidade(${i}, this.value)" class="w-16 text-center border rounded" />
      <span class="text-sm text-gray-600">R$ ${(item.preco * item.quantidade).toFixed(2).replace(".", ",")}</span>
      <button class="text-red-600 hover:underline text-sm" onclick="removerDoCarrinho(${i})">Remover</button>
    `;
    carrinhoContainer.appendChild(li);
  });

  const total = carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
  const totalLi = document.createElement("li");
  totalLi.className = "font-bold border-t border-gray-300 pt-2 mt-2 flex justify-between";
  totalLi.innerHTML = `<span>Total</span><span>R$ ${total.toFixed(2).replace(".", ",")}</span>`;
  carrinhoContainer.appendChild(totalLi);

  validarFormulario();

  const aviso = document.getElementById("avisoMinimo");
  if (aviso) {
    const totalUnidades = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
    aviso.classList.toggle("hidden", totalUnidades >= 20);
  }

  const nomePreenchido = nomeClienteInput.value.trim() !== "";
  const pagamentoEscolhido = formaPagamentoInput.value !== "";
  const progresso =
    (carrinho.length > 0 ? 33 : 0) +
    (nomePreenchido ? 33 : 0) +
    (pagamentoEscolhido ? 34 : 0);
  if (barraProgresso) barraProgresso.style.width = `${progresso}%`;
}

btnFinalizar.addEventListener("click", async () => {
  const nome = nomeClienteInput.value.trim();
  const pagamento = formaPagamentoInput.value;

  if (!nome || !pagamento) {
    alert("Preencha todos os campos antes de finalizar o pedido.");
    return;
  }

  const totalUnidades = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  if (totalUnidades < 20) {
    alert("A quantidade mínima para pedidos é de 20 unidades.");
    return;
  }

  const total = Number(
    carrinho.reduce((sum, item) => sum + item.preco * item.quantidade, 0).toFixed(2)
  );

  const pedido = {
    cliente: nome,
    pagamento,
    itens: carrinho,
    total
  };

  // Abre uma aba temporária (ainda sem URL)
  const abaPagamento = window.open("", "_blank");

  try {
    const resposta = await fetch("https://homepudimback.onrender.com/api/pagar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(pedido)
    });

    const data = await resposta.json();

    if (data.url && data.pedidoId) {
      abaPagamento.location.href = data.url;

     window.location.href = `aguardando.html?id=${data.pedidoId}`;
    } else {
      alert("Erro ao redirecionar para pagamento.");
      abaPagamento.close(); 
    }
  } catch (erro) {
    console.error("Erro no pagamento:", erro);
    alert("Falha na conexão com o servidor.");
    abaPagamento.close();
  }
});


function validarFormulario() {
  const nome = nomeClienteInput.value.trim();
  const pagamento = formaPagamentoInput.value;
  const totalUnidades = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  btnFinalizar.disabled = !(nome && pagamento && totalUnidades >= 20);

  const progresso =
    (carrinho.length > 0 ? 33 : 0) +
    (nome ? 33 : 0) +
    (pagamento ? 34 : 0);
  if (barraProgresso) barraProgresso.style.width = `${progresso}%`;
}

nomeClienteInput.addEventListener("input", validarFormulario);
formaPagamentoInput.addEventListener("change", validarFormulario);

function exibirToast(mensagem) {
  const toast = document.createElement("div");
  toast.textContent = mensagem;
  toast.className =
    "fixed bottom-5 right-5 bg-[#a47551] text-white px-4 py-2 rounded-xl shadow-lg animate-fade-in z-50";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function scrollParaCarrinho() {
  const carrinho = document.getElementById("carrinho");
  if (carrinho) {
    carrinho.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const botoesAdicionar = document.querySelectorAll("button[onclick^='adicionarAoCarrinho']");
  botoesAdicionar.forEach(botao => {
    const original = botao.getAttribute("onclick");
    botao.setAttribute("onclick", `${original};scrollParaCarrinho();`);
  });
});

verificarHorarioFuncionamento();
atualizarCarrinho();
