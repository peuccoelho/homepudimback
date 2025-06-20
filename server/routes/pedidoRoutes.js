import express from "express";
import { criarPedido, pagamentoWebhook, statusPedido, adminPedidos, atualizarStatusPedido, criarPedidoCripto } from "../controllers/pedidoController.js";
import { autenticar } from "../middlewares/authMiddleware.js";
import { pedidoLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

router.post("/pagar", pedidoLimiter, criarPedido);
router.post("/pagamento-webhook", pagamentoWebhook);
router.get("/status-pedido", pedidoLimiter, statusPedido);
router.get("/admin-pedidos", pedidoLimiter, autenticar, adminPedidos);
router.put("/atualizar-status", autenticar, atualizarStatusPedido);
router.post("/pagamento-cripto", criarPedidoCripto);

export default router;