import rateLimit from "express-rate-limit";

// 100 requisições por 15 minutos por IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { erro: "Muitas requisições deste IP. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 5 tentativas por 15 minutos por IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5,
  message: { erro: "Muitas tentativas de login. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 10 pedidos por hora por IP
export const pedidoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10,
  message: { erro: "Muitos pedidos deste IP. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite para rotas de admin - 200 requisições por hora por IP
export const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 200, // ou mais, conforme necessidade
  message: { erro: "Muitas requisições do admin. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});