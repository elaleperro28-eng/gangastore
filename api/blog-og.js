// Sirve el index.html con el <title>, meta description, Open Graph y
// Twitter Card de una nota del blog especifica, para que las vistas
// previas de WhatsApp/Facebook/etc muestren la nota que se comparte (y no
// el titulo generico de la home). Mismo problema y misma solucion que
// api/og.js para productos: esos bots no ejecutan JavaScript, asi que
// nunca ven el titulo dinamico que ya actualiza el cliente al abrir una
// nota (ver App.jsx).
//
// A diferencia de /producto/:id, esta ruta (/blog/:slug) YA es la url real
// que usa el cliente (no hace falta reescribirla a otro formato como
// "?p="), asi que esta funcion no necesita inyectar ningun script de
// redireccion: alcanza con devolver el index.html con las etiquetas
// correctas. El bundle de React arranca igual y lee el slug de la propia
// URL (ver initialBlogSlugRef en App.jsx).
//
// vercel.json redirige aca /blog/:slug -> /api/blog-og?slug=:slug.
//
// Mismo patron de lectura de Firestore que ya usan api/product-feed.js,
// api/og.js y api/sitemap.js: coleccion publica, sin credenciales.

const PROJECT_ID = "gangastore";
const SITE_URL = "https://www.esenciaperfumeria.com.ar";

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

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchPost(slug) {
  const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/blogPosts/" + encodeURIComponent(slug);
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.fields) return null;
  return fsToObj(j.fields);
}

function replaceAttr(html, tagRegex, newValue) {
  return html.replace(tagRegex, function (match, before, after) {
    return before + esc(newValue) + after;
  });
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

  const slug = req.query.slug;
  if (!slug) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(baseHtml);
    return;
  }

  try {
    const p = await fetchPost(String(slug));
    // Si la nota no existe, es un borrador o fue borrada, mostramos el
    // index.html generico (nunca un error) para no romper la pagina, y
    // sobre todo para no filtrar borradores en las vistas previas.
    if (!p || !p.titulo || !p.publicado) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(baseHtml);
      return;
    }

    const titulo = String(p.titulo);
    const title = titulo + " | Blog Esencia Perfumeria";
    const resumenRaw = String(p.resumen || "").trim();
    const description = resumenRaw ? resumenRaw.slice(0, 160) : ("Notas y guias de Esencia Perfumeria: " + titulo);
    const image = p.imagen || "";
    const pageUrl = SITE_URL + "/blog/" + encodeURIComponent(String(slug));

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
      html = replaceAttr(html, /(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/, titulo);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=86400");
    res.status(200).send(html);
  } catch (e) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(baseHtml);
  }
}
