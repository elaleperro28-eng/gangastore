// Logica compartida para registrar un pedido pagado con Nave y avisarle al
// dueño por Telegram. La usan dos caminos que llegan al mismo lugar:
//   - el webhook de Nave (/api/nave-webhook y /api/nave-webhook-sandbox)
//   - la confirmacion que manda la pagina cuando el cliente vuelve de pagar
//     (/api/nave-confirm)
// Los dos son idempotentes: el pedido se crea una sola vez y el aviso de
// Telegram sale una sola vez, sin importar cuantas veces llegue la senal ni
// en que orden (por eso el aviso usa su propio "marcador" y no depende de
// que el pedido lo haya creado el servidor o la pagina).
//
// Variables de entorno (Vercel): FIREBASE_SERVICE_ACCOUNT_JSON,
// TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID.

import { getNavePaymentDetails, getNavePaymentRequestStatus } from "./nave.js";
import {
  createDocIfAbsent,
  deleteDocIfExists,
  getDocData,
  isFirestoreAdminConfigured,
} from "./firestore-admin.js";

function fmtARS(n) {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
}

// Estados de Nave que significan "pago acreditado". La solicitud de pago usa
// SUCCESS_PROCESSED; el detalle de un pago puede usar APPROVED u otros.
export function isPaidStatus(name) {
  const n = String(name || "").toUpperCase();
  if (!n) return false;
  if (/FAIL|REJECT|REFUND|CHARGEBACK|EXPIRED|BLOCKED|CANCEL|PENDING/.test(n)) return false;
  return /SUCCESS|APPROVED|PAID|ACCREDIT/.test(n);
}

function statusName(s) {
  if (!s) return "";
  if (typeof s === "string") return s;
  return s.name || s.status || "";
}

// Arma un link de WhatsApp a partir del telefono que cargo el cliente.
function waLink(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    if (!d.startsWith("549") && d.length === 12) d = "549" + d.slice(2);
  } else {
    d = d.replace(/^0/, "");
    if (d.length === 10) d = "549" + d;
    else return null;
  }
  return "https://wa.me/" + d;
}

// Devuelve "sent", "not_configured" o "error".
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("TELEGRAM_NOT_CONFIGURED token:", !!token, "chat:", !!chatId);
    return "not_configured";
  }
  try {
    const resp = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!resp.ok) {
      console.error("TELEGRAM_SEND_ERROR", resp.status, await resp.text());
      return "error";
    }
    return "sent";
  } catch (e) {
    console.error("TELEGRAM_SEND_EXCEPTION", e);
    return "error";
  }
}

function buildMessage(orderId, p) {
  const lines = (p.items || []).map((i) => "• " + i.nombre + " x" + i.qty).join("\n");
  const wa = waLink(p.telefono);
  const x = p.extra || {};
  let msg =
    "🛍️ NUEVO PEDIDO PAGADO (Nave)\n\n" +
    lines + "\n\n" +
    "💰 Total: " + fmtARS(p.total) + "\n\n" +
    "👤 Cliente: " + (p.nombre || "-") + "\n" +
    "📞 Teléfono: " + (p.telefono || "-") + "\n" +
    (wa ? "💬 WhatsApp: " + wa + "\n" : "") +
    "📍 Envío: " + (p.direccion || "-") + "\n";
  if (x.promoCode) msg += "🏷️ Código: " + x.promoCode + "\n";
  if (x.isGift) {
    msg += "🎁 Es un regalo" + (x.giftMessage ? ': "' + x.giftMessage + '"' : "") +
      (x.hideGiftPrice ? " (no mostrar el precio)" : "") +
      (x.giftWrap ? " · con envoltorio" : "") + "\n";
  }
  msg += "\nPedido: " + orderId;
  return msg;
}

// Registra el pedido pagado (si falta) y manda el aviso (una sola vez).
// Devuelve { ok, notify } donde notify es "sent" | "already" |
// "not_configured" | "error" | "no_pending" | "no_firestore".
export async function registerPaidOrder(orderId) {
  if (!isFirestoreAdminConfigured()) {
    console.error("FIRESTORE_ADMIN_NOT_CONFIGURED", orderId);
    return { ok: false, notify: "no_firestore" };
  }
  const pending = await getDocData("navePedidosPendientes", orderId);
  if (!pending) {
    console.error("NAVE_PENDING_ORDER_NOT_FOUND", orderId);
    const t = await sendTelegram(
      "⚠️ Se acreditó un pago con Nave pero no encontré los datos del pedido " + orderId +
        ". Revisalo en el panel de Nave (Detalles de cobros)."
    );
    return { ok: false, notify: t === "sent" ? "no_pending" : t };
  }

  // 1) El pedido: se crea una sola vez; si la pagina ya lo creo, no pasa nada.
  try {
    await createDocIfAbsent("pedidos", orderId, {
      items: pending.items || [],
      total: pending.total || 0,
      medioPago: "nave",
      origen: "nave",
      estado: "pagado",
      nombre: pending.nombre || "",
      direccion: pending.direccion || "",
      telefono: pending.telefono || null,
      esRegalo: !!(pending.extra && pending.extra.isGift),
      cuponCodigo: (pending.extra && pending.extra.promoCode) || null,
      orderId,
      registradoPor: "servidor",
      createdAt: new Date(),
    });
  } catch (e) {
    console.error("NAVE_ORDER_CREATE_ERROR", orderId, e);
  }

  // 2) El aviso: marcador propio para que salga una sola vez.
  const claimed = await createDocIfAbsent("naveAvisos", orderId, { createdAt: new Date() });
  if (!claimed) return { ok: true, notify: "already" };

  const result = await sendTelegram(buildMessage(orderId, pending));
  if (result !== "sent") {
    // Si no se pudo avisar, liberamos el marcador para poder reintentar.
    await deleteDocIfExists("naveAvisos", orderId);
  }
  return { ok: true, notify: result };
}

// Webhook de Nave: nos avisa que un pago cambio de estado.
export async function handleNaveNotification(env, body, logTag) {
  console.log(logTag, JSON.stringify(body));
  if (!body) return;

  let orderId = String(body.external_payment_id || "");
  let paid = false;

  // Camino principal: la solicitud de pago que creamos nosotros.
  if (isFirestoreAdminConfigured() && orderId) {
    try {
      const pending = await getDocData("navePedidosPendientes", orderId);
      if (pending && pending.paymentRequestId) {
        const data = await getNavePaymentRequestStatus(env, pending.paymentRequestId);
        const st = statusName(data && data.status);
        console.log(logTag + "_STATUS_REQUEST", orderId, st);
        paid = isPaidStatus(st);
      }
    } catch (e) {
      console.error(logTag + "_STATUS_REQUEST_ERROR", orderId, e);
    }
  }

  // Respaldo: el detalle del pago que manda Nave en la notificacion.
  if (!paid && body.payment_check_url) {
    try {
      const details = await getNavePaymentDetails(env, body.payment_check_url);
      if (!orderId) orderId = String((details && details.external_payment_id) || "");
      const st = statusName(details && details.status);
      console.log(logTag + "_STATUS_DETAILS", orderId, st);
      paid = isPaidStatus(st);
    } catch (e) {
      console.error(logTag + "_STATUS_DETAILS_ERROR", orderId, e);
    }
  }

  if (!paid || !orderId) return;
  const r = await registerPaidOrder(orderId);
  console.log(logTag + "_REGISTERED", orderId, JSON.stringify(r));
}
