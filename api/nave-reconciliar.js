// Red de seguridad para los pedidos de Nave. Revisa los pedidos que quedaron
// "pendientes" en los ultimos dias, le pregunta a Nave cuales ya se pagaron y
// registra (y avisa) los que falten. Es seguro llamarlo todas las veces que
// haga falta: nunca duplica pedidos ni avisos.
//
// Tambien devuelve un diagnostico de la configuracion (solo si cada pieza esta
// bien o no, nunca datos de clientes ni claves), para encontrar rapido que
// falla cuando un pedido no aparece.
//
// URL: https://www.esenciaperfumeria.com.ar/api/nave-reconciliar

import { getNaveAccessToken, getNaveConfig, getNavePaymentRequestStatus } from "../lib/nave.js";
import { getDocData, isFirestoreAdminConfigured, listDocs } from "../lib/firestore-admin.js";
import { isPaidStatus, registerPaidOrder } from "../lib/nave-orders.js";

const DIAS = 3;
const MAX = 30;
let lastRun = 0;
let lastResult = null;

let lastCheckError = "";
async function check(fn) {
  try { await fn(); return true; } catch (e) { lastCheckError = String((e && e.message) || e).slice(0, 400); return false; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // Evita que se dispare mil veces seguidas: si corrio hace menos de 15 s,
  // devuelve el ultimo resultado.
  if (lastResult && Date.now() - lastRun < 15000) {
    res.status(200).json({ ...lastResult, cache: true });
    return;
  }
  const config = {
    firebaseConfigurado: isFirestoreAdminConfigured(),
    firebaseConecta: false,
    naveConfigurado: !!(getNaveConfig("production").clientId && getNaveConfig("production").clientSecret && getNaveConfig("production").posId),
    naveConecta: false,
    telegramConfigurado: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
  };
  const out = { config, resumen: {}, detalle: [] };

  try {
    config.naveConecta = config.naveConfigurado && (await check(() => getNaveAccessToken("production")));
    if (!config.firebaseConfigurado) {
      out.error = "Falta FIREBASE_SERVICE_ACCOUNT_JSON en Vercel (o esta mal pegada).";
      res.status(200).json(out);
      return;
    }
    let pendientes = [];
    config.firebaseConecta = await check(async () => { pendientes = await listDocs("navePedidosPendientes", 60); });
    if (!config.firebaseConecta) {
      out.error = "No se pudo conectar a Firebase con la clave cargada. Revisa que sea la clave completa del proyecto gangastore.";
      out.detalleTecnico = lastCheckError;
      res.status(200).json(out);
      return;
    }

    const desde = Date.now() - DIAS * 86400000;
    const recientes = pendientes
      .filter((p) => !p.createdAt || new Date(p.createdAt).getTime() >= desde)
      .slice(0, MAX);

    const resumen = { pendientesRevisados: recientes.length, yaRegistrados: 0, registradosAhora: 0, noPagados: 0, errores: 0 };
    for (const p of recientes) {
      const item = { orderId: p.id, creado: p.createdAt || null, total: p.total || 0 };
      try {
        const ya = await getDocData("pedidos", p.id);
        if (ya) {
          item.accion = "ya_registrado";
          resumen.yaRegistrados++;
        } else if (!p.paymentRequestId) {
          item.accion = "sin_id_de_nave";
          resumen.errores++;
        } else {
          const data = await getNavePaymentRequestStatus(p.env === "sandbox" ? "sandbox" : "production", p.paymentRequestId);
          const st = (data && data.status && (data.status.name || data.status)) || "";
          item.estadoNave = st;
          if (isPaidStatus(st)) {
            const r = await registerPaidOrder(p.id);
            item.accion = "registrado_ahora";
            item.aviso = r.notify;
            resumen.registradosAhora++;
          } else {
            item.accion = "no_pagado";
            resumen.noPagados++;
          }
        }
      } catch (e) {
        console.error("NAVE_RECONCILE_ITEM_ERROR", p.id, e);
        item.accion = "error";
        resumen.errores++;
      }
      out.detalle.push(item);
    }
    out.resumen = resumen;
  } catch (e) {
    console.error("NAVE_RECONCILE_EXCEPTION", e);
    out.error = "Error interno.";
  }
  lastRun = Date.now();
  lastResult = out;
  res.status(200).json(out);
}
