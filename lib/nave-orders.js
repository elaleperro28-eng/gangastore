// Logica compartida por los webhooks de Nave (produccion y sandbox): cuando
// Nave avisa que un pago se acredito, registramos el pedido en Firestore
// (una sola vez, aunque Nave reintente o el cliente tambien lo registre) y
// avisamos al dueño por Telegram.
//
// Variables de entorno (Vercel): FIREBASE_SERVICE_ACCOUNT_JSON,
// TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID. Si faltan, el webhook igual
// responde 200 y deja el detalle en los logs.

import { getNavePaymentDetails } from "./nave.js";
import { createDocIfAbsent, getDocData, isFirestoreAdminConfigured } from "./firestore-admin.js";

function fmtARS(n) {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log("TELEGRAM_NOT_CONFIGURED");
    return;
  }
  const resp = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!resp.ok) console.error("TELEGRAM_SEND_ERROR", resp.status, await resp.text());
}

export async function handleNaveNotification(env, body, logTag) {
  console.log(logTag, JSON.stringify(body));
  if (!body || !body.payment_check_url) return;

  const details = await getNavePaymentDetails(env, body.payment_check_url);
  const statusName = (details && details.status && details.status.name) || (details && details.status) || "UNKNOWN";
  const orderId = String(body.external_payment_id || details.external_payment_id || "");
  console.log(logTag + "_STATUS", orderId, statusName);

  if (statusName !== "SUCCESS_PROCESSED" || !orderId) return;
  if (!isFirestoreAdminConfigured()) {
    console.log("FIRESTORE_ADMIN_NOT_CONFIGURED", orderId);
    return;
  }

  const pending = await getDocData("navePedidosPendientes", orderId);
  if (!pending) {
    console.error("NAVE_PENDING_ORDER_NOT_FOUND", orderId);
    await sendTelegram("⚠️ Pago Nave acreditado pero no encontré el pedido " + orderId + ". Revisalo en el panel de Nave.");
    return;
  }

  // ID del pedido = orderId: si el cliente (o un reintento de Nave) ya lo
  // registro, esta creacion devuelve false y no duplicamos ni re-avisamos.
  const created = await createDocIfAbsent("pedidos", orderId, {
    items: pending.items || [],
    total: pending.total || 0,
    medioPago: "nave",
    origen: "nave",
    estado: "pagado",
    nombre: pending.nombre || "",
    direccion: pending.direccion || "",
    telefono: pending.telefono || null,
    orderId,
    registradoPor: "servidor",
    createdAt: new Date(),
  });
  if (!created) return;

  const lines = (pending.items || []).map((i) => "• " + i.nombre + " x" + i.qty).join("\n");
  await sendTelegram(
    "🛍️ Nuevo pedido PAGADO con Nave\n\n" +
      lines + "\n\n" +
      "Total: " + fmtARS(pending.total) + "\n" +
      "Cliente: " + (pending.nombre || "-") + "\n" +
      "Tel: " + (pending.telefono || "-") + "\n" +
      "Envío: " + (pending.direccion || "-") + "\n" +
      "Pedido: " + orderId
  );
}
