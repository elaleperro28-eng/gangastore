import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDoc, setDoc, where, getDocs } from "firebase/firestore";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

const firebaseConfig = {
apiKey: "AIzaSyAQlmsNO4bF9SVfwrcK6_-HJ_KFrcjTINg",
authDomain: "gangastore.firebaseapp.com",
projectId: "gangastore",
storageBucket: "gangastore.firebasestorage.app",
messagingSenderId: "167884959340",
appId: "1:167884959340:web:0cd7f22b3506eff1c3b249"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// SEGURIDAD: el panel de administracion ahora se protege con Firebase Authentication
// (el mismo sistema de cuentas que ya usan los clientes para sumar puntos), en vez de
// una contrasena fija escrita en el codigo. Eso evita que cualquiera que abra el codigo
// fuente del sitio (por ejemplo en GitHub, o con "Ver codigo fuente" del navegador)
// pueda copiar la clave de administrador y entrar.
//
// Para que esto funcione hay que crear una cuenta con este correo desde la propia tienda:
// 1) Entra a la tienda y toca "Ingresar" (arriba a la derecha).
// 2) Elegi "Crear cuenta", usa el correo de abajo y una contrasena segura tuya.
// 3) Esa contrasena es la que vas a usar para entrar a /admin-login de ahora en mas.
// 4) Ademas, actualiza las Reglas de Seguridad de Firestore (ver README/INSTRUCCIONES)
//    para que solo ese correo pueda escribir en la base de datos. Sin ese paso, el
//    panel se ve mas seguro pero la base de datos todavia queda abierta por detras.
const ADMIN_EMAIL = "elaleperro28@gmail.com";
const IMGUR_CLIENT_ID = "546c25a59c58ad7"; const TAG_OPTIONS = [{ key: "mas_vendidos", label: "Mas vendidos" }, { key: "novedades", label: "Novedades" }, { key: "larga_duracion", label: "Larga duracion" }, { key: "para_regalar", label: "Para regalar" }, { key: "top_invierno", label: "Top invierno" }, { key: "top_verano", label: "Top verano" }, { key: "top_oficina", label: "Top oficina" }, { key: "top_citas", label: "Top citas" }];
const shuffleArray = (arr) => {
const a = [...arr];
for (let i = a.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[a[i], a[j]] = [a[j], a[i]];
}
return a;
};

export default function App() {
const [page, setPage] = useState(() => {
const path = window.location.pathname;
if (path === "/admin-login" || path === "/admin-login/") return "adminLogin";
return "home";
});
const [isMobileHero, setIsMobileHero] = useState(() => typeof window !== "undefined" && window.innerWidth <= 700);
const [products, setProducts] = useState([]);  const [productsLoading, setProductsLoading] = useState(true);
const [resenas, setResenas] = useState([]);
const [resenaForm, setResenaForm] = useState({ nombre: "", ciudad: "", estrellas: "5", texto: "", foto: "" });
const [resenaSaving, setResenaSaving] = useState(false);
const [resenaUploading, setResenaUploading] = useState(false);
const [tickerProducts, setTickerProducts] = useState([]);
const [cart, setCart] = useState(() => {
  try { return JSON.parse(localStorage.getItem("carritoEsencia") || "[]"); } catch { return []; }
});
const [showCart, setShowCart] = useState(false);
const [adminPass, setAdminPass] = useState("");
const [adminError, setAdminError] = useState("");
const [isAdmin, setIsAdmin] = useState(false);
const [filter, setFilter] = useState("todos");
const [searchQuery, setSearchQuery] = useState("");
const PAGE_SIZE = 24;
const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
const [sortBy, setSortBy] = useState("relevancia");
const [advFilterOpen, setAdvFilterOpen] = useState(false);
  const [tagFiltersOpen, setTagFiltersOpen] = useState(false);
const [filterMarca, setFilterMarca] = useState("");
const [filterPrecioMin, setFilterPrecioMin] = useState("");
const [filterPrecioMax, setFilterPrecioMax] = useState("");
const [filterDuracion, setFilterDuracion] = useState("");
const [filterNotas, setFilterNotas] = useState("");
const [filterTemporada, setFilterTemporada] = useState("");
const [filterGenero, setFilterGenero] = useState("");
const [filterTipo, setFilterTipo] = useState("");
const [assistantOpen, setAssistantOpen] = useState(false);
const [assistantChat, setAssistantChat] = useState([{ from: "bot", text: "Hola! Soy el asistente virtual de Esencia Perfumeria. Elegi una opcion para que te ayude:" }]);
const [promoCode, setPromoCode] = useState(""); const [customerPhone, setCustomerPhone] = useState(""); const [customerPoints, setCustomerPoints] = useState(null); const [pointsLoading, setPointsLoading] = useState(false); const [redeemPoints, setRedeemPoints] = useState(false);
const [user, setUser] = useState(null);
const [referralCode, setReferralCode] = useState("");
const [referralCredit, setReferralCredit] = useState(0);
const [referralPendingIds, setReferralPendingIds] = useState([]);
const [referralInput, setReferralInput] = useState("");
const [redeemReferralCredit, setRedeemReferralCredit] = useState(false);
const [showAccountModal, setShowAccountModal] = useState(false);
const [accountMode, setAccountMode] = useState("login");
const [accountEmail, setAccountEmail] = useState("");
const [accountPassword, setAccountPassword] = useState("");
const [accountError, setAccountError] = useState("");
const [accountBusy, setAccountBusy] = useState(false);
const [editingId, setEditingId] = useState(null);
const [form, setForm] = useState({
nombre: "",
precio: "",
precioOriginal: "",
descripcion: "",
imageUrl: "",
foto2: "",
foto3: "",
fotoMano: "",
fotoCaja: "",
videoUrl: "",
disponibilidad: "stock",
diasHabiles: "3",
categoria: "perfume",
marca: "",
genero: "",
temporada: "",
tipoPerfume: "",
duracion: "",
notas: "",
inspiradoEn: "",
similitud: "", stockBajo: "", etiquetas: [], precioDecant5: "", precioDecant10: ""
});
const [uploading, setUploading] = useState(false);
const [uploadMsg, setUploadMsg] = useState("");
const [uploadingField, setUploadingField] = useState(null);
const fileInputRef = useRef(null);
const foto2Ref = useRef(null);
const foto3Ref = useRef(null);
const fotoManoRef = useRef(null);
const fotoCajaRef = useRef(null);
const videoRef = useRef(null);
const [selectedProduct, setSelectedProduct] = useState(null);
const [modalActiveImg, setModalActiveImg] = useState(null);
const [toast, setToast] = useState("");
const toastTimerRef = useRef(null);
const showToast = (msg) => {
setToast(msg);
if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
toastTimerRef.current = setTimeout(() => setToast(""), 2200);
};
const [favorites, setFavorites] = useState(() => {
try { return JSON.parse(localStorage.getItem("favoritosEsencia") || "[]"); } catch { return []; }
});
const toggleFavorite = (id) => {
setFavorites(f => {
const next = f.includes(id) ? f.filter(x => x !== id) : [...f, id];
try { localStorage.setItem("favoritosEsencia", JSON.stringify(next)); } catch {}
return next;
});
};
const [recentlyViewed, setRecentlyViewed] = useState(() => {
try { return JSON.parse(localStorage.getItem("vistosEsencia") || "[]"); } catch { return []; }
});

useEffect(() => {
  try { localStorage.setItem("carritoEsencia", JSON.stringify(cart)); } catch {}
}, [cart]);

useEffect(() => {
const q = query(collection(db, "productos"), orderBy("createdAt", "desc"));
const unsub = onSnapshot(q, (snap) => {
setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setProductsLoading(false);
});
return () => unsub();
}, []);

useEffect(() => {
const q2 = query(collection(db, "resenas"), orderBy("createdAt", "desc"));
const unsub2 = onSnapshot(q2, (snap) => {
setResenas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});
return () => unsub2();
}, []);

useEffect(() => {
if (products.length > 0) {
const seenKeys = new Set();
const onlyPerfumes = products.filter(p => {
if (!isPerfume(p)) return false;
const key = normalizeTxt(getProductName(p)) + "|" + getProductPrice(p);
if (seenKeys.has(key)) return false;
seenKeys.add(key);
return true;
});
setTickerProducts(shuffleArray(onlyPerfumes).slice(0, 18));
}
}, [products.length]);

useEffect(() => {
setVisibleCount(PAGE_SIZE);
}, [filter, searchQuery, sortBy, filterMarca, filterPrecioMin, filterPrecioMax, filterDuracion, filterNotas, filterTemporada, filterGenero, filterTipo]);

useEffect(() => {
const handlePop = () => {
const p = window.location.pathname;
if (p === "/admin-login" || p === "/admin-login/") {
setPage("adminLogin");
} else {
setPage("home");
}
};
window.addEventListener("popstate", handlePop);
return () => window.removeEventListener("popstate", handlePop);
}, []);

useEffect(() => {
setModalActiveImg(null);
if (selectedProduct && selectedProduct.id) {
setRecentlyViewed(rv => {
const next = [selectedProduct.id, ...rv.filter(id => id !== selectedProduct.id)].slice(0, 10);
try { localStorage.setItem("vistosEsencia", JSON.stringify(next)); } catch {}
return next;
});
}
}, [selectedProduct]);

useEffect(() => {
const unsub = onAuthStateChanged(auth, (u) => {
setUser(u);
if (u) {
loadMyPoints(u.uid);
loadMyReferral(u.uid);
} else {
setCustomerPoints(null);
setRedeemPoints(false);
}
});
return () => unsub();
}, []);

const [adminLoginBusy, setAdminLoginBusy] = useState(false);
const handleAdminLogin = async () => {
if (!adminPass) { setAdminError("Ingresa tu contrasena"); return; }
setAdminLoginBusy(true);
setAdminError("");
try {
const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, adminPass);
if (cred.user.email !== ADMIN_EMAIL) {
setAdminError("Esta cuenta no tiene permisos de administrador");
await signOut(auth);
} else {
setIsAdmin(true);
setAdminPass("");
setPage("admin");
}
} catch (e) {
const map = { "auth/invalid-credential": "Correo o contrasena incorrectos.", "auth/wrong-password": "Correo o contrasena incorrectos.", "auth/user-not-found": "Todavia no creaste la cuenta de administrador. Mira las instrucciones en el codigo (ADMIN_EMAIL)." };
setAdminError(map[e.code] || "No pudimos iniciar sesion. Intenta de nuevo.");
}
setAdminLoginBusy(false);
};

const handleImageUpload = async (file, field = "imageUrl") => {
if (!file) return;
setUploading(true);
setUploadingField(field);
setUploadMsg("Subiendo archivo...");
const formData = new FormData();
formData.append("image", file);
try {
const res = await fetch("https://api.imgur.com/3/image", {
method: "POST",
headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
body: formData,
});
const data = await res.json();
if (data.success) {
setForm(f => ({ ...f, [field]: data.data.link }));
setUploadMsg("Archivo subido correctamente");
} else {
setUploadMsg("Error al subir archivo");
}
} catch {
setUploadMsg("Error de conexion");
}
setUploading(false);
setUploadingField(null);
};

const handleAddProduct = async () => {
if (!form.nombre.trim()) return alert("Ingresa el nombre del producto");
if (!form.precio) return alert("Ingresa el precio");
if (!form.imageUrl) return alert("Sube una imagen primero");
const productData = {
nombre: form.nombre,
precio: Number(form.precio),
precioOriginal: form.precioOriginal ? Number(form.precioOriginal) : null,
descripcion: form.descripcion,
imageUrl: form.imageUrl,
foto2: form.foto2 || null,
foto3: form.foto3 || null,
fotoMano: form.fotoMano || null,
fotoCaja: form.fotoCaja || null,
videoUrl: form.videoUrl || null,
disponibilidad: form.disponibilidad,
diasHabiles: form.disponibilidad === "pedido" ? form.diasHabiles : null,
categoria: "perfume",
marca: form.marca || null,
genero: form.genero || null,
temporada: form.temporada || null,
tipoPerfume: form.tipoPerfume || null,
duracion: form.duracion || null,
notas: form.notas || null,
inspiradoEn: form.inspiradoEn || null,
similitud: form.similitud ? Number(form.similitud) : null, stockBajo: form.stockBajo ? Number(form.stockBajo) : null, etiquetas: form.etiquetas || [], precioDecant5: form.precioDecant5 ? Number(form.precioDecant5) : null, precioDecant10: form.precioDecant10 ? Number(form.precioDecant10) : null
};
if (editingId) {
await updateDoc(doc(db, "productos", editingId), productData);
setEditingId(null);
} else {
await addDoc(collection(db, "productos"), { ...productData, createdAt: serverTimestamp() });
}
setForm({ nombre: "", precio: "", precioOriginal: "", descripcion: "", imageUrl: "", foto2: "", foto3: "", fotoMano: "", fotoCaja: "", videoUrl: "", disponibilidad: "stock", diasHabiles: "3", categoria: "perfume", marca: "", genero: "", temporada: "", tipoPerfume: "", duracion: "", notas: "", inspiradoEn: "", similitud: "", stockBajo: "", etiquetas: [], precioDecant5: "", precioDecant10: "" });
setUploadMsg("");
if (fileInputRef.current) fileInputRef.current.value = "";
if (foto2Ref.current) foto2Ref.current.value = "";
if (foto3Ref.current) foto3Ref.current.value = "";
if (fotoManoRef.current) fotoManoRef.current.value = "";
if (fotoCajaRef.current) fotoCajaRef.current.value = "";
if (videoRef.current) videoRef.current.value = "";
alert("Producto agregado exitosamente");
};

const handleEditProduct = (p) => {
setEditingId(p.id);
setForm({
nombre: p.nombre || "",
precio: p.precio || "",
precioOriginal: p.precioOriginal || "",
descripcion: p.descripcion || "",
imageUrl: p.imageUrl || p.foto || p.image || p.img || "",
foto2: p.foto2 || "",
foto3: p.foto3 || "",
fotoMano: p.fotoMano || "",
fotoCaja: p.fotoCaja || "",
videoUrl: p.videoUrl || "",
disponibilidad: p.disponibilidad || "stock",
diasHabiles: p.diasHabiles || "3",
categoria: p.categoria || "perfume",
marca: p.marca || "",
genero: p.genero || "",
temporada: p.temporada || "",
tipoPerfume: p.tipoPerfume || "",
duracion: p.duracion || "",
notas: p.notas || "",
inspiradoEn: p.inspiradoEn || "",
similitud: p.similitud || "", stockBajo: p.stockBajo || "", etiquetas: p.etiquetas || [], precioDecant5: p.precioDecant5 || "", precioDecant10: p.precioDecant10 || ""
});
window.scrollTo({ top: 0, behavior: "smooth" });
};

const handleCancelEdit = () => {
setEditingId(null);
setForm({ nombre: "", precio: "", precioOriginal: "", descripcion: "", imageUrl: "", foto2: "", foto3: "", fotoMano: "", fotoCaja: "", videoUrl: "", disponibilidad: "stock", diasHabiles: "3", categoria: "perfume", marca: "", genero: "", temporada: "", tipoPerfume: "", duracion: "", notas: "", inspiradoEn: "", similitud: "", stockBajo: "", etiquetas: [], precioDecant5: "", precioDecant10: "" });
setUploadMsg("");
};

const handleDeleteProduct = async (id) => {
if (!confirm("Eliminar este producto?")) return;
await deleteDoc(doc(db, "productos", id));
};

const handleAddResena = async () => {
if (!resenaForm.nombre.trim() || !resenaForm.texto.trim()) { alert("Completa al menos el nombre y el comentario del cliente."); return; }
setResenaSaving(true);
try {
await addDoc(collection(db, "resenas"), {
nombre: resenaForm.nombre.trim(),
ciudad: resenaForm.ciudad.trim(),
estrellas: Number(resenaForm.estrellas) || 5,
texto: resenaForm.texto.trim(),
foto: resenaForm.foto.trim(),
createdAt: serverTimestamp(),
});
setResenaForm({ nombre: "", ciudad: "", estrellas: "5", texto: "", foto: "" });
} catch (err) {
alert("Error al guardar la resena: " + err.message);
}
setResenaSaving(false);
};

const handleDeleteResena = async (id) => {
if (!confirm("Eliminar esta resena?")) return;
await deleteDoc(doc(db, "resenas", id));
};

const handleResenaImageUpload = async (file) => {
if (!file) return;
setResenaUploading(true);
const formData = new FormData();
formData.append("image", file);
try {
const res = await fetch("https://api.imgur.com/3/image", {
method: "POST",
headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
body: formData,
});
const data = await res.json();
if (data.success) {
setResenaForm(f => ({ ...f, foto: data.data.link }));
} else {
alert("Error al subir la foto");
}
} catch {
alert("Error de conexion al subir la foto");
}
setResenaUploading(false);
};

const addToCart = (product, opts) => {
setCart(c => {
const exists = c.find(i => i.id === product.id);
if (exists) return c.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
return [...c, { ...product, qty: 1 }];
});
if (!opts || !opts.silent) {
showToast((product.nombre || product.name || product.title || "Producto") + " agregado al carrito");
}
try {
const name = product.nombre || product.name || product.title || "Producto";
const price = Number(product.precio) || 0;
if (window.fbq) window.fbq("track", "AddToCart", { content_name: name, content_type: "product", value: price, currency: "ARS" });
if (window.gtag) window.gtag("event", "add_to_cart", { currency: "ARS", value: price, items: [{ item_name: name, price }] });
} catch (e) {}
};

const addDecantToCart = (product, size) => {
const price = size === 5 ? product.precioDecant5 : product.precioDecant10;
if (!price) return;
addToCart({
id: product.id + "_decant" + size,
nombre: (product.nombre || product.name || product.title || "Producto") + " - Decant " + size + "ml",
precio: Number(price),
imageUrl: product.imageUrl || product.foto || product.image || product.img || "",
disponibilidad: product.disponibilidad || "stock",
isDecant: true,
decantSize: size,
});
};

const removeFromCart = (id) => setCart(c => c.filter(i => i.id !== id));
const updateCartQty = (id, delta) => {
setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0));
};
const totalCart = cart.reduce((acc, i) => acc + (Number(i.precio) || 0) * i.qty, 0);
const pointsToDiscount = (pts) => Math.floor((pts || 0) / 300) * 10000;
const loadMyPoints = async (uid) => {
setPointsLoading(true);
try {
const snap = await getDoc(doc(db, "puntosClientes", uid));
setCustomerPoints(snap.exists() ? (snap.data().puntos || 0) : 0);
} catch (e) {
console.error("PUNTOS_ERROR", e);
setCustomerPoints(null);
alert("No pudimos consultar tus puntos. Intenta de nuevo en unos minutos.");
}
setPointsLoading(false);
};
const loadMyReferral = async (uid) => {
try {
const ref = doc(db, "puntosClientes", uid);
const snap = await getDoc(ref);
const data = snap.exists() ? snap.data() : {};
let code = data.codigoReferido;
if (!code) {
code = uid.slice(0, 6).toUpperCase();
await setDoc(ref, { codigoReferido: code }, { merge: true });
await setDoc(doc(db, "referralCodes", code), { uid }, { merge: true });
}
setReferralCode(code);
const q = query(collection(db, "referidosUsados"), where("referrerUid", "==", uid), where("estado", "==", "pendiente"));
const qs = await getDocs(q);
setReferralCredit(qs.size * 5000);
setReferralPendingIds(qs.docs.map((d) => d.id));
} catch (e) {
console.error("REFERRAL_LOAD_ERROR", e);
}
};
const redeemableNow = redeemPoints && customerPoints ? Math.floor(customerPoints / 300) * 300 : 0;
const discountFromPoints = pointsToDiscount(redeemableNow);
const finalTotal = Math.max(totalCart - discountFromPoints, 0);

const handleAccountAuth = async () => {
setAccountError("");
if (!accountEmail.trim() || !accountPassword) { setAccountError("Completa tu correo y contrasena"); return; }
if (accountPassword.length < 6) { setAccountError("La contrasena debe tener al menos 6 caracteres"); return; }
setAccountBusy(true);
try {
if (accountMode === "signup") {
await createUserWithEmailAndPassword(auth, accountEmail.trim(), accountPassword);
} else {
await signInWithEmailAndPassword(auth, accountEmail.trim(), accountPassword);
}
setShowAccountModal(false);
setAccountEmail("");
setAccountPassword("");
} catch (e) {
const map = { "auth/email-already-in-use": "Ese correo ya tiene una cuenta. Proba iniciar sesion.", "auth/invalid-email": "El correo no es valido.", "auth/weak-password": "La contrasena es muy debil.", "auth/invalid-credential": "Correo o contrasena incorrectos.", "auth/wrong-password": "Correo o contrasena incorrectos.", "auth/user-not-found": "No existe una cuenta con ese correo." };
setAccountError(map[e.code] || "No pudimos procesar tu solicitud. Intenta de nuevo.");
}
setAccountBusy(false);
};
const handleLogout = async () => {
await signOut(auth);
setCustomerPoints(null);
setRedeemPoints(false);
};
const handleQuickBuy = (product) => {
const newCart = (() => {
const exists = cart.find(i => i.id === product.id);
if (exists) return cart.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
return [...cart, { ...product, qty: 1 }];
})();
setCart(newCart);
setSelectedProduct(null);
handleCheckout(newCart);
};

const handleCheckout = async (cartOverride) => {
const waWindow = window.open("", "_blank");
const cartUsed = cartOverride || cart;
const totalCartUsed = cartUsed.reduce((acc, i) => acc + (Number(i.precio) || 0) * i.qty, 0);
try {
if (window.fbq) window.fbq("track", "InitiateCheckout", { value: totalCartUsed, currency: "ARS", num_items: cartUsed.reduce((a, i) => a + i.qty, 0), content_type: "product", contents: cartUsed.map(i => ({ id: i.id, quantity: i.qty })) });
if (window.gtag) window.gtag("event", "begin_checkout", { currency: "ARS", value: totalCartUsed, items: cartUsed.map(i => ({ item_id: i.id, item_name: getProductName(i), quantity: i.qty, price: Number(i.precio) || 0 })) });
} catch (e) {}
let msg = "Hola! Quiero pedir: " + cartUsed.map(i => getProductName(i) + " x" + i.qty).join(", ");
if (promoCode) msg += " - Codigo promocional: " + promoCode;
if (customerPhone) msg += " - Mi telefono: " + customerPhone;
let usedDiscount = 0;
const referralCodeEntered = referralInput.trim().toUpperCase();
let referralUsedThisOrder = false;
let referrerUidFound = null;
if (referralCodeEntered && referralCodeEntered !== referralCode) {
try {
const refSnap = await getDoc(doc(db, "referralCodes", referralCodeEntered));
if (refSnap.exists()) {
referralUsedThisOrder = true;
referrerUidFound = refSnap.data().uid;
usedDiscount += 5000;
msg += " - Codigo de referido: " + referralCodeEntered + " ($5.000 de descuento por programa de referidos)";
}
} catch (e) { console.error("REFERRAL_CHECK_ERROR", e); }
}
let usedReferralCredit = 0;
if (!referralUsedThisOrder && redeemReferralCredit && referralCredit > 0) {
usedReferralCredit = Math.min(5000, referralCredit);
usedDiscount += usedReferralCredit;
msg += " - Usa credito de referidos ($" + usedReferralCredit.toLocaleString("es-CL") + " de descuento)";
}
if (user) {
try {
const ref = doc(db, "puntosClientes", user.uid);
const snap = await getDoc(ref);
const current = snap.exists() ? (snap.data().puntos || 0) : 0;
let updated = current;
if (redeemPoints) {
const usedRedeem = Math.min(Math.floor(current / 300) * 300, redeemableNow);
if (usedRedeem > 0) {
updated -= usedRedeem;
usedDiscount += pointsToDiscount(usedRedeem);
msg += " - Canjea " + usedRedeem + " puntos ($" + pointsToDiscount(usedRedeem).toLocaleString("es-CL") + " de descuento)";
}
}
const totalConDescuento = Math.max(totalCartUsed - usedDiscount, 0);
const earned = Math.floor(totalConDescuento / 1000);
updated += earned;
await setDoc(ref, { email: user.email, puntos: updated }, { merge: true });
msg += " - Suma " + earned + " puntos nuevos (total: " + updated + " puntos)";
setCustomerPoints(updated);
} catch (e) {
console.error("PUNTOS_CHECKOUT_ERROR", e);
alert("No pudimos actualizar tus puntos de fidelizacion por un problema de conexion, pero tu pedido se va a enviar igual. Si el problema persiste contactanos por WhatsApp.");
}
}
if (referralUsedThisOrder && referrerUidFound) {
try {
await addDoc(collection(db, "referidosUsados"), { codigo: referralCodeEntered, referrerUid: referrerUidFound, usadoPorUid: user ? user.uid : null, fecha: serverTimestamp(), estado: "pendiente" });
} catch (e) { console.error("REFERRAL_REGISTER_ERROR", e); }
}
if (usedReferralCredit > 0 && referralPendingIds.length > 0) {
try {
const idToRedeem = referralPendingIds[0];
await updateDoc(doc(db, "referidosUsados", idToRedeem), { estado: "canjeado" });
setReferralCredit(Math.max(referralCredit - 5000, 0));
setReferralPendingIds(referralPendingIds.slice(1));
} catch (e) { console.error("REFERRAL_REDEEM_ERROR", e); }
}
const totalAEnviar = Math.max(totalCartUsed - usedDiscount, 0);
msg += " - Total: " + formatPrice(totalAEnviar);
const waUrl = "https://wa.me/2914261941?text=" + encodeURIComponent(msg);
if (waWindow) { waWindow.location.href = waUrl; } else { window.location.href = waUrl; }
};

const formatPrice = (p) => {
if (p === "" || p === null || p === undefined) return "Consultar";
const n = Number(p);
if (isNaN(n)) return "Consultar";
return "$" + n.toLocaleString("es-CL");
};

const getProductName = (p) => p.nombre || p.name || p.title || "Producto";
const getProductPrice = (p) => p.precio || p.price || 0;
const getProductOriginalPrice = (p) => p.precioOriginal || null;
const getDiscountPercent = (p) => {
const orig = getProductOriginalPrice(p);
const price = getProductPrice(p);
if (!orig || orig <= price) return null;
return Math.round((1 - price / orig) * 100);
};
const getProductImage = (p) => p.imageUrl || p.foto || p.image || p.img || "";
const optimizeImg = (url) => {
  if (!url) return url;
  const m = url.match(/^(https?:\/\/i\.imgur\.com\/[a-zA-Z0-9]+)(\.(?:jpe?g|png|gif))$/i);
  return m ? `${m[1]}l${m[2]}` : url;
};
const getProductDisp = (p) => p.disponibilidad || "stock";
const getProductDias = (p) => p.diasHabiles || "3-5";
const getDecantPrice5 = (p) => (p.precioDecant5 !== undefined && p.precioDecant5 !== null && p.precioDecant5 !== "" ? Number(p.precioDecant5) : null);
const getDecantPrice10 = (p) => (p.precioDecant10 !== undefined && p.precioDecant10 !== null && p.precioDecant10 !== "" ? Number(p.precioDecant10) : null);
const hasDecant = (p) => !!(getDecantPrice5(p) || getDecantPrice10(p));
const getUrgencyMsg = (p) => {
const sb = (p.stockBajo !== undefined && p.stockBajo !== null && p.stockBajo !== "") ? Number(p.stockBajo) : null;
if (sb !== null && !isNaN(sb) && sb > 0 && sb <= 5) return `Quedan ${sb} unidades`;
if ((p.etiquetas || []).includes("mas_vendidos")) return "Mas vendido";
if (getProductDisp(p) === "pedido") return "Alta demanda";
return null;
};
const getProductCategoria = (p) => p.categoria || "otro";
const isPerfume = (p) => {
if (getProductCategoria(p) === "perfume") return true;
const name = getProductName(p).toLowerCase();
return name.includes("perfum") || name.includes("edp") || name.includes("elixir") || name.includes("victoria secret") || name.includes("lattafa") || name.includes("bharara") || name.includes("phantom") || name.includes("givenchy") || name.includes("paco rabane") || name.includes("yara") || name.includes("club de nuit");
};
const DURACION_CATEGORIAS = ["Corta (hasta 6 horas)", "Media (6 a 8 horas)", "Larga (8 a 12 horas)", "Muy larga (12 horas o mas)"];
const parseDuracionHoras = (str) => {
if (!str) return null;
const nums = (String(str).match(/\d+/g) || []).map(Number);
if (nums.length === 0) return null;
if (nums.length === 1) return nums[0];
return (nums[0] + nums[1]) / 2;
};
const getDuracionCategoria = (p) => {
const h = parseDuracionHoras(p.duracion);
if (h === null) return null;
if (h < 6) return DURACION_CATEGORIAS[0];
if (h < 8) return DURACION_CATEGORIAS[1];
if (h < 12) return DURACION_CATEGORIAS[2];
return DURACION_CATEGORIAS[3];
};
const generoLabel = (g) => ({ masculino: "Masculino", femenino: "Femenino", unisex: "Unisex" }[g] || g);
const temporadaLabel = (t) => ({ invierno: "Invierno", verano: "Verano", todo_anio: "Todo el ano" }[t] || t);
const tipoLabel = (t) => ({ arabe: "Arabe", disenador: "Disenador" }[t] || t);
const specIconProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "#d4af37", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
const SpecIcon = ({ name }) => {
if (name === "marca") return (<svg {...specIconProps}><path d="M12 2l2.9 6.3L21 9.3l-4.5 4.4 1 6.3L12 17l-5.5 3 1-6.3L3 9.3l6.1-1z"></path></svg>);
if (name === "genero") return (<svg {...specIconProps}><circle cx="12" cy="8" r="5"></circle><path d="M12 13v8M9 18h6"></path></svg>);
if (name === "tipo") return (<svg {...specIconProps}><path d="M20.6 12.6L12 21.2 2.8 12l8.6-8.6H20.6z"></path><circle cx="16" cy="8" r="1.4" fill="#d4af37" stroke="none"></circle></svg>);
if (name === "temporada") return (<svg {...specIconProps}><circle cx="12" cy="12" r="4.5"></circle><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"></path></svg>);
if (name === "duracion") return (<svg {...specIconProps}><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l3 2M9 2h6"></path></svg>);
if (name === "notas") return (<svg {...specIconProps}><path d="M12 21c-4.5-3-8-6.5-8-11a8 8 0 0116 0c0 4.5-3.5 8-8 11z"></path><path d="M12 12c2-2 2-5 0-7-2 2-2 5 0 7z" fill="#d4af37" stroke="none"></path></svg>);
return null;
};
const SkeletonCard = () => (
<div style={{ background: "#1a1a1a", borderRadius: "14px", overflow: "hidden", border: "1px solid #2b2b2b" }}>
<div className="skel" style={{ width: "100%", aspectRatio: "4/5" }}></div>
<div style={{ padding: "16px" }}>
<div className="skel" style={{ height: "14px", borderRadius: "4px", marginBottom: "8px", width: "90%" }}></div>
<div className="skel" style={{ height: "14px", borderRadius: "4px", marginBottom: "14px", width: "60%" }}></div>
<div className="skel" style={{ height: "18px", borderRadius: "4px", marginBottom: "14px", width: "45%" }}></div>
<div className="skel" style={{ height: "38px", borderRadius: "6px", width: "100%" }}></div>
</div>
</div>
);

const assistantFaqs = [
{ q: "Como comprar", a: "Elegi el producto que te guste, toca 'Agregar al Carrito' y despues 'Pedir por WhatsApp' para confirmar el pedido. Asi de facil!" },
{ q: "Envios", a: "Hacemos envio gratis dentro de Bahia Blanca. Tambien enviamos a todo el pais, coordinando el costo por WhatsApp." },
{ q: "Formas de pago", a: "Coordinamos la forma de pago (efectivo, transferencia, etc.) directamente por WhatsApp para confirmarte todas las opciones disponibles." },
{ q: "Stock y por pedido", a: "Los productos 'En Stock' se entregan de inmediato. Los que dicen 'Por Pedido' muestran en su tarjeta cuantos dias habiles tardan en llegar." },
{ q: "No encuentro lo que busco", a: "No hay problema! Si no encontras la fragancia que buscas, escribinos por WhatsApp contandonos que necesitas y te ayudamos a conseguirla o pedirla especialmente para vos." },
{ q: "Programa de Referidos", a: "Invita a un amigo: compartile tu codigo desde Mi Cuenta y cuando lo use en su pedido, ambos reciben $5.000 de descuento." },
];
const askAssistant = (faq) => {
setAssistantChat(prev => [...prev, { from: "user", text: faq.q }, { from: "bot", text: faq.a }]);
};
const normalizeTxt = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const SEARCH_SYNONYMS = { dulce: ["dulce","vainilla","gourmand","caramelo","azucar","goloso"], dulces: ["dulce","vainilla","gourmand","caramelo","azucar"], fresco: ["fresco","citrico","acuatico","marino","liviano"], frescos: ["fresco","citrico","acuatico","marino"], frescura: ["fresco","citrico"], citrico: ["citrico","fresco"], citricos: ["citrico","fresco"], amaderado: ["amaderado","madera"], amaderados: ["amaderado","madera"], madera: ["amaderado","madera"], maderoso: ["amaderado","madera"], floral: ["floral","flores"], florales: ["floral","flores"], flores: ["floral"], frutal: ["frutal","fruta"], frutales: ["frutal","fruta"], afrutado: ["frutal","fruta"], oriental: ["oriental","especiado","ambar"], orientales: ["oriental","especiado","ambar"], especiado: ["especiado","oriental"], intenso: ["intenso","fuerte"], fuerte: ["intenso","fuerte"], suave: ["suave","delicado"], delicado: ["suave","delicado"], elegante: ["elegante","sofisticado"], sofisticado: ["elegante","sofisticado"], verano: ["verano"], veraniego: ["verano"], invierno: ["invierno"], invernal: ["invierno"], oficina: ["oficina","trabajo"], trabajo: ["oficina"], diario: ["todo el ano","versatil"], noche: ["noche","citas"], cita: ["citas"], citas: ["citas"], romantico: ["citas"], romantica: ["citas"], regalo: ["regalar"], regalar: ["regalar"], economico: ["economico"], barato: ["economico"], baratos: ["economico"], hombre: ["masculino"], hombres: ["masculino"], masculino: ["masculino"], mujer: ["femenino"], mujeres: ["femenino"], femenino: ["femenino"], unisex: ["unisex"], nicho: ["arabe","nicho"], arabe: ["arabe"], arabes: ["arabe"], disenador: ["disenador"] };
const SEARCH_STOPWORDS = new Set(["quiero","quisiera","busco","buscando","necesito","algo","un","una","unos","unas","el","la","los","las","de","del","para","por","que","sea","seas","con","como","me","gustaria","tipo","estilo","perfume","perfumes","fragancia","fragancias","huele","huela","parecido","parecidos","parecida","parecidas","similar","similares","a","al","o","y","es","esta","este","mas","onda"]);

const buildProductHaystack = (p) => {
const generoTxt = { masculino: "masculino hombre", femenino: "femenino mujer", unisex: "unisex" }[p.genero] || "";
const tempTxt = { invierno: "invierno frio calido amaderado especiado", verano: "verano fresco citrico liviano", todo_anio: "todo el ano versatil diario" }[p.temporada] || "";
const tipoTxt = { arabe: "arabe arabes nicho", disenador: "disenador designer" }[p.tipoPerfume] || "";
const etiquetasTxt = (p.etiquetas || []).map((e) => e.replace(/_/g, " ")).join(" ");
return normalizeTxt([getProductName(p), p.marca, p.descripcion, p.notas, p.inspiradoEn, generoTxt, tempTxt, tipoTxt, etiquetasTxt, p.duracion].filter(Boolean).join(" "));
};
const expandQueryTerms = (q) => {
const words = normalizeTxt(q).split(/[^a-z0-9]+/).filter(Boolean);
const terms = new Set();
words.forEach((w) => {
if (SEARCH_STOPWORDS.has(w)) return;
terms.add(w);
if (SEARCH_SYNONYMS[w]) SEARCH_SYNONYMS[w].forEach((t2) => terms.add(t2));
});
return Array.from(terms);
};
const smartProductScore = (p, rawQuery) => {
const qNorm = normalizeTxt(rawQuery);
const nameNorm = normalizeTxt(getProductName(p));
const inspiradoNorm = normalizeTxt(p.inspiradoEn);
let score = 0;
if (qNorm && nameNorm.includes(qNorm)) score += 10;
if (qNorm && normalizeTxt(p.descripcion).includes(qNorm)) score += 4;
if (qNorm && inspiradoNorm && inspiradoNorm.includes(qNorm)) score += 8;
const terms = expandQueryTerms(rawQuery);
if (terms.length === 0) return score;
const haystack = buildProductHaystack(p);
terms.forEach((term) => {
if (!term) return;
if (nameNorm.includes(term)) score += 3;
if (inspiradoNorm && inspiradoNorm.includes(term)) score += 5;
if (haystack.includes(term)) score += 1;
});
return score;
};

const seenProductKeys = new Set();
const dedupedProducts = products.filter(p => {
if (!isPerfume(p)) return false;
const key = normalizeTxt(getProductName(p)) + "|" + getProductPrice(p);
if (seenProductKeys.has(key)) return false;
seenProductKeys.add(key);
return true;
});

const recentlyViewedProducts = recentlyViewed.map(id => dedupedProducts.find(p => p.id === id)).filter(Boolean).slice(0, 8);

let filteredProducts = dedupedProducts.filter(p => {

const q = searchQuery.trim();
if (q) {
if (smartProductScore(p, q) <= 0) return false;
}
if (filter === "stock") return getProductDisp(p) === "stock";
if (filter === "pedido") return getProductDisp(p) === "pedido";
if (filter === "perfumes") return isPerfume(p);
if (filter === "decants") return hasDecant(p); if (filter === "menos100k") return getProductPrice(p) < 100000; if (filter === "arabes") return (p.tipoPerfume || "") === "arabe"; if (filter === "disenador") return (p.tipoPerfume || "") === "disenador"; if (filter === "favoritos") return favorites.includes(p.id); if (["mas_vendidos","novedades","larga_duracion","para_regalar","top_invierno","top_verano","top_oficina","top_citas"].includes(filter)) return (p.etiquetas || []).includes(filter);
if (filterMarca && (p.marca || "") !== filterMarca) return false;
if (filterDuracion && getDuracionCategoria(p) !== filterDuracion) return false;
if (filterNotas.trim() && !(p.notas || "").toLowerCase().includes(filterNotas.trim().toLowerCase())) return false;
if (filterTemporada && (p.temporada || "") !== filterTemporada) return false;
if (filterGenero && (p.genero || "") !== filterGenero) return false;
if (filterTipo && (p.tipoPerfume || "") !== filterTipo) return false;
if (filterPrecioMin && getProductPrice(p) < Number(filterPrecioMin)) return false;
if (filterPrecioMax && getProductPrice(p) > Number(filterPrecioMax)) return false;
return true;
});

if (searchQuery.trim()) {
filteredProducts = [...filteredProducts].sort((a, b) => smartProductScore(b, searchQuery) - smartProductScore(a, searchQuery));
} else if (sortBy === "precio_asc") {
filteredProducts = [...filteredProducts].sort((a, b) => getProductPrice(a) - getProductPrice(b));
} else if (sortBy === "precio_desc") {
filteredProducts = [...filteredProducts].sort((a, b) => getProductPrice(b) - getProductPrice(a));
} else if (sortBy === "vendidos") {
filteredProducts = [...filteredProducts].sort((a, b) => ((b.etiquetas || []).includes("mas_vendidos") ? 1 : 0) - ((a.etiquetas || []).includes("mas_vendidos") ? 1 : 0));
}

const S = {
body: { margin: 0, fontFamily: "'Inter', 'Segoe UI', sans-serif", background: "#0f0f0f", color: "#ffffff", minHeight: "100vh" },
nav: { position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", background: "#0f0f0f", borderBottom: "1px solid #2b2b2b", color: "#ffffff" },
logo: { fontSize: "clamp(28px,5vw,52px)", fontWeight: "700", fontFamily: "'Playfair Display', serif", color: "#d4af37", cursor: "pointer" },
btn: { background: "linear-gradient(135deg, #d4af37, #a8842c)", color: "#000000", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "700" },
btnOutline: { background: "transparent", color: "#d4af37", border: "1px solid #d4af37", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" },
btnGray: { background: "#2b2b2b", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer" },
navCartBtn: { position: "fixed", top: "16px", right: "24px", background: "linear-gradient(135deg, #d4af37, #a8842c)", color: "#000000", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", zIndex: 55, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" },
navAccountBtn: { position: "fixed", top: "16px", right: "150px", background: "transparent", color: "#d4af37", border: "1px solid #d4af37", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", zIndex: 55 },
navInstagramBtn: { position: "fixed", top: "16px", right: "270px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "1px solid #d4af37", borderRadius: "50%", cursor: "pointer", zIndex: 55 },
  navPromo: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontFamily: "'Playfair Display', serif", fontWeight: "700", fontSize: "13px", letterSpacing: "1px", textAlign: "center", maxWidth: "55%" },
hero: { textAlign: "center", padding: "130px 20px 100px", backgroundImage: "linear-gradient(rgba(10,10,10,0.6), rgba(10,10,10,0.72)), url('https://images.unsplash.com/photo-1622618991746-fe6004db3a47?q=80&w=1920&auto=format&fit=crop')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" },
heroWrap: { position: "relative", minHeight: "92vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "150px 20px 110px", boxSizing: "border-box" },
heroOverlay: { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,10,10,0.45) 0%, rgba(10,10,10,0.65) 55%, rgba(8,8,8,0.9) 100%)", zIndex: 1 },
heroContent: { position: "relative", zIndex: 2, textAlign: "center", maxWidth: "920px", margin: "0 auto", padding: "0 12px" },
heroDivider: { width: "64px", height: "3px", background: "#d4af37", margin: "0 auto 20px", borderRadius: "2px" },
heroScrollCue: { position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 2, color: "#d4af37", fontSize: 24, opacity: 0.85 },
heroTag: { fontSize: "clamp(13px,1.6vw,16px)", color: "#d4af37", letterSpacing: "5px", textTransform: "uppercase", marginBottom: "18px", fontWeight: "700" },
heroMainTitle: { fontFamily: "'Playfair Display', serif", fontSize: "clamp(38px,7vw,76px)", fontWeight: 800, color: "#fff", textTransform: "uppercase", margin: "6px 0 20px", lineHeight: 1.12, letterSpacing: "1px", textShadow: "0 4px 24px rgba(0,0,0,0.55)" }, heroBtnRow: { display: "flex", gap: 18, flexWrap: "wrap", marginTop: 32, justifyContent: "center" }, heroBtnPrimary: { background: "linear-gradient(135deg, #d4af37, #b8912c)", color: "#1a1a1a", border: "none", padding: "18px 42px", fontSize: "clamp(15px,1.6vw,18px)", fontWeight: 800, borderRadius: 10, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1.2, boxShadow: "0 8px 24px rgba(212,175,55,0.35)" }, heroBtnSecondary: { background: "rgba(255,255,255,0.06)", color: "#fff", border: "2px solid rgba(255,255,255,0.85)", padding: "18px 40px", fontSize: "clamp(14px,1.5vw,16px)", fontWeight: 700, borderRadius: 10, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }, heroTitle: { fontSize: "clamp(28px,5vw,52px)", fontWeight: "700", margin: "0 16px 14px", fontFamily: "'Playfair Display', serif", color: "#d4af37" },
heroSub: { fontSize: "clamp(15px,2.2vw,19px)", color: "rgba(255,255,255,0.92)", textTransform: "uppercase", letterSpacing: "1.5px", margin: "0 0 10px", maxWidth: "680px", marginLeft: "auto", marginRight: "auto", lineHeight: "1.7", fontWeight: 500, textShadow: "0 2px 12px rgba(0,0,0,0.6)" },
heroTrustRow: { display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", margin: "18px 0 4px" },
heroTrustBadge: { display: "flex", alignItems: "center", gap: "7px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(212,175,55,0.5)", borderRadius: "24px", padding: "8px 16px", fontSize: "13px", color: "#fff", fontWeight: 600, letterSpacing: "0.3px", backdropFilter: "blur(2px)" },
section: { padding: "70px 20px", maxWidth: "1200px", margin: "0 auto", background: "#f5efe0", borderRadius: "20px" },
sectionTitle: { fontSize: "24px", fontWeight: "700", marginBottom: "24px", borderBottom: "2px solid #d4af37", paddingBottom: "8px", fontFamily: "'Playfair Display', serif", color: "#1a1a1a" },
filterBar: { display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", justifyContent: "center" },
advFilterWrap: { maxWidth: "900px", margin: "0 auto 28px", textAlign: "center" },
advFilterToggle: { background: "transparent", border: "1px solid #d4af37", color: "#d4af37", padding: "10px 18px", borderRadius: "24px", cursor: "pointer", fontSize: "14px", fontWeight: "600" },
advFilterBox: { marginTop: "16px", background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "12px", padding: "20px", textAlign: "left" },
advFilterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" },
advFilterLabel: { display: "block", color: "#d4af37", fontSize: "12px", marginBottom: "4px" },
compareBox: { background: "#0f0f0f", border: "1px solid #d4af37", borderRadius: "12px", padding: "16px", textAlign: "center", marginTop: "14px", color: "#ffffff" },
searchWrap: { position: "relative", maxWidth: "420px", margin: "0 auto 20px" },
searchIconSvg: { position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", opacity: 0.6, pointerEvents: "none" },
searchInput: { width: "100%", padding: "12px 16px 12px 42px", background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "24px", color: "#ffffff", fontSize: "14px", boxSizing: "border-box", outline: "none" },
assistantBtn: { position: "fixed", right: "24px", bottom: "24px", width: "60px", height: "60px", borderRadius: "50%", background: "#d4af37", color: "#0f0f0f", border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" },
assistantPanel: { position: "fixed", right: "24px", bottom: "96px", width: "320px", maxWidth: "88vw", maxHeight: "70vh", background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "14px", boxShadow: "0 8px 30px rgba(0,0,0,0.5)", zIndex: 60, display: "flex", flexDirection: "column", overflow: "hidden" },
assistantHeader: { background: "#0f0f0f", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2b2b2b" },
assistantBody: { padding: "14px 16px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "10px" },
assistantBubbleBot: { background: "#2b2b2b", color: "#ffffff", padding: "10px 12px", borderRadius: "12px", fontSize: "13px", lineHeight: "1.5", alignSelf: "flex-start", maxWidth: "85%" },
assistantBubbleUser: { background: "#d4af37", color: "#0f0f0f", padding: "10px 12px", borderRadius: "12px", fontSize: "13px", lineHeight: "1.5", alignSelf: "flex-end", maxWidth: "85%", fontWeight: "600" },
assistantOptions: { padding: "12px 16px", borderTop: "1px solid #2b2b2b", display: "flex", flexDirection: "column", gap: "8px" },
assistantOptionBtn: { background: "#0f0f0f", color: "#ffffff", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "9px 12px", fontSize: "13px", textAlign: "left", cursor: "pointer" },
tickerSection: { padding: "40px 0", background: "#f5efe0", borderTop: "1px solid #2b2b2b", borderBottom: "1px solid #2b2b2b", overflow: "hidden" },
tickerTrack: { display: "flex", gap: "30px", width: "max-content", animation: "gangaTicker 90s linear infinite" },
tickerItem: { background: "#1a1a1a", borderRadius: "12px", overflow: "hidden", border: "1px solid #2b2b2b", width: "220px", flexShrink: 0, cursor: "pointer" },
filterBtnPrimary: (a) => ({ background: a ? "linear-gradient(135deg, #d4af37, #a8842c)" : "#2b2210", color: a ? "#000000" : "#d4af37", border: a ? "none" : "2px solid #d4af37", padding: "12px 26px", borderRadius: "24px", cursor: "pointer", fontWeight: "800", fontSize: "16px" }),
filterBtn: (a) => ({ background: a ? "linear-gradient(135deg, #d4af37, #a8842c)" : "#1a1a1a", color: a ? "#000000" : "#9a9a9a", border: a ? "none" : "1px solid #2b2b2b", padding: "6px 14px", borderRadius: "16px", cursor: "pointer", fontWeight: "500", fontSize: "12px" }),
grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "26px" },
card: { background: "#1a1a1a", borderRadius: "14px", overflow: "hidden", border: "1px solid #2b2b2b", cursor: "pointer", display: "flex", flexDirection: "column" },
cardImg: { width: "100%", aspectRatio: "4/5", objectFit: "contain", background: "#fff", display: "block", padding: "14px", boxSizing: "border-box" },
cardBody: { padding: "16px", display: "flex", flexDirection: "column", flex: 1 },
cardName: { fontSize: "14.5px", fontWeight: "700", marginBottom: "8px", color: "#ffffff", lineHeight: "1.35", minHeight: "38px" },
cardPrice: { fontSize: "17px", fontWeight: "900", color: "#d4af37", marginBottom: "10px", display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" },
originalPrice: { fontSize: "12.5px", color: "#7a7a7a", textDecoration: "line-through", fontWeight: "500" },
discountBadge: { display: "inline-block", background: "rgba(139,26,42,0.9)", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.3px" },
badgeRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "10px" },
badgeStock: { display: "inline-flex", alignItems: "center", gap: "5px", color: "#9ddb9d", fontSize: "12px", fontWeight: "600" },
badgeStockDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#4caf50", flexShrink: 0 },
urgencyBadge: { display: "inline-block", background: "rgba(212,175,55,0.14)", color: "#e0b84a", border: "1px solid rgba(212,175,55,0.4)", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" },
resenaCard: { background: "#ffffff", borderRadius: "12px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", border: "1px solid #e8ddc0" },
resenaFoto: { width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: "2px solid #d4af37" },
resenaAvatar: { width: "48px", height: "48px", borderRadius: "50%", background: "#d4af37", color: "#000000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "18px" },
badgePedido: { display: "inline-flex", alignItems: "center", gap: "5px", color: "#bdbdbd", fontSize: "12px", fontWeight: "600" },
loadMoreBtn: { display: "block", margin: "36px auto 0", background: "transparent", color: "#d4af37", border: "2px solid #d4af37", padding: "13px 36px", borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "14px", letterSpacing: "0.3px" },
modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 100 },
modalBox: { background: "#1a1a1a", borderRadius: "16px", maxWidth: "500px", width: "100%", padding: "24px", position: "relative", maxHeight: "90vh", overflowY: "auto", border: "1px solid #2b2b2b" },
modalImg: { width: "100%", maxHeight: "360px", objectFit: "contain", background: "#fff", borderRadius: "10px", marginBottom: "16px", display: "block" },
specsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", margin: "18px 0", padding: "18px", background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "12px" },
specItem: { display: "flex", alignItems: "flex-start", gap: "10px" },
specIcon: { display: "flex", alignItems: "center", justifyContent: "center", width: "18px", height: "18px", marginTop: "2px", flexShrink: 0 },
specLabel: { fontSize: "11px", color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" },
specValue: { fontSize: "14px", color: "#ffffff", fontWeight: "700" },
input: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid #2b2b2b", color: "#ffffff", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" },
select: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid #2b2b2b", color: "#ffffff", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" },
label: { display: "block", marginBottom: "6px", color: "#bdbdbd", fontSize: "14px" },
cartOverlay: { position: "fixed", right: 0, top: 0, bottom: 0, width: "min(320px, 100vw)", background: "#0f0f0f", borderLeft: "2px solid #d4af37", padding: "70px 20px 20px 20px", overflowY: "auto", zIndex: 101, boxSizing: "border-box" },
cartBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100 },
adminWrap: { maxWidth: "640px", margin: "40px auto", padding: "20px" },
adminCard: { background: "#1a1a1a", borderRadius: "12px", padding: "28px", border: "1px solid #2b2b2b" },
loginWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0f0f0f" },
loginBox: { background: "#1a1a1a", borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "400px", border: "1px solid #2b2b2b", textAlign: "center" }, loyaltySection: { padding: "50px 20px", maxWidth: "1200px", margin: "0 auto" }, loyaltyCard: { background: "linear-gradient(135deg, #1a1a1a, #2b2b2b)", border: "1px solid #d4af37", borderRadius: "16px", padding: "36px 24px", textAlign: "center" }, loyaltyTitle: { fontFamily: "'Playfair Display', serif", color: "#d4af37", fontSize: "clamp(22px,4vw,32px)", fontWeight: "700", marginBottom: "10px" }, loyaltyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "18px", marginTop: "24px" }, loyaltyStep: { background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "12px", padding: "18px" }, cartPointsBox: { background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "12px", marginBottom: "12px" },
footer: { background: "#0a0a0a", borderTop: "1px solid #2b2b2b", padding: "56px 20px 28px", marginTop: "10px" },
footerInner: { maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "36px" },
footerBrand: { fontFamily: "'Playfair Display', serif", color: "#d4af37", fontSize: "24px", fontWeight: "700", marginBottom: "10px" },
footerText: { color: "#9a9a9a", fontSize: "13px", lineHeight: "1.7", margin: 0 },
footerHeading: { color: "#ffffff", fontSize: "14px", fontWeight: "700", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.5px" },
footerLink: { display: "block", color: "#9a9a9a", fontSize: "13px", lineHeight: "2.1", textDecoration: "none" },
footerTrustRow: { display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "4px" },
footerTrustBadge: { display: "flex", alignItems: "center", gap: "6px", background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "20px", padding: "6px 12px", fontSize: "12px", color: "#bdbdbd" },
footerBottom: { maxWidth: "1200px", margin: "40px auto 0", paddingTop: "20px", borderTop: "1px solid #2b2b2b", display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "space-between", color: "#6b6b6b", fontSize: "12px" },
toast: { position: "fixed", left: "50%", bottom: "100px", transform: "translateX(-50%)", background: "#1a1a1a", color: "#fff", border: "1px solid #d4af37", padding: "12px 22px", borderRadius: "30px", fontSize: "14px", fontWeight: 600, zIndex: 200, boxShadow: "0 6px 20px rgba(0,0,0,0.4)", maxWidth: "88vw", textAlign: "center", animation: "toastPop 0.25s ease" },
favBtn: (active) => ({ position: "absolute", top: "10px", right: "10px", width: "34px", height: "34px", borderRadius: "50%", border: "none", background: active ? "rgba(212,175,55,0.95)" : "rgba(0,0,0,0.55)", color: active ? "#000" : "#fff", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5, lineHeight: 1 }),
mobileCartBar: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, background: "linear-gradient(135deg, #d4af37, #a8842c)", color: "#000", display: "none", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", boxShadow: "0 -4px 16px rgba(0,0,0,0.35)", fontWeight: 700, boxSizing: "border-box" },
mobileCartBarText: { fontSize: "13px" },
mobileCartBarBtn: { background: "#000", color: "#d4af37", padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: 800 },
qtyStepperRow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" },
qtyBtn: { width: "26px", height: "26px", borderRadius: "6px", border: "1px solid #2b2b2b", background: "#1a1a1a", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
qtyValue: { minWidth: "18px", textAlign: "center", fontWeight: 700, fontSize: "14px" },
quickBuyBtn: { display: "block", width: "100%", padding: "13px", marginTop: "10px", fontSize: "15px", fontWeight: 800, borderRadius: "10px", border: "2px solid #d4af37", background: "transparent", color: "#d4af37", cursor: "pointer" },
recentlyViewedRow: { display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "8px" },
recentlyViewedCard: { flexShrink: 0, width: "140px", cursor: "pointer" },
recentlyViewedImg: { width: "140px", height: "140px", objectFit: "contain", background: "#fff", borderRadius: "10px", border: "1px solid #e8ddc0" },
recentlyViewedName: { fontSize: "12px", color: "#1a1a1a", marginTop: "6px", lineHeight: "1.3", minHeight: "32px" },
recentlyViewedPrice: { fontSize: "13px", fontWeight: 800, color: "#8a6d1f" },
};

if (page === "adminLogin") {
return (
<div style={S.loginWrap}>
<div style={S.loginBox}>
<div style={{ fontSize: "42px", marginBottom: "16px" }}>&#128274;</div>
<h2 style={{ color: "#d4af37", marginBottom: "8px", fontFamily: "'Playfair Display', serif" }}>Panel Administrador</h2>
<p style={{ color: "#bdbdbd", marginBottom: "8px" }}>Ingresa con la contrasena de la cuenta {ADMIN_EMAIL}</p>
<input type="password" placeholder="Contrasena" value={adminPass} onChange={e => setAdminPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} style={{ ...S.input, marginBottom: "16px", textAlign: "center" }} />
{adminError && <p style={{ color: "#ff4444", marginBottom: "12px" }}>{adminError}</p>}
<button onClick={handleAdminLogin} disabled={adminLoginBusy} style={{ ...S.btn, width: "100%", padding: "12px", opacity: adminLoginBusy ? 0.6 : 1 }}>{adminLoginBusy ? "Ingresando..." : "Ingresar"}</button>
<button onClick={() => { setPage("home"); window.history.pushState({}, "", "/"); }} style={{ ...S.btnOutline, width: "100%", padding: "12px", marginTop: "10px" }}>Volver a la tienda</button>
</div>
</div>
);
}

if (page === "admin" && isAdmin) {
return (
<div style={S.body}>
<div style={S.nav}>
<div style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
<button onClick={() => { setPage("home"); window.history.pushState({}, "", "/"); }} style={S.btnOutline}>Ver Tienda</button>
<button onClick={async () => { await signOut(auth); setIsAdmin(false); setPage("adminLogin"); }} style={S.btnGray}>Cerrar Sesion</button>
</div>
</div>
<div style={S.adminWrap}>
<h2 style={{ color: "#d4af37", marginBottom: "24px", fontFamily: "'Playfair Display', serif" }}>Panel de Administracion</h2>
<div style={S.adminCard}>
<h3 style={{ marginTop: 0, marginBottom: "20px" }}>{editingId ? "Editar Producto" : "Agregar Nuevo Producto"}</h3>
<label style={S.label}>Nombre del Producto *</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Perfume Lattafa Khamrah" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
<label style={S.label}>Precio (CLP) *</label>
<input style={{ ...S.input, marginBottom: "16px" }} type="number" placeholder="Ej: 45000" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
<label style={S.label}>Precio Original (opcional, para mostrar tachado con descuento)</label>
<input style={{ ...S.input, marginBottom: "16px" }} type="number" placeholder="Ej: 60000" value={form.precioOriginal} onChange={e => setForm(f => ({ ...f, precioOriginal: e.target.value }))} />
<label style={S.label}>Decant 5ml (CLP, opcional)</label>
<input style={{ ...S.input, marginBottom: "16px" }} type="number" placeholder="Ej: 8000" value={form.precioDecant5} onChange={e => setForm(f => ({ ...f, precioDecant5: e.target.value }))} />
<label style={S.label}>Decant 10ml (CLP, opcional)</label>
<input style={{ ...S.input, marginBottom: "16px" }} type="number" placeholder="Ej: 14000" value={form.precioDecant10} onChange={e => setForm(f => ({ ...f, precioDecant10: e.target.value }))} />
<label style={S.label}>Marca</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Lattafa, Armaf, Dior..." value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
<label style={S.label}>Genero</label>
<select style={{ ...S.select, marginBottom: "16px" }} value={form.genero} onChange={e => setForm(f => ({ ...f, genero: e.target.value }))}>
<option value="">Sin especificar</option>
<option value="masculino">Masculino</option>
<option value="femenino">Femenino</option>
<option value="unisex">Unisex</option>
</select>
<label style={S.label}>Temporada ideal</label>
<select style={{ ...S.select, marginBottom: "16px" }} value={form.temporada} onChange={e => setForm(f => ({ ...f, temporada: e.target.value }))}>
<option value="">Sin especificar</option>
<option value="invierno">Invierno</option>
<option value="verano">Verano</option>
<option value="todo_anio">Todo el ano</option>
</select>
<label style={S.label}>Tipo</label>
<select style={{ ...S.select, marginBottom: "16px" }} value={form.tipoPerfume} onChange={e => setForm(f => ({ ...f, tipoPerfume: e.target.value }))}>
<option value="">Sin especificar</option>
<option value="arabe">Arabe</option>
<option value="disenador">Disenador</option>
</select>
<label style={S.label}>Duracion</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: 8-10 horas" value={form.duracion} onChange={e => setForm(f => ({ ...f, duracion: e.target.value }))} />
<label style={S.label}>Notas olfativas</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Vainilla, Ambar, Cuero" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
<label style={S.label}>Se parece a / Inspirado en (opcional)</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Creed Aventus" value={form.inspiradoEn} onChange={e => setForm(f => ({ ...f, inspiradoEn: e.target.value }))} />
<label style={S.label}>Porcentaje de similitud (opcional)</label>
<input style={{ ...S.input, marginBottom: "16px" }} type="number" min="0" max="100" placeholder="Ej: 95" value={form.similitud} onChange={e => setForm(f => ({ ...f, similitud: e.target.value }))} /><label style={S.label}>Stock bajo real (opcional)</label>
<input style={{ ...S.input, marginBottom: "16px" }} type="number" min="0" placeholder="Ej: 4 (dejar vacio si no aplica)" value={form.stockBajo} onChange={e => setForm(f => ({ ...f, stockBajo: e.target.value }))} />
<label style={S.label}>Etiquetas / Categorias especiales</label><div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>{TAG_OPTIONS.map(t => (<label key={t.key} style={{ display: "flex", alignItems: "center", gap: "6px", background: (form.etiquetas || []).includes(t.key) ? "#d4af37" : "#2b2b2b", color: (form.etiquetas || []).includes(t.key) ? "#000" : "#fff", padding: "6px 12px", borderRadius: "16px", fontSize: "13px", cursor: "pointer" }}><input type="checkbox" checked={(form.etiquetas || []).includes(t.key)} onChange={() => setForm(f => ({ ...f, etiquetas: (f.etiquetas || []).includes(t.key) ? f.etiquetas.filter(x => x !== t.key) : [...(f.etiquetas || []), t.key] }))} style={{ display: "none" }} />{t.label}</label>))}</div>
<label style={S.label}>Descripcion</label>
<textarea style={{ ...S.input, marginBottom: "16px", minHeight: "80px", resize: "vertical" }} placeholder="Descripcion del producto..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
<label style={S.label}>Disponibilidad *</label>
<select style={{ ...S.select, marginBottom: "16px" }} value={form.disponibilidad} onChange={e => setForm(f => ({ ...f, disponibilidad: e.target.value }))}>
<option value="stock">En Stock (disponible ahora)</option>
<option value="pedido">Por Pedido</option>
</select>
{form.disponibilidad === "pedido" && (
<>
<label style={S.label}>Dias Habiles de Entrega</label>
<select style={{ ...S.select, marginBottom: "16px" }} value={form.diasHabiles} onChange={e => setForm(f => ({ ...f, diasHabiles: e.target.value }))}>
<option value="3">3 dias habiles</option>
<option value="4">4 dias habiles</option>
<option value="5">5 dias habiles</option>
</select>
</>
)}
<label style={S.label}>Foto 1 (principal) *</label>
<input ref={fileInputRef} type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0], "imageUrl")} style={{ ...S.input, padding: "8px", marginBottom: "8px" }} />
{uploadingField === "imageUrl" && <p style={{ color: "#d4af37" }}>Subiendo...</p>}
{form.imageUrl && (
<div style={{ marginBottom: "16px" }}>
<img src={form.imageUrl} alt="preview" style={{ width: "100%", maxHeight: "160px", objectFit: "contain", background: "#fff", borderRadius: "8px" }} />
</div>
)}
<label style={S.label}>Foto 2</label>
<input ref={foto2Ref} type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0], "foto2")} style={{ ...S.input, padding: "8px", marginBottom: "8px" }} />
{uploadingField === "foto2" && <p style={{ color: "#d4af37" }}>Subiendo...</p>}
{form.foto2 && (
<div style={{ marginBottom: "16px" }}>
<img src={form.foto2} alt="preview" style={{ width: "100%", maxHeight: "160px", objectFit: "contain", background: "#fff", borderRadius: "8px" }} />
</div>
)}
<label style={S.label}>Foto 3</label>
<input ref={foto3Ref} type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0], "foto3")} style={{ ...S.input, padding: "8px", marginBottom: "8px" }} />
{uploadingField === "foto3" && <p style={{ color: "#d4af37" }}>Subiendo...</p>}
{form.foto3 && (
<div style={{ marginBottom: "16px" }}>
<img src={form.foto3} alt="preview" style={{ width: "100%", maxHeight: "160px", objectFit: "contain", background: "#fff", borderRadius: "8px" }} />
</div>
)}
<label style={S.label}>Foto en la mano</label>
<input ref={fotoManoRef} type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0], "fotoMano")} style={{ ...S.input, padding: "8px", marginBottom: "8px" }} />
{uploadingField === "fotoMano" && <p style={{ color: "#d4af37" }}>Subiendo...</p>}
{form.fotoMano && (
<div style={{ marginBottom: "16px" }}>
<img src={form.fotoMano} alt="preview" style={{ width: "100%", maxHeight: "160px", objectFit: "contain", background: "#fff", borderRadius: "8px" }} />
</div>
)}
<label style={S.label}>Foto con caja</label>
<input ref={fotoCajaRef} type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0], "fotoCaja")} style={{ ...S.input, padding: "8px", marginBottom: "8px" }} />
{uploadingField === "fotoCaja" && <p style={{ color: "#d4af37" }}>Subiendo...</p>}
{form.fotoCaja && (
<div style={{ marginBottom: "16px" }}>
<img src={form.fotoCaja} alt="preview" style={{ width: "100%", maxHeight: "160px", objectFit: "contain", background: "#fff", borderRadius: "8px" }} />
</div>
)}
<label style={S.label}>Video (15 segundos aprox.)</label>
<input ref={videoRef} type="file" accept="video/*" onChange={e => handleImageUpload(e.target.files[0], "videoUrl")} style={{ ...S.input, padding: "8px", marginBottom: "8px" }} />
{uploadingField === "videoUrl" && <p style={{ color: "#d4af37" }}>Subiendo video...</p>}
{form.videoUrl && (
<div style={{ marginBottom: "16px" }}>
<video src={form.videoUrl} controls style={{ width: "100%", maxHeight: "200px", borderRadius: "8px", background: "#000" }} />
</div>
)}
{uploadMsg && !uploadingField && <p style={{ color: uploadMsg.includes("Error") ? "#ff4444" : "#d4af37" }}>{uploadMsg}</p>}
<button onClick={handleAddProduct} disabled={uploading} style={{ ...S.btn, width: "100%", padding: "12px", opacity: uploading ? 0.6 : 1 }}>{editingId ? "Guardar Cambios" : "Agregar Producto"}</button>
{editingId && (
<button onClick={handleCancelEdit} style={{ ...S.btn, width: "100%", padding: "10px", marginTop: "8px", background: "transparent", border: "1px solid #d4af37", color: "#d4af37" }}>Cancelar Edicion</button>
)}
</div>
<h3 style={{ marginTop: "36px", marginBottom: "16px" }}>Productos Existentes ({products.length})</h3>
{products.map(p => (
<div key={p.id} style={{ ...S.adminCard, marginBottom: "12px", display: "flex", gap: "16px", alignItems: "center" }}>
<img src={optimizeImg(getProductImage(p))} alt={getProductName(p)} loading="lazy" decoding="async" style={{ width: "80px", height: "80px", objectFit: "contain", background: "#fff", borderRadius: "8px", flexShrink: 0 }} />
<div style={{ flex: 1 }}>
<div style={{ fontWeight: "bold", marginBottom: "4px" }}>{getProductName(p)}</div>
<div style={{ color: "#d4af37", fontWeight: "bold" }}>{formatPrice(getProductPrice(p))}</div>
<div style={{ marginTop: "4px" }}>
{getProductDisp(p) === "stock"
? <span style={{ color: "#d4af37", fontSize: "13px" }}>En Stock</span>
: <span style={{ color: "#ffffff", fontSize: "13px" }}>Por Pedido - {getProductDias(p)} dias hab.</span>
}
<span style={{ color: "#d4af37", fontSize: "12px", marginLeft: "10px", textTransform: "uppercase" }}>{getProductCategoria(p)}</span>
</div>
</div>
<button onClick={() => handleEditProduct(p)} style={{ background: "#d4af37", color: "#000", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Editar</button>
<button onClick={() => handleDeleteProduct(p.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer" }}>Eliminar</button>
</div>
))}

<h3 style={{ marginTop: "48px", marginBottom: "16px" }}>Opiniones de Clientes ({resenas.length})</h3>
<div style={S.adminCard}>
<label style={S.label}>Nombre del cliente *</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Maria Gomez" value={resenaForm.nombre} onChange={e => setResenaForm(f => ({ ...f, nombre: e.target.value }))} />
<label style={S.label}>Ciudad</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Bahia Blanca" value={resenaForm.ciudad} onChange={e => setResenaForm(f => ({ ...f, ciudad: e.target.value }))} />
<label style={S.label}>Calificacion</label>
<select style={{ ...S.input, marginBottom: "16px" }} value={resenaForm.estrellas} onChange={e => setResenaForm(f => ({ ...f, estrellas: e.target.value }))}>
<option value="5">5 estrellas</option>
<option value="4">4 estrellas</option>
<option value="3">3 estrellas</option>
<option value="2">2 estrellas</option>
<option value="1">1 estrella</option>
</select>
<label style={S.label}>Comentario real del cliente *</label>
<textarea style={{ ...S.input, marginBottom: "16px", minHeight: "80px", fontFamily: "inherit" }} placeholder="Ej: Excelente atencion, llego en un dia y el perfume es original." value={resenaForm.texto} onChange={e => setResenaForm(f => ({ ...f, texto: e.target.value }))} />
<label style={S.label}>Foto real del cliente (opcional)</label>
<input type="file" accept="image/*" onChange={e => handleResenaImageUpload(e.target.files[0])} style={{ ...S.input, padding: "8px", marginBottom: "8px" }} />
{resenaUploading && <p style={{ color: "#d4af37" }}>Subiendo foto...</p>}
{resenaForm.foto && (
<div style={{ marginBottom: "8px" }}>
<img src={resenaForm.foto} alt="preview" style={{ width: "70px", height: "70px", borderRadius: "50%", objectFit: "cover" }} />
</div>
)}
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="O pega el link de la foto que te envio el cliente" value={resenaForm.foto} onChange={e => setResenaForm(f => ({ ...f, foto: e.target.value }))} />
<button onClick={handleAddResena} disabled={resenaSaving} style={{ ...S.btn, width: "100%", padding: "10px" }}>{resenaSaving ? "Guardando..." : "Agregar Resena"}</button>
</div>
{resenas.map(r => (
<div key={r.id} style={{ ...S.adminCard, marginBottom: "12px", display: "flex", gap: "16px", alignItems: "center" }}>
<div style={{ flex: 1 }}>
<strong>{r.nombre}</strong> {r.ciudad && <span style={{ color: "#9a9a9a" }}> - {r.ciudad}</span>}
<div style={{ color: "#d4af37" }}>{"★".repeat(r.estrellas || 5)}{"☆".repeat(5 - (r.estrellas || 5))}</div>
<div style={{ color: "#bdbdbd", fontSize: "13px" }}>{r.texto}</div>
</div>
<button onClick={() => handleDeleteResena(r.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer" }}>Eliminar</button>
</div>
))}
</div>
</div>
);
}

return (
<div style={S.body}>
<style>{`@media (max-width: 700px) { .gs-nav { position: sticky !important; top: 0 !important; z-index: 80 !important; flex-wrap: wrap !important; row-gap: 8px !important; padding: 10px 12px !important; } .gs-nav-promo { position: static !important; left: auto !important; top: auto !important; transform: none !important; order: 3 !important; width: 100% !important; max-width: 100% !important; text-align: center !important; font-size: 11px !important; } .gs-nav-cart-btn { position: static !important; top: auto !important; right: auto !important; padding: 8px 12px !important; font-size: 13px !important; } .gs-nav-account-btn { position: static !important; top: auto !important; right: auto !important; padding: 8px 12px !important; font-size: 13px !important; } .gs-nav-instagram-btn { position: static !important; top: auto !important; right: auto !important; width: 36px !important; height: 36px !important; } .gs-mobile-cart-bar { display: flex !important; } }`}</style>
<div style={S.nav} className="gs-nav">
<div style={S.navPromo} className="gs-nav-promo"><span style={{ color: "#d4af37" }}>PERFUMES ORIGINALES</span> / <span style={{ color: "#ffffff" }}>APROVECHA CODIGO PROMOCIONAL</span></div>
<a href="https://www.instagram.com/esenciaperfumeria.bb/" target="_blank" rel="noopener noreferrer" style={S.navInstagramBtn} className="gs-nav-instagram-btn" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"></line></svg></a>
<button onClick={() => { setAccountError(""); setShowAccountModal(true); }} style={S.navAccountBtn} className="gs-nav-account-btn">{user ? "Mi Cuenta" : "Ingresar"}</button>
<button onClick={() => setShowCart(true)} style={S.navCartBtn} className="gs-nav-cart-btn">Carrito ({cart.length})</button>
</div>
<div style={S.heroWrap} className="gs-hero">
<style>{`
.gs-hero-video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;}
.gs-hero-btn-primary,.gs-hero-btn-secondary{transition:transform .25s ease, box-shadow .25s ease, background .25s ease;}
.gs-hero-btn-primary:hover{transform:translateY(-3px) scale(1.03);box-shadow:0 14px 32px rgba(212,175,55,0.5);}
.gs-hero-btn-secondary:hover{transform:translateY(-3px) scale(1.03);background:rgba(255,255,255,0.16);}
.gs-hero-scroll{animation:gsBounce 2s infinite;}
@keyframes gsBounce{0%,100%{transform:translateX(-50%) translateY(0);}50%{transform:translateX(-50%) translateY(8px);}}
@media (max-width:700px){
.gs-hero{min-height:auto !important;padding:105px 16px 64px !important;}
.gs-hero-trust-row{display:grid !important;grid-template-columns:1fr 1fr;gap:8px !important;margin:16px 0 4px !important;}
.gs-hero-trust-row span{font-size:11px !important;padding:7px 8px !important;justify-content:center;line-height:1.3;}
.gs-hero-btn-row{flex-direction:column !important;width:100%;align-items:stretch !important;margin-top:22px !important;gap:12px !important;}
.gs-hero-btn-primary,.gs-hero-btn-secondary{width:100% !important;text-align:center;padding:16px 30px !important;}
.gs-assistant-btn{width:48px !important;height:48px !important;right:14px !important;bottom:14px !important;font-size:16px !important;}
.product-grid{grid-template-columns:repeat(2,1fr) !important;gap:10px 8px !important;}
.product-grid .card-img{padding:8px !important;}
.product-grid .add-cart-btn{font-size:12.5px !important;padding:9px 8px !important;}
}
@media (min-width:1600px){
.gs-hero{min-height:88vh;}
}
`}</style>
<img className="gs-hero-video" src="https://images.pexels.com/videos/10537262/adolescent-afro-beautiful-bridal-10537262.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="" />
{!isMobileHero && (
<video className="gs-hero-video" autoPlay muted loop playsInline preload="auto">
<source src="https://videos.pexels.com/video-files/10537262/10537262-sd_960_506_25fps.mp4" type="video/mp4" />
</video>
)}
<div style={S.heroOverlay}></div>
<div style={S.heroContent}>
<div style={S.heroDivider}></div>
<div style={S.heroTag}>PERFUMES ORIGINALES</div>
<h1 style={S.heroMainTitle}>Más de 300 fragancias</h1>
<p style={S.heroSub}>Diseñador · Árabes · Nicho</p>
<div style={S.heroTrustRow} className="gs-hero-trust-row">
<span style={S.heroTrustBadge}>✔ 100% Originales</span>
<span style={S.heroTrustBadge}>🚚 Envío gratis en Bahía Blanca</span>
<span style={S.heroTrustBadge}>📦 Envíos a todo el país</span>
<span style={S.heroTrustBadge}>⭐ +500 clientes</span>
</div>
<div style={S.heroBtnRow} className="gs-hero-btn-row">
<button className="gs-hero-btn-primary" style={S.heroBtnPrimary} onClick={() => { setFilter("perfumes"); setTimeout(() => document.getElementById("productsSection")?.scrollIntoView({ behavior: "smooth" }), 60); }}>Ver Perfumes</button>
<button className="gs-hero-btn-secondary" style={S.heroBtnSecondary} onClick={() => { setAdvFilterOpen(true); setTimeout(() => document.getElementById("advFilterSection")?.scrollIntoView({ behavior: "smooth" }), 60); }}>Elegí según tu personalidad</button>
</div>
</div>
<div className="gs-hero-scroll" style={S.heroScrollCue}>↓</div>
</div>
<div style={S.tickerSection}>
<style>{`@keyframes gangaTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } } @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } } .product-card { transition: transform 0.3s ease, box-shadow 0.3s ease; animation: fadeInUp 0.6s ease both; } .product-card:hover, .product-card:active { transform: translateY(-6px); box-shadow: 0 14px 28px rgba(212,175,55,0.18); } .card-img { transition: transform 0.35s ease; } .product-card:hover .card-img { transform: scale(1.06); } .fav-btn { transition: transform 0.2s ease, background 0.2s ease; } .fav-btn:hover { transform: scale(1.12); } .fav-btn.active { animation: favPop 0.3s ease; } @keyframes favPop { 0% { transform: scale(1); } 45% { transform: scale(1.3); } 100% { transform: scale(1); } } .add-cart-btn { transition: transform 0.2s ease, box-shadow 0.2s ease; } .add-cart-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(212,175,55,0.4); } .add-cart-btn:active { transform: scale(0.96); } @keyframes skeletonPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } } .skel { animation: skeletonPulse 1.4s ease-in-out infinite; background: #23231f; } @keyframes toastPop { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
<div style={S.tickerTrack}>
{[...tickerProducts, ...tickerProducts].map((p, i) => (
<div key={i} className="product-card" style={{ ...S.tickerItem, position: "relative" }} onClick={() => setSelectedProduct(p)}>
<button className={"fav-btn" + (favorites.includes(p.id) ? " active" : "")} onClick={e => { e.stopPropagation(); toggleFavorite(p.id); }} style={S.favBtn(favorites.includes(p.id))} aria-label="Favorito">{favorites.includes(p.id) ? "♥" : "♡"}</button>
<img className="card-img" src={optimizeImg(getProductImage(p))} alt={getProductName(p)} style={S.cardImg} loading="lazy" decoding="async" onError={(e) => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
<div style={S.cardBody}>
<div style={S.cardName}>{getProductName(p)}</div>
<div style={S.cardPrice}>
<span>{formatPrice(getProductPrice(p))}</span>
{getDiscountPercent(p) && <span style={S.originalPrice}>{formatPrice(getProductOriginalPrice(p))}</span>}
{getDiscountPercent(p) && <span style={S.discountBadge}>-{getDiscountPercent(p)}%</span>}
</div>
<div style={S.badgeRow}>
{getProductDisp(p) === "stock"
? <span style={S.badgeStock}><span style={S.badgeStockDot}></span>En Stock</span>
: <span style={S.badgePedido}>Por Pedido · {getProductDias(p)} dias hab.</span>
}
{getUrgencyMsg(p) && <span style={S.urgencyBadge}>{getUrgencyMsg(p)}</span>}
</div>
<button className="add-cart-btn" style={{ ...S.btn, width: "100%", marginTop: "auto" }} onClick={e => { e.stopPropagation(); addToCart(p); }}>Agregar al Carrito</button>
</div>
</div>
))}
</div>
</div>
{recentlyViewedProducts.length > 0 && (
<div style={S.section}>
<div style={S.sectionTitle}>Vistos Recientemente</div>
<div style={S.recentlyViewedRow}>
{recentlyViewedProducts.map(p => (
<div key={p.id} className="product-card" style={S.recentlyViewedCard} onClick={() => setSelectedProduct(p)}>
<img className="card-img" src={optimizeImg(getProductImage(p))} alt={getProductName(p)} style={S.recentlyViewedImg} loading="lazy" decoding="async" onError={e => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
<div style={S.recentlyViewedName}>{getProductName(p)}</div>
<div style={S.recentlyViewedPrice}>{formatPrice(getProductPrice(p))}</div>
</div>
))}
</div>
</div>
)}
<div style={S.section} id="productsSection">
<div style={S.sectionTitle}>Productos Disponibles</div>
<div style={S.searchWrap}>
<svg style={S.searchIconSvg} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
<input type="text" placeholder="Ej: perfume dulce, para verano, parecido a Sauvage..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={S.searchInput} />
</div>
<div style={{ maxWidth: "260px", margin: "0 auto 20px" }}>
<select style={S.select} value={sortBy} onChange={e => setSortBy(e.target.value)} disabled={!!searchQuery.trim()} title={searchQuery.trim() ? "Al buscar, se ordena por relevancia" : "Ordenar por"}>
<option value="relevancia">Ordenar: Novedades</option>
<option value="vendidos">Ordenar: Más vendidos</option>
<option value="precio_asc">Ordenar: Precio menor a mayor</option>
<option value="precio_desc">Ordenar: Precio mayor a menor</option>
</select>
</div>
<div style={S.filterBar}>
<button style={S.filterBtnPrimary(filter === "todos")} onClick={() => setFilter("todos")}>Todos</button>
<button style={S.filterBtnPrimary(filter === "perfumes")} onClick={() => setFilter("perfumes")}>Perfumes</button>
<button style={S.filterBtnPrimary(filter === "stock")} onClick={() => setFilter("stock")}>En Stock</button>
<button style={S.filterBtnPrimary(filter === "pedido")} onClick={() => setFilter("pedido")}>Por Pedido</button>
<button style={S.filterBtnPrimary(filter === "decants")} onClick={() => setFilter("decants")}>Decant</button><button style={S.filterBtnPrimary(filter === "favoritos")} onClick={() => setFilter("favoritos")}>♥ Favoritos{favorites.length > 0 ? ` (${favorites.length})` : ""}</button></div><div style={{ textAlign: "center", margin: "2px 0 16px" }}>
<button style={S.advFilterToggle} onClick={() => setTagFiltersOpen(!tagFiltersOpen)}>{tagFiltersOpen ? "Ocultar mas filtros ▲" : "Mas filtros (categorias, temporada, ocasion...) ▾"}</button>
</div>
{tagFiltersOpen && (
<div style={S.filterBar}><button style={S.filterBtn(filter === "mas_vendidos")} onClick={() => setFilter("mas_vendidos")}>Mas Vendidos</button><button style={S.filterBtn(filter === "novedades")} onClick={() => setFilter("novedades")}>Novedades</button><button style={S.filterBtn(filter === "larga_duracion")} onClick={() => setFilter("larga_duracion")}>Larga Duracion</button><button style={S.filterBtn(filter === "menos100k")} onClick={() => setFilter("menos100k")}>Menos de $100.000</button><button style={S.filterBtn(filter === "arabes")} onClick={() => setFilter("arabes")}>Perfumes Arabes</button><button style={S.filterBtn(filter === "disenador")} onClick={() => setFilter("disenador")}>Perfumes de Disenador</button><button style={S.filterBtn(filter === "para_regalar")} onClick={() => setFilter("para_regalar")}>Para Regalar</button><button style={S.filterBtn(filter === "top_invierno")} onClick={() => setFilter("top_invierno")}>Top Invierno</button><button style={S.filterBtn(filter === "top_verano")} onClick={() => setFilter("top_verano")}>Top Verano</button><button style={S.filterBtn(filter === "top_oficina")} onClick={() => setFilter("top_oficina")}>Top Oficina</button><button style={S.filterBtn(filter === "top_citas")} onClick={() => setFilter("top_citas")}>Top Citas</button>
</div>
)}
<div style={S.advFilterWrap} id="advFilterSection">
<button style={S.advFilterToggle} onClick={() => setAdvFilterOpen(!advFilterOpen)}>
{advFilterOpen ? "Ocultar filtros" : "Encontra tu perfume ideal (filtros)"}
</button>
{advFilterOpen && (
<div style={S.advFilterBox}>
<div style={S.advFilterGrid}>
<div>
<label style={S.advFilterLabel}>Marca</label>
<select style={S.select} value={filterMarca} onChange={e => setFilterMarca(e.target.value)}>
<option value="">Todas</option>
{[...new Set(products.map(p => p.marca).filter(Boolean))].sort().map(m => (
<option key={m} value={m}>{m}</option>
))}
</select>
</div>
<div>
<label style={S.advFilterLabel}>Precio minimo</label>
<input style={S.input} type="number" placeholder="$0" value={filterPrecioMin} onChange={e => setFilterPrecioMin(e.target.value)} />
</div>
<div>
<label style={S.advFilterLabel}>Precio maximo</label>
<input style={S.input} type="number" placeholder="Sin limite" value={filterPrecioMax} onChange={e => setFilterPrecioMax(e.target.value)} />
</div>
<div>
<label style={S.advFilterLabel}>Duracion</label>
<select style={S.select} value={filterDuracion} onChange={e => setFilterDuracion(e.target.value)}>
<option value="">Todas</option>
{DURACION_CATEGORIAS.map(d => (
<option key={d} value={d}>{d}</option>
))}
</select>
</div>
<div>
<label style={S.advFilterLabel}>Notas</label>
<input style={S.input} type="text" placeholder="Ej: vainilla" value={filterNotas} onChange={e => setFilterNotas(e.target.value)} />
</div>
<div>
<label style={S.advFilterLabel}>Temporada</label>
<select style={S.select} value={filterTemporada} onChange={e => setFilterTemporada(e.target.value)}>
<option value="">Todas</option>
<option value="invierno">Invierno</option>
<option value="verano">Verano</option>
<option value="todo_anio">Todo el ano</option>
</select>
</div>
<div>
<label style={S.advFilterLabel}>Genero</label>
<select style={S.select} value={filterGenero} onChange={e => setFilterGenero(e.target.value)}>
<option value="">Todos</option>
<option value="masculino">Masculino</option>
<option value="femenino">Femenino</option>
<option value="unisex">Unisex</option>
</select>
</div>
<div>
<label style={S.advFilterLabel}>Tipo</label>
<select style={S.select} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
<option value="">Todos</option>
<option value="arabe">Arabes</option>
<option value="disenador">Disenador</option>
</select>
</div>
</div>
<button style={{ ...S.btnOutline, marginTop: "14px" }} onClick={() => { setFilterMarca(""); setFilterPrecioMin(""); setFilterPrecioMax(""); setFilterDuracion(""); setFilterNotas(""); setFilterTemporada(""); setFilterGenero(""); setFilterTipo(""); }}>Limpiar filtros</button>
</div>
)}
</div>
<div style={{ textAlign: "center", color: "#8a8a8a", fontSize: "13px", marginBottom: "16px" }}>
{!productsLoading && filteredProducts.length > 0 && `Mostrando ${Math.min(visibleCount, filteredProducts.length)} de ${filteredProducts.length} perfumes`}
</div>
<div style={S.grid} className="product-grid">
{productsLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={"skel" + i} />)}
{!productsLoading && filteredProducts.slice(0, visibleCount).map(product => (
<div key={product.id} className="product-card" style={{ ...S.card, position: "relative" }} onClick={() => setSelectedProduct(product)}>
<button className={"fav-btn" + (favorites.includes(product.id) ? " active" : "")} onClick={e => { e.stopPropagation(); toggleFavorite(product.id); }} style={S.favBtn(favorites.includes(product.id))} aria-label="Favorito">{favorites.includes(product.id) ? "♥" : "♡"}</button>
<img className="card-img" src={optimizeImg(getProductImage(product))} alt={getProductName(product)} style={S.cardImg} loading="lazy" decoding="async" onError={e => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
<div style={S.cardBody}>
<div style={S.cardName}>{getProductName(product)}</div>
{filter !== "decants" && (
<>
<div style={S.cardPrice}>
<span>{formatPrice(getProductPrice(product))}</span>
{getDiscountPercent(product) && <span style={S.originalPrice}>{formatPrice(getProductOriginalPrice(product))}</span>}
{getDiscountPercent(product) && <span style={S.discountBadge}>-{getDiscountPercent(product)}%</span>}
</div>
<div style={S.badgeRow}>
{getProductDisp(product) === "stock"
? <span style={S.badgeStock}><span style={S.badgeStockDot}></span>En Stock</span>
: <span style={S.badgePedido}>Por Pedido · {getProductDias(product)} dias hab.</span>
}
{getUrgencyMsg(product) && <span style={S.urgencyBadge}>{getUrgencyMsg(product)}</span>}
</div>
<button className="add-cart-btn" style={{ ...S.btn, width: "100%", marginTop: "auto" }} onClick={e => { e.stopPropagation(); addToCart(product); }}>Agregar al Carrito</button>
</>
)}
{hasDecant(product) && (
<div style={{ marginTop: filter === "decants" ? "0" : "12px", borderTop: filter === "decants" ? "none" : "1px solid #2b2b2b", paddingTop: filter === "decants" ? "0" : "10px" }}>
<div style={{ color: "#d4af37", fontSize: "13px", fontWeight: "bold", marginBottom: "6px" }}>Decant disponible</div>
{getDecantPrice5(product) && (
<button style={{ ...S.btn, width: "100%", marginTop: "6px", background: "transparent", border: "1px solid #d4af37", color: "#d4af37" }} onClick={e => { e.stopPropagation(); addDecantToCart(product, 5); }}>5ml - {formatPrice(getDecantPrice5(product))}</button>
)}
{getDecantPrice10(product) && (
<button style={{ ...S.btn, width: "100%", marginTop: "6px", background: "transparent", border: "1px solid #d4af37", color: "#d4af37" }} onClick={e => { e.stopPropagation(); addDecantToCart(product, 10); }}>10ml - {formatPrice(getDecantPrice10(product))}</button>
)}
</div>
)}
</div>
</div>
))}
{!productsLoading && filteredProducts.length === 0 && <p style={{ color: "#bdbdbd", gridColumn: "1/-1" }}>No hay productos en esta categoria.</p>}
</div>
{visibleCount < filteredProducts.length && (
<button style={S.loadMoreBtn} onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>Ver más perfumes ({filteredProducts.length - visibleCount} más)</button>
)}
</div>
  
<div style={S.loyaltySection} id="loyaltySection"><div style={S.loyaltyCard}><div style={S.loyaltyTitle}>Programa de Fidelizacion Esencia Perfumeria</div><p style={{ color: "#fff", maxWidth: 560, margin: "0 auto" }}>Cada compra suma puntos! Por cada $100.000 de compra sumas 100 puntos, y con 300 puntos obtenes $10.000 de descuento en tu proximo pedido.</p><div style={S.loyaltyGrid}><div style={S.loyaltyStep}><div style={{ color: "#d4af37", fontWeight: 700, marginBottom: 4 }}>1. Compra</div><div style={{ color: "#bdbdbd", fontSize: 13 }}>Crea tu cuenta con tu correo y compra tus perfumes favoritos.</div></div><div style={S.loyaltyStep}><div style={{ color: "#d4af37", fontWeight: 700, marginBottom: 4 }}>2. Suma puntos</div><div style={{ color: "#bdbdbd", fontSize: 13 }}>$100.000 de compra = 100 puntos acumulados a tu cuenta.</div></div><div style={S.loyaltyStep}><div style={{ color: "#d4af37", fontWeight: 700, marginBottom: 4 }}>3. Canjea</div><div style={{ color: "#bdbdbd", fontSize: 13 }}>300 puntos = $10.000 de descuento en tu proximo pedido.</div></div></div><div style={{ marginTop: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>{user ? (<><p style={{ color: "#bdbdbd", fontSize: 13, margin: 0 }}>Conectado como {user.email}</p>{customerPoints !== null && (<p style={{ color: "#d4af37", fontWeight: 700, margin: 0 }}>Tenes {customerPoints} puntos = {formatPrice(pointsToDiscount(customerPoints))} de descuento disponible</p>)}<button style={S.btnOutline} onClick={() => loadMyPoints(user.uid)} disabled={pointsLoading}>{pointsLoading ? "Consultando..." : "Actualizar mis puntos"}</button></>) : (<><p style={{ color: "#bdbdbd", fontSize: 14, margin: 0 }}>Inicia sesion con tu correo para ver y usar tus puntos.</p><button style={S.btn} onClick={() => { setAccountMode("login"); setAccountError(""); setShowAccountModal(true); }}>Ingresar / Crear cuenta</button></>)}</div></div></div>
<div style={{ padding: "10px 20px 40px", maxWidth: "1200px", margin: "0 auto" }}>
<div style={{ background: "linear-gradient(135deg, #14311f, #0f0f0f)", border: "1px solid #25D366", borderRadius: "16px", padding: "30px 24px", textAlign: "center" }}>
<div style={{ fontFamily: "'Playfair Display', serif", color: "#fff", fontSize: "clamp(20px,3.5vw,26px)", fontWeight: "700", marginBottom: "8px" }}>Sumate a la Lista VIP de WhatsApp</div>
<p style={{ color: "#bdbdbd", maxWidth: 520, margin: "0 auto 18px" }}>Enterate primero de lanzamientos, stock nuevo y promos exclusivas, directo por WhatsApp. Sin spam, te escribimos solo cuando vale la pena.</p>
<a href={`https://wa.me/2914261941?text=${encodeURIComponent("Hola! Quiero sumarme a la Lista VIP para enterarme de promos y novedades")}`} target="_blank" rel="noreferrer" onClick={() => { try { if (window.fbq) window.fbq("track", "Lead"); if (window.gtag) window.gtag("event", "generate_lead"); } catch (e) {} }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "13px 24px", fontSize: "15px", fontWeight: "700", borderRadius: "10px", background: "#25D366", color: "#fff", textDecoration: "none" }}>💬 Sumarme a la Lista VIP</a>
</div>
</div>
<div style={S.section}>
<div style={S.sectionTitle}>Opiniones de Clientes</div>
{resenas.length === 0 ? (
<p style={{ color: "#7a7a7a", textAlign: "center" }}>Todavia no hay opiniones cargadas.</p>
) : (
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "18px" }}>
{resenas.map(r => (
<div key={r.id} style={S.resenaCard}>
<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
{r.foto ? (
<img src={optimizeImg(r.foto)} alt={r.nombre} loading="lazy" decoding="async" style={S.resenaFoto} />
) : (
<div style={S.resenaAvatar}>{(r.nombre || "?").trim().charAt(0).toUpperCase()}</div>
)}
<div>
<div style={{ fontWeight: "700", color: "#1a1a1a" }}>{r.nombre}</div>
{r.ciudad && <div style={{ fontSize: "12px", color: "#7a7a7a" }}>{r.ciudad}</div>}
</div>
</div>
<div style={{ color: "#d4af37", marginBottom: "8px" }}>{"★".repeat(r.estrellas || 5)}{"☆".repeat(5 - (r.estrellas || 5))}</div>
<p style={{ color: "#3a3a3a", fontSize: "14px", fontStyle: "italic", margin: 0 }}>"{r.texto}"</p>
</div>
))}
</div>
)}
</div>

{selectedProduct && (
<div style={S.modal} onClick={() => setSelectedProduct(null)}>
<div style={S.modalBox} onClick={e => e.stopPropagation()}>
<button onClick={() => setSelectedProduct(null)} style={{ position: "fixed", top: "16px", right: "16px", background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>x</button>
<button onClick={() => toggleFavorite(selectedProduct.id)} style={S.favBtn(favorites.includes(selectedProduct.id))} aria-label="Favorito">{favorites.includes(selectedProduct.id) ? "♥" : "♡"}</button>
<img src={optimizeImg(modalActiveImg || getProductImage(selectedProduct))} alt={getProductName(selectedProduct)} style={S.modalImg} />
{[selectedProduct.imageUrl, selectedProduct.foto2, selectedProduct.foto3, selectedProduct.fotoMano, selectedProduct.fotoCaja].filter(Boolean).length > 1 && (
<div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto" }}>
{[selectedProduct.imageUrl, selectedProduct.foto2, selectedProduct.foto3, selectedProduct.fotoMano, selectedProduct.fotoCaja].filter(Boolean).map((src, i) => (
<img key={i} src={optimizeImg(src)} loading="lazy" decoding="async" onClick={() => setModalActiveImg(src)} style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "6px", cursor: "pointer", border: (modalActiveImg || getProductImage(selectedProduct)) === src ? "2px solid #d4af37" : "2px solid transparent", flexShrink: 0, background: "#fff" }} />
))}
</div>
)}
{selectedProduct.videoUrl && (
<video src={selectedProduct.videoUrl} controls style={{ width: "100%", borderRadius: "10px", marginBottom: "16px", background: "#000" }} />
)}
<h2 style={{ marginTop: 0, marginBottom: "8px", fontFamily: "'Playfair Display', serif" }}>{getProductName(selectedProduct)}</h2>
<div style={{ fontSize: "28px", fontWeight: "900", color: "#d4af37", marginBottom: "12px" }}>
{getDiscountPercent(selectedProduct) && <span style={{ ...S.originalPrice, fontSize: "18px" }}>{formatPrice(getProductOriginalPrice(selectedProduct))}</span>}
{formatPrice(getProductPrice(selectedProduct))}
{getDiscountPercent(selectedProduct) && <span style={S.discountBadge}>-{getDiscountPercent(selectedProduct)}%</span>}
</div>
{getProductDisp(selectedProduct) === "stock"
? <span style={S.badgeStock}><span style={S.badgeStockDot}></span>En Stock - Disponible ahora</span>
: <span style={S.badgePedido}>Por Pedido · {getProductDias(selectedProduct)} dias habiles</span>
}
{getUrgencyMsg(selectedProduct) && <div style={{ ...S.urgencyBadge, display: "inline-block", marginTop: "8px" }}>{getUrgencyMsg(selectedProduct)}</div>}
{(selectedProduct.marca || selectedProduct.genero || selectedProduct.tipoPerfume || selectedProduct.temporada || selectedProduct.duracion || selectedProduct.notas) && (
<div style={S.specsGrid}>
{selectedProduct.marca && (
<div style={S.specItem}><span style={S.specIcon}><SpecIcon name="marca" /></span><div><div style={S.specLabel}>Marca</div><div style={S.specValue}>{selectedProduct.marca}</div></div></div>
)}
{selectedProduct.genero && (
<div style={S.specItem}><span style={S.specIcon}><SpecIcon name="genero" /></span><div><div style={S.specLabel}>Genero</div><div style={S.specValue}>{generoLabel(selectedProduct.genero)}</div></div></div>
)}
{selectedProduct.tipoPerfume && (
<div style={S.specItem}><span style={S.specIcon}><SpecIcon name="tipo" /></span><div><div style={S.specLabel}>Tipo</div><div style={S.specValue}>{tipoLabel(selectedProduct.tipoPerfume)}</div></div></div>
)}
{selectedProduct.temporada && (
<div style={S.specItem}><span style={S.specIcon}><SpecIcon name="temporada" /></span><div><div style={S.specLabel}>Temporada ideal</div><div style={S.specValue}>{temporadaLabel(selectedProduct.temporada)}</div></div></div>
)}
{selectedProduct.duracion && (
<div style={S.specItem}><span style={S.specIcon}><SpecIcon name="duracion" /></span><div><div style={S.specLabel}>Duracion</div><div style={S.specValue}>{selectedProduct.duracion}</div></div></div>
)}
{selectedProduct.notas && (
<div style={S.specItem}><span style={S.specIcon}><SpecIcon name="notas" /></span><div><div style={S.specLabel}>Notas olfativas</div><div style={S.specValue}>{selectedProduct.notas}</div></div></div>
)}
</div>
)}
{selectedProduct.descripcion && <p style={{ color: "#bdbdbd", marginTop: "14px", lineHeight: "1.6" }}>{selectedProduct.descripcion}</p>}
{selectedProduct.inspiradoEn && (
<div style={S.compareBox}>
<div style={{ fontWeight: "bold", marginBottom: "6px" }}>{getProductName(selectedProduct)}</div>
<div style={{ color: "#d4af37", fontSize: "20px", lineHeight: "1" }}>&#8595;</div>
<div style={{ fontSize: "13px", color: "#bdbdbd", margin: "4px 0" }}>Se parece a / Inspirado en</div>
<div style={{ fontWeight: "bold", fontSize: "17px" }}>{selectedProduct.inspiradoEn}</div>
{selectedProduct.similitud && (
<div style={{ color: "#d4af37", fontWeight: "900", fontSize: "22px", marginTop: "6px" }}>{selectedProduct.similitud}%</div>
)}
</div>
)}
<button style={{ ...S.btn, width: "100%", padding: "13px", marginTop: "20px", fontSize: "16px" }} onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}>Agregar al Carrito</button>
<button style={S.quickBuyBtn} onClick={() => handleQuickBuy(selectedProduct)}>⚡ Comprar Ahora</button>
{hasDecant(selectedProduct) && (
<div style={{ marginTop: "16px", borderTop: "1px solid #2b2b2b", paddingTop: "14px" }}>
<div style={{ color: "#d4af37", fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>Tambien disponible en Decant (sin comprar el frasco completo)</div>
{getDecantPrice5(selectedProduct) && (
<button style={{ ...S.btn, width: "100%", marginTop: "8px", background: "transparent", border: "1px solid #d4af37", color: "#d4af37" }} onClick={() => { addDecantToCart(selectedProduct, 5); setSelectedProduct(null); }}>Agregar Decant 5ml - {formatPrice(getDecantPrice5(selectedProduct))}</button>
)}
{getDecantPrice10(selectedProduct) && (
<button style={{ ...S.btn, width: "100%", marginTop: "8px", background: "transparent", border: "1px solid #d4af37", color: "#d4af37" }} onClick={() => { addDecantToCart(selectedProduct, 10); setSelectedProduct(null); }}>Agregar Decant 10ml - {formatPrice(getDecantPrice10(selectedProduct))}</button>
)}
</div>
)}
<a href={`https://wa.me/2914261941?text=${encodeURIComponent("Hola! Quiero consultar sobre: " + getProductName(selectedProduct))}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "13px", marginTop: "10px", fontSize: "15px", fontWeight: "700", borderRadius: "10px", background: "#25D366", color: "#fff", textDecoration: "none" }}>💬 Consultar por WhatsApp</a>
</div>
</div>
)}
{showAccountModal && (
<div style={S.modal} onClick={() => setShowAccountModal(false)}>
<div style={S.modalBox} onClick={e => e.stopPropagation()}>
<button onClick={() => setShowAccountModal(false)} style={{ position: "fixed", top: "16px", right: "16px", background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>x</button>
{user ? (
<div>
<h2 style={{ marginTop: 0, fontFamily: "'Playfair Display', serif", color: "#d4af37" }}>Mi Cuenta</h2>
<p style={{ color: "#bdbdbd" }}>Sesion iniciada como <strong style={{ color: "#fff" }}>{user.email}</strong></p>
<div style={{ ...S.cartPointsBox, marginTop: 16 }}>
{pointsLoading ? <p style={{ color: "#bdbdbd", margin: 0 }}>Consultando tus puntos...</p> : (
<p style={{ color: "#d4af37", fontWeight: 700, margin: 0 }}>Tenes {customerPoints || 0} puntos = {formatPrice(pointsToDiscount(customerPoints))} de descuento disponible</p>
)}
<button style={{ ...S.btnOutline, marginTop: 10, width: "100%" }} onClick={() => loadMyPoints(user.uid)} disabled={pointsLoading}>Actualizar puntos</button>
</div>
<div style={{ ...S.cartPointsBox, marginTop: 16 }}><p style={{ color: "#d4af37", fontWeight: 700, margin: 0 }}>Programa de Referidos</p><p style={{ color: "#bdbdbd", margin: "6px 0" }}>Invita a un amigo y ambos reciben $5.000 de descuento.</p><p style={{ color: "#bdbdbd", margin: "6px 0" }}>Tu codigo: <strong style={{ color: "#fff", letterSpacing: "1px" }}>{referralCode || "..."}</strong></p>{referralCredit > 0 && (<p style={{ color: "#d4af37", fontWeight: 700, margin: "6px 0" }}>Tenes {formatPrice(referralCredit)} de credito por referidos (se descuentan $5.000 por compra)</p>)}<a href={"https://wa.me/?text=" + encodeURIComponent("Te invito a comprar en Esencia Perfumeria! Usa mi codigo " + referralCode + " y ambos recibimos $5.000 de descuento en tu primera compra. https://esencia-perfumeria.vercel.app")} target="_blank" rel="noreferrer" style={{ ...S.btnOutline, display: "block", textAlign: "center", textDecoration: "none", marginTop: 8 }}>Compartir mi codigo por WhatsApp</a></div>
<button onClick={() => { handleLogout(); setShowAccountModal(false); }} style={{ ...S.btnGray, width: "100%", marginTop: 16 }}>Cerrar Sesion</button>
</div>
) : (
<div>
<h2 style={{ marginTop: 0, fontFamily: "'Playfair Display', serif", color: "#d4af37" }}>{accountMode === "login" ? "Iniciar Sesion" : "Crear Cuenta"}</h2>
<p style={{ color: "#bdbdbd", marginBottom: 16 }}>Inicia sesion con tu correo para acumular y canjear puntos del programa de fidelizacion.</p>
<label style={S.label}>Correo electronico</label>
<input type="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} style={{ ...S.input, marginBottom: 14 }} placeholder="tu@correo.com" />
<label style={S.label}>Contrasena</label>
<input type="password" value={accountPassword} onChange={e => setAccountPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAccountAuth()} style={{ ...S.input, marginBottom: 14 }} placeholder="Minimo 6 caracteres" />
{accountError && <p style={{ color: "#ff4444", marginBottom: 12 }}>{accountError}</p>}
<button onClick={handleAccountAuth} disabled={accountBusy} style={{ ...S.btn, width: "100%", padding: "12px", opacity: accountBusy ? 0.6 : 1 }}>{accountBusy ? "Un momento..." : (accountMode === "login" ? "Ingresar" : "Crear cuenta")}</button>
<button onClick={() => { setAccountMode(accountMode === "login" ? "signup" : "login"); setAccountError(""); }} style={{ ...S.btnOutline, width: "100%", padding: "10px", marginTop: 10 }}>{accountMode === "login" ? "No tenes cuenta? Registrate" : "Ya tenes cuenta? Ingresa"}</button>
</div>
)}
</div>
</div>
)}
{showCart && (
<div onClick={() => setShowCart(false)} style={S.cartBackdrop}>
<div onClick={(e) => e.stopPropagation()} style={S.cartOverlay}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
<h3 style={{ margin: 0 }}>Tu Carrito</h3>
<button onClick={() => setShowCart(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer" }}>x</button>
</div>
{cart.length === 0 ? (
<p style={{ color: "#bdbdbd" }}>El carrito esta vacio</p>
) : (
<>
{cart.map(item => (
<div key={item.id} style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
<img src={optimizeImg(getProductImage(item))} alt={getProductName(item)} loading="lazy" decoding="async" style={{ width: "60px", height: "60px", objectFit: "contain", background: "#fff", borderRadius: "6px" }} />
<div style={{ flex: 1 }}>
<div style={{ fontWeight: "bold", fontSize: "14px" }}>{getProductName(item)}</div>
<div style={{ color: "#d4af37" }}>{formatPrice(getProductPrice(item))}</div>
<div style={S.qtyStepperRow}>
<button onClick={() => updateCartQty(item.id, -1)} style={S.qtyBtn} aria-label="Restar">-</button>
<span style={S.qtyValue}>{item.qty}</span>
<button onClick={() => updateCartQty(item.id, 1)} style={S.qtyBtn} aria-label="Sumar">+</button>
</div>
</div>
<button onClick={() => removeFromCart(item.id)} style={{ background: "rgba(139,26,42,0.9)", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>✕</button>
</div>
))}
<div style={{ borderTop: "1px solid #2b2b2b", paddingTop: "16px", marginTop: "16px" }}>
<div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>Total: {formatPrice(finalTotal)}{discountFromPoints > 0 && <span style={{ color: "#d4af37", fontSize: 13, display: "block" }}>(incluye descuento de {formatPrice(discountFromPoints)} por puntos)</span>}</div><div style={S.cartPointsBox}><input type="text" placeholder="Tu telefono de contacto (opcional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={{ ...S.input, marginBottom: 8 }} />{user ? (<>{customerPoints !== null && (<div style={{ color: "#d4af37", fontSize: 13 }}>Tenes {customerPoints} puntos ({formatPrice(pointsToDiscount(customerPoints))} disponibles){pointsToDiscount(customerPoints) > 0 && (<label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: "#fff" }}><input type="checkbox" checked={redeemPoints} onChange={e => setRedeemPoints(e.target.checked)} />Usar mis puntos en este pedido</label>)}</div>)}<button style={{ ...S.btnOutline, width: "100%", marginTop: 8 }} onClick={() => loadMyPoints(user.uid)} disabled={pointsLoading}>{pointsLoading ? "Consultando..." : "Actualizar mis puntos"}</button></>) : (<button style={{ ...S.btnOutline, width: "100%" }} onClick={() => { setAccountMode("login"); setAccountError(""); setShowAccountModal(true); }}>Ingresa para sumar/usar puntos</button>)}</div>
<input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Codigo promocional (opcional)" style={{ width: "100%", padding: "10px", marginBottom: "12px", borderRadius: "6px", border: "1px solid #2b2b2b", background: "#1a1a1a", color: "#fff", fontSize: "14px", boxSizing: "border-box" }} />
<input type="text" value={referralInput} onChange={(e) => setReferralInput(e.target.value)} placeholder="Codigo de referido de un amigo (opcional)" style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "6px", border: "1px solid #2b2b2b", background: "#1a1a1a", color: "#fff", fontSize: "14px", boxSizing: "border-box" }} />{referralInput.trim() && (<p style={{ color: "#d4af37", fontSize: "13px", margin: "0 0 12px" }}>Si el codigo es valido, se descuentan $5.000 al confirmar el pedido.</p>)}{user && referralCredit > 0 && !referralInput.trim() && (<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d4af37", fontSize: "14px", marginBottom: "12px" }}><input type="checkbox" checked={redeemReferralCredit} onChange={(e) => setRedeemReferralCredit(e.target.checked)} />Usar mi credito de referidos ($5.000 de descuento en esta compra)</label>)}
<button onClick={() => handleCheckout()} style={{ ...S.btn, display: "block", width: "100%", border: "none", textAlign: "center", padding: "12px", cursor: "pointer" }}>
Pedir por WhatsApp
</button>
<div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #2b2b2b" }}>
<div style={{ flex: 1, textAlign: "center", fontSize: "10px", color: "#bdbdbd" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto 4px" }}><path d="M20 6L9 17l-5-5"></path></svg>100% Original</div>
<div style={{ flex: 1, textAlign: "center", fontSize: "10px", color: "#bdbdbd" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto 4px" }}><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>Envio asegurado</div>

</div>
</div>
</>
)}
</div>
</div>
)}
{toast && (
<div style={S.toast}>{toast}</div>
)}
{cart.length > 0 && !showCart && (
<div className="gs-mobile-cart-bar" style={S.mobileCartBar} onClick={() => setShowCart(true)}>
<span style={S.mobileCartBarText}>{cart.reduce((a, i) => a + i.qty, 0)} {cart.reduce((a, i) => a + i.qty, 0) === 1 ? "producto" : "productos"} · {formatPrice(totalCart)}</span>
<span style={S.mobileCartBarBtn}>Ver carrito</span>
</div>
)}
<button className="gs-assistant-btn" style={S.assistantBtn} onClick={() => setAssistantOpen(!assistantOpen)} title="Asistente virtual">
<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
</button>
{assistantOpen && (
<div style={S.assistantPanel}>
<div style={S.assistantHeader}>
<strong style={{ fontSize: "14px" }}>Asistente Esencia Perfumeria</strong>
<button onClick={() => setAssistantOpen(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>x</button>
</div>
<div style={S.assistantBody}>
{assistantChat.map((m, i) => (
<div key={i} style={m.from === "bot" ? S.assistantBubbleBot : S.assistantBubbleUser}>{m.text}</div>
))}
</div>
<div style={S.assistantOptions}>
{assistantFaqs.map((faq, i) => (
<button key={i} style={S.assistantOptionBtn} onClick={() => askAssistant(faq)}>{faq.q}</button>
))}
<a href="https://wa.me/2914261941" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "9px 12px", fontSize: "13px", fontWeight: "700", borderRadius: "8px", background: "#25D366", color: "#fff", textDecoration: "none" }}>Hablar por WhatsApp</a>
</div>
</div>
)}
<footer style={S.footer}>
<div style={S.footerInner}>
<div>
<div style={S.footerBrand}>Esencia Perfumeria</div>
<p style={S.footerText}>Perfumes originales de diseñador y arabes en Bahia Blanca, con envios a todo el pais. Mas de 300 fragancias seleccionadas.</p>
<div style={S.footerTrustRow}>
<span style={S.footerTrustBadge}>✔ 100% Original</span>
<span style={S.footerTrustBadge}>🚚 Envios a todo el pais</span>
<span style={S.footerTrustBadge}>🔄 Cambios sin problema</span>
</div>
</div>
<div>
<div style={S.footerHeading}>Ayuda</div>
<a href="https://wa.me/2914261941" target="_blank" rel="noreferrer" style={S.footerLink}>Hacer un pedido por WhatsApp</a>
<a href="https://wa.me/2914261941?text=Hola!%20Tengo%20una%20consulta%20sobre%20un%20pedido" target="_blank" rel="noreferrer" style={S.footerLink}>Consultar sobre un pedido</a>
<a href="#" onClick={(e) => { e.preventDefault(); setAssistantOpen(true); }} style={S.footerLink}>Preguntas frecuentes</a>
<a href="#advFilterSection" style={S.footerLink}>Encontra tu perfume ideal</a>
</div>
<div>
<div style={S.footerHeading}>Contacto</div>
<a href="https://wa.me/2914261941" target="_blank" rel="noreferrer" style={S.footerLink}>WhatsApp: +54 9 291 426-1941</a>
<a href="https://www.instagram.com/esenciaperfumeria.bb/" target="_blank" rel="noreferrer" style={S.footerLink}>Instagram: @esenciaperfumeria.bb</a>
<span style={S.footerLink}>Bahia Blanca, Argentina</span>
</div>
<div>
<div style={S.footerHeading}>Compras</div>
<span style={S.footerLink}>Pago: coordinado por WhatsApp (efectivo, transferencia)</span>
<span style={S.footerLink}>Envio gratis dentro de Bahia Blanca</span>
<span style={S.footerLink}>Envios a todo el pais a coordinar</span>
</div>
</div>
<div style={S.footerBottom}>
<span>© {new Date().getFullYear()} Esencia Perfumeria. Todos los derechos reservados.</span>
<span>Precios en pesos argentinos. Stock sujeto a disponibilidad.</span>
</div>
</footer>
</div>
);
}
