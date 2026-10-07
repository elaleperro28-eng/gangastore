// Acceso al servidor a Firestore (via REST) con una cuenta de servicio de
// Firebase, sin dependencias extra. Permite que las funciones de /api
// registren pedidos aunque el cliente nunca vuelva a la pagina.
//
// Variable de entorno requerida en Vercel (secreta, nunca en el codigo):
//   FIREBASE_SERVICE_ACCOUNT_JSON = contenido completo del JSON de la cuenta
//   de servicio (Firebase -> Configuracion del proyecto -> Cuentas de servicio
//   -> Generar nueva clave privada).

import crypto from "node:crypto";

let cachedToken = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (sa.private_key) sa.private_key = String(sa.private_key).replace(/\\n/g, "\n");
    return sa;
  } catch (e) {
    console.error("FIRESTORE_ADMIN_BAD_JSON");
    return null;
  }
}

export function isFirestoreAdminConfigured() {
  return !!getServiceAccount();
}

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken() {
  const sa = getServiceAccount();
  if (!sa) throw new Error("Firestore admin no configurado (falta FIREBASE_SERVICE_ACCOUNT_JSON).");
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signature = crypto.sign("RSA-SHA256", Buffer.from(header + "." + claim), sa.private_key);
  const jwt = header + "." + claim + "." + b64url(signature);

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.access_token) {
    console.error("FIRESTORE_ADMIN_AUTH_ERROR", resp.status, data);
    throw new Error("No pudimos autenticar con Firebase.");
  }
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return cachedToken.token;
}

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = toValue(v);
  return out;
}

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

function baseUrl() {
  const sa = getServiceAccount();
  return "https://firestore.googleapis.com/v1/projects/" + sa.project_id + "/databases/(default)/documents";
}

// Crea un documento con ID fijo. Devuelve false si ya existia (idempotente).
export async function createDocIfAbsent(collectionName, docId, data) {
  const token = await getAccessToken();
  const resp = await fetch(
    baseUrl() + "/" + collectionName + "?documentId=" + encodeURIComponent(docId),
    {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: toFields(data) }),
    }
  );
  if (resp.status === 409) return false;
  if (!resp.ok) {
    const err = await resp.text();
    console.error("FIRESTORE_ADMIN_CREATE_ERROR", collectionName, resp.status, err);
    throw new Error("No pudimos guardar en Firestore.");
  }
  return true;
}

export async function getDocData(collectionName, docId) {
  const token = await getAccessToken();
  const resp = await fetch(baseUrl() + "/" + collectionName + "/" + encodeURIComponent(docId), {
    headers: { Authorization: "Bearer " + token },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    console.error("FIRESTORE_ADMIN_GET_ERROR", collectionName, resp.status, await resp.text());
    throw new Error("No pudimos leer de Firestore.");
  }
  const doc = await resp.json();
  return fromFields(doc.fields);
}

export async function deleteDocIfExists(collectionName, docId) {
  const token = await getAccessToken();
  const resp = await fetch(baseUrl() + "/" + collectionName + "/" + encodeURIComponent(docId), {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token },
  });
  if (!resp.ok && resp.status !== 404) {
    console.error("FIRESTORE_ADMIN_DELETE_ERROR", collectionName, resp.status, await resp.text());
  }
}
