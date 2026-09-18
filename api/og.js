// Sirve una version de la home con el <title>, meta description, Open Graph
// y Twitter Card especificos de un perfume para la vista previa de los
// links (WhatsApp, Facebook, Twitter, etc). Sin esto, el <title> y el
// canonical dinamicos que ya actualiza el cliente (ver App.jsx) nunca se
// ven en esas vistas previas, porque esos bots no ejecutan JavaScript: solo
// leen el HTML tal cual llega del servidor. Resultado: compartir cualquier
// perfume por WhatsApp siempre mostraba la vista previa generica de la
// home (mismo titulo, misma foto), sin importar que producto se compartia.
//
// vercel.json redirige aca /producto/:id -> /api/og?id=:id. Se eligio una
// ruta nueva (en vez de intentar interceptar "/" segun el User-Agent) por
// una limitacion real de Vercel: los archivos estaticos (como index.html
// en la raiz) siempre tienen prioridad sobre los "rewrites", asi que un
// rewrite condicional sobre "/" nunca llega a ejecutarse. /producto/:id no
// tiene ningun archivo estatico con ese nombre, asi que el rewrite si
// funciona.
//
// Todo el mundo entra por /producto/:id (bots Y personas reales), no solo
// los bots: la funcion arma el HTML con las etiquetas correctas para
// cualquiera, y ademas inyecta un pequeno script que hace
// history.replaceState a "/?p=<id>" antes de que cargue el bundle de
// React, asi la app abre el producto exactamente igual que con los links
// "?p=" de toda la vida (deep-link ya soportado, sin tocar nada de eso).
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

// Version segura para meter un valor arbitrario (el id de la URL) dentro de
// un <script> inline: evita que un id con comillas o "</script>" rompa el
// HTML o inyecte codigo.
function jsStringLiteral(s) {
return JSON.stringify(String(s)).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

// Mismo slug legible que arma el cliente (ver productUrl/slugify en App.jsx)
// para que el canonical/og:url de esta funcion coincida siempre con el que
// arma la app y el que arma api/sitemap.js y api/product-feed.js, sea cual
// sea la URL exacta con la que entraron aca (con slug, sin slug, o con un
// slug viejo si el producto cambio de nombre: el id manda, el slug es
// puramente cosmetico).
function slugify(text) {
return String(text || "")
.toLowerCase()
.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "")
.slice(0, 60)
.replace(/-+$/g, "");
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

const id = req.query.id;
if (!id) {
res.setHeader("Content-Type", "text/html; charset=utf-8");
res.status(200).send(baseHtml);
return;
}

try {
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
// El <link rel="canonical"> y el og:url apuntan los dos a /producto/:id (el
// sitemap, el JSON-LD y el canonical dinamico del cliente en App.jsx ya
// usan este mismo formato). Antes el canonical usaba "?p=" en vez de
// "/producto/:id": funcionaba porque Google ejecuta JavaScript y termina
// viendo el contenido correcto igual, pero cualquier otro rastreador o
// herramienta que lea el HTML crudo de "?p=" (sin pasar por esta funcion)
// se encontraba con el titulo/description genericos de la home. Usar
// /producto/:id como canonical evita ese problema: es la unica URL que,
// la pida quien la pida, siempre resuelve al HTML ya completo de este
// producto.
const slug = slugify(nombre);
const canonicalUrl = SITE_URL + "/producto/" + (slug ? encodeURIComponent(slug) + "/" : "") + encodeURIComponent(String(id));
const ogUrl = canonicalUrl;
const precio = Number(p.precio || p.price || 0);
const disp = p.disponibilidad || "stock";

let html = baseHtml;
html = html.replace(/(<title>)[^<]*(<\/title>)/, "$1" + esc(title) + "$2");
html = replaceAttr(html, /(<meta\s+name="description"\s+content=")[^"]*(")/, description);
html = replaceAttr(html, /(<link\s+rel="canonical"\s+href=")[^"]*(")/, canonicalUrl);
// og:type "product" (en vez del "website" generico de la home) y los meta
// product:* son los que WhatsApp/Facebook leen para mostrar el precio junto
// a la vista previa del link, no solo el titulo/imagen.
html = replaceAttr(html, /(<meta\s+property="og:type"\s+content=")[^"]*(")/, "product");
html = replaceAttr(html, /(<meta\s+property="og:title"\s+content=")[^"]*(")/, title);
html = replaceAttr(html, /(<meta\s+property="og:description"\s+content=")[^"]*(")/, description);
html = replaceAttr(html, /(<meta\s+property="og:url"\s+content=")[^"]*(")/, ogUrl);
html = replaceAttr(html, /(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, title);
html = replaceAttr(html, /(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, description);
if (precio > 0) {
const productMeta =
'<meta property="product:price:amount" content="' + esc(precio.toFixed(2)) + '" />\n' +
'<meta property="product:price:currency" content="ARS" />\n' +
'<meta property="product:availability" content="' + (disp === "agotado" ? "out of stock" : disp === "pedido" ? "preorder" : "in stock") + '" />\n';
html = html.replace(/<\/head>/, productMeta + "</head>");
}
if (image) {
html = replaceAttr(html, /(<meta\s+property="og:image"\s+content=")[^"]*(")/, image);
html = replaceAttr(html, /(<meta\s+name="twitter:image"\s+content=")[^"]*(")/, image);
html = replaceAttr(html, /(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/, nombre);
// El ancho/alto declarado corresponde a la imagen cuadrada generica; con
// la foto real del producto (otra proporcion) mejor no declarar tamano.
html = removeTag(html, /\s*<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/>\n?/);
html = removeTag(html, /\s*<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/>\n?/);
}

// Para que una persona real que abre este link vea la app normal con el
// producto ya abierto: antes de que cargue el bundle de React, cambiamos
// la URL (sin recargar) a "/?p=<id>", que es el formato que la app ya
// sabe leer al iniciar.
const bootstrapScript = "<script>history.replaceState(null,\"\",\"/?p=\"+" + jsStringLiteral(id) + ");</script>\n";
html = html.replace(/<head>/, "<head>\n" + bootstrapScript);

res.setHeader("Content-Type", "text/html; charset=utf-8");
res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
res.status(200).send(html);
} catch (e) {
res.setHeader("Content-Type", "text/html; charset=utf-8");
res.status(200).send(baseHtml);
}
}
