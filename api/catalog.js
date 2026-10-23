// Copia del catalogo servida desde la red de Vercel (cacheada). La pagina la
// pide en paralelo con la descarga del codigo y asi los primeros perfumes
// aparecen sin esperar a que cargue e inicie Firestore en el navegador.
// Cuando Firestore conecta, la pagina se actualiza en vivo como siempre.
//
// Mismas reglas que la consulta de la pagina: coleccion "productos" ordenada
// por createdAt descendente (los documentos sin createdAt, como los de
// configuracion "_site_*", quedan afuera igual que en Firestore).
//
// Usa la API key publica del proyecto (la misma que ya esta en el sitio): las
// reglas de Firestore permiten leer "productos" a cualquiera.

const PROJECT_ID = "gangastore";
const API_KEY = "AIzaSyAQlmsNO4bF9SVfwrcK6_-HJ_KFrcjTINg";

function fromValue(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
  if ("mapValue" in v) return fromFields(v.mapValue.fields || {});
  return null;
}

function fromFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = fromValue(v);
  return out;
}

// Version del catalogo: la actualiza el panel de admin cada vez que se crea o edita un
// producto. Sirve para que los cambios se vean enseguida aunque la copia este cacheada.
async function leerVersion() {
  try {
    const r = await fetch("https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/productos/_site_catalog_version?key=" + API_KEY);
    if (!r.ok) return "0";
    const j = await r.json();
    const f = j && j.fields && j.fields.v;
    if (!f) return "0";
    return String(f.integerValue || f.stringValue || f.doubleValue || "0");
  } catch (e) {
    return "0";
  }
}

// Colecciones publicas que la tienda puede pedir por aca. Se cachean en la red
// de Vercel, asi que miles de visitas cuestan UNA sola lectura de Firestore cada
// pocos minutos (en vez de una lectura por documento por visita).
const COLECCIONES = {
  productos: { limit: 1500, ttl: 900 },
  resenas: { limit: 500, ttl: 900 },
  blogPosts: { limit: 300, ttl: 900 },
  cupones: { limit: 200, ttl: 600 },
  combos: { limit: 200, ttl: 600 },
};
const ultimoBueno = {};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }
  const col = String((req.query && req.query.col) || "productos");
  const cfg = COLECCIONES[col];
  if (!cfg) {
    res.status(400).json({ error: "Coleccion no valida." });
    return;
  }
  const vq = col === "productos" ? String((req.query && req.query.v) || "").replace(/[^0-9A-Za-z_-]/g, "").slice(0, 30) : "";
  try {
    const version = col === "productos" ? (vq || (await leerVersion())) : "";
    const resp = await fetch(
      "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents:runQuery?key=" + API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: col }],
            orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
            limit: cfg.limit,
          },
        }),
      }
    );
    if (!resp.ok) {
      console.error("CATALOG_FIRESTORE_ERROR", col, resp.status, await resp.text());
      // Si Firestore falla (por ejemplo cupo agotado), devolvemos la ultima copia buena.
      if (ultimoBueno[col]) {
        res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
        res.status(200).json(ultimoBueno[col]);
        return;
      }
      res.status(502).json({ error: "No pudimos leer " + col + "." });
      return;
    }
    const rows = await resp.json();
    const data = rows
      .filter((r) => r.document)
      .map((r) => ({ id: r.document.name.split("/").pop(), ...fromFields(r.document.fields) }));
    ultimoBueno[col] = data;
    if (col === "productos") {
      res.setHeader("X-Catalog-Version", version);
      res.setHeader("Access-Control-Expose-Headers", "X-Catalog-Version");
    }
    // Con ?v=<version> la URL es unica por cada cambio del admin: se puede cachear mas tiempo.
    res.setHeader("Cache-Control", "public, s-maxage=" + (vq ? 3600 : cfg.ttl) + ", stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch (e) {
    console.error("CATALOG_EXCEPTION", e);
    if (ultimoBueno[col]) {
      res.setHeader("Cache-Control", "public, s-maxage=60");
      res.status(200).json(ultimoBueno[col]);
      return;
    }
    res.status(500).json({ error: "Error interno." });
  }
}
