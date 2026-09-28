// URL de notificacion (notification_url) de PRODUCCION que hay que
// entregarle a Nave junto con el resto de los datos para pedir las
// credenciales:
//   https://www.esenciaperfumeria.com.ar/api/nave-webhook
//
// Nave llama a esta URL cada vez que un pago cambia de estado (aprobado,
// rechazado, devuelto, contracargo, etc). Por ahora la dejamos como registro
// en los logs de Vercel para poder revisar que las notificaciones llegan
// bien: la confirmacion real del pedido (la que se guarda en la base de
// datos y dispara el aviso por WhatsApp) se hace cuando el cliente vuelve a
// la pagina despues de pagar, consultando el estado directamente a Nave
// (ver /api/nave-payment-status) — asi evitamos darle a este archivo permiso
// para escribir pedidos en la base de datos.
//
// Igual hay que responder 200 siempre: si no, Nave reintenta la notificacion
// varias veces con una tabla de espera creciente.

import { getNavePaymentDetails } from "../lib/nave.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    console.log("NAVE_WEBHOOK_PRODUCTION", JSON.stringify(body));

    if (body && body.payment_check_url) {
      try {
        const details = await getNavePaymentDetails("production", body.payment_check_url);
        console.log(
          "NAVE_WEBHOOK_PRODUCTION_STATUS",
          body.external_payment_id,
          details && details.status
        );
      } catch (e) {
        console.error("NAVE_WEBHOOK_PRODUCTION_STATUS_ERROR", e);
      }
    }
  } catch (e) {
    console.error("NAVE_WEBHOOK_PRODUCTION_EXCEPTION", e);
  }

  res.status(200).json({ ok: true });
}
