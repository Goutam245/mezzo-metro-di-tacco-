/* =========================================================================
   Pannello di Mezzo Metro di Tacco — versione C
   Cambia i contenuti del sito e li salva sul deposito del server.
   Se il deposito non risponde, i contenuti si possono comunque scaricare.
   ========================================================================= */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var dati = {};
  try { dati = JSON.parse(($("#seme") || {}).textContent || "{}"); } catch (e) { dati = {}; }
  var sporco = false;
  var inModifica = null;   // il prodotto aperto nella finestra (null = nuovo)
  var bozza = null;        // la copia su cui si lavora nella finestra

  /* ── avvisi e stato ──────────────────────────────────────────────────── */
  var avviso = $("#avviso"), attesaAvviso;
  function dì(testo, male) {
    avviso.textContent = testo;
    avviso.hidden = false;
    avviso.classList.toggle("p-avviso--male", !!male);
    clearTimeout(attesaAvviso);
    attesaAvviso = setTimeout(function () { avviso.hidden = true; }, male ? 6000 : 2600);
  }
  function segnaSporco() {
    sporco = true;
    $("#stato-salvataggio").textContent = "Ci sono modifiche da salvare";
    $("#stato-salvataggio").classList.add("p-stato--sporco");
  }
  function segnaPulito(testo) {
    sporco = false;
    $("#stato-salvataggio").textContent = testo || "Tutto salvato";
    $("#stato-salvataggio").classList.remove("p-stato--sporco");
  }
  window.addEventListener("beforeunload", function (e) {
    if (sporco) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ── accesso ─────────────────────────────────────────────────────────── */
  function mostraPannello() {
    $("#accesso").hidden = true;
    $("#pannello").hidden = false;
    $("#salva").hidden = false;
    $("#esci").hidden = false;
    caricaDalDeposito().then(function () {
      riempiTutto();
      segnaPulito("Aggiornato il " + (dati.aggiornato || "—"));
    });
  }

  fetch("/api/stato")
    .then(function (r) { return r.json(); })
    .then(function (s) {
      if (!s.configurato) {
        var n = $("#avviso-configurazione");
        n.hidden = false;
        n.textContent = "Sul server mancano PANNELLO_CHIAVE e PANNELLO_SEGRETO: " +
                        "finché non ci sono, il pannello non fa entrare nessuno.";
      }
      if (s.dentro) mostraPannello();
    })
    .catch(function () {
      var n = $("#avviso-configurazione");
      n.hidden = false;
      n.textContent = "Il server non risponde. Da qui puoi lavorare solo con la copia scaricata.";
    });

  $("#modulo-accesso").addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("#errore-accesso");
    err.hidden = true;
    fetch("/api/accesso", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chiave: $("#chiave").value })
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (e2) {
        if (!e2.ok) { err.hidden = false; err.textContent = e2.d.errore || "Non si entra."; return; }
        mostraPannello();
      })
      .catch(function () { err.hidden = false; err.textContent = "Il server non risponde."; });
  });

  $("#esci").addEventListener("click", function () {
    if (sporco && !confirm("Ci sono modifiche non salvate. Esci lo stesso?")) return;
    fetch("/api/uscita", { method: "POST" }).then(function () { location.reload(); });
  });

  /* ── deposito ────────────────────────────────────────────────────────── */
  function caricaDalDeposito() {
    return fetch("/api/contenuti", { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok && r.status !== 204 ? r.json() : null; })
      .then(function (d) { if (d && d.prodotti) dati = d; })
      .catch(function () { /* si resta col seme della pagina */ });
  }

  $("#salva").addEventListener("click", function () {
    raccogliTesti();
    fetch("/api/contenuti", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(dati)
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (e) {
        if (!e.ok) { dì(e.d.errore || "Non è stato salvato.", true); return; }
        dati.versione = e.d.versione;
        dati.aggiornato = e.d.aggiornato;
        segnaPulito("Salvato il " + e.d.aggiornato);
        dì("Salvato. Il sito è aggiornato.");
      })
      .catch(function () { dì("Il server non risponde: scarica la copia per non perdere il lavoro.", true); });
  });

  /* ── copia di sicurezza ──────────────────────────────────────────────── */
  $("#scarica").addEventListener("click", function () {
    raccogliTesti();
    var testo = JSON.stringify(dati, null, 1);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([testo], { type: "application/json" }));
    a.download = "contenuti-mezzo-metro-di-tacco.json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $("#carica").addEventListener("click", function () { $("#file-contenuti").click(); });
  $("#file-contenuti").addEventListener("change", function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var lettore = new FileReader();
    lettore.onload = function () {
      try {
        var d = JSON.parse(lettore.result);
        if (!d.prodotti || !d.categorie) throw new Error("forma");
        dati = d;
        riempiTutto();
        segnaSporco();
        dì("Contenuti caricati. Ora tocca «Salva tutto».");
      } catch (e) { dì("Il file non è leggibile.", true); }
    };
    lettore.readAsText(f);
    this.value = "";
  });

  /* ── testi ───────────────────────────────────────────────────────────── */
  var CAMPI_TESTO = [
    ["#t-titolo-hero", "impostazioni", "titoloHero"],
    ["#t-chiusura", "impostazioni", "titoloChiusuraStoria"],
    ["#t-storia", "impostazioni", "storiaApertura"],
    ["#t-whatsapp", "impostazioni", "whatsapp"],
    ["#t-whatsapp-visibile", "impostazioni", "whatsappVisibile"],
    ["#t-email", "impostazioni", "email"],
    ["#t-indirizzo", "impostazioni", "indirizzo"],
    ["#t-mappa", "impostazioni", "mappaUrl"],
    ["#banner-testo", "banner", "testo"],
    ["#inaug-titolo", "inaugurazione", "titolo"],
    ["#inaug-riga1", "inaugurazione", "riga1"],
    ["#inaug-riga2", "inaugurazione", "riga2"],
    ["#inaug-pulsante", "inaugurazione", "pulsante"],
    ["#m-generico", "messaggi", "generico"],
    ["#m-avvisami", "messaggi", "avvisami"],
    ["#m-prodotto", "messaggi", "prodotto"],
    ["#m-prodotto-senza", "messaggi", "prodottoSenzaTaglia"]
  ];
  var CAMPI_SPUNTA = [
    ["#banner-attivo", "banner", "attivo"],
    ["#inaug-attiva", "inaugurazione", "attiva"],
    ["#t-faq-spedizioni", "impostazioni", "faqSpedizioni"]
  ];

  function riempiTesti() {
    dati.impostazioni = dati.impostazioni || {};
    dati.banner = dati.banner || { attivo: false, testo: "", ancora: "#inaugurazione" };
    dati.inaugurazione = dati.inaugurazione || {};
    dati.messaggi = dati.messaggi || {};
    CAMPI_TESTO.forEach(function (c) { $(c[0]).value = (dati[c[1]] || {})[c[2]] || ""; });
    CAMPI_SPUNTA.forEach(function (c) { $(c[0]).checked = (dati[c[1]] || {})[c[2]] !== false; });
    contaTitolo();
  }
  function raccogliTesti() {
    CAMPI_TESTO.forEach(function (c) {
      dati[c[1]] = dati[c[1]] || {};
      dati[c[1]][c[2]] = $(c[0]).value.trim();
    });
    CAMPI_SPUNTA.forEach(function (c) {
      dati[c[1]] = dati[c[1]] || {};
      dati[c[1]][c[2]] = $(c[0]).checked;
    });
    dati.banner.ancora = dati.banner.ancora || "#inaugurazione";
  }
  function contaTitolo() {
    var n = $("#t-titolo-hero").value.length;
    $("#conta-titolo").textContent = "(" + n + " caratteri, il massimo è 65)";
    $("#conta-titolo").style.color = n > 65 ? "#a12112" : "";
  }

  $$("input, textarea, select").forEach(function (n) {
    if (n.closest("#modulo-accesso") || n.closest("#finestra")) return;
    n.addEventListener("input", function () {
      segnaSporco();
      if (n.id === "t-titolo-hero") contaTitolo();
    });
    n.addEventListener("change", segnaSporco);
  });

  $("#usa-titolo-dopo").addEventListener("click", function () {
    $("#t-titolo-hero").value = dati.impostazioni.titoloHeroDopoApertura ||
      "Scarpe e abbigliamento a Lido degli Scacchi, Comacchio";
    contaTitolo(); segnaSporco();
  });
  $("#usa-chiusura-dopo").addEventListener("click", function () {
    $("#t-chiusura").value = dati.impostazioni.titoloChiusuraStoriaDopoApertura || "Ti aspettiamo in negozio";
    segnaSporco();
  });

  /* ── categorie ───────────────────────────────────────────────────────── */
  function quantiIn(id) {
    return (dati.prodotti || []).filter(function (p) { return p.categoria === id; }).length;
  }
  function riempiCategorie() {
    var e = $("#elenco-categorie");
    e.textContent = "";
    (dati.categorie || []).forEach(function (c, i) {
      var voce = document.createElement("div");
      voce.className = "p-voce" + (c.attiva ? "" : " p-voce--spento");

      var testo = document.createElement("div");
      testo.className = "p-voce__testo";
      var campo = document.createElement("input");
      campo.type = "text";
      campo.value = c.nome;
      campo.setAttribute("aria-label", "Nome della categoria");
      campo.addEventListener("input", function () { c.nome = campo.value; segnaSporco(); riempiSceltaCategorie(); });
      var quanti = document.createElement("small");
      quanti.textContent = quantiIn(c.id) + " modelli · codice " + c.id;
      testo.appendChild(campo);
      testo.appendChild(quanti);

      var accendi = document.createElement("button");
      accendi.type = "button";
      accendi.className = "p-bottone p-bottone--piccolo";
      accendi.textContent = c.attiva ? "Spegni" : "Accendi";
      accendi.addEventListener("click", function () { c.attiva = !c.attiva; segnaSporco(); riempiCategorie(); });

      var su = document.createElement("button");
      su.type = "button"; su.className = "p-bottone p-bottone--piccolo";
      su.textContent = "↑"; su.setAttribute("aria-label", "Sposta in su");
      su.disabled = i === 0;
      su.addEventListener("click", function () {
        var a = dati.categorie;
        a.splice(i - 1, 0, a.splice(i, 1)[0]);
        segnaSporco(); riempiCategorie();
      });

      var giu = document.createElement("button");
      giu.type = "button"; giu.className = "p-bottone p-bottone--piccolo";
      giu.textContent = "↓"; giu.setAttribute("aria-label", "Sposta in giù");
      giu.disabled = i === dati.categorie.length - 1;
      giu.addEventListener("click", function () {
        var a = dati.categorie;
        a.splice(i + 1, 0, a.splice(i, 1)[0]);
        segnaSporco(); riempiCategorie();
      });

      var togli = document.createElement("button");
      togli.type = "button"; togli.className = "p-bottone p-bottone--piccolo p-bottone--male";
      togli.textContent = "Elimina";
      togli.addEventListener("click", function () {
        if (quantiIn(c.id)) { dì("Prima sposta o elimina i modelli di questa categoria.", true); return; }
        if (!confirm("Elimino la categoria «" + c.nome + "»?")) return;
        dati.categorie.splice(i, 1);
        segnaSporco(); riempiCategorie(); riempiSceltaCategorie();
      });

      voce.appendChild(testo);
      voce.appendChild(accendi);
      voce.appendChild(su);
      voce.appendChild(giu);
      voce.appendChild(togli);
      e.appendChild(voce);
    });
  }

  $("#nuova-categoria").addEventListener("click", function () {
    var nome = prompt("Come si chiama la categoria nuova?");
    if (!nome) return;
    var id = codice(nome);
    if ((dati.categorie || []).some(function (c) { return c.id === id; })) {
      dì("Una categoria con questo nome c'è già.", true); return;
    }
    dati.categorie = dati.categorie || [];
    dati.categorie.push({ id: id, nome: nome.trim(), attiva: true });
    segnaSporco(); riempiCategorie(); riempiSceltaCategorie();
  });

  function codice(testo) {
    return String(testo).toLowerCase().trim()
      .replace(/[àáâä]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i")
      .replace(/[òóôö]/g, "o").replace(/[ùúûü]/g, "u")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "voce";
  }

  function riempiSceltaCategorie() {
    [["#filtro-categoria", true], ["#f-categoria", false]].forEach(function (par) {
      var sel = $(par[0]);
      var scelto = sel.value;
      sel.textContent = "";
      if (par[1]) {
        var tutte = document.createElement("option");
        tutte.value = ""; tutte.textContent = "Tutte";
        sel.appendChild(tutte);
      }
      (dati.categorie || []).forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.nome + (c.attiva ? "" : " (spenta)");
        sel.appendChild(o);
      });
      if (scelto) sel.value = scelto;
    });
  }

  /* ── prodotti ────────────────────────────────────────────────────────── */
  function nomeCategoria(id) {
    var c = (dati.categorie || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.nome : id;
  }

  function prodottiFiltrati() {
    var cerca = $("#cerca").value.trim().toLowerCase();
    var cat = $("#filtro-categoria").value;
    var soloSpenti = $("#solo-spenti").checked;
    return (dati.prodotti || []).filter(function (p) {
      if (cat && p.categoria !== cat) return false;
      if (soloSpenti && p.attivo) return false;
      if (!cerca) return true;
      return (p.nome + " " + p.id).toLowerCase().indexOf(cerca) >= 0;
    });
  }

  function riempiProdotti() {
    var e = $("#elenco-prodotti");
    e.textContent = "";
    var lista = prodottiFiltrati();
    $("#conteggio").textContent = "(" + lista.length + " di " + (dati.prodotti || []).length + ")";
    if (!lista.length) {
      var vuoto = document.createElement("p");
      vuoto.className = "p-aiuto";
      vuoto.textContent = "Qui non c'è niente. Cambia la ricerca o aggiungi un prodotto.";
      e.appendChild(vuoto);
      return;
    }
    lista.forEach(function (p) {
      var voce = document.createElement("div");
      voce.className = "p-voce" + (p.attivo ? "" : " p-voce--spento");

      var foto = document.createElement("img");
      foto.src = fotoDi(p);
      foto.alt = "";
      foto.loading = "lazy";

      var testo = document.createElement("div");
      testo.className = "p-voce__testo";
      var b = document.createElement("b"); b.textContent = p.nome;
      var s = document.createElement("small");
      s.textContent = nomeCategoria(p.categoria) + " · " + p.id +
                      " · " + ((p.misure || []).length ? (p.misure || []).length + " misure" : "senza misure");
      testo.appendChild(b); testo.appendChild(s);

      var stato = document.createElement("span");
      stato.className = "p-etichetta" + (p.attivo ? "" : " p-etichetta--spenta");
      stato.textContent = p.attivo ? "acceso" : "spento";

      var accendi = document.createElement("button");
      accendi.type = "button"; accendi.className = "p-bottone p-bottone--piccolo";
      accendi.textContent = p.attivo ? "Spegni" : "Accendi";
      accendi.addEventListener("click", function () { p.attivo = !p.attivo; segnaSporco(); riempiProdotti(); });

      var modifica = document.createElement("button");
      modifica.type = "button"; modifica.className = "p-bottone p-bottone--piccolo p-bottone--forte";
      modifica.textContent = "Apri";
      modifica.addEventListener("click", function () { apriFinestra(p); });

      voce.appendChild(foto);
      voce.appendChild(testo);
      voce.appendChild(stato);
      voce.appendChild(accendi);
      voce.appendChild(modifica);
      e.appendChild(voce);
    });
  }

  function fotoDi(p) {
    if (p.img) return p.img.indexOf("data:") === 0 ? p.img : "../" + p.img;
    if (p.varianti && p.varianti[0]) {
      var i = p.varianti[0].img;
      return i.indexOf("data:") === 0 ? i : "../" + i;
    }
    return "../assets/img/marchio/favicon-256.png";
  }

  ["#cerca", "#filtro-categoria", "#solo-spenti"].forEach(function (s) {
    $(s).addEventListener("input", riempiProdotti);
    $(s).addEventListener("change", riempiProdotti);
  });

  $("#nuovo-prodotto").addEventListener("click", function () {
    var prima = (dati.categorie || [])[0];
    apriFinestra(null, {
      id: "", nome: "", descrizione: "", categoria: prima ? prima.id : "",
      alt: "", img: "", varianti: [], altriColori: [], misure: [],
      attivo: true, riferimento: ""
    });
  });

  /* ── finestra del prodotto ───────────────────────────────────────────── */
  var finestra = $("#finestra");
  var varianteInCarico = -1;

  function apriFinestra(prodotto, vuoto) {
    inModifica = prodotto;
    bozza = JSON.parse(JSON.stringify(prodotto || vuoto));
    bozza.varianti = bozza.varianti || [];
    $("#finestra-titolo").textContent = prodotto ? prodotto.nome : "Prodotto nuovo";
    $("#f-id").value = bozza.id || "";
    $("#f-nome").value = bozza.nome || "";
    $("#f-descrizione").value = bozza.descrizione || "";
    $("#f-alt").value = bozza.alt || "";
    $("#f-misure").value = (bozza.misure || []).join(", ");
    $("#f-altri").value = (bozza.altriColori || []).join(", ");
    $("#f-riferimento").value = bozza.riferimento || "";
    $("#f-attivo").checked = bozza.attivo !== false;
    riempiSceltaCategorie();
    $("#f-categoria").value = bozza.categoria || "";
    $("#f-elimina").hidden = !prodotto;
    $("#f-errore").hidden = true;
    disegnaVarianti();
    finestra.hidden = false;
    $("#f-nome").focus();
  }
  function chiudiFinestra() { finestra.hidden = true; inModifica = null; bozza = null; }
  $("#f-chiudi").addEventListener("click", chiudiFinestra);
  finestra.addEventListener("click", function (e) { if (e.target === finestra) chiudiFinestra(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !finestra.hidden) chiudiFinestra();
  });

  function disegnaVarianti() {
    var e = $("#f-varianti");
    e.textContent = "";
    bozza.varianti.forEach(function (v, i) {
      var riga = document.createElement("div");
      riga.className = "p-variante";

      var foto = document.createElement("img");
      foto.src = v.img && v.img.indexOf("data:") === 0 ? v.img : "../" + (v.img || "");
      foto.alt = "";

      var nome = document.createElement("input");
      nome.type = "text"; nome.value = v.colore || ""; nome.placeholder = "Nome del colore";
      nome.setAttribute("aria-label", "Nome del colore");
      nome.addEventListener("input", function () { v.colore = nome.value; });

      var cambia = document.createElement("button");
      cambia.type = "button"; cambia.className = "p-bottone p-bottone--piccolo";
      cambia.textContent = "Cambia foto";
      cambia.addEventListener("click", function () { varianteInCarico = i; $("#f-file").click(); });

      var togli = document.createElement("button");
      togli.type = "button"; togli.className = "p-bottone p-bottone--piccolo p-bottone--male";
      togli.textContent = "Togli";
      togli.addEventListener("click", function () { bozza.varianti.splice(i, 1); disegnaVarianti(); });

      riga.appendChild(foto);
      riga.appendChild(nome);
      riga.appendChild(cambia);
      riga.appendChild(togli);
      e.appendChild(riga);
    });
    if (!bozza.varianti.length) {
      var nota = document.createElement("p");
      nota.className = "p-aiuto";
      nota.textContent = "Nessuna foto. Aggiungi almeno un colore con la sua foto.";
      e.appendChild(nota);
    }
  }

  $("#f-aggiungi-variante").addEventListener("click", function () {
    bozza.varianti.push({ colore: "", img: "" });
    varianteInCarico = bozza.varianti.length - 1;
    disegnaVarianti();
    $("#f-file").click();
  });

  $("#f-file").addEventListener("change", function () {
    var f = this.files && this.files[0];
    this.value = "";
    if (!f || varianteInCarico < 0) return;
    var abito = $("#f-categoria").value === "abiti";
    riducile(f, abito ? 780 : 860, abito ? 1040 : 860).then(function (dataUri) {
      bozza.varianti[varianteInCarico].img = dataUri;
      disegnaVarianti();
    }).catch(function () { dì("Questa immagine non si riesce a leggere.", true); });
  });

  /* riduce la foto nel browser: sul deposito non finiscono file da 5 MB */
  function riducile(file, largo, alto) {
    return new Promise(function (risolvi, rifiuta) {
      var lettore = new FileReader();
      lettore.onerror = rifiuta;
      lettore.onload = function () {
        var im = new Image();
        im.onerror = rifiuta;
        im.onload = function () {
          var tela = document.createElement("canvas");
          tela.width = largo; tela.height = alto;
          var ctx = tela.getContext("2d");
          ctx.fillStyle = "#f3efec";
          ctx.fillRect(0, 0, largo, alto);
          var scala = Math.min(largo / im.width, alto / im.height);
          var w = im.width * scala, h = im.height * scala;
          ctx.drawImage(im, (largo - w) / 2, (alto - h) / 2, w, h);
          risolvi(tela.toDataURL("image/webp", 0.82));
        };
        im.src = lettore.result;
      };
      lettore.readAsDataURL(file);
    });
  }

  $("#f-conferma").addEventListener("click", function () {
    var err = $("#f-errore");
    err.hidden = true;
    bozza.id = $("#f-id").value.trim() || codice($("#f-nome").value).toUpperCase();
    bozza.nome = $("#f-nome").value.trim();
    bozza.descrizione = $("#f-descrizione").value.trim();
    bozza.categoria = $("#f-categoria").value;
    bozza.alt = $("#f-alt").value.trim() || bozza.nome;
    bozza.misure = lista($("#f-misure").value);
    bozza.altriColori = lista($("#f-altri").value);
    bozza.riferimento = $("#f-riferimento").value.trim();
    bozza.attivo = $("#f-attivo").checked;
    bozza.varianti = bozza.varianti.filter(function (v) { return v.img; });
    bozza.img = bozza.varianti.length ? bozza.varianti[0].img : bozza.img;

    if (!bozza.nome) { err.hidden = false; err.textContent = "Manca il nome del modello."; return; }
    if (!bozza.categoria) { err.hidden = false; err.textContent = "Scegli la categoria."; return; }
    if (!bozza.img) { err.hidden = false; err.textContent = "Serve almeno una foto."; return; }
    var doppio = (dati.prodotti || []).some(function (p) {
      return p !== inModifica && p.id === bozza.id;
    });
    if (doppio) { err.hidden = false; err.textContent = "Questo codice è già di un altro prodotto."; return; }

    if (inModifica) {
      var i = dati.prodotti.indexOf(inModifica);
      dati.prodotti[i] = bozza;
    } else {
      dati.prodotti = dati.prodotti || [];
      dati.prodotti.push(bozza);
    }
    chiudiFinestra();
    segnaSporco();
    riempiProdotti();
    riempiCategorie();
    dì("Modello messo a posto. Ricordati di salvare.");
  });

  $("#f-elimina").addEventListener("click", function () {
    if (!inModifica) return;
    if (!confirm("Elimino «" + inModifica.nome + "»?")) return;
    dati.prodotti.splice(dati.prodotti.indexOf(inModifica), 1);
    chiudiFinestra();
    segnaSporco();
    riempiProdotti();
    riempiCategorie();
    dì("Modello eliminato. Ricordati di salvare.");
  });

  function lista(testo) {
    return String(testo).split(",").map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length; });
  }

  /* ── avvio ───────────────────────────────────────────────────────────── */
  function riempiTutto() {
    riempiTesti();
    riempiCategorie();
    riempiSceltaCategorie();
    riempiProdotti();
  }
})();
