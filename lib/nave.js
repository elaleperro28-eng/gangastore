// Funciones compartidas para hablar con la API de pagos de Nave (Banco
// Galicia + Intive). Documentacion oficial: https://navenegocios.ar/home/developers
//
// Nave entrega DOS sets de credenciales (Client ID, Client Secret, POS ID):
// uno para el ambiente de pruebas (Sandbox) y otro para produccion (pagos
// reales). Nunca son las mismas. En Vercel se guardan asi:
//   - Produccion: NAVE_CLIENT_ID / NAVE_CLIENT_SECRET / NAVE_POS_ID
//   - Sandbox:    NAVE_CLIENT_ID_SANDBOX / NAVE_CLIENT_SECRET_SANDBOX / NAVE_POS_ID_SANDBOX
//
// Estas credenciales son SECRETAS: viven solo como variables de entorno en
// Vercel (Project Settings -> Environment Variables), nunca en el codigo.

const NAVE_AUDIENCE = "https://naranja.com/ranty/merchants/api";

const ENV_URLS = {
  sandbox: {
    auth: "https://homoservices.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate",
    payments: "https://api-sandbox.ranty.io",
  },
  production: {
    auth: "https://services.apinaranja.com/security-ms/api/security/auth0/b2b/m2msPrivate",
    payments: "https://api.ranty.io",
  },
};

function normalizeEnv(env) {
  return env === "sandbox" ? "sandbox" : "production";
}

export function getNaveConfig(env) {
  const e = normalizeEnv(env);
  const suffix = e === "sandbox" ? "_SANDBOX" : "";
  return {
    env: e,
    clientId: process.env["NAVE_CLIENT_ID" + suffix],
    clientSecret: process.env["NAVE_CLIENT_SECRET" + suffix],
    posId: process.env["NAVE_POS_ID" + suffix],
    ...ENV_URLS[e],
  };
}

export async function getNaveAccessToken(env) {
  const cfg = getNaveConfig(env);
  if (!cfg.clientId || !cfg.clientSecret) {
    throw new Error(
      "Nave (" + cfg.env + ") no esta configurado todavia: faltan las credenciales en Vercel."
    );
  }
  const resp = await fetch(cfg.auth, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      audience: NAVE_AUDIENCE,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    console.error("NAVE_AUTH_ERROR", cfg.env, resp.status, data);
    throw new Error("No pudimos autenticar con Nave.");
  }
  return data.access_token;
}

// Crea una "intencion de pago" (payment request). Nave devuelve un
// checkout_url (link de pago hosteado por Nave, con QR y tarjeta con
// cuotas) al que redirigimos al cliente, igual que con el init_point de
// Mercado Pago.
export async function createNavePaymentRequest(env, { externalPaymentId, amount, products, buyer, callbackUrl, durationSeconds }) {
  const cfg = getNaveConfig(env);
  if (!cfg.posId) {
    throw new Error("Nave (" + cfg.env + ") no esta configurado todavia: falta el POS ID en Vercel.");
  }
  const token = await getNaveAccessToken(env);
  const body = {
    external_payment_id: externalPaymentId,
    seller: { pos_id: cfg.posId },
    transactions: [
      {
        amount: { currency: "ARS", value: Number(amount).toFixed(2) },
        products: (products || []).map((p) => ({
          name: p.name,
          ...(p.description ? { description: p.description } : {}),
          quantity: p.quantity,
          unit_price: { currency: "ARS", value: Number(p.unit_price || 0).toFixed(2) },
        })),
      },
    ],
    ...(buyer ? { buyer } : {}),
    additional_info: { callback_url: callbackUrl },
    ...(durationSeconds ? { duration_time: durationSeconds } : {}),
  };

  const resp = await fetch(cfg.payments + "/api/payment_request/ecommerce", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.checkout_url) {
    console.error("NAVE_PAYMENT_REQUEST_ERROR", cfg.env, resp.status, data);
    throw new Error((data && (data.message || data.error)) || "No pudimos crear el pago con Nave.");
  }
  return data; // { id, external_payment_id, checkout_url, qr_data }
}

// Consulta el estado de una intencion de pago por su id de Nave
// (payment_request_id, el "id" que devuelve createNavePaymentRequest).
export async function getNavePaymentRequestStatus(env, paymentRequestId) {
  const cfg = getNaveConfig(env);
  const token = await getNaveAccessToken(env);
  const resp = await fetch(cfg.payments + "/api/payment_requests/" + encodeURIComponent(paymentRequestId), {
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("NAVE_STATUS_ERROR", cfg.env, resp.status, data);
    throw new Error("No pudimos consultar el estado del pago con Nave.");
  }
  return data;
}

// Para usar el payment_check_url que Nave manda en la notificacion (webhook).
export async function getNavePaymentDetails(env, checkUrl) {
  const token = await getNaveAccessToken(env);
  const url = /^https?:\/\//i.test(checkUrl) ? checkUrl : "https://" + checkUrl;
  const resp = await fetch(url, {
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("NAVE_PAYMENT_DETAILS_ERROR", env, resp.status, data);
    throw new Error("No pudimos consultar el detalle del pago con Nave.");
  }
  return data;
}
