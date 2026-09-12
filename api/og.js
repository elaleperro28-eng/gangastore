// Sirve una version de la home con el <title>, meta description, Open Graph
// y Twitter Card especificos de un perfume a los bots que arman la vista
// previa de los links (WhatsApp, Facebook, Twitter, etc). Esos bots no
// ejecutan JavaScript, asi que nunca ven los cambios que el sitio hace en
// el navegador (title dinamico, canonical dinamico, JSON-LD por producto).
// Sin esto, compartir cualquier perfume por WhatsApp siempre mostraba la
// vista previa generica de la home (mismo titulo, misma foto), sin importar
// que producto se compartia.
//
// vercel.json solo redirige aca los pedidos a "/" que traen "?p=<id>" Y un
// User-Agent conocido de bot de vista previa. Las personas reales siguen
// entrando siempre al index.html normal, la app de React no se toca.
//
// Lee el mismo catalogo publico de Firestore que ya usa el sitio (misma
// coleccion "productos", lectura publica ya permitida) asi que no necesita
// ninguna clave ni credencial nueva. Mismo patron que api/product-feed.js.

const PROJECT_ID = "gangastore";
const SITE_URL = "https://www.esenciaperfumeria.com.ar";

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

function esc(s) {
return String(s == null ? "" : s)
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&apos;");
}

async function fetchProduct(id) {
const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/productos/" + encodeURIComponent(id);
const r = await fetch(url);
if (!r.ok) return null;
const j = await r.json();
if (!j.fields) return null;
return fsToObj(j.fields);
}

// Reemplaza el content/href de una etiqueta puntual sin tocar el resto del
// HTML. Si la etiqueta no aparece (por algun cambio futuro en index.html)
// simplemente no hace nada, para no romper nunca la pagina.
function replaceAttr(html, tagRegex, newValue) {
return html.replace(tagRegex, function (match, before, after) {
return before + esc(newValue) + after;
});
}

function removeTag(html, tagRegex) {
return html.replace(tagRegex, "");
}

export default async function handler(req, res) {
const host = req.headers["x-forwarded-host"] || req.headers.host;
let baseHtml;
try {
baseHtml = await fetch("https://" + host + "/index.html").then((r) => r.text());
} catch (e) {
res.status(502).send("No se pudo obtener index.html");
return;
}

try {
const id = req.query.p;
if (!id) {
res.setHeader("Content-Type", "text/html; charset=utf-8");
res.status(200).send(baseHtml);
return;
}

const p = await fetchProduct(String(id));
if (!p || !p.nombre) {
res.setHeader("Content-Type", "text/html; charset=utf-8");
res.status(200).send(baseHtml);
return;
}

const nombre = String(p.nombre);
const title = nombre + " | Esencia Perfumeria";
const descRaw = String(p.descripcion || "").trim();
const description = descRaw
? descRaw.slice(0, 160)
: "Compra " + nombre + " en Esencia Perfumeria. Envio gratis en Bahia Blanca y envios a todo el pais.";
const image = p.imageUrl || p.imagen || p.foto || p.image || p.img || "";
const pageUrl = SITE_URL + "/?p=" + encodeURIComponent(String(id));

let html = baseHtml;
html = html.replace(/(<title>)[^<]*(<\/title>)/, "$1" + esc(title) + "$2");
html = replaceAttr(html, /(<meta\s+name="description"\s+content=")[^"]*(")/, description);
html = replaceAttr(html, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, pageUrl);
html = replaceAttr(html, /(<meta\s+property="og:title"\s+content=")[^"]*(")/, title);
html = replaceAttr(html, /(<meta\s+property="og:description"\s+content=")[^"]*(")/, description);
html = replaceAttr(html, /(<meta\s+property="og:url"\s+content=")[^"]*(")/, pageUrl);
html = replaceAttr(html, /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, title);
html = replaceAttr(html, /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, description);
if (image) {
html = replaceAttr(html, /(<meta\s+property="og:image"\s+content=")[^"]*(")/, image);
html = replaceAttr(html, /(<meta\s+name="twitter:image"\s+content=")[^"]*(")/, image);
html = replaceAttr(html, /(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/, nombre);
// El ancho/alto declarado corresponde a la imagen cuadrada generica; con
// la foto real del producto (otra proporcion) mejor no declarar tamano.
html = removeTag(html, /\s*<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/>\n?/);
html = removeTag(html, /\s*<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/>\n?/);
}

res.setHeader("Content-Type", "text/html; charset=utf-8");
res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
res.status(200).send(html);
} catch (e) {
res.setHeader("Content-Type", "text/html; charset=utf-8");
res.status(200).send(baseHtml);
}
}
