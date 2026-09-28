// URL de notificacion (notification_url) de SANDBOX (pruebas) que hay que
// entregarle a Nave junto con el resto de los datos para pedir las
// credenciales:
//   https://www.esenciaperfumeria.com.ar/api/nave-webhook-sandbox
//
// Es la misma idea que nave-webhook.js (produccion) pero apuntando al
// ambiente de pruebas de Nave, para poder probar el flujo completo antes de
// salir en vivo con clientes reales.

import { getNavePaymentDetails } from "../lib/nave.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    console.log("NAVE_WEBHOOK_SANDBOX", JSON.stringify(body));

    if (body && body.payment_check_url) {
      try {
        const details = await getNavePaymentDetails("sandbox", body.payment_check_url);
        console.log(
          "NAVE_WEBHOOK_SANDBOX_STATUS",
          body.external_payment_id,
          details && details.status
        );
      } catch (e) {
        console.error("NAVE_WEBHOOK_SANDBOX_STATUS_ERROR", e);
      }
    }
  } catch (e) {
    console.error("NAVE_WEBHOOK_SANDBOX_EXCEPTION", e);
  }

  res.status(200).json({ ok: true });
}
