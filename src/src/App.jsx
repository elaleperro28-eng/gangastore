import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAQlmsNO4bF9SVfwrcK6_-HJ_KFrcjTINg",
  authDomain: "gangastore.firebaseapp.com",
  projectId: "gangastore",
  storageBucket: "gangastore.firebasestorage.app",
  messagingSenderId: "167884959340",
  appId: "1:167884959340:web:0cd7f22b3506eff1c3b249"
};

const _app = initializeApp(firebaseConfig);
const db = getFirestore(_app);
const storage = getStorage(_app);

const WHATSAPP = "5492914261941";
const PASS_ADMIN = "admin123";
const fmt = (n) => "$ " + Number(n).toLocaleString("es-AR");

const estilos = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a0a;color:#f0f0f0;min-height:100vh}
img{max-width:100%;display:block}
.nav{display:flex;align-items:center;justify-content:space-between;padding:0 20px;height:60px;background:#111;border-bottom:1px solid #222;position:sticky;top:0;z-index:100}
.nav-logo{font-size:22px;font-weight:900;letter-spacing:2px;color:#ff4500}
.nav-logo span{color:#fff}
.nav-right{display:flex;gap:10px;align-items:center}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:none;cursor:pointer;font-size:14px;font-weight:600;transition:all .2s}
.btn.primary{background:#ff4500;color:#fff}
.btn.primary:hover{background:#e03c00}
.btn.outline{background:transparent;border:1px solid #444;color:#ccc}
.btn.outline:hover{border-color:#ff4500;color:#ff4500}
.btn.full{width:100%;justify-content:center}
.btn.danger{background:#c0392b;color:#fff}
.hero{text-align:center;padding:60px 20px 40px;background:linear-gradient(180deg,#111 0%,#0a0a0a 100%)}
.hero h1{font-size:clamp(28px,5vw,48px);font-weight:900;margin-bottom:12px}
.hero h1 span{color:#ff4500}
.hero p{color:#888;font-size:clamp(14px,2.5vw,18px);max-width:500px;margin:0 auto 28px}
.badges{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.badge{display:flex;align-items:center;gap:8px;padding:10px 18px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;font-size:13px;font-weight:700;letter-spacing:.5px;color:#f0f0f0;text-transform:uppercase}
.badge.active{background:#ff4500;border-color:#ff4500;color:#fff}
.filters{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:20px;max-width:1200px;margin:0 auto}
.search-wrap{display:flex;align-items:center;gap:8px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;padding:10px 14px;flex:1;min-width:200px}
.search-wrap input{background:transparent;border:none;outline:none;color:#f0f0f0;font-size:14px;width:100%}
.filter-btn{padding:8px 16px;border-radius:20px;border:1px solid #333;background:transparent;color:#ccc;cursor:pointer;font-size:13px;font-weight:600;transition:all .2s}
.filter-btn.active{background:#ff4500;border-color:#ff4500;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;padding:0 20px 40px;max-width:1200px;margin:0 auto}
.card{background:#111;border:1px solid #1e1e1e;border-radius:14px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(255,69,0,.15)}
.card-img{width:100%;height:220px;object-fit:cover;background:#1a1a1a}
.card-body{padding:14px}
.card-title{font-size:16px;font-weight:700;margin-bottom:10px;line-height:1.3}
.card-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.price{font-size:20px;font-weight:800;color:#fff}
.add-btn{background:#ff4500;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:700;font-size:14px;transition:background .2s;white-space:nowrap}
.add-btn:hover{background:#e03c00}
.empty{text-align:center;padding:80px 20px;color:#555}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:flex;justify-content:flex-end}
.drawer{background:#111;width:min(420px,100vw);height:100vh;display:flex;flex-direction:column;border-left:1px solid #222}
.drawer-head{padding:20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e1e1e}
.drawer-head h2{font-size:20px;font-weight:800}
.close-btn{background:transparent;border:none;color:#ccc;font-size:24px;cursor:pointer;line-height:1}
.drawer-body{flex:1;overflow-y:auto;padding:16px}
.ci{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #1e1e1e;align-items:center}
.ci-ph{width:70px;height:70px;background:#1e1e1e;border-radius:8px;flex-shrink:0;overflow:hidden}
.ci-ph img{width:100%;height:100%;object-fit:cover}
.ci-name{font-size:14px;font-weight:600;margin-bottom:4px}
.ci-price{font-size:14px;color:#ff4500;font-weight:700}
.qc{display:flex;align-items:center;gap:6px;margin-top:6px}
.qb{background:#1e1e1e;border:none;color:#fff;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
.qn{font-size:14px;font-weight:700;min-width:20px;text-align:center}
.rb{background:transparent;border:none;color:#c0392b;cursor:pointer;font-size:18px;margin-left:auto}
.drawer-foot{padding:16px;border-top:1px solid #1e1e1e}
.df{display:flex;flex-direction:column;gap:12px}
.tr{display:flex;justify-content:space-between;font-size:14px;color:#aaa}
.ta{font-size:18px;font-weight:800;color:#fff}
.cart-empty{text-align:center;padding:60px 20px;color:#555}
.admin-panel{max-width:900px;margin:40px auto;padding:0 20px 60px}
.admin-panel h2{font-size:28px;font-weight:900;margin-bottom:24px}
.section-title{font-size:18px;font-weight:800;margin-bottom:16px;color:#ff4500;text-transform:uppercase;letter-spacing:1px}
.upload-zone{border:2px dashed #333;border-radius:16px;padding:40px;text-align:center;cursor:pointer;transition:all .2s;background:#111;margin-bottom:24px}
.upload-zone:hover,.upload-zone.drag{border-color:#ff4500;background:#1a0800}
.upload-zone h3{font-size:18px;font-weight:700;margin-bottom:8px}
.upload-zone p{color:#666;font-size:14px}
.upload-zone .hint{font-size:13px;color:#ff4500;margin-top:8px;font-weight:600}
.preview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:24px}
.preview-item{background:#111;border:1px solid #2a2a2a;border-radius:12px;overflow:hidden;position:relative}
.preview-item img{width:100%;height:180px;object-fit:cover}
.preview-remove{position:absolute;top:8px;right:8px;background:rgba(0,0,0,.7);border:none;color:#fff;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
.prod-list{display:flex;flex-direction:column;gap:12px}
.prod-row{display:flex;align-items:center;gap:12px;background:#111;border:1px solid #1e1e1e;border-radius:12px;padding:12px;flex-wrap:wrap}
.prod-row img{width:70px;height:70px;object-fit:cover;border-radius:8px;flex-shrink:0;background:#1a1a1a}
.prod-info{flex:1;min-width:120px}
.prod-info .pn{font-size:15px;font-weight:700}
.del-btn{background:transparent;border:1px solid #c0392b;color:#c0392b;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:all .2s;white-space:nowrap}
.del-btn:hover{background:#c0392b;color:#fff}
.checkout-wrap{max-width:580px;margin:40px auto;padding:0 20px 60px}
.checkout-wrap h2{font-size:24px;font-weight:900;margin-bottom:24px}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;font-weight:600;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
.form-group input,.form-group textarea{width:100%;background:#111;border:1px solid #2a2a2a;border-radius:10px;padding:12px 14px;color:#f0f0f0;font-size:15px;outline:none;transition:border .2s}
.form-group input:focus,.form-group textarea:focus{border-color:#ff4500}
.form-group textarea{resize:vertical;min-height:80px}
.order-summary{background:#111;border:1px solid #1e1e1e;border-radius:14px;padding:20px;margin-bottom:24px}
.order-summary h3{font-size:16px;font-weight:700;margin-bottom:16px}
.os-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #1e1e1e;font-size:14px}
.os-row:last-child{border-bottom:none;font-weight:800;font-size:16px;color:#ff4500}
.loading{display:flex;align-items:center;justify-content:center;padding:80px 20px;color:#555}
.spinner{width:36px;height:36px;border:3px solid #2a2a2a;border-top-color:#ff4500;border-radius:50%;animation:spin .8s linear infinite;margin-right:12px}
@keyframes spin{to{transform:rotate(360deg)}}
.toast-wrap{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:500;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}
.toast{background:#ff4500;color:#fff;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:600;box-shadow:0 4px 20px rgba(255,69,0,.4);animation:fadeInUp .3s ease}
@keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.login-wrap{max-width:380px;margin:100px auto;padding:0 20px}
.login-box{background:#111;border:1px solid #222;border-radius:20px;padding:36px}
.login-box h2{font-size:24px;font-weight:900;margin-bottom:6px;text-align:center}
.login-box p{color:#666;text-align:center;margin-bottom:28px;font-size:14px}
.upload-progress{background:#1a1a1a;border-radius:10px;padding:16px;margin-bottom:16px}
.upload-progress p{font-size:14px;margin-bottom:8px;color:#ccc}
.progress-bar{background:#2a2a2a;border-radius:999px;height:6px;overflow:hidden}
.progress-fill{background:#ff4500;height:100%;border-radius:999px;transition:width .3s}
@media(max-width:600px){
  .nav{padding:0 12px}
  .hero{padding:40px 16px 30px}
  .grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;padding:0 12px 32px}
  .card-img{height:160px}
  .card-body{padding:10px}
  .card-title{font-size:14px}
  .price{font-size:16px}
  .add-btn{padding:8px 12px;font-size:12px}
  .drawer{width:100vw}
  .admin-panel{padding:0 12px 60px}
  .upload-zone{padding:24px 16px}
  .preview-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
}
`;

const ST = () => {
  useEffect(() => {
    if (!document.getElementById("gs-styles")) {
      const s = document.createElement("style");
      s.id = "gs-styles";
      s.textContent = estilos;
      document.head.appendChild(s);
    }
  }, []);
  return null;
};

const Toast = ({ msg }) => (
  <div className="toast-wrap">
    <div className="toast">{msg}</div>
  </div>
);

export default function App() {
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [carritoOpen, setCarritoOpen] = useState(false);
  const [vista, setVista] = useState("tienda");
  const [adminAuth, setAdminAuth] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [toast, setToast] = useState("");
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [fotos, setFotos] = useState([]);
  const [checkout, setCheckout] = useState({ nombre: "", telefono: "", direccion: "", notas: "" });
  const inputRef = useRef();

  useEffect(() => {
    const ref = collection(db, "productos");
    const unsub = onSnapshot(ref, (snap) => {
      setProductos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCargando(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (window.location.hash === "#admin") {
      setVista("admin");
    }
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const agregarCarrito = (p) => {
    setCarrito((prev) => {
      const ex = prev.find((x) => x.id === p.id);
      if (ex) return prev.map((x) => x.id === p.id ? { ...x, cantidad: x.cantidad + 1 } : x);
      return [...prev, { ...p, cantidad: 1 }];
    });
    showToast("Producto agregado al carrito");
  };

  const qtyCart = (id, d) => {
    setCarrito((prev) =>
      prev.map((x) => x.id === id ? { ...x, cantidad: Math.max(1, x.cantidad + d) } : x)
    );
  };

  const removeCart = (id) => {
    setCarrito((prev) => prev.filter((x) => x.id !== id));
  };

  const total = carrito.reduce((s, x) => s + x.precio * x.cantidad, 0);

  const handleFotos = (files) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    setFotos((prev) => [...prev, ...arr]);
  };

  const removeFoto = (i) => {
    setFotos((prev) => prev.filter((_, idx) => idx !== i));
  };

  const subirProductos = async () => {
    if (fotos.length === 0) return;
    setSubiendo(true);
    setProgreso(0);
    for (let i = 0; i < fotos.length; i++) {
      const f = fotos[i];
      try {
        const id = Date.now() + "_" + i;
        const storageReference = sRef(storage, "productos/" + id + "_" + f.name);
        await uploadBytes(storageReference, f);
        const url = await getDownloadURL(storageReference);
        await setDoc(doc(db, "productos", id), {
          nombre: f.name.replace(/.[^.]+$/, "").replace(/[-_]/g, " "),
          foto: url,
          precio: 0,
          tipo: "General",
          descripcion: "",
          disponible: true,
          createdAt: Date.now()
        });
        setProgreso(Math.round(((i + 1) / fotos.length) * 100));
      } catch (e) {
        console.error(e);
      }
    }
    setFotos([]);
    setSubiendo(false);
    setProgreso(0);
    showToast("Fotos subidas correctamente. Apareceran en la tienda.");
  };

  const eliminarProducto = async (id) => {
    if (!window.confirm("Eliminar este producto?")) return;
    await deleteDoc(doc(db, "productos", id));
    showToast("Producto eliminado");
  };

  const enviarPedido = () => {
    if (!checkout.nombre || !checkout.telefono) {
      showToast("Por favor completa tu nombre y telefono");
      return;
    }
    const items = carrito.map((x) => x.nombre + " x" + x.cantidad + " " + fmt(x.precio * x.cantidad)).join("%0A");
    const msg = "Hola! Quiero hacer un pedido:%0A%0A" + items + "%0A%0ATotal: " + fmt(total) + "%0A%0ANombre: " + checkout.nombre + "%0ATelefono: " + checkout.telefono + "%0ADireccion: " + checkout.direccion + "%0ANotas: " + checkout.notas;
    window.open("https://wa.me/" + WHATSAPP + "?text=" + msg, "_blank");
  };

  const productosFiltrados = productos.filter((p) => {
    const matchBusqueda = p.nombre && p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    if (filtro === "todos") return matchBusqueda;
    if (filtro === "stock") return matchBusqueda && p.disponible;
    if (filtro === "pedido") return matchBusqueda && !p.disponible;
    return matchBusqueda;
  });

  return (
    <>
      <ST />
      {toast && <Toast msg={toast} />}

      <nav className="nav">
        <div className="nav-logo" onClick={() => { setVista("tienda"); window.history.pushState("", "", "/"); }}>
          GANGA<span>STORE</span>
        </div>
        <div className="nav-right">
          <button className="btn outline" onClick={() => setVista("admin")}>
            Admin
          </button>
          <button className="btn primary" onClick={() => setCarritoOpen(true)}>
            Carrito {carrito.length > 0 && <span>({carrito.reduce((s, x) => s + x.cantidad, 0)})</span>}
          </button>
        </div>
      </nav>

      {carritoOpen && (
        <div className="overlay" onClick={() => setCarritoOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>Tu Carrito</h2>
              <button className="close-btn" onClick={() => setCarritoOpen(false)}>X</button>
            </div>
            <div className="drawer-body">
              {carrito.length === 0 ? (
                <div className="cart-empty">
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                  <p>Tu carrito esta vacio</p>
                </div>
              ) : (
                carrito.map((i) => (
                  <div className="ci" key={i.id}>
                    {i.foto && (
                      <div className="ci-ph">
                        <img src={i.foto} alt={i.nombre} onError={(e) => { e.target.style.display = "none"; }} />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="ci-name">{i.nombre}</div>
                      <div className="ci-price">{fmt(i.precio)} c/u</div>
                      <div className="qc">
                        <button className="qb" onClick={() => qtyCart(i.id, -1)}>-</button>
                        <span className="qn">{i.cantidad}</span>
                        <button className="qb" onClick={() => qtyCart(i.id, 1)}>+</button>
                        <button className="rb" onClick={() => removeCart(i.id)}>🗑</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {carrito.length > 0 && (
              <div className="drawer-foot">
                <div className="df">
                  <div className="tr">
                    <span style={{ color: "#aaa", fontSize: 14 }}>Total</span>
                    <span className="ta">{fmt(total)}</span>
                  </div>
                  <button className="btn primary full" style={{ padding: "13px", fontSize: 15 }} onClick={() => { setCarritoOpen(false); setVista("checkout"); }}>
                    Finalizar Pedido por WhatsApp
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {vista === "tienda" && (
        <>
          <div className="hero">
            <h1>GANGA<span>STORE</span></h1>
            <p>Tecnologia y accesorios al mejor precio. En stock o por pedido, te lo conseguimos.</p>
            <div className="badges">
              <span className="badge active">STOCK DISPONIBLE</span>
              <span className="badge">POR PEDIDO</span>
              <span className="badge">ENVIO A TODO EL PAIS</span>
              <span className="badge">TRANSFERENCIA BANCARIA</span>
            </div>
          </div>
          <div className="filters">
            <div className="search-wrap">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Buscar producto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <button className={"filter-btn" + (filtro === "todos" ? " active" : "")} onClick={() => setFiltro("todos")}>Todos</button>
            <button className={"filter-btn" + (filtro === "stock" ? " active" : "")} onClick={() => setFiltro("stock")}>En Stock</button>
            <button className={"filter-btn" + (filtro === "pedido" ? " active" : "")} onClick={() => setFiltro("pedido")}>Por Pedido</button>
          </div>
          {cargando ? (
            <div className="loading">
              <div className="spinner"></div>
              <span>Cargando productos...</span>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="empty">
              <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
              <p style={{ fontSize: 18 }}>No se encontraron productos</p>
            </div>
          ) : (
            <div className="grid">
              {productosFiltrados.map((p) => (
                <div className="card" key={p.id}>
                  {p.foto ? (
                    <img className="card-img" src={p.foto} alt={p.nombre} onError={(e) => { e.target.style.display = "none"; }} />
                  ) : (
                    <div className="card-img" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#444", fontSize: 48 }}>📷</div>
                  )}
                  <div className="card-body">
                    <div className="card-title">{p.nombre}</div>
                    <div className="card-footer">
                      <span className="price">{p.precio > 0 ? fmt(p.precio) : "Consultar"}</span>
                      <button className="add-btn" onClick={() => agregarCarrito(p)}>Agregar</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {vista === "checkout" && (
        <div className="checkout-wrap">
          <h2>Finalizar Pedido</h2>
          <div className="order-summary">
            <h3>Resumen del pedido</h3>
            {carrito.map((i) => (
              <div className="os-row" key={i.id}>
                <span>{i.nombre} x{i.cantidad}</span>
                <span>{fmt(i.precio * i.cantidad)}</span>
              </div>
            ))}
            <div className="os-row">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
          <div className="form-group">
            <label>Nombre completo</label>
            <input type="text" value={checkout.nombre} onChange={(e) => setCheckout({ ...checkout, nombre: e.target.value })} placeholder="Tu nombre" />
          </div>
          <div className="form-group">
            <label>Telefono</label>
            <input type="text" value={checkout.telefono} onChange={(e) => setCheckout({ ...checkout, telefono: e.target.value })} placeholder="Tu numero de telefono" />
          </div>
          <div className="form-group">
            <label>Direccion (opcional)</label>
            <input type="text" value={checkout.direccion} onChange={(e) => setCheckout({ ...checkout, direccion: e.target.value })} placeholder="Tu direccion" />
          </div>
          <div className="form-group">
            <label>Notas (opcional)</label>
            <textarea value={checkout.notas} onChange={(e) => setCheckout({ ...checkout, notas: e.target.value })} placeholder="Notas adicionales..." />
          </div>
          <button className="btn primary full" style={{ padding: 14, fontSize: 16, marginBottom: 12 }} onClick={enviarPedido}>
            Enviar Pedido por WhatsApp
          </button>
          <button className="btn outline full" onClick={() => setVista("tienda")}>
            Volver a la Tienda
          </button>
        </div>
      )}

      {vista === "admin" && !adminAuth && (
        <div className="login-wrap">
          <div className="login-box">
            <h2>Panel Admin</h2>
            <p>Ingresa la contrasena para acceder</p>
            <div className="form-group">
              <label>Contrasena</label>
              <input type="password" value={passInput} onChange={(e) => setPassInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && passInput === PASS_ADMIN) setAdminAuth(true); }} placeholder="Contrasena..." />
            </div>
            <button className="btn primary full" style={{ padding: 12 }} onClick={() => { if (passInput === PASS_ADMIN) setAdminAuth(true); else showToast("Contrasena incorrecta"); }}>
              Ingresar
            </button>
            <button className="btn outline full" style={{ marginTop: 10, padding: 12 }} onClick={() => setVista("tienda")}>
              Volver a la Tienda
            </button>
          </div>
        </div>
      )}

      {vista === "admin" && adminAuth && (
        <div className="admin-panel">
          <h2>Panel de Administracion</h2>

          <div className="section-title">SUBIR PRODUCTOS (SOLO CON FOTO)</div>
          <div
            className={"upload-zone"}
            onClick={() => inputRef.current && inputRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFotos(e.dataTransfer.files); }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
            <h3>Arrastra o toca para subir fotos</h3>
            <p>Cada foto se convierte automaticamente en un producto</p>
            <div className="hint">Solo sube la foto y aparece en la tienda</div>
            <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => handleFotos(e.target.files)} />
          </div>

          {fotos.length > 0 && (
            <>
              <div className="preview-grid">
                {fotos.map((f, i) => (
                  <div className="preview-item" key={i}>
                    <img src={URL.createObjectURL(f)} alt="preview" />
                    <button className="preview-remove" onClick={() => removeFoto(i)}>X</button>
                    <div style={{ padding: 8, fontSize: 12, color: "#888", textAlign: "center" }}>{f.name}</div>
                  </div>
                ))}
              </div>
              {subiendo && (
                <div className="upload-progress">
                  <p>Subiendo... {progreso}%</p>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: progreso + "%" }}></div>
                  </div>
                </div>
              )}
              <button className="btn primary full" style={{ padding: 14, fontSize: 16, marginBottom: 24 }} onClick={subirProductos} disabled={subiendo}>
                {subiendo ? "Subiendo..." : "Publicar " + fotos.length + " producto(s)"}
              </button>
            </>
          )}

          <div className="section-title">PRODUCTOS EN LA TIENDA</div>
          {productos.length === 0 ? (
            <div className="empty">
              <p>No hay productos aun. Sube una foto para comenzar.</p>
            </div>
          ) : (
            <div className="prod-list">
              {productos.map((p) => (
                <div className="prod-row" key={p.id}>
                  {p.foto && <img src={p.foto} alt={p.nombre} onError={(e) => { e.target.style.display = "none"; }} />}
                  <div className="prod-info">
                    <div className="pn">{p.nombre}</div>
                    <div style={{ fontSize: 13, color: "#888" }}>{p.precio > 0 ? fmt(p.precio) : "Sin precio"}</div>
                  </div>
                  <button className="del-btn" onClick={() => eliminarProducto(p.id)}>
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 32 }}>
            <button className="btn outline" onClick={() => { setVista("tienda"); setAdminAuth(false); }}>
              Cerrar Sesion
            </button>
          </div>
        </div>
      )}
    </>
  );
          }
