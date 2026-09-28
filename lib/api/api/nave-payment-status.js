// Consulta el estado real de una intencion de pago directamente contra la
// API de Nave. La usa la pagina cuando el cliente vuelve del checkout de
// Nave, para confirmar que el pago se acredito ANTES de guardar el pedido y
// avisar por WhatsApp — asi nunca se confirma un pedido que en realidad no
// se termino de pagar (mismo criterio que ya usamos con Mercado Pago).
//
// URL una vez desplegado:
// https://www.esenciaperfumeria.com.ar/api/nave-payment-status?paymentRequestId=...&env=sandbox

import { getNavePaymentRequestStatus } from "../lib/nave.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  try {
    const paymentRequestId = String((req.query && req.query.paymentRequestId) || "");
    const env = req.query && req.query.env === "sandbox" ? "sandbox" : "production";

    if (!paymentRequestId) {
      res.status(400).json({ error: "Falta paymentRequestId." });
      return;
    }

    const data = await getNavePaymentRequestStatus(env, paymentRequestId);
    const statusName = (data && data.status && data.status.name) || "UNKNOWN";

    res.status(200).json({
      status: statusName,
      externalPaymentId: data && data.external_payment_id,
    });
  } catch (e) {
    console.error("NAVE_PAYMENT_STATUS_EXCEPTION", e);
    res.status(500).json({ error: "Error interno: " + (e && e.message ? e.message : String(e)) });
  }
}
