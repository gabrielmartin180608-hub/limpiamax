// ─── Constantes ──────────────────────────────────────────────────────────────
const ADMIN_HASH  = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";
const STORAGE_KEY = "limpiamax_inventario";
const BUYERS_KEY  = "limpiamax_compradores";

async function sha256(texto) {
  const data = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

const PRODUCTOS_INICIALES = [
  {
    id: crypto.randomUUID(),
    codigo: "LMX-001",
    nombre: "Desinfectante Pro",
    categoria: "Desinfeccion",
    descripcion: "Para pisos, mesas, banos y zonas de alto contacto.",
    costo: 150,
    venta: 250,
    stock: 18
  },
  {
    id: crypto.randomUUID(),
    codigo: "LMX-002",
    nombre: "Limpiador Industrial",
    categoria: "Industrial",
    descripcion: "Formula concentrada para grasa, polvo y suciedad pesada.",
    costo: 220,
    venta: 340,
    stock: 12
  },
  {
    id: crypto.randomUUID(),
    codigo: "LMX-003",
    nombre: "Aromatizante Premium",
    categoria: "Aroma",
    descripcion: "Aroma intenso y duradero para oficinas, autos y locales.",
    costo: 95,
    venta: 180,
    stock: 25
  }
];

// ─── Estado ───────────────────────────────────────────────────────────────────
let productos   = cargarProductos();
let carrito     = [];
let compradores = cargarCompradores();
let adminActivo = false;

// ─── Refs DOM ─────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const dom = {
  // Inventario
  productosContenedor: $("productos"),
  busquedaProducto:    $("busquedaProducto"),
  limpiarBusqueda:     $("limpiarBusqueda"),

  // Carrito
  contador:      $("contador"),
  carritoPanel:  $("carritoPanel"),
  abrirCarrito:  $("abrirCarrito"),
  cerrarCarrito: $("cerrarCarrito"),
  listaCarrito:  $("listaCarrito"),
  totalCarrito:  $("totalCarrito"),
  comprarBtn:    $("comprarBtn"),

  // Pedido
  pedidoFinal:     $("pedidoFinal"),
  resumenPedido:   $("resumenPedido"),
  confirmarPedido: $("confirmarPedido"),
  mensajePedido:   $("mensajePedido"),
  clienteCompra:   $("clienteCompra"),
  telefonoCompra:  $("telefonoCompra"),
  direccionCompra: $("direccionCompra"),

  // Modal admin
  modalAdmin:       $("modalAdmin"),
  cerrarModal:      $("cerrarModal"),
  abrirModalAdmin:  $("abrirModalAdmin"),
  abrirModalAdmin2: $("abrirModalAdmin2"),

  // Admin auth
  adminLogin:     $("adminLogin"),
  adminPanel:     $("adminPanel"),
  adminPassword:  $("adminPassword"),
  loginAdmin:     $("loginAdmin"),
  loginMensaje:   $("loginMensaje"),
  cerrarAdmin:    $("cerrarAdmin"),
  togglePassword: $("togglePassword"),

  // Admin form
  productoForm:        $("productoForm"),
  productoId:          $("productoId"),
  productoCodigo:      $("productoCodigo"),
  productoNombre:      $("productoNombre"),
  productoCategoria:   $("productoCategoria"),
  productoStock:       $("productoStock"),
  productoCosto:       $("productoCosto"),
  productoVenta:       $("productoVenta"),
  productoDescripcion: $("productoDescripcion"),
  cancelarEdicion:     $("cancelarEdicion"),
  formTitulo:          $("formTitulo"),
  adminLista:          $("adminLista"),
  compradoresLista:    $("compradoresLista"),
  limpiarCompradores:  $("limpiarCompradores")
};

// ─── Persistencia ─────────────────────────────────────────────────────────────
function cargarProductos() {
  try {
    const guardados = localStorage.getItem(STORAGE_KEY);
    if (guardados) return JSON.parse(guardados);
  } catch {
    console.warn("No se pudo leer el inventario del storage.");
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(PRODUCTOS_INICIALES));
  return [...PRODUCTOS_INICIALES];
}

function guardarProductos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(productos));
}

function cargarCompradores() {
  try {
    const guardados = localStorage.getItem(BUYERS_KEY);
    return guardados ? JSON.parse(guardados) : [];
  } catch {
    return [];
  }
}

function guardarCompradores() {
  localStorage.setItem(BUYERS_KEY, JSON.stringify(compradores));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generarCodigo() {
  const numeros = productos
    .map((p) => parseInt(p.codigo.replace("LMX-", ""), 10))
    .filter((n) => !Number.isNaN(n));
  const siguiente = numeros.length ? Math.max(...numeros) + 1 : 1;
  return `LMX-${String(siguiente).padStart(3, "0")}`;
}

function fmt(num) {
  return Number(num).toFixed(2);
}

function debounce(fn, ms = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── Modal admin ──────────────────────────────────────────────────────────────
function abrirModal() {
  dom.modalAdmin.classList.add("active");
  document.body.style.overflow = "hidden";
  if (adminActivo) {
    dom.adminLogin.classList.add("hidden");
    dom.adminPanel.classList.add("active");
    renderAdminLista();
  } else {
    dom.adminLogin.classList.remove("hidden");
    dom.adminPanel.classList.remove("active");
    setTimeout(() => dom.adminPassword.focus(), 120);
  }
}

function cerrarModal() {
  dom.modalAdmin.classList.remove("active");
  document.body.style.overflow = "";
}

// ─── Tabs del modal ───────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    const tabId = "tab-" + btn.dataset.tab;
    document.getElementById(tabId).classList.add("active");
    if (btn.dataset.tab === "compradores") renderCompradores();
  });
});

// ─── Inventario ───────────────────────────────────────────────────────────────
function obtenerProductosFiltrados() {
  const texto = dom.busquedaProducto.value.trim().toLowerCase();
  if (!texto) return productos;
  return productos.filter((p) =>
    p.nombre.toLowerCase().includes(texto) ||
    p.codigo.toLowerCase().includes(texto) ||
    p.categoria.toLowerCase().includes(texto)
  );
}

function renderProductos() {
  const lista = obtenerProductosFiltrados();

  if (lista.length === 0) {
    dom.productosContenedor.innerHTML = '<p class="productos-vacio">No se encontraron productos.</p>';
    renderAdminLista();
    return;
  }

  const fragment = document.createDocumentFragment();

  lista.forEach((producto) => {
    const card = document.createElement("article");
    card.className = "producto-card";
    card.dataset.id = producto.id;

    const sinStock = producto.stock <= 0;

    card.innerHTML = `
      <div class="producto-info">
        <span class="codigo">${producto.codigo}</span>
        <span class="categoria">${producto.categoria}</span>
        <h3>${producto.nombre}</h3>
        <p>${producto.descripcion}</p>
        <div class="datos-producto">
          <div class="dato"><span>Precio</span><strong>$${fmt(producto.venta)}</strong></div>
          <div class="dato"><span>Stock</span><strong>${sinStock ? "Agotado" : producto.stock}</strong></div>
        </div>
        <div class="producto-bottom">
          <strong>$${fmt(producto.venta)}</strong>
          <button class="agregar" data-id="${producto.id}" ${sinStock ? "disabled" : ""}>
            ${sinStock ? "Sin stock" : "Agregar"}
          </button>
        </div>
      </div>
    `;

    fragment.appendChild(card);
  });

  dom.productosContenedor.innerHTML = "";
  dom.productosContenedor.appendChild(fragment);
  renderAdminLista();
}

// ─── Carrito ──────────────────────────────────────────────────────────────────
function actualizarCarrito() {
  const cantidadTotal = carrito.reduce((t, i) => t + i.cantidad, 0);
  const total         = carrito.reduce((t, i) => t + i.precio * i.cantidad, 0);

  dom.contador.textContent     = cantidadTotal;
  dom.totalCarrito.textContent = fmt(total);

  if (carrito.length === 0) {
    dom.listaCarrito.innerHTML = '<p class="carrito-vacio">Tu carrito esta vacio.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  carrito.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "item-carrito";
    div.innerHTML = `
      <h4>${item.codigo} | ${item.nombre}</h4>
      <p>${item.cantidad} x $${fmt(item.precio)} = $${fmt(item.cantidad * item.precio)}</p>
      <button type="button" data-index="${index}" aria-label="Eliminar uno de ${item.nombre}">Eliminar uno</button>
    `;
    fragment.appendChild(div);
  });

  dom.listaCarrito.innerHTML = "";
  dom.listaCarrito.appendChild(fragment);
}

function agregarAlCarrito(productoId) {
  const producto = productos.find((p) => p.id === productoId);
  if (!producto || producto.stock <= 0) {
    alert("Producto sin stock disponible.");
    return;
  }

  const existente = carrito.find((i) => i.id === productoId);

  if (existente) {
    if (existente.cantidad >= producto.stock) {
      alert("No hay mas stock disponible.");
      return;
    }
    existente.cantidad += 1;
  } else {
    carrito.push({
      id:       producto.id,
      codigo:   producto.codigo,
      nombre:   producto.nombre,
      precio:   producto.venta,
      cantidad: 1
    });
  }

  actualizarCarrito();
  dom.carritoPanel.classList.add("active");
}

function sincronizarCarritoConProductos() {
  carrito = carrito
    .map((item) => {
      const p = productos.find((x) => x.id === item.id);
      if (!p) return null;
      return {
        ...item,
        codigo:   p.codigo,
        nombre:   p.nombre,
        precio:   p.venta,
        cantidad: Math.min(item.cantidad, p.stock)
      };
    })
    .filter((item) => item && item.cantidad > 0);

  actualizarCarrito();
}

// ─── Pedido ───────────────────────────────────────────────────────────────────
function mostrarResumenPedido() {
  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const lineas = carrito
    .map((i) => `<p>${i.cantidad} x ${i.codigo} | ${i.nombre} — <strong>$${fmt(i.precio * i.cantidad)}</strong></p>`)
    .join("");

  dom.resumenPedido.innerHTML = `
    <h3>Productos seleccionados</h3>
    ${lineas}
    <p><strong>Total del pedido: $${fmt(total)}</strong></p>
  `;
}

// ─── Admin ────────────────────────────────────────────────────────────────────
function renderAdminLista() {
  if (!adminActivo) return;

  if (productos.length === 0) {
    dom.adminLista.innerHTML = '<p class="productos-vacio">No hay productos para administrar.</p>';
    renderCompradores();
    return;
  }

  const fragment = document.createDocumentFragment();

  productos.forEach((producto) => {
    const div = document.createElement("div");
    div.className = "admin-item";
    div.innerHTML = `
      <div>
        <h4>${producto.codigo} | ${producto.nombre}</h4>
        <p>${producto.categoria} | Stock: ${producto.stock} | Costo: $${fmt(producto.costo)} | Venta: $${fmt(producto.venta)}</p>
      </div>
      <div class="admin-actions">
        <button type="button" data-edit="${producto.id}" title="Editar" aria-label="Editar ${producto.nombre}">
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button>
        <button type="button" class="delete" data-delete="${producto.id}" title="Eliminar" aria-label="Eliminar ${producto.nombre}">
          <i class="fa-solid fa-trash" aria-hidden="true"></i>
        </button>
      </div>
    `;
    fragment.appendChild(div);
  });

  dom.adminLista.innerHTML = "";
  dom.adminLista.appendChild(fragment);
}

function renderCompradores() {
  if (!adminActivo) return;

  if (compradores.length === 0) {
    dom.compradoresLista.innerHTML = '<p class="productos-vacio">Aun no hay compradores registrados.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  compradores.forEach((c) => {
    const div = document.createElement("div");
    div.className = "comprador-item";

    const productosHtml = c.productos
      .map((p) => `<p>${p.cantidad} x ${p.codigo} | ${p.nombre} — $${fmt(p.subtotal)}</p>`)
      .join("");

    div.innerHTML = `
      <h4>${c.nombre}</h4>
      <p>Telefono: ${c.telefono}</p>
      <p>Direccion: ${c.direccion}</p>
      <p>Fecha: ${c.fecha}</p>
      <div class="comprador-productos">${productosHtml}</div>
      <p class="comprador-total">Total: $${fmt(c.total)}</p>
    `;
    fragment.appendChild(div);
  });

  dom.compradoresLista.innerHTML = "";
  dom.compradoresLista.appendChild(fragment);
}

function cargarProductoEnFormulario(id) {
  const producto = productos.find((p) => p.id === id);
  if (!producto) return;

  dom.productoId.value          = producto.id;
  dom.productoCodigo.value      = producto.codigo;
  dom.productoNombre.value      = producto.nombre;
  dom.productoCategoria.value   = producto.categoria;
  dom.productoStock.value       = producto.stock;
  dom.productoCosto.value       = producto.costo;
  dom.productoVenta.value       = producto.venta;
  dom.productoDescripcion.value = producto.descripcion;
  dom.formTitulo.textContent    = "Modificar producto existente";

  const tabProductos = document.querySelector('[data-tab="productos"]');
  if (tabProductos && !tabProductos.classList.contains("active")) {
    tabProductos.click();
  }
  dom.productoForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function limpiarFormularioProducto() {
  dom.productoId.value          = "";
  dom.productoCodigo.value      = generarCodigo();
  dom.productoNombre.value      = "";
  dom.productoCategoria.value   = "";
  dom.productoStock.value       = "";
  dom.productoCosto.value       = "";
  dom.productoVenta.value       = "";
  dom.productoDescripcion.value = "";
  dom.formTitulo.textContent    = "Registrar producto nuevo";
}

function eliminarProducto(id) {
  const producto = productos.find((p) => p.id === id);
  if (!producto) return;

  if (!confirm(`Eliminar ${producto.codigo} | ${producto.nombre}?`)) return;

  productos = productos.filter((p) => p.id !== id);
  carrito   = carrito.filter((i) => i.id !== id);

  guardarProductos();
  renderProductos();
  actualizarCarrito();
  limpiarFormularioProducto();
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

dom.abrirModalAdmin.addEventListener("click",  abrirModal);
dom.abrirModalAdmin2.addEventListener("click", abrirModal);

dom.cerrarModal.addEventListener("click", cerrarModal);

dom.modalAdmin.addEventListener("click", (e) => {
  if (e.target === dom.modalAdmin) cerrarModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dom.modalAdmin.classList.contains("active")) cerrarModal();
});

dom.togglePassword.addEventListener("click", () => {
  const input = dom.adminPassword;
  const icon  = dom.togglePassword.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    icon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.replace("fa-eye-slash", "fa-eye");
  }
});

dom.busquedaProducto.addEventListener("input", debounce(renderProductos));

dom.limpiarBusqueda.addEventListener("click", () => {
  dom.busquedaProducto.value = "";
  renderProductos();
  dom.busquedaProducto.focus();
});

dom.productosContenedor.addEventListener("click", (e) => {
  const boton = e.target.closest(".agregar");
  if (!boton) return;
  agregarAlCarrito(boton.dataset.id);
});

dom.abrirCarrito.addEventListener("click",  () => dom.carritoPanel.classList.add("active"));
dom.cerrarCarrito.addEventListener("click", () => dom.carritoPanel.classList.remove("active"));

document.addEventListener("click", (e) => {
  if (
    dom.carritoPanel.classList.contains("active") &&
    !dom.carritoPanel.contains(e.target) &&
    e.target !== dom.abrirCarrito
  ) {
    dom.carritoPanel.classList.remove("active");
  }
});

dom.listaCarrito.addEventListener("click", (e) => {
  const boton = e.target.closest("button[data-index]");
  if (!boton) return;
  const idx = Number(boton.dataset.index);
  carrito[idx].cantidad -= 1;
  if (carrito[idx].cantidad <= 0) carrito.splice(idx, 1);
  actualizarCarrito();
});

dom.comprarBtn.addEventListener("click", () => {
  if (carrito.length === 0) {
    alert("Agrega productos al carrito antes de finalizar la compra.");
    return;
  }
  dom.carritoPanel.classList.remove("active");
  dom.pedidoFinal.classList.add("active");
  mostrarResumenPedido();
  dom.pedidoFinal.scrollIntoView({ behavior: "smooth" });
});

dom.confirmarPedido.addEventListener("click", () => {
  const nombre    = dom.clienteCompra.value.trim();
  const telefono  = dom.telefonoCompra.value.trim();
  const direccion = dom.direccionCompra.value.trim();

  if (!nombre || !telefono || !direccion) {
    dom.mensajePedido.style.color = "#ff003c";
    dom.mensajePedido.textContent = "Completa nombre, telefono y direccion para confirmar.";
    return;
  }

  carrito.forEach((item) => {
    const producto = productos.find((p) => p.id === item.id);
    if (producto) producto.stock -= item.cantidad;
  });

  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const comprador = {
    id:        crypto.randomUUID(),
    nombre,
    telefono,
    direccion,
    fecha:     new Date().toLocaleString("es-MX"),
    total,
    productos: carrito.map((i) => ({
      codigo:   i.codigo,
      nombre:   i.nombre,
      precio:   i.precio,
      cantidad: i.cantidad,
      subtotal: i.precio * i.cantidad
    }))
  };

  compradores.unshift(comprador);
  guardarCompradores();
  guardarProductos();

  dom.mensajePedido.style.color = "#30e36c";
  dom.mensajePedido.textContent = `Pedido confirmado para ${nombre}. Comprador registrado e inventario actualizado.`;

  carrito = [];
  actualizarCarrito();
  renderProductos();
  renderCompradores();
  dom.resumenPedido.innerHTML  = "";
  dom.clienteCompra.value      = "";
  dom.telefonoCompra.value     = "";
  dom.direccionCompra.value    = "";
});

// ─── Admin: login ─────────────────────────────────────────────────────────────
dom.loginAdmin.addEventListener("click", async () => {
  const passwordIngresada = dom.adminPassword.value;
  const hashIngresado     = await sha256(passwordIngresada);

  if (hashIngresado !== ADMIN_HASH) {
    dom.loginMensaje.textContent = "Contrasena incorrecta.";
    dom.adminPassword.focus();
    dom.adminPassword.closest(".input-group").style.animation = "none";
    requestAnimationFrame(() => {
      dom.adminPassword.closest(".input-group").style.animation = "shake 0.35s ease";
    });
    return;
  }

  adminActivo = true;
  dom.adminLogin.classList.add("hidden");
  dom.adminPanel.classList.add("active");
  dom.loginMensaje.textContent = "";
  dom.adminPassword.value      = "";

  limpiarFormularioProducto();
  renderAdminLista();
});

dom.adminPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") dom.loginAdmin.click();
});

// ─── Admin: cerrar sesión ─────────────────────────────────────────────────────
dom.cerrarAdmin.addEventListener("click", () => {
  adminActivo = false;
  dom.adminPanel.classList.remove("active");
  dom.adminLogin.classList.remove("hidden");
  dom.loginMensaje.textContent = "";
  limpiarFormularioProducto();
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
  document.querySelector('[data-tab="productos"]').classList.add("active");
  document.getElementById("tab-productos").classList.add("active");
});

// ─── Admin: guardar producto ──────────────────────────────────────────────────
dom.productoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!adminActivo) return;

  const nombre      = dom.productoNombre.value.trim();
  const categoria   = dom.productoCategoria.value.trim();
  const stock       = Number(dom.productoStock.value);
  const costo       = Number(dom.productoCosto.value);
  const venta       = Number(dom.productoVenta.value);
  const descripcion = dom.productoDescripcion.value.trim();

  if (!nombre)                      return alert("El nombre es obligatorio.");
  if (!categoria)                   return alert("La categoria es obligatoria.");
  if (!descripcion)                 return alert("La descripcion es obligatoria.");
  if (isNaN(stock)  || stock  < 0)  return alert("El stock debe ser un numero mayor o igual a 0.");
  if (isNaN(costo)  || costo  < 0)  return alert("El costo debe ser un numero mayor o igual a 0.");
  if (isNaN(venta)  || venta  <= 0) return alert("El precio de venta debe ser mayor a 0.");

  if (dom.productoId.value) {
    productos = productos.map((p) =>
      p.id !== dom.productoId.value
        ? p
        : { ...p, nombre, categoria, descripcion, costo, venta, stock }
    );
  } else {
    productos.push({
      id:          crypto.randomUUID(),
      codigo:      generarCodigo(),
      nombre,
      categoria,
      descripcion,
      costo,
      venta,
      stock
    });
  }

  sincronizarCarritoConProductos();
  guardarProductos();
  renderProductos();
  limpiarFormularioProducto();
});

dom.cancelarEdicion.addEventListener("click", limpiarFormularioProducto);

// ─── Admin: limpiar compradores ───────────────────────────────────────────────
dom.limpiarCompradores.addEventListener("click", () => {
  if (!adminActivo) return;
  if (!confirm("Eliminar todo el registro de compradores?")) return;
  compradores = [];
  guardarCompradores();
  renderCompradores();
});

// ─── Admin: editar / eliminar (delegación) ────────────────────────────────────
dom.adminLista.addEventListener("click", (e) => {
  const editar   = e.target.closest("[data-edit]");
  const eliminar = e.target.closest("[data-delete]");
  if (editar)   cargarProductoEnFormulario(editar.dataset.edit);
  if (eliminar) eliminarProducto(eliminar.dataset.delete);
});

// ─── Animación shake ──────────────────────────────────────────────────────────
const shakeStyle = document.createElement("style");
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-8px); }
    40%       { transform: translateX(8px); }
    60%       { transform: translateX(-5px); }
    80%       { transform: translateX(5px); }
  }
`;
document.head.appendChild(shakeStyle);

// ─── Init ─────────────────────────────────────────────────────────────────────
renderProductos();
actualizarCarrito();
