// Crea una "preference" de Mercado Pago (Checkout Pro) para poder cobrar
// pedidos con tarjeta, débito, dinero en cuenta y CUOTAS. Mercado Pago se
// encarga solo de mostrar las cuotas disponibles en su checkout: no hay que
// programar nada extra para eso.
//
// El Access Token es SECRETO: vive solo en la variable de entorno
// MP_ACCESS_TOKEN configurada en Vercel (Project Settings -> Environment
// Variables), nunca en este archivo ni en el codigo del cliente.
//
// URL una vez desplegado: https://www.esenciaperfumeria.com.ar/api/create-preference

const SITE_URL = "https://www.esenciaperfumeria.com.ar";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    res.status(500).json({ error: "Mercado Pago no esta configurado todavia (falta MP_ACCESS_TOKEN en Vercel)." });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const total = Number(body.total);
    const title = String(body.title || "Pedido Esencia Perfumeria").slice(0, 250);
    const orderId = String(body.orderId || "").slice(0, 100);

    if (!total || !isFinite(total) || total <= 0) {
      res.status(400).json({ error: "Total invalido." });
      return;
    }

    const preference = {
      items: [
        {
          title,
          quantity: 1,
          unit_price: Math.round(total * 100) / 100,
          currency_id: "ARS",
        },
      ],
      back_urls: {
        success: SITE_URL + "/?mp_return=success",
        failure: SITE_URL + "/?mp_return=failure",
        pending: SITE_URL + "/?mp_return=pending",
      },
      auto_return: "approved",
      statement_descriptor: "ESENCIA PERFUMERIA",
      ...(orderId ? { external_reference: orderId } : {}),
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(preference),
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MP_PREFERENCE_ERROR", mpRes.status, data);
      res.status(mpRes.status).json({ error: (data && (data.message || data.error)) || "No pudimos crear el pago con Mercado Pago." });
      return;
    }

    res.status(200).json({ init_point: data.init_point, id: data.id });
  } catch (e) {
    console.error("MP_PREFERENCE_EXCEPTION", e);
    res.status(500).json({ error: "Error interno: " + (e && e.message ? e.message : String(e)) });
  }
}
