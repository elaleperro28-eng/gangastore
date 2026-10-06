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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }
  try {
    const resp = await fetch(
      "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents:runQuery?key=" + API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "productos" }],
            orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESCENDING" }],
            limit: 1500,
          },
        }),
      }
    );
    if (!resp.ok) {
      console.error("CATALOG_FIRESTORE_ERROR", resp.status, await resp.text());
      res.status(502).json({ error: "No pudimos leer el catalogo." });
      return;
    }
    const rows = await resp.json();
    const products = rows
      .filter((r) => r.document)
      .map((r) => ({ id: r.document.name.split("/").pop(), ...fromFields(r.document.fields) }));

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=600");
    res.status(200).json(products);
  } catch (e) {
    console.error("CATALOG_EXCEPTION", e);
    res.status(500).json({ error: "Error interno." });
  }
}
