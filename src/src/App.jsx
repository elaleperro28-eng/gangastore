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

export default function App() {
  const [page, setPage] = useState(() => {
    const path = window.location.pathname;
    if (path === "/admin-login" || path === "/admin-login/") return "adminLogin";
    return "home";
  });
  const [products, setProducts] = useState([]);
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
    diasHabiles: "3"
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
      createdAt: serverTimestamp()
    });
    setForm({ nombre: "", precio: "", descripcion: "", imageUrl: "", disponibilidad: "stock", diasHabiles: "3" });
    setUploadMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    alert("Producto agregado exitosamente");
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm("Eliminar este producto?")) {
      await deleteDoc(doc(db, "productos", id));
    }
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

  const filteredProducts = products.filter(p => {
    if (filter === "stock") return getProductDisp(p) === "stock";
    if (filter === "pedido") return getProductDisp(p) === "pedido";
    return true;
  });

  const S = {
    body: { margin: 0, fontFamily: "'Segoe UI', sans-serif", background: "#111", color: "#fff", minHeight: "100vh" },
    nav: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px", background: "#1a1a1a", borderBottom: "2px solid #ff6600", position: "sticky", top: 0, zIndex: 100 },
    logo: { fontSize: "26px", fontWeight: "bold", color: "#fff", cursor: "pointer" },
    logoSpan: { color: "#ff6600" },
    btn: { background: "#ff6600", color: "#fff", border: "none", padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
    btnOutline: { background: "transparent", color: "#ff6600", border: "2px solid #ff6600", padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
    btnGray: { background: "#555", color: "#fff", border: "none", padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "14px" },
    hero: { textAlign: "center", padding: "60px 20px 40px", background: "linear-gradient(135deg, #1a1a1a 0%, #2a1a0a 100%)" },
    heroTitle: { fontSize: "clamp(28px,5vw,52px)", fontWeight: "900", margin: "0 0 16px" },
    heroSub: { fontSize: "18px", color: "#ccc", margin: "0 0 30px" },
    section: { padding: "40px 20px", maxWidth: "1200px", margin: "0 auto" },
    sectionTitle: { fontSize: "24px", fontWeight: "bold", marginBottom: "24px", borderBottom: "2px solid #ff6600", paddingBottom: "8px" },
    filterBar: { display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" },
    filterBtn: (a) => ({ background: a ? "#ff6600" : "#2a2a2a", color: "#fff", border: a ? "none" : "1px solid #444", padding: "8px 18px", borderRadius: "20px", cursor: "pointer", fontWeight: a ? "bold" : "normal", fontSize: "14px" }),
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" },
    card: { background: "#1e1e1e", borderRadius: "12px", overflow: "hidden", border: "1px solid #333", cursor: "pointer" },
    cardImg: { width: "100%", aspectRatio: "1/1", objectFit: "contain", background: "#fff", display: "block" },
    cardBody: { padding: "14px" },
    cardName: { fontSize: "15px", fontWeight: "bold", marginBottom: "6px", color: "#fff" },
    cardPrice: { fontSize: "20px", fontWeight: "900", color: "#ff6600", marginBottom: "8px" },
    badgeStock: { display: "inline-block", background: "#1a5c1a", color: "#4cff4c", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", marginBottom: "8px" },
    badgePedido: { display: "inline-block", background: "#5c3a00", color: "#ffaa00", padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", marginBottom: "8px" },
    modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "16px" },
    modalBox: { background: "#1e1e1e", borderRadius: "16px", maxWidth: "500px", width: "100%", padding: "24px", position: "relative", maxHeight: "90vh", overflowY: "auto" },
    modalImg: { width: "100%", maxHeight: "360px", objectFit: "contain", background: "#fff", borderRadius: "10px", marginBottom: "16px", display: "block" },
    input: { width: "100%", padding: "10px 14px", background: "#2a2a2a", border: "1px solid #444", color: "#fff", borderRadius: "8px", fontSize: "15px", boxSizing: "border-box", marginBottom: "12px" },
    select: { width: "100%", padding: "10px 14px", background: "#2a2a2a", border: "1px solid #444", color: "#fff", borderRadius: "8px", fontSize: "15px", boxSizing: "border-box", marginBottom: "12px" },
    label: { display: "block", marginBottom: "6px", color: "#ccc", fontSize: "14px" },
    cartOverlay: { position: "fixed", right: 0, top: 0, bottom: 0, width: "320px", background: "#1a1a1a", borderLeft: "2px solid #ff6600", zIndex: 200, padding: "20px", overflowY: "auto", boxShadow: "-4px 0 20px rgba(0,0,0,0.5)" },
    adminWrap: { maxWidth: "640px", margin: "40px auto", padding: "20px" },
    adminCard: { background: "#1e1e1e", borderRadius: "12px", padding: "28px", border: "1px solid #333" },
    loginWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#111" },
    loginBox: { background: "#1e1e1e", borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "400px", border: "1px solid #333", textAlign: "center" }
  };

  if (page === "adminLogin") {
    return (
      <div style={S.loginWrap}>
        <div style={S.loginBox}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔐</div>
          <h2 style={{ color: "#ff6600", marginBottom: "8px" }}>Panel Administrador</h2>
          <p style={{ color: "#888", marginBottom: "28px" }}>Ingresa la contrasena para acceder</p>
          <input type="password" placeholder="Contrasena" value={adminPass} onChange={e => setAdminPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdminLogin()} style={S.input} />
          {adminError && <p style={{ color: "#ff4444", marginBottom: "12px" }}>{adminError}</p>}
          <button onClick={handleAdminLogin} style={{ ...S.btn, width: "100%", padding: "12px" }}>Ingresar</button>
          <button onClick={() => { setPage("home"); window.history.pushState({}, "", "/"); }} style={{ ...S.btnOutline, width: "100%", padding: "10px", marginTop: "12px" }}>Volver a la tienda</button>
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
          <h2 style={{ color: "#ff6600", marginBottom: "24px" }}>Panel de Administracion</h2>
          <div style={S.adminCard}>
            <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Agregar Nuevo Producto</h3>
            <label style={S.label}>Nombre del Producto *</label>
            <input style={S.input} placeholder="Ej: Vaso Stanley 40oz" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            <label style={S.label}>Precio (CLP) *</label>
            <input style={S.input} type="number" placeholder="Ej: 19000" value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
            <label style={S.label}>Descripcion</label>
            <textarea style={{ ...S.input, minHeight: "80px", resize: "vertical" }} placeholder="Descripcion del producto..." value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            <label style={S.label}>Disponibilidad *</label>
            <select style={S.select} value={form.disponibilidad} onChange={e => setForm(f => ({ ...f, disponibilidad: e.target.value }))}>
              <option value="stock">En Stock (disponible ahora)</option>
              <option value="pedido">Por Pedido</option>
            </select>
            {form.disponibilidad === "pedido" && (
              <>
                <label style={S.label}>Dias Habiles de Entrega</label>
                <select style={S.select} value={form.diasHabiles} onChange={e => setForm(f => ({ ...f, diasHabiles: e.target.value }))}>
                  <option value="3">3 dias habiles</option>
                  <option value="4">4 dias habiles</option>
                  <option value="5">5 dias habiles</option>
                </select>
              </>
            )}
            <label style={S.label}>Imagen del Producto *</label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => handleImageUpload(e.target.files[0])} style={{ ...S.input, padding: "8px" }} />
            {uploading && <p style={{ color: "#ff6600" }}>Subiendo imagen...</p>}
            {uploadMsg && !uploading && <p style={{ color: uploadMsg.includes("Error") ? "#ff4444" : "#4cff4c" }}>{uploadMsg}</p>}
            {form.imageUrl && (
              <div style={{ marginBottom: "16px" }}>
                <p style={{ color: "#4cff4c", marginBottom: "8px" }}>Vista previa:</p>
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
                <div style={{ color: "#ff6600", fontWeight: "bold" }}>{formatPrice(getProductPrice(p))}</div>
                <div style={{ marginTop: "4px" }}>
                  {getProductDisp(p) === "stock"
                    ? <span style={{ color: "#4cff4c", fontSize: "13px" }}>En Stock</span>
                    : <span style={{ color: "#ffaa00", fontSize: "13px" }}>Por Pedido - {getProductDias(p)} dias hab.</span>
                  }
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
        <h1 style={S.heroTitle}>Bienvenido a <span style={{ color: "#ff6600" }}>GangaStore</span></h1>
        <p style={S.heroSub}>Los mejores productos al mejor precio</p>
      </div>
      <div style={S.section}>
        <div style={S.sectionTitle}>Productos Disponibles</div>
        <div style={S.filterBar}>
          <button style={S.filterBtn(filter === "todos")} onClick={() => setFilter("todos")}>Todos</button>
          <button style={S.filterBtn(filter === "stock")} onClick={() => setFilter("stock")}>En Stock</button>
          <button style={S.filterBtn(filter === "pedido")} onClick={() => setFilter("pedido")}>Por Pedido</button>
        </div>
        <div style={S.grid}>
          {filteredProducts.map(product => (
            <div key={product.id} style={S.card} onClick={() => setSelectedProduct(product)}>
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
          {filteredProducts.length === 0 && <p style={{ color: "#888", gridColumn: "1/-1" }}>No hay productos en esta categoria.</p>}
        </div>
      </div>
      {selectedProduct && (
        <div style={S.modal} onClick={() => setSelectedProduct(null)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedProduct(null)} style={{ position: "absolute", top: "12px", right: "16px", background: "none", border: "none", color: "#fff", fontSize: "24px", cursor: "pointer" }}>x</button>
            <img src={getProductImage(selectedProduct)} alt={getProductName(selectedProduct)} style={S.modalImg} />
            <h2 style={{ marginTop: 0, marginBottom: "8px" }}>{getProductName(selectedProduct)}</h2>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#ff6600", marginBottom: "12px" }}>{formatPrice(getProductPrice(selectedProduct))}</div>
            {getProductDisp(selectedProduct) === "stock"
              ? <span style={S.badgeStock}>En Stock - Disponible ahora</span>
              : <span style={S.badgePedido}>Por Pedido: {getProductDias(selectedProduct)} dias habiles</span>
            }
            {selectedProduct.descripcion && <p style={{ color: "#ccc", marginTop: "14px", lineHeight: "1.6" }}>{selectedProduct.descripcion}</p>}
            <button style={{ ...S.btn, width: "100%", padding: "13px", marginTop: "20px", fontSize: "16px" }} onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}>Agregar al Carrito</button>
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
            <p style={{ color: "#888" }}>El carrito esta vacio</p>
          ) : (
            <>
              {cart.map(item => (
                <div key={item.id} style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
                  <img src={getProductImage(item)} alt={getProductName(item)} style={{ width: "60px", height: "60px", objectFit: "contain", background: "#fff", borderRadius: "6px" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", fontSize: "14px" }}>{getProductName(item)}</div>
                    <div style={{ color: "#ff6600" }}>{formatPrice(getProductPrice(item))} x{item.qty}</div>
                  </div>
                  <button onClick={() => removeFromCart(item.id)} style={{ background: "#cc0000", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "4px", cursor: "pointer" }}>x</button>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #333", paddingTop: "16px", marginTop: "16px" }}>
                <div style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>Total: {formatPrice(totalCart)}</div>
                <a href={`https://wa.me/56900000000?text=Hola!%20Quiero%20pedir:%20${cart.map(i => getProductName(i) + "%20x" + i.qty).join("%2C%20")}`} target="_blank" rel="noreferrer" style={{ ...S.btn, display: "block", textAlign: "center", textDecoration: "none", padding: "12px" }}>
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
