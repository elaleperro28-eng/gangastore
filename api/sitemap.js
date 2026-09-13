// Genera el sitemap.xml en vivo a partir del catalogo real en Firestore, en
// vez de depender de un archivo estatico (public/sitemap.xml) que hay que
// regenerar a mano cada vez que se agrega o se borra un perfume. Antes, ese
// archivo era un snapshot fijo: los productos nuevos nunca entraban solos y
// los que se borraban se quedaban linkeados para siempre. Tampoco tenia
// <lastmod>, que Google usa para decidir que tan seguido re-visitar cada URL.
//
// Tambien incluye las notas publicadas del blog (ver api/blog-og.js y el
// panel admin en App.jsx), para que Google las descubra sin depender solo
// de los links internos del sitio.
//
// vercel.json redirige aca /sitemap.xml -> /api/sitemap. Para que ese
// rewrite funcione hubo que borrar public/sitemap.xml: es la misma
// limitacion de Vercel que ya encontramos con index.html (un archivo
// estatico en esa ruta exacta le gana siempre al rewrite, asi que sin
// borrarlo esta funcion nunca se hubiera llegado a ejecutar).
//
// Mismo patron de lectura de Firestore que ya usan api/product-feed.js,
// api/og.js y api/blog-og.js: colecciones publicas, sin credenciales.

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
  if ("timestampValue" in v) return v.timestampValue;
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

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchAllDocs(collectionName) {
  let documents = [];
  let pageToken = "";
  do {
    const url =
      "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
      "/databases/(default)/documents/" + collectionName + "?pageSize=300" +
      (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
    const r = await fetch(url);
    if (!r.ok) throw new Error("Firestore respondio " + r.status + " (" + collectionName + ")");
    const j = await r.json();
    documents = documents.concat(j.documents || []);
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return documents;
}

// Trunca un timestamp ISO (de Firestore, con hora incluida) al formato
// fecha simple (YYYY-MM-DD) que pide el protocolo de sitemaps para <lastmod>.
function toLastmod(iso) {
  if (!iso) return null;
  const d = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function urlEntry(loc, lastmod, changefreq, priority) {
  return (
    "<url>\n" +
    "<loc>" + esc(loc) + "</loc>\n" +
    (lastmod ? "<lastmod>" + lastmod + "</lastmod>\n" : "") +
    "<changefreq>" + changefreq + "</changefreq>\n" +
    "<priority>" + priority + "</priority>\n" +
    "</url>"
  );
}

export default async function handler(req, res) {
  try {
    const [productDocs, blogDocs] = await Promise.all([
      fetchAllDocs("productos"),
      // Si la coleccion "blogPosts" todavia no existe (sitio sin notas
      // cargadas todavia), Firestore devuelve una lista vacia, no error.
      fetchAllDocs("blogPosts").catch(() => []),
    ]);

    const productItems = productDocs
      .map((d) => ({
        id: d.name.split("/").pop(),
        // updateTime es metadata propia del documento de Firestore (no un
        // campo mas): se actualiza sola cada vez que se edita el producto
        // (precio, stock, descripcion, etc), asi que es la mejor senal de
        // "ultima modificacion" para <lastmod>.
        updateTime: d.updateTime,
        ...fsToObj(d.fields || {}),
      }))
      .filter((p) => p.id !== "_site_banner" && !!p.nombre && isPerfumeLike(p))
      .filter((p) => Number(p.precio || p.price || 0) > 0)
      .map((p) => urlEntry(
        SITE_URL + "/?p=" + encodeURIComponent(p.id),
        toLastmod(p.updateTime) || toLastmod(p.createdAt),
        "weekly",
        "0.8"
      ))
      .join("\n");

    const blogItems = blogDocs
      .map((d) => ({ id: d.name.split("/").pop(), updateTime: d.updateTime, ...fsToObj(d.fields || {}) }))
      .filter((b) => b.publicado && !!b.titulo)
      .map((b) => urlEntry(
        SITE_URL + "/blog/" + encodeURIComponent(b.id),
        toLastmod(b.updateTime) || toLastmod(b.createdAt),
        "monthly",
        "0.6"
      ))
      .join("\n");

    const today = new Date().toISOString().slice(0, 10);
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urlEntry(SITE_URL + "/", today, "daily", "1.0") + "\n" +
      productItems + "\n" +
      (blogItems ? blogItems + "\n" : "") +
      "</urlset>\n";

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(xml);
  } catch (e) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(500).send("Error generando el sitemap: " + (e && e.message ? e.message : String(e)));
  }
}
