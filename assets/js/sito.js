/* =========================================================================
   Mezzo Metro di Tacco — versione C «Lido»
   Comportamento del sito. Nessuna libreria, nessuna chiamata a terzi.
   I contenuti arrivano dal seme incorporato nella pagina e, se il pannello
   è collegato, da /api/contenuti.
   ========================================================================= */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var fermo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── contenuti ───────────────────────────────────────────────────────── */
  var dati = {};
  try { dati = JSON.parse(($("#seme") || {}).textContent || "{}"); } catch (e) { dati = {}; }

  function imp() { return dati.impostazioni || {}; }
  function msg() { return dati.messaggi || {}; }

  function wa(testo) {
    return "https://wa.me/" + (imp().whatsapp || "393408737943") +
           "?text=" + encodeURIComponent(testo || "Ciao! Vi scrivo dal sito.");
  }
  function waChiave(chiave) {
    var predefiniti = {
      generico: "Ciao! Vi scrivo dal sito.",
      avvisami: "Ciao! Avvisatemi quando aprite, grazie."
    };
    return wa(msg()[chiave] || predefiniti[chiave] || predefiniti.generico);
  }
  function categorieAttive() {
    return (dati.categorie || []).filter(function (c) { return c.attiva; });
  }
  function prodottiAttivi() {
    var vive = {};
    categorieAttive().forEach(function (c) { vive[c.id] = 1; });
    return (dati.prodotti || []).filter(function (p) { return p.attivo && vive[p.categoria]; });
  }
  function nomeCategoria(id) {
    var c = (dati.categorie || []).filter(function (x) { return x.id === id; })[0];
    return c ? c.nome : id;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function attr(s) { return esc(s).replace(/"/g, "&quot;"); }

  /* ── scheda prodotto ─────────────────────────────────────────────────── */
  var ICONA_WA =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.42 1.31-1.96 1.36-.5.05-1.14.07-1.83-.11-.42-.11-.96-.31-1.66-.6-2.92-1.21-4.83-4.05-4.98-4.24-.14-.19-1.18-1.51-1.18-2.88 0-1.37.74-2.05 1-2.33.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.18.01.41-.06.64.47.24.55.81 1.92.88 2.06.07.14.12.3.02.49-.09.19-.14.3-.28.47-.14.16-.29.36-.42.49-.14.14-.28.29-.12.57.16.28.72 1.16 1.54 1.88 1.06.93 1.95 1.22 2.23 1.36.28.14.44.12.6-.07.17-.19.7-.8.88-1.08.19-.28.37-.23.62-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.66-.17 1.34Z"/></svg>';

  function messaggioProdotto(nome, taglia) {
    var m = msg();
    var t = taglia
      ? (m.prodotto || "Ciao! Vorrei informazioni su «{NOME MODELLO}», numero {TAGLIA}. È disponibile?")
      : (m.prodottoSenzaTaglia || "Ciao! Vorrei informazioni su «{NOME MODELLO}». È disponibile?");
    return wa(t.replace("{NOME MODELLO}", nome).replace("{TAGLIA}", taglia));
  }

  function schedaHTML(p, prefisso) {
    var abito = p.categoria === "abiti";
    var idMis = "mis-" + (prefisso || "cat") + "-" + p.id;
    var h = [];
    h.push('<article class="scheda' + (abito ? " scheda--abito" : "") +
           '" data-categoria="' + attr(p.categoria) + '" data-nome="' + attr(p.nome) + '">');

    h.push('<div class="scheda__foto">');
    h.push('<img src="' + attr(p.img) + '" alt="' + attr(p.alt || p.nome) +
           '" loading="lazy" decoding="async" width="' + (abito ? 780 : 860) +
           '" height="' + (abito ? 1040 : 860) + '">');
    h.push('<span class="scheda__timbro">' + esc(nomeCategoria(p.categoria)) + "</span>");
    h.push("</div>");

    h.push('<div class="scheda__corpo">');
    h.push('<h3 class="scheda__nome">' + esc(p.nome) + "</h3>");
    if (p.descrizione) h.push('<p class="scheda__descrizione">' + esc(p.descrizione) + "</p>");

    if (p.varianti && p.varianti.length > 1) {
      h.push('<div class="colori" role="group" aria-label="Colori del modello">');
      p.varianti.forEach(function (v, i) {
        h.push('<button type="button" class="colore" data-img="' + attr(v.img) +
               '" aria-pressed="' + (i === 0 ? "true" : "false") +
               '"><span class="solo-lettori">' + esc(v.colore) + "</span></button>");
      });
      h.push("</div>");
    } else if (p.varianti && p.varianti.length === 1) {
      h.push('<p class="colori__altri">Colore: ' + esc(p.varianti[0].colore) + "</p>");
    }
    if (p.altriColori && p.altriColori.length) {
      h.push('<p class="colori__altri">Su richiesta anche ' +
             esc(p.altriColori.join(", ").toLowerCase()) + ".</p>");
    }

    h.push('<div class="misure">');
    if (p.misure && p.misure.length) {
      h.push('<span class="misure__etichetta" id="' + attr(idMis) + '">Scegli la misura</span>');
      h.push('<div class="misure__riga" role="group" aria-labelledby="' + attr(idMis) + '">');
      p.misure.forEach(function (m) {
        h.push('<button type="button" class="misura" aria-pressed="false">' + esc(m) + "</button>");
      });
      h.push("</div>");
    } else {
      h.push('<p class="misure__nota">Chiedi la tua misura in chat</p>');
    }
    h.push("</div>");

    h.push('<div class="scheda__azione">');
    h.push('<a class="bottone bottone--primario" href="' + attr(messaggioProdotto(p.nome, "")) +
           '" target="_blank" rel="noopener">' + ICONA_WA + "Richiedi prodotto</a>");
    h.push('<p class="scheda__postilla">Ti rispondiamo su WhatsApp.</p>');
    h.push("</div></div></article>");
    return h.join("");
  }

  /* ── catalogo ────────────────────────────────────────────────────────── */
  var griglia = $("#griglia");
  var vuoto = $("#nessun-risultato");
  var filtro = $("#filtro");
  var coda = $("#coda-griglia");
  var A_BLOCCHI = Number((griglia && griglia.dataset.blocco) || 12);
  var categoriaViva = "tutto";
  var mostrate = A_BLOCCHI;

  function disegnaCatalogo() {
    if (!griglia) return;
    var lista = prodottiAttivi();
    griglia.innerHTML = lista.map(function (p) { return schedaHTML(p, "cat"); }).join("");
    vestiColori(griglia);
    if (filtro) {
      var voci = ['<button type="button" class="filtro__voce" data-cat="tutto" aria-pressed="true">Tutto</button>'];
      categorieAttive().forEach(function (c) {
        if (!lista.some(function (p) { return p.categoria === c.id; })) return;
        voci.push('<button type="button" class="filtro__voce" data-cat="' + attr(c.id) +
                  '" aria-pressed="false">' + esc(c.nome) + "</button>");
      });
      $(".filtro__lista", filtro).innerHTML = voci.join("");
    }
    applicaFiltro(categoriaViva, true);
  }

  function conteggio(cat, limite) {
    var mappa = new Map();
    var quanti = 0;
    $$(".scheda", griglia).forEach(function (c) {
      if (cat !== "tutto" && c.dataset.categoria !== cat) { mappa.set(c, false); return; }
      quanti++;
      mappa.set(c, quanti <= limite);
    });
    return { mappa: mappa, quanti: quanti };
  }

  function applicaFiltro(cat, subito) {
    if (!griglia) return;
    categoriaViva = cat;
    if (filtro) {
      $$(".filtro__voce", filtro).forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.cat === cat));
      });
    }
    var carte = $$(".scheda", griglia);
    var esito = conteggio(cat, mostrate);
    var resta = function (c) { return esito.mappa.get(c) === true; };
    if (coda) coda.hidden = esito.quanti <= mostrate;

    if (subito || fermo) {
      carte.forEach(function (c) { c.hidden = !resta(c); c.style.cssText = ""; });
      if (vuoto) vuoto.hidden = esito.quanti > 0;
      return;
    }

    var uscenti = carte.filter(function (c) { return !c.hidden && !resta(c); });
    var prima = new Map();
    carte.forEach(function (c) { if (!c.hidden) prima.set(c, c.getBoundingClientRect()); });

    uscenti.forEach(function (c) {
      c.style.transition = "opacity .14s linear, transform .14s ease-in";
      c.style.opacity = "0";
      c.style.transform = "scale(.94) rotate(-1.5deg)";
    });

    setTimeout(function () {
      carte.forEach(function (c) { c.hidden = !resta(c); });
      if (vuoto) vuoto.hidden = esito.quanti > 0;

      // FLIP: chi resta scivola al posto nuovo, chi entra rimbalza dentro
      var muovi = [];
      carte.filter(function (c) { return !c.hidden; }).forEach(function (c) {
        var dopo = c.getBoundingClientRect();
        var p = prima.get(c);
        c.style.transition = "none";
        if (p) {
          var dx = p.left - dopo.left, dy = p.top - dopo.top;
          c.style.opacity = "";
          c.style.transform = (dx || dy) ? "translate(" + dx + "px," + dy + "px)" : "";
        } else {
          c.style.opacity = "0";
          c.style.transform = "scale(.9) translateY(16px) rotate(2deg)";
        }
        muovi.push(c);
      });
      void griglia.offsetWidth;
      muovi.forEach(function (c, i) {
        c.style.transitionDelay = Math.min(i, 10) * 14 + "ms";
        c.style.transition = "transform .52s cubic-bezier(.22,.9,.3,1.28), opacity .34s ease-out";
        c.style.transform = "";
        c.style.opacity = "";
      });
      setTimeout(function () {
        muovi.forEach(function (c) { c.style.cssText = ""; });
        uscenti.forEach(function (c) { c.style.cssText = ""; });
      }, 620);
    }, 150);
  }

  if (filtro) {
    filtro.addEventListener("click", function (e) {
      var b = e.target.closest(".filtro__voce");
      if (b && b.dataset.cat !== categoriaViva) {
        mostrate = A_BLOCCHI;
        applicaFiltro(b.dataset.cat);
      }
    });
  }

  var altri = $("#vedi-altri");
  if (altri) {
    altri.addEventListener("click", function () {
      var primoNuovo = mostrate;
      mostrate += A_BLOCCHI;
      applicaFiltro(categoriaViva, true);
      var nuove = $$(".scheda", griglia).filter(function (c) { return !c.hidden; }).slice(primoNuovo);
      if (!fermo) {
        nuove.forEach(function (c, i) {
          c.style.transition = "none";
          c.style.opacity = "0";
          c.style.transform = "translateY(14px) scale(.97)";
          setTimeout(function () {
            c.style.transition = "opacity .4s ease-out, transform .5s cubic-bezier(.22,.9,.3,1.28)";
            c.style.opacity = ""; c.style.transform = "";
            setTimeout(function () { c.style.cssText = ""; }, 520);
          }, 20 + i * 28);
        });
      }
      if (nuove[0]) {
        var primo = nuove[0].querySelector("a, button");
        if (primo) primo.focus({ preventScroll: true });
      }
    });
  }

  /* la sezione «Abbigliamento donna» usa la stessa scheda del catalogo */
  var grigliaAbiti = $("#griglia-abiti");
  function disegnaAbiti() {
    if (!grigliaAbiti) return;
    var abiti = prodottiAttivi().filter(function (p) { return p.categoria === "abiti"; }).slice(0, 6);
    grigliaAbiti.innerHTML = abiti.map(function (p) { return schedaHTML(p, "abiti"); }).join("");
    vestiColori(grigliaAbiti);
    grigliaAbiti.hidden = abiti.length === 0;
  }

  /* Le pastiglie del colore prendono la foto solo quando la scheda si avvicina
     allo schermo: senza questo il catalogo chiederebbe tutte le foto in una volta. */
  var vedetta = null;
  function vestiScheda(scheda) {
    $$(".colore", scheda).forEach(function (b) {
      if (b.dataset.vestita) return;
      b.dataset.vestita = "1";
      b.style.backgroundImage = "url(" + b.dataset.img + ")";
    });
  }
  function vestiColori(contenitore) {
    if (!contenitore) return;
    if (!("IntersectionObserver" in window)) {
      $$(".scheda", contenitore).forEach(vestiScheda);
      return;
    }
    if (!vedetta) {
      vedetta = new IntersectionObserver(function (voci) {
        voci.forEach(function (v) {
          if (!v.isIntersecting) return;
          vestiScheda(v.target);
          vedetta.unobserve(v.target);
        });
      }, { rootMargin: "300px 0px" });
    }
    $$(".scheda", contenitore).forEach(function (s) { vedetta.observe(s); });
  }

  function agganciaSchede(contenitore) {
    if (!contenitore) return;
    contenitore.addEventListener("click", function (e) {
      var colore = e.target.closest(".colore");
      if (colore) {
        var scheda = colore.closest(".scheda");
        $$(".colore", scheda).forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        colore.setAttribute("aria-pressed", "true");
        $("img", scheda).src = colore.dataset.img;
        return;
      }
      var mis = e.target.closest(".misura");
      if (mis) {
        var s = mis.closest(".scheda");
        var gia = mis.getAttribute("aria-pressed") === "true";
        $$(".misura", s).forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        if (!gia) mis.setAttribute("aria-pressed", "true");
        var scelta = gia ? "" : mis.textContent.trim();
        $(".scheda__azione a", s).href = messaggioProdotto(s.dataset.nome, scelta);
      }
    });
  }
  agganciaSchede(griglia);
  agganciaSchede(grigliaAbiti);

  /* ── aiuto misura ────────────────────────────────────────────────────── */
  var aiuto = $("#aiuto-misura");
  if (aiuto) {
    var stato = { numero: "", calzata: "" };
    var anteprima = $("#aiuto-anteprima");
    var invio = $("#aiuto-invio");

    function testoAiuto() {
      if (!stato.numero) return "Ciao! Non so che numero prendere: mi aiutate?";
      var calzata = stato.calzata || "giusta";
      return "Ciao! Di solito porto il " + stato.numero + " e mi sta " + calzata +
             ": che misura mi conviene ordinare?";
    }
    function aggiornaAiuto() {
      if (anteprima) anteprima.textContent = testoAiuto();
      if (invio) invio.href = wa(testoAiuto());
    }
    aiuto.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-campo]");
      if (!b) return;
      var gruppo = b.closest("[data-gruppo]");
      var gia = b.getAttribute("aria-pressed") === "true";
      $$("button[data-campo]", gruppo).forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      b.setAttribute("aria-pressed", String(!gia));
      stato[b.dataset.campo] = gia ? "" : b.dataset.valore;
      aggiornaAiuto();
    });
    aggiornaAiuto();
  }

  /* ── vetrina «Scarpe italiane» ───────────────────────────────────────── */
  function riempiVetrina() {
    var v = $("#vetrina");
    if (!v) return;
    var scelti = prodottiAttivi().filter(function (p) {
      return p.categoria !== "abiti";
    }).slice(0, 10);
    v.innerHTML = scelti.map(function (p) {
      return '<li class="vetrina__voce"><img src="' + attr(p.img) + '" alt="' + attr(p.alt || p.nome) +
             '" loading="lazy" decoding="async" width="860" height="860"><span>' +
             esc(p.nome) + "</span></li>";
    }).join("");
  }

  /* ── testi che vivono nel pannello ───────────────────────────────────── */
  function applicaContenuti() {
    var i = imp();
    $$("[data-testo]").forEach(function (n) {
      var v = i[n.dataset.testo];
      if (v) n.textContent = v;
    });
    $$("[data-wa]").forEach(function (a) { a.href = waChiave(a.dataset.wa); });
    $$("[data-recapito]").forEach(function (n) {
      var v = i[n.dataset.recapito];
      if (!v) return;
      n.textContent = v;
      if (n.tagName === "A" && n.dataset.recapito === "email") n.href = "mailto:" + v;
      if (n.tagName === "A" && n.dataset.recapito === "whatsappVisibile") n.href = waChiave("generico");
    });
    $$("[data-mappa]").forEach(function (a) { if (i.mappaUrl) a.href = i.mappaUrl; });

    /* banner in cima */
    var ann = $("#annuncio");
    if (ann) {
      var b = dati.banner || {};
      var attivo = b.attivo !== false && !!b.testo;
      ann.hidden = !attivo;
      if (attivo) {
        var dentro = $("[data-annuncio]", ann);
        if (dentro) {
          dentro.textContent = b.testo;
          if (dentro.tagName === "A") dentro.href = b.ancora || "#inaugurazione";
        }
      }
    }

    /* sezione inaugurazione */
    var inaug = dati.inaugurazione || {};
    var sez = $("#inaugurazione");
    if (sez) {
      var accesa = inaug.attiva !== false;
      sez.hidden = !accesa;
      var ondaSopra = $("#onda-inaugurazione-sopra");
      var ondaSotto = $("#onda-inaugurazione-sotto");
      if (ondaSopra) ondaSopra.hidden = !accesa;
      if (ondaSotto) ondaSotto.hidden = !accesa;
      if (accesa) {
        if (inaug.titolo) $("[data-inaug='titolo']", sez).textContent = inaug.titolo;
        if (inaug.riga1) $("[data-inaug='riga1']", sez).textContent = inaug.riga1;
        if (inaug.riga2) $("[data-inaug='riga2']", sez).textContent = inaug.riga2;
        var puls = $("[data-inaug='pulsante']", sez);
        if (puls && inaug.pulsante) puls.lastChild.nodeValue = inaug.pulsante;
      }
      $$('a[href="#inaugurazione"]').forEach(function (a) {
        if (a.closest("#annuncio")) return;
        a.hidden = !accesa;
      });
    }

    /* domanda sulle spedizioni: si toglie dall'interruttore del pannello */
    var spedizioni = $("#faq-spedizioni");
    if (spedizioni) spedizioni.hidden = i.faqSpedizioni === false;
  }

  /* ── scorrimento: testata, barra, comparse ───────────────────────────── */
  var testata = $(".testata");
  var barra = $(".barra-telefono");
  var inCoda = false;
  function suScroll() {
    var y = window.scrollY || 0;
    if (testata) testata.classList.toggle("staccata", y > 8);
    if (barra) barra.classList.toggle("visibile", y > 460);
    recuperaRivela();
    inCoda = false;
  }
  function chiediScroll() { if (!inCoda) { inCoda = true; requestAnimationFrame(suScroll); } }
  window.addEventListener("scroll", chiediScroll, { passive: true });

  var recuperaRivela = function () {};
  function attivaRivela() {
    var da = $$(".rivela");
    if (fermo || !("IntersectionObserver" in window)) {
      da.forEach(function (n) { n.classList.add("dentro"); });
      return;
    }
    var os = new IntersectionObserver(function (voci) {
      voci.forEach(function (v) {
        if (v.isIntersecting) { v.target.classList.add("dentro"); os.unobserve(v.target); }
      });
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.05 });
    da.forEach(function (n) { os.observe(n); });

    // Rete di sicurezza. In una scheda in secondo piano, in un'anteprima o in una
    // pagina precaricata l'osservatore può non partire: senza questo controllo
    // resterebbero blocchi invisibili. A pagina visibile non tocca niente.
    var restano = da.length;
    recuperaRivela = function () {
      if (!restano) return;
      var alto = window.innerHeight * 1.06;
      restano = 0;
      da.forEach(function (n) {
        if (n.classList.contains("dentro")) return;
        if (n.getBoundingClientRect().top < alto) { n.classList.add("dentro"); os.unobserve(n); }
        else restano++;
      });
    };
    setTimeout(recuperaRivela, 700);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) setTimeout(recuperaRivela, 60);
    });
  }

  /* ── menu da telefono ────────────────────────────────────────────────── */
  var nav = $("#navigazione");
  var apri = $("#menu-apri");
  var chiudi = $("#menu-chiudi");
  function menu(stato) {
    if (!nav) return;
    nav.classList.toggle("aperta", stato);
    if (apri) apri.setAttribute("aria-expanded", String(stato));
    document.documentElement.style.overflow = stato ? "hidden" : "";
    if (stato) { var p = $("a", nav); if (p) p.focus(); }
  }
  if (apri) apri.addEventListener("click", function () { menu(true); });
  if (chiudi) chiudi.addEventListener("click", function () { menu(false); });
  if (nav) nav.addEventListener("click", function (e) { if (e.target.closest("a")) menu(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav && nav.classList.contains("aperta")) { menu(false); if (apri) apri.focus(); }
  });

  /* ── fisarmonica delle domande ───────────────────────────────────────── */
  $$(".domanda__testa").forEach(function (t) {
    t.addEventListener("click", function () {
      var corpo = document.getElementById(t.getAttribute("aria-controls"));
      var aperto = t.getAttribute("aria-expanded") === "true";
      t.setAttribute("aria-expanded", String(!aperto));
      if (!corpo) return;
      if (fermo) { corpo.style.height = aperto ? "0px" : "auto"; return; }
      if (aperto) {
        corpo.style.height = corpo.scrollHeight + "px";
        requestAnimationFrame(function () { corpo.style.height = "0px"; });
      } else {
        corpo.style.height = corpo.scrollHeight + "px";
        corpo.addEventListener("transitionend", function fine() {
          corpo.style.height = "auto";
          corpo.removeEventListener("transitionend", fine);
        });
      }
    });
  });

  /* ── banner cookie ───────────────────────────────────────────────────── */
  var cookie = $("#cookie");
  function altezzaCookie() {
    document.documentElement.style.setProperty(
      "--barra-cookie", cookie && cookie.isConnected ? cookie.offsetHeight + "px" : "0px");
  }
  if (cookie) {
    var visto = false;
    try { visto = localStorage.getItem("mmt-cookie") === "1"; } catch (e) {}
    if (visto) { cookie.remove(); altezzaCookie(); }
    else {
      cookie.hidden = false;
      altezzaCookie();
      window.addEventListener("resize", altezzaCookie, { passive: true });
      var chiudiCookie = $(".cookie-bar__x", cookie);
      if (chiudiCookie) chiudiCookie.addEventListener("click", function () {
        cookie.remove();
        altezzaCookie();
        try { localStorage.setItem("mmt-cookie", "1"); } catch (e) {}
      });
    }
  }

  /* ── categoria richiesta dall'indirizzo o da un collegamento ─────────── */
  function categoriaDaIndirizzo() {
    var q = new URLSearchParams(window.location.search).get("categoria");
    if (!q) return null;
    return categorieAttive().some(function (c) { return c.id === q; }) ? q : null;
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-vai-categoria]");
    if (!a || !griglia) return;
    var cat = a.dataset.vaiCategoria;
    if (!categorieAttive().some(function (c) { return c.id === cat; })) return;
    mostrate = A_BLOCCHI;
    applicaFiltro(cat, true);
  });

  /* ── il righello del blocco «il nome» ────────────────────────────────── */
  function disegnaTacche() {
    var t = $("#metro-tacche");
    if (!t) return;
    t.textContent = "";
    for (var c = 0; c <= 50; c++) {
      var tacca = document.createElement("i");
      tacca.style.left = (c / 50 * 100) + "%";
      tacca.style.height = (c % 5 === 0 ? 20 : 10) + "px";
      t.appendChild(tacca);
    }
  }

  /* ── contenuti dal vivo, se il pannello è collegato ──────────────────── */
  function aggiornaDalPannello() {
    if (!window.fetch) return;
    fetch("/api/contenuti", { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok && r.status !== 204 ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.prodotti || d.versione === dati.versione) return;
        dati = d;
        applicaContenuti();
        disegnaCatalogo();
        disegnaAbiti();
        riempiVetrina();
        var cat = categoriaDaIndirizzo();
        if (cat) applicaFiltro(cat, true);
      })
      .catch(function () { /* il sito funziona anche da solo */ });
  }

  /* ── avvio ───────────────────────────────────────────────────────────── */
  applicaContenuti();
  disegnaCatalogo();
  disegnaAbiti();
  riempiVetrina();
  disegnaTacche();
  var catIniziale = categoriaDaIndirizzo();
  if (catIniziale) applicaFiltro(catIniziale, true);
  attivaRivela();
  suScroll();
  aggiornaDalPannello();
})();
