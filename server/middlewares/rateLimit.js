import rateLimit from "express-rate-limit";

// Limite global: 100 requisições por 15 minutos por IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { erro: "Muitas requisições deste IP. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite para login: 5 tentativas por 15 minutos por IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: { erro: "Muitas tentativas de login. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite para pedidos: 10 pedidos por hora por IP
export const pedidoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  message: { erro: "Muitos pedidos deste IP. Tente novamente mais tarde." },
  standardHeaders: true,
  legacyHeaders: false,
});