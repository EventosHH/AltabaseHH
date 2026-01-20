const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw4WRbONIIIiM4_dBU6S2LDbfhy62TpTB-Pml82hO6Q8RrGM-ELH1-S3roOEH4Ny-Lj/exec";

document.addEventListener("DOMContentLoaded", () => {

  /* ================= ELEMENTOS ================= */
  const form = document.getElementById("formCompra");
  const entradaSelect = form.elements["entrada"];
  const cantidadSelect = form.elements["cantidad"];
  const formMsg = document.getElementById("formMsg");

  const pre1Rest = document.getElementById("preventa1Restante");
  const pre2Rest = document.getElementById("preventa2Restante");
  const btnPre2 = document.getElementById("btnPre2");
  const btnTickets = document.querySelectorAll(".btn-ticket[data-entrada]");

  const CODIGOS_ESQUINAS = [
    "CLANDEWU90HH","CABRASENCARRERA90HH","MATUZA90HH","METRYK90HH",
    "OWEN90HH","CARPINTERO90HH","DAVID90HH","COVA90HH"
  ];

  /* ================= FUNCIONES STOCK ================= */
  async function cargarStockGlobal() {
    try {
      const res = await fetch(`${SCRIPT_URL}?action=stock`);
      const data = await res.json();

      const stock = {
        "Preventa 1": Number(data["Preventa 1"] || 0),
        "Preventa 2": Number(data["Preventa 2"] || 0),
        "Esquinas 50%": data["Esquinas 50%"] || {}
      };

      // Mostrar stock en pantalla
      pre1Rest.textContent = stock["Preventa 1"];
      pre2Rest.textContent = stock["Preventa 2"];

      // ===================== ACTUALIZAR BOTONES =====================
      btnTickets.forEach(btn => {
        const tipo = btn.dataset.entrada;

        if (tipo === "Preventa 1") {
          if (stock["Preventa 1"] <= 0) btn.classList.add("disabled");
          else btn.classList.remove("disabled");
        }

        if (tipo === "Preventa 2") {
          if (stock["Preventa 1"] > 0 || stock["Preventa 2"] <= 0) {
            btn.classList.add("disabled");
            entradaSelect.querySelector('option[value="Preventa 2"]').disabled = true;
          } else {
            btn.classList.remove("disabled");
            entradaSelect.querySelector('option[value="Preventa 2"]').disabled = false;
          }
        }

        if (tipo === "Esquinas 50%") {
          // Habilita si hay al menos un código con stock > 0
          const anyStock = Object.values(stock["Esquinas 50%"]).some(v => v > 0);
          if (!anyStock) btn.classList.add("disabled");
          else btn.classList.remove("disabled");
        }
      });

      return stock;

    } catch (err) {
      console.error("Error cargando stock global:", err);
      return { "Preventa 1": 0, "Preventa 2": 0, "Esquinas 50%": {} };
    }
  }

  /* ================= SELECCIONAR ENTRADA ================= */
  btnTickets.forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("disabled")) return;
      entradaSelect.value = btn.dataset.entrada;
      form.scrollIntoView({ behavior: "smooth" });
    });
  });

  /* ================= ENVIAR A SHEETS ================= */
  async function enviarCompraSheets(data) {
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        body: new URLSearchParams(data)
      });
      console.log("Datos enviados:", data);
    } catch (err) {
      console.error("Error enviando a Sheets:", err);
    }
  }

  /* ================= FORM SUBMIT ================= */
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const nombre = form.elements["nombre"].value.trim();
    const email = form.elements["email"].value.trim();
    const entrada = entradaSelect.value;
    const cantidad = Number(cantidadSelect.value);

    if (!nombre || !email || !entrada || !cantidad) {
      formMsg.textContent = "Completa todos los campos.";
      return;
    }

    // Links de pago
    let link = "";
    if (entrada === "Preventa 1") link = cantidad === 1 ? "https://mpago.la/2q7KKho" : "https://mpago.la/2RVoxwi";
    if (entrada === "Preventa 2") link = cantidad === 1 ? "https://mpago.la/2RVoxwi" : "https://mpago.la/32oWj5Y";

    // ================= VALIDAR STOCK =================
    const stock = await cargarStockGlobal();
    if (entrada !== "Esquinas 50%" && stock[entrada] < cantidad) {
      formMsg.textContent = "No hay stock suficiente.";
      return;
    }

    // ================= BLOQUEAR BOTON FORMULARIO =================
    const btnFormPago = document.getElementById("btnFormPago");
    if (btnFormPago) {
      btnFormPago.disabled = true;
      btnFormPago.dataset.originalText = btnFormPago.textContent;
      btnFormPago.textContent = "Redirigiendo, por favor espere...";
    }

    // ================= ENVIAR AL BACKEND =================
    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: new URLSearchParams({
          action: "comprar",
          nombre,
          email,
          entrada,
          cantidad
        })
      });

      const result = await res.text();
      if (result === "SIN_STOCK") {
        formMsg.textContent = "No hay stock disponible.";
        await cargarStockGlobal();
        if (btnFormPago) {
          btnFormPago.disabled = false;
          btnFormPago.textContent = btnFormPago.dataset.originalText;
        }
        return;
      }

      // ✅ Compra OK → redirige
      window.location.href = link;

    } catch (err) {
      console.error(err);
      formMsg.textContent = "Error al procesar la compra.";
    }
  });

  /* ================= ESQUINAS ================= */
  document.getElementById("btnEsquinas").onclick = () => {
    document.getElementById("esquinasContainer").style.display = "block";
  };

  document.getElementById("esquinasSubmit").onclick = async () => {
    const code = document.getElementById("esquinaCodigo").value.trim().toUpperCase();
    const msg = document.getElementById("esquinasMsg");

    const stock = await cargarStockGlobal();

    if (!CODIGOS_ESQUINAS.includes(code)) {
      msg.textContent = "Código inválido.";
      return;
    }

    if (!stock["Esquinas 50%"][code] || stock["Esquinas 50%"][code] <= 0) {
      msg.textContent = "No hay stock disponible para este código";
      return;
    }

    document.getElementById("popupNombre").style.display = "block";
    msg.textContent = "";
  };

  document.getElementById("btnPagarAhora").onclick = async () => {
    const alias = document.getElementById("inputAlias").value.trim();
    const code = document.getElementById("esquinaCodigo").value.trim().toUpperCase();
    const msg = document.getElementById("popupMsg");

    if (!alias) {
      msg.textContent = "Ingresa tu nombre.";
      return;
    }

    // Bloquear botón
    const btn50Off = document.getElementById("btnPagarAhora");
    btn50Off.disabled = true;
    btn50Off.dataset.originalText = btn50Off.textContent;
    btn50Off.textContent = "Redirigiendo, por favor espere...";

    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: new URLSearchParams({
          action: "comprar",
          nombre: alias,
          email: code,
          entrada: "Esquinas 50%",
          cantidad: 1
        })
      });

      const result = await res.text();
      if (result === "SIN_STOCK") {
        msg.textContent = "No hay stock de Esquinas disponible.";
        await cargarStockGlobal();
        btn50Off.disabled = false;
        btn50Off.textContent = btn50Off.dataset.originalText;
        return;
      }

      window.location.href = "https://mpago.la/29Eaw8v";

    } catch (err) {
      console.error(err);
      msg.textContent = "Error al procesar la compra.";
      btn50Off.disabled = false;
      btn50Off.textContent = btn50Off.dataset.originalText;
    }
  };

  /* ================= CARGAR STOCK AL INICIO Y REFRESCO AUTOMÁTICO ================= */
  async function actualizarStock() {
    await cargarStockGlobal();
  }

  actualizarStock();
  setInterval(actualizarStock, 5000);

  /* ================= SCROLL SUAVE HEADER + BARRA ACTIVA ================= */
  const headerLinks = document.querySelectorAll('header a[href^="#"]');
  const sections = document.querySelectorAll("section");
  const barraActiva = document.createElement("div");
  barraActiva.classList.add("barra-activa");
  document.querySelector("header").appendChild(barraActiva);

  headerLinks.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute("href"));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  function actualizarBarraActiva() {
    const scrollPos = window.scrollY + 100;
    let seccionActual = sections[0];

    sections.forEach(sec => {
      if (scrollPos >= sec.offsetTop) seccionActual = sec;
    });

    headerLinks.forEach(link => {
      if (link.getAttribute("href") === `#${seccionActual.id}`) {
        link.classList.add("active");
        barraActiva.style.width = `${link.offsetWidth}px`;
        barraActiva.style.left = `${link.offsetLeft}px`;
      } else {
        link.classList.remove("active");
      }
    });
  }

  window.addEventListener("scroll", actualizarBarraActiva);
  actualizarBarraActiva();

});
