import express from "express";
import { criarPedido, pagamentoWebhook, statusPedido, adminPedidos } from "../controllers/pedidoController.js";
import { autenticar } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/pagar", criarPedido);
router.post("/pagamento-webhook", pagamentoWebhook);
router.get("/status-pedido", statusPedido);
router.get("/admin-pedidos", autenticar, adminPedidos);

export default router;