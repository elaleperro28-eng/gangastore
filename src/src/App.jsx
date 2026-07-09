import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";

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
  const [form, setForm] = useState({
    nombre: "",
    precio: "",
    descripcion: "",
    imageUrl: "",
    disponibilidad: "stock",
    diasHabiles: "3",
    categoria: "perfume"
  });
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileInputRef = useRef(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

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

  const handleAdminLogin = () => {
    if (adminPass === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setAdminError("");
      setPage("admin");
    } else {
      setAdminError("Contrasena incorrecta");
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadMsg("Subiendo imagen...");
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
        setForm(f => ({ ...f, imageUrl: data.data.link }));
        setUploadMsg("Imagen subida correctamente");
      } else {
        setUploadMsg("Error al subir imagen");
      }
    } catch {
      setUploadMsg("Error de conexion");
    }
    setUploading(false);
  };

  const handleAddProduct = async () => {
    if (!form.nombre.trim()) return alert("Ingresa el nombre del producto");
    if (!form.precio) return alert("Ingresa el precio");
    if (!form.imageUrl) return alert("Sube una imagen primero");
    await addDoc(collection(db, "productos"), {
      nombre: form.nombre,
      precio: Number(form.precio),
      descripcion: form.descripcion,
      imageUrl: form.imageUrl,
      disponibilidad: form.disponibilidad,
      diasHabiles: form.disponibilidad === "pedido" ? form.diasHabiles : null,
      categoria: form.categoria,
      createdAt: serverTimestamp()
    });
    setForm({ nombre: "", precio: "", descripcion: "", imageUrl: "", disponibilidad: "stock", diasHabiles: "3", categoria: "perfume" });
    setUploadMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    alert("Producto agregado exitosamente");
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

  const filteredProducts = products.filter(p => {
    if (filter === "stock") return getProductDisp(p) === "stock";
    if (filter === "pedido") return getProductDisp(p) === "pedido";
    if (filter === "perfumes") return isPerfume(p);
    if (filter === "gangatech") return !isPerfume(p);
    return true;
  });
  const S = {
    body: { margin: 0, fontFamily: "'Inter', 'Segoe UI', sans-serif", background: "#0f0f0f", color: "#ffffff", minHeight: "100vh" },
    nav: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 28px", background: "#0f0f0f", borderBottom: "1px solid #2b2b2b", color: "#ffffff" },
    logo: { fontSize: "22px", fontWeight: "700", letterSpacing: "2px", fontFamily: "'Playfair Display', serif", cursor: "pointer" },
    logoSpan: { color: "#d4af37" },
    btn: { background: "linear-gradient(135deg, #d4af37, #a8842c)", color: "#000000", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "700" },
    btnOutline: { background: "transparent", color: "#d4af37", border: "1px solid #d4af37", padding: "10px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" },
    btnGray: { background: "#2b2b2b", color: "#fff", border: "none", padding: "10px 18px", borderRadius: "6px", cursor: "pointer" },
    hero: { textAlign: "center", padding: "90px 20px 70px", background: "radial-gradient(circle at 25% 20%, rgba(212,175,55,0.16), transparent 55%), radial-gradient(circle at 80% 75%, rgba(212,175,55,0.10), transparent 55%), linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)" },
    heroTag: { fontSize: "13px", color: "#d4af37", letterSpacing: "4px", textTransform: "uppercase", marginBottom: "14px", fontWeight: "600" },
    heroTitle: { fontSize: "clamp(28px,5vw,52px)", fontWeight: "700", margin: "0 16px 14px", fontFamily: "'Playfair Display', serif" },
    heroSub: { fontSize: "17px", color: "#bdbdbd", margin: "0 0 8px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto", lineHeight: "1.6" },
    section: { padding: "70px 20px", maxWidth: "1200px", margin: "0 auto" },
    sectionTitle: { fontSize: "24px", fontWeight: "700", marginBottom: "24px", borderBottom: "2px solid #d4af37", paddingBottom: "8px", fontFamily: "'Playfair Display', serif" },
    filterBar: { display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", justifyContent: "center" },
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
    cartOverlay: { position: "fixed", right: 0, top: 0, bottom: 0, width: "320px", background: "#0f0f0f", borderLeft: "2px solid #d4af37", padding: "20px", overflowY: "auto", zIndex: 40 },
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
          <div style={S.logo} onClick={() => { setPage("home"); window.history.pushState({}, "", "/"); }}><span style={S.logoSpan}>GANGA</span>STORE</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { setPage("home"); window.history.pushState({}, "", "/"); }} style={S.btnOutline}>Ver Tienda</button>
            <button onClick={() => { setIsAdmin(false); setPage("adminLogin"); }} style={S.btnGray}>Cerrar Sesion</button>
          </div>
        </div>
        <div style={S.adminWrap}>
          <h2 style={{ color: "#d4af37", marginBottom: "24px", fontFamily: "'Playfair Display', serif" }}>Panel de Administracion</h2>
          <div style={S.adminCard}>
            <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Agregar Nuevo Producto</h3>
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
            <label style={S.label}>Imagen del Producto *</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0])} style={{ ...S.input, padding: "8px" }} />
            {uploading && <p style={{ color: "#d4af37" }}>Subiendo imagen...</p>}
            {uploadMsg && !uploading && <p style={{ color: uploadMsg.includes("Error") ? "#ff4444" : "#d4af37" }}>{uploadMsg}</p>}
            {form.imageUrl && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ color: "#d4af37", marginBottom: "8px" }}>Vista previa:</p>
                <img src={form.imageUrl} alt="preview" style={{ width: "100%", maxHeight: "200px", objectFit: "contain", background: "#fff", borderRadius: "8px" }} />
              </div>
            )}
            <button onClick={handleAddProduct} disabled={uploading} style={{ ...S.btn, width: "100%", padding: "12px", opacity: uploading ? 0.6 : 1 }}>Agregar Producto</button>
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
        <div style={S.logo}><span style={S.logoSpan}>GANGA</span>STORE</div>
        <button onClick={() => setShowCart(true)} style={S.btn}>Carrito ({cart.length})</button>
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
        <div style={S.filterBar}>
          <button style={S.filterBtn(filter === "todos")} onClick={() => setFilter("todos")}>Todos</button>
          <button style={S.filterBtn(filter === "perfumes")} onClick={() => setFilter("perfumes")}>Perfumes</button>
          <button style={S.filterBtn(filter === "stock")} onClick={() => setFilter("stock")}>En Stock</button>
          <button style={S.filterBtn(filter === "pedido")} onClick={() => setFilter("pedido")}>Por Pedido</button>
          <button style={S.filterBtn(filter === "gangatech")} onClick={() => setFilter("gangatech")}>Ganga Tech</button>
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
            <img src={getProductImage(selectedProduct)} alt={getProductName(selectedProduct)} style={S.modalImg} />
            <h2 style={{ marginTop: 0, marginBottom: "8px", fontFamily: "'Playfair Display', serif" }}>{getProductName(selectedProduct)}</h2>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#d4af37", marginBottom: "12px" }}>{formatPrice(getProductPrice(selectedProduct))}</div>
            {getProductDisp(selectedProduct) === "stock"
              ? <span style={S.badgeStock}>En Stock - Disponible ahora</span>
              : <span style={S.badgePedido}>Por Pedido: {getProductDias(selectedProduct)} dias habiles</span>
            }
            {selectedProduct.descripcion && <p style={{ color: "#bdbdbd", marginTop: "14px", lineHeight: "1.6" }}>{selectedProduct.descripcion}</p>}
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
                <a href={`https://wa.me/2914261941?text=Hola!%20Quiero%20pedir:%20${cart.map(i => getProductName(i) + "%20x" + i.qty).join("%2C%20")}`} target="_blank" rel="noreferrer" style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none", padding: "12px" }}>
                  Pedir por WhatsApp
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
