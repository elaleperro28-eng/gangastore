import { useState, useEffect, useRef, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, getDoc, setDoc, where, getDocs, limit } from "firebase/firestore";

const firebaseConfig = {
apiKey: "AIzaSyAQlmsNO4bF9SVfwrcK6_-HJ_KFrcjTINg",
authDomain: "gangastore.firebaseapp.com",
projectId: "gangastore",
storageBucket: "gangastore.firebasestorage.app",
messagingSenderId: "167884959340",
appId: "1:167884959340:web:0cd7f22b3506eff1c3b249"
};

const app = initializeApp(firebaseConfig);
// Cache local (IndexedDB): en visitas repetidas el catalogo se pinta al instante
// desde el cache mientras Firestore sincroniza los cambios en segundo plano.
// Los listeners en tiempo real (onSnapshot) siguen funcionando igual que antes,
// asi que el stock/precio se sigue actualizando en vivo.
const db = initializeFirestore(app, {
localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
});
// firebase/auth (~53kb gzip) se carga bajo demanda para achicar el bundle inicial:
// la primera pantalla (grilla de productos) no depende de auth, solo el login/cuenta/admin.
let authModPromise = null;
const loadAuthMod = () => {
if (!authModPromise) authModPromise = import("firebase/auth");
return authModPromise;
};

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
const BANK_TRANSFER_INFO = { banco: "Banco Galicia", titular: "Alejo Francisco Ciulo", cuil: "20-46743275-4", cbu: "0070082530004087084624", alias: "Teatro.ale" };
const FREE_SHIPPING_THRESHOLD = 150000;
const DECANT_COMBO_MIN = 3;
const DECANT_COMBO_DISCOUNT_PCT = 0.10;
const QUIZ_QUESTIONS = [
{ key: "genero", pregunta: "¿Para quién es el perfume?", opciones: [
{ value: "femenino", label: "Para ella" },
{ value: "masculino", label: "Para él" },
{ value: "unisex", label: "Unisex / no importa" },
]},
{ key: "ocasion", pregunta: "¿Para qué ocasión lo vas a usar más?", opciones: [
{ value: "top_oficina", label: "Día a día / oficina" },
{ value: "top_citas", label: "Salidas de noche" },
{ value: "para_regalar", label: "Es para regalar" },
{ value: "", label: "Un poco de todo" },
]},
{ key: "aroma", pregunta: "¿Qué tipo de aroma te gusta más?", opciones: [
{ value: "dulce", label: "Dulce y goloso (vainilla, caramelo, frutal)" },
{ value: "amaderado", label: "Amaderado e intenso (oud, cuero, especias)" },
{ value: "fresco", label: "Fresco y cítrico (verde, marino, cítricos)" },
{ value: "floral", label: "Floral suave (rosas, jazmín, flores blancas)" },
]},
{ key: "tipo", pregunta: "¿Preferís perfumes de diseñador o árabes?", opciones: [
{ value: "disenador", label: "Diseñador (marcas clásicas)" },
{ value: "arabe", label: "Árabes (más intensos y duraderos)" },
{ value: "", label: "Me da igual, quiero el mejor match" },
]},
];
const AROMA_KEYWORDS = {
dulce: ["vainilla", "dulce", "caramelo", "gourmand", "frutal", "chocolate", "miel", "praline", "azucar"],
amaderado: ["amaderado", "madera", "oud", "cuero", "especia", "especiado", "ambar", "sandalo", "tabaco"],
fresco: ["fresco", "citrico", "citricos", "marino", "acuatico", "verde", "menta", "bergamota"],
floral: ["floral", "flores", "rosa", "jazmin", "azahar", "peonia", "lavanda"],
};
const MAX_CART_QTY = 20;
// Para cantidades cargadas (localStorage/Firestore) o sumadas: nunca menos de 1 ni mas del maximo.
const clampQty = (q) => { const n = Number(q); if (!Number.isFinite(n) || n < 1) return 1; return Math.min(Math.floor(n), MAX_CART_QTY); };
// Para +/- en el carrito: solo topea el maximo, deja pasar 0 o negativos para poder quitar el producto.
const capQtyDelta = (q) => { const n = Number(q); if (!Number.isFinite(n)) return 0; return Math.min(Math.floor(n), MAX_CART_QTY); };
const IMGUR_CLIENT_ID = "546c25a59c58ad7"; const TAG_OPTIONS = [{ key: "cosmeticos", label: "Cosmeticos" }, { key: "mas_vendidos", label: "Mas vendidos" }, { key: "novedades", label: "Novedades" }, { key: "larga_duracion", label: "Larga duracion" }, { key: "para_regalar", label: "Para regalar" }, { key: "top_invierno", label: "Top invierno" }, { key: "top_verano", label: "Top verano" }, { key: "top_oficina", label: "Top oficina" }, { key: "top_citas", label: "Top citas" }, { key: "tendencia_floral_frutal", label: "Tendencia: Floral frutal" }, { key: "tendencia_gourmand_tostado", label: "Tendencia: Gourmand tostado" }, { key: "tendencia_verde_te", label: "Tendencia: Verde / Te" }, { key: "tendencia_almizclado_piel", label: "Tendencia: Almizclado piel" }, { key: "tendencia_gourmand_oscuro", label: "Tendencia: Gourmand oscuro" }];
const shuffleArray = (arr) => {
const a = [...arr];
for (let i = a.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[a[i], a[j]] = [a[j], a[i]];
}
return a;
};
// Categorias que el admin puede elegir para mostrar primero en el catalogo
// (panel "Orden del catalogo"). El value combina el campo del producto y el
// valor a priorizar, separados por ":".
const CATALOG_ORDER_CATEGORIES = [
{ value: "temporada:verano", label: "Verano" },
{ value: "temporada:invierno", label: "Invierno" },
{ value: "temporada:todo_anio", label: "Todo el ano" },
{ value: "genero:masculino", label: "Hombre" },
{ value: "genero:femenino", label: "Mujer" },
{ value: "genero:unisex", label: "Unisex" },
{ value: "tipoPerfume:arabe", label: "Arabes" },
{ value: "tipoPerfume:disenador", label: "Disenador" },
{ value: "etiqueta:mas_vendidos", label: "Mas vendidos" },
];

export default function App() {
const [page, setPage] = useState(() => {
const path = window.location.pathname;
if (path === "/admin-login" || path === "/admin-login/") return "adminLogin";
if (path === "/devoluciones" || path === "/devoluciones/") return "devoluciones";
if (path === "/opinar" || path === "/opinar/") return "opinar";
if (path === "/blog" || path === "/blog/") return "blog";
if (path.startsWith("/blog/")) return "blogPost";
return "home";
});
// Si la URL inicial es "/blog/<slug>", guardamos el slug UNA sola vez para
// abrir esa nota apenas se terminen de cargar las notas del blog (mismo
// truco que initialDeepLinkPidRef con los productos).
const initialBlogSlugRef = useRef((() => {
const m = window.location.pathname.match(/^\/blog\/([^/]+)\/?$/);
return m ? decodeURIComponent(m[1]) : null;
})());
const [isMobileHero, setIsMobileHero] = useState(() => typeof window !== "undefined" && window.innerWidth <= 700);
const [products, setProducts] = useState([]);  const [productsLoading, setProductsLoading] = useState(true);
const [resenas, setResenas] = useState([]);
const [resenaForm, setResenaForm] = useState({ nombre: "", ciudad: "", estrellas: "5", texto: "", foto: "" });
const [resenaSaving, setResenaSaving] = useState(false);
const [resenaUploading, setResenaUploading] = useState(false);
// Reseñas que dejan los clientes ellos mismos desde el link publico "/opinar"
// (a diferencia de resenaForm, que es el formulario que usa el ADMIN para
// cargar una resena manualmente). Estas quedan en estado "pendiente" hasta
// que el admin las aprueba desde el panel.
const [opinionForm, setOpinionForm] = useState({ nombre: "", ciudad: "", estrellas: "5", texto: "", foto: "" });
const [opinionUploading, setOpinionUploading] = useState(false);
const [opinionSaving, setOpinionSaving] = useState(false);
const [opinionSent, setOpinionSent] = useState(false);
const [opinionError, setOpinionError] = useState("");
// --- Blog (notas de contenido para SEO: guias de compra, notas olfativas, etc) ---
const [blogPosts, setBlogPosts] = useState([]);
const [blogForm, setBlogForm] = useState({ titulo: "", slug: "", resumen: "", contenido: "", imagen: "", categoria: "guia-compra", publicado: false });
const [editingBlogSlug, setEditingBlogSlug] = useState(null);
const [blogSaving, setBlogSaving] = useState(false);
const [blogUploading, setBlogUploading] = useState(false);
const [selectedBlogPost, setSelectedBlogPost] = useState(null);
// Panel admin: generar/enviar el link de "dejanos tu opinion" a un cliente puntual.
const [reviewRequestName, setReviewRequestName] = useState("");
const [reviewRequestPhone, setReviewRequestPhone] = useState("");
// Panel admin: clientes con puntos/credito de fidelizacion sin canjear, para
// mandarles un recordatorio por WhatsApp (se carga solo si isAdmin, ver mas abajo).
const [customersWithPoints, setCustomersWithPoints] = useState([]);
const [tickerProducts, setTickerProducts] = useState([]);
const [cart, setCart] = useState(() => {
  try {
    const parsed = JSON.parse(localStorage.getItem("carritoEsencia") || "[]");
    return Array.isArray(parsed) ? parsed.map(i => ({ ...i, qty: clampQty(i.qty) })) : [];
  } catch { return []; }
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
const [recentlyViewedOpen, setRecentlyViewedOpen] = useState(false);
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
const [promoCode, setPromoCode] = useState(""); const [customerPhone, setCustomerPhone] = useState(""); const [customerName, setCustomerName] = useState(() => { try { return localStorage.getItem("nombreEsencia") || ""; } catch { return ""; } }); const [customerAddress, setCustomerAddress] = useState(() => { try { return localStorage.getItem("direccionEsencia") || ""; } catch { return ""; } }); const [checkoutError, setCheckoutError] = useState(""); const [customerPoints, setCustomerPoints] = useState(null); const [pointsLoading, setPointsLoading] = useState(false); const [redeemPoints, setRedeemPoints] = useState(false);
const [isGift, setIsGift] = useState(false); const [giftMessage, setGiftMessage] = useState(""); const [hideGiftPrice, setHideGiftPrice] = useState(false); const [giftWrap, setGiftWrap] = useState(false);
const [paymentMethod, setPaymentMethod] = useState(""); // "transferencia" | "efectivo" - obligatorio elegir antes de pedir por WhatsApp
const [showQuiz, setShowQuiz] = useState(false);
const [quizStep, setQuizStep] = useState(0);
const [quizAnswers, setQuizAnswers] = useState({ genero: "", ocasion: "", aroma: "", tipo: "" });
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
notasSalida: "", notasCorazon: "", notasFondo: "",
inspiradoEn: "",
similitud: "", stockBajo: "", etiquetas: [], precioDecant5: "", precioDecant10: ""
});
const [uploading, setUploading] = useState(false);
const [uploadMsg, setUploadMsg] = useState("");
const [uploadingField, setUploadingField] = useState(null);
const [showBulkUpload, setShowBulkUpload] = useState(false);
const [bannerForm, setBannerForm] = useState(null);
const [bannerSaving, setBannerSaving] = useState(false);
const [catalogOrderForm, setCatalogOrderForm] = useState(null);
const [catalogOrderSaving, setCatalogOrderSaving] = useState(false);
const [catalogManualSearch, setCatalogManualSearch] = useState("");
const [cupones, setCupones] = useState([]);
const [cuponForm, setCuponForm] = useState({ codigo: "", tipo: "porcentaje", valor: "", minCompra: "", fechaExpiracion: "" });
const [cuponSaving, setCuponSaving] = useState(false);
const [newsletterEmail, setNewsletterEmail] = useState("");
const [newsletterSaving, setNewsletterSaving] = useState(false);
const [newsletterSubs, setNewsletterSubs] = useState([]);
// Popup de bienvenida con descuento a cambio del email: se muestra una sola
// vez por navegador (localStorage), a los pocos segundos de entrar, para que
// sumarse a la lista se sienta como parte de la visita y no como una molestia
// apenas se carga la pagina.
const [welcomePopupOpen, setWelcomePopupOpen] = useState(false);
const [welcomePopupPhone, setWelcomePopupPhone] = useState("");
const [welcomePopupSaving, setWelcomePopupSaving] = useState(false);
const [welcomePopupDone, setWelcomePopupDone] = useState(false);
const WELCOME_COUPON_CODE = "BIENVENIDO05";
const [reviewNoticeIdx, setReviewNoticeIdx] = useState(null);
const [showCartReminder, setShowCartReminder] = useState(false);
const [pedidos, setPedidos] = useState([]);
const [hoverVentaDia, setHoverVentaDia] = useState(null);
// El banner y el orden del catalogo son documentos especiales guardados en la
// coleccion "productos" (mismas reglas de Firestore que ya existen: lectura
// publica, escritura solo admin), pero se leen con su propio listener en vez
// de buscarlos dentro de "products": esa lista viene de una consulta con
// orderBy("createdAt"), y Firestore excluye de un orderBy cualquier documento
// que no tenga ese campo (estos documentos de configuracion no lo tienen), asi
// que nunca aparecian ahi aunque se hubieran guardado bien.
const [bannerConfig, setBannerConfig] = useState(null);
const [catalogOrderConfig, setCatalogOrderConfig] = useState(null);
const [bannerDismissed, setBannerDismissed] = useState(() => {
  try { return sessionStorage.getItem("esenciaBannerDismissed") === "1"; } catch { return false; }
});
const [nowTick, setNowTick] = useState(() => Date.now());
useEffect(() => {
  const t = setInterval(() => setNowTick(Date.now()), 60000);
  return () => clearInterval(t);
}, []);
const [bulkRows, setBulkRows] = useState([]);
const [bulkImagesCount, setBulkImagesCount] = useState(0);
const [bulkPublishing, setBulkPublishing] = useState(false);
const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
const [bulkResults, setBulkResults] = useState([]);
const bulkFilesRef = useRef({});
const bulkCsvInputRef = useRef(null);
const bulkImagesInputRef = useRef(null);
const fileInputRef = useRef(null);
const foto2Ref = useRef(null);
const foto3Ref = useRef(null);
const fotoManoRef = useRef(null);
const fotoCajaRef = useRef(null);
const videoRef = useRef(null);
const [selectedProduct, setSelectedProduct] = useState(null);
const [modalActiveImg, setModalActiveImg] = useState(null);
const [showAllPhotos, setShowAllPhotos] = useState(false);
const [showFullInfo, setShowFullInfo] = useState(false);
const [showSimilarInfo, setShowSimilarInfo] = useState(false);
const [toast, setToast] = useState("");
const toastTimerRef = useRef(null);
const showToast = (msg) => {
setToast(msg);
if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
toastTimerRef.current = setTimeout(() => setToast(""), 2200);
};
// Popup de bienvenida: aparece una sola vez por navegador (se marca en
// localStorage apenas se muestra, sea que el visitante despues se suscriba o
// lo cierre) a los 4 segundos de entrar, asi no tapa lo primero que carga.
useEffect(() => {
try {
if (localStorage.getItem("welcomePopupShown")) return;
} catch {}
const t = setTimeout(() => {
setWelcomePopupOpen(true);
try { localStorage.setItem("welcomePopupShown", "1"); } catch {}
}, 4000);
return () => clearTimeout(t);
}, []);
// Recordatorio de carrito pendiente: si la persona vuelve al sitio (o
// recarga la pagina) y todavia tiene productos guardados en el carrito
// (localStorage, ver "cart" arriba), se lo recordamos con un cartelito
// discreto y un boton para retomarlo. Solo una vez por visita
// (sessionStorage), para no repetirlo en cada recarga de la misma sesion.
useEffect(() => {
if (cart.length === 0) return;
try {
if (sessionStorage.getItem("cartReminderShown")) return;
} catch {}
const showT = setTimeout(() => {
setShowCartReminder(true);
try { sessionStorage.setItem("cartReminderShown", "1"); } catch {}
}, 2500);
const hideT = setTimeout(() => setShowCartReminder(false), 10500);
return () => { clearTimeout(showT); clearTimeout(hideT); };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
// Aviso de reseña real: prueba social honesta (nunca inventamos compras ni
// contadores falsos). Muestra UNA reseña ya publicada por vez, sin repetir
// dentro de la misma visita (se guarda el indice en sessionStorage), asi
// quien esta mirando el catalogo ve que hay gente real conforme con su pedido.
useEffect(() => {
const publicadas = resenas.filter(r => r.estado !== "pendiente" && r.texto);
if (publicadas.length === 0) return;
let seen = 0;
try { seen = Number(sessionStorage.getItem("reviewNoticeSeen") || "0"); } catch {}
if (seen >= publicadas.length) return;
let hideT;
const showT = setTimeout(() => {
setReviewNoticeIdx(seen);
try { sessionStorage.setItem("reviewNoticeSeen", String(seen + 1)); } catch {}
hideT = setTimeout(() => setReviewNoticeIdx(null), 7000);
}, 9000);
return () => { clearTimeout(showT); clearTimeout(hideT); };
}, [resenas.length]);
const [favorites, setFavorites] = useState(() => {
try { return JSON.parse(localStorage.getItem("favoritosEsencia") || "[]"); } catch { return []; }
});
// Semilla del orden aleatorio del catalogo: una nueva por visita (sessionStorage),
// asi el mezclado cambia cada vez que alguien entra al sitio, pero se mantiene
// estable mientras esa persona navega (no salta la grilla en cada render).
const [catalogRandomSeed] = useState(() => {
try {
let s = sessionStorage.getItem("catalogRandomSeed");
if (!s) { s = Math.random().toString(36).slice(2) + Date.now(); sessionStorage.setItem("catalogRandomSeed", s); }
return s;
} catch { return Math.random().toString(36).slice(2) + Date.now(); }
});
const toggleFavorite = (id) => {
setFavorites(f => {
const next = f.includes(id) ? f.filter(x => x !== id) : [...f, id];
try { localStorage.setItem("favoritosEsencia", JSON.stringify(next)); } catch {}
return next;
});
};
// Sincronizacion de carrito/favoritos con la cuenta: cartRef/favoritesRef siempre
// reflejan el estado mas reciente (evita usar valores viejos dentro del closure
// del listener de login, que se crea una sola vez al montar el componente).
const cartRef = useRef(cart);
useEffect(() => { cartRef.current = cart; }, [cart]);
const favoritesRef = useRef(favorites);
useEffect(() => { favoritesRef.current = favorites; }, [favorites]);
const mergeCartArrays = (local, remote) => {
const merged = (local || []).map(li => ({ ...li, qty: clampQty(li.qty) }));
(remote || []).forEach(ri => {
const idx = merged.findIndex(li => li.id === ri.id);
// Usamos el maximo (no la suma) para que combinar el mismo carrito varias veces
// (por ejemplo, en cada inicio de sesion) no vaya duplicando la cantidad.
if (idx >= 0) merged[idx] = { ...merged[idx], qty: clampQty(Math.max(merged[idx].qty || 0, ri.qty || 0)) };
else merged.push({ ...ri, qty: clampQty(ri.qty) });
});
return merged;
};
const syncCartFavoritesOnLogin = async (uid) => {
try {
const ref = doc(db, "carritosClientes", uid);
const snap = await getDoc(ref);
if (snap.exists()) {
const data = snap.data();
const mergedFavorites = Array.from(new Set([...(favoritesRef.current || []), ...(data.favoritos || [])]));
const mergedCart = mergeCartArrays(cartRef.current || [], data.carrito || []);
setFavorites(mergedFavorites);
try { localStorage.setItem("favoritosEsencia", JSON.stringify(mergedFavorites)); } catch {}
setCart(mergedCart);
await setDoc(ref, { carrito: mergedCart, favoritos: mergedFavorites, updatedAt: serverTimestamp() }, { merge: true });
} else {
await setDoc(ref, { carrito: cartRef.current || [], favoritos: favoritesRef.current || [], updatedAt: serverTimestamp() }, { merge: true });
}
} catch (e) {
console.error("CART_SYNC_ERROR", e);
}
};
const [recentlyViewed, setRecentlyViewed] = useState(() => {
try { return JSON.parse(localStorage.getItem("vistosEsencia") || "[]"); } catch { return []; }
});
const [notifyPhone, setNotifyPhone] = useState("");
const [notifySubmitting, setNotifySubmitting] = useState(false);
const [notifyDone, setNotifyDone] = useState(false);
const [avisosStock, setAvisosStock] = useState([]);
const handleNotifyStock = async (product) => {
if (!notifyPhone.trim()) { alert("Ingresa tu WhatsApp para avisarte"); return; }
setNotifySubmitting(true);
try {
await addDoc(collection(db, "avisosStock"), {
productId: product.id,
productName: getProductName(product),
telefono: notifyPhone.trim(),
uid: user ? user.uid : null,
email: user ? user.email : null,
estado: "pendiente",
createdAt: serverTimestamp(),
});
setNotifyDone(true);
} catch (e) {
console.error("STOCK_ALERT_ERROR", e);
alert("No pudimos guardar tu aviso. Intenta de nuevo en unos minutos.");
}
setNotifySubmitting(false);
};

useEffect(() => {
  try { localStorage.setItem("carritoEsencia", JSON.stringify(cart)); } catch {}
}, [cart]);

useEffect(() => {
  try { localStorage.setItem("nombreEsencia", customerName); } catch {}
}, [customerName]);

useEffect(() => {
  try { localStorage.setItem("direccionEsencia", customerAddress); } catch {}
}, [customerAddress]);

useEffect(() => {
try {
const saved = JSON.parse(localStorage.getItem("carritoEsencia") || "[]");
const qty = saved.reduce((acc, i) => acc + (i.qty || 0), 0);
if (qty > 0) showToast("Tenes " + qty + (qty === 1 ? " producto guardado en tu carrito" : " productos guardados en tu carrito"));
} catch {}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

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

// Se cargan todas las notas (publicadas y borradores): el panel admin
// necesita ver los borradores, y las vistas publicas filtran por
// "publicado" al mostrarlas (mismo criterio que resenas con su "estado").
useEffect(() => {
const qBlog = query(collection(db, "blogPosts"), orderBy("createdAt", "desc"));
const unsubBlog = onSnapshot(qBlog, (snap) => {
setBlogPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}, (e) => console.error("BLOG_LIST_ERROR", e));
return () => unsubBlog();
}, []);

// Cupones de descuento: se cargan para todos (no solo el admin) porque el
// carrito del cliente los necesita para validar el codigo que ingresa.
useEffect(() => {
const qCupones = query(collection(db, "cupones"), orderBy("createdAt", "desc"));
const unsubCupones = onSnapshot(qCupones, (snap) => {
setCupones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}, (e) => console.error("CUPONES_LOAD_ERROR", e));
return () => unsubCupones();
}, []);

// Los avisos de stock incluyen el WhatsApp del cliente, asi que solo se cargan
// cuando el admin esta logueado (evita exponer telefonos ajenos al resto de las visitas).
useEffect(() => {
if (!isAdmin) { setAvisosStock([]); return; }
const q3 = query(collection(db, "avisosStock"), orderBy("createdAt", "desc"));
const unsub3 = onSnapshot(q3, (snap) => {
setAvisosStock(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}, (e) => console.error("AVISOS_STOCK_LOAD_ERROR", e));
return () => unsub3();
}, [isAdmin]);

// Los emails de newsletter tambien se cargan solo para el admin (misma logica
// de privacidad que los avisos de stock).
useEffect(() => {
if (!isAdmin) { setNewsletterSubs([]); return; }
const qNews = query(collection(db, "newsletterSuscriptores"), orderBy("createdAt", "desc"));
const unsubNews = onSnapshot(qNews, (snap) => {
setNewsletterSubs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}, (e) => console.error("NEWSLETTER_LOAD_ERROR", e));
return () => unsubNews();
}, [isAdmin]);

// Los contactos que dejan el WhatsApp en el popup de bienvenida viven en la
// misma coleccion que el newsletter (mismas reglas de seguridad: cualquiera
// puede crear/actualizar, solo el admin puede leer/borrar), asi que alcanza
// con separar por tipo de dato en vez de sumar una coleccion nueva.
const emailSubs = newsletterSubs.filter(s => s.email);
const popupContacts = newsletterSubs.filter(s => s.telefono);

// Registro de pedidos: tambien solo para el admin, y limitado a los ultimos
// 200 para no traer toda la coleccion completa a medida que crece.
useEffect(() => {
if (!isAdmin) { setPedidos([]); return; }
const qPedidos = query(collection(db, "pedidos"), orderBy("createdAt", "desc"), limit(200));
const unsubPedidos = onSnapshot(qPedidos, (snap) => {
setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}, (e) => console.error("PEDIDOS_LOAD_ERROR", e));
return () => unsubPedidos();
}, [isAdmin]);

// Estadisticas para el Dashboard de ventas: se calculan en el cliente a partir
// de los ultimos 200 pedidos ya cargados arriba (no se hacen consultas nuevas
// a Firestore). Alcanza para un negocio de este tamano; si en el futuro hace
// falta mas historial, conviene guardar agregados aparte en vez de traer mas
// pedidos al cliente.
const ventasStats = useMemo(() => {
if (!pedidos.length) return null;
const totalFacturado = pedidos.reduce((a, p) => a + (Number(p.total) || 0), 0);
const cantidadPedidos = pedidos.length;
const ticketPromedio = totalFacturado / cantidadPedidos;

const porOrigen = { mercadopago: 0, whatsapp: 0 };
pedidos.forEach(p => {
const key = p.origen === "mercadopago" ? "mercadopago" : "whatsapp";
porOrigen[key] += Number(p.total) || 0;
});

const hoy = new Date();
hoy.setHours(0, 0, 0, 0);
const dias = [];
for (let i = 13; i >= 0; i--) {
const d = new Date(hoy);
d.setDate(d.getDate() - i);
dias.push(d);
}
const ventasPorDia = dias.map(d => {
const siguienteDia = new Date(d);
siguienteDia.setDate(siguienteDia.getDate() + 1);
const total = pedidos.reduce((a, p) => {
const fecha = p.createdAt && p.createdAt.toDate ? p.createdAt.toDate() : null;
if (fecha && fecha >= d && fecha < siguienteDia) return a + (Number(p.total) || 0);
return a;
}, 0);
return { fecha: d, total };
});

const productosMap = {};
pedidos.forEach(p => {
(p.items || []).forEach(it => {
const key = it.nombre || it.id || "Producto";
if (!productosMap[key]) productosMap[key] = { nombre: key, cantidad: 0 };
productosMap[key].cantidad += Number(it.qty) || 0;
});
});
const topProductos = Object.values(productosMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);

return { totalFacturado, cantidadPedidos, ticketPromedio, porOrigen, ventasPorDia, topProductos };
}, [pedidos]);

// Banner del sitio y orden del catalogo: documentos sueltos (no una lista
// ordenada), asi que se escuchan directo por su id en vez de salir de
// "products" (ver comentario junto a bannerConfig/catalogOrderConfig).
useEffect(() => {
const unsubBanner = onSnapshot(doc(db, "productos", "_site_banner"), (snap) => {
setBannerConfig(snap.exists() ? { id: snap.id, ...snap.data() } : null);
}, (e) => console.error("BANNER_LOAD_ERROR", e));
const unsubCatalogOrder = onSnapshot(doc(db, "productos", "_site_catalog_order"), (snap) => {
setCatalogOrderConfig(snap.exists() ? { id: snap.id, ...snap.data() } : null);
}, (e) => console.error("CATALOG_ORDER_LOAD_ERROR", e));
return () => { unsubBanner(); unsubCatalogOrder(); };
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
} else if (p === "/blog" || p === "/blog/") {
setPage("blog");
setSelectedBlogPost(null);
} else if (p.startsWith("/blog/")) {
const m = p.match(/^\/blog\/([^/]+)\/?$/);
const slug = m ? decodeURIComponent(m[1]) : null;
setSelectedBlogPost(slug ? (blogPosts.find(b => b.id === slug) || null) : null);
setPage("blogPost");
} else {
setPage("home");
}
};
window.addEventListener("popstate", handlePop);
return () => window.removeEventListener("popstate", handlePop);
}, [blogPosts]);

useEffect(() => {
setModalActiveImg(null);
setShowAllPhotos(false);
setShowFullInfo(false);
setShowSimilarInfo(false);
setNotifyPhone("");
setNotifySubmitting(false);
setNotifyDone(false);
if (selectedProduct && selectedProduct.id) {
setRecentlyViewed(rv => {
const next = [selectedProduct.id, ...rv.filter(id => id !== selectedProduct.id)].slice(0, 10);
try { localStorage.setItem("vistosEsencia", JSON.stringify(next)); } catch {}
return next;
});
}
}, [selectedProduct]);

// Evento "ViewContent" del Pixel de Meta (+ "view_item" de GA4) cada vez que
// se abre una ficha de producto: sin esto, Meta solo sabe que alguien entro
// al sitio (PageView) pero no que perfume miro, y no puede armar publicos de
// remarketing dinamico ("le mostramos el mismo perfume que ya vio") ni
// anuncios de catalogo. Los otros eventos (AddToCart, InitiateCheckout,
// Purchase) ya estaban, este era el que faltaba en el embudo.
useEffect(() => {
if (!selectedProduct || !selectedProduct.id) return;
try {
const price = Number(selectedProduct.precio || selectedProduct.price || 0);
if (window.fbq) window.fbq("track", "ViewContent", { content_ids: [selectedProduct.id], content_type: "product", content_name: getProductName(selectedProduct), value: price, currency: "ARS" });
if (window.gtag) window.gtag("event", "view_item", { currency: "ARS", value: price, items: [{ item_id: selectedProduct.id, item_name: getProductName(selectedProduct), price }] });
} catch {}
}, [selectedProduct]);

// Al abrir la ficha de producto a pantalla completa, bloqueamos el scroll del fondo
// para que se sienta como una pagina propia y no como un modal chico.
useEffect(() => {
if (selectedProduct) {
const prevOverflow = document.body.style.overflow;
document.body.style.overflow = "hidden";
return () => { document.body.style.overflow = prevOverflow; };
}
}, [selectedProduct]);

// Actualiza el link de la pagina (?p=<id>) para que el boton "Compartir" y los
// links directos a un producto funcionen (deep-linking), sin recargar la pagina.
useEffect(() => {
try {
const url = new URL(window.location.href);
if (selectedProduct && selectedProduct.id) url.searchParams.set("p", selectedProduct.id);
else url.searchParams.delete("p");
window.history.replaceState({}, "", url.pathname + url.search);
} catch {}
}, [selectedProduct]);

// Si el link de "dejanos tu opinion" que le mandamos al cliente incluye su
// nombre (?nombre=...), se lo precargamos en el formulario para que sea mas
// rapido de completar.
useEffect(() => {
if (page !== "opinar") return;
try {
const nombreQP = new URLSearchParams(window.location.search).get("nombre");
if (nombreQP) setOpinionForm(f => (f.nombre ? f : { ...f, nombre: nombreQP }));
} catch {}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [page]);

// Los puntos de fidelizacion de los clientes incluyen su nombre y WhatsApp (ver
// handleCheckout), asi que igual que avisosStock solo se cargan con el admin
// logueado, para no exponer datos de otros clientes al resto de las visitas.
useEffect(() => {
if (!isAdmin) { setCustomersWithPoints([]); return; }
const q4 = query(collection(db, "puntosClientes"), where("puntos", ">=", 300));
const unsub4 = onSnapshot(q4, (snap) => {
setCustomersWithPoints(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.puntos || 0) - (a.puntos || 0)));
}, (e) => console.error("PUNTOS_LIST_ERROR", e));
return () => unsub4();
}, [isAdmin]);

// Si alguien entra directo con un link tipo "?p=<id>" (compartido por WhatsApp,
// redes, Google Shopping, etc.), abrimos automaticamente el producto
// correspondiente. El "?p=" se lee UNA sola vez con el valor que tenia la URL
// en el primerisimo render (antes de que el efecto de arriba, que sincroniza
// selectedProduct -> "?p=", lo borre al ver selectedProduct en null al montar).
const deepLinkTriedRef = useRef(false);
const initialDeepLinkPidRef = useRef(new URLSearchParams(window.location.search).get("p"));
useEffect(() => {
if (deepLinkTriedRef.current || products.length === 0) return;
deepLinkTriedRef.current = true;
try {
const pid = initialDeepLinkPidRef.current;
if (pid) {
const found = products.find(pr => pr.id === pid);
if (found && isPerfume(found)) setSelectedProduct(found);
}
} catch {}
}, [products]);

// Mismo mecanismo que arriba pero para abrir una nota del blog cuando se
// entra directo a "/blog/<slug>".
const blogDeepLinkTriedRef = useRef(false);
useEffect(() => {
if (page !== "blogPost" || blogDeepLinkTriedRef.current || blogPosts.length === 0) return;
blogDeepLinkTriedRef.current = true;
try {
const slug = initialBlogSlugRef.current;
if (slug) {
const found = blogPosts.find(b => b.id === slug);
if (found) setSelectedBlogPost(found);
}
} catch {}
}, [blogPosts, page]);
// Cuando el cliente vuelve de pagar con Mercado Pago (Checkout Pro) retomamos
// el pedido que habiamos guardado en localStorage antes de mandarlo a pagar y
// recien ahi mandamos el mensaje de WhatsApp con el pedido ya pago, para que
// nunca se le avise al negocio de un pedido que en realidad no se termino de
// pagar. Si el pago fallo o quedo pendiente, no se manda nada por WhatsApp.
useEffect(() => {
const mpReturn = new URLSearchParams(window.location.search).get("mp_return");
if (!mpReturn) return;
try {
const url = new URL(window.location.href);
url.searchParams.delete("mp_return");
window.history.replaceState({}, "", url.pathname + url.search + url.hash);
} catch {}
if (mpReturn === "success") {
try {
const pending = JSON.parse(localStorage.getItem("mpPedidoPendiente") || "null");
if (pending) {
let msg = "Hola! Quiero confirmar mi pedido (ya pague con Mercado Pago ✅): " + pending.cartUsed.map(i => getProductName(i) + " x" + i.qty).join(", ");
msg += " - Nombre: " + pending.customerName;
msg += " - Direccion de envio: " + pending.customerAddress;
if (pending.promoCode) msg += " - Codigo promocional: " + pending.promoCode;
if (pending.customerPhone) msg += " - Mi telefono: " + pending.customerPhone;
if (pending.isGift) msg += " - Es un regalo" + (pending.giftMessage ? (": \"" + pending.giftMessage + "\"") : "") + (pending.hideGiftPrice ? " (IMPORTANTE: no mostrar el precio en el paquete)" : "") + (pending.giftWrap ? " - Con envoltorio de regalo (sin costo)" : "");
msg += " - Pago realizado con Mercado Pago - Total: " + formatPrice(pending.totalAEnviar);
// Registro del pedido: a esta pantalla solo se llega cuando Mercado Pago
// aprobo el pago (auto_return: "approved" en la preferencia), asi que el
// pedido se guarda como pagado.
addDoc(collection(db, "pedidos"), {
items: (pending.cartUsed || []).map(i => ({ id: i.id, nombre: getProductName(i), qty: i.qty, precio: Number(i.precio) || 0 })),
total: pending.totalAEnviar,
medioPago: "mercadopago",
origen: "mercadopago",
estado: "pagado",
nombre: pending.customerName,
direccion: pending.customerAddress,
telefono: pending.customerPhone || null,
esRegalo: !!pending.isGift,
cuponCodigo: pending.promoCode || null,
orderId: pending.orderId || null,
createdAt: serverTimestamp(),
}).catch(e => console.error("PEDIDO_LOG_MP_ERROR", e));
// Evento de Compra para Meta Pixel / Google Ads: recien aca sabemos que el
// pago con Mercado Pago se acredito de verdad (ver comentario arriba), asi
// que es el mejor momento para avisarle a las campanas que esto fue una
// venta real y no solo un click o un mensaje.
try {
if (window.fbq) window.fbq("track", "Purchase", { value: pending.totalAEnviar, currency: "ARS", content_type: "product", contents: (pending.cartUsed || []).map(i => ({ id: i.id, quantity: i.qty })) });
if (window.gtag) window.gtag("event", "purchase", { transaction_id: pending.orderId || ("mp_" + Date.now()), value: pending.totalAEnviar, currency: "ARS", items: (pending.cartUsed || []).map(i => ({ item_id: i.id, item_name: getProductName(i), quantity: i.qty, price: Number(i.precio) || 0 })) });
} catch (e) {}
const waUrl = "https://wa.me/2914261941?text=" + encodeURIComponent(msg);
window.open(waUrl, "_blank");
localStorage.removeItem("mpPedidoPendiente");
showToast("Pago acreditado! Te abrimos WhatsApp para coordinar el envio 💛");
}
} catch (e) { console.error("MP_RETURN_ERROR", e); }
} else if (mpReturn === "pending") {
showToast("Tu pago con Mercado Pago quedo pendiente de acreditacion. Te contactamos por WhatsApp apenas se confirme.");
} else if (mpReturn === "failure") {
showToast("El pago no se pudo procesar. Proba de nuevo o elegi otro medio de pago.");
}
}, []);
// Datos estructurados (JSON-LD) para que Google pueda mostrar precio y
// disponibilidad de los perfumes en los resultados de busqueda. Se arma
// dinamicamente a partir del catalogo cargado, sin tocar el index.html.
useEffect(() => {
try {
const list = products.filter(p => isPerfume(p) && getProductPrice(p) > 0).slice(0, 60);
const itemListLd = {
"@context": "https://schema.org",
"@type": "ItemList",
"itemListElement": list.map((p, i) => ({
"@type": "ListItem",
"position": i + 1,
"item": {
"@type": "Product",
"name": getProductName(p),
"image": getProductImage(p) || undefined,
"sku": p.id,
"brand": p.marca ? { "@type": "Brand", "name": p.marca } : undefined,
"offers": {
"@type": "Offer",
"priceCurrency": "ARS",
"price": String(getProductPrice(p)),
"availability": getProductDisp(p) === "agotado" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
"url": "https://www.esenciaperfumeria.com.ar/producto/" + p.id
}
}
}))
};
let script = document.getElementById("ld-product-list");
if (!script) {
script = document.createElement("script");
script.type = "application/ld+json";
script.id = "ld-product-list";
document.head.appendChild(script);
}
script.textContent = JSON.stringify(itemListLd);
} catch {}
}, [products]);

// Cuando se abre la ficha de un producto, sumamos ademas su propio Product
// JSON-LD (mas completo) para esa URL con "?p=<id>".
useEffect(() => {
try {
let script = document.getElementById("ld-product-detail");
if (!selectedProduct || !isPerfume(selectedProduct)) {
if (script) script.remove();
return;
}
const p = selectedProduct;
const productLd = {
"@context": "https://schema.org",
"@type": "Product",
"name": getProductName(p),
"description": (p.descripcion || "").slice(0, 500) || undefined,
"image": [p.imagen, p.imageUrl, p.foto2, p.foto3].filter(Boolean),
"sku": p.id,
"brand": p.marca ? { "@type": "Brand", "name": p.marca } : undefined,
"offers": {
"@type": "Offer",
"priceCurrency": "ARS",
"price": String(getProductPrice(p)),
"availability": getProductDisp(p) === "agotado" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
"url": "https://www.esenciaperfumeria.com.ar/producto/" + p.id
}
};
if (!script) {
script = document.createElement("script");
script.type = "application/ld+json";
script.id = "ld-product-detail";
document.head.appendChild(script);
}
script.textContent = JSON.stringify(productLd);
} catch {}
}, [selectedProduct]);

// El <title> de la pestana y la meta description tambien cambian al abrir un
// producto, para que cada perfume tenga su propio titulo al indexarse en
// Google o al compartir el link (antes quedaba siempre el titulo generico
// de la home, tanto en busquedas como al pegar el link en WhatsApp).
// El <link rel="canonical"> tambien se actualiza: antes quedaba fijo en la
// home en todas las fichas de producto, lo que le decia a Google que NO
// indexe esas 100+ URLs del sitemap como paginas propias (le pisaba el
// trabajo al title/description/JSON-LD de cada producto). Usa el formato
// "/producto/<id>" (no "?p=<id>") para que coincida con el sitemap, el
// JSON-LD y el canonical dinamico que arma api/og.js para bots.
useEffect(() => {
let canonical = document.querySelector('link[rel="canonical"]');
if (selectedProduct && isPerfume(selectedProduct)) {
const nombre = getProductName(selectedProduct);
document.title = nombre + " | Esencia Perfumeria";
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) {
const desc = (selectedProduct.descripcion || "").trim();
metaDesc.setAttribute("content", desc ? desc.slice(0, 160) : ("Compra " + nombre + " en Esencia Perfumeria. Envio gratis en Bahia Blanca y envios a todo el pais."));
}
if (canonical) canonical.setAttribute("href", "https://www.esenciaperfumeria.com.ar/producto/" + selectedProduct.id);
} else if (selectedBlogPost) {
// Mismo mecanismo que arriba pero para una nota del blog abierta.
document.title = (selectedBlogPost.titulo || "Blog") + " | Blog Esencia Perfumeria";
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute("content", (selectedBlogPost.resumen || "").trim().slice(0, 160) || ("Notas y guias de Esencia Perfumeria: " + (selectedBlogPost.titulo || "")));
if (canonical) canonical.setAttribute("href", "https://www.esenciaperfumeria.com.ar/blog/" + selectedBlogPost.id);
} else {
document.title = "Perfumes en Bahía Blanca | Esencia Perfumeria - Envío Gratis";
const metaDesc = document.querySelector('meta[name="description"]');
if (metaDesc) metaDesc.setAttribute("content", "Perfumes arabes y de disenador 100% originales en Bahia Blanca, con envio gratis en la ciudad y envios a todo el pais. Mas de 300 fragancias.");
if (canonical) canonical.setAttribute("href", "https://www.esenciaperfumeria.com.ar/");
}
}, [selectedProduct, selectedBlogPost]);

// JSON-LD "BlogPosting" para cada nota del blog abierta, asi Google puede
// mostrarla como articulo (con fecha, autor y editor) en vez de solo como
// pagina generica. Se arma/borra dinamicamente igual que el Product de
// arriba (id="ld-blog-posting"), sin tocar el index.html.
useEffect(() => {
try {
let script = document.getElementById("ld-blog-posting");
if (!selectedBlogPost) {
if (script) script.remove();
return;
}
const b = selectedBlogPost;
const fechaPublicacion = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().toISOString() : undefined;
const blogLd = {
"@context": "https://schema.org",
"@type": "BlogPosting",
"headline": b.titulo,
"description": (b.resumen || "").slice(0, 160) || undefined,
"image": b.imagen || undefined,
"datePublished": fechaPublicacion,
"author": { "@type": "Organization", "name": "Esencia Perfumeria" },
"publisher": {
"@type": "Organization",
"name": "Esencia Perfumeria",
"logo": { "@type": "ImageObject", "url": "https://i.imgur.com/sgR3LY9.jpeg" }
},
"mainEntityOfPage": "https://www.esenciaperfumeria.com.ar/blog/" + b.id
};
if (!script) {
script = document.createElement("script");
script.type = "application/ld+json";
script.id = "ld-blog-posting";
document.head.appendChild(script);
}
script.textContent = JSON.stringify(blogLd);
} catch {}
}, [selectedBlogPost]);

// JSON-LD "BreadcrumbList" (Inicio > Catalogo/Blog > pagina actual). Google
// puede mostrar esta ruta en vez de la URL pelada en el resultado de
// busqueda. Se arma/borra igual que los otros bloques dinamicos de arriba
// (id="ld-breadcrumb"), sin tocar el index.html.
useEffect(() => {
try {
let script = document.getElementById("ld-breadcrumb");
let items = null;
if (selectedProduct && isPerfume(selectedProduct)) {
items = [
{ name: "Inicio", url: "https://www.esenciaperfumeria.com.ar/" },
{ name: "Catalogo", url: "https://www.esenciaperfumeria.com.ar/#productsSection" },
{ name: getProductName(selectedProduct), url: "https://www.esenciaperfumeria.com.ar/producto/" + selectedProduct.id },
];
} else if (selectedBlogPost) {
items = [
{ name: "Inicio", url: "https://www.esenciaperfumeria.com.ar/" },
{ name: "Blog", url: "https://www.esenciaperfumeria.com.ar/blog" },
{ name: selectedBlogPost.titulo || "Nota", url: "https://www.esenciaperfumeria.com.ar/blog/" + selectedBlogPost.id },
];
}
if (!items) {
if (script) script.remove();
return;
}
const breadcrumbLd = {
"@context": "https://schema.org",
"@type": "BreadcrumbList",
"itemListElement": items.map((it, i) => ({
"@type": "ListItem",
"position": i + 1,
"name": it.name,
"item": it.url,
})),
};
if (!script) {
script = document.createElement("script");
script.type = "application/ld+json";
script.id = "ld-breadcrumb";
document.head.appendChild(script);
}
script.textContent = JSON.stringify(breadcrumbLd);
} catch {}
}, [selectedProduct, selectedBlogPost]);

useEffect(() => {
let unsub = () => {};
let cancelled = false;
loadAuthMod().then((mod) => {
if (cancelled) return;
const authInstance = mod.getAuth(app);
unsub = mod.onAuthStateChanged(authInstance, (u) => {
setUser(u);
if (u) {
loadMyPoints(u.uid);
loadMyReferral(u.uid);
syncCartFavoritesOnLogin(u.uid);
} else {
setCustomerPoints(null);
setRedeemPoints(false);
}
});
});
return () => { cancelled = true; unsub(); };
}, []);

const cartSyncTimerRef = useRef(null);
useEffect(() => {
if (!user) return;
if (cartSyncTimerRef.current) clearTimeout(cartSyncTimerRef.current);
cartSyncTimerRef.current = setTimeout(() => {
setDoc(doc(db, "carritosClientes", user.uid), { carrito: cart, favoritos: favorites, updatedAt: serverTimestamp() }, { merge: true }).catch(e => console.error("CART_SYNC_WRITE_ERROR", e));
}, 1500);
return () => { if (cartSyncTimerRef.current) clearTimeout(cartSyncTimerRef.current); };
}, [cart, favorites, user]);

const [adminLoginBusy, setAdminLoginBusy] = useState(false);
const handleAdminLogin = async () => {
if (!adminPass) { setAdminError("Ingresa tu contrasena"); return; }
setAdminLoginBusy(true);
setAdminError("");
try {
const mod = await loadAuthMod();
const authInstance = mod.getAuth(app);
const cred = await mod.signInWithEmailAndPassword(authInstance, ADMIN_EMAIL, adminPass);
if (cred.user.email !== ADMIN_EMAIL) {
setAdminError("Esta cuenta no tiene permisos de administrador");
await mod.signOut(authInstance);
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

// ---- Carga masiva de productos (CSV) ----
const uploadFileToImgur = async (file) => {
const formData = new FormData();
formData.append("image", file);
const res = await fetch("https://api.imgur.com/3/image", {
method: "POST",
headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
body: formData,
});
const data = await res.json();
if (data.success) return data.data.link;
throw new Error("Error al subir la imagen a Imgur");
};

const normalizeTagInput = (input) => {
const norm = (input || "").trim().toLowerCase();
if (!norm) return null;
const byKey = TAG_OPTIONS.find(t => t.key.toLowerCase() === norm);
if (byKey) return byKey.key;
const byLabel = TAG_OPTIONS.find(t => t.label.toLowerCase() === norm);
if (byLabel) return byLabel.key;
return null;
};

const PLACEHOLDER_IMAGE_URL = "https://placehold.co/300x300?text=Sin+Imagen";
const BULK_CSV_HEADERS = ["id", "nombre", "precio", "precioOriginal", "descripcion", "marca", "genero", "tipoPerfume", "temporada", "duracion", "notas", "disponibilidad", "diasHabiles", "imagen", "imageUrl", "foto2", "foto3", "inspiradoEn", "similitud", "stockBajo", "precioDecant5", "precioDecant10", "etiquetas"];
const BULK_NUMERIC_FIELDS = ["precio", "precioOriginal", "similitud", "stockBajo", "precioDecant5", "precioDecant10"];
const BULK_TEXT_FIELDS = ["descripcion", "marca", "genero", "tipoPerfume", "temporada", "duracion", "notas", "foto2", "foto3", "inspiradoEn"];

const parseCSVText = (text) => {
const rows = [];
let row = [], field = "", inQuotes = false;
const clean = text.replace(/^﻿/, "");
for (let i = 0; i < clean.length; i++) {
const c = clean[i], next = clean[i + 1];
if (inQuotes) {
if (c === '"' && next === '"') { field += '"'; i++; }
else if (c === '"') { inQuotes = false; }
else field += c;
} else if (c === '"') {
inQuotes = true;
} else if (c === ",") {
row.push(field); field = "";
} else if (c === "\n" || c === "\r") {
if (c === "\r" && next === "\n") i++;
row.push(field); field = "";
if (row.some(v => v.trim() !== "")) rows.push(row);
row = [];
} else {
field += c;
}
}
if (field !== "" || row.length) { row.push(field); if (row.some(v => v.trim() !== "")) rows.push(row); }
return rows;
};

const downloadCSVFile = (rows, filename) => {
const csv = rows.map(row => row.map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
};

const downloadBulkTemplate = () => {
const example = ["", "Dior Sauvage EDP 100 ml", "120000", "180000", "Fragancia amaderada y fresca, ideal para uso diario.", "Dior", "masculino", "disenador", "todo_anio", "8 a 10 horas", "Amaderado Aromatico. Citrico, especiado, elegante.", "stock", "", "", "https://i.imgur.com/ejemplo.jpg", "", "", "", "", "", "", "", "mas_vendidos|novedades"];
downloadCSVFile([BULK_CSV_HEADERS, example], "plantilla_productos_esencia.csv");
};

// Exporta el catalogo actual (con su "id" de cada producto) para poder editarlo en Excel/Sheets
// y volver a subirlo: si una fila trae "id", el importador actualiza ese producto en vez de duplicarlo.
// Asi se puede reponer stock, cambiar precios o marcar "agotado" de muchos perfumes a la vez.
const exportCatalogToCSV = () => {
const perfumes = products.filter(p => (p.categoria || "perfume") === "perfume" && !!p.nombre);
if (!perfumes.length) { alert("Todavia no hay productos para exportar."); return; }
const rows = perfumes.map(p => [
p.id,
p.nombre || "",
p.precio ?? "",
p.precioOriginal ?? "",
p.descripcion || "",
p.marca || "",
p.genero || "",
p.tipoPerfume || "",
p.temporada || "",
p.duracion || "",
p.notas || "",
p.disponibilidad || "stock",
p.diasHabiles || "",
"",
p.imageUrl || "",
p.foto2 || "",
p.foto3 || "",
p.inspiradoEn || "",
p.similitud ?? "",
p.stockBajo ?? "",
p.precioDecant5 ?? "",
p.precioDecant10 ?? "",
(p.etiquetas || []).join("|"),
]);
downloadCSVFile([BULK_CSV_HEADERS, ...rows], "catalogo_esencia_" + new Date().toISOString().slice(0, 10) + ".csv");
};

const handleBulkCsvSelect = async (file) => {
if (!file) return;
setBulkResults([]);
try {
const text = await file.text();
const rows = parseCSVText(text);
if (rows.length < 2) { alert("El CSV no tiene filas de datos debajo del encabezado."); return; }
const headers = rows[0].map(h => h.trim());
const objs = rows.slice(1).map(r => {
const obj = {};
headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
return obj;
});
setBulkRows(objs);
} catch (e) {
alert("No pudimos leer ese archivo. Asegurate de que sea un CSV.");
}
};

const handleBulkImagesSelect = (fileList) => {
const map = {};
Array.from(fileList || []).forEach(f => { map[f.name.trim().toLowerCase()] = f; });
bulkFilesRef.current = map;
setBulkImagesCount(Object.keys(map).length);
};

const bulkRowIsUpdate = (r) => !!(r.id && r.id.trim());
const bulkRowExistingProduct = (r) => bulkRowIsUpdate(r) ? products.find(p => p.id === r.id.trim()) : null;
const bulkRowHasImage = (r) => bulkRowIsUpdate(r) || !!(r.imageUrl && r.imageUrl.trim()) || !!(r.imagen && bulkFilesRef.current[r.imagen.trim().toLowerCase()]);
// La imagen ya no es obligatoria para publicar: las filas sin imagen se publican
// con un placeholder y se pueden completar despues a mano.
const bulkRowAction = (r) => {
if (!bulkRowIsUpdate(r)) return { type: "new" };
const existing = bulkRowExistingProduct(r);
if (!existing) return { type: "error", msg: "ID no encontrado" };
return { type: "update", existing };
};

const handleBulkPublish = async () => {
if (!bulkRows.length || bulkPublishing) return;
setBulkPublishing(true);
setBulkResults([]);
const results = [];
for (let i = 0; i < bulkRows.length; i++) {
const r = bulkRows[i];
setBulkProgress({ done: i, total: bulkRows.length });
const isUpdate = bulkRowIsUpdate(r);
const label = r.nombre || (isUpdate ? "Actualizacion sin nombre" : `Fila ${i + 2}`);
try {
if (isUpdate) {
const existing = products.find(p => p.id === r.id.trim());
if (!existing) throw new Error(`No encontramos ningun producto con el id "${r.id.trim()}" (¿lo modificaste al editar el CSV?)`);
const patch = {};
if (r.nombre && r.nombre.trim()) patch.nombre = r.nombre.trim();
BULK_NUMERIC_FIELDS.forEach(f => { if (r[f] && r[f].trim() !== "") { const n = Number(r[f]); if (!isNaN(n)) patch[f] = n; } });
BULK_TEXT_FIELDS.forEach(f => { if (r[f] && r[f].trim() !== "") patch[f] = r[f].trim(); });
if (r.disponibilidad && ["stock", "pedido", "agotado"].includes(r.disponibilidad.trim())) {
patch.disponibilidad = r.disponibilidad.trim();
patch.diasHabiles = patch.disponibilidad === "pedido" ? (r.diasHabiles || existing.diasHabiles || "3") : null;
}
if (r.etiquetas && r.etiquetas.trim() !== "") {
patch.etiquetas = r.etiquetas.split("|").map(t => normalizeTagInput(t)).filter(Boolean);
}
let imageUrl = (r.imageUrl || "").trim();
if (!imageUrl && r.imagen && r.imagen.trim()) {
const file = bulkFilesRef.current[r.imagen.trim().toLowerCase()];
if (file) imageUrl = await uploadFileToImgur(file);
}
if (imageUrl) patch.imageUrl = imageUrl;
if (Object.keys(patch).length === 0) throw new Error("La fila no tiene ningun campo para actualizar (todo vacio salvo el id)");
await updateDoc(doc(db, "productos", r.id.trim()), patch);
results.push({ nombre: label, ok: true, action: "Actualizado" });
} else {
if (!r.nombre || !r.nombre.trim()) throw new Error("Falta el nombre");
if (!r.precio || isNaN(Number(r.precio))) throw new Error("Falta el precio o no es un numero");
let imageUrl = (r.imageUrl || "").trim();
if (!imageUrl && r.imagen && r.imagen.trim()) {
const file = bulkFilesRef.current[r.imagen.trim().toLowerCase()];
if (file) imageUrl = await uploadFileToImgur(file);
}
// La imagen es opcional: si no se encontro o no se cargo ninguna, el producto
// se publica igual con una imagen placeholder que despues se puede reemplazar
// a mano desde "Editar producto".
if (!imageUrl) imageUrl = PLACEHOLDER_IMAGE_URL;
const disp = ["stock", "pedido", "agotado"].includes((r.disponibilidad || "").trim()) ? r.disponibilidad.trim() : "stock";
const etiquetas = (r.etiquetas || "").split("|").map(t => normalizeTagInput(t)).filter(Boolean);
const productData = {
nombre: r.nombre.trim(),
precio: Number(r.precio),
precioOriginal: r.precioOriginal ? Number(r.precioOriginal) : null,
descripcion: r.descripcion || "",
imageUrl,
foto2: r.foto2 || null,
foto3: r.foto3 || null,
fotoMano: null,
fotoCaja: null,
videoUrl: null,
disponibilidad: disp,
diasHabiles: disp === "pedido" ? (r.diasHabiles || "3") : null,
categoria: "perfume",
marca: r.marca || null,
genero: r.genero || null,
temporada: r.temporada || null,
tipoPerfume: r.tipoPerfume || null,
duracion: r.duracion || null,
notas: r.notas || null,
notasSalida: null, notasCorazon: null, notasFondo: null,
inspiradoEn: r.inspiradoEn || null,
similitud: r.similitud ? Number(r.similitud) : null,
stockBajo: r.stockBajo ? Number(r.stockBajo) : null,
etiquetas,
precioDecant5: r.precioDecant5 ? Number(r.precioDecant5) : null,
precioDecant10: r.precioDecant10 ? Number(r.precioDecant10) : null,
};
await addDoc(collection(db, "productos"), { ...productData, createdAt: serverTimestamp() });
results.push({ nombre: label, ok: true, action: "Publicado" });
}
} catch (e) {
results.push({ nombre: label, ok: false, error: e.message });
}
}
setBulkProgress({ done: bulkRows.length, total: bulkRows.length });
setBulkResults(results);
setBulkPublishing(false);
if (results.every(r => r.ok)) {
setBulkRows([]);
bulkFilesRef.current = {};
setBulkImagesCount(0);
if (bulkCsvInputRef.current) bulkCsvInputRef.current.value = "";
if (bulkImagesInputRef.current) bulkImagesInputRef.current.value = "";
}
};

const handleSaveBanner = async () => {
if (!bannerForm) return;
setBannerSaving(true);
try {
await setDoc(doc(db, "productos", "_site_banner"), {
bannerEnabled: !!bannerForm.bannerEnabled,
bannerTexto: (bannerForm.bannerTexto || "").trim(),
bannerLink: (bannerForm.bannerLink || "").trim(),
bannerCtaLabel: (bannerForm.bannerCtaLabel || "").trim(),
bannerFechaObjetivo: bannerForm.bannerFechaObjetivo || "",
updatedAt: serverTimestamp(),
}, { merge: true });
showToast("Banner guardado");
} catch (e) {
console.error("BANNER_SAVE_ERROR", e);
showToast("No se pudo guardar el banner");
}
setBannerSaving(false);
};

const handleSaveCatalogOrder = async () => {
if (!catalogOrderForm) return;
setCatalogOrderSaving(true);
try {
await setDoc(doc(db, "productos", "_site_catalog_order"), {
modo: catalogOrderForm.modo || "novedades",
categoriaClave: catalogOrderForm.categoriaClave || "",
manualIds: catalogOrderForm.manualIds || [],
updatedAt: serverTimestamp(),
}, { merge: true });
showToast("Orden del catalogo guardado");
} catch (e) {
console.error("CATALOG_ORDER_SAVE_ERROR", e);
showToast("No se pudo guardar el orden del catalogo");
}
setCatalogOrderSaving(false);
};

const handleAddCupon = async () => {
const codigo = (cuponForm.codigo || "").trim().toUpperCase();
if (!codigo) return alert("Ingresa el codigo del cupon");
if (!cuponForm.valor || Number(cuponForm.valor) <= 0) return alert("Ingresa un valor de descuento mayor a 0");
setCuponSaving(true);
try {
await setDoc(doc(db, "cupones", codigo), {
tipo: cuponForm.tipo || "porcentaje",
valor: Number(cuponForm.valor) || 0,
minCompra: cuponForm.minCompra ? Number(cuponForm.minCompra) : null,
fechaExpiracion: cuponForm.fechaExpiracion || "",
activo: true,
createdAt: serverTimestamp(),
}, { merge: true });
setCuponForm({ codigo: "", tipo: "porcentaje", valor: "", minCompra: "", fechaExpiracion: "" });
showToast("Cupon " + codigo + " guardado");
} catch (e) {
console.error("CUPON_SAVE_ERROR", e);
showToast("No se pudo guardar el cupon");
}
setCuponSaving(false);
};

const handleToggleCupon = async (c) => {
try { await updateDoc(doc(db, "cupones", c.id), { activo: !c.activo }); } catch (e) { console.error("CUPON_TOGGLE_ERROR", e); }
};

const handleDeleteCupon = async (id) => {
if (!confirm("Eliminar el cupon " + id + "?")) return;
try { await deleteDoc(doc(db, "cupones", id)); } catch (e) { console.error("CUPON_DELETE_ERROR", e); }
};

// Captura de email para newsletter (ademas de la Lista VIP de WhatsApp). El id
// del documento es el email en minuscula para no duplicar si alguien se
// vuelve a suscribir.
const handleSubscribeNewsletter = async () => {
const email = (newsletterEmail || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast("Ingresa un email valido"); return; }
setNewsletterSaving(true);
try {
await setDoc(doc(db, "newsletterSuscriptores", email), {
email,
createdAt: serverTimestamp(),
}, { merge: true });
setNewsletterEmail("");
showToast("Listo! Te vamos a avisar de las novedades por email");
} catch (e) {
console.error("NEWSLETTER_SUBSCRIBE_ERROR", e);
showToast("No pudimos guardar tu email, intenta de nuevo");
}
setNewsletterSaving(false);
};

// Pide el WhatsApp en vez del email: es un contacto mas directo (casi nadie
// revisa el mail, pero el celular lo mira todo el mundo) y sirve como base
// mas solida para avisar ofertas o eventos de la marca. Usa la misma
// coleccion que el newsletter (newsletterSuscriptores) porque las reglas de
// seguridad ya permiten crear ahi sin loguearse; el id es el numero (solo
// digitos) para no duplicar si alguien completa el popup mas de una vez.
const handleWelcomePopupSubscribe = async () => {
const digits = (welcomePopupPhone || "").replace(/\D/g, "");
if (digits.length < 8 || digits.length > 15) { showToast("Ingresa un numero de telefono valido"); return; }
setWelcomePopupSaving(true);
try {
await setDoc(doc(db, "newsletterSuscriptores", digits), {
telefono: welcomePopupPhone.trim(),
origen: "popup_bienvenida",
cuponEntregado: WELCOME_COUPON_CODE,
createdAt: serverTimestamp(),
}, { merge: true });
setWelcomePopupDone(true);
} catch (e) {
console.error("WELCOME_POPUP_SUBSCRIBE_ERROR", e);
showToast("No pudimos guardar tu numero, intenta de nuevo");
}
setWelcomePopupSaving(false);
};

const exportNewsletterToCSV = () => {
if (!emailSubs.length) { alert("Todavia no hay suscriptores para exportar."); return; }
const rows = [["email", "fecha"], ...emailSubs.map(s => [s.email || s.id, s.createdAt && s.createdAt.toDate ? s.createdAt.toDate().toLocaleDateString("es-AR") : ""])];
downloadCSVFile(rows, "suscriptores_newsletter_esencia.csv");
};

const handleDeleteNewsletterSub = async (id) => {
if (!confirm("Eliminar este suscriptor?")) return;
try { await deleteDoc(doc(db, "newsletterSuscriptores", id)); } catch (e) { console.error("NEWSLETTER_DELETE_ERROR", e); }
};

const exportPopupContactsToCSV = () => {
if (!popupContacts.length) { alert("Todavia no hay contactos para exportar."); return; }
const rows = [["telefono", "fecha"], ...popupContacts.map(c => [c.telefono || c.id, c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toLocaleDateString("es-AR") : ""])];
downloadCSVFile(rows, "contactos_whatsapp_popup_esencia.csv");
};

const handleDeletePopupContact = async (id) => {
if (!confirm("Eliminar este contacto?")) return;
try { await deleteDoc(doc(db, "newsletterSuscriptores", id)); } catch (e) { console.error("POPUP_CONTACT_DELETE_ERROR", e); }
};

const handleAddProduct = async () => {
if (!form.nombre.trim()) return alert("Ingresa el nombre del producto");
if (!form.precio) return alert("Ingresa el precio");
const productData = {
nombre: form.nombre,
precio: Number(form.precio),
precioOriginal: form.precioOriginal ? Number(form.precioOriginal) : null,
descripcion: form.descripcion,
imageUrl: form.imageUrl || PLACEHOLDER_IMAGE_URL,
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
notasSalida: form.notasSalida || null, notasCorazon: form.notasCorazon || null, notasFondo: form.notasFondo || null,
inspiradoEn: form.inspiradoEn || null,
similitud: form.similitud ? Number(form.similitud) : null, stockBajo: form.stockBajo ? Number(form.stockBajo) : null, etiquetas: form.etiquetas || [], precioDecant5: form.precioDecant5 ? Number(form.precioDecant5) : null, precioDecant10: form.precioDecant10 ? Number(form.precioDecant10) : null
};
if (editingId) {
await updateDoc(doc(db, "productos", editingId), productData);
setEditingId(null);
} else {
await addDoc(collection(db, "productos"), { ...productData, createdAt: serverTimestamp() });
}
setForm({ nombre: "", precio: "", precioOriginal: "", descripcion: "", imageUrl: "", foto2: "", foto3: "", fotoMano: "", fotoCaja: "", videoUrl: "", disponibilidad: "stock", diasHabiles: "3", categoria: "perfume", marca: "", genero: "", temporada: "", tipoPerfume: "", duracion: "", notas: "", notasSalida: "", notasCorazon: "", notasFondo: "", inspiradoEn: "", similitud: "", stockBajo: "", etiquetas: [], precioDecant5: "", precioDecant10: "" });
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
notasSalida: p.notasSalida || "", notasCorazon: p.notasCorazon || "", notasFondo: p.notasFondo || "",
inspiradoEn: p.inspiradoEn || "",
similitud: p.similitud || "", stockBajo: p.stockBajo || "", etiquetas: p.etiquetas || [], precioDecant5: p.precioDecant5 || "", precioDecant10: p.precioDecant10 || ""
});
window.scrollTo({ top: 0, behavior: "smooth" });
};

const handleCancelEdit = () => {
setEditingId(null);
setForm({ nombre: "", precio: "", precioOriginal: "", descripcion: "", imageUrl: "", foto2: "", foto3: "", fotoMano: "", fotoCaja: "", videoUrl: "", disponibilidad: "stock", diasHabiles: "3", categoria: "perfume", marca: "", genero: "", temporada: "", tipoPerfume: "", duracion: "", notas: "", notasSalida: "", notasCorazon: "", notasFondo: "", inspiradoEn: "", similitud: "", stockBajo: "", etiquetas: [], precioDecant5: "", precioDecant10: "" });
setUploadMsg("");
};

const handleDeleteProduct = async (id) => {
if (!confirm("Eliminar este producto?")) return;
await deleteDoc(doc(db, "productos", id));
};

// --- Blog: CRUD del panel admin ---
// Genera una URL amigable a partir del titulo (o de lo que el admin haya
// escrito a mano en el campo "slug"), sacando acentos y caracteres raros.
const slugify = (s) => String(s || "").toLowerCase()
.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const handleBlogImageUpload = async (file) => {
if (!file) return;
setBlogUploading(true);
try {
const link = await uploadFileToImgur(file);
setBlogForm(f => ({ ...f, imagen: link }));
} catch (e) {
alert("No pudimos subir la imagen. Intenta de nuevo.");
}
setBlogUploading(false);
};

// El slug se usa como ID del documento (como ya se hace con referralCodes):
// asi "/blog/<slug>" mapea directo a un documento, sin necesidad de una
// consulta aparte. Una vez creada la nota, el slug queda fijo (no se puede
// editar) para que un link ya compartido nunca se rompa.
const handleSaveBlogPost = async () => {
if (!blogForm.titulo.trim()) return alert("Ingresa el titulo de la nota");
if (!blogForm.contenido.trim()) return alert("Ingresa el contenido de la nota");
const slug = editingBlogSlug || slugify(blogForm.slug || blogForm.titulo);
if (!slug) return alert("No se pudo generar la URL de la nota, proba con otro titulo.");
setBlogSaving(true);
try {
const payload = {
titulo: blogForm.titulo.trim(),
slug,
resumen: blogForm.resumen.trim(),
contenido: blogForm.contenido,
imagen: blogForm.imagen || "",
categoria: blogForm.categoria,
publicado: !!blogForm.publicado,
updatedAt: serverTimestamp(),
};
if (!editingBlogSlug) payload.createdAt = serverTimestamp();
await setDoc(doc(db, "blogPosts", slug), payload, { merge: true });
setBlogForm({ titulo: "", slug: "", resumen: "", contenido: "", imagen: "", categoria: "guia-compra", publicado: false });
setEditingBlogSlug(null);
alert("Nota guardada");
} catch (e) {
console.error("BLOG_SAVE_ERROR", e);
alert("No pudimos guardar la nota. Intenta de nuevo.");
}
setBlogSaving(false);
};

const handleEditBlogPost = (b) => {
setEditingBlogSlug(b.id);
setBlogForm({ titulo: b.titulo || "", slug: b.slug || b.id || "", resumen: b.resumen || "", contenido: b.contenido || "", imagen: b.imagen || "", categoria: b.categoria || "guia-compra", publicado: !!b.publicado });
window.scrollTo({ top: 0, behavior: "smooth" });
};

const handleCancelBlogEdit = () => {
setEditingBlogSlug(null);
setBlogForm({ titulo: "", slug: "", resumen: "", contenido: "", imagen: "", categoria: "guia-compra", publicado: false });
};

const handleDeleteBlogPost = async (id) => {
if (!confirm("Eliminar esta nota del blog?")) return;
await deleteDoc(doc(db, "blogPosts", id));
};

const handleTogglePublishBlogPost = async (b) => {
try { await updateDoc(doc(db, "blogPosts", b.id), { publicado: !b.publicado, updatedAt: serverTimestamp() }); }
catch (e) { console.error("BLOG_PUBLISH_TOGGLE_ERROR", e); }
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
estado: "publicada", // el admin la esta tipeando el mismo, ya esta vista/aprobada
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

// Aprobar/rechazar una resena que dejo un cliente por si mismo desde "/opinar".
const handlePublishResena = async (id) => {
try { await updateDoc(doc(db, "resenas", id), { estado: "publicada" }); } catch (e) { console.error("RESENA_PUBLISH_ERROR", e); alert("No pudimos publicar la resena, intenta de nuevo."); }
};
const handleRejectResena = async (id) => {
if (!confirm("Rechazar y eliminar esta resena? No se va a poder recuperar.")) return;
try { await deleteDoc(doc(db, "resenas", id)); } catch (e) { console.error("RESENA_REJECT_ERROR", e); }
};

// Subida de la foto que el CLIENTE adjunta en el formulario publico "/opinar"
// (misma logica que handleResenaImageUpload, pero apuntando a opinionForm).
const handleOpinionPhotoUpload = async (file) => {
if (!file) return;
setOpinionUploading(true);
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
setOpinionForm(f => ({ ...f, foto: data.data.link }));
} else {
setOpinionError("No pudimos subir la foto. Intenta con otra imagen.");
}
} catch {
setOpinionError("Error de conexion al subir la foto.");
}
setOpinionUploading(false);
};

const handleSubmitOpinion = async () => {
if (!opinionForm.nombre.trim() || !opinionForm.texto.trim()) {
setOpinionError("Completa tu nombre y contanos tu experiencia.");
return;
}
if (!opinionForm.foto) {
setOpinionError("Subi una foto de tu perfume para completar tu opinion.");
return;
}
setOpinionError("");
setOpinionSaving(true);
try {
await addDoc(collection(db, "resenas"), {
nombre: opinionForm.nombre.trim(),
ciudad: opinionForm.ciudad.trim(),
estrellas: Number(opinionForm.estrellas) || 5,
texto: opinionForm.texto.trim(),
foto: opinionForm.foto,
estado: "pendiente",
createdAt: serverTimestamp(),
});
setOpinionSent(true);
} catch (err) {
console.error("OPINION_SUBMIT_ERROR", err);
setOpinionError("No pudimos enviar tu opinion. Intenta de nuevo en unos minutos.");
}
setOpinionSaving(false);
};

const handleShareProduct = async (product) => {
// Se comparte con /producto/<id> (no ?p=<id>) para que WhatsApp/Facebook/etc
// muestren la foto y el nombre de ESTE perfume en la vista previa del link:
// esa ruta pasa por api/og.js, que le arma el title/imagen correctos al bot
// que arma la vista previa (ver vercel.json). Al abrirla en un navegador
// normal, esa misma funcion redirige a ?p=<id> y la app sigue igual que
// siempre.
let shareUrl = window.location.origin + "/producto/" + encodeURIComponent(product.id);
const shareText = `Mira este perfume en Esencia Perfumeria: ${getProductName(product)} - ${formatPrice(getProductPrice(product))}`;
if (navigator.share) {
try {
await navigator.share({ title: getProductName(product), text: shareText, url: shareUrl });
} catch (e) { /* el cliente cancelo el dialogo nativo de compartir */ }
return;
}
try {
await navigator.clipboard.writeText(shareUrl);
showToast("Enlace copiado, listo para compartir");
} catch {
window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, "_blank");
}
};

const handleMarkAvisoContacted = async (id) => {
try { await updateDoc(doc(db, "avisosStock", id), { estado: "contactado" }); } catch (e) { console.error("AVISO_UPDATE_ERROR", e); }
};
const handleDeleteAviso = async (id) => {
try { await deleteDoc(doc(db, "avisosStock", id)); } catch (e) { console.error("AVISO_DELETE_ERROR", e); }
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
if (exists) return c.map(i => i.id === product.id ? { ...i, qty: clampQty(i.qty + 1) } : i);
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
setCart(c => c.map(i => i.id === id ? { ...i, qty: capQtyDelta(i.qty + delta) } : i).filter(i => i.qty > 0));
};
const totalCart = cart.reduce((acc, i) => acc + (Number(i.precio) || 0) * i.qty, 0);
// El promedio y el conteo que se muestran en las cards, en el home y en cada
// producto salen SOLO de resenas ya publicadas (moderadas), nunca de las que
// todavia estan pendientes de aprobacion: asi el numero que ve el cliente es
// siempre uno que un humano ya reviso.
const resenasPublicadas = resenas.filter(r => r.estado !== "pendiente");
const reviewCount = resenasPublicadas.length;
const avgRating = reviewCount > 0 ? (resenasPublicadas.reduce((acc, r) => acc + (Number(r.estrellas) || 5), 0) / reviewCount).toFixed(1) : null;
// Le sumamos al JSON-LD "OnlineStore" de index.html (id="ld-organization")
// el campo aggregateRating apenas haya opiniones publicadas, para que
// Google pueda mostrar las estrellas de la tienda en los resultados de
// busqueda. Si todavia no hay opiniones, no se agrega el campo (Google
// penaliza el aggregateRating sin reviews reales detras).
useEffect(() => {
try {
const script = document.getElementById("ld-organization");
if (!script) return;
const data = JSON.parse(script.textContent);
if (reviewCount > 0 && avgRating) {
data.aggregateRating = {
"@type": "AggregateRating",
"ratingValue": String(avgRating),
"reviewCount": String(reviewCount),
"bestRating": "5"
};
} else {
delete data.aggregateRating;
}
script.textContent = JSON.stringify(data);
} catch {}
}, [avgRating, reviewCount]);
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
const decantCartLines = cart.filter(i => i.isDecant);
const decantComboCount = new Set(decantCartLines.map(i => i.id.split("_decant")[0])).size;
const decantComboSubtotal = decantCartLines.reduce((acc, i) => acc + (Number(i.precio) || 0) * i.qty, 0);
const decantComboActive = decantComboCount >= DECANT_COMBO_MIN;
const decantComboDiscount = decantComboActive ? Math.round(decantComboSubtotal * DECANT_COMBO_DISCOUNT_PCT) : 0;
const freeShippingRemaining = Math.max(FREE_SHIPPING_THRESHOLD - totalCart, 0);
const freeShippingReached = freeShippingRemaining <= 0 && totalCart > 0;
// Cupones de descuento reales: se buscan por codigo (coleccion "cupones", id = el
// codigo en mayusculas) y se valida que esten activos, no vencidos y que la compra
// llegue al minimo exigido. motivo describe por que NO se aplico (o null si se aplico).
const normalizeCuponCodigo = (s) => (s || "").trim().toUpperCase();
const evalCupon = (codigoIngresado, total) => {
const codigo = normalizeCuponCodigo(codigoIngresado);
if (!codigo) return { cupon: null, discount: 0, motivo: null };
const c = cupones.find(x => x.id === codigo);
if (!c) return { cupon: null, discount: 0, motivo: "no_encontrado" };
if (!c.activo) return { cupon: c, discount: 0, motivo: "inactivo" };
if (c.fechaExpiracion) {
const exp = new Date(c.fechaExpiracion + "T23:59:59");
if (!isNaN(exp.getTime()) && exp < new Date()) return { cupon: c, discount: 0, motivo: "vencido" };
}
if (c.minCompra && total < Number(c.minCompra)) return { cupon: c, discount: 0, motivo: "minimo" };
const discount = c.tipo === "monto" ? Math.min(Number(c.valor) || 0, total) : Math.round(total * Math.max(0, Math.min(100, Number(c.valor) || 0)) / 100);
return { cupon: c, discount, motivo: null };
};
const cuponEval = evalCupon(promoCode, totalCart);
const cuponDiscount = cuponEval.discount;
const finalTotal = Math.max(totalCart - discountFromPoints - decantComboDiscount - cuponDiscount, 0);

const handleAccountAuth = async () => {
setAccountError("");
if (!accountEmail.trim() || !accountPassword) { setAccountError("Completa tu correo y contrasena"); return; }
if (accountPassword.length < 6) { setAccountError("La contrasena debe tener al menos 6 caracteres"); return; }
setAccountBusy(true);
try {
const mod = await loadAuthMod();
const authInstance = mod.getAuth(app);
if (accountMode === "signup") {
await mod.createUserWithEmailAndPassword(authInstance, accountEmail.trim(), accountPassword);
} else {
await mod.signInWithEmailAndPassword(authInstance, accountEmail.trim(), accountPassword);
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
const mod = await loadAuthMod();
await mod.signOut(mod.getAuth(app));
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
if (!customerName.trim() || !customerAddress.trim() || !paymentMethod) {
setShowCart(true);
return;
}
handleCheckout(newCart);
};

// Arma el pedido y lo manda a pagar de verdad a Mercado Pago (Checkout Pro):
// tarjeta, debito, dinero en cuenta y cuotas, todo eso lo resuelve Mercado
// Pago solo en su propio checkout. Por ahora el descuento por puntos y por
// codigo de referido no se aplican en este medio de pago (si el cliente
// quiere usarlos, elige transferencia o efectivo).
const handleMercadoPagoCheckout = async (cartUsed, totalCartUsed) => {
let usedDiscount = 0;
const decantLinesUsed = cartUsed.filter(i => i.isDecant);
const decantComboCountUsed = new Set(decantLinesUsed.map(i => i.id.split("_decant")[0])).size;
if (decantComboCountUsed >= DECANT_COMBO_MIN) {
const decantComboSubtotalUsed = decantLinesUsed.reduce((acc, i) => acc + (Number(i.precio) || 0) * i.qty, 0);
const decantComboDiscountUsed = Math.round(decantComboSubtotalUsed * DECANT_COMBO_DISCOUNT_PCT);
if (decantComboDiscountUsed > 0) usedDiscount += decantComboDiscountUsed;
}
const cuponUsadoMp = evalCupon(promoCode, totalCartUsed);
if (cuponUsadoMp.discount > 0) usedDiscount += cuponUsadoMp.discount;
const totalAEnviar = Math.max(totalCartUsed - usedDiscount, 0);
const orderId = "EP" + Date.now().toString(36).toUpperCase();
try {
localStorage.setItem("mpPedidoPendiente", JSON.stringify({
orderId, cartUsed, customerName: customerName.trim(), customerAddress: customerAddress.trim(),
promoCode, customerPhone, isGift, giftMessage, hideGiftPrice, giftWrap, totalAEnviar,
}));
} catch (e) {}
const resp = await fetch("/api/create-preference", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
total: totalAEnviar,
title: "Pedido Esencia Perfumeria (" + cartUsed.reduce((a, i) => a + i.qty, 0) + " productos)",
orderId,
}),
});
const data = await resp.json().catch(() => ({}));
if (!resp.ok || !data.init_point) throw new Error((data && data.error) || "No pudimos iniciar el pago con Mercado Pago.");
return data.init_point;
};

const handleCheckout = async (cartOverride) => {
if (!customerName.trim() || !customerAddress.trim() || !paymentMethod) {
setCheckoutError("Completa tu nombre, direccion y forma de pago (transferencia, Mercado Pago o efectivo) para poder enviar el pedido.");
setShowCart(true);
return;
}
setCheckoutError("");
const waWindow = window.open("", "_blank");
// Mientras se calculan puntos/descuentos/referidos (varios pasos que hablan con la
// base de datos, uno atras del otro) esta pestana quedaria en blanco unos segundos.
// Le ponemos un mensaje de carga para que no parezca que el pedido no funciono.
if (waWindow) {
try {
waWindow.document.write(
'<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preparando tu pedido...</title>' +
'<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
'background:#0b0b0b;font-family:system-ui,-apple-system,sans-serif;color:#fff;text-align:center;}' +
'.spinner{width:36px;height:36px;border:3px solid #2b2b2b;border-top-color:#d4af37;border-radius:50%;' +
'margin:0 auto 18px;animation:spin .8s linear infinite;}@keyframes spin{to{transform:rotate(360deg);}}' +
'p{color:#d4af37;font-size:15px;font-weight:600;margin:0;}</style></head><body>' +
'<div><div class="spinner"></div><p>Preparando tu pedido...</p></div></body></html>'
);
waWindow.document.close();
} catch (e) {}
}
const cartUsed = cartOverride || cart;
const totalCartUsed = cartUsed.reduce((acc, i) => acc + (Number(i.precio) || 0) * i.qty, 0);
try {
if (window.fbq) window.fbq("track", "InitiateCheckout", { value: totalCartUsed, currency: "ARS", num_items: cartUsed.reduce((a, i) => a + i.qty, 0), content_type: "product", contents: cartUsed.map(i => ({ id: i.id, quantity: i.qty })) });
if (window.gtag) window.gtag("event", "begin_checkout", { currency: "ARS", value: totalCartUsed, items: cartUsed.map(i => ({ item_id: i.id, item_name: getProductName(i), quantity: i.qty, price: Number(i.precio) || 0 })) });
} catch (e) {}
if (paymentMethod === "mercadopago") {
try {
const initPoint = await handleMercadoPagoCheckout(cartUsed, totalCartUsed);
if (waWindow) { waWindow.location.href = initPoint; } else { window.location.href = initPoint; }
} catch (e) {
console.error("MP_CHECKOUT_ERROR", e);
if (waWindow) { try { waWindow.close(); } catch (er) {} }
setCheckoutError("No pudimos iniciar el pago con Mercado Pago. Proba de nuevo en un momento o elegi otro medio de pago.");
setShowCart(true);
}
return;
}
let msg = "Hola! Quiero pedir: " + cartUsed.map(i => getProductName(i) + " x" + i.qty).join(", ");
msg += " - Nombre: " + customerName.trim();
msg += " - Direccion de envio: " + customerAddress.trim();
if (promoCode) msg += " - Codigo promocional: " + promoCode;
if (customerPhone) msg += " - Mi telefono: " + customerPhone;
if (isGift) msg += " - Es un regalo" + (giftMessage.trim() ? (": \"" + giftMessage.trim() + "\"") : "") + (hideGiftPrice ? " (IMPORTANTE: no mostrar el precio en el paquete)" : "") + (giftWrap ? " - Con envoltorio de regalo (sin costo)" : "");
if (paymentMethod === "transferencia") msg += " - Pago por transferencia bancaria (ya envio el comprobante por este chat)";
else if (paymentMethod === "efectivo") msg += " - Pago en efectivo al momento de la entrega";
if (totalCartUsed >= FREE_SHIPPING_THRESHOLD) msg += " - Envio gratis a todo el pais (el pedido supera $" + FREE_SHIPPING_THRESHOLD.toLocaleString("es-CL") + ")";
let usedDiscount = 0;
const decantLinesUsed = cartUsed.filter(i => i.isDecant);
const decantComboCountUsed = new Set(decantLinesUsed.map(i => i.id.split("_decant")[0])).size;
if (decantComboCountUsed >= DECANT_COMBO_MIN) {
const decantComboSubtotalUsed = decantLinesUsed.reduce((acc, i) => acc + (Number(i.precio) || 0) * i.qty, 0);
const decantComboDiscountUsed = Math.round(decantComboSubtotalUsed * DECANT_COMBO_DISCOUNT_PCT);
if (decantComboDiscountUsed > 0) {
usedDiscount += decantComboDiscountUsed;
msg += " - Set de " + decantComboCountUsed + " decants distintos: " + Math.round(DECANT_COMBO_DISCOUNT_PCT * 100) + "% OFF ($" + decantComboDiscountUsed.toLocaleString("es-CL") + ")";
}
}
const cuponUsado = evalCupon(promoCode, totalCartUsed);
if (cuponUsado.discount > 0) {
usedDiscount += cuponUsado.discount;
msg += " - Cupon " + cuponUsado.cupon.id + ": " + formatPrice(cuponUsado.discount) + " de descuento";
}
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
// Guardamos nombre y WhatsApp junto a los puntos (ademas del email) para
// poder mandar despues un recordatorio de "te queda credito sin usar" desde
// el panel de administracion, sin pedirle nada extra al cliente.
await setDoc(ref, { email: user.email, puntos: updated, nombre: customerName.trim(), telefono: customerPhone.trim() || null }, { merge: true });
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
// Registro del pedido para el panel de administracion. No confirma que la
// transferencia o el efectivo se hayan cobrado de verdad (eso lo coordina el
// negocio por WhatsApp); solo deja constancia de que el pedido se mando.
try {
await addDoc(collection(db, "pedidos"), {
items: cartUsed.map(i => ({ id: i.id, nombre: getProductName(i), qty: i.qty, precio: Number(i.precio) || 0 })),
subtotal: totalCartUsed,
descuento: usedDiscount,
total: totalAEnviar,
cuponCodigo: cuponUsado.cupon ? cuponUsado.cupon.id : null,
medioPago: paymentMethod,
origen: "whatsapp",
estado: "enviado",
nombre: customerName.trim(),
direccion: customerAddress.trim(),
telefono: customerPhone.trim() || null,
esRegalo: !!isGift,
uid: user ? user.uid : null,
createdAt: serverTimestamp(),
});
} catch (e) { console.error("PEDIDO_LOG_ERROR", e); }
// Evento de Compra para Meta Pixel / Google Ads: en transferencia/efectivo
// no hay forma de confirmar el cobro desde acá (eso lo hace el negocio por
// WhatsApp), pero este es el momento en que el pedido queda armado y listo
// para pagar, asi que igual sirve para que las campanas aprendan a buscar
// gente que de verdad termina el pedido, no solo gente que escribe.
try {
if (window.fbq) window.fbq("track", "Purchase", { value: totalAEnviar, currency: "ARS", content_type: "product", contents: cartUsed.map(i => ({ id: i.id, quantity: i.qty })) });
if (window.gtag) window.gtag("event", "purchase", { transaction_id: "wa_" + Date.now(), value: totalAEnviar, currency: "ARS", items: cartUsed.map(i => ({ item_id: i.id, item_name: getProductName(i), quantity: i.qty, price: Number(i.precio) || 0 })) });
} catch (e) {}
const waUrl = "https://wa.me/2914261941?text=" + encodeURIComponent(msg);
if (waWindow) { waWindow.location.href = waUrl; } else { window.location.href = waUrl; }
setTimeout(() => {
if (referralCode) {
showToast("Gracias por tu pedido! Comparti tu codigo " + referralCode + " y gana $5.000");
} else {
showToast("Gracias por tu pedido! Sumate a la Lista VIP de WhatsApp para enterarte de las proximas promos");
}
}, 1200);
};

const formatPrice = (p) => {
if (p === "" || p === null || p === undefined) return "Consultar";
const n = Number(p);
if (isNaN(n)) return "Consultar";
return "$" + n.toLocaleString("es-CL");
};

const getProductName = (p) => p.nombre || p.name || p.title || "Producto";
const getProductPrice = (p) => p.precio || p.price || 0;
// Link de WhatsApp con el carrito actual ya redactado: para quien prefiere
// consultar antes de completar nombre/direccion, o directamente prefiere
// cerrar el pedido charlando por WhatsApp en vez de por el formulario. No
// reemplaza el "Pedir por WhatsApp" del checkout (ese ya manda el pedido
// armado con todos los datos); este es un atajo mas informal, disponible
// apenas hay productos en el carrito.
const buildCartWhatsAppUrl = () => {
  const lineas = cart.map(i => `- ${i.qty}x ${getProductName(i)} (${formatPrice(getProductPrice(i))})`).join("\n");
  const msg = `Hola! Te consulto por estos productos de mi carrito:\n${lineas}\nTotal: ${formatPrice(totalCart)}`;
  return "https://wa.me/2914261941?text=" + encodeURIComponent(msg);
};
const getProductOriginalPrice = (p) => p.precioOriginal || null;
const getDiscountPercent = (p) => {
const orig = getProductOriginalPrice(p);
const price = getProductPrice(p);
if (!orig || orig <= price) return null;
return Math.round((1 - price / orig) * 100);
};
const getProductImage = (p) => p.imageUrl || p.foto || p.image || p.img || "";
// size: sufijo de tamano de Imgur ("t" ~160px, "m" ~320px, "l" ~640px, "h" ~1024px).
// Usar el tamano mas chico que alcance segun donde se muestra la imagen ahorra
// datos moviles: no tiene sentido bajar una imagen de 640px para un thumbnail de 60px.
const optimizeImg = (url, size = "l") => {
  if (!url) return url;
  const m = url.match(/^(https?:\/\/i\.imgur\.com\/[a-zA-Z0-9]+)(\.(?:jpe?g|png|gif))$/i);
  return m ? `${m[1]}${size}${m[2]}` : url;
};
const getProductDisp = (p) => p.disponibilidad || "stock";
const getProductDias = (p) => p.diasHabiles || "3-5";
const Q4_OCCASIONS = [
{ name: "el Dia de la Madre", date: "2026-10-18" },
{ name: "el Black Friday", date: "2026-11-27" },
{ name: "Navidad", date: "2026-12-25" },
{ name: "el Dia de Reyes", date: "2027-01-06" },
];
const SHIPPING_TRANSIT_DAYS = 3;
const formatShortDateEs = (d) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });
const getOrderCutoffMessage = (cart) => {
if (!cart || cart.length === 0) return null;
const now = new Date();
const pedidoItems = cart.filter(i => getProductDisp(i) === "pedido");
let prepDays = 1;
if (pedidoItems.length > 0) {
prepDays = Math.max(...pedidoItems.map(i => {
const n = parseInt(i.diasHabiles, 10);
return Number.isFinite(n) ? n : 3;
}));
}
const leadDays = prepDays + SHIPPING_TRANSIT_DAYS;
for (const occ of Q4_OCCASIONS) {
const occDate = new Date(occ.date + "T00:00:00");
if (occDate <= now) continue;
const daysUntil = Math.ceil((occDate - now) / 86400000);
if (daysUntil > 42) continue;
const cutoff = new Date(occDate.getTime() - leadDays * 86400000);
if (cutoff > now) {
return "🎁 Pedi antes del " + formatShortDateEs(cutoff) + " para que llegue a tiempo para " + occ.name + ".";
}
return "⏰ Estamos cerca de " + occ.name + " — coordina tu pedido cuanto antes para llegar a tiempo.";
}
return null;
};
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
const cartSuggestions = products.filter(p => isPerfume(p) && !cart.some(c => c.id === p.id) && (recentlyViewed.includes(p.id) || (p.etiquetas || []).includes("mas_vendidos"))).sort((a, b) => (recentlyViewed.includes(b.id) ? 1 : 0) - (recentlyViewed.includes(a.id) ? 1 : 0)).slice(0, 3);
// Productos parecidos para mostrar debajo de la ficha de un producto: primero
// misma marca, despues mismo tipo/genero, despues misma categoria, sin repetir
// y sin mostrar el mismo producto ni productos agotados.
const getSimilarProducts = (product) => {
if (!product) return [];
const pool = products.filter(p => p.id !== product.id && getProductDisp(p) !== "agotado");
const sameMarca = product.marca ? pool.filter(p => p.marca && p.marca === product.marca) : [];
const sameTipoGenero = pool.filter(p => (product.tipoPerfume && p.tipoPerfume === product.tipoPerfume) || (product.genero && p.genero === product.genero));
const sameCategoria = pool.filter(p => getProductCategoria(p) === getProductCategoria(product));
const seen = new Set();
const combined = [];
[...sameMarca, ...sameTipoGenero, ...sameCategoria].forEach(p => { if (!seen.has(p.id)) { seen.add(p.id); combined.push(p); } });
return combined.slice(0, 10);
};
const pdpSimilarProducts = selectedProduct ? getSimilarProducts(selectedProduct) : [];
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
// JSON-LD "FAQPage" con las mismas preguntas de assistantFaqs (arriba): a
// Google le sirve el mismo contenido que ya escribieron para el asistente,
// sin duplicar texto en ningun lado. assistantFaqs es una lista fija, asi
// que este bloque se arma una sola vez al montar.
useEffect(() => {
try {
let script = document.getElementById("ld-faq");
if (!script) {
script = document.createElement("script");
script.type = "application/ld+json";
script.id = "ld-faq";
document.head.appendChild(script);
}
script.textContent = JSON.stringify({
"@context": "https://schema.org",
"@type": "FAQPage",
"mainEntity": assistantFaqs.map((f) => ({
"@type": "Question",
"name": f.q,
"acceptedAnswer": { "@type": "Answer", "text": f.a },
})),
});
} catch {}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
const normalizeTxt = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const SEARCH_SYNONYMS = { dulce: ["dulce","vainilla","gourmand","caramelo","azucar","goloso"], dulces: ["dulce","vainilla","gourmand","caramelo","azucar"], fresco: ["fresco","citrico","acuatico","marino","liviano"], frescos: ["fresco","citrico","acuatico","marino"], frescura: ["fresco","citrico"], citrico: ["citrico","fresco"], citricos: ["citrico","fresco"], amaderado: ["amaderado","madera"], amaderados: ["amaderado","madera"], madera: ["amaderado","madera"], maderoso: ["amaderado","madera"], floral: ["floral","flores"], florales: ["floral","flores"], flores: ["floral"], frutal: ["frutal","fruta"], frutales: ["frutal","fruta"], afrutado: ["frutal","fruta"], oriental: ["oriental","especiado","ambar"], orientales: ["oriental","especiado","ambar"], especiado: ["especiado","oriental"], intenso: ["intenso","fuerte"], fuerte: ["intenso","fuerte"], suave: ["suave","delicado"], delicado: ["suave","delicado"], elegante: ["elegante","sofisticado"], sofisticado: ["elegante","sofisticado"], verano: ["verano"], veraniego: ["verano"], invierno: ["invierno"], invernal: ["invierno"], oficina: ["oficina","trabajo"], trabajo: ["oficina"], diario: ["todo el ano","versatil"], noche: ["noche","citas"], cita: ["citas"], citas: ["citas"], romantico: ["citas"], romantica: ["citas"], regalo: ["regalar"], regalar: ["regalar"], economico: ["economico"], barato: ["economico"], baratos: ["economico"], hombre: ["masculino"], hombres: ["masculino"], masculino: ["masculino"], mujer: ["femenino"], mujeres: ["femenino"], femenino: ["femenino"], unisex: ["unisex"], nicho: ["arabe","nicho"], arabe: ["arabe"], arabes: ["arabe"], disenador: ["disenador"] };
const SEARCH_STOPWORDS = new Set(["quiero","quisiera","busco","buscando","necesito","algo","un","una","unos","unas","el","la","los","las","de","del","para","por","que","sea","seas","con","como","me","gustaria","tipo","estilo","perfume","perfumes","fragancia","fragancias","huele","huela","parecido","parecidos","parecida","parecidas","similar","similares","a","al","o","y","es","esta","este","mas","onda"]);

const buildProductHaystack = (p) => {
const generoTxt = { masculino: "masculino hombre", femenino: "femenino mujer", unisex: "unisex" }[p.genero] || "";
const tempTxt = { invierno: "invierno frio calido amaderado especiado", verano: "verano fresco citrico liviano", todo_anio: "todo el ano versatil diario" }[p.temporada] || "";
const tipoTxt = { arabe: "arabe arabes nicho", disenador: "disenador designer" }[p.tipoPerfume] || "";
const etiquetasTxt = (p.etiquetas || []).map((e) => e.replace(/_/g, " ")).join(" ");
return normalizeTxt([getProductName(p), p.marca, p.descripcion, p.notas, p.notasSalida, p.notasCorazon, p.notasFondo, p.inspiradoEn, generoTxt, tempTxt, tipoTxt, etiquetasTxt, p.duracion].filter(Boolean).join(" "));
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
const trendProducts = dedupedProducts.filter(p => (p.temporada || "") === "verano" && getProductDisp(p) !== "agotado");
const adminProductsList = products.filter(p => p.id !== "_site_banner" && p.id !== "_site_catalog_order");
// Aplica el orden elegido por el admin (panel "Orden del catalogo") a una
// lista ya filtrada de productos. Se usa solo cuando el cliente tiene el
// sort en "Novedades" (relevancia); si el cliente elige otro orden, ese manda.
const applyCatalogOrder = (list, config) => {
if (!config || !config.modo || config.modo === "novedades") return list;
if (config.modo === "categoria" && config.categoriaClave) {
const [campo, valor] = config.categoriaClave.split(":");
const matches = [];
const rest = [];
list.forEach(p => {
const esMatch = campo === "etiqueta" ? (p.etiquetas || []).includes(valor) : (p[campo] || "") === valor;
(esMatch ? matches : rest).push(p);
});
return [...matches, ...rest];
}
if (config.modo === "manual" && Array.isArray(config.manualIds) && config.manualIds.length) {
const idIndex = new Map(config.manualIds.map((id, i) => [id, i]));
const featured = [];
const rest = [];
list.forEach(p => { (idIndex.has(p.id) ? featured : rest).push(p); });
featured.sort((a, b) => idIndex.get(a.id) - idIndex.get(b.id));
return [...featured, ...rest];
}
if (config.modo === "aleatorio") {
// Orden aleatorio pero estable dentro de la visita: usa una semilla nueva
// por sesion (catalogRandomSeed) en vez de una semilla fija por dia, asi
// el mezclado cambia cada vez que alguien entra al sitio en vez de
// repetir siempre el mismo orden.
const rankFor = (id) => {
let h = 2166136261;
const s = catalogRandomSeed + "|" + id;
for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
return (h >>> 0) / 4294967295;
};
return [...list].sort((a, b) => rankFor(a.id) - rankFor(b.id));
}
return list;
};

const getQuizRecommendations = () => {
const { genero, ocasion, aroma, tipo } = quizAnswers;
let pool = dedupedProducts.filter(isPerfume);
if (genero) pool = pool.filter(p => !p.genero || p.genero === genero || p.genero === "unisex");
if (tipo) pool = pool.filter(p => !p.tipoPerfume || p.tipoPerfume === tipo);
const keywords = aroma ? (AROMA_KEYWORDS[aroma] || []) : [];
const scored = pool.map(p => {
const haystack = buildProductHaystack(p);
let score = 0;
keywords.forEach(k => { if (haystack.includes(normalizeTxt(k))) score += 3; });
if (ocasion && (p.etiquetas || []).includes(ocasion)) score += 4;
if (genero && p.genero === genero) score += 2;
if (tipo && p.tipoPerfume === tipo) score += 1;
if ((p.etiquetas || []).includes("mas_vendidos")) score += 1;
if (getProductDisp(p) === "stock") score += 1;
return { p, score };
});
scored.sort((a, b) => b.score - a.score);
return scored.slice(0, 6).map(s => s.p);
};

let filteredProducts = dedupedProducts.filter(p => {

const q = searchQuery.trim();
if (q) {
if (smartProductScore(p, q) <= 0) return false;
}
if (filter === "stock") return getProductDisp(p) === "stock";
if (filter === "pedido") return getProductDisp(p) === "pedido";
if (filter === "perfumes") return isPerfume(p);
if (filter === "decants") return hasDecant(p); if (filter === "menos100k") return getProductPrice(p) < 100000; if (filter === "arabes") return (p.tipoPerfume || "") === "arabe"; if (filter === "disenador") return (p.tipoPerfume || "") === "disenador"; if (filter === "favoritos") return favorites.includes(p.id); if (filter === "tendenciasverano2027") return (p.temporada || "") === "verano" && getProductDisp(p) !== "agotado"; if (TAG_OPTIONS.map(t => t.key).includes(filter)) return (p.etiquetas || []).includes(filter);
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
} else if (sortBy === "relevancia") {
filteredProducts = applyCatalogOrder(filteredProducts, catalogOrderConfig);
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
navBlogBtn: { position: "fixed", top: "16px", right: "390px", background: "transparent", color: "#d4af37", border: "1px solid #d4af37", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", zIndex: 55, textDecoration: "none", display: "flex", alignItems: "center" },
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
sectionCompact: { padding: "16px 20px 12px", maxWidth: "1200px", margin: "0 auto", background: "#f5efe0", borderRadius: "20px" },
sectionTitle: { fontSize: "24px", fontWeight: "700", marginBottom: "24px", borderBottom: "2px solid #d4af37", paddingBottom: "8px", fontFamily: "'Playfair Display', serif", color: "#1a1a1a" },
sectionTitleCompact: { fontSize: "14px", fontWeight: "700", marginBottom: "8px", borderBottom: "2px solid #d4af37", paddingBottom: "5px", fontFamily: "'Playfair Display', serif", color: "#1a1a1a" },
filterBar: { display: "flex", gap: "10px", marginBottom: "10px", flexWrap: "wrap", justifyContent: "center" },
advFilterWrap: { maxWidth: "900px", margin: "0 auto 28px", textAlign: "center" },
advFilterToggle: { background: "transparent", border: "1px solid #d4af37", color: "#d4af37", padding: "7px 14px", borderRadius: "24px", cursor: "pointer", fontSize: "12.5px", fontWeight: "600" },
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
filterBtnPrimary: (a) => ({ background: a ? "linear-gradient(135deg, #d4af37, #a8842c)" : "#2b2210", color: a ? "#000000" : "#d4af37", border: a ? "none" : "2px solid #d4af37", padding: "8px 16px", borderRadius: "20px", cursor: "pointer", fontWeight: "800", fontSize: "13px" }),
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
ratingBadge: { display: "inline-flex", alignItems: "center", gap: "4px", color: "#d4af37", fontSize: "12px", fontWeight: "700" },
badgeStock: { display: "inline-flex", alignItems: "center", gap: "5px", color: "#9ddb9d", fontSize: "12px", fontWeight: "600" },
badgeStockDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#4caf50", flexShrink: 0 },
urgencyBadge: { display: "inline-block", background: "rgba(212,175,55,0.14)", color: "#e0b84a", border: "1px solid rgba(212,175,55,0.4)", padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700" },
resenaCard: { background: "#ffffff", borderRadius: "12px", padding: "18px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", border: "1px solid #e8ddc0" },
resenaFoto: { width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", border: "2px solid #d4af37" },
resenaAvatar: { width: "48px", height: "48px", borderRadius: "50%", background: "#d4af37", color: "#000000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "18px" },
badgePedido: { display: "inline-flex", alignItems: "center", gap: "5px", color: "#bdbdbd", fontSize: "12px", fontWeight: "600" },
badgeAgotado: { display: "inline-flex", alignItems: "center", gap: "5px", color: "#e08a8a", fontSize: "12px", fontWeight: "600" },
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
cartOverlay: { position: "fixed", right: 0, top: 0, bottom: 0, width: "min(500px, 100vw)", background: "#0f0f0f", borderLeft: "2px solid #d4af37", padding: "70px 24px 20px 24px", overflowY: "auto", zIndex: 101, boxSizing: "border-box" },
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
reviewNotice: { position: "fixed", left: "18px", bottom: "90px", zIndex: 150, background: "#1a1a1a", border: "1px solid #2b2b2b", borderLeft: "3px solid #d4af37", borderRadius: "10px", padding: "14px 34px 14px 16px", maxWidth: "290px", boxShadow: "0 10px 28px rgba(0,0,0,0.45)", animation: "toastPop 0.3s ease" },
reviewNoticeClose: { position: "absolute", top: "8px", right: "10px", background: "none", border: "none", color: "#7a7a7a", fontSize: "16px", cursor: "pointer", lineHeight: 1, padding: "4px" },
cartReminder: { position: "fixed", right: "18px", bottom: "90px", zIndex: 150, background: "#1a1a1a", border: "1px solid #2b2b2b", borderLeft: "3px solid #d4af37", borderRadius: "10px", padding: "14px 34px 14px 16px", maxWidth: "290px", boxShadow: "0 10px 28px rgba(0,0,0,0.45)", animation: "toastPop 0.3s ease" },
cartReminderClose: { position: "absolute", top: "8px", right: "10px", background: "none", border: "none", color: "#7a7a7a", fontSize: "16px", cursor: "pointer", lineHeight: 1, padding: "4px" },
favBtn: (active) => ({ position: "absolute", top: "10px", right: "10px", width: "34px", height: "34px", borderRadius: "50%", border: "none", background: active ? "rgba(212,175,55,0.95)" : "rgba(0,0,0,0.55)", color: active ? "#000" : "#fff", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5, lineHeight: 1 }),
mobileCartBar: { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 90, background: "linear-gradient(135deg, #d4af37, #a8842c)", color: "#000", display: "none", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer", boxShadow: "0 -4px 16px rgba(0,0,0,0.35)", fontWeight: 700, boxSizing: "border-box" },
mobileCartBarText: { fontSize: "13px" },
mobileCartBarBtn: { background: "#000", color: "#d4af37", padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: 800 },
qtyStepperRow: { display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" },
qtyBtn: { width: "26px", height: "26px", borderRadius: "6px", border: "1px solid #2b2b2b", background: "#1a1a1a", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 },
qtyValue: { minWidth: "18px", textAlign: "center", fontWeight: 700, fontSize: "14px" },
quickBuyBtn: { display: "block", width: "100%", padding: "13px", marginTop: "10px", fontSize: "15px", fontWeight: 800, borderRadius: "10px", border: "2px solid #d4af37", background: "transparent", color: "#d4af37", cursor: "pointer" },
recentlyViewedWrap: { maxWidth: "1200px", margin: "0 auto", padding: "8px 20px 4px", textAlign: "center" },
recentlyViewedToggle: { background: "transparent", border: "1px solid #d4af37", color: "#a8842c", padding: "6px 14px", borderRadius: "16px", cursor: "pointer", fontSize: "12px", fontWeight: "700" },
recentlyViewedRow: { display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" },
recentlyViewedCard: { flexShrink: 0, width: "88px", cursor: "pointer" },
recentlyViewedImg: { width: "88px", height: "88px", objectFit: "contain", background: "#fff", borderRadius: "10px", border: "1px solid #e8ddc0" },
recentlyViewedName: { fontSize: "10.5px", color: "#1a1a1a", marginTop: "4px", lineHeight: "1.25", minHeight: "22px" },
recentlyViewedPrice: { fontSize: "11.5px", fontWeight: 800, color: "#8a6d1f" },
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
<button onClick={async () => { const mod = await loadAuthMod(); await mod.signOut(mod.getAuth(app)); setIsAdmin(false); setPage("adminLogin"); }} style={S.btnGray}>Cerrar Sesion</button>
</div>
</div>
<div style={S.adminWrap}>
<h2 style={{ color: "#d4af37", marginBottom: "24px", fontFamily: "'Playfair Display', serif" }}>Panel de Administracion</h2>
{(() => {
const bf = bannerForm || { bannerEnabled: (bannerConfig && bannerConfig.bannerEnabled) || false, bannerTexto: (bannerConfig && bannerConfig.bannerTexto) || "", bannerLink: (bannerConfig && bannerConfig.bannerLink) || "", bannerCtaLabel: (bannerConfig && bannerConfig.bannerCtaLabel) || "", bannerFechaObjetivo: (bannerConfig && bannerConfig.bannerFechaObjetivo) || "" };
return (
<div style={{ ...S.adminCard, marginBottom: "24px" }}>
<h3 style={{ margin: "0 0 6px" }}>📣 Banner del sitio (Dia de la Madre, Black Friday, Navidad...)</h3>
<p style={{ margin: "0 0 16px", color: "#bdbdbd", fontSize: "13px" }}>Se muestra arriba de todo el sitio. Se puede activar y desactivar cuando quieras, sin pedirme un cambio de codigo.</p>
<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "14px", cursor: "pointer", marginBottom: "12px" }}>
<input type="checkbox" checked={!!bf.bannerEnabled} onChange={e => setBannerForm({ ...bf, bannerEnabled: e.target.checked })} />
Mostrar el banner en el sitio
</label>
<label style={S.label}>Texto del banner</label>
<input type="text" value={bf.bannerTexto} onChange={e => setBannerForm({ ...bf, bannerTexto: e.target.value })} style={{ ...S.input, marginBottom: "12px" }} placeholder="Ej: Regalos para el Dia de la Madre - envios asegurados antes del 18/10" />
<div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
<div style={{ flex: "1 1 220px" }}>
<label style={S.label}>Link del boton (opcional)</label>
<input type="text" value={bf.bannerLink} onChange={e => setBannerForm({ ...bf, bannerLink: e.target.value })} style={{ ...S.input, marginBottom: "12px" }} placeholder="https://wa.me/... o una seccion del sitio" />
</div>
<div style={{ flex: "1 1 160px" }}>
<label style={S.label}>Texto del boton (opcional)</label>
<input type="text" value={bf.bannerCtaLabel} onChange={e => setBannerForm({ ...bf, bannerCtaLabel: e.target.value })} style={{ ...S.input, marginBottom: "12px" }} placeholder="Ver mas" />
</div>
</div>
<label style={S.label}>Cuenta regresiva hasta (opcional, ej: Black Friday)</label>
<input type="datetime-local" value={bf.bannerFechaObjetivo} onChange={e => setBannerForm({ ...bf, bannerFechaObjetivo: e.target.value })} style={{ ...S.input, marginBottom: "14px" }} />
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<button onClick={handleSaveBanner} disabled={bannerSaving} style={{ ...S.btn, padding: "10px 20px", opacity: bannerSaving ? 0.6 : 1 }}>{bannerSaving ? "Guardando..." : "Guardar banner"}</button>
{bannerForm && <button onClick={() => setBannerForm(null)} style={{ ...S.btnOutline, padding: "10px 20px" }}>Descartar cambios</button>}
</div>
</div>
); })()}
{(() => {
const co = catalogOrderForm || { modo: (catalogOrderConfig && catalogOrderConfig.modo) || "novedades", categoriaClave: (catalogOrderConfig && catalogOrderConfig.categoriaClave) || "", manualIds: (catalogOrderConfig && catalogOrderConfig.manualIds) || [] };
const manualProducts = co.manualIds.map(id => dedupedProducts.find(p => p.id === id)).filter(Boolean);
const manualSearchResults = catalogManualSearch.trim() ? dedupedProducts.filter(p => !co.manualIds.includes(p.id) && normalizeTxt(getProductName(p)).includes(normalizeTxt(catalogManualSearch))).slice(0, 8) : [];
const moveManual = (idx, dir) => {
const ids = [...co.manualIds];
const newIdx = idx + dir;
if (newIdx < 0 || newIdx >= ids.length) return;
[ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
setCatalogOrderForm({ ...co, manualIds: ids });
};
const removeManual = (id) => setCatalogOrderForm({ ...co, manualIds: co.manualIds.filter(x => x !== id) });
const addManual = (id) => { setCatalogOrderForm({ ...co, manualIds: [...co.manualIds, id] }); setCatalogManualSearch(""); };
return (
<div style={{ ...S.adminCard, marginBottom: "24px" }}>
<h3 style={{ margin: "0 0 6px" }}>🔀 Orden del catálogo</h3>
<p style={{ margin: "0 0 16px", color: "#bdbdbd", fontSize: "13px" }}>Elegi en que orden ven los clientes los productos al entrar a la tienda, en vez de mostrar siempre los cargados mas recientemente primero. Esto aplica cuando el cliente tiene el orden en "Novedades"; si elige "Mas vendidos" o un orden por precio, ese manda.</p>
<div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "14px", cursor: "pointer" }}>
<input type="radio" name="catalogOrderModo" checked={co.modo === "novedades"} onChange={() => setCatalogOrderForm({ ...co, modo: "novedades" })} />
Mas nuevo primero (orden actual por defecto)
</label>
<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "14px", cursor: "pointer" }}>
<input type="radio" name="catalogOrderModo" checked={co.modo === "categoria"} onChange={() => setCatalogOrderForm({ ...co, modo: "categoria" })} />
Por categoria (mostrar primero una categoria elegida)
</label>
{co.modo === "categoria" && (
<div style={{ marginLeft: "26px" }}>
<select style={S.select} value={co.categoriaClave} onChange={e => setCatalogOrderForm({ ...co, categoriaClave: e.target.value })}>
<option value="">Elegi una categoria...</option>
{CATALOG_ORDER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
</select>
</div>
)}
<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "14px", cursor: "pointer" }}>
<input type="radio" name="catalogOrderModo" checked={co.modo === "manual"} onChange={() => setCatalogOrderForm({ ...co, modo: "manual" })} />
Manual (elijo yo cuales aparecen primero)
</label>
{co.modo === "manual" && (
<div style={{ marginLeft: "26px" }}>
<input type="text" placeholder="Buscar perfume para agregar..." value={catalogManualSearch} onChange={e => setCatalogManualSearch(e.target.value)} style={{ ...S.input, marginBottom: "8px" }} />
{manualSearchResults.length > 0 && (
<div style={{ background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "8px", marginBottom: "10px", overflow: "hidden" }}>
{manualSearchResults.map(p => (
<div key={p.id} onClick={() => addManual(p.id)} style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px", borderBottom: "1px solid #2b2b2b" }}>+ {getProductName(p)}</div>
))}
</div>
)}
{manualProducts.length === 0 ? (
<p style={{ color: "#8a8a8a", fontSize: "13px" }}>Todavia no elegiste productos. Los que agregues van a aparecer primero, en el orden de esta lista.</p>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
{manualProducts.map((p, idx) => (
<div key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "6px 10px" }}>
<span style={{ color: "#d4af37", fontWeight: "700", fontSize: "13px", minWidth: "20px" }}>{idx + 1}</span>
<span style={{ flex: 1, fontSize: "13px" }}>{getProductName(p)}</span>
<button onClick={() => moveManual(idx, -1)} disabled={idx === 0} style={{ ...S.btnGray, padding: "4px 8px", opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
<button onClick={() => moveManual(idx, 1)} disabled={idx === manualProducts.length - 1} style={{ ...S.btnGray, padding: "4px 8px", opacity: idx === manualProducts.length - 1 ? 0.4 : 1 }}>↓</button>
<button onClick={() => removeManual(p.id)} style={{ ...S.btnGray, padding: "4px 8px" }}>✕</button>
</div>
))}
</div>
)}
</div>
)}
<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "14px", cursor: "pointer" }}>
<input type="radio" name="catalogOrderModo" checked={co.modo === "aleatorio"} onChange={() => setCatalogOrderForm({ ...co, modo: "aleatorio" })} />
Aleatorio (mezclado entre todos, cambia solo)
</label>
</div>
<div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
<button onClick={handleSaveCatalogOrder} disabled={catalogOrderSaving} style={{ ...S.btn, padding: "10px 20px", opacity: catalogOrderSaving ? 0.6 : 1 }}>{catalogOrderSaving ? "Guardando..." : "Guardar orden"}</button>
{catalogOrderForm && <button onClick={() => setCatalogOrderForm(null)} style={{ ...S.btnOutline, padding: "10px 20px" }}>Descartar cambios</button>}
</div>
</div>
); })()}
<div style={{ ...S.adminCard, marginBottom: "24px" }}>
<h3 style={{ margin: "0 0 6px" }}>🏷️ Cupones de descuento</h3>
<p style={{ margin: "0 0 16px", color: "#bdbdbd", fontSize: "13px" }}>Crea codigos que el cliente ingresa en el carrito para recibir un descuento automatico, igual que el de los sets de decants.</p>
<div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
<div style={{ flex: "1 1 140px" }}>
<label style={S.label}>Codigo</label>
<input type="text" value={cuponForm.codigo} onChange={e => setCuponForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} style={S.input} placeholder="Ej: VERANO10" />
</div>
<div style={{ flex: "1 1 140px" }}>
<label style={S.label}>Tipo</label>
<select style={S.select} value={cuponForm.tipo} onChange={e => setCuponForm(f => ({ ...f, tipo: e.target.value }))}>
<option value="porcentaje">Porcentaje (%)</option>
<option value="monto">Monto fijo ($)</option>
</select>
</div>
<div style={{ flex: "1 1 140px" }}>
<label style={S.label}>{cuponForm.tipo === "monto" ? "Monto a descontar" : "Porcentaje a descontar"}</label>
<input type="number" value={cuponForm.valor} onChange={e => setCuponForm(f => ({ ...f, valor: e.target.value }))} style={S.input} placeholder={cuponForm.tipo === "monto" ? "Ej: 5000" : "Ej: 10"} />
</div>
</div>
<div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
<div style={{ flex: "1 1 180px" }}>
<label style={S.label}>Compra minima (opcional)</label>
<input type="number" value={cuponForm.minCompra} onChange={e => setCuponForm(f => ({ ...f, minCompra: e.target.value }))} style={S.input} placeholder="Ej: 20000" />
</div>
<div style={{ flex: "1 1 180px" }}>
<label style={S.label}>Vence el (opcional)</label>
<input type="date" value={cuponForm.fechaExpiracion} onChange={e => setCuponForm(f => ({ ...f, fechaExpiracion: e.target.value }))} style={S.input} />
</div>
</div>
<button onClick={handleAddCupon} disabled={cuponSaving} style={{ ...S.btn, padding: "10px 20px", opacity: cuponSaving ? 0.6 : 1 }}>{cuponSaving ? "Guardando..." : "Guardar cupon"}</button>
{cupones.length > 0 && (
<div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
{cupones.map(c => (
<div key={c.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "8px 12px", opacity: c.activo ? 1 : 0.5, flexWrap: "wrap" }}>
<strong style={{ color: "#d4af37" }}>{c.id}</strong>
<span style={{ fontSize: "13px", color: "#bdbdbd" }}>{c.tipo === "monto" ? formatPrice(c.valor) : (c.valor + "%")} OFF{c.minCompra ? (" · minimo " + formatPrice(c.minCompra)) : ""}{c.fechaExpiracion ? (" · vence " + c.fechaExpiracion) : ""}</span>
<span style={{ fontSize: "11px", fontWeight: "700", color: c.activo ? "#9ddb9d" : "#e0b84a" }}>{c.activo ? "ACTIVO" : "PAUSADO"}</span>
<div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
<button onClick={() => handleToggleCupon(c)} style={{ ...S.btnOutline, padding: "6px 12px", fontSize: "12px" }}>{c.activo ? "Pausar" : "Activar"}</button>
<button onClick={() => handleDeleteCupon(c.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Eliminar</button>
</div>
</div>
))}
</div>
)}
</div>
<div style={{ ...S.adminCard, marginBottom: "24px" }}>
<h3 style={{ margin: "0 0 6px" }}>📧 Suscriptores al newsletter ({emailSubs.length})</h3>
<p style={{ margin: "0 0 16px", color: "#bdbdbd", fontSize: "13px" }}>Emails que dejaron en el pie del sitio, ademas de la Lista VIP de WhatsApp. Exportalos para mandarles novedades por email.</p>
<button onClick={exportNewsletterToCSV} style={{ ...S.btnOutline, marginBottom: "16px" }}>⬇ Exportar CSV</button>
{emailSubs.length === 0 ? (
<p style={{ color: "#9a9a9a", fontSize: "13px" }}>Todavia no hay suscriptores.</p>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
{emailSubs.map(s => (
<div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "8px 12px" }}>
<span style={{ flex: 1, fontSize: "13px" }}>{s.email || s.id}</span>
<button onClick={() => handleDeleteNewsletterSub(s.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Eliminar</button>
</div>
))}
</div>
)}
</div>
<div style={{ ...S.adminCard, marginBottom: "24px" }}>
<h3 style={{ margin: "0 0 6px" }}>📱 Contactos de WhatsApp del popup ({popupContacts.length})</h3>
<p style={{ margin: "0 0 16px", color: "#bdbdbd", fontSize: "13px" }}>Numeros que dejaron a cambio del cupon de bienvenida. Exportalos para avisarles ofertas y eventos por WhatsApp.</p>
<button onClick={exportPopupContactsToCSV} style={{ ...S.btnOutline, marginBottom: "16px" }}>⬇ Exportar CSV</button>
{popupContacts.length === 0 ? (
<p style={{ color: "#9a9a9a", fontSize: "13px" }}>Todavia no hay contactos.</p>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "260px", overflowY: "auto" }}>
{popupContacts.map(c => (
<div key={c.id} style={{ display: "flex", alignItems: "center", gap: "10px", background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "8px 12px" }}>
<span style={{ flex: 1, fontSize: "13px" }}>{c.telefono || c.id}</span>
<button onClick={() => handleDeletePopupContact(c.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>Eliminar</button>
</div>
))}
</div>
)}
</div>
<div style={{ ...S.adminCard, marginBottom: "24px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
<h3 style={{ margin: 0 }}>📦 Carga Masiva de Productos</h3>
<button onClick={() => setShowBulkUpload(s => !s)} style={S.btnOutline}>{showBulkUpload ? "Ocultar" : "Cargar varios a la vez"}</button>
</div>
{showBulkUpload && (
<div style={{ marginTop: "18px" }}>
<div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
<div style={{ flex: 1, minWidth: "260px", background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "10px", padding: "14px" }}>
<p style={{ margin: "0 0 8px", color: "#d4af37", fontWeight: "700", fontSize: "14px" }}>➕ Para cargar perfumes nuevos</p>
<p style={{ margin: 0, color: "#bdbdbd", fontSize: "13px", lineHeight: "1.6" }}>Descargá la plantilla vacía, completá una fila por perfume nuevo (dejando la columna "id" vacía) y subila.</p>
<button onClick={downloadBulkTemplate} style={{ ...S.btnOutline, marginTop: "10px", width: "100%" }}>⬇ Descargar plantilla vacía</button>
</div>
<div style={{ flex: 1, minWidth: "260px", background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "10px", padding: "14px" }}>
<p style={{ margin: "0 0 8px", color: "#d4af37", fontWeight: "700", fontSize: "14px" }}>🔄 Para reponer stock / editar en masa</p>
<p style={{ margin: 0, color: "#bdbdbd", fontSize: "13px", lineHeight: "1.6" }}>Exportá tu catálogo actual (ya trae el "id" de cada perfume), cambiá lo que necesites (precio, disponibilidad, etc.) y volvé a subir el mismo archivo: actualiza cada producto en vez de duplicarlo.</p>
<button onClick={exportCatalogToCSV} style={{ ...S.btnOutline, marginTop: "10px", width: "100%" }}>⬇ Exportar mi catálogo actual</button>
</div>
</div>
<ol style={{ color: "#bdbdbd", fontSize: "14px", lineHeight: "1.9", paddingLeft: "20px" }}>
<li>Abrí el CSV en Excel o Google Sheets y editalo (para reponer stock, por ejemplo, cambiá la columna <strong>disponibilidad</strong> a "stock" y/o el <strong>precio</strong> en las filas que corresponda; dejá vacías las columnas que no querés tocar).</li>
<li>La imagen es <strong>opcional</strong>: si ya la tenés subida a algún lado, pegá el link en la columna <strong>imageUrl</strong>; para fotos nuevas del celular/compu, dejá esa columna vacía y en <strong>imagen</strong> escribí el nombre exacto del archivo (ej: perfume1.jpg) y más abajo seleccioná esas fotos. Si dejás ambas columnas vacías, el perfume se publica igual con una imagen de "Sin Imagen" y después la editás a mano desde el catálogo.</li>
<li>En <strong>etiquetas</strong> podés escribir varias separadas por "|", por ejemplo: mas_vendidos|top_verano|tendencia_gourmand_oscuro</li>
<li>Guardá como CSV, subilo abajo, revisá la vista previa (te va a decir qué fila es nueva y cuál actualiza un producto existente) y tocá "Publicar todos".</li>
</ol>
<label style={S.label}>1. Subir planilla CSV completa</label>
<input ref={bulkCsvInputRef} type="file" accept=".csv,text/csv" onChange={e => handleBulkCsvSelect(e.target.files[0])} style={{ ...S.input, padding: "8px", marginBottom: "16px" }} />
<label style={S.label}>2. (Opcional) Seleccionar las fotos, si usaste la columna "imagen" en vez de "imageUrl"</label>
<input ref={bulkImagesInputRef} type="file" accept="image/*" multiple onChange={e => handleBulkImagesSelect(e.target.files)} style={{ ...S.input, padding: "8px", marginBottom: "8px" }} />
{bulkImagesCount > 0 && <p style={{ color: "#9ddb9d", fontSize: "13px" }}>{bulkImagesCount} foto(s) seleccionada(s)</p>}
{bulkRows.length > 0 && (
<div style={{ marginTop: "16px" }}>
<p style={{ color: "#d4af37", fontWeight: "700" }}>{bulkRows.length} filas listas para revisar ({bulkRows.filter(r => !bulkRowIsUpdate(r)).length} nuevas, {bulkRows.filter(bulkRowIsUpdate).length} actualizaciones)</p>
<div style={{ overflowX: "auto", marginBottom: "16px" }}>
<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
<thead>
<tr style={{ color: "#d4af37", textAlign: "left" }}>
<th style={{ padding: "6px" }}>Nombre</th>
<th style={{ padding: "6px" }}>Precio</th>
<th style={{ padding: "6px" }}>Marca</th>
<th style={{ padding: "6px" }}>Accion</th>
<th style={{ padding: "6px" }}>Imagen</th>
</tr>
</thead>
<tbody>
{bulkRows.map((r, i) => {
const action = bulkRowAction(r);
return (
<tr key={i} style={{ borderTop: "1px solid #2b2b2b" }}>
<td style={{ padding: "6px" }}>{r.nombre || (action.type === "update" ? action.existing.nombre : <span style={{ color: "#cc6666" }}>Sin nombre</span>)}</td>
<td style={{ padding: "6px" }}>{r.precio ? formatPrice(Number(r.precio)) : (action.type === "update" ? "(sin cambios)" : <span style={{ color: "#cc6666" }}>Sin precio</span>)}</td>
<td style={{ padding: "6px" }}>{r.marca || "-"}</td>
<td style={{ padding: "6px" }}>
{action.type === "new" && <span style={{ color: "#9ddb9d" }}>➕ Nuevo</span>}
{action.type === "update" && <span style={{ color: "#e0b84a" }}>🔄 Actualiza</span>}
{action.type === "error" && <span style={{ color: "#cc6666" }}>✗ {action.msg}</span>}
</td>
<td style={{ padding: "6px" }}>{bulkRowHasImage(r) ? <span style={{ color: "#9ddb9d" }}>✓ OK</span> : <span style={{ color: "#e0b84a" }}>Sin imagen (se publica igual)</span>}</td>
</tr>
);
})}
</tbody>
</table>
</div>
<button onClick={handleBulkPublish} disabled={bulkPublishing} style={{ ...S.btn, width: "100%", padding: "12px", opacity: bulkPublishing ? 0.6 : 1 }}>{bulkPublishing ? `Publicando ${bulkProgress.done}/${bulkProgress.total}...` : `Publicar los ${bulkRows.length} productos`}</button>
</div>
)}
{bulkResults.length > 0 && (
<div style={{ marginTop: "16px" }}>
<p style={{ fontWeight: "700", color: bulkResults.every(r => r.ok) ? "#9ddb9d" : "#e0b84a" }}>{bulkResults.filter(r => r.ok).length} de {bulkResults.length} procesados correctamente</p>
{bulkResults.filter(r => !r.ok).map((r, i) => (
<p key={i} style={{ color: "#cc6666", fontSize: "13px", margin: "4px 0" }}>✗ {r.nombre}: {r.error}</p>
))}
</div>
)}
</div>
)}
</div>
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
<label style={S.label}>Notas olfativas (resumen general)</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Vainilla, Ambar, Cuero" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
<label style={S.label}>Piramide olfativa (opcional, se muestra en la ficha si la cargas)</label>
<input style={{ ...S.input, marginBottom: "10px" }} placeholder="Notas de salida - Ej: Bergamota, Mandarina" value={form.notasSalida} onChange={e => setForm(f => ({ ...f, notasSalida: e.target.value }))} />
<input style={{ ...S.input, marginBottom: "10px" }} placeholder="Notas de corazon - Ej: Jazmin, Canela" value={form.notasCorazon} onChange={e => setForm(f => ({ ...f, notasCorazon: e.target.value }))} />
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Notas de fondo - Ej: Ambar, Sandalo, Almizcle" value={form.notasFondo} onChange={e => setForm(f => ({ ...f, notasFondo: e.target.value }))} />
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
<option value="agotado">Agotado (sin stock)</option>
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
<h3 style={{ marginTop: "36px", marginBottom: "16px" }}>Productos Existentes ({adminProductsList.length})</h3>
{adminProductsList.map(p => (
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

{(() => {
const resenasPendientes = resenas.filter(r => r.estado === "pendiente");
return (
<div style={{ marginTop: "48px" }}>
<h3 style={{ marginBottom: "6px" }}>📝 Reseñas pendientes de aprobación ({resenasPendientes.length})</h3>
<p style={{ color: "#9a9a9a", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>Las dejaron los clientes desde el link "/opinar". No se muestran en la web hasta que las publiques.</p>
{resenasPendientes.length === 0 ? (
<p style={{ color: "#7a7a7a" }}>No hay reseñas esperando aprobación.</p>
) : (
resenasPendientes.map(r => (
<div key={r.id} style={{ ...S.adminCard, marginBottom: "12px", display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
{r.foto && (<img src={r.foto} alt={r.nombre} style={{ width: "80px", height: "80px", borderRadius: "10px", objectFit: "cover" }} />)}
<div style={{ flex: 1, minWidth: "200px" }}>
<strong>{r.nombre}</strong> {r.ciudad && <span style={{ color: "#9a9a9a" }}> - {r.ciudad}</span>}
<div style={{ color: "#d4af37" }}>{"★".repeat(r.estrellas || 5)}{"☆".repeat(5 - (r.estrellas || 5))}</div>
<div style={{ color: "#bdbdbd", fontSize: "13px", marginTop: "4px" }}>{r.texto}</div>
</div>
<div style={{ display: "flex", gap: "8px" }}>
<button onClick={() => handlePublishResena(r.id)} style={{ background: "#1e7a3d", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "700" }}>✅ Publicar</button>
<button onClick={() => handleRejectResena(r.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer" }}>❌ Rechazar</button>
</div>
</div>
))
)}
</div>
);
})()}

<div style={{ marginTop: "40px" }}>
<h3 style={{ marginBottom: "6px" }}>📮 Pedir opinión a un cliente</h3>
<p style={{ color: "#9a9a9a", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>Genera un mensaje de WhatsApp con el link para que el cliente deje su opinión sobre la atención y la entrega (con foto de su perfume). La reseña no se publica sola: la revisas vos antes en "Reseñas pendientes de aprobación".</p>
<div style={S.adminCard}>
<label style={S.label}>Nombre del cliente (opcional, precarga el formulario)</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Maria Gomez" value={reviewRequestName} onChange={e => setReviewRequestName(e.target.value)} />
<label style={S.label}>WhatsApp del cliente (opcional)</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: 2914261941 (si lo dejas vacio, elegis el contacto en WhatsApp)" value={reviewRequestPhone} onChange={e => setReviewRequestPhone(e.target.value)} />
<button
onClick={() => {
const link = window.location.origin + "/opinar" + (reviewRequestName.trim() ? ("?nombre=" + encodeURIComponent(reviewRequestName.trim())) : "");
const msg = "Hola" + (reviewRequestName.trim() ? " " + reviewRequestName.trim() : "") + "! Gracias por tu compra en Esencia Perfumeria 💛 Nos encantaria conocer tu opinion sobre la atencion y la entrega de tu pedido. Nos ayudarias muchisimo si nos dejas tu reseña (con una foto de tu perfume) aca: " + link;
const phone = reviewRequestPhone.replace(/\D/g, "");
window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(msg), "_blank");
}}
style={{ ...S.btn, width: "100%", padding: "10px", background: "#25D366", color: "#fff", border: "none" }}
>
💬 Enviar pedido de opinión por WhatsApp
</button>
</div>
</div>

<h3 style={{ marginTop: "48px", marginBottom: "16px" }}>Todas las reseñas ({resenas.length})</h3>
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
<div key={r.id} style={{ ...S.adminCard, marginBottom: "12px", display: "flex", gap: "16px", alignItems: "center", opacity: r.estado === "pendiente" ? 0.6 : 1 }}>
<div style={{ flex: 1 }}>
<strong>{r.nombre}</strong> {r.ciudad && <span style={{ color: "#9a9a9a" }}> - {r.ciudad}</span>}
<span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: "700", color: r.estado === "pendiente" ? "#e0b84a" : "#9ddb9d" }}>{r.estado === "pendiente" ? "PENDIENTE" : "PUBLICADA"}</span>
<div style={{ color: "#d4af37" }}>{"★".repeat(r.estrellas || 5)}{"☆".repeat(5 - (r.estrellas || 5))}</div>
<div style={{ color: "#bdbdbd", fontSize: "13px" }}>{r.texto}</div>
</div>
<button onClick={() => handleDeleteResena(r.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer" }}>Eliminar</button>
</div>
))}
</div>
<div style={{ marginTop: "40px" }}>
<h2 style={{ color: "#d4af37", marginBottom: "16px", fontFamily: "'Playfair Display', serif" }}>🔔 Avisos de "Volvió el Stock"</h2>
{avisosStock.length === 0 ? (
<p style={{ color: "#9a9a9a" }}>Todavia no hay clientes esperando un aviso de stock.</p>
) : (
avisosStock.map(a => (
<div key={a.id} style={{ ...S.adminCard, marginBottom: "12px", display: "flex", gap: "16px", alignItems: "center", opacity: a.estado === "contactado" ? 0.55 : 1 }}>
<div style={{ flex: 1 }}>
<strong>{a.productName || "Producto"}</strong>
<div style={{ color: "#bdbdbd", fontSize: "13px" }}>WhatsApp: {a.telefono}{a.email ? ` · ${a.email}` : ""}</div>
<div style={{ color: a.estado === "contactado" ? "#9ddb9d" : "#e0b84a", fontSize: "12px", fontWeight: "700" }}>{a.estado === "contactado" ? "Ya avisado" : "Pendiente de avisar"}</div>
</div>
<a href={`https://wa.me/${(a.telefono || "").replace(/\D/g, "")}?text=${encodeURIComponent("Hola! Te escribo de Esencia Perfumeria porque volvio el stock de " + (a.productName || "tu perfume") + " que estabas esperando.")}`} target="_blank" rel="noreferrer" style={{ background: "#25D366", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", textDecoration: "none", fontSize: "13px", fontWeight: "700" }}>WhatsApp</a>
{a.estado !== "contactado" && <button onClick={() => handleMarkAvisoContacted(a.id)} style={{ ...S.btnOutline, padding: "8px 14px", fontSize: "13px" }}>Marcar avisado</button>}
<button onClick={() => handleDeleteAviso(a.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer" }}>Eliminar</button>
</div>
))
)}
</div>
<div style={{ marginTop: "40px" }}>
<h2 style={{ color: "#d4af37", marginBottom: "6px", fontFamily: "'Playfair Display', serif" }}>📊 Dashboard de ventas</h2>
<p style={{ color: "#9a9a9a", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>Calculado sobre los ultimos 200 pedidos registrados (Mercado Pago aprobados + enviados por WhatsApp).</p>
{!ventasStats ? (
<p style={{ color: "#9a9a9a" }}>Todavia no hay pedidos registrados para mostrar estadisticas.</p>
) : (
<>
<div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
<div style={{ ...S.adminCard, flex: "1 1 160px" }}>
<div style={{ color: "#9a9a9a", fontSize: "12px" }}>Facturado (ult. 200)</div>
<div style={{ color: "#d4af37", fontSize: "22px", fontWeight: "700" }}>{formatPrice(ventasStats.totalFacturado)}</div>
</div>
<div style={{ ...S.adminCard, flex: "1 1 160px" }}>
<div style={{ color: "#9a9a9a", fontSize: "12px" }}>Ticket promedio</div>
<div style={{ color: "#d4af37", fontSize: "22px", fontWeight: "700" }}>{formatPrice(ventasStats.ticketPromedio)}</div>
</div>
<div style={{ ...S.adminCard, flex: "1 1 160px" }}>
<div style={{ color: "#9a9a9a", fontSize: "12px" }}>Via Mercado Pago</div>
<div style={{ color: "#9ddb9d", fontSize: "22px", fontWeight: "700" }}>{ventasStats.totalFacturado > 0 ? Math.round((ventasStats.porOrigen.mercadopago / ventasStats.totalFacturado) * 100) : 0}%</div>
</div>
<div style={{ ...S.adminCard, flex: "1 1 160px" }}>
<div style={{ color: "#9a9a9a", fontSize: "12px" }}>Via WhatsApp</div>
<div style={{ color: "#e0b84a", fontSize: "22px", fontWeight: "700" }}>{ventasStats.totalFacturado > 0 ? Math.round((ventasStats.porOrigen.whatsapp / ventasStats.totalFacturado) * 100) : 0}%</div>
</div>
</div>

<div style={{ ...S.adminCard, marginBottom: "20px" }}>
<div style={{ color: "#bdbdbd", fontSize: "13px", marginBottom: "14px" }}>Ventas por dia (ultimos 14 dias)</div>
<div style={{ overflowX: "auto" }}>
<div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "120px", minWidth: "380px", borderBottom: "1px solid #2b2b2b", paddingBottom: "4px" }}>
{(() => {
const max = Math.max(...ventasStats.ventasPorDia.map(d => d.total), 1);
return ventasStats.ventasPorDia.map((d, i) => (
<div key={i} onMouseEnter={() => setHoverVentaDia(i)} onMouseLeave={() => setHoverVentaDia(h => h === i ? null : h)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", position: "relative", cursor: "default" }}>
{hoverVentaDia === i && (
<div style={{ position: "absolute", bottom: "100%", marginBottom: "6px", background: "#0f0f0f", border: "1px solid #d4af37", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", color: "#fff", whiteSpace: "nowrap", zIndex: 5 }}>
{d.fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} · {formatPrice(d.total)}
</div>
)}
<div style={{ width: "100%", maxWidth: "22px", height: `${Math.max((d.total / max) * 100, d.total > 0 ? 3 : 0)}%`, background: d.total > 0 ? "linear-gradient(180deg, #e0c158, #d4af37)" : "transparent", borderRadius: "4px 4px 0 0" }} />
</div>
));
})()}
</div>
<div style={{ display: "flex", gap: "6px", minWidth: "380px", marginTop: "4px" }}>
{ventasStats.ventasPorDia.map((d, i) => (
<div key={i} style={{ flex: 1, textAlign: "center", fontSize: "10px", color: "#898781" }}>{String(d.fecha.getDate()).padStart(2, "0")}</div>
))}
</div>
</div>
</div>

<div style={S.adminCard}>
<div style={{ color: "#bdbdbd", fontSize: "13px", marginBottom: "14px" }}>Productos mas vendidos (por unidades)</div>
{ventasStats.topProductos.length === 0 ? (
<p style={{ color: "#9a9a9a", margin: 0 }}>Sin datos todavia.</p>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
{(() => {
const maxCantidad = Math.max(...ventasStats.topProductos.map(p => p.cantidad), 1);
return ventasStats.topProductos.map((p, i) => (
<div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
<div style={{ width: "140px", fontSize: "13px", color: "#fff", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
<div style={{ flex: 1, background: "#0f0f0f", borderRadius: "4px", height: "18px", overflow: "hidden" }}>
<div style={{ width: `${(p.cantidad / maxCantidad) * 100}%`, height: "100%", background: "linear-gradient(90deg, #d4af37, #e0c158)", borderRadius: "4px" }} />
</div>
<div style={{ width: "60px", textAlign: "right", fontSize: "13px", color: "#d4af37", fontWeight: "700", flexShrink: 0 }}>{p.cantidad} u.</div>
</div>
));
})()}
</div>
)}
</div>
</>
)}
</div>
<div style={{ marginTop: "40px" }}>
<h2 style={{ color: "#d4af37", marginBottom: "6px", fontFamily: "'Playfair Display', serif" }}>📋 Pedidos recientes</h2>
<p style={{ color: "#9a9a9a", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>Se registran los pedidos pagados y confirmados con Mercado Pago, y los que se mandaron por WhatsApp para pagar con transferencia o efectivo (estos ultimos quedan como "enviado": todavia no confirman que el pago se haya recibido de verdad, eso lo coordinas vos por WhatsApp).</p>
{pedidos.length > 0 && (
<div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "16px" }}>
<div style={{ ...S.adminCard, flex: "1 1 160px" }}>
<div style={{ color: "#9a9a9a", fontSize: "12px" }}>Pedidos (ultimos 200)</div>
<div style={{ color: "#d4af37", fontSize: "22px", fontWeight: "700" }}>{pedidos.length}</div>
</div>
<div style={{ ...S.adminCard, flex: "1 1 160px" }}>
<div style={{ color: "#9a9a9a", fontSize: "12px" }}>Total (ultimos 200)</div>
<div style={{ color: "#d4af37", fontSize: "22px", fontWeight: "700" }}>{formatPrice(pedidos.reduce((a, p) => a + (Number(p.total) || 0), 0))}</div>
</div>
</div>
)}
{pedidos.length === 0 ? (
<p style={{ color: "#9a9a9a" }}>Todavia no hay pedidos registrados.</p>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
{pedidos.map(p => (
<div key={p.id} style={{ ...S.adminCard, padding: "14px 18px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
<div style={{ flex: 1, minWidth: "180px" }}>
<strong>{p.nombre || "Sin nombre"}</strong>
<div style={{ color: "#bdbdbd", fontSize: "13px" }}>{(p.items || []).length} producto(s) · {p.createdAt && p.createdAt.toDate ? p.createdAt.toDate().toLocaleString("es-AR") : ""}</div>
</div>
<span style={{ fontSize: "12px", fontWeight: "700", color: p.origen === "mercadopago" ? "#9ddb9d" : "#e0b84a", background: "#0f0f0f", border: "1px solid #2b2b2b", borderRadius: "20px", padding: "4px 10px" }}>{p.origen === "mercadopago" ? "Mercado Pago" : (p.medioPago === "transferencia" ? "Transferencia" : "Efectivo")}</span>
<strong style={{ color: "#d4af37" }}>{formatPrice(p.total)}</strong>
</div>
))}
</div>
)}
</div>
<div style={{ marginTop: "40px" }}>
<h2 style={{ color: "#d4af37", marginBottom: "6px", fontFamily: "'Playfair Display', serif" }}>🎁 Clientes con crédito de puntos sin usar</h2>
<p style={{ color: "#9a9a9a", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>Clientes logueados con 300 puntos o más ($10.000+ de descuento) sin canjear. El nombre y WhatsApp se guardan solo si el cliente compró después de este cambio; los que compraron antes van a ir apareciendo con sus datos a medida que vuelvan a comprar.</p>
{customersWithPoints.length === 0 ? (
<p style={{ color: "#9a9a9a" }}>Por ahora no hay clientes con credito de puntos sin usar.</p>
) : (
customersWithPoints.map(c => (
<div key={c.id} style={{ ...S.adminCard, marginBottom: "12px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
<div style={{ flex: 1, minWidth: "180px" }}>
<strong>{c.nombre || "Cliente sin nombre guardado"}</strong>
<div style={{ color: "#bdbdbd", fontSize: "13px" }}>{c.telefono ? `WhatsApp: ${c.telefono}` : "Sin WhatsApp guardado"}{c.email ? ` · ${c.email}` : ""}</div>
<div style={{ color: "#d4af37", fontSize: "13px", fontWeight: "700" }}>{c.puntos} puntos = {formatPrice(pointsToDiscount(c.puntos))} de descuento</div>
{c.recordatorioEnviado && <div style={{ color: "#9ddb9d", fontSize: "11px" }}>Ya se le mando un recordatorio</div>}
</div>
{c.telefono ? (
<button
onClick={() => {
const monto = pointsToDiscount(c.puntos);
const msg = "Hola" + (c.nombre ? " " + c.nombre : "") + "! 💛 Te escribimos de Esencia Perfumeria: tenes " + formatPrice(monto) + " de descuento acumulado por tus puntos, todavia sin usar. Lo podes canjear en tu proximo pedido junto con el resto del catalogo. Te esperamos!";
window.open("https://wa.me/" + c.telefono.replace(/\D/g, "") + "?text=" + encodeURIComponent(msg), "_blank");
updateDoc(doc(db, "puntosClientes", c.id), { recordatorioEnviado: serverTimestamp() }).catch(e => console.error("RECORDATORIO_MARK_ERROR", e));
}}
style={{ background: "#25D366", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}
>
💬 Recordar por WhatsApp
</button>
) : (
<span style={{ color: "#7a7a7a", fontSize: "12px" }}>Todavia no tiene WhatsApp guardado</span>
)}
</div>
))
)}
</div>

<div style={{ marginTop: "40px" }}>
<h2 style={{ color: "#d4af37", marginBottom: "6px", fontFamily: "'Playfair Display', serif" }}>📝 Blog</h2>
<p style={{ color: "#9a9a9a", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>Notas para atraer busquedas en Google (guias de compra, notas olfativas, comparativas, etc). Una nota queda como borrador (no se ve en el sitio) hasta que la publiques.</p>
<div style={S.adminCard}>
<label style={S.label}>Titulo</label>
<input type="text" value={blogForm.titulo} onChange={e => setBlogForm({ ...blogForm, titulo: e.target.value })} style={{ ...S.input, marginBottom: "12px" }} placeholder="Ej: Como elegir tu perfume ideal" />
<label style={S.label}>URL de la nota{editingBlogSlug ? " (no se puede cambiar)" : " (se genera sola si la dejas vacia)"}</label>
<input type="text" value={editingBlogSlug || blogForm.slug} disabled={!!editingBlogSlug} onChange={e => setBlogForm({ ...blogForm, slug: e.target.value })} style={{ ...S.input, marginBottom: "4px", opacity: editingBlogSlug ? 0.6 : 1 }} placeholder="como-elegir-tu-perfume-ideal" />
<p style={{ color: "#7a7a7a", fontSize: "12px", marginTop: 0, marginBottom: "12px" }}>esenciaperfumeria.com.ar/blog/{editingBlogSlug || slugify(blogForm.slug || blogForm.titulo) || "..."}</p>
<label style={S.label}>Resumen (para Google y la vista previa al compartir)</label>
<textarea value={blogForm.resumen} onChange={e => setBlogForm({ ...blogForm, resumen: e.target.value })} style={{ ...S.input, marginBottom: "12px", minHeight: "60px" }} placeholder="1 o 2 frases resumiendo la nota (hasta 160 caracteres aprox)" maxLength={220} />
<label style={S.label}>Categoria</label>
<select value={blogForm.categoria} onChange={e => setBlogForm({ ...blogForm, categoria: e.target.value })} style={{ ...S.input, marginBottom: "12px" }}>
<option value="guia-compra">Guia de compra / regalo</option>
<option value="notas-olfativas">Notas olfativas / educativo</option>
<option value="arabes-vs-disenador">Arabes vs disenador</option>
<option value="cuidado-duracion">Cuidado y duracion</option>
</select>
<label style={S.label}>Imagen de portada</label>
<div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
<input type="file" accept="image/*" onChange={e => handleBlogImageUpload(e.target.files[0])} />
{blogUploading && <span style={{ color: "#9a9a9a", fontSize: "13px" }}>Subiendo...</span>}
{blogForm.imagen && <img src={blogForm.imagen} alt="preview" style={{ width: "70px", height: "70px", objectFit: "cover", borderRadius: "8px" }} />}
</div>
<label style={S.label}>Contenido</label>
<textarea value={blogForm.contenido} onChange={e => setBlogForm({ ...blogForm, contenido: e.target.value })} style={{ ...S.input, marginBottom: "12px", minHeight: "220px", fontFamily: "inherit" }} placeholder="Escribi la nota. Deja una linea en blanco entre parrafos." />
<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "14px", cursor: "pointer", marginBottom: "14px" }}>
<input type="checkbox" checked={!!blogForm.publicado} onChange={e => setBlogForm({ ...blogForm, publicado: e.target.checked })} />
Publicada (visible en el sitio)
</label>
<div style={{ display: "flex", gap: "10px" }}>
<button onClick={handleSaveBlogPost} disabled={blogSaving} style={{ ...S.btn, padding: "10px 20px", opacity: blogSaving ? 0.6 : 1 }}>{blogSaving ? "Guardando..." : (editingBlogSlug ? "Guardar cambios" : "Crear nota")}</button>
{editingBlogSlug && <button onClick={handleCancelBlogEdit} style={{ ...S.btnOutline, padding: "10px 20px" }}>Cancelar edicion</button>}
</div>
</div>
<h3 style={{ marginTop: "24px", marginBottom: "16px" }}>Notas existentes ({blogPosts.length})</h3>
{blogPosts.length === 0 ? (
<p style={{ color: "#7a7a7a" }}>Todavia no hay notas cargadas.</p>
) : (
blogPosts.map(b => (
<div key={b.id} style={{ ...S.adminCard, marginBottom: "12px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
{b.imagen && <img src={b.imagen} alt={b.titulo} style={{ width: "70px", height: "70px", objectFit: "cover", borderRadius: "8px" }} />}
<div style={{ flex: 1, minWidth: "180px" }}>
<div style={{ fontWeight: "bold" }}>{b.titulo}</div>
<div style={{ color: "#9a9a9a", fontSize: "12px" }}>/blog/{b.id}</div>
<span style={{ fontSize: "12px", fontWeight: "700", color: b.publicado ? "#9ddb9d" : "#e0b84a" }}>{b.publicado ? "Publicada" : "Borrador"}</span>
</div>
<button onClick={() => handleTogglePublishBlogPost(b)} style={{ background: b.publicado ? "#5a5a5a" : "#1e7a3d", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "700" }}>{b.publicado ? "Pasar a borrador" : "Publicar"}</button>
<button onClick={() => handleEditBlogPost(b)} style={{ background: "#d4af37", color: "#000", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Editar</button>
<button onClick={() => handleDeleteBlogPost(b.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer" }}>Eliminar</button>
</div>
))
)}
</div>
</div>
);
}

const BLOG_CATEGORIA_LABELS = { "guia-compra": "Guía de compra", "notas-olfativas": "Notas olfativas", "arabes-vs-disenador": "Árabes vs. diseñador", "cuidado-duracion": "Cuidado y duración" };

if (page === "blog") {
const volverInicio = () => { setPage("home"); window.history.pushState({}, "", "/"); };
const abrirPost = (b) => { setSelectedBlogPost(b); setPage("blogPost"); window.history.pushState({}, "", "/blog/" + b.id); window.scrollTo(0, 0); };
const publicados = blogPosts.filter(b => b.publicado);
return (
<div style={{ ...S.body, minHeight: "100vh" }}>
<div style={{ ...S.nav, justifyContent: "space-between" }}>
<a href="/" onClick={(e) => { e.preventDefault(); volverInicio(); }} style={{ color: "#d4af37", fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 800, textDecoration: "none" }}>Esencia Perfumeria</a>
<button onClick={volverInicio} style={S.btnOutline}>Volver a la tienda</button>
</div>
<div style={{ maxWidth: "1000px", margin: "0 auto", padding: "36px 20px 60px" }}>
<h1 style={{ color: "#d4af37", fontFamily: "'Playfair Display', serif", fontSize: "clamp(24px, 4vw, 34px)", marginBottom: "8px" }}>Blog de Esencia Perfumeria</h1>
<p style={{ color: "#9a9a9a", marginBottom: "32px" }}>Guías de compra, notas olfativas y consejos para elegir y cuidar tu perfume.</p>
{publicados.length === 0 ? (
<p style={{ color: "#9a9a9a" }}>Todavía no hay notas publicadas. Volvé pronto.</p>
) : (
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "20px" }}>
{publicados.map(b => (
<a key={b.id} href={"/blog/" + b.id} onClick={(e) => { e.preventDefault(); abrirPost(b); }} style={{ textDecoration: "none", color: "inherit", background: "#161616", border: "1px solid #2b2b2b", borderRadius: "10px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
{b.imagen && <img src={b.imagen} alt={b.titulo} loading="lazy" style={{ width: "100%", height: "160px", objectFit: "cover" }} />}
<div style={{ padding: "16px" }}>
<span style={{ color: "#d4af37", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>{BLOG_CATEGORIA_LABELS[b.categoria] || "Nota"}</span>
<h3 style={{ color: "#fff", fontSize: "17px", margin: "6px 0" }}>{b.titulo}</h3>
<p style={{ color: "#9a9a9a", fontSize: "13px", margin: 0 }}>{b.resumen}</p>
</div>
</a>
))}
</div>
)}
</div>
</div>
);
}

if (page === "blogPost") {
const volverBlog = () => { setPage("blog"); setSelectedBlogPost(null); window.history.pushState({}, "", "/blog"); };
const irHome = () => { setPage("home"); window.history.pushState({}, "", "/"); };
const b = selectedBlogPost;
const parrafos = b ? String(b.contenido || "").split(/\n\s*\n/).map(s => s.trim()).filter(Boolean) : [];
return (
<div style={{ ...S.body, minHeight: "100vh" }}>
<div style={{ ...S.nav, justifyContent: "space-between" }}>
<a href="/" onClick={(e) => { e.preventDefault(); irHome(); }} style={{ color: "#d4af37", fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 800, textDecoration: "none" }}>Esencia Perfumeria</a>
<button onClick={volverBlog} style={S.btnOutline}>Volver al blog</button>
</div>
{!b ? (
<div style={{ maxWidth: "760px", margin: "0 auto", padding: "60px 20px", color: "#9a9a9a", textAlign: "center" }}>Cargando nota...</div>
) : (
<div style={{ maxWidth: "760px", margin: "0 auto", padding: "36px 20px 60px", color: "#e8ddc0", lineHeight: "1.7" }}>
<span style={{ color: "#d4af37", fontSize: "12px", fontWeight: "700", textTransform: "uppercase" }}>{BLOG_CATEGORIA_LABELS[b.categoria] || "Nota"}</span>
<h1 style={{ color: "#d4af37", fontFamily: "'Playfair Display', serif", fontSize: "clamp(24px, 4vw, 34px)", margin: "6px 0 18px" }}>{b.titulo}</h1>
{b.imagen && <img src={b.imagen} alt={b.titulo} style={{ width: "100%", maxHeight: "360px", objectFit: "cover", borderRadius: "10px", marginBottom: "24px" }} />}
{parrafos.map((p, i) => <p key={i}>{p}</p>)}
</div>
)}
</div>
);
}

if (page === "devoluciones") {
const volverInicio = () => { setPage("home"); window.history.pushState({}, "", "/"); };
return (
<div style={{ ...S.body, minHeight: "100vh" }}>
<div style={{ ...S.nav, justifyContent: "space-between" }}>
<a href="/" onClick={(e) => { e.preventDefault(); volverInicio(); }} style={{ color: "#d4af37", fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 800, textDecoration: "none" }}>Esencia Perfumeria</a>
<button onClick={volverInicio} style={S.btnOutline}>Volver a la tienda</button>
</div>
<div style={{ maxWidth: "760px", margin: "0 auto", padding: "36px 20px 60px", color: "#e8ddc0", lineHeight: "1.7" }}>
<h1 style={{ color: "#d4af37", fontFamily: "'Playfair Display', serif", fontSize: "clamp(24px, 4vw, 34px)", marginBottom: "6px" }}>Política de Cambios y Devoluciones</h1>
<p style={{ color: "#9a9a9a", fontSize: "13px", marginBottom: "28px" }}>Última actualización: agosto 2026</p>

<h2 style={{ color: "#fff", fontSize: "19px", marginTop: "28px", marginBottom: "10px" }}>1. Derecho de arrepentimiento (compras a distancia)</h2>
<p>Como tu compra en Esencia Perfumeria se realiza a distancia (por WhatsApp, sin trato presencial previo), la Ley de Defensa del Consumidor (Ley 24.240) te reconoce el derecho de arrepentirte de tu compra dentro de los <strong style={{ color: "#d4af37" }}>10 días corridos</strong> desde que recibís el producto, sin necesidad de indicar ningún motivo.</p>
<p>Si ejercés este derecho dentro de ese plazo, el costo de envío de la devolución corre <strong style={{ color: "#d4af37" }}>por cuenta de Esencia Perfumeria</strong>, no tuyo.</p>

<h2 style={{ color: "#fff", fontSize: "19px", marginTop: "28px", marginBottom: "10px" }}>2. Cómo pedir un cambio o devolución</h2>
<p>Escribinos por WhatsApp al <a href="https://wa.me/2914261941" target="_blank" rel="noreferrer" style={{ color: "#d4af37" }}>+54 9 291 426-1941</a> indicando tu nombre, el pedido y el motivo. Te confirmamos los pasos a seguir y coordinamos el retiro o el envío de devolución.</p>
<p>Para procesar el cambio o la devolución, te pedimos que el producto esté en las mismas condiciones en que lo recibiste: sin abrir, sin usar y con su envase original.</p>

<h2 style={{ color: "#fff", fontSize: "19px", marginTop: "28px", marginBottom: "10px" }}>3. Producto defectuoso, dañado o distinto al pedido</h2>
<p>Si tu perfume llega roto, dañado durante el envío, o no es el que compraste, te lo cambiamos o te devolvemos el dinero sin cargo para vos, más allá de los 10 días del punto 1.</p>

<h2 style={{ color: "#fff", fontSize: "19px", marginTop: "28px", marginBottom: "10px" }}>4. Reintegro</h2>
<p>Una vez que recibimos y verificamos el producto devuelto, coordinamos por WhatsApp el cambio por otro producto o el reintegro del dinero por el mismo medio de pago (o transferencia bancaria), dentro de un plazo razonable.</p>

<h2 style={{ color: "#fff", fontSize: "19px", marginTop: "28px", marginBottom: "10px" }}>5. Contacto</h2>
<p>Ante cualquier duda sobre un cambio, devolución o el estado de tu pedido, contactanos por WhatsApp al <a href="https://wa.me/2914261941" target="_blank" rel="noreferrer" style={{ color: "#d4af37" }}>+54 9 291 426-1941</a>.</p>
</div>
<footer style={S.footer}>
<div style={{ ...S.footerInner, gridTemplateColumns: "1fr" }}>
<div style={S.footerBottom}>
<span>© {new Date().getFullYear()} Esencia Perfumeria. Todos los derechos reservados.</span>
</div>
</div>
</footer>
</div>
);
}

if (page === "opinar") {
const volverInicio = () => { setPage("home"); window.history.pushState({}, "", "/"); };
return (
<div style={{ ...S.body, minHeight: "100vh" }}>
<div style={{ ...S.nav, justifyContent: "space-between" }}>
<a href="/" onClick={(e) => { e.preventDefault(); volverInicio(); }} style={{ color: "#d4af37", fontFamily: "'Playfair Display', serif", fontSize: "22px", fontWeight: 800, textDecoration: "none" }}>Esencia Perfumeria</a>
<button onClick={volverInicio} style={S.btnOutline}>Volver a la tienda</button>
</div>
<div style={{ maxWidth: "560px", margin: "0 auto", padding: "36px 20px 60px", color: "#e8ddc0" }}>
{opinionSent ? (
<div style={{ textAlign: "center", padding: "40px 10px" }}>
<div style={{ fontSize: "44px", marginBottom: "12px" }}>💛</div>
<h1 style={{ color: "#d4af37", fontFamily: "'Playfair Display', serif", fontSize: "clamp(22px, 4vw, 28px)", marginBottom: "10px" }}>¡Gracias por tu opinión!</h1>
<p style={{ lineHeight: "1.6" }}>La recibimos y la vamos a revisar antes de publicarla en la página. ¡Gracias por tomarte el tiempo de contarnos cómo te fue!</p>
<button onClick={volverInicio} style={{ ...S.btn, marginTop: "16px", padding: "12px 24px" }}>Volver a la tienda</button>
</div>
) : (
<>
<h1 style={{ color: "#d4af37", fontFamily: "'Playfair Display', serif", fontSize: "clamp(22px, 4vw, 28px)", marginBottom: "6px" }}>Contanos tu experiencia</h1>
<p style={{ color: "#bdbdbd", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>Tu opinión nos ayuda un montón, y le sirve a otros clientes para elegirnos con confianza. Contanos cómo fue <strong style={{ color: "#d4af37" }}>la atención y la entrega de tu pedido</strong> (no hace falta que sea sobre el perfume en sí). La revisamos y la publicamos nosotros — no se muestra sola en la web.</p>

<label style={S.label}>Tu nombre *</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Maria Gomez" value={opinionForm.nombre} onChange={e => setOpinionForm(f => ({ ...f, nombre: e.target.value }))} />

<label style={S.label}>Tu ciudad (opcional)</label>
<input style={{ ...S.input, marginBottom: "16px" }} placeholder="Ej: Bahia Blanca" value={opinionForm.ciudad} onChange={e => setOpinionForm(f => ({ ...f, ciudad: e.target.value }))} />

<label style={S.label}>¿Cómo calificás la atención y la entrega de tu pedido? *</label>
<select style={{ ...S.input, marginBottom: "16px" }} value={opinionForm.estrellas} onChange={e => setOpinionForm(f => ({ ...f, estrellas: e.target.value }))}>
<option value="5">★★★★★ Excelente</option>
<option value="4">★★★★☆ Muy buena</option>
<option value="3">★★★☆☆ Buena</option>
<option value="2">★★☆☆☆ Regular</option>
<option value="1">★☆☆☆☆ Mala</option>
</select>

<label style={S.label}>Contanos tu experiencia *</label>
<textarea style={{ ...S.input, marginBottom: "16px", minHeight: "90px", fontFamily: "inherit" }} placeholder="Ej: Excelente atencion, me llego en un dia y todo perfecto." value={opinionForm.texto} onChange={e => setOpinionForm(f => ({ ...f, texto: e.target.value }))} />

<label style={S.label}>Una foto de tu perfume *</label>
<input type="file" accept="image/*" onChange={e => handleOpinionPhotoUpload(e.target.files[0])} style={{ ...S.input, padding: "8px", marginBottom: "8px" }} />
{opinionUploading && <p style={{ color: "#d4af37", fontSize: "13px" }}>Subiendo foto...</p>}
{opinionForm.foto && (
<div style={{ marginBottom: "16px" }}>
<img src={opinionForm.foto} alt="preview" style={{ width: "90px", height: "90px", borderRadius: "10px", objectFit: "cover" }} />
</div>
)}

{opinionError && <p style={{ color: "#ff6b6b", marginBottom: "16px" }}>{opinionError}</p>}

<button onClick={handleSubmitOpinion} disabled={opinionSaving || opinionUploading} style={{ ...S.btn, width: "100%", padding: "13px", opacity: (opinionSaving || opinionUploading) ? 0.6 : 1 }}>{opinionSaving ? "Enviando..." : "Enviar mi opinión"}</button>
</>
)}
</div>
<footer style={S.footer}>
<div style={{ ...S.footerInner, gridTemplateColumns: "1fr" }}>
<div style={S.footerBottom}>
<span>© {new Date().getFullYear()} Esencia Perfumeria. Todos los derechos reservados.</span>
</div>
</div>
</footer>
</div>
);
}

return (
<div style={S.body}>
{bannerConfig && bannerConfig.bannerEnabled && bannerConfig.bannerTexto && !bannerDismissed && (
<div style={{ position: "relative", background: "#d4af37", color: "#0b0b0b", padding: "10px 40px", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap", fontSize: "13.5px", fontWeight: 700, textAlign: "center" }}>
<span>{bannerConfig.bannerTexto}</span>
{bannerConfig.bannerFechaObjetivo && (() => {
const target = new Date(bannerConfig.bannerFechaObjetivo).getTime();
const diff = target - nowTick;
if (!Number.isFinite(target) || diff <= 0) return null;
const days = Math.floor(diff / 86400000);
const hours = Math.floor((diff % 86400000) / 3600000);
const mins = Math.floor((diff % 3600000) / 60000);
return <span style={{ background: "#0b0b0b", color: "#d4af37", padding: "3px 10px", borderRadius: "6px", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{days > 0 ? days + "d " : ""}{hours}h {mins}m</span>;
})()}
{bannerConfig.bannerLink && (
<a href={bannerConfig.bannerLink} target="_blank" rel="noreferrer" style={{ color: "#0b0b0b", textDecoration: "underline", fontWeight: 800 }}>{bannerConfig.bannerCtaLabel || "Ver mas"}</a>
)}
<button onClick={() => { setBannerDismissed(true); try { sessionStorage.setItem("esenciaBannerDismissed", "1"); } catch {} }} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#0b0b0b", fontSize: "17px", cursor: "pointer", padding: "4px", lineHeight: 1 }} aria-label="Cerrar banner">✕</button>
</div>
)}
<style>{`@media (max-width: 700px) { .gs-nav { position: sticky !important; top: 0 !important; z-index: 80 !important; flex-wrap: wrap !important; row-gap: 8px !important; padding: 10px 12px !important; } .gs-nav-promo { position: static !important; left: auto !important; top: auto !important; transform: none !important; order: 3 !important; width: 100% !important; max-width: 100% !important; text-align: center !important; font-size: 11px !important; } .gs-nav-cart-btn { position: static !important; top: auto !important; right: auto !important; padding: 8px 12px !important; font-size: 13px !important; } .gs-nav-account-btn { position: static !important; top: auto !important; right: auto !important; padding: 8px 12px !important; font-size: 13px !important; } .gs-nav-instagram-btn { position: static !important; top: auto !important; right: auto !important; width: 36px !important; height: 36px !important; } .gs-mobile-cart-bar { display: flex !important; } } .gs-reviews-scroll { overflow: hidden; } .gs-reviews-track { display: flex; gap: 14px; width: max-content; animation: gsReviewsScroll 42s linear infinite; } .gs-reviews-scroll:hover .gs-reviews-track { animation-play-state: paused; } @keyframes gsReviewsScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } } .gs-review-card { flex-shrink: 0; width: 200px; background: #ffffff; border-radius: 10px; padding: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); border: 1px solid #e8ddc0; } .gs-review-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; } .gs-review-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid #d4af37; flex-shrink: 0; } .gs-review-avatar-fallback { width: 36px; height: 36px; border-radius: 50%; background: #d4af37; color: #000; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; } .gs-review-name { font-weight: 700; color: #1a1a1a; font-size: 13px; line-height: 1.25; } .gs-review-city { font-size: 11px; color: #7a7a7a; } .gs-review-stars { color: #d4af37; font-size: 12px; margin-bottom: 6px; } .gs-review-text { color: #3a3a3a; font-size: 12.5px; font-style: italic; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; } .gs-nav-blog-btn { position: static !important; top: auto !important; right: auto !important; padding: 8px 12px !important; font-size: 13px !important; }`}</style>
<div style={S.nav} className="gs-nav">
<div style={S.navPromo} className="gs-nav-promo"><span style={{ color: "#d4af37" }}>PERFUMES ORIGINALES</span> / <span style={{ color: "#ffffff" }}>APROVECHA CODIGO PROMOCIONAL</span></div>
<a href="https://www.instagram.com/esenciaperfumeria.bb/" target="_blank" rel="noopener noreferrer" style={S.navInstagramBtn} className="gs-nav-instagram-btn" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"></line></svg></a> <a href="/blog" style={S.navBlogBtn} className="gs-nav-blog-btn">Blog</a>
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
<h1 style={S.heroMainTitle}>Perfumería en Bahía Blanca</h1>
<p style={S.heroSub}>Más de 300 fragancias · Diseñador · Árabes · Nicho</p>
<div style={S.heroTrustRow} className="gs-hero-trust-row">
<span style={S.heroTrustBadge}>✔ 100% Originales</span>
<span style={S.heroTrustBadge}>🚚 Envío gratis en Bahía Blanca</span>
<span style={S.heroTrustBadge}>📦 Envíos a todo el país</span>
{avgRating && <span style={S.heroTrustBadge}>★ {avgRating} · {reviewCount} {reviewCount === 1 ? "opinión verificada" : "opiniones verificadas"}</span>}
</div>
<div style={S.heroBtnRow} className="gs-hero-btn-row">
<button className="gs-hero-btn-primary" style={S.heroBtnPrimary} onClick={() => { setFilter("perfumes"); setTimeout(() => document.getElementById("productsSection")?.scrollIntoView({ behavior: "smooth" }), 60); }}>Ver Perfumes</button>
<button className="gs-hero-btn-secondary" style={S.heroBtnSecondary} onClick={() => { setQuizStep(0); setQuizAnswers({ genero: "", ocasion: "", aroma: "", tipo: "" }); setShowQuiz(true); }}>🧭 Elegí según tu personalidad</button>
</div>
</div>
<div className="gs-hero-scroll" style={S.heroScrollCue}>↓</div>
</div>
<div style={S.tickerSection}>
<style>{`@keyframes gangaTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } } @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } } .product-card { transition: transform 0.3s ease, box-shadow 0.3s ease; animation: fadeInUp 0.6s ease both; } .product-card:hover, .product-card:active { transform: translateY(-6px); box-shadow: 0 14px 28px rgba(212,175,55,0.18); } .card-img { transition: transform 0.35s ease; } .product-card:hover .card-img { transform: scale(1.06); } .fav-btn { transition: transform 0.2s ease, background 0.2s ease; } .fav-btn:hover { transform: scale(1.12); } .fav-btn.active { animation: favPop 0.3s ease; } @keyframes favPop { 0% { transform: scale(1); } 45% { transform: scale(1.3); } 100% { transform: scale(1); } } .add-cart-btn { transition: transform 0.2s ease, box-shadow 0.2s ease; } .add-cart-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(212,175,55,0.4); } .add-cart-btn:active { transform: scale(0.96); } @keyframes skeletonPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } } .skel { animation: skeletonPulse 1.4s ease-in-out infinite; background: #23231f; } @keyframes toastPop { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
<div style={S.tickerTrack}>
{[...tickerProducts, ...tickerProducts].map((p, i) => (
<a key={i} className="product-card" href={"/producto/" + p.id} style={{ ...S.tickerItem, display: "block", position: "relative", textDecoration: "none", color: "inherit" }} onClick={(e) => { e.preventDefault(); setSelectedProduct(p); }}>
<button className={"fav-btn" + (favorites.includes(p.id) ? " active" : "")} onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(p.id); }} style={S.favBtn(favorites.includes(p.id))} aria-label="Favorito">{favorites.includes(p.id) ? "♥" : "♡"}</button>
<img className="card-img" src={optimizeImg(getProductImage(p), "m")} alt={getProductName(p)} style={S.cardImg} loading="lazy" decoding="async" onError={(e) => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
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
: getProductDisp(p) === "agotado"
? <span style={S.badgeAgotado}>● Agotado</span>
: <span style={S.badgePedido}>Por Pedido · {getProductDias(p)} dias hab.</span>
}
{getUrgencyMsg(p) && <span style={S.urgencyBadge}>{getUrgencyMsg(p)}</span>}
</div>
{getProductDisp(p) === "agotado"
? <button className="add-cart-btn" style={{ ...S.btnOutline, width: "100%", marginTop: "auto", padding: "10px" }} onClick={e => { e.preventDefault(); e.stopPropagation(); setSelectedProduct(p); }}>🔔 Avisarme</button>
: <button className="add-cart-btn" style={{ ...S.btn, width: "100%", marginTop: "auto" }} onClick={e => { e.preventDefault(); e.stopPropagation(); addToCart(p); }}>Agregar al Carrito</button>}
</div>
</a>
))}
</div>
</div>
{(() => {
const resenasPublicadas = resenas.filter(r => r.estado !== "pendiente");
return (
<div style={{ ...S.section, padding: "40px 20px" }}>
<div style={{ ...S.sectionTitle, fontSize: "20px", marginBottom: "10px" }}>Opiniones de Clientes</div>
<p style={{ color: "#7a7a7a", fontSize: "13px", textAlign: "center", marginTop: "-4px", marginBottom: "16px" }}>Sobre nuestra atención y la entrega de sus pedidos, verificadas antes de publicarse.</p>
{avgRating && <div style={{ textAlign: "center", marginBottom: "16px" }}><span style={{ ...S.ratingBadge, fontSize: "16px" }}>★ {avgRating} de 5 · {reviewCount} {reviewCount === 1 ? "opinion verificada" : "opiniones verificadas"}</span></div>}
{resenasPublicadas.length === 0 ? (
<p style={{ color: "#7a7a7a", textAlign: "center" }}>Todavia no hay opiniones cargadas.</p>
) : (
<div className="gs-reviews-scroll">
<div className="gs-reviews-track">
{[...resenasPublicadas, ...resenasPublicadas].map((r, i) => (
<div key={r.id + "-" + i} className="gs-review-card">
<div className="gs-review-card-head">
{r.foto ? (
<img src={optimizeImg(r.foto, "t")} alt={r.nombre} loading="lazy" decoding="async" className="gs-review-avatar" />
) : (
<div className="gs-review-avatar-fallback">{(r.nombre || "?").trim().charAt(0).toUpperCase()}</div>
)}
<div>
<div className="gs-review-name">{r.nombre}</div>
{r.ciudad && <div className="gs-review-city">{r.ciudad}</div>}
</div>
</div>
<div className="gs-review-stars">{"★".repeat(r.estrellas || 5)}{"☆".repeat(5 - (r.estrellas || 5))}</div>
<p className="gs-review-text">"{r.texto}"</p>
</div>
))}
</div>
</div>
)}
<div style={{ textAlign: "center", marginTop: "18px" }}>
<a href="/opinar" onClick={(e) => { e.preventDefault(); setPage("opinar"); window.history.pushState({}, "", "/opinar"); window.scrollTo(0, 0); }} style={{ color: "#8a6d1f", fontSize: "13px", textDecoration: "underline", cursor: "pointer" }}>¿Ya nos compraste? Contanos tu experiencia</a>
</div>
</div>
);
})()}
{(() => { const showCreditNow = user && referralCredit > 0; return (
<div style={{ margin: "0 auto 8px", maxWidth: 900, padding: "0 16px" }}>
<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "14px", background: "#1a1a1a", border: "1px solid #d4af37", borderRadius: "12px", padding: "18px 22px" }}>
<div style={{ flex: "1 1 260px" }}>
<div style={{ color: "#d4af37", fontWeight: 700, fontSize: "15px", fontFamily: "'Playfair Display', serif" }}>{showCreditNow ? "🎁 Tenes credito por referidos sin usar" : "🎁 Invita a un amigo y ganen $5.000 cada uno"}</div>
<div style={{ color: "#bdbdbd", fontSize: "13px", marginTop: "4px" }}>
{showCreditNow
? "Tenes " + formatPrice(referralCredit) + " de credito disponible (se descuenta $5.000 por compra). Usálo en tu proximo pedido."
: (user ? "Compartí tu código y cuando lo usen, ambos reciben $5.000 de descuento." : "Si ya nos compraste, iniciá sesión para conseguir tu código y empezar a ganar descuentos.")}
</div>
</div>
{user ? (
<a href={"https://wa.me/?text=" + encodeURIComponent("Te invito a comprar en Esencia Perfumeria! Usa mi codigo " + referralCode + " y ambos recibimos $5.000 de descuento en tu primera compra. https://www.esenciaperfumeria.com.ar")} target="_blank" rel="noreferrer" style={{ ...S.btnOutline, textDecoration: "none", textAlign: "center", whiteSpace: "nowrap" }}>Compartir mi código</a>
) : (
<button style={{ ...S.btnOutline, whiteSpace: "nowrap" }} onClick={() => { setAccountMode("login"); setAccountError(""); setShowAccountModal(true); }}>Conseguir mi código</button>
)}
</div>
</div>
); })()}
{recentlyViewedProducts.length > 0 && (
<div style={S.recentlyViewedWrap}>
<button style={S.recentlyViewedToggle} onClick={() => setRecentlyViewedOpen(!recentlyViewedOpen)}>
{recentlyViewedOpen ? "▲ Ocultar vistos recientemente" : `🕐 Vistos recientemente (${recentlyViewedProducts.length}) ▾`}
</button>
{recentlyViewedOpen && (
<div style={{ ...S.recentlyViewedRow, marginTop: "10px" }}>
{recentlyViewedProducts.map(p => (
<a key={p.id} className="product-card" href={"/producto/" + p.id} style={{ ...S.recentlyViewedCard, display: "block", textDecoration: "none", color: "inherit" }} onClick={(e) => { e.preventDefault(); setSelectedProduct(p); }}>
<img className="card-img" src={optimizeImg(getProductImage(p), "m")} alt={getProductName(p)} style={S.recentlyViewedImg} loading="lazy" decoding="async" onError={e => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
<div style={S.recentlyViewedName}>{getProductName(p)}</div>
<div style={S.recentlyViewedPrice}>{formatPrice(getProductPrice(p))}</div>
</a>
))}
</div>
)}
</div>
)}
<div style={{ ...S.section, paddingTop: "12px" }} id="productsSection">
<div style={{ ...S.sectionTitle, fontSize: "18px", marginBottom: "8px", paddingBottom: "4px" }}>Productos Disponibles</div>
<div style={S.filterBar}>
<button style={S.filterBtnPrimary(filter === "todos")} onClick={() => setFilter("todos")}>Todos</button>
<button style={S.filterBtnPrimary(filter === "perfumes")} onClick={() => setFilter("perfumes")}>Perfumes</button>
<button style={S.filterBtnPrimary(filter === "stock")} onClick={() => setFilter("stock")}>En Stock</button>
<button style={S.filterBtnPrimary(filter === "pedido")} onClick={() => setFilter("pedido")}>Por Pedido</button>
<button style={S.filterBtnPrimary(filter === "decants")} onClick={() => setFilter("decants")}>Decant</button>
  <button style={S.filterBtnPrimary(filter === "cosmeticos")} onClick={() => setFilter("cosmeticos")}>Cosméticos</button>
<button style={S.filterBtnPrimary(filter === "favoritos")} onClick={() => setFilter("favoritos")}>♥ Favoritos{favorites.length > 0 ? ` (${favorites.length})` : ""}</button>
</div>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", maxWidth: "620px", margin: "0 auto 8px" }}>
<div style={{ ...S.searchWrap, flex: "1 1 240px", maxWidth: "420px", margin: 0 }}>
<svg style={S.searchIconSvg} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
<input type="text" placeholder="Ej: perfume dulce, para verano, parecido a Sauvage..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ ...S.searchInput, padding: "9px 14px 9px 38px", fontSize: "13.5px" }} />
</div>
<select style={{ ...S.select, flex: "0 1 190px", maxWidth: "190px", padding: "8px 12px" }} value={sortBy} onChange={e => setSortBy(e.target.value)} disabled={!!searchQuery.trim()} title={searchQuery.trim() ? "Al buscar, se ordena por relevancia" : "Ordenar por"}>
<option value="relevancia">Ordenar: Novedades</option>
<option value="vendidos">Ordenar: Más vendidos</option>
<option value="precio_asc">Ordenar: Precio menor a mayor</option>
<option value="precio_desc">Ordenar: Precio mayor a menor</option>
</select>
</div>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", margin: "0 0 8px" }} id="advFilterSection">
<button style={S.advFilterToggle} onClick={() => setTagFiltersOpen(!tagFiltersOpen)}>{tagFiltersOpen ? "Ocultar mas filtros ▲" : "Mas filtros (categorias, temporada, ocasion...) ▾"}</button>
<button style={S.advFilterToggle} onClick={() => setAdvFilterOpen(!advFilterOpen)}>{advFilterOpen ? "Ocultar filtros" : "Encontra tu perfume ideal (filtros)"}</button>
</div>
{tagFiltersOpen && (
<div style={S.filterBar}><button style={S.filterBtn(filter === "mas_vendidos")} onClick={() => setFilter("mas_vendidos")}>Mas Vendidos</button><button style={S.filterBtn(filter === "novedades")} onClick={() => setFilter("novedades")}>Novedades</button><button style={S.filterBtn(filter === "larga_duracion")} onClick={() => setFilter("larga_duracion")}>Larga Duracion</button><button style={S.filterBtn(filter === "menos100k")} onClick={() => setFilter("menos100k")}>Menos de $100.000</button><button style={S.filterBtn(filter === "arabes")} onClick={() => setFilter("arabes")}>Perfumes Arabes</button><button style={S.filterBtn(filter === "disenador")} onClick={() => setFilter("disenador")}>Perfumes de Disenador</button><button style={S.filterBtn(filter === "para_regalar")} onClick={() => setFilter("para_regalar")}>Para Regalar</button><button style={S.filterBtn(filter === "top_invierno")} onClick={() => setFilter("top_invierno")}>Top Invierno</button><button style={S.filterBtn(filter === "top_verano")} onClick={() => setFilter("top_verano")}>Top Verano</button><button style={S.filterBtn(filter === "top_oficina")} onClick={() => setFilter("top_oficina")}>Top Oficina</button><button style={S.filterBtn(filter === "top_citas")} onClick={() => setFilter("top_citas")}>Top Citas</button><button style={S.filterBtn(filter === "tendenciasverano2027")} onClick={() => setFilter("tendenciasverano2027")}>☀️ Tendencias Verano 2027</button><button style={S.filterBtn(filter === "tendencia_floral_frutal")} onClick={() => setFilter("tendencia_floral_frutal")}>Floral Frutal</button><button style={S.filterBtn(filter === "tendencia_gourmand_tostado")} onClick={() => setFilter("tendencia_gourmand_tostado")}>Gourmand Tostado</button><button style={S.filterBtn(filter === "tendencia_verde_te")} onClick={() => setFilter("tendencia_verde_te")}>Verde / Te</button><button style={S.filterBtn(filter === "tendencia_almizclado_piel")} onClick={() => setFilter("tendencia_almizclado_piel")}>Almizclado Piel</button><button style={S.filterBtn(filter === "tendencia_gourmand_oscuro")} onClick={() => setFilter("tendencia_gourmand_oscuro")}>Gourmand Oscuro</button>
</div>
)}
{advFilterOpen && (
<div style={{ ...S.advFilterBox, maxWidth: "900px", margin: "0 auto 20px" }}>
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
{filter === "decants" && (
<div style={{ textAlign: "center", background: "linear-gradient(135deg, #ffe28a, #d4af37)", border: "2px solid #a8842c", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px", fontSize: "16px", color: "#1a1200", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.4px", lineHeight: "1.4", boxShadow: "0 4px 18px rgba(212,175,55,0.5)" }}>
🎁 Armá tu set: llevate {DECANT_COMBO_MIN} decants distintos y obtené {Math.round(DECANT_COMBO_DISCOUNT_PCT * 100)}% OFF automático en el carrito
</div>
)}
<div style={{ textAlign: "center", color: "#8a8a8a", fontSize: "12px", marginBottom: "8px" }}>
{!productsLoading && filteredProducts.length > 0 && `Mostrando ${Math.min(visibleCount, filteredProducts.length)} de ${filteredProducts.length} perfumes`}
</div>
<div style={S.grid} className="product-grid">
{productsLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={"skel" + i} />)}
{!productsLoading && filteredProducts.slice(0, visibleCount).flatMap((product, productIdx) => { const card = (
<a key={product.id} className="product-card" href={"/producto/" + product.id} style={{ ...S.card, position: "relative", textDecoration: "none", color: "inherit" }} onClick={(e) => { e.preventDefault(); setSelectedProduct(product); }}>
<button className={"fav-btn" + (favorites.includes(product.id) ? " active" : "")} onClick={e => { e.preventDefault(); e.stopPropagation(); toggleFavorite(product.id); }} style={S.favBtn(favorites.includes(product.id))} aria-label="Favorito">{favorites.includes(product.id) ? "♥" : "♡"}</button>
<img className="card-img" src={optimizeImg(getProductImage(product), "m")} alt={getProductName(product)} style={S.cardImg} loading="lazy" decoding="async" onError={e => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
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
: getProductDisp(product) === "agotado"
? <span style={S.badgeAgotado}>● Agotado</span>
: <span style={S.badgePedido}>Por Pedido · {getProductDias(product)} dias hab.</span>
}
{getUrgencyMsg(product) && <span style={S.urgencyBadge}>{getUrgencyMsg(product)}</span>}
{avgRating && <span style={S.ratingBadge}>★ {avgRating} ({reviewCount})</span>}
</div>
{getProductDisp(product) === "agotado"
? <button className="add-cart-btn" style={{ ...S.btnOutline, width: "100%", marginTop: "auto", padding: "10px" }} onClick={e => { e.preventDefault(); e.stopPropagation(); setSelectedProduct(product); }}>🔔 Avisarme</button>
: <button className="add-cart-btn" style={{ ...S.btn, width: "100%", marginTop: "auto" }} onClick={e => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}>Agregar al Carrito</button>}
</>
)}
{hasDecant(product) && (
<div style={{ marginTop: filter === "decants" ? "0" : "12px", borderTop: filter === "decants" ? "none" : "1px solid #2b2b2b", paddingTop: filter === "decants" ? "0" : "10px" }}>
<div style={{ color: "#d4af37", fontSize: "13px", fontWeight: "bold", marginBottom: "6px" }}>Decant disponible</div>
{getDecantPrice5(product) && (
<button style={{ ...S.btn, width: "100%", marginTop: "6px", background: "transparent", border: "1px solid #d4af37", color: "#d4af37" }} onClick={e => { e.preventDefault(); e.stopPropagation(); addDecantToCart(product, 5); }}>5ml - {formatPrice(getDecantPrice5(product))}</button>
)}
{getDecantPrice10(product) && (
<button style={{ ...S.btn, width: "100%", marginTop: "6px", background: "transparent", border: "1px solid #d4af37", color: "#d4af37" }} onClick={e => { e.preventDefault(); e.stopPropagation(); addDecantToCart(product, 10); }}>10ml - {formatPrice(getDecantPrice10(product))}</button>
)}
</div>
)}
</div>
</a>
); if (productIdx === 11 && trendProducts.length > 0) { return [
<div key="trend-banner" style={{ gridColumn: "1 / -1", ...S.section, padding: "30px 20px", width: "100%", maxWidth: "100%", margin: 0, boxSizing: "border-box" }}>
<div style={S.sectionTitle}>☀️ Tendencias para el Verano 2027</div>
<p style={{ textAlign: "center", color: "#bdbdbd", maxWidth: 560, margin: "-6px auto 18px", fontSize: "14px" }}>Nuestra selección de perfumes ideales para el verano 2027, disponibles ahora.</p>
<div style={S.recentlyViewedRow}>
{trendProducts.map(p => (
<a key={p.id} className="product-card" href={"/producto/" + p.id} style={{ ...S.recentlyViewedCard, display: "block", textDecoration: "none", color: "inherit" }} onClick={(e) => { e.preventDefault(); setSelectedProduct(p); }}>
<img className="card-img" src={optimizeImg(getProductImage(p), "m")} alt={getProductName(p)} style={S.recentlyViewedImg} loading="lazy" decoding="async" onError={e => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
<div style={S.recentlyViewedName}>{getProductName(p)}</div>
<div style={S.recentlyViewedPrice}>{formatPrice(getProductPrice(p))}</div>
</a>
))}
</div>
<div style={{ textAlign: "center", marginTop: "16px" }}>
<button style={S.btnOutline} onClick={() => setFilter("tendenciasverano2027")}>Ver toda la colección</button>
</div>
</div>,
card
]; } return [card]; })}
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
{selectedProduct && (
<div className="gs-pdp-overlay" onClick={() => setSelectedProduct(null)}>
<style>{`
.gs-pdp-overlay { position: fixed; inset: 0; z-index: 200; background: #0b0b0b; overflow-y: auto; -webkit-overflow-scrolling: touch; animation: gsPdpFadeIn .22s ease; }
@keyframes gsPdpFadeIn { from { opacity: 0; } to { opacity: 1; } }
.gs-pdp-grid { max-width: 1320px; margin: 0 auto; display: flex; flex-direction: column; min-height: 100%; }
.gs-pdp-top { display: flex; flex-direction: column; width: 100%; }
.gs-pdp-media { background: #050505; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 20px 24px; }
.gs-pdp-info { padding: 24px 18px 130px; }
.gs-pdp-topbtn { position: fixed; top: 18px; width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(212,175,55,0.35); background: rgba(15,15,15,0.75); backdrop-filter: blur(6px); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; z-index: 220; transition: transform .15s ease, background .15s ease; }
.gs-pdp-topbtn:hover { transform: scale(1.08); background: rgba(212,175,55,0.18); }
.gs-pdp-mainimg-wrap { width: 100%; max-width: 460px; background: #fdfaf3; border-radius: 20px; padding: 30px; box-shadow: 0 24px 70px rgba(0,0,0,0.5); }
.gs-pdp-mainimg { width: 100%; max-height: 46vh; object-fit: contain; display: block; }
.gs-pdp-thumbs { display: flex; gap: 10px; margin-top: 18px; overflow-x: auto; max-width: 460px; width: 100%; justify-content: center; }
.gs-pdp-name { margin: 0 0 10px; font-family: 'Playfair Display', serif; font-size: clamp(24px, 4vw, 34px); line-height: 1.15; }
.gs-pdp-price { font-size: clamp(26px, 3.4vw, 34px); font-weight: 900; color: #d4af37; margin-bottom: 14px; }
.gs-pdp-sticky-cta { position: fixed; bottom: 0; left: 0; right: 0; background: rgba(12,12,12,0.97); backdrop-filter: blur(8px); border-top: 1px solid #2b2b2b; padding: 12px 16px; display: flex; gap: 12px; align-items: center; z-index: 210; }
.gs-pdp-sticky-cta .gs-pdp-sticky-price { color: #d4af37; font-weight: 800; font-size: 16px; white-space: nowrap; }
.gs-pdp-photos-toggle, .gs-pdp-info-toggle { display: none; }
@media (max-width: 899px) {
.gs-mobile-collapsed { display: none !important; }
.gs-pdp-photos-toggle, .gs-pdp-info-toggle { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin-top: 16px; padding: 13px 16px; background: transparent; border: 1px solid #d4af37; color: #d4af37; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; text-align: center; }
}
@media (min-width: 900px) {
.gs-pdp-top { flex-direction: row; align-items: flex-start; }
.gs-pdp-media { position: sticky; top: 0; width: 50%; height: 100vh; padding: 48px; overflow-y: auto; }
.gs-pdp-mainimg { max-height: 60vh; }
.gs-pdp-info { width: 50%; padding: 90px 64px 64px 40px; }
.gs-pdp-sticky-cta { display: none; }
}
.gs-pdp-below { width: 100%; padding: 10px 20px 60px; box-sizing: border-box; }
.gs-pdp-section-title { font-size: 22px; font-weight: 700; margin-bottom: 18px; padding-bottom: 8px; border-bottom: 2px solid #d4af37; font-family: 'Playfair Display', serif; color: #fff; }
.gs-pdp-reviews-block { margin-bottom: 44px; }
.gs-pdp-reviews-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.gs-pdp-similar-scroll { display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; -webkit-overflow-scrolling: touch; }
.gs-pdp-similar-card { display: block; flex-shrink: 0; width: 175px; background: #1a1a1a; border: 1px solid #2b2b2b; border-radius: 10px; padding: 10px; cursor: pointer; transition: border-color .15s ease; text-decoration: none; color: inherit; }
.gs-pdp-similar-card:hover { border-color: #d4af37; }
.gs-pdp-section-title-sm { font-size: 17px; font-weight: 700; margin-bottom: 14px; padding-bottom: 6px; border-bottom: 1px solid #3a3a3a; font-family: 'Playfair Display', serif; color: #cfcfcf; }
`}</style>
<div className="gs-pdp-grid" onClick={e => e.stopPropagation()}>
<button onClick={() => setSelectedProduct(null)} className="gs-pdp-topbtn" style={{ right: "20px" }} aria-label="Cerrar">✕</button>
<button onClick={() => handleShareProduct(selectedProduct)} className="gs-pdp-topbtn" style={{ right: "72px" }} aria-label="Compartir">📤</button>
<button onClick={() => toggleFavorite(selectedProduct.id)} className="gs-pdp-topbtn" style={{ right: "124px", color: favorites.includes(selectedProduct.id) ? "#d4af37" : "#fff" }} aria-label="Favorito">{favorites.includes(selectedProduct.id) ? "♥" : "♡"}</button>
<div className="gs-pdp-top">
<div className="gs-pdp-media">
<div className="gs-pdp-mainimg-wrap">
<img className="gs-pdp-mainimg" src={optimizeImg(modalActiveImg || getProductImage(selectedProduct))} alt={getProductName(selectedProduct)} />
</div>
{(() => {
const pdpPhotos = [selectedProduct.imageUrl, selectedProduct.foto2, selectedProduct.foto3, selectedProduct.fotoMano, selectedProduct.fotoCaja].filter(Boolean);
return pdpPhotos.length > 1 && (
<>
{!showAllPhotos && (
<button type="button" className="gs-pdp-photos-toggle" onClick={() => setShowAllPhotos(true)}>📷 Ver más fotos ({pdpPhotos.length})</button>
)}
<div className={"gs-pdp-thumbs" + (showAllPhotos ? "" : " gs-mobile-collapsed")}>
{pdpPhotos.map((src, i) => (
<img key={i} src={optimizeImg(src, "t")} loading="lazy" decoding="async" onClick={() => setModalActiveImg(src)} style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "6px", cursor: "pointer", border: (modalActiveImg || getProductImage(selectedProduct)) === src ? "2px solid #d4af37" : "2px solid transparent", flexShrink: 0, background: "#fff" }} />
))}
</div>
</>
);
})()}
{selectedProduct.videoUrl && (
<video src={selectedProduct.videoUrl} controls style={{ width: "100%", maxWidth: "460px", borderRadius: "10px", marginTop: "16px", background: "#000" }} />
)}
</div>
<div className="gs-pdp-info">
<h2 className="gs-pdp-name">{getProductName(selectedProduct)}</h2>
{avgRating && <div style={{ ...S.ratingBadge, marginBottom: "10px" }}>★ {avgRating} de 5 · {reviewCount} {reviewCount === 1 ? "opinion" : "opiniones"}</div>}
<div className="gs-pdp-price">
{getDiscountPercent(selectedProduct) && <span style={{ ...S.originalPrice, fontSize: "18px" }}>{formatPrice(getProductOriginalPrice(selectedProduct))}</span>}
{formatPrice(getProductPrice(selectedProduct))}
{getDiscountPercent(selectedProduct) && <span style={S.discountBadge}>-{getDiscountPercent(selectedProduct)}%</span>}
</div>
{getProductDisp(selectedProduct) === "stock"
? <span style={S.badgeStock}><span style={S.badgeStockDot}></span>En Stock - Disponible ahora</span>
: getProductDisp(selectedProduct) === "agotado"
? <span style={S.badgeAgotado}>● Agotado por el momento</span>
: <span style={S.badgePedido}>Por Pedido · {getProductDias(selectedProduct)} dias habiles</span>
}
{getUrgencyMsg(selectedProduct) && <div style={{ ...S.urgencyBadge, display: "inline-block", marginTop: "8px" }}>{getUrgencyMsg(selectedProduct)}</div>}
{(selectedProduct.marca || selectedProduct.genero || selectedProduct.tipoPerfume || selectedProduct.temporada || selectedProduct.duracion || selectedProduct.notas || selectedProduct.notasSalida || selectedProduct.notasCorazon || selectedProduct.notasFondo || selectedProduct.descripcion) && !showFullInfo && (
<button type="button" className="gs-pdp-info-toggle" onClick={() => setShowFullInfo(true)}>Descubrí {getProductName(selectedProduct)} acá ❤️</button>
)}
<div className={"gs-pdp-fullinfo" + (showFullInfo ? "" : " gs-mobile-collapsed")}>
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
{(selectedProduct.notasSalida || selectedProduct.notasCorazon || selectedProduct.notasFondo) && (
<div style={{ marginTop: "16px", background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "10px", padding: "16px" }}>
<div style={{ color: "#d4af37", fontWeight: "bold", fontSize: "14px", marginBottom: "12px" }}>Piramide Olfativa</div>
{selectedProduct.notasSalida && (
<div style={{ marginBottom: "10px" }}>
<div style={{ fontSize: "11px", color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notas de salida</div>
<div style={{ fontSize: "14px", color: "#fff" }}>{selectedProduct.notasSalida}</div>
</div>
)}
{selectedProduct.notasCorazon && (
<div style={{ marginBottom: "10px" }}>
<div style={{ fontSize: "11px", color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notas de corazon</div>
<div style={{ fontSize: "14px", color: "#fff" }}>{selectedProduct.notasCorazon}</div>
</div>
)}
{selectedProduct.notasFondo && (
<div>
<div style={{ fontSize: "11px", color: "#8a8a8a", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notas de fondo</div>
<div style={{ fontSize: "14px", color: "#fff" }}>{selectedProduct.notasFondo}</div>
</div>
)}
</div>
)}
{selectedProduct.descripcion && <p style={{ color: "#bdbdbd", marginTop: "14px", lineHeight: "1.6" }}>{selectedProduct.descripcion}</p>}
</div>
{selectedProduct.inspiradoEn && !showSimilarInfo && (
<button type="button" className="gs-pdp-info-toggle" onClick={() => setShowSimilarInfo(true)}>Descubrí a qué se parece ❤️</button>
)}
{selectedProduct.inspiradoEn && (
<div className={showSimilarInfo ? "" : "gs-mobile-collapsed"}>
<div style={S.compareBox}>
<div style={{ fontWeight: "bold", marginBottom: "6px" }}>{getProductName(selectedProduct)}</div>
<div style={{ color: "#d4af37", fontSize: "20px", lineHeight: "1" }}>&#8595;</div>
<div style={{ fontSize: "13px", color: "#bdbdbd", margin: "4px 0" }}>Se parece a / Inspirado en</div>
<div style={{ fontWeight: "bold", fontSize: "17px" }}>{selectedProduct.inspiradoEn}</div>
{Number(selectedProduct.similitud) > 0 && (
<div style={{ color: "#d4af37", fontWeight: "900", fontSize: "22px", marginTop: "6px" }}>{Number(selectedProduct.similitud)}%</div>
)}
</div>
</div>
)}
{getProductDisp(selectedProduct) === "agotado" ? (
<div style={{ marginTop: "20px", background: "#1a1a1a", border: "1px solid #3a2a2a", borderRadius: "10px", padding: "16px" }}>
{notifyDone ? (
<p style={{ color: "#9ddb9d", margin: 0, textAlign: "center", fontWeight: "600" }}>✓ Listo, te avisamos por WhatsApp apenas vuelva el stock.</p>
) : (
<>
<p style={{ color: "#e8ddc0", margin: "0 0 10px", fontSize: "14px" }}>🔔 Este perfume esta agotado por el momento. Dejanos tu WhatsApp y te avisamos apenas vuelva.</p>
<input id="gs-pdp-notify-input" style={{ ...S.input, marginBottom: "10px" }} type="tel" placeholder="Tu WhatsApp (ej: 291 4261941)" value={notifyPhone} onChange={e => setNotifyPhone(e.target.value)} />
<button style={{ ...S.btn, width: "100%", padding: "12px" }} disabled={notifySubmitting} onClick={() => handleNotifyStock(selectedProduct)}>{notifySubmitting ? "Guardando..." : "Avisarme cuando vuelva"}</button>
</>
)}
</div>
) : (
<>
<button style={{ ...S.btn, width: "100%", padding: "13px", marginTop: "20px", fontSize: "16px" }} onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}>Agregar al Carrito</button>
<button style={S.quickBuyBtn} onClick={() => handleQuickBuy(selectedProduct)}>⚡ Comprar Ahora</button>
</>
)}
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
<div className="gs-pdp-below">
{pdpSimilarProducts.length > 0 && (
<div className="gs-pdp-similar-block">
<div className="gs-pdp-section-title">Productos Similares</div>
<div className="gs-pdp-similar-scroll">
{pdpSimilarProducts.map(p => (
<a key={p.id} className="gs-pdp-similar-card" href={"/producto/" + p.id} onClick={(e) => { e.preventDefault(); setSelectedProduct(p); const ov = document.querySelector(".gs-pdp-overlay"); if (ov) ov.scrollTop = 0; }}>
<img src={optimizeImg(getProductImage(p), "t")} alt={getProductName(p)} loading="lazy" decoding="async" style={{ width: "100%", height: "120px", objectFit: "contain", background: "#fff", borderRadius: "6px", marginBottom: "8px" }} />
<div style={{ fontSize: "12px", color: "#fff", marginBottom: "6px", minHeight: "32px", lineHeight: "1.3" }}>{getProductName(p)}</div>
<div style={{ fontSize: "13px", color: "#d4af37", fontWeight: "700" }}>{formatPrice(getProductPrice(p))}</div>
{getDiscountPercent(p) && <div style={{ fontSize: "11px", color: "#8a8a8a", textDecoration: "line-through" }}>{formatPrice(getProductOriginalPrice(p))}</div>}
</a>
))}
</div>
</div>
)}
<div className="gs-pdp-reviews-block">
<div className="gs-pdp-section-title-sm">Opiniones de Clientes</div>
{avgRating && <div style={{ ...S.ratingBadge, marginBottom: "12px" }}>★ {avgRating} de 5 · {reviewCount} {reviewCount === 1 ? "opinion" : "opiniones"}</div>}
{resenasPublicadas.length === 0 ? (
<p style={{ color: "#8a8a8a" }}>Todavia no hay opiniones cargadas.</p>
) : (
<div className="gs-reviews-scroll">
<div className="gs-reviews-track">
{[...resenasPublicadas.slice(0, 6), ...resenasPublicadas.slice(0, 6)].map((r, i) => (
<div key={r.id + "-" + i} className="gs-review-card">
<div className="gs-review-card-head">
{r.foto ? (
<img src={optimizeImg(r.foto, "t")} alt={r.nombre} loading="lazy" decoding="async" className="gs-review-avatar" />
) : (
<div className="gs-review-avatar-fallback">{(r.nombre || "?").trim().charAt(0).toUpperCase()}</div>
)}
<div>
<div className="gs-review-name">{r.nombre}</div>
{r.ciudad && <div className="gs-review-city">{r.ciudad}</div>}
</div>
</div>
<div className="gs-review-stars">{"★".repeat(r.estrellas || 5)}{"☆".repeat(5 - (r.estrellas || 5))}</div>
<p className="gs-review-text">"{r.texto}"</p>
</div>
))}
</div>
</div>
)}
<div style={{ textAlign: "center", marginTop: "16px" }}>
<a href="/opinar" onClick={(e) => { e.preventDefault(); setSelectedProduct(null); setPage("opinar"); window.history.pushState({}, "", "/opinar"); window.scrollTo(0, 0); }} style={{ color: "#d4af37", fontSize: "13px", textDecoration: "underline", cursor: "pointer" }}>¿Ya nos compraste? Contanos tu experiencia</a>
</div>
</div>
</div>
<div className="gs-pdp-sticky-cta">
<span className="gs-pdp-sticky-price">{formatPrice(getProductPrice(selectedProduct))}</span>
{getProductDisp(selectedProduct) === "agotado" ? (
<button style={{ ...S.btn, flex: 1, padding: "12px" }} disabled={notifySubmitting || notifyDone} onClick={() => notifyPhone.trim() ? handleNotifyStock(selectedProduct) : document.getElementById("gs-pdp-notify-input")?.focus()}>{notifyDone ? "✓ Listo" : "🔔 Avisarme"}</button>
) : (
<button style={{ ...S.btn, flex: 1, padding: "12px" }} onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}>Agregar al Carrito</button>
)}
</div>
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
<div style={{ ...S.cartPointsBox, marginTop: 16 }}><p style={{ color: "#d4af37", fontWeight: 700, margin: 0 }}>Programa de Referidos</p><p style={{ color: "#bdbdbd", margin: "6px 0" }}>Invita a un amigo y ambos reciben $5.000 de descuento.</p><p style={{ color: "#bdbdbd", margin: "6px 0" }}>Tu codigo: <strong style={{ color: "#fff", letterSpacing: "1px" }}>{referralCode || "..."}</strong></p>{referralCredit > 0 && (<p style={{ color: "#d4af37", fontWeight: 700, margin: "6px 0" }}>Tenes {formatPrice(referralCredit)} de credito por referidos (se descuentan $5.000 por compra)</p>)}<a href={"https://wa.me/?text=" + encodeURIComponent("Te invito a comprar en Esencia Perfumeria! Usa mi codigo " + referralCode + " y ambos recibimos $5.000 de descuento en tu primera compra. https://www.esenciaperfumeria.com.ar")} target="_blank" rel="noreferrer" style={{ ...S.btnOutline, display: "block", textAlign: "center", textDecoration: "none", marginTop: 8 }}>Compartir mi codigo por WhatsApp</a></div>
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
{showQuiz && (
<div style={S.modal} onClick={() => setShowQuiz(false)}>
<div style={S.modalBox} onClick={e => e.stopPropagation()}>
<button onClick={() => setShowQuiz(false)} style={{ position: "fixed", top: "16px", right: "16px", background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>x</button>
<h2 style={{ marginTop: 0, marginBottom: 4, fontFamily: "'Playfair Display', serif", color: "#d4af37" }}>Encontrá tu perfume ideal</h2>
{quizStep < QUIZ_QUESTIONS.length ? (
<div>
<p style={{ color: "#8a8a8a", fontSize: 13, margin: "0 0 6px" }}>Pregunta {quizStep + 1} de {QUIZ_QUESTIONS.length}</p>
<div style={{ height: "4px", background: "#2b2b2b", borderRadius: "2px", marginBottom: "22px", overflow: "hidden" }}>
<div style={{ height: "100%", width: (quizStep / QUIZ_QUESTIONS.length * 100) + "%", background: "linear-gradient(135deg, #d4af37, #a8842c)", transition: "width .3s" }} />
</div>
<h3 style={{ marginTop: 0, marginBottom: "16px" }}>{QUIZ_QUESTIONS[quizStep].pregunta}</h3>
<div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
{QUIZ_QUESTIONS[quizStep].opciones.map(o => (
<button key={o.value + o.label} onClick={() => { setQuizAnswers(a => ({ ...a, [QUIZ_QUESTIONS[quizStep].key]: o.value })); setQuizStep(s => s + 1); }} style={{ ...S.btnOutline, textAlign: "left", padding: "13px 16px" }}>{o.label}</button>
))}
</div>
{quizStep > 0 && <button onClick={() => setQuizStep(s => s - 1)} style={{ ...S.btnGray, marginTop: "16px" }}>← Volver</button>}
</div>
) : (
<div>
<p style={{ color: "#bdbdbd", marginBottom: "16px" }}>Estos son los que más se ajustan a lo que buscás:</p>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
{getQuizRecommendations().map(p => (
<a key={p.id} href={"/producto/" + p.id} style={{ display: "block", background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "10px", cursor: "pointer", textDecoration: "none", color: "inherit" }} onClick={(e) => { e.preventDefault(); setShowQuiz(false); setSelectedProduct(p); }}>
<img src={optimizeImg(getProductImage(p), "t")} alt={getProductName(p)} loading="lazy" decoding="async" style={{ width: "100%", height: "90px", objectFit: "contain", background: "#fff", borderRadius: "6px", marginBottom: "8px" }} />
<div style={{ fontSize: "12px", marginBottom: "4px", lineHeight: "1.3" }}>{getProductName(p)}</div>
<div style={{ color: "#d4af37", fontWeight: "700", fontSize: "13px" }}>{formatPrice(getProductPrice(p))}</div>
</a>
))}
</div>
{getQuizRecommendations().length === 0 && <p style={{ color: "#bdbdbd" }}>No encontramos un match exacto todavía. Probá de nuevo con otras respuestas o mirá todo el catálogo.</p>}
<button onClick={() => { setQuizStep(0); setQuizAnswers({ genero: "", ocasion: "", aroma: "", tipo: "" }); }} style={{ ...S.btnOutline, width: "100%", marginTop: "16px" }}>Volver a intentar</button>
<button onClick={() => setShowQuiz(false)} style={{ ...S.btn, width: "100%", marginTop: "10px" }}>Ver todo el catálogo</button>
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
<div style={{ background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px" }}>
<div style={{ fontSize: "13px", color: freeShippingReached ? "#7ea87a" : "#e8ddc0", marginBottom: "8px" }}>
{freeShippingReached
? "✅ Tenes envio gratis a todo el pais en este pedido"
: <>🚚 Te faltan <strong style={{ color: "#d4af37" }}>{formatPrice(freeShippingRemaining)}</strong> para envio gratis a todo el pais</>}
</div>
<div style={{ height: "6px", background: "#2b2b2b", borderRadius: "3px", overflow: "hidden" }}>
<div style={{ height: "100%", width: Math.min(100, (totalCart / FREE_SHIPPING_THRESHOLD) * 100) + "%", background: freeShippingReached ? "#7ea87a" : "linear-gradient(135deg, #d4af37, #a8842c)", transition: "width .3s" }} />
</div>
<div style={{ fontSize: "11px", color: "#8a8a8a", marginTop: "6px" }}>En Bahia Blanca el envio ya es gratis siempre.</div>
</div>
{decantComboCount > 0 && decantComboCount < DECANT_COMBO_MIN && (
<div style={{ background: "rgba(212,175,55,0.18)", border: "1px solid #d4af37", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#fff3d6", fontWeight: "700" }}>
🎁 Sumá {DECANT_COMBO_MIN - decantComboCount} decant{DECANT_COMBO_MIN - decantComboCount > 1 ? "s" : ""} distinto{DECANT_COMBO_MIN - decantComboCount > 1 ? "s" : ""} más y llevate {Math.round(DECANT_COMBO_DISCOUNT_PCT * 100)}% OFF en todos tus decants
</div>
)}
{decantComboActive && (
<div style={{ background: "rgba(126,168,122,0.22)", border: "1px solid #7ea87a", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#eafce6", fontWeight: "700" }}>
🎉 Set de {decantComboCount} decants distintos: {Math.round(DECANT_COMBO_DISCOUNT_PCT * 100)}% OFF aplicado (-{formatPrice(decantComboDiscount)})
</div>
)}
{cart.map(item => (
<div key={item.id} style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
<img src={optimizeImg(getProductImage(item), "t")} alt={getProductName(item)} loading="lazy" decoding="async" style={{ width: "60px", height: "60px", objectFit: "contain", background: "#fff", borderRadius: "6px" }} />
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
{cartSuggestions.length > 0 && (
<div style={{ marginBottom: "16px" }}>
<div style={{ fontSize: "13px", fontWeight: "700", color: "#d4af37", marginBottom: "10px" }}>Tambien te puede interesar</div>
<div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
{cartSuggestions.map(p => (
<div key={p.id} style={{ flexShrink: 0, width: "108px", background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
<img src={optimizeImg(getProductImage(p), "t")} alt={getProductName(p)} loading="lazy" decoding="async" style={{ width: "100%", height: "70px", objectFit: "contain", background: "#fff", borderRadius: "6px", marginBottom: "6px" }} />
<div style={{ fontSize: "11px", color: "#fff", marginBottom: "4px", minHeight: "28px", lineHeight: "1.3" }}>{getProductName(p)}</div>
<div style={{ fontSize: "12px", color: "#d4af37", fontWeight: "700", marginBottom: "6px" }}>{formatPrice(getProductPrice(p))}</div>
<button onClick={() => addToCart(p)} style={{ width: "100%", background: "transparent", border: "1px solid #d4af37", color: "#d4af37", borderRadius: "6px", padding: "5px", fontSize: "11px", cursor: "pointer" }}>+ Agregar</button>
</div>
))}
</div>
</div>
)}
<a href={buildCartWhatsAppUrl()} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "11px", marginBottom: "16px", fontSize: "14px", fontWeight: "700", borderRadius: "8px", border: "1px solid #25D366", background: "transparent", color: "#25D366", textDecoration: "none", boxSizing: "border-box" }}>💬 Prefiero consultar este carrito por WhatsApp</a>
<div style={{ borderTop: "1px solid #2b2b2b", paddingTop: "16px", marginTop: "16px" }}>
<div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>Total: {formatPrice(finalTotal)}{discountFromPoints > 0 && <span style={{ color: "#d4af37", fontSize: 13, display: "block" }}>(incluye descuento de {formatPrice(discountFromPoints)} por puntos)</span>}{decantComboDiscount > 0 && <span style={{ color: "#7ea87a", fontSize: 13, display: "block" }}>(incluye {formatPrice(decantComboDiscount)} OFF por set de decants)</span>}{cuponDiscount > 0 && <span style={{ color: "#9ddb9d", fontSize: 13, display: "block" }}>(incluye {formatPrice(cuponDiscount)} OFF por cupon {cuponEval.cupon && cuponEval.cupon.id})</span>}</div><div style={{ marginBottom: 12 }}>
<input type="text" placeholder="Nombre y apellido *" value={customerName} onChange={e => { setCustomerName(e.target.value); if (checkoutError) setCheckoutError(""); }} style={{ ...S.input, marginBottom: 8, ...(checkoutError && !customerName.trim() ? { border: "1px solid #8b1a2a" } : {}) }} />
<textarea placeholder="Direccion de envio (calle, numero, ciudad) *" value={customerAddress} onChange={e => { setCustomerAddress(e.target.value); if (checkoutError) setCheckoutError(""); }} style={{ ...S.input, minHeight: 50, resize: "vertical", ...(checkoutError && !customerAddress.trim() ? { border: "1px solid #8b1a2a" } : {}) }} />
{checkoutError && <p style={{ color: "#e57373", fontSize: 13, margin: "6px 0 0" }}>{checkoutError}</p>}
</div>
<p style={{ color: "#8a8a8a", fontSize: 12, margin: "-8px 0 12px" }}>* Campos obligatorios para poder pedir por WhatsApp</p>
<div style={S.cartPointsBox}><input type="text" placeholder="Tu telefono de contacto (opcional)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={{ ...S.input, marginBottom: 8 }} />{user ? (<>{customerPoints !== null && (<div style={{ color: "#d4af37", fontSize: 13 }}>Tenes {customerPoints} puntos ({formatPrice(pointsToDiscount(customerPoints))} disponibles){pointsToDiscount(customerPoints) > 0 && (<label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: "#fff" }}><input type="checkbox" checked={redeemPoints} onChange={e => setRedeemPoints(e.target.checked)} />Usar mis puntos en este pedido</label>)}</div>)}<button style={{ ...S.btnOutline, width: "100%", marginTop: 8 }} onClick={() => loadMyPoints(user.uid)} disabled={pointsLoading}>{pointsLoading ? "Consultando..." : "Actualizar mis puntos"}</button>{referralCode && (<div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #2b2b2b" }}><p style={{ color: "#bdbdbd", fontSize: 12, margin: "0 0 4px" }}>Tu codigo de referido: <strong style={{ color: "#fff" }}>{referralCode}</strong></p><a href={"https://wa.me/?text=" + encodeURIComponent("Te invito a comprar en Esencia Perfumeria! Usa mi codigo " + referralCode + " y ambos recibimos $5.000 de descuento en tu primera compra. https://www.esenciaperfumeria.com.ar")} target="_blank" rel="noreferrer" style={{ color: "#d4af37", fontSize: 12, textDecoration: "underline" }}>Compartir con un amigo y ganar $5.000</a></div>)}</>) : (<button style={{ ...S.btnOutline, width: "100%" }} onClick={() => { setAccountMode("login"); setAccountError(""); setShowAccountModal(true); }}>Ingresa para sumar/usar puntos</button>)}</div>
<input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Codigo de descuento (opcional)" style={{ width: "100%", padding: "10px", marginBottom: "4px", borderRadius: "6px", border: "1px solid #2b2b2b", background: "#1a1a1a", color: "#fff", fontSize: "14px", boxSizing: "border-box" }} />
{promoCode.trim() && (cuponEval.motivo === null && cuponEval.cupon ? (
<p style={{ color: "#9ddb9d", fontSize: "13px", margin: "0 0 12px" }}>✓ Cupon {cuponEval.cupon.id} aplicado: {formatPrice(cuponDiscount)} de descuento</p>
) : (
<p style={{ color: "#e0b84a", fontSize: "13px", margin: "0 0 12px" }}>
{cuponEval.motivo === "no_encontrado" && "Ese codigo no existe."}
{cuponEval.motivo === "inactivo" && "Ese cupon ya no esta activo."}
{cuponEval.motivo === "vencido" && "Ese cupon ya vencio."}
{cuponEval.motivo === "minimo" && cuponEval.cupon && ("Necesitas una compra minima de " + formatPrice(cuponEval.cupon.minCompra) + " para usar este cupon.")}
</p>
))}
<input type="text" value={referralInput} onChange={(e) => setReferralInput(e.target.value)} placeholder="Codigo de referido de un amigo (opcional)" style={{ width: "100%", padding: "10px", marginBottom: "8px", borderRadius: "6px", border: "1px solid #2b2b2b", background: "#1a1a1a", color: "#fff", fontSize: "14px", boxSizing: "border-box" }} />{referralInput.trim() && (<p style={{ color: "#d4af37", fontSize: "13px", margin: "0 0 12px" }}>Si el codigo es valido, se descuentan $5.000 al confirmar el pedido.</p>)}{user && referralCredit > 0 && !referralInput.trim() && (<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#d4af37", fontSize: "14px", marginBottom: "12px" }}><input type="checkbox" checked={redeemReferralCredit} onChange={(e) => setRedeemReferralCredit(e.target.checked)} />Usar mi credito de referidos ($5.000 de descuento en esta compra)</label>)}
<div style={{ background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "8px", padding: "10px 12px", marginBottom: "12px" }}>
<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "14px", cursor: "pointer" }}><input type="checkbox" checked={isGift} onChange={e => setIsGift(e.target.checked)} />🎁 Es un regalo</label>
{isGift && (<textarea value={giftMessage} onChange={e => setGiftMessage(e.target.value)} placeholder="Mensaje para incluir (opcional)" style={{ ...S.input, marginTop: "8px", minHeight: "50px", resize: "vertical", width: "100%", boxSizing: "border-box" }} />)}
{isGift && (<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "13px", cursor: "pointer", marginTop: "8px" }}><input type="checkbox" checked={giftWrap} onChange={e => setGiftWrap(e.target.checked)} />🎀 Envolver para regalo (sin costo)</label>)}
{isGift && (<label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "13px", cursor: "pointer", marginTop: "8px" }}><input type="checkbox" checked={hideGiftPrice} onChange={e => setHideGiftPrice(e.target.checked)} />No mostrar el precio en el paquete</label>)}
</div>
<div style={{ background: "#1a1a1a", border: "1px solid " + (checkoutError && !paymentMethod ? "#8b1a2a" : "#2b2b2b"), borderRadius: "8px", padding: "10px 12px", marginBottom: "12px" }}>
<div style={{ color: "#fff", fontSize: "14px", marginBottom: "8px" }}>Forma de pago *</div>
<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
<label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fff", fontSize: "14px", cursor: "pointer", border: "1px solid " + (paymentMethod === "transferencia" ? "#d4af37" : "#2b2b2b"), borderRadius: "6px", padding: "8px 10px", flex: "1 1 140px" }}>
<input type="radio" name="paymentMethod" checked={paymentMethod === "transferencia"} onChange={() => { setPaymentMethod("transferencia"); if (checkoutError) setCheckoutError(""); }} />
🏦 Transferencia bancaria
</label>
<label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fff", fontSize: "14px", cursor: "pointer", border: "1px solid " + (paymentMethod === "efectivo" ? "#d4af37" : "#2b2b2b"), borderRadius: "6px", padding: "8px 10px", flex: "1 1 140px" }}>
<input type="radio" name="paymentMethod" checked={paymentMethod === "efectivo"} onChange={() => { setPaymentMethod("efectivo"); if (checkoutError) setCheckoutError(""); }} />
💵 Efectivo (al momento de la entrega)
</label>
<label style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fff", fontSize: "14px", cursor: "pointer", border: "1px solid " + (paymentMethod === "mercadopago" ? "#d4af37" : "#2b2b2b"), borderRadius: "6px", padding: "8px 10px", flex: "1 1 140px" }}>
<input type="radio" name="paymentMethod" checked={paymentMethod === "mercadopago"} onChange={() => { setPaymentMethod("mercadopago"); if (checkoutError) setCheckoutError(""); }} />
💙 Mercado Pago
</label>
</div>
{paymentMethod === "mercadopago" && (
<div style={{ marginTop: "10px", fontSize: "13px", color: "#e8ddc0", lineHeight: "1.7" }}>
<p style={{ margin: 0 }}>💳 Te llevamos al checkout seguro de Mercado Pago para pagar con tarjeta, debito, dinero en cuenta o en cuotas. Apenas se acredite el pago te abrimos WhatsApp para coordinar el envio.</p>
<p style={{ marginTop: "8px", marginBottom: 0, color: "#bdbdbd" }}>Por ahora los puntos y los codigos de referido no se descuentan pagando con Mercado Pago — para usarlos, elegi transferencia o efectivo.</p>
</div>
)}
{paymentMethod === "transferencia" && (
<div style={{ marginTop: "10px", fontSize: "13px", color: "#e8ddc0", lineHeight: "1.7" }}>
<div><strong style={{ color: "#d4af37" }}>Banco:</strong> {BANK_TRANSFER_INFO.banco}</div>
<div><strong style={{ color: "#d4af37" }}>Titular:</strong> {BANK_TRANSFER_INFO.titular}</div>
<div><strong style={{ color: "#d4af37" }}>CUIL:</strong> {BANK_TRANSFER_INFO.cuil}</div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}><strong style={{ color: "#d4af37" }}>CBU:</strong><span>{BANK_TRANSFER_INFO.cbu}</span><button type="button" onClick={() => { navigator.clipboard.writeText(BANK_TRANSFER_INFO.cbu); showToast("CBU copiado"); }} style={{ background: "transparent", border: "1px solid #d4af37", color: "#d4af37", borderRadius: "5px", padding: "2px 8px", fontSize: "11px", cursor: "pointer" }}>Copiar</button></div>
<div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}><strong style={{ color: "#d4af37" }}>Alias:</strong><span>{BANK_TRANSFER_INFO.alias}</span><button type="button" onClick={() => { navigator.clipboard.writeText(BANK_TRANSFER_INFO.alias); showToast("Alias copiado"); }} style={{ background: "transparent", border: "1px solid #d4af37", color: "#d4af37", borderRadius: "5px", padding: "2px 8px", fontSize: "11px", cursor: "pointer" }}>Copiar</button></div>
<p style={{ marginTop: "8px", marginBottom: 0, color: "#bdbdbd" }}>Despues de transferir, mandanos el comprobante por este mismo WhatsApp para confirmar tu pedido y coordinar el envio.</p>
</div>
)}
{paymentMethod === "efectivo" && (
<p style={{ marginTop: "10px", marginBottom: 0, fontSize: "13px", color: "#bdbdbd" }}>Pagas en efectivo cuando te entreguemos el pedido.</p>
)}
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px", padding: "12px 14px", background: "#1a1a1a", border: "1px solid #2b2b2b", borderRadius: "8px" }}>
<div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "#e8ddc0" }}><span>✔️</span><span>100% original, con garantia</span></div>
<div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "#e8ddc0" }}><span>🔄</span><span>Cambios sin problema si algo no es lo que esperabas</span></div>
<div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "#e8ddc0" }}><span>📦</span><span>{cart.some(i => getProductDisp(i) === "pedido") ? "Algunos productos de tu pedido son por encargue: revisa los dias habiles en cada ficha" : "Coordinamos el envio apenas confirmes tu pedido por WhatsApp"}</span></div>
{getOrderCutoffMessage(cart) && (<div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "12.5px", color: "#d4af37", fontWeight: 600 }}><span>{getOrderCutoffMessage(cart)}</span></div>)}
</div>
<button onClick={() => handleCheckout()} style={{ ...S.btn, display: "block", width: "100%", border: "none", textAlign: "center", padding: "12px", cursor: "pointer" }}>
{paymentMethod === "mercadopago" ? "Pagar con Mercado Pago" : "Pedir por WhatsApp"}
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
{showCartReminder && cart.length > 0 && !showCart && (
<div style={S.cartReminder}>
<button onClick={() => setShowCartReminder(false)} style={S.cartReminderClose} aria-label="Cerrar">×</button>
<div style={{ fontSize: "13px", color: "#e8ddc0", marginBottom: "10px", lineHeight: 1.4 }}>🛍️ Todavia tenes {cart.reduce((a, i) => a + i.qty, 0)} {cart.reduce((a, i) => a + i.qty, 0) === 1 ? "producto" : "productos"} en tu carrito ({formatPrice(totalCart)})</div>
<button onClick={() => { setShowCart(true); setShowCartReminder(false); }} style={{ ...S.btn, width: "100%", padding: "9px", fontSize: "13px" }}>Retomar mi carrito</button>
</div>
)}
{(() => {
const resenasNotice = resenas.filter(r => r.estado !== "pendiente" && r.texto);
const rN = reviewNoticeIdx !== null ? resenasNotice[reviewNoticeIdx] : null;
if (!rN) return null;
return (
<div style={S.reviewNotice}>
<button onClick={() => setReviewNoticeIdx(null)} style={S.reviewNoticeClose} aria-label="Cerrar">×</button>
<div style={{ color: "#d4af37", fontSize: "13px", marginBottom: "6px" }}>{"★".repeat(rN.estrellas || 5)}{"☆".repeat(5 - (rN.estrellas || 5))}</div>
<div style={{ fontSize: "13px", color: "#e8ddc0", marginBottom: "8px", lineHeight: 1.4 }}>"{rN.texto}"</div>
<div style={{ fontSize: "11.5px", color: "#9a9a9a" }}>{rN.nombre}{rN.ciudad ? ` · ${rN.ciudad}` : ""} · Reseña real</div>
</div>
);
})()}
{welcomePopupOpen && (
<div style={S.modal} onClick={() => setWelcomePopupOpen(false)}>
<div style={{ ...S.modalBox, maxWidth: "420px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
<button onClick={() => setWelcomePopupOpen(false)} style={{ position: "absolute", top: "12px", right: "12px", background: "none", border: "none", color: "#9a9a9a", fontSize: "20px", cursor: "pointer", lineHeight: 1 }}>×</button>
{welcomePopupDone ? (
<>
<div style={{ fontSize: "34px", marginBottom: "8px" }}>🎉</div>
<h2 style={{ margin: "0 0 10px", fontFamily: "'Playfair Display', serif", color: "#d4af37", fontSize: "22px" }}>Listo, ya sos parte!</h2>
<p style={{ color: "#bdbdbd", fontSize: "14px", lineHeight: 1.5, margin: "0 0 16px" }}>Usá este código en el carrito para llevarte 5% OFF en tu primera compra:</p>
<div style={{ background: "#0f0f0f", border: "2px dashed #d4af37", borderRadius: "10px", padding: "14px", fontSize: "22px", fontWeight: "800", letterSpacing: "2px", color: "#d4af37", marginBottom: "16px" }}>{WELCOME_COUPON_CODE}</div>
<button style={{ ...S.btn, width: "100%" }} onClick={() => setWelcomePopupOpen(false)}>Seguir viendo perfumes</button>
</>
) : (
<>
<div style={{ fontSize: "34px", marginBottom: "8px" }}>✨</div>
<h2 style={{ margin: "0 0 10px", fontFamily: "'Playfair Display', serif", color: "#d4af37", fontSize: "22px" }}>5% OFF en tu primera compra</h2>
<p style={{ color: "#bdbdbd", fontSize: "14px", lineHeight: 1.5, margin: "0 0 16px" }}>Dejanos tu WhatsApp y te mandamos el cupón al toque, más ofertas y novedades directo a tu celular.</p>
<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
<input type="tel" placeholder="Tu WhatsApp (con código de área)" value={welcomePopupPhone} onChange={e => setWelcomePopupPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && handleWelcomePopupSubscribe()} style={S.input} />
<button style={{ ...S.btn, width: "100%", opacity: welcomePopupSaving ? 0.6 : 1 }} onClick={handleWelcomePopupSubscribe} disabled={welcomePopupSaving}>{welcomePopupSaving ? "Un momento..." : "Quiero mi 5% OFF"}</button>
</div>
<button onClick={() => setWelcomePopupOpen(false)} style={{ background: "none", border: "none", color: "#7a7a7a", fontSize: "12px", cursor: "pointer", marginTop: "12px" }}>No, gracias</button>
</>
)}
</div>
</div>
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
<div style={S.footerHeading}>Novedades por email</div>
<p style={S.footerText}>Sumate para enterarte de lanzamientos y promos exclusivas antes que nadie.</p>
<div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
<input type="email" value={newsletterEmail} onChange={e => setNewsletterEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubscribeNewsletter()} placeholder="Tu email" style={{ ...S.input, padding: "8px 10px", fontSize: "13px" }} />
<button onClick={handleSubscribeNewsletter} disabled={newsletterSaving} style={{ ...S.btn, padding: "8px 14px", fontSize: "13px", opacity: newsletterSaving ? 0.6 : 1, whiteSpace: "nowrap" }}>{newsletterSaving ? "..." : "Sumarme"}</button>
</div>
</div>
<div>
<div style={S.footerHeading}>Ayuda</div>
<a href="https://wa.me/2914261941" target="_blank" rel="noreferrer" style={S.footerLink}>Hacer un pedido por WhatsApp</a>
<a href="https://wa.me/2914261941?text=Hola!%20Tengo%20una%20consulta%20sobre%20un%20pedido" target="_blank" rel="noreferrer" style={S.footerLink}>Consultar sobre un pedido</a>
<a href="#" onClick={(e) => { e.preventDefault(); setAssistantOpen(true); }} style={S.footerLink}>Preguntas frecuentes</a>
<a href="#advFilterSection" style={S.footerLink}>Encontra tu perfume ideal</a>
<a href="/blog" onClick={(e) => { e.preventDefault(); setPage("blog"); window.history.pushState({}, "", "/blog"); window.scrollTo(0, 0); }} style={S.footerLink}>Blog</a>
<a href="/devoluciones" onClick={(e) => { e.preventDefault(); setPage("devoluciones"); window.history.pushState({}, "", "/devoluciones"); window.scrollTo(0, 0); }} style={S.footerLink}>Política de Cambios y Devoluciones</a>
<a href="/opinar" onClick={(e) => { e.preventDefault(); setPage("opinar"); window.history.pushState({}, "", "/opinar"); window.scrollTo(0, 0); }} style={S.footerLink}>Dejar mi opinión</a>
</div>
<div>
<div style={S.footerHeading}>Contacto</div>
<a href="https://wa.me/2914261941" target="_blank" rel="noreferrer" style={S.footerLink}>WhatsApp: +54 9 291 426-1941</a>
<a href="https://www.instagram.com/esenciaperfumeria.bb/" target="_blank" rel="noreferrer" style={S.footerLink}>Instagram: @esenciaperfumeria.bb</a>
<span style={S.footerLink}>Bahia Blanca, Argentina</span>
</div>
<div>
<div style={S.footerHeading}>Compras</div>
<span style={S.footerLink}>Pago: coordinado por WhatsApp (efectivo, transferencia, Mercado Pago)</span>
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
