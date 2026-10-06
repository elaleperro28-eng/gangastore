// Recalculo de precios en el SERVIDOR. La pagina manda que productos hay en el
// carrito (id + cantidad) y el codigo promocional, pero el precio real sale
// siempre de Firestore: asi nadie puede pagar de menos editando el total o los
// precios desde el navegador.
//
// Replica exactamente las reglas de la tienda (App.jsx):
//   - precio de cada linea: producto, decant (precioDecant5/10) o combo armado
//   - 5% OFF si hay 3 decants distintos
//   - descuento por cantidad de perfumes (config en productos/_site_perfume_combo)
//   - cupones (coleccion "cupones", id = codigo en mayusculas)
// El descuento por puntos no aplica al pagar con Nave.

import { getDocData } from "./firestore-admin.js";

const DECANT_COMBO_MIN = 3;
const DECANT_COMBO_DISCOUNT_PCT = 0.05;
const MAX_QTY = 99;

function num(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

async function resolveLinePrice(id) {
  if (id.startsWith("combo_")) {
    const combo = await getDocData("combos", id.slice("combo_".length));
    return combo ? { price: num(combo.precioCombo), kind: "combo" } : null;
  }
  const m = id.match(/^(.+)_decant(5|10)$/);
  if (m) {
    const p = await getDocData("productos", m[1]);
    if (!p) return null;
    return { price: num(m[2] === "5" ? p.precioDecant5 : p.precioDecant10), kind: "decant", baseId: m[1] };
  }
  const p = await getDocData("productos", id);
  return p ? { price: num(p.precio || p.price), kind: "perfume" } : null;
}

function evalCupon(cupon, total) {
  if (!cupon || !cupon.activo) return 0;
  if (cupon.fechaExpiracion) {
    const exp = new Date(cupon.fechaExpiracion + "T23:59:59");
    if (!isNaN(exp.getTime()) && exp < new Date()) return 0;
  }
  if (cupon.minCompra && total < num(cupon.minCompra)) return 0;
  return cupon.tipo === "monto"
    ? Math.min(num(cupon.valor), total)
    : Math.round((total * Math.max(0, Math.min(100, num(cupon.valor)))) / 100);
}

// items: [{ id, qty }]. Devuelve { ok, total, lines } o { ok:false, reason }.
export async function computeServerTotal(items, promoCode) {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: "carrito_vacio" };

  const lines = [];
  for (const it of items.slice(0, 50)) {
    const id = String((it && it.id) || "").slice(0, 120);
    const qty = Math.min(Math.max(1, Math.floor(num(it && it.qty))), MAX_QTY);
    if (!id) return { ok: false, reason: "item_sin_id" };
    const r = await resolveLinePrice(id);
    if (!r || r.price <= 0) return { ok: false, reason: "producto_no_encontrado:" + id };
    lines.push({ id, qty, ...r });
  }

  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  let discount = 0;

  const decants = lines.filter((l) => l.kind === "decant");
  if (new Set(decants.map((l) => l.baseId)).size >= DECANT_COMBO_MIN) {
    discount += Math.round(decants.reduce((a, l) => a + l.price * l.qty, 0) * DECANT_COMBO_DISCOUNT_PCT);
  }

  const perfumes = lines.filter((l) => l.kind === "perfume");
  const cfg = await getDocData("productos", "_site_perfume_combo");
  const minQty = (cfg && num(cfg.minCantidad)) || 2;
  const pct = (cfg && num(cfg.descuentoPct)) || 0;
  const perfumeQty = perfumes.reduce((a, l) => a + l.qty, 0);
  if (cfg && cfg.activo && perfumeQty >= minQty && pct > 0) {
    discount += Math.round((perfumes.reduce((a, l) => a + l.price * l.qty, 0) * pct) / 100);
  }

  const code = String(promoCode || "").trim().toUpperCase();
  if (code) {
    const cupon = await getDocData("cupones", code);
    discount += evalCupon(cupon, subtotal);
  }

  return { ok: true, total: Math.max(subtotal - discount, 0), subtotal, discount, lines };
}
