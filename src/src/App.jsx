import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";

// ============================================================
// FIREBASE CONFIG - Reemplazar con los datos de tu proyecto
// Ver README para instrucciones de configuracion
// ============================================================
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

const ALIAS      = "gangastore.bb";
const WHATSAPP   = "5492914261941";
const PASS_ADMIN = "admin123";

const PRODUCTOS_INICIALES = [
  { id: 1, nombre: "Auriculares Bluetoot Pro", tipo: "Electrï¿½nica", precio: 18500, foto: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80", stock: true,  cantidadStock: 3, categoria: "ElectrÃ³nica", descripcion: "Auriculares inalÃ¡mbricos con cancelaciÃ³n de ruido, 30hs de baterÃ­a.", diasEstimados: "" },
  { id: 2, nombre: "Smartwatch Serie 9", tipo: "Electrï¿½nica",        precio: 42000, foto: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80", stock: true,  cantidadStock: 2, categoria: "ElectrÃ³nica", descripcion: "Reloj inteligente con GPS, monitor cardÃ­aco y 7 dÃ­as de baterÃ­a.",    diasEstimados: "" },
  { id: 3, nombre: "Cargador InalÃ¡mbrico 15W",  precio: 9800,  foto: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&q=80", stock: false, cantidadStock: 0, categoria: "Accesorios",  descripcion: "Carga rÃ¡pida inalÃ¡mbrica compatible con todos los dispositivos Qi.", diasEstimados: "7 a 10" },
  { id: 4, nombre: "Power Bank 20000mAh",        precio: 14500, foo: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&q=80", stock: true,  cantidadStock: 5, categoria: "Accesorios",  descripcion: "BaterÃ­a portÃ¡til con carga rÃ¡pida USB-C, 3 salidas simultÃ¡neas.",  diasEstimados: "" },
];

const fmt = (n) => new Intl.NumberFormat("es-AR", { style:"currency", currency:"ARS", maximumFractionDigits:0 }).format(n);
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;



const PROD_VACIO = { nombre:"", precio:"", foto:"", stock:true, cantidadStock:"", categoria:"", tipo:"", descripcion:"", diasEstimados:"" };

export default function GangaStore() {
  const [productos,    setProductos]     = useState([]);
  const [pedidos,       setPedidos]        = useState([]);
  const [vista,     setVista]         = useState("tienda");
  const [adminTab,  setAdminTab]      = useState("pedidos");
  const [carrito,   setCarrito]       = useState([]);
  const [carritoOpen, setCarritoOpen] = useState(false);
  const [catActiva, setCatActiva]     = useState("Todas");
  const [busqueda,  setBusqueda]      = useState("");
  const [form,      setForm]          = useState({ nombre:"", telefono:"", email:"", direccion:"", ciudad:"", cp:"", notas:"" });
  const [pedidoOk,  setPedidoOk]      = useState(null);
  const [aPass,     setAPass]         = useState("");
  const [adminOk,   setAdminOk]       = useState(false);
  const [toast,     setToast]         = useState(null);
  const [modalProd, setModalProd]     = useState(false);
  const [formProd,  setFormProd]      = useState(PROD_VACIO);
  const [editId,    setEditId]        = useState(null);
  const [borrarConf,setBorrarConf]    = useState(null);

    // Firebase: escuchar cambios en tiempo real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "productos"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }));
      setProductos(data.length > 0 ? data : PRODUCTOS_INICIALES);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pedidos"), (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }));
      setPedidos(data);
    });
    return () => unsub();
  }, []);

  const showToast = (msg, tipo="ok") => { setToast({msg,tipo}); setTimeout(()=>setToast(null),3000); };

  const addCart = (p) => {
    setCarrito(prev => prev.find(i=>i.id===p.id) ? prev.map(i=>i.id===p.id?{...i,cantidad:i.cantidad+1}:i) : [...prev,{...p,cantidad:1}]);
    showToast(`"${p.nombre}" agregado`);
  };
  const removeCart = (id) => setCarrito(prev=>prev.filter(i=>i.id!==id));
  const qtyCart   = (id,d) => setCarrito(prev=>prev.map(i=>i.id===id?{...i,cantidad:Math.max(1,i.cantidad+d)}:i));
  const total = carrito.reduce((s,i)=>s+i.precio*i.cantidad,0);

  const categorias = ["Todas","En Stock","Por Pedido"];
  const filtrados  = productos.filter(p=>(catActiva==="Todas"||(catActiva==="En Stock"?p.stock===true:p.stock===false))&&p.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const confirmarPedido = () => {
    if (!form.nombre||!form.telefono||!form.direccion||!form.ciudad){ showToast("CompletÃ¡ los campos obligatorios","error"); return; }
    const numero = `GS-${Date.now().toString().slice(-6)}`;
    const nuevo  = { numero, fecha:new Date().toLocaleString("es-AR"), cliente:form, items:carrito, total, estado:"esperando_pago" };
    setDoc(doc(db,"pedidos",nuevo.numero), nuevo).catch(console.error);
    setPedidoOk(nuevo);
    setCarrito([]);
    setForm({nombre:"",telefono:"",email:"",direccion:"",ciudad:"",cp:"",notas:""});
    setVista("confirmacion");
  };

  const marcarPagado     = (n) => { const ped=pedidos.find(p=>p.numero===n); if(ped) setDoc(doc(db,"pedidos",n),{...ped,estado:"pagado"}).catch(console.error); };
    const marcarDespachado = (n) => { const ped=pedidos.find(p=>p.numero===n); if(ped) setDoc(doc(db,"pedidos",n),{...ped,estado:"despachado"}).catch(console.error); };

  const abrirNuevo  = ()  => { setFormProd(PROD_VACIO); setEditId(null); setModalProd(true); };
  const abrirEditar = (p) => { setFormProd({...p, precio:String(p.precio), cantidadStock:String(p.cantidadStock)}); setEditId(p.id); setModalProd(true); };

  const guardarProducto = () => {
    if (!formProd.nombre||!formProd.precio){ showToast("Nombre, precio y categorÃ­a son obligatorios","error"); return; }
    const stockBool = formProd.stock===true||formProd.stock==="true";
    const prod = { ...formProd, id:editId??uid(), precio:parseFloat(formProd.precio)||0, cantidadStock:parseInt(formProd.cantidadStock)||0, stock:stockBool, categoria:stockBool?"En Stock":"Por Pedido", tipo:formProd.tipo||formProd.categoria||"" };
    if (editId) { setDoc(doc(db,"productos",String(editId)),prod).catch(console.error); showToast("Producto actualizado â"); }
    else        { setDoc(doc(db,"productos",String(prod.id)),prod).catch(console.error);                     showToast("Producto agregado â"); }
    setModalProd(false);
  };

  const eliminarProducto = (id) => { deleteDoc(doc(db,"productos",String(id))).catch(console.error); setBorrarConf(null); showToast("Producto eliminado"); };

  // ââ CSS ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0a0a;color:#f0ede8;font-family:'DM Sans',sans-serif}
    :root{--ac:#ff3c00;--ac2:#ffb800;--card:#141414;--bd:#222;--mu:#666;--r:12px}
    .nav{position:sticky;top:0;z-index:100;background:rgba(10,10,10,.92);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;padding:0 24px;height:64px}
    .logo{font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--ac);cursor:pointer;letter-spacing:2px}
    .logo span{color:#f0ede8}
    .nav-r{display:flex;gap:10px;align-items:center}
    .btn{display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .15s}
    .ghost{background:transparent;color:#f0ede8;border:1px solid var(--bd)}
    .ghost:hover{border-color:var(--ac);color:var(--ac)}
    .primary{background:var(--ac);color:#fff}
    .primary:hover{background:#e03500;transform:translateY(-1px)}
    .gold{background:var(--ac2);color:#0a0a0a}
    .gold:hover{background:#e0a200}
    .sm{padding:7px 13px;font-size:13px}
    .full{width:100%;justify-content:center}
    .green{background:rgba(0,200,80,.15);color:#00c850;border:1px solid rgba(0,200,80,.3)}
    .green:hover{background:#00c850;color:#000}
    .purple{background:rgba(130,100,255,.15);color:#a088ff;border:1px solid rgba(130,100,255,.3)}
    .purple:hover{background:#a088ff;color:#fff}
    .danger{background:rgba(200,0,0,.15);color:#ff6060;border:1px solid rgba(200,0,0,.3)}
    .danger:hover{background:#c00;color:#fff}
    .yellow{background:rgba(255,184,0,.15);color:var(--ac2);border:1px solid rgba(255,184,0,.3)}
    .yellow:hover{background:var(--ac2);color:#000}
    .cart-badge{background:var(--ac);color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
    .hero{background:linear-gradient(135deg,#0a0a0a 0%,#1a0800 50%,#0a0a0a 100%);padding:72px 24px;text-align:center;border-bottom:1px solid var(--bd);position:relative;overflow:hidden}
    .hero::before{content:'GANGA';position:absolute;font-family:'Bebas Neue',sans-serif;font-size:280px;color:rgba(255,60,0,.04);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;user-select:none;white-space:nowrap}
    .hero h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(48px,10vw,90px);line-height:.95;margin-bottom:16px}
    .hero h1 span{color:var(--ac)}
    .hero p{color:#aaa;font-size:16px;max-width:480px;margin:0 auto 26px}
    .hero-tags{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
    .tag{background:var(--card);border:1px solid var(--bd);padding:5px 13px;border-radius:100px;font-size:13px;color:#aaa}
    .tag.hot{border-color:var(--ac);color:var(--ac)}
    .filtros{display:flex;gap:8px;padding:14px 22px;overflow-x:auto;border-bottom:1px solid var(--bd);align-items:center}
    .filtros input{background:var(--card);border:1px solid var(--bd);color:#f0ede8;padding:9px 13px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;min-width:180px}
    .filtros input:focus{border-color:var(--ac)}
    .chip{padding:7px 15px;border-radius:100px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid var(--bd);background:transparent;color:#aaa;transition:all .15s;white-space:nowrap}
    .chip.on{background:var(--ac);border-color:var(--ac);color:#fff}
    .chip:hover:not(.on){border-color:#555;color:#f0ede8}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:18px;padding:22px}
    .card{background:var(--card);border:1px solid var(--bd);border-radius:var(--r);overflow:hidden;transition:all .2s}
    .card:hover{border-color:#333;transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,0,0,.5)}
    .card img{width:100%;aspect-ratio:4/3;object-fit:contain;display:block;background:#1a1a1a}
    .card-img-ph{width:100%;aspect-ratio:4/3;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:48px}
    .card-body{padding:14px}
    .card-cat{font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
    .card-name{font-size:15px;font-weight:600;margin-bottom:5px;line-height:1.3}
    .card-desc{font-size:12px;color:#888;margin-bottom:12px;line-height:1.5}
    .card-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:8px}
    .price{font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--ac2)}
    .bs{font-size:11px;padding:3px 9px;border-radius:4px;font-weight:600;display:inline-block}
    .bs.in{background:rgba(0,200,80,.12);color:#00c850;border:1px solid rgba(0,200,80,.25)}
    .bs.out{background:rgba(255,184,0,.12);color:var(--ac2);border:1px solid rgba(255,184,0,.25)}
    .days{font-size:11px;color:var(--mu);margin-top:3px}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200}
    .drawer{position:fixed;right:0;top:0;bottom:0;width:380px;max-width:100vw;background:#111;border-left:1px solid var(--bd);z-index:201;display:flex;flex-direction:column}
    .dh{padding:18px 22px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center}
    .dh h2{font-family:'Bebas Neue',sans-serif;font-size:22px}
    .db{flex:1;overflow-y:auto;padding:14px 22px}
    .df{padding:18px 22px;border-top:1px solid var(--bd)}
    .ci{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--bd)}
    .ci img,.ci-ph{width:60px;height:60px;object-fit:cover;border-radius:8px;background:#1a1a1a;flex-shrink:0}
    .ci-ph{display:flex;align-items:center;justify-content:center;font-size:22px}
    .ci-name{font-size:13px;font-weight:500;margin-bottom:3px}
    .ci-price{font-size:12px;color:var(--ac2)}
    .qc{display:flex;align-items:center;gap:8px;margin-top:7px}
    .qb{background:var(--bd);border:none;color:#f0ede8;width:24px;height:24px;border-radius:5px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center}
    .qb:hover{background:var(--ac)}
    .qn{font-size:13px;font-weight:600;min-width:18px;text-align:center}
    .rb{background:none;border:none;color:var(--mu);cursor:pointer;font-size:17px;padding:3px;margin-left:auto}
    .rb:hover{color:var(--ac)}
    .tr{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
    .ta{font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--ac2)}
    .page{max-width:640px;margin:0 auto;padding:36px 24px}
    .page h1{font-family:'Bebas Neue',sans-serif;font-size:44px;margin-bottom:8px}
    .stitle{font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--ac);margin:24px 0 12px}
    .fg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .fgr{display:flex;flex-direction:column;gap:5px}
    .fgr.full{grid-column:1/-1}
    label{font-size:12px;color:#aaa;font-weight:500}
    label span{color:var(--ac)}
    input[type=text],input[type=email],input[type=tel],input[type=number],input[type=password],textarea,select{background:var(--card);border:1px solid var(--bd);color:#f0ede8;padding:10px 13px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;width:100%}
    input:focus,textarea:focus,select:focus{border-color:var(--ac)}
    select option{background:#141414}
    textarea{resize:vertical;min-height:75px}
    .ri{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--bd);font-size:14px}
    .rtot{display:flex;justify-content:space-between;padding:14px 0 0}
    .rtot span:last-child{font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--ac2)}
    .cp{max-width:560px;margin:0 auto;padding:56px 24px;text-align:center}
    .cp-icon{font-size:68px;margin-bottom:20px}
    .cp h1{font-family:'Bebas Neue',sans-serif;font-size:52px;color:var(--ac);margin-bottom:10px}
    .cp>p{color:#aaa;font-size:15px;margin-bottom:28px}
    .pbox{background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:22px;text-align:left;margin-bottom:22px}
    .pbox h3{font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--ac);margin-bottom:14px}
    .ps{display:flex;gap:12px;margin-bottom:12px;align-items:flex-start}
    .pn{background:var(--ac);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:1px}
    .ps p{font-size:13px;color:#ccc;line-height:1.5}
    .alias{background:#0a0a0a;border:2px dashed var(--ac2);border-radius:8px;padding:12px 18px;text-align:center;margin:12px 0}
    .alias span{font-family:'Bebas Neue',sans-serif;font-size:26px;color:var(--ac2);letter-spacing:2px}
    .ir{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1a1a1a;font-size:13px}
    .ir:last-child{border:none}
    .ir span:first-child{color:#888}
    .aw{max-width:960px;margin:0 auto;padding:30px 22px}
    .aw h1{font-family:'Bebas Neue',sans-serif;font-size:44px;margin-bottom:6px}
    .atabs{display:flex;gap:3px;margin-bottom:26px;border-bottom:1px solid var(--bd)}
    .atab{padding:10px 20px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#666;border-bottom:2px solid transparent;margin-bottom:-1px;transition:all .15s}
    .atab.on{color:var(--ac);border-bottom-color:var(--ac)}
    .atab:hover:not(.on){color:#f0ede8}
    .pc{background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:18px;margin-bottom:14px}
    .ph{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
    .eb{font-size:12px;padding:3px 11px;border-radius:100px;font-weight:600}
    .eb.esperando_pago{background:rgba(255,184,0,.15);color:var(--ac2)}
    .eb.pagado{background:rgba(0,200,80,.15);color:#00c850}
    .eb.despachado{background:rgba(130,100,255,.15);color:#a088ff}
    .pa{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
    .ptable{width:100%;border-collapse:collapse}
    .ptable th{text-align:left;font-size:11px;color:var(--mu);text-transform:uppercase;letter-spacing:.8px;padding:0 12px 10px;border-bottom:1px solid var(--bd)}
    .ptable td{padding:11px 12px;border-bottom:1px solid #1a1a1a;vertical-align:middle;font-size:14px}
    .ptable tr:last-child td{border:none}
    .thumb{width:48px;height:48px;object-fit:cover;border-radius:6px;background:#1a1a1a;display:block}
    .thumb-ph{width:48px;height:48px;border-radius:6px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:20px}
    .modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}
    .modal{background:#111;border:1px solid var(--bd);border-radius:16px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto}
    .mh{padding:20px 24px;border-bottom:1px solid var(--bd);display:flex;justify-content:space-between;align-items:center}
    .mh h2{font-family:'Bebas Neue',sans-serif;font-size:24px}
    .mb{padding:22px 24px}
    .mf{padding:14px 22px;border-top:1px solid var(--bd);display:flex;justify-content:flex-end;gap:10px}
    .trow{display:flex;align-items:center;justify-content:space-between;background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:12px 14px}
    .tgl{position:relative;width:44px;height:24px;cursor:pointer;display:inline-block}
    .tgl input{opacity:0;width:0;height:0;position:absolute}
    .ttrack{position:absolute;inset:0;background:#333;border-radius:100px;transition:.2s;pointer-events:none}
    .tgl input:checked + .ttrack{background:var(--ac)}
    .tthumb{position:absolute;width:18px;height:18px;background:#fff;border-radius:50%;top:3px;left:3px;transition:.2s;pointer-events:none}
    .tgl input:checked ~ .tthumb{left:23px}
    .alogin{max-width:340px;margin:80px auto;padding:36px;background:var(--card);border:1px solid var(--bd);border-radius:var(--r);text-align:center}
    .alogin h2{font-family:'Bebas Neue',sans-serif;font-size:30px;margin-bottom:20px}
    .empty{text-align:center;padding:72px 24px;color:var(--mu)}
    .empty h3{font-size:17px;margin-bottom:7px}
    .toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);padding:11px 22px;border-radius:8px;font-size:14px;font-weight:500;z-index:999;white-space:nowrap;animation:su .25s ease}
    .toast.ok{background:var(--ac);color:#fff}
    .toast.error{background:#c00;color:#fff}
    @keyframes su{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}
    .cdialog{background:var(--card);border:1px solid #c00;border-radius:var(--r);padding:24px;max-width:360px;margin:auto;text-align:center}
    .cdialog p{font-size:14px;color:#ccc;margin-bottom:20px}
    @media(max-width:600px){
      .fg{grid-template-columns:1fr}
      .drawer{width:100vw}
      .grid{grid-template-columns:1fr}
      .ptable thead{display:none}
      .ptable td{display:block;padding:5px 0}
    }
  `;

  // ââ Modal Producto ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const ModalProd = () => (
    <div className="modal-ov" onClick={e=>{if(e.target.classList.contains("modal-ov"))setModalProd(false)}}>
      <div className="modal">
        <div className="mh">
          <h2>{editId?"Editar producto":"Nuevo producto"}</h2>
          <button className="btn sm ghost" onClick={()=>setModalProd(false)}>â</button>
        </div>
        <div className="mb">
          <div className="fg">
            <div className="fgr full"><label>Nombre <span>*</span></label><input type="text" value={formProd.nombre} onChange={e=>setFormProd({...formProd,nombre:e.target.value})} placeholder="Ej: Auriculares Bluetooth Pro" /></div>
            <div className="fgr"><label>Precio en ARS <span>*</span></label><input type="number" value={formProd.precio} onChange={e=>setFormProd({...formProd,precio:e.target.value})} placeholder="18500" /></div>
            <div className="fgr"><label>Tipo de producto</label><input type="text" value={formProd.tipo||""} onChange={e=>setFormProd({...formProd,tipo:e.target.value})} placeholder="Ej: Celulares, Auriculares..." /></div>
            <div className="fgr full"><label>URL de la foto (link de imagen)</label><input type="text" value={formProd.foto} onChange={e=>setFormProd({...formProd,foto:e.target.value})} placeholder="https://..." /></div>
            {formProd.foto && <div className="fgr full" style={{textAlign:"center"}}><img src={formProd.foto} alt="preview" style={{maxHeight:130,borderRadius:8,objectFit:"cover",border:"1px solid var(--bd)"}} onError={e=>e.target.style.display="none"} /></div>}
            <div className="fgr full"><label>DescripciÃ³n</label><textarea value={formProd.descripcion} onChange={e=>setFormProd({...formProd,descripcion:e.target.value})} placeholder="Breve descripciÃ³n del producto..." /></div>
            <div className="fgr full">
              <div className="trow">
                <span style={{fontSize:14,fontWeight:500}}>{formProd.stock?"â En stock":"ð¦ Solo por pedido"}</span>
                <label className="tgl">
                  <input type="checkbox" checked={!!formProd.stock} onChange={e=>setFormProd({...formProd,stock:e.target.checked})} />
                  <span className="ttrack" />
                  <span className="tthumb" />
                </label>
              </div>
            </div>
            {formProd.stock
              ? <div className="fgr full"><label>Cantidad en stock</label><input type="number" value={formProd.cantidadStock} onChange={e=>setFormProd({...formProd,cantidadStock:e.target.value})} placeholder="0" min="0" /></div>
              : <div className="fgr full"><label>DÃ­as estimados de entrega</label><input type="text" value={formProd.diasEstimados} onChange={e=>setFormProd({...formProd,diasEstimados:e.target.value})} placeholder="Ej: 7 a 10" /></div>
            }
          </div>
        </div>
        <div className="mf">
          <button className="btn sm ghost" onClick={()=>setModalProd(false)}>Cancelar</button>
          <button className="btn sm primary" onClick={guardarProducto}>{editId?"Guardar cambios":"Agregar producto"}</button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      {toast && <div className={`toast ${toast.tipo}`}>{toast.msg}</div>}
      {modalProd && <ModalProd />}
      {borrarConf && (
        <div className="modal-ov">
          <div className="cdialog">
            <div style={{fontSize:40,marginBottom:12}}>ðï¸</div>
            <p>Â¿Eliminar <strong>"{borrarConf.nombre}"</strong>? No se puede deshacer.</p>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <button className="btn sm ghost" onClick={()=>setBorrarConf(null)}>Cancelar</button>
              <button className="btn sm danger" onClick={()=>eliminarProducto(borrarConf.id)}>SÃ­, eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav className="nav">
        <div className="logo" onClick={()=>setVista("tienda")}>GANGA<span>STORE</span></div>
        <div className="nav-r">
          {(window.location.hash==="#admin"||sessionStorage.getItem("gsAdmin"))&&<button className="btn sm ghost" onClick={()=>{setVista("admin");setAdminTab("pedidos")}}>Admin</button>}
          <button className="btn sm primary" onClick={()=>setCarritoOpen(true)}>
            ð Carrito {carrito.length>0&&<span className="cart-badge">{carrito.reduce((s,i)=>s+i.cantidad,0)}</span>}
          </button>
        </div>
      </nav>

      {/* ââ TIENDA ââ */}
      {vista==="tienda"&&<>
        <div className="hero">
          <h1>Ganga Store<br/><span>Bahia Blanca</span></h1>
          <p>TecnologÃ­a y accesorios al mejor precio. En stock o por pedido, te lo conseguimos.</p>
          <div className="hero-tags">
            <span className="tag hot">ð¥ Stock disponible</span>
            <span className="tag">ð¦ Por pedido</span>
            <span className="tag">ð EnvÃ­o a todo el paÃ­s</span>
            <span className="tag">ð³ Transferencia bancaria</span>
          </div>
        </div>
        <div className="filtros">
          <input placeholder="ð Buscar producto..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
          {categorias.map(c=><button key={c} className={`chip${catActiva===c?" on":""}`} onClick={()=>setCatActiva(c)}>{c}</button>)}
        </div>
        {filtrados.length===0
          ?<div className="empty"><h3>No encontramos productos</h3><p>ProbÃ¡ con otra bÃºsqueda o categorÃ­a.</p></div>
          :<div className="grid">
            {filtrados.map(p=>(
              <div className="card" key={p.id}>
                {p.foto?<img src={p.foto} alt={p.nombre} onError={e=>{e.target.style.display="none"}} />:<div className="card-img-ph">ð¦</div>}
                <div className="card-body">
                  <div className="card-cat">{p.categoria}</div>
                  <div className="card-name">{p.nombre}</div>
                  <div className="card-desc">{p.descripcion}</div>
                  <div className="card-foot">
                    <div>
                      <div className="price">{fmt(p.precio)}</div>
                      <span className={`bs ${p.stock?"in":"out"}`}>{p.stock?`â En stock (${p.cantidadStock})`:"ð¦ Por pedido"}</span>
                      {!p.stock&&p.diasEstimados&&<div className="days">â± {p.diasEstimados} dÃ­as hÃ¡biles</div>}
                    </div>
                    <button className="btn sm primary" onClick={()=>addCart(p)}>Agregar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
      </>}

      {/* ââ CHECKOUT ââ */}
      {vista==="checkout"&&<div className="page">
        <button className="btn sm ghost" style={{marginBottom:22}} onClick={()=>setVista("tienda")}>â Volver</button>
        <h1>TU PEDIDO</h1>
        <div className="stitle">Resumen</div>
        {carrito.map(i=><div className="ri" key={i.id}><span>{i.nombre} Ã {i.cantidad}</span><span>{fmt(i.precio*i.cantidad)}</span></div>)}
        <div className="rtot"><span style={{fontWeight:600}}>Total a pagar</span><span>{fmt(total)}</span></div>
        <div className="stitle">Tus datos</div>
        <div className="fg">
          <div className="fgr"><label>Nombre completo <span>*</span></label><input type="text" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} placeholder="Juan GarcÃ­a" /></div>
          <div className="fgr"><label>TelÃ©fono / WhatsApp <span>*</span></label><input type="tel" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})} placeholder="011 1234-5678" /></div>
          <div className="fgr full"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="juan@ejemplo.com" /></div>
          <div className="fgr full"><label>DirecciÃ³n de entrega <span>*</span></label><input type="text" value={form.direccion} onChange={e=>setForm({...form,direccion:e.target.value})} placeholder="Av. Corrientes 1234, Piso 3 Dto B" /></div>
          <div className="fgr"><label>Ciudad / Localidad <span>*</span></label><input type="text" value={form.ciudad} onChange={e=>setForm({...form,ciudad:e.target.value})} placeholder="Buenos Aires" /></div>
          <div className="fgr"><label>CÃ³digo postal</label><input type="text" value={form.cp} onChange={e=>setForm({...form,cp:e.target.value})} placeholder="1043" /></div>
          <div className="fgr full"><label>Notas adicionales</label><textarea value={form.notas} onChange={e=>setForm({...form,notas:e.target.value})} placeholder="Aclaraciones sobre el envÃ­o, horarios, etc." /></div>
        </div>
        <div style={{marginTop:26}}>
          <div style={{background:"var(--card)",border:"1px solid var(--bd)",borderRadius:10,padding:"15px 17px",marginBottom:16,fontSize:14,color:"#aaa",lineHeight:1.6}}>
            ð³ <strong style={{color:"#f0ede8"}}>Pago:</strong> Transferencia bancaria o Mercado Pago al alias <strong style={{color:"var(--ac2)"}}>{ALIAS}</strong>. Te mandamos los datos al confirmar.
          </div>
          <button className="btn primary full" style={{padding:"15px",fontSize:15}} onClick={confirmarPedido}>â Confirmar pedido</button>
        </div>
      </div>}

      {/* ââ CONFIRMACIÃN ââ */}
      {vista==="confirmacion"&&pedidoOk&&<div className="cp">
        <div className="cp-icon">ð</div>
        <h1>Â¡PEDIDO RECIBIDO!</h1>
        <p>Tu pedido fue registrado. RealizÃ¡ la transferencia y envianos el comprobante para confirmar el despacho.</p>
        <div className="pbox">
          <h3>ð² CÃ³mo pagar</h3>
          <div className="ps"><div className="pn">1</div><p>AbrÃ­ tu app bancaria o Mercado Pago â <strong>Transferir</strong>.</p></div>
          <div className="ps"><div className="pn">2</div><p>TransferÃ­ el total al alias:</p></div>
          <div className="alias"><span>{ALIAS}</span></div>
          <div className="ps"><div className="pn">3</div><p>PonÃ© como concepto tu nÃºmero de pedido: <strong style={{color:"var(--ac2)"}}>{pedidoOk.numero}</strong></p></div>
          <div className="ps"><div className="pn">4</div><p>Mandanos el comprobante por Instagram y confirmamos el despacho.</p></div>
        </div>
        <div className="pbox">
          <h3>ð¦ Detalle</h3>
          <div className="ir"><span>NÃºmero de pedido</span><span style={{fontWeight:600}}>{pedidoOk.numero}</span></div>
          <div className="ir"><span>Cliente</span><span>{pedidoOk.cliente.nombre}</span></div>
          <div className="ir"><span>DirecciÃ³n</span><span>{pedidoOk.cliente.direccion}, {pedidoOk.cliente.ciudad}</span></div>
          <div className="ir"><span>Total</span><span style={{color:"var(--ac2)",fontFamily:"Bebas Neue",fontSize:22}}>{fmt(pedidoOk.total)}</span></div>
          {pedidoOk.items.some(i=>!i.stock)&&<div style={{marginTop:12,padding:"9px 13px",background:"rgba(255,184,0,.08)",borderRadius:8,fontSize:13,color:"#aaa"}}>â± Algunos productos son por pedido. Te avisamos el tiempo estimado por WhatsApp.</div>}
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <a href="https://www.instagram.com/gangastorebb/" target="_blank" rel="noreferrer" className="btn gold">ð© Enviar comprobante por Instagram</a>
          <button className="btn ghost" onClick={()=>setVista("tienda")}>Seguir comprando</button>
        </div>
      </div>}

      {/* ââ ADMIN ââ */}
      {vista==="admin"&&(
        !adminOk
          ?<div className="alogin">
            <h2>ð Panel admin</h2>
            <div className="fgr" style={{marginBottom:14}}>
              <label>ContraseÃ±a</label>
              <input type="password" value={aPass} onChange={e=>setAPass(e.target.value)} placeholder="â¢â¢â¢â¢â¢â¢â¢â¢" onKeyDown={e=>{if(e.key==="Enter"&&aPass===PASS_ADMIN)setAdminOk(true)}} />
            </div>
            <button className="btn primary full" onClick={()=>{if(aPass===PASS_ADMIN){setAdminOk(true);sessionStorage.setItem("gsAdmin","1")}else showToast("ContraseÃ±a incorrecta","error")}}>Ingresar</button>
          </div>
          :<div className="aw">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10,marginBottom:14}}>
              <h1>PANEL ADMIN</h1>
              <div style={{display:"flex",gap:8}}>
                <button className="btn sm ghost" onClick={()=>{setAdminOk(false);sessionStorage.removeItem("gsAdmin")}}>Cerrar sesiÃ³n</button>
                <button className="btn sm ghost" onClick={()=>setVista("tienda")}>â Tienda</button>
              </div>
            </div>
            <div className="atabs">
              {[["pedidos","ð Pedidos"],["productos","ð¦ Productos"]].map(([k,l])=>(
                <button key={k} className={`atab${adminTab===k?" on":""}`} onClick={()=>setAdminTab(k)}>{l}</button>
              ))}
            </div>

            {adminTab==="pedidos"&&(
              pedidos.length===0
                ?<div className="empty"><h3>No hay pedidos todavÃ­a</h3><p>AparecerÃ¡n acÃ¡ cuando la gente compre.</p></div>
                :pedidos.map(p=>(
                  <div className="pc" key={p.numero}>
                    <div className="ph">
                      <strong style={{fontFamily:"Bebas Neue",fontSize:20}}>{p.numero}</strong>
                      <span className={`eb ${p.estado}`}>{p.estado==="esperando_pago"?"â³ Esperando pago":p.estado==="pagado"?"â Pagado":"ð¦ Despachado"}</span>
                      <span style={{fontSize:13,color:"#666",marginLeft:"auto"}}>{p.fecha}</span>
                    </div>
                    <div style={{fontSize:13,color:"#aaa",marginBottom:10}}>{p.items.map(i=>`${i.nombre} Ã ${i.cantidad}`).join(" | ")}</div>
                    <div className="ir"><span>Cliente</span><span>{p.cliente.nombre} Â· {p.cliente.telefono}</span></div>
                    <div className="ir"><span>DirecciÃ³n</span><span>{p.cliente.direccion}, {p.cliente.ciudad} {p.cliente.cp}</span></div>
                    {p.cliente.notas&&<div className="ir"><span>Notas</span><span>{p.cliente.notas}</span></div>}
                    <div className="ir"><span>Total</span><span style={{fontFamily:"Bebas Neue",fontSize:20,color:"var(--ac2)"}}>{fmt(p.total)}</span></div>
                    <div className="pa">
                      {p.estado==="esperando_pago"&&<button className="btn sm green" onClick={()=>marcarPagado(p.numero)}>â Marcar pagado</button>}
                      {p.estado==="pagado"&&<button className="btn sm purple" onClick={()=>marcarDespachado(p.numero)}>ð¦ Marcar despachado</button>}
                      <a href={`https://wa.me/${p.cliente.telefono.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="btn sm ghost">ð¬ WhatsApp</a>
                    </div>
                  </div>
                ))
            )}

            {adminTab==="productos"&&<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <span style={{color:"#666",fontSize:14}}>{productos.length} producto{productos.length!==1?"s":""}</span>
                <button className="btn sm primary" onClick={abrirNuevo}>+ Agregar producto</button>
              </div>
              {productos.length===0
                ?<div className="empty"><h3>No hay productos</h3><p>AgregÃ¡ el primero con el botÃ³n de arriba.</p></div>
                :<div style={{background:"var(--card)",border:"1px solid var(--bd)",borderRadius:"var(--r)",overflow:"hidden"}}>
                  <table className="ptable">
                    <thead>
                      <tr>
                        <th style={{width:60}}>Foto</th>
                        <th>Nombre</th>
                        <th>Precio</th>
                        <th>Estado</th>
                        <th>CategorÃ­a</th>
                        <th style={{width:110}}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.map(p=>(
                        <tr key={p.id}>
                          <td>{p.foto?<img src={p.foto} className="thumb" alt={p.nombre} onError={e=>{e.target.style.display="none"}} />:<div className="thumb-ph">ð¦</div>}</td>
                          <td>
                            <strong>{p.nombre}</strong>
                            {p.descripcion&&<div style={{fontSize:11,color:"#666",marginTop:2}}>{p.descripcion.slice(0,55)}{p.descripcion.length>55?"â¦":""}</div>}
                          </td>
                          <td style={{fontFamily:"Bebas Neue",fontSize:18,color:"var(--ac2)"}}>{fmt(p.precio)}</td>
                          <td>
                            <span className={`bs ${p.stock?"in":"out"}`}>{p.stock?`â (${p.cantidadStock})`:"ð¦ Pedido"}</span>
                            {!p.stock&&p.diasEstimados&&<div style={{fontSize:11,color:"var(--mu)",marginTop:2}}>{p.diasEstimados} dÃ­as</div>}
                          </td>
                          <td style={{color:"#888",fontSize:13}}>{p.categoria}</td>
                          <td>
                            <div style={{display:"flex",gap:5}}>
                              <button className="btn sm yellow" onClick={()=>abrirEditar(p)} title="Editar">âï¸</button>
                              <button className="btn sm danger" onClick={()=>setBorrarConf(p)} title="Eliminar">ð</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </>}
          </div>
      )}

      {/* ââ CARRITO DRAWER ââ */}
      {carritoOpen&&<>
        <div className="overlay" onClick={()=>setCarritoOpen(false)} />
        <div className="drawer">
          <div className="dh"><h2>ð Carrito</h2><button className="btn sm ghost" onClick={()=>setCarritoOpen(false)}>â</button></div>
          <div className="db">
            {carrito.length===0
              ?<div style={{textAlign:"center",padding:"60px 0",color:"#555"}}><div style={{fontSize:44,marginBottom:10}}>ð</div><p>Tu carrito estÃ¡ vacÃ­o</p></div>
              :carrito.map(i=>(
                <div className="ci" key={i.id}>
                  {i.foto?<img src={i.foto} alt={i.nombre} onError={e=>{e.target.style.display="none"}} />:<div className="ci-ph">ð¦</div>}
                  <div style={{flex:1}}>
                    <div className="ci-name">{i.nombre}</div>
                    <div className="ci-price">{fmt(i.precio)} c/u</div>
                    <div className="qc">
                      <button className="qb" onClick={()=>qtyCart(i.id,-1)}>â</button>
                      <span className="qn">{i.cantidad}</span>
                      <button className="qb" onClick={()=>qtyCart(i.id,1)}>+</button>
                      <button className="rb" onClick={()=>removeCart(i.id)}>ð</button>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
          {carrito.length>0&&<div className="df">
            <div className="tr"><span style={{color:"#aaa",fontSize:14}}>Total</span><span className="ta">{fmt(total)}</span></div>
            <button className="btn primary full" style={{padding:"13px",fontSize:15}} onClick={()=>{setCarritoOpen(false);setVista("checkout")}}>Finalizar compra â</button>
          </div>}
        </div>
      </>}
    </>
  );
}
