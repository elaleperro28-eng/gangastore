// Feed de productos para Google Merchant Center (listados gratis en Google
// Shopping). Lee el mismo catalogo publico de Firestore que usa el sitio
// (coleccion "productos", lectura publica ya permitida por las reglas
// existentes) asi que no necesita ninguna clave ni credencial nueva.
//
// URL una vez desplegado: https://www.esenciaperfumeria.com.ar/api/product-feed

const PROJECT_ID = "gangastore";
const SITE_URL = "https://www.esenciaperfumeria.com.ar";

const PERFUME_KEYWORDS = ["perfum", "edp", "elixir", "victoria secret", "lattafa", "bharara", "phantom", "givenchy", "paco rabane", "yara", "club de nuit"];

function fsVal(v) {
  if (!v || typeof v !== "object") return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsVal);
  if ("mapValue" in v) return fsToObj(v.mapValue.fields || {});
  return undefined;
}

function fsToObj(fields) {
  const out = {};
  for (const k in fields) out[k] = fsVal(fields[k]);
  return out;
}

function isPerfumeLike(p) {
  if ((p.categoria || "") === "perfume") return true;
  const name = String(p.nombre || "").toLowerCase();
  return PERFUME_KEYWORDS.some((k) => name.includes(k));
}

// Mismo slug legible que arma el cliente (ver productUrl/slugify en App.jsx)
// para que el link de cada item del feed coincida con el canonical real del
// producto (api/og.js arma el mismo slug a partir del nombre).
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
function productPath(p) {
  const slug = slugify(p.nombre);
  return "/producto/" + (slug ? encodeURIComponent(slug) + "/" : "") + encodeURIComponent(p.id);
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchAllProducts() {
  let documents = [];
  let pageToken = "";
  do {
    const url =
      "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
      "/databases/(default)/documents/productos?pageSize=300" +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    const r = await fetch(url);
    if (!r.ok) throw new Error("Firestore respondio " + r.status);
    const j = await r.json();
    documents = documents.concat(j.documents || []);
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return documents;
}

export default async function handler(req, res) {
  try {
    const documents = await fetchAllProducts();

    const items = documents
      .map((d) => ({ id: d.name.split("/").pop(), ...fsToObj(d.fields || {}) }))
      .filter((p) => p.id !== "_site_banner" && !!p.nombre && isPerfumeLike(p))
      .filter((p) => Number(p.precio || p.price || 0) > 0)
      .map((p) => {
        const price = Number(p.precio || p.price || 0);
        const image = p.imageUrl || p.imagen || p.foto || p.image || p.img || "";
        const disp = p.disponibilidad || "stock";
        const availability = disp === "agotado" ? "out_of_stock" : disp === "pedido" ? "backorder" : "in_stock";
        // "/producto/:slug/:id" (no "?p="): es la misma URL que ya usan el
        // sitemap, el canonical y el JSON-LD del sitio, y la unica que pasa
        // por api/og.js para mostrarle a Google Shopping el titulo/imagen
        // correctos del producto en vez de los genericos de la home.
        const link = SITE_URL + productPath(p);
        const description = String(p.descripcion || p.nombre || "").slice(0, 5000);
        return (
          "<item>\n" +
          "<g:id>" + esc(p.id) + "</g:id>\n" +
          "<title>" + esc(p.nombre) + "</title>\n" +
          "<description>" + esc(description) + "</description>\n" +
          "<link>" + esc(link) + "</link>\n" +
          (image ? "<g:image_link>" + esc(image) + "</g:image_link>\n" : "") +
          "<g:availability>" + availability + "</g:availability>\n" +
          "<g:price>" + price.toFixed(2) + " ARS</g:price>\n" +
          "<g:condition>new</g:condition>\n" +
          (p.marca ? "<g:brand>" + esc(String(p.marca).trim()) + "</g:brand>\n" : "") +
          "<g:identifier_exists>false</g:identifier_exists>\n" +
          "</item>"
        );
      })
      .join("\n");

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n' +
      "<channel>\n" +
      "<title>Esencia Perfumeria - Catalogo</title>\n" +
      "<link>" + SITE_URL + "</link>\n" +
      "<description>Perfumes arabes y de disenador originales, envios a todo el pais.</description>\n" +
      items + "\n" +
      "</channel>\n" +
      "</rss>\n";

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.status(200).send(xml);
  } catch (e) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(500).send("Error generando el feed: " + (e && e.message ? e.message : String(e)));
  }
}
