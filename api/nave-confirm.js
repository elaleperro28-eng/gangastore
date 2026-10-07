// La pagina llama a esta URL cuando el cliente vuelve de pagar con Nave.
// Verifica con Nave que el pago realmente se acredito y, si es asi, registra
// el pedido y le avisa al dueño por Telegram (una sola vez). Es el respaldo
// del webhook: si Nave no llega a avisar, igual te enteras del pedido.
//
// URL: https://www.esenciaperfumeria.com.ar/api/nave-confirm  (POST)

import { getNavePaymentRequestStatus } from "../lib/nave.js";
import { isPaidStatus, registerPaidOrder } from "../lib/nave-orders.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const orderId = String(body.orderId || "").slice(0, 36);
    const paymentRequestId = String(body.paymentRequestId || "").slice(0, 80);
    const env = body.env === "sandbox" ? "sandbox" : "production";
    if (!orderId || !paymentRequestId) {
      res.status(400).json({ error: "Faltan datos." });
      return;
    }

    const data = await getNavePaymentRequestStatus(env, paymentRequestId);
    const st = (data && data.status && (data.status.name || data.status)) || "";
    // Que la solicitud consultada corresponda a este pedido.
    if (data && data.external_payment_id && String(data.external_payment_id) !== orderId) {
      res.status(400).json({ error: "El pago no corresponde a este pedido." });
      return;
    }
    if (!isPaidStatus(st)) {
      res.status(200).json({ paid: false, status: st });
      return;
    }
    const r = await registerPaidOrder(orderId);
    console.log("NAVE_CONFIRM_REGISTERED", orderId, JSON.stringify(r));
    res.status(200).json({ paid: true, notify: r.notify });
  } catch (e) {
    console.error("NAVE_CONFIRM_EXCEPTION", e);
    res.status(500).json({ error: "Error interno." });
  }
}
