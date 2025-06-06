# Papudim Backend

Este é o backend do Papudim, sistema de pedidos online de pudins artesanais. O projeto foi desenvolvido para permitir que clientes realizem pedidos, acompanhem o status do pagamento e que o administrador gerencie os pedidos de forma segura e eficiente.

---

# Tecnologias Utilizadas

- **Node.js**
- **Express**
- **Firebase Firestore** (armazenamento dos pedidos)
- **Asaas API** (emissão de cobranças e pagamentos)
- **CallMeBot API** (envio de notificações WhatsApp)
- **JWT** (autenticação de administrador)
- **dotenv** (variáveis de ambiente)
- **helmet** (segurança HTTP)
- **CORS** (controle de origem)
- **node-fetch** (requisições HTTP externas)

---

# Medidas de Segurança

- **Sanitização de Dados:**  
  Todos os dados recebidos do cliente são sanitizados para evitar injeção de código e ataques XSS.

- **Validação de Dados:**  
  E-mails, celulares e itens do pedido são validados antes de serem processados.

- **Autenticação JWT:**  
  O painel administrativo só pode ser acessado com token JWT válido, gerado após login com senha.

- **Controle de Tentativas de Login:**  
  Limite de tentativas de login para evitar ataques de força bruta.

- **Variáveis de Ambiente:**  
  Dados sensíveis (tokens, chaves, configs) são mantidos em variáveis de ambiente e nunca expostos no código.

- **Helmet:**  
  Adiciona headers HTTP de segurança.

- **CORS Restrito:**  
  Apenas o domínio do frontend pode acessar a API.

---

# APIs Externas Utilizadas

- **Asaas API:**  
  Utilizada para criar clientes e cobranças de pagamento (PIX, cartão).

- **Firebase Firestore:**  
  Armazena todos os pedidos realizados.

- **CallMeBot API:**  
  Envia notificação via WhatsApp ao confirmar pagamento.

---

# Endpoints Principais

- `POST /api/pagar`  
  Cria um novo pedido e inicia o processo de cobrança.

- `POST /api/pagamento-webhook`  
  Recebe notificações de pagamento da Asaas.

- `GET /api/status-pedido?id=...`  
  Consulta o status do pedido.

- `GET /api/admin-pedidos`  
  Lista todos os pedidos (requer autenticação JWT).

- `POST /api/login`  
  Login do administrador.

---

# Observações

- O frontend está na pasta `public/frontend` e se comunica via fetch com este backend.
- O projeto está pronto para deploy em serviços como Render, Heroku, Vercel, etc.
- Nunca suba o arquivo `.env` ou as chaves do Firebase para repositórios públicos.

---

Desenvolvido com para o Papudim.
