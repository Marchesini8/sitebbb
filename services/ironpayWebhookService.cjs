const paymentStatusStore = require("./paymentStatusStore.cjs");

function validateWebhookKey(receivedKey) {
  const expectedKey = process.env.IRONPAY_WEBHOOK_SECRET || process.env.PAYMENT_API_KEY;

  if (!expectedKey) {
    const error = new Error("IRONPAY_WEBHOOK_SECRET não configurado no .env");
    error.statusCode = 500;
    throw error;
  }

  if (!receivedKey || receivedKey !== expectedKey) {
    const error = new Error("Chave do webhook inválida");
    error.statusCode = 401;
    throw error;
  }
}

function processWebhook(payload) {
  const { transaction_hash, status, amount, payment_method, paid_at } = payload || {};

  if (!transaction_hash || !status || typeof amount !== "number") {
    const error = new Error("Payload do webhook inválido");
    error.statusCode = 400;
    throw error;
  }

  const normalized = {
    transactionHash: transaction_hash,
    status,
    amount,
    paymentMethod: payment_method || null,
    paidAt: paid_at || null,
    isPaid: status === "paid",
  };

  paymentStatusStore.savePayment(normalized.transactionHash, normalized);
  return normalized;
}

module.exports = {
  validateWebhookKey,
  processWebhook,
};
