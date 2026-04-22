const axios = require("axios");
const paymentStatusStore = require("./paymentStatusStore.cjs");

const FIXED_SHIPPING_AMOUNT = 0;
const DEFAULT_PRODUCT_TITLE = "Taxa de inscrição BBB27";

function normalizeItemPrice(item) {
  const unitPrice = Number(item?.unitPrice || 0);
  if (unitPrice > 0) return unitPrice;

  const directPrice = Number(item?.price || 0);
  if (directPrice > 0) return directPrice;

  return Number(item?.oldPrice || 0);
}

function buildError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

exports.createPixPayment = async ({ items, customer, delivery }) => {
  const normalizedItems = Array.isArray(items) ? items : [];
  const productTotal = normalizedItems.reduce((sum, item) => {
    return sum + normalizeItemPrice(item) * Number(item?.qty || item?.quantity || 1);
  }, 0);
  const totalAmount = productTotal + FIXED_SHIPPING_AMOUNT;
  const totalInCents = Math.round(totalAmount * 100);
  const pixEndpoint = process.env.PAYMENT_PIX_ENDPOINT || "/transactions";
  const offerHash = process.env.IRONPAY_OFFER_HASH;
  const productHash = process.env.IRONPAY_PRODUCT_HASH;
  const postbackUrl = process.env.IRONPAY_POSTBACK_URL;
  const expireInDays = Number(process.env.IRONPAY_EXPIRE_IN_DAYS || 1);

  const cart = normalizedItems.map((item) => ({
    product_hash: productHash,
    title: item.title || DEFAULT_PRODUCT_TITLE,
    cover: item.image || null,
    price: Math.round(normalizeItemPrice(item) * 100),
    quantity: Number(item?.qty || item?.quantity || 1),
    operation_type: 1,
    tangible: false,
  }));

  if (!cart.length || totalInCents <= 0) {
    throw buildError("Carrinho inválido para gerar o pagamento.", 400);
  }

  if (!process.env.PAYMENT_API_URL || !process.env.PAYMENT_API_KEY) {
    throw buildError("PAYMENT_API_URL ou PAYMENT_API_KEY não configurado no .env");
  }

  if (!offerHash) {
    throw buildError("IRONPAY_OFFER_HASH não configurado no .env");
  }

  if (!productHash) {
    throw buildError("IRONPAY_PRODUCT_HASH não configurado no .env");
  }

  if (process.env.ALLOW_MOCK_PIX === "true") {
    const transactionHash = `mock-${Date.now()}`;
    const pixCode = `00020126580014br.gov.bcb.pix0136${transactionHash}520400005303986540539.905802BR5925BBB27 INSCRICAO6009SAO PAULO62070503***6304ABCD`;

    paymentStatusStore.savePayment(transactionHash, {
      status: "pending",
      amount: totalInCents,
      paymentMethod: "pix",
      isPaid: false,
      pixCode,
    });

    return {
      transaction_hash: transactionHash,
      status: "pending",
      pix_code: pixCode,
      pix_base64: null,
      charged_total: totalAmount,
      product_total: productTotal,
      shipping_total: FIXED_SHIPPING_AMOUNT,
      source: "mock",
    };
  }

  try {
    const response = await axios.post(
      `${process.env.PAYMENT_API_URL}${pixEndpoint}`,
      {
        offer_hash: offerHash,
        amount: totalInCents,
        payment_method: "pix",
        expire_in_days: expireInDays,
        transaction_origin: "api",
        postback_url: postbackUrl,
        cart,
        customer: {
          name: customer.name,
          email: customer.email,
          phone_number: customer.phone_number || customer.phone || process.env.DEFAULT_PHONE_NUMBER || "",
          document: customer.document || customer.cpf || "",
          street_name: customer.street_name || delivery.address || "",
          number: customer.number || delivery.number || "S/N",
          complement: customer.complement || delivery.complement || "",
          neighborhood: customer.neighborhood || delivery.neighborhood || process.env.DEFAULT_NEIGHBORHOOD || "",
          city: customer.city || delivery.city || "",
          state: customer.state || delivery.state || process.env.DEFAULT_STATE || "",
          zip_code: customer.zip_code || delivery.zip_code || delivery.cep || "",
        },
        tracking: {
          src: "bbb27",
          utm_source: "",
          utm_medium: "",
          utm_campaign: "",
          utm_term: "",
          utm_content: "",
        },
      },
      {
        params: {
          api_token: process.env.PAYMENT_API_KEY,
        },
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        proxy: false,
      }
    );

    const pixCode =
      response.data.pix_code ||
      response.data.pixCode ||
      response.data.pix?.pix_qr_code ||
      response.data.pix_qr_code ||
      null;
    const transactionHash =
      response.data.transaction_hash ||
      response.data.transactionHash ||
      response.data.pix?.transaction_hash ||
      response.data.pix?.transactionHash ||
      null;

    if (!pixCode) {
      throw buildError(`IronPay respondeu sem código Pix válido: ${JSON.stringify(response.data)}`, 502);
    }

    if (transactionHash) {
      paymentStatusStore.savePayment(transactionHash, {
        status: response.data.status || "pending",
        amount: response.data.amount || totalInCents,
        paymentMethod: "pix",
        isPaid: response.data.status === "paid",
        pixCode,
      });
    }

    return {
      transaction_hash: transactionHash,
      status: response.data.status || "pending",
      pix_code: pixCode,
      pix_base64:
        response.data.qr_code ||
        response.data.pix_base64 ||
        response.data.qrCode ||
        response.data.pix?.qr_code_base64 ||
        null,
      charged_total: totalAmount,
      product_total: productTotal,
      shipping_total: FIXED_SHIPPING_AMOUNT,
      source: "ironpay",
      raw: response.data,
    };
  } catch (error) {
    const providerError = error.response?.data || error.message;
    console.error("Erro ao criar pagamento na IronPay:", providerError);

    throw buildError(
      `Falha ao gerar Pix na IronPay: ${typeof providerError === "string" ? providerError : JSON.stringify(providerError)}`,
      error.response?.status || 502
    );
  }
};

exports.FIXED_SHIPPING_AMOUNT = FIXED_SHIPPING_AMOUNT;
exports.getPaymentStatus = (transactionHash) => paymentStatusStore.getPayment(transactionHash);
