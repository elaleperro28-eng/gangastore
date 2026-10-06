// Crea una "intencion de pago" con Nave (Banco Galicia) para poder cobrar
// pedidos con tarjeta, QR o en CUOTAS directamente en la pagina, sin pasar
// por WhatsApp. Nave se encarga solo de mostrar las cuotas disponibles en su
// propio checkout: no hay que programar nada extra para eso.
//
// Las credenciales son SECRETAS: viven solo en variables de entorno
// configuradas en Vercel (Project Settings -> Environment Variables), nunca
// en este archivo ni en el codigo del cliente. Ver lib/nave.js.
//
// URL una vez desplegado: https://www.esenciaperfumeria.com.ar/api/create-nave-payment

import { createNavePaymentRequest } from "../lib/nave.js";
import { createDocIfAbsent, isFirestoreAdminConfigured } from "../lib/firestore-admin.js";
import { computeServerTotal } from "../lib/pricing.js";

const SITE_URL = "https://www.esenciaperfumeria.com.ar";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const env = body.env === "sandbox" ? "sandbox" : "production";
    let total = Number(body.total);
    const orderId = String(body.orderId || "").slice(0, 36);
    const items = Array.isArray(body.items) ? body.items : [];

    if (!total || !isFinite(total) || total <= 0) {
      res.status(400).json({ error: "Total invalido." });
      return;
    }
    if (!orderId) {
      res.status(400).json({ error: "Falta el numero de pedido." });
      return;
    }

    // Recalculo de precios en el servidor: el total que cobramos sale de los
    // precios reales de Firestore, no del que manda el navegador. Si el cliente
    // intenta pagar MENOS de lo que corresponde, se rechaza. Si Firestore no
    // esta disponible no frenamos la venta (queda registrado en los logs).
    let verifiedItems = null;
    if (isFirestoreAdminConfigured() && items.length && items.every((i) => i && i.id)) {
      try {
        const calc = await computeServerTotal(
          items.map((i) => ({ id: i.id, qty: i.quantity })),
          body.promoCode
        );
        if (!calc.ok) {
          console.error("NAVE_PRICE_CHECK_REJECTED", orderId, calc.reason);
          res.status(409).json({ error: "Alguno de los productos del carrito ya no esta disponible o cambio. Actualiza la pagina y volve a intentar." });
          return;
        }
        if (total < calc.total - 1) {
          console.error("NAVE_PRICE_MISMATCH", orderId, "cliente:", total, "servidor:", calc.total);
          res.status(409).json({ error: "Los precios del carrito cambiaron. Actualiza la pagina y volve a intentar." });
          return;
        }
        total = calc.total;
        verifiedItems = items.map((i) => {
          const l = calc.lines.find((x) => x.id === String(i.id).slice(0, 120));
          return { name: i.name, quantity: l ? l.qty : Math.max(1, Number(i.quantity) || 1), unit_price: l ? l.price : Number(i.unit_price) || 0 };
        });
      } catch (e) {
        console.error("NAVE_PRICE_CHECK_ERROR", orderId, e);
      }
    }

    const lineItems = verifiedItems || items;
    const products = lineItems.length
      ? lineItems.map((i) => ({
          name: String(i.name || "Producto").slice(0, 120),
          quantity: Math.max(1, Number(i.quantity) || 1),
          unit_price: Number(i.unit_price) || 0,
        }))
      : [{ name: "Pedido Esencia Perfumeria", quantity: 1, unit_price: total }];

    const buyerName = body.buyer && body.buyer.name ? String(body.buyer.name).slice(0, 120) : "";
    const buyer = buyerName
      ? {
          name: buyerName,
          ...(body.buyer.phone ? { phone: String(body.buyer.phone).slice(0, 30) } : {}),
          ...(body.buyer.address ? { billing_address: { city: String(body.buyer.address).slice(0, 150), country: "AR" } } : {}),
        }
      : undefined;

    const data = await createNavePaymentRequest(env, {
      externalPaymentId: orderId,
      amount: total,
      products,
      buyer,
      callbackUrl: SITE_URL + "/?nave_return=" + encodeURIComponent(orderId) + (env === "sandbox" ? "&nave_env=sandbox" : ""),
    });

    // Guardamos el pedido pendiente en el servidor: cuando Nave avise por
    // webhook que se acredito el pago, lo registramos aunque el cliente no
    // vuelva a la pagina.
    if (isFirestoreAdminConfigured()) {
      try {
        await createDocIfAbsent("navePedidosPendientes", orderId, {
          items: lineItems.map((i) => ({
            nombre: String(i.name || "Producto").slice(0, 120),
            qty: Math.max(1, Number(i.quantity) || 1),
            precio: Number(i.unit_price) || 0,
          })),
          total,
          nombre: buyerName,
          telefono: body.buyer && body.buyer.phone ? String(body.buyer.phone).slice(0, 30) : null,
          direccion: body.buyer && body.buyer.address ? String(body.buyer.address).slice(0, 150) : "",
          env,
          paymentRequestId: data.id || null,
          createdAt: new Date(),
        });
      } catch (e) {
        console.error("NAVE_PENDING_SAVE_ERROR", e);
      }
    }

    res.status(200).json({
      checkout_url: data.checkout_url,
      qr_data: data.qr_data,
      payment_request_id: data.id,
      orderId,
    });
  } catch (e) {
    console.error("NAVE_CREATE_PAYMENT_EXCEPTION", e);
    res.status(500).json({ error: "Error interno: " + (e && e.message ? e.message : String(e)) });
  }
}
