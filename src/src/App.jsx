import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";

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

const ADMIN_PASSWORD = "ganga2024";
const IMGUR_CLIENT_ID = "546c25a59c58ad7";
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
  const [assistantChat, setAssistantChat] = useState([{ from: "bot", text: "Hola! Soy el asistente virtual de GangaStore. Elegi una opcion para que te ayude:" }]);
  const [promoCode, setPromoCode] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    precio: "",
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
    similitud: ""
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
        if (products.length > 0) {
            setTickerProducts(shuffleArray(products));
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
      similitud: form.similitud ? Number(form.similitud) : null
    };
    if (editingId) {
      await updateDoc(doc(db, "productos", editingId), productData);
      setEditingId(null);
    } else {
      await addDoc(collection(db, "productos"), { ...productData, createdAt: serverTimestamp() });
    }
    setForm({ nombre: "", precio: "", descripcion: "", imageUrl: "", foto2: "", foto3: "", fotoMano: "", fotoCaja: "", videoUrl: "", disponibilidad: "stock", diasHabiles: "3", categoria: "perfume", marca: "", genero: "", temporada: "", tipoPerfume: "", duracion: "", notas: "", inspiradoEn: "", similitud: "" });
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
      similitud: p.similitud || ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ nombre: "", precio: "", descripcion: "", imageUrl: "", foto2: "", foto3: "", fotoMano: "", fotoCaja: "", videoUrl: "", disponibilidad: "stock", diasHabiles: "3", categoria: "perfume", marca: "", genero: "", temporada: "", tipoPerfume: "", duracion: "", notas: "", inspiradoEn: "", similitud: "" });
    setUploadMsg("");
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm("Eliminar este producto?")) return;
    await deleteDoc(doc(db, "productos", id));
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

  const formatPrice = (p) => {
    const n = Number(p);
    if (!p || isNaN(n)) return "Consultar";
    return "$" + n.toLocaleString("es-CL");
  };

  const getProductName = (p) => p.nombre || p.name || p.title || "Producto";
  const getProductPrice = (p) => p.precio || p.price || 0;
  const getProductImage = (p) => p.imageUrl || p.foto || p.image || p.img || "";
  const getProductDisp = (p) => p.disponibilidad || "stock";
  const getProductDias = (p) => p.diasHabiles || "3-5";
  const getProductCategoria = (p) => p.categoria || "otro";
  const isPerfume = (p) => {
    if (getProductCategoria(p) === "perfume") return true;
    const name = getProductName(p).toLowerCase();
    return name.includes("perfum") || name.includes("edp") || name.includes("elixir") || name.includes("victoria secret") || name.includes("lattafa") || name.includes("bharara") || name.includes("phantom") || name.includes("givenchy") || name.includes("paco rabane") || name.includes("yara") || name.includes("club de nuit");
  };

  const assistantFaqs = [
    { q: "Como comprar", a: "Elegi el producto que te guste, toca 'Agregar al Carrito' y despues 'Pedir por WhatsApp' para confirmar el pedido. Asi de facil!" },
    { q: "Envios", a: "Hacemos envio gratis dentro de Bahia Blanca. Tambien enviamos a todo el pais, coordinando el costo por WhatsApp." },
    { q: "Formas de pago", a: "Coordinamos la forma de pago (efectivo, transferencia, etc.) directamente por WhatsApp para confirmarte todas las opciones disponibles." },
    { q: "Stock y por pedido", a: "Los productos 'En Stock' se entregan de inmediato. Los que dicen 'Por Pedido' muestran en su tarjeta cuantos dias habiles tardan en llegar." },
    { q: "No encuentro lo que busco", a: "No hay problema! Si no encontras el producto que buscas, sea perfumeria, tecnologia o cualquier otra cosa, escribinos por WhatsApp contandonos que necesitas y te ayudamos a conseguirlo o pedirlo especialmente para vos." },
  ];
  const askAssistant = (faq) => {
    setAssistantChat(prev => [...prev, { from: "user", text: faq.q }, { from: "bot", text: faq.a }]);
  };
  const filteredProducts = products.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const nameMatch = getProductName(p).toLowerCase().includes(q);
      const descMatch = (p.descripcion || "").toLowerCase().includes(q);
      if (!nameMatch && !descMatch) return false;
    }
    if (filter === "stock") return getProductDisp(p) === "stock";
    if (filter === "pedido") return getProductDisp(p) === "pedido";
    if (filter === "perfumes") return isPerfume(p);
    if (filter === "gangatech") return !isPerfume(p);
    if (filterMarca && (p.marca || "") !== filterMarca) return false;
    if (filterDuracion && (p.duracion || "") !== filterDuracion) return false;
    if (filterNotas.trim() && !(p.notas || "").toLowerCase().includes(filterNotas.trim().toLowerCase())) return false;
    if (filterTemporada && (p.temporada || "") !== filterTemporada) return false;
    if (filterGenero && (p.genero || "") !== filterGenero) return false;
    if (filterTipo && (p.tipoPerfume || "") !== filterTipo) return false;
    if (filterPrecioMin && getProductPrice(p) < Number(filterPrecioMin)) return false;
    if (filterPrecioMax && getProductPrice(p) > Number(filterPrecioMax)) return false;
    return true;
  });
  const S = {
    body: { margin: 0, fontFamily: "'Inter', 'Segoe UI', sans-serif", background: "#0f0f0f", color: "#ffffff", minHeight: "100vh" },
    nav: { position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", background: "#0f0f0f", borderBottom: "1px solid #2b2b2b", color: "#ffffff" },
    logo: { fontSize: "clamp(28px,5vw,52px)", fontWeight: "700", fontFamily: "'Playfair Display', serif", color: "#d4af37", cursor: "pointer" },
    btn: { background: "linear-gradient(135deg, #d4af37, #a8842c)", color: "#000000", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "700" },
    btnOutline: { background: "transparent", color: "#d4af37", border: "1px solid #d4af37", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" },
    btnGray: { background: "#2b2b2b", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer" },
    navCartBtn: { position: "fixed", top: "16px", right: "24px", background: "linear-gradient(135deg, #d4af37, #a8842c)", color: "#000000", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", zIndex: 55, boxShadow: "0 4px 14px rgba(0,0,0,0.4)" },
    navPromo: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", fontFamily: "'Playfair Display', serif", fontWeight: "700", fontSize: "13px", letterSpacing: "1px", textAlign: "center", maxWidth: "55%" },
    hero: { textAlign: "center", padding: "90px 20px 70px", background: "linear-gradient(135deg, #f8f4ea 0%, #f0e6d2 100%)" },
    heroTag: { fontSize: "13px", color: "#d4af37", letterSpacing: "4px", textTransform: "uppercase", marginBottom: "14px", fontWeight: "600" },
    heroTitle: { fontSize: "clamp(28px,5vw,52px)", fontWeight: "700", margin: "0 16px 14px", fontFamily: "'Playfair Display', serif", color: "#d4af37" },
    heroSub: { fontSize: "17px", color: "#d4af37", margin: "0 0 8px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto", lineHeight: "1.6" },
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
    tickerSection: { padding: "40px 0", background: "#0f0f0f", borderTop: "1px solid #2b2b2b", borderBottom: "1px solid #2b2b2b", overflow: "hidden" },
    tickerTrack: { display: "flex", gap: "30px", width: "max-content", animation: "gangaTicker 90s linear infinite" },
    tickerItem: { background: "#1a1a1a", borderRadius: "12px", overflow: "hidden", border: "1px solid #2b2b2b", width: "220px", flexShrink: 0, cursor: "pointer" },
    filterBtn: (a) => ({ background: a ? "linear-gradient(135deg, #d4af37, #a8842c)" : "#1a1a1a", color: a ? "#000000" : "#ffffff", border: a ? "none" : "1px solid #2b2b2b", padding: "8px 20px", borderRadius: "20px", cursor: "pointer", fontWeight: "600" }),
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "30px" },
    card: { background: "#1a1a1a", borderRadius: "12px", overflow: "hidden", border: "1px solid #2b2b2b", cursor: "pointer" },
    cardImg: { width: "100%", aspectRatio: "1/1", objectFit: "contain", background: "#fff", display: "block" },
    cardBody: { padding: "14px" },
    cardName: { fontSize: "15px", fontWeight: "700", marginBottom: "6px", color: "#ffffff" },
    cardPrice: { fontSize: "16px", fontWeight: "900", color: "#d4af37", marginBottom: "8px" },
    badgeStock: { display: "inline-block", background: "#1a1a1a", color: "#d4af37", padding: "3px 10px", borderRadius: "20px", fontSize: "12px" },
    badgePedido: { display: "inline-block", background: "#1a1a1a", color: "#ffffff", padding: "3px 10px", borderRadius: "20px", fontSize: "12px" },
    modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 50 },
    modalBox: { background: "#1a1a1a", borderRadius: "16px", maxWidth: "500px", width: "100%", padding: "24px", position: "relative", maxHeight: "90vh", overflowY: "auto", border: "1px solid #2b2b2b" },
    modalImg: { width: "100%", maxHeight: "360px", objectFit: "contain", background: "#fff", borderRadius: "10px", marginBottom: "16px", display: "block" },
    input: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid #2b2b2b", color: "#ffffff", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" },
    select: { width: "100%", padding: "10px 14px", background: "#1a1a1a", border: "1px solid #2b2b2b", color: "#ffffff", borderRadius: "8px", fontSize: "14px", boxSizing: "border-box" },
    label: { display: "block", marginBottom: "6px", color: "#bdbdbd", fontSize: "14px" },
    cartOverlay: { position: "fixed", right: 0, top: 0, bottom: 0, width: "320px", background: "#0f0f0f", borderLeft: "2px solid #d4af37", padding: "70px 20px 20px 20px", overflowY: "auto", zIndex: 40 },
    adminWrap: { maxWidth: "640px", margin: "40px auto", padding: "20px" },
    adminCard: { background: "#1a1a1a", borderRadius: "12px", padding: "28px", border: "1px solid #2b2b2b" },
    loginWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#0f0f0f" },
    loginBox: { background: "#1a1a1a", borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "400px", border: "1px solid #2b2b2b", textAlign: "center" },
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
          <div style={S.logo} onClick={() => { setPage("home"); window.history.pushState({}, "", "/"); }}>GangaStore</div>
          <div style={{ display: "flex", gap: "10px" }}>
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
            <input style={{ ...S.input, marginBottom: "16px" }} type="number" min="0" max="100" placeholder="Ej: 95" value={form.similitud} onChange={e => setForm(f => ({ ...f, similitud: e.target.value }))} />
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
        </div>
      </div>
    );
  }
  return (
    <div style={S.body}>
      <div style={S.nav}>
        <div style={S.logo}>GangaStore</div>
        <div style={S.navPromo}><span style={{ color: "#d4af37" }}>PERFUMES ORIGINALES</span> / <span style={{ color: "#ffffff" }}>APROVECHA CODIGO PROMOCIONAL</span></div>
        <button onClick={() => setShowCart(true)} style={S.navCartBtn}>Carrito ({cart.length})</button>
      </div>
      <div style={S.hero}>
        <div style={S.heroTag}>La casa del perfume árabe y de diseñador</div>
        <h1 style={S.heroTitle}>Ganga<span style={{ color: "#d4af37" }}>Store</span></h1>
        <p style={S.heroSub}>Más de 300 fragancias originales · Envío gratis en Bahía Blanca · Envíos a todo Argentina</p>
</div>
      <div style={S.tickerSection}>
        <style>{`@keyframes gangaTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } } @keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } } .product-card { transition: transform 0.3s ease, box-shadow 0.3s ease; animation: fadeInUp 0.6s ease both; } .product-card:hover, .product-card:active { transform: translateY(-6px); box-shadow: 0 14px 28px rgba(212,175,55,0.18); }`}</style>
      <div style={S.tickerTrack}>
        {[...tickerProducts, ...tickerProducts].map((p, i) => (
      <div key={i} className="product-card" style={S.tickerItem} onClick={() => setSelectedProduct(p)}>
      <img src={getProductImage(p)} alt={getProductName(p)} style={S.cardImg} onError={(e) => { e.target.src = "https://placehold.co/300x300?text=Sin+Imagen"; }} />
      <div style={S.cardBody}>
      <div style={S.cardName}>{getProductName(p)}</div>
      <div style={S.cardPrice}>{formatPrice(getProductPrice(p))}</div>
      {getProductDisp(p) === "stock"
        ? <span style={S.badgeStock}>En Stock</span>
        : <span style={S.badgePedido}>Por Pedido: {getProductDias(p)} dias hab.</span>
      }
      <br />
      <button style={{ ...S.btn, width: "100%", marginTop: "10px" }} onClick={e => { e.stopPropagation(); addToCart(p); }}>Agregar al Carrito</button>
      </div>
      </div>
      ))}
      </div>
      </div>
      <div style={S.section}>
        <div style={S.sectionTitle}>Productos Disponibles</div>
        <div style={S.searchWrap}>
          <svg style={S.searchIconSvg} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" placeholder="Buscar producto por nombre..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={S.searchInput} />
        </div>
        <div style={S.filterBar}>
          <button style={S.filterBtn(filter === "todos")} onClick={() => setFilter("todos")}>Todos</button>
          <button style={S.filterBtn(filter === "perfumes")} onClick={() => setFilter("perfumes")}>Perfumes</button>
          <button style={S.filterBtn(filter === "stock")} onClick={() => setFilter("stock")}>En Stock</button>
          <button style={S.filterBtn(filter === "pedido")} onClick={() => setFilter("pedido")}>Por Pedido</button>
          <button style={S.filterBtn(filter === "gangatech")} onClick={() => setFilter("gangatech")}>Ganga Tech</button>
        </div>
        <div style={S.advFilterWrap}>
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
                    {[...new Set(products.map(p => p.duracion).filter(Boolean))].sort().map(d => (
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
                <div style={S.cardPrice}>{formatPrice(getProductPrice(product))}</div>
                {getProductDisp(product) === "stock"
                  ? <span style={S.badgeStock}>En Stock</span>
                  : <span style={S.badgePedido}>Por Pedido: {getProductDias(product)} dias hab.</span>
                }
                <br />
                <button style={{ ...S.btn, width: "100%", marginTop: "10px" }} onClick={e => { e.stopPropagation(); addToCart(product); }}>Agregar al Carrito</button>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && <p style={{ color: "#bdbdbd", gridColumn: "1/-1" }}>No hay productos en esta categoria.</p>}
        </div>
      </div>
      {selectedProduct && (
        <div style={S.modal} onClick={() => setSelectedProduct(null)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedProduct(null)} style={{ position: "absolute", top: "12px", right: "16px", background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}>x</button>
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
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#d4af37", marginBottom: "12px" }}>{formatPrice(getProductPrice(selectedProduct))}</div>
            {getProductDisp(selectedProduct) === "stock"
              ? <span style={S.badgeStock}>En Stock - Disponible ahora</span>
              : <span style={S.badgePedido}>Por Pedido: {getProductDias(selectedProduct)} dias habiles</span>
            }
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
      {showCart && (
        <div style={S.cartOverlay}>
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
                <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>Total: {formatPrice(totalCart)}</div>
                <input type="text" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Codigo promocional (opcional)" style={{ width: "100%", padding: "10px", marginBottom: "12px", borderRadius: "6px", border: "1px solid #2b2b2b", background: "#1a1a1a", color: "#fff", fontSize: "14px", boxSizing: "border-box" }} />
                <a href={`https://wa.me/2914261941?text=Hola!%20Quiero%20pedir:%20${cart.map(i => getProductName(i) + "%20x" + i.qty).join("%2C%20")}${promoCode ? ("%20-%20Codigo%20promocional:%20" + encodeURIComponent(promoCode)) : ""}`} target="_blank" rel="noreferrer" style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none", padding: "12px" }}>
                  Pedir por WhatsApp
                </a>
              </div>
            </>
          )}
        </div>
      )}
      <button style={S.assistantBtn} onClick={() => setAssistantOpen(!assistantOpen)} title="Asistente virtual">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      </button>
      {assistantOpen && (
        <div style={S.assistantPanel}>
          <div style={S.assistantHeader}>
            <strong style={{ fontSize: "14px" }}>Asistente GangaStore</strong>
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
