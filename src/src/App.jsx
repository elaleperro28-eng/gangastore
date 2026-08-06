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

const ADMIN_PASSWORD = "ganga2024";
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
const [products, setProducts] = useState([]);
const [resenas, setResenas] = useState([]);
const [resenaForm, setResenaForm] = useState({ nombre: "", ciudad: "", estrellas: "5", texto: "", foto: "" });
const [resenaSaving, setResenaSaving] = useState(false);
const [resenaUploading, setResenaUploading] = useState(false);
const [tickerProducts, setTickerProducts] = useState([]);
const [cart, setCart] = useState([]);
const [showCart, setShowCart] = useState(false);
const [adminPass, setAdminPass] = useState("");
const [adminError, setAdminError] = useState("");
const [isAdmin, setIsAdmin] = useState(false);
const [filter, setFilter] = useState("todos");
const [searchQuery, setSearchQuery] = useState("");
const [advFilterOpen, setAdvFilterOpen] = useState(false);
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
similitud: "", stockBajo: "", etiquetas: []
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

useEffect(() => {
const q = query(collection(db, "productos"), orderBy("createdAt", "desc"));
const unsub = onSnapshot(q, (snap) => {
setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
setTickerProducts(shuffleArray(products.filter(isPerfume)));
}
}, [products.length]);

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

const handleAdminLogin = () => {
if (adminPass === ADMIN_PASSWORD) {
setIsAdmin(true);
setAdminError("");
setPage("admin");
} else {
setAdminError("Contrasena incorrecta");
}
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
categoria: form.categoria,
marca: form.marca || null,
genero: form.genero || null,
temporada: form.temporada || null,
tipoPerfume: form.tipoPerfume || null,
duracion: form.duracion || null,
notas: form.notas || null,
inspiradoEn: form.inspiradoEn || null,
similitud: form.similitud ? Number(form.similitud) : null, stockBajo: form.stockBajo ? Number(form.stockBajo) : null, etiquetas: form.etiquetas || []
};
if (editingId) {
await updateDoc(doc(db, "productos", editingId), productData);
setEditingId(null);
} else {
await addDoc(collection(db, "productos"), { ...productData, createdAt: serverTimestamp() });
}
setForm({ nombre: "", precio: "", precioOriginal: "", descripcion: "", imageUrl: "", foto2: "", foto3: "", fotoMano: "", fotoCaja: "", videoUrl: "", disponibilidad: "stock", diasHabiles: "3", categoria: "perfume", marca: "", genero: "", temporada: "", tipoPerfume: "", duracion: "", notas: "", inspiradoEn: "", similitud: "", stockBajo: "", etiquetas: [] });
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
similitud: p.similitud || "", stockBajo: p.stockBajo || "", etiquetas: p.etiquetas || []
});
window.scrollTo({ top: 0, behavior: "smooth" });
};

const handleCancelEdit = () => {
setEditingId(null);
setForm({ nombre: "", precio: "", precioOriginal: "", descripcion: "", imageUrl: "", foto2: "", foto3: "", fotoMano: "", fotoCaja: "", videoUrl: "", disponibilidad: "stock", diasHabiles: "3", categoria: "perfume", marca: "", genero: "", temporada: "", tipoPerfume: "", duracion: "", notas: "", inspiradoEn: "", similitud: "", stockBajo: "", etiquetas: [] });
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

const addToCart = (product) => {
setCart(c => {
const exists = c.find(i => i.id === product.id);
if (exists) return c.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
return [...c, { ...product, qty: 1 }];
});
};

const removeFromCart = (id) => setCart(c => c.filter(i => i.id !== id));
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
const handleCheckout = async () => {
let msg = "Hola! Quiero pedir: " + cart.map(i => getProductName(i) + " x" + i.qty).join(", ");
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
const totalConDescuento = Math.max(totalCart - usedDiscount, 0);
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
const totalAEnviar = Math.max(totalCart - usedDiscount, 0);
msg += " - Total: " + formatPrice(totalAEnviar);
window.location.href = "https://wa.me/2914261941?text=" + encodeURIComponent(msg);
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
const getProductDisp = (p) => p.disponibilidad || "stock";
const getProductDias = (p) => p.diasHabiles || "3-5";
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

const assistantFaqs = [
{ q: "Como comprar", a: "Elegi el producto que te guste, toca 'Agregar al Carrito' y despues 'Pedir por WhatsApp' para confirmar el pedido. Asi de facil!" },
{ q: "Envios", a: "Hacemos envio gratis dentro de Bahia Blanca. Tambien enviamos a todo el pais, coordinando el costo por WhatsApp." },
{ q: "Formas de pago", a: "Coordinamos la forma de pago (efectivo, transferencia, etc.) directamente por WhatsApp para confirmarte todas las opciones disponibles." },
{ q: "Stock y por pedido", a: "Los productos 'En Stock' se entregan de inmediato. Los que dicen 'Por Pedido' muestran en su tarjeta cuantos dias habiles tardan en llegar." },
{ q: "No encuentro lo que busco", a: "No hay problema! Si no encontras el producto que buscas, sea perfumeria, tecnologia o cualquier otra cosa, escribinos por WhatsApp contandonos que necesitas y te ayudamos a conseguirlo o pedirlo especialmente para vos." },
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

let filteredProducts = products.filter(p => {

const q = searchQuery.trim();
if (q) {
if (smartProductScore(p, q) <= 0) return false;
}
if (filter === "stock") return getProductDisp(p) === "stock";
if (filter === "pedido") return getProductDisp(p) === "pedido";
if (filter === "perfumes") return isPerfume(p);
if (filter === "gangatech") return !isPerfume(p); if (filter === "menos100k") return getProductPrice(p) < 100000; if (filter === "arabes") return (p.tipoPerfume || "") === "arabe"; if (filter === "disenador") return (p.tipoPerfume || "") === "disenador"; if (["mas_vendidos","novedades","larga_duracion","para_regalar","top_invierno","top_verano","top_oficina","top_citas"].includes(filter)) return (p.etiquetas || []).includes(filter);
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
navPromo: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontFamily: "'Playfair Display', serif", fontWeight: "700", fontSize: "13px", letterSpacing: "1px", textAlign: "center", maxWidth: "55%" },
hero: { textAlign: "center", padding: "130px 20px 100px", backgroundImage: "linear-gradient(rgba(10,10,10,0.6), rgba(10,10,10,0.72)), url('https://images.unsplash.com/photo-1622618991746-fe6004db3a47?q=80&w=1920&auto=format&fit=crop')", backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" },
heroTag: { fontSize: "15px", color: "#ffffff", letterSpacing: "4px", textTransform: "uppercase", marginBottom: "16px", fontWeight: "700", textShadow: "0 2px 12px rgba(0,0,0,0.7)" },
heroMainTitle: { fontSize: "clamp(32px,6vw,58px)", fontWeight: 800, color: "#fff", textTransform: "uppercase", margin: "10px 0", lineHeight: 1.15 }, heroBtnRow: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 22 }, heroBtnPrimary: { background: "#d4af37", color: "#1a1a1a", border: "none", padding: "16px 36px", fontSize: 18, fontWeight: 800, borderRadius: 8, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }, heroBtnSecondary: { background: "transparent", color: "#fff", border: "2px solid #fff", padding: "16px 36px", fontSize: 16, fontWeight: 700, borderRadius: 8, cursor: "pointer", textTransform: "uppercase", letterSpacing: 1 }, heroTitle: { fontSize: "clamp(28px,5vw,52px)", fontWeight: "700", margin: "0 16px 14px", fontFamily: "'Playfair Display', serif", color: "#d4af37" },
heroSub: { fontSize: "18px", color: "#ffffff", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 8px", maxWidth: "620px", marginLeft: "auto", marginRight: "auto", lineHeight: "1.7", textShadow: "0 2px 12px rgba(0,0,0,0.7)" },
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
grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "30px" },
card: { background: "#1a1a1a", borderRadius: "12px", overflow: "hidden", border: "1px solid #2b2b2b", cursor: "pointer" },
cardImg: { width: "100%", aspectRatio: "4/5", objectFit: "contain", background: "#fff", display: "block", padding: "14px", boxSizing: "border-box" },
cardBody: { padding: "14px" },
cardName: { fontSize: "15px", fontWeight: "700", marginBottom: "6px", color: "#ffffff" },
cardPrice: { fontSize: "16px", fontWeight: "900", color: "#d4af37", marginBottom: "8px" },
originalPrice: { fontSize: "13px", color: "#999", textDecoration: "line-through", marginRight: "8px" },
discountBadge: { display: "inline-block", background: "#cc0000", color: "#fff", padding: "2px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", marginLeft: "0px" },
badgeStock: { display: "inline-block", background: "#1a1a1a", color: "#d4af37", padding: "3px 10px", borderRadius: "20px", fontSize: "12px" },
urgencyBadge: { display: "inline-block", background: "#c0392b", color: "#ffffff", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700", marginTop: "4px" },
resenaCard: { background: "#ffffff", borderRadius: "12px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", border: "1px solid #e8ddc0" },
resenaFoto: { width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: "2px solid #d4af37" },
resenaAvatar: { width: "48px", height: "48px", borderRadius: "50%", background: "#d4af37", color: "#000000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "18px" },
badgePedido: { display: "inline-block", background: "#1a1a1a", color: "#ffffff", padding: "3px 10px", borderRadius: "20px", fontSize: "12px" },
modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 100 },
modalBox: { background: "#1a1a1a", borderRadius: "16px", maxWidth: "500px", width: "100%", padding: "24px", position: "relative", maxHeight: "90vh", overflowY: "auto", border: "1px solid #2b2b2b" },
modalImg: { width: "100%", maxHeight: "360px", objectFit: "contain", background: "#fff", borderRadius: "10px", marginBottom: "16px", display: "block" },
specsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", margin: "18px 0", padding: "18px", background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "12px" },
specItem: { display: "flex", alignItems: "flex-start", gap: "10px" },
specIcon: { fontSize: "20px", lineHeight: "1", marginTop: "1px" },
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
};

if (page === "adminLogin") {
return (
<div style={S.loginWrap}>
<div style={S.loginBox}>
<div style={{ fontSize: "42px", marginBottom: "16px" }}>&#128274;</div>
<h2 style={{ color: "#d4af37", marginBottom: "8px", fontFamily: "'Playfair Display', serif" }}>Panel Administrador</h2>
<p style={{ color: "#bdbdbd", marginBottom: "28px" }}>Ingresa la contrasena para acceder</p>
<input type="password" placeholder="Contrasena" value={adminPass} onChange={e => setAdminPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} style={{ ...S.input, marginBottom: "16px", textAlign: "center" }} />
{adminError && <p style={{ color: "#ff4444", marginBottom: "12px" }}>{adminError}</p>}
<button onClick={handleAdminLogin} style={{ ...S.btn, width: "100%", padding: "12px" }}>Ingresar</button>
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
<button onClick={() => { setIsAdmin(false); setPage("adminLogin"); }} style={S.btnGray}>Cerrar Sesion</button>
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
<label style={S.label}>Categoria *</label>
<select style={{ ...S.select, marginBottom: "16px" }} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
<option value="perfume">Perfume</option>
<option value="tecnologia">Tecnologia</option>
<option value="otro">Otro</option>
</select>
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
<img src={getProductImage(p)} alt={getProductName(p)} style={{ width: "80px", height: "80px", objectFit: "contain", background: "#fff", borderRadius: "8px", flexShrink: 0 }} />
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
<style>{`@media (max-width: 700px) { .gs-nav { position: sticky !important; top: 0 !important; z-index: 80 !important; flex-wrap: wrap !important; row-gap: 8px !important; padding: 10px 12px !important; } .gs-nav-promo { position: static !important; left: auto !important; top: auto !important; transform: none !important; order: 3 !important; width: 100% !important; max-width: 100% !important; text-align: center !important; font-size: 11px !important; } .gs-nav-cart-btn { position: static !important; top: auto !important; right: auto !important; padding: 8px 12px !important; font-size: 13px !important; } .gs-nav-account-btn { position: static !important; top: auto !important; right: auto !important; padding: 8px 12px !important; font-size: 13px !important; } }`}</style>
<div style={S.nav} className="gs-nav">
<div style={S.navPromo} className="gs-nav-promo"><span style={{ color: "#d4af37" }}>PERFUMES ORIGINALES</span> / <span style={{ color: "#ffffff" }}>APROVECHA CODIGO PROMOCIONAL</span></div>
<button onClick={() => { setAccountError(""); setShowAccountModal(true); }} style={S.navAccountBtn} className="gs-nav-account-btn">{user ? "Mi Cuenta" : "Ingresar"}</button>
<button onClick={() => setShowCart(true)} style={S.navCartBtn} className="gs-nav-cart-btn">Carrito ({cart.length})</button>
</div>
<div style={S.hero}>
<div style={S.heroTag}>PERFUMES ORIGINALES</div>
<h1 style={S.heroMainTitle}>Más de 300 fragancias</h1><p style={S.heroSub}>Diseñador · Árabes · Nicho</p><p style={S.heroSub}>Envío gratis a Bahía Blanca - Envíos a todo el país</p><p style={S.heroSub}>Más de 500 clientes</p><div style={S.heroBtnRow}><button style={S.heroBtnPrimary} onClick={() => { setFilter("perfumes"); setTimeout(() => document.getElementById("productsSection")?.scrollIntoView({ behavior: "smooth" }), 60); }}>Ver Perfumes</button><button style={S.heroBtnSecondary} onClick={() => { setAdvFilterOpen(true); setTimeout(() => document.getElementById("advFilterSection")?.scrollIntoView({ behavior: "smooth" }), 60); }}>Elegí según tu personalidad</button></div>
</div>
<div style={S.tickerSection}>
<style>{`@keyframes gangaTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } } @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } } .product-card { transition: transform 0.3s ease, box-shadow 0.3s ease; animation: fadeInUp 0.6s ease both; } .product-card:hover, .product-card:active { transform: translateY(-6px); box-shadow: 0 14px 28px rgba(212,175,55,0.18); }`}</style>
<div style={S.tickerTrack}>
{[...tickerProducts, ...tickerProducts].map((p, i) => (
<div key={i} className="product-card" style={S.tickerItem} onClick={() => setSelectedProduct(p)}>
<img src={getProductImage(p)} alt={getProductName(p)} style={S.cardImg} onError={(e) => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
<div style={S.cardBody}>
<div style={S.cardName}>{getProductName(p)}</div>
<div style={S.cardPrice}>
{getDiscountPercent(p) && <span style={S.originalPrice}>{formatPrice(getProductOriginalPrice(p))}</span>}
{formatPrice(getProductPrice(p))}
{getDiscountPercent(p) && <span style={S.discountBadge}>-{getDiscountPercent(p)}%</span>}
</div>
{getProductDisp(p) === "stock"
? <span style={S.badgeStock}>En Stock</span>
: <span style={S.badgePedido}>Por Pedido: {getProductDias(p)} dias hab.</span>
}
{getUrgencyMsg(p) && <div style={S.urgencyBadge}>🔥 {getUrgencyMsg(p)}</div>}
<br />
<button style={{ ...S.btn, width: "100%", marginTop: "10px" }} onClick={e => { e.stopPropagation(); addToCart(p); }}>Agregar al Carrito</button>
</div>
</div>
))}
</div>
</div>
<div style={S.loyaltySection} id="loyaltySection"><div style={S.loyaltyCard}><div style={S.loyaltyTitle}>Programa de Fidelizacion Esencia Perfumeria</div><p style={{ color: "#fff", maxWidth: 560, margin: "0 auto" }}>Cada compra suma puntos! Por cada $100.000 de compra sumas 100 puntos, y con 300 puntos obtenes $10.000 de descuento en tu proximo pedido.</p><div style={S.loyaltyGrid}><div style={S.loyaltyStep}><div style={{ color: "#d4af37", fontWeight: 700, marginBottom: 4 }}>1. Compra</div><div style={{ color: "#bdbdbd", fontSize: 13 }}>Crea tu cuenta con tu correo y compra tus perfumes favoritos.</div></div><div style={S.loyaltyStep}><div style={{ color: "#d4af37", fontWeight: 700, marginBottom: 4 }}>2. Suma puntos</div><div style={{ color: "#bdbdbd", fontSize: 13 }}>$100.000 de compra = 100 puntos acumulados a tu cuenta.</div></div><div style={S.loyaltyStep}><div style={{ color: "#d4af37", fontWeight: 700, marginBottom: 4 }}>3. Canjea</div><div style={{ color: "#bdbdbd", fontSize: 13 }}>300 puntos = $10.000 de descuento en tu proximo pedido.</div></div></div><div style={{ marginTop: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>{user ? (<><p style={{ color: "#bdbdbd", fontSize: 13, margin: 0 }}>Conectado como {user.email}</p>{customerPoints !== null && (<p style={{ color: "#d4af37", fontWeight: 700, margin: 0 }}>Tenes {customerPoints} puntos = {formatPrice(pointsToDiscount(customerPoints))} de descuento disponible</p>)}<button style={S.btnOutline} onClick={() => loadMyPoints(user.uid)} disabled={pointsLoading}>{pointsLoading ? "Consultando..." : "Actualizar mis puntos"}</button></>) : (<><p style={{ color: "#bdbdbd", fontSize: 14, margin: 0 }}>Inicia sesion con tu correo para ver y usar tus puntos.</p><button style={S.btn} onClick={() => { setAccountMode("login"); setAccountError(""); setShowAccountModal(true); }}>Ingresar / Crear cuenta</button></>)}</div></div></div><div style={S.section} id="productsSection">
<div style={S.sectionTitle}>Productos Disponibles</div>
<div style={S.searchWrap}>
<svg style={S.searchIconSvg} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
<input type="text" placeholder="Ej: perfume dulce, para verano, parecido a Sauvage..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={S.searchInput} />
</div>
<div style={S.filterBar}>
<button style={S.filterBtnPrimary(filter === "todos")} onClick={() => setFilter("todos")}>Todos</button>
<button style={S.filterBtnPrimary(filter === "perfumes")} onClick={() => setFilter("perfumes")}>Perfumes</button>
<button style={S.filterBtnPrimary(filter === "stock")} onClick={() => setFilter("stock")}>En Stock</button>
<button style={S.filterBtnPrimary(filter === "pedido")} onClick={() => setFilter("pedido")}>Por Pedido</button>
<button style={S.filterBtnPrimary(filter === "gangatech")} onClick={() => setFilter("gangatech")}>Ganga Tech</button></div><div style={S.filterBar}><button style={S.filterBtn(filter === "mas_vendidos")} onClick={() => setFilter("mas_vendidos")}>Mas Vendidos</button><button style={S.filterBtn(filter === "novedades")} onClick={() => setFilter("novedades")}>Novedades</button><button style={S.filterBtn(filter === "larga_duracion")} onClick={() => setFilter("larga_duracion")}>Larga Duracion</button><button style={S.filterBtn(filter === "menos100k")} onClick={() => setFilter("menos100k")}>Menos de $100.000</button><button style={S.filterBtn(filter === "arabes")} onClick={() => setFilter("arabes")}>Perfumes Arabes</button><button style={S.filterBtn(filter === "disenador")} onClick={() => setFilter("disenador")}>Perfumes de Disenador</button><button style={S.filterBtn(filter === "para_regalar")} onClick={() => setFilter("para_regalar")}>Para Regalar</button><button style={S.filterBtn(filter === "top_invierno")} onClick={() => setFilter("top_invierno")}>Top Invierno</button><button style={S.filterBtn(filter === "top_verano")} onClick={() => setFilter("top_verano")}>Top Verano</button><button style={S.filterBtn(filter === "top_oficina")} onClick={() => setFilter("top_oficina")}>Top Oficina</button><button style={S.filterBtn(filter === "top_citas")} onClick={() => setFilter("top_citas")}>Top Citas</button>
</div>
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
<div style={S.grid}>
{filteredProducts.map(product => (
<div key={product.id} className="product-card" style={S.card} onClick={() => setSelectedProduct(product)}>
<img src={getProductImage(product)} alt={getProductName(product)} style={S.cardImg} onError={e => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
<div style={S.cardBody}>
<div style={S.cardName}>{getProductName(product)}</div>
<div style={S.cardPrice}>
{getDiscountPercent(product) && <span style={S.originalPrice}>{formatPrice(getProductOriginalPrice(product))}</span>}
{formatPrice(getProductPrice(product))}
{getDiscountPercent(product) && <span style={S.discountBadge}>-{getDiscountPercent(product)}%</span>}
</div>
{getProductDisp(product) === "stock"
? <span style={S.badgeStock}>En Stock</span>
: <span style={S.badgePedido}>Por Pedido: {getProductDias(product)} dias hab.</span>
}
{getUrgencyMsg(product) && <div style={S.urgencyBadge}>🔥 {getUrgencyMsg(product)}</div>}
<br />
<button style={{ ...S.btn, width: "100%", marginTop: "10px" }} onClick={e => { e.stopPropagation(); addToCart(product); }}>Agregar al Carrito</button>
</div>
</div>
))}
{filteredProducts.length === 0 && <p style={{ color: "#bdbdbd", gridColumn: "1/-1" }}>No hay productos en esta categoria.</p>}
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
<img src={r.foto} alt={r.nombre} style={S.resenaFoto} />
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
<img src={modalActiveImg || getProductImage(selectedProduct)} alt={getProductName(selectedProduct)} style={S.modalImg} />
{[selectedProduct.imageUrl, selectedProduct.foto2, selectedProduct.foto3, selectedProduct.fotoMano, selectedProduct.fotoCaja].filter(Boolean).length > 1 && (
<div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto" }}>
{[selectedProduct.imageUrl, selectedProduct.foto2, selectedProduct.foto3, selectedProduct.fotoMano, selectedProduct.fotoCaja].filter(Boolean).map((src, i) => (
<img key={i} src={src} onClick={() => setModalActiveImg(src)} style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "6px", cursor: "pointer", border: (modalActiveImg || getProductImage(selectedProduct)) === src ? "2px solid #d4af37" : "2px solid transparent", flexShrink: 0, background: "#fff" }} />
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
? <span style={S.badgeStock}>En Stock - Disponible ahora</span>
: <span style={S.badgePedido}>Por Pedido: {getProductDias(selectedProduct)} dias habiles</span>
}
{getUrgencyMsg(selectedProduct) && <div style={{ ...S.urgencyBadge, marginTop: "8px" }}>🔥 {getUrgencyMsg(selectedProduct)}</div>}
{(selectedProduct.marca || selectedProduct.genero || selectedProduct.tipoPerfume || selectedProduct.temporada || selectedProduct.duracion || selectedProduct.notas) && (
<div style={S.specsGrid}>
{selectedProduct.marca && (
<div style={S.specItem}><span style={S.specIcon}>&#128142;</span><div><div style={S.specLabel}>Marca</div><div style={S.specValue}>{selectedProduct.marca}</div></div></div>
)}
{selectedProduct.genero && (
<div style={S.specItem}><span style={S.specIcon}>&#128694;</span><div><div style={S.specLabel}>Genero</div><div style={S.specValue}>{generoLabel(selectedProduct.genero)}</div></div></div>
)}
{selectedProduct.tipoPerfume && (
<div style={S.specItem}><span style={S.specIcon}>&#127991;&#65039;</span><div><div style={S.specLabel}>Tipo</div><div style={S.specValue}>{tipoLabel(selectedProduct.tipoPerfume)}</div></div></div>
)}
{selectedProduct.temporada && (
<div style={S.specItem}><span style={S.specIcon}>&#127780;&#65039;</span><div><div style={S.specLabel}>Temporada ideal</div><div style={S.specValue}>{temporadaLabel(selectedProduct.temporada)}</div></div></div>
)}
{selectedProduct.duracion && (
<div style={S.specItem}><span style={S.specIcon}>&#9203;</span><div><div style={S.specLabel}>Duracion</div><div style={S.specValue}>{selectedProduct.duracion}</div></div></div>
)}
{selectedProduct.notas && (
<div style={S.specItem}><span style={S.specIcon}>&#127804;</span><div><div style={S.specLabel}>Notas olfativas</div><div style={S.specValue}>{selectedProduct.notas}</div></div></div>
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
<img src={getProductImage(item)} alt={getProductName(item)} style={{ width: "60px", height: "60px", objectFit: "contain", background: "#fff", borderRadius: "6px" }} />
<div style={{ flex: 1 }}>
<div style={{ fontWeight: "bold", fontSize: "14px" }}>{getProductName(item)}</div>
<div style={{ color: "#d4af37" }}>{formatPrice(getProductPrice(item))} x{item.qty}</div>
</div>
<button onClick={() => removeFromCart(item.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "4px", cursor: "pointer" }}>x</button>
</div>
))}
<div style={{ borderTop: "1px solid #2b2b2b", paddingTop: "16px", marginTop: "16px" }}>
<div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>Total: {formatPrice(finalTotal)}{discountFromPoints > 0 && <span style={{ color: "#d4af37", fontSize: 13, display: "block" }}>(incluye descuento de {formatPrice(discountFromPoints)} por puntos)</span>}</div><div style={S.cartPointsBox}><input type="text" placeholder="Tu telefono de contacto (opcional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={{ ...S.input, marginBottom: 8 }} />{user ? (<>{customerPoints !== null && (<div style={{ color: "#d4af37", fontSize: 13 }}>Tenes {customerPoints} puntos ({formatPrice(pointsToDiscount(customerPoints))} disponibles){pointsToDiscount(customerPoints) > 0 && (<label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: "#fff" }}><input type="checkbox" checked={redeemPoints} onChange={e => setRedeemPoints(e.target.checked)} />Usar mis puntos en este pedido</label>)}</div>)}<button style={{ ...S.btnOutline, width: "100%", marginTop: 8 }} onClick={() => loadMyPoints(user.uid)} disabled={pointsLoading}>{pointsLoading ? "Consultando..." : "Actualizar mis puntos"}</button></>) : (<button style={{ ...S.btnOutline, width: "100%" }} onClick={() => { setAccountMode("login"); setAccountError(""); setShowAccountModal(true); }}>Ingresa para sumar/usar puntos</button>)}</div>
<input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Codigo promocional (opcional)" style={{ width: "100%", padding: "10px", marginBottom: "12px", borderRadius: "6px", border: "1px solid #2b2b2b", background: "#1a1a1a", color: "#fff", fontSize: "14px", boxSizing: "border-box" }} />
<input type="text" value={referralInput} onChange={(e) => setReferralInput(e.target.value)} placeholder="Codigo de referido de un amigo (opcional)" style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "6px", border: "1px solid #2b2b2b", background: "#1a1a1a", color: "#fff", fontSize: "14px", boxSizing: "border-box" }} />{referralInput.trim() && (<p style={{ color: "#d4af37", fontSize: "13px", margin: "0 0 12px" }}>Si el codigo es valido, se descuentan $5.000 al confirmar el pedido.</p>)}{user && referralCredit > 0 && !referralInput.trim() && (<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d4af37", fontSize: "14px", marginBottom: "12px" }}><input type="checkbox" checked={redeemReferralCredit} onChange={(e) => setRedeemReferralCredit(e.target.checked)} />Usar mi credito de referidos ($5.000 de descuento en esta compra)</label>)}
<button onClick={handleCheckout} style={{ ...S.btn, display: "block", width: "100%", border: "none", textAlign: "center", padding: "12px", cursor: "pointer" }}>
Pedir por WhatsApp
</button>
</div>
</>
)}
</div>
</div>
)}
<button style={S.assistantBtn} onClick={() => setAssistantOpen(!assistantOpen)} title="Asistente virtual">
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
</div>
);
}
