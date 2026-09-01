/* =========================================================================
   Mezzo Metro di Tacco — funzioni del sito (Cloudflare Pages, modo avanzato)

   Tutto quello che non comincia per /api/ è un file statico e passa liscio.
   /api/ serve solo al pannello:
     POST /api/accesso    { chiave }      → apre la sessione (cookie firmato)
     POST /api/uscita                     → chiude la sessione
     GET  /api/stato                      → dice se la sessione è aperta
     GET  /api/contenuti                  → i contenuti salvati (404 se non ce ne sono)
     PUT  /api/contenuti  { ...contenuti} → salva (serve la sessione)

   Variabili da impostare su Cloudflare:
     PANNELLO_CHIAVE   la parola d'accesso al pannello
     PANNELLO_SEGRETO  una stringa lunga a caso, per firmare il cookie
   Deposito da collegare:
     CONTENUTI         spazio KV
   ========================================================================= */

const CHIAVE_KV = "contenuti";
const DURATA = 60 * 60 * 12;          // dodici ore
const NOME_COOKIE = "mmt_sessione";
const LIMITE = 20 * 1024 * 1024;      // 20 MB: le foto caricate dal pannello stanno qui dentro

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(request, env, url);
      } catch (e) {
        return json({ errore: "Errore del server: " + e.message }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};

async function api(request, env, url) {
  const rotta = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  const metodo = request.method.toUpperCase();

  if (metodo === "OPTIONS") return new Response(null, { status: 204 });

  if (rotta === "accesso" && metodo === "POST") {
    const atteso = env.PANNELLO_CHIAVE;
    if (!atteso) return json({ errore: "Il pannello non è ancora configurato: manca PANNELLO_CHIAVE." }, 503);
    const corpo = await leggiJson(request);
    if (!corpo || !confronta(String(corpo.chiave || ""), atteso)) {
      await new Promise((r) => setTimeout(r, 600));       // rallenta i tentativi a raffica
      return json({ errore: "Parola d'accesso sbagliata." }, 401);
    }
    const gettone = await firma(env, Math.floor(Date.now() / 1000) + DURATA);
    return json({ ok: true }, 200, {
      "set-cookie": `${NOME_COOKIE}=${gettone}; Path=/; Max-Age=${DURATA}; HttpOnly; Secure; SameSite=Strict`,
    });
  }

  if (rotta === "uscita" && metodo === "POST") {
    return json({ ok: true }, 200, {
      "set-cookie": `${NOME_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
    });
  }

  if (rotta === "stato" && metodo === "GET") {
    return json({
      dentro: await sessioneValida(request, env),
      deposito: Boolean(env.CONTENUTI),
      configurato: Boolean(env.PANNELLO_CHIAVE && env.PANNELLO_SEGRETO),
    });
  }

  if (rotta === "contenuti") {
    if (metodo === "GET") {
      // 204 e non 404: il sito funziona benissimo col seme incorporato,
      // e non deve stampare un errore in console per una cosa normale.
      if (!env.CONTENUTI) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      const salvato = await env.CONTENUTI.get(CHIAVE_KV);
      if (!salvato) return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      return new Response(salvato, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (metodo === "PUT") {
      if (!(await sessioneValida(request, env))) return json({ errore: "Sessione scaduta. Rientra nel pannello." }, 401);
      if (!env.CONTENUTI) return json({ errore: "Nessun deposito collegato: collega lo spazio KV «CONTENUTI»." }, 503);
      const testo = await request.text();
      if (testo.length > LIMITE) return json({ errore: "Contenuti troppo pesanti. Alleggerisci le foto." }, 413);
      let dati;
      try { dati = JSON.parse(testo); } catch (e) { return json({ errore: "Contenuti illeggibili." }, 400); }
      const guaio = controlla(dati);
      if (guaio) return json({ errore: guaio }, 400);
      dati.versione = Number(dati.versione || 0) + 1;
      dati.aggiornato = new Date().toISOString().slice(0, 10);
      await env.CONTENUTI.put(CHIAVE_KV, JSON.stringify(dati));
      return json({ ok: true, versione: dati.versione, aggiornato: dati.aggiornato });
    }
  }

  return json({ errore: "Non esiste." }, 404);
}

/* ── controlli minimi sulla forma dei contenuti ───────────────────────── */
function controlla(d) {
  if (!d || typeof d !== "object") return "Contenuti vuoti.";
  if (!Array.isArray(d.prodotti)) return "Manca l'elenco dei prodotti.";
  if (!Array.isArray(d.categorie)) return "Manca l'elenco delle categorie.";
  if (!d.impostazioni || typeof d.impostazioni !== "object") return "Mancano le impostazioni.";
  const num = String(d.impostazioni.whatsapp || "");
  if (!/^\d{8,15}$/.test(num)) return "Il numero WhatsApp va scritto solo con le cifre, per esempio 393408737943.";
  for (const p of d.prodotti) {
    if (!p.id || !p.nome) return "Ogni prodotto deve avere un codice e un nome.";
    if (!p.categoria) return `Al prodotto «${p.nome}» manca la categoria.`;
  }
  return null;
}

/* ── firma del cookie ─────────────────────────────────────────────────── */
async function chiaveHmac(env) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.PANNELLO_SEGRETO || "segreto-non-impostato"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
async function firma(env, scadenza) {
  const k = await chiaveHmac(env);
  const f = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(String(scadenza)));
  return scadenza + "." + b64(f);
}
async function sessioneValida(request, env) {
  if (!env.PANNELLO_SEGRETO) return false;
  const cookie = request.headers.get("cookie") || "";
  const trovato = cookie.match(new RegExp("(?:^|;\\s*)" + NOME_COOKIE + "=([^;]+)"));
  if (!trovato) return false;
  const [scadenza, sigla] = decodeURIComponent(trovato[1]).split(".");
  if (!scadenza || !sigla) return false;
  if (Number(scadenza) < Math.floor(Date.now() / 1000)) return false;
  const atteso = await firma(env, Number(scadenza));
  return confronta(atteso, scadenza + "." + sigla);
}
function b64(buf) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function confronta(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ── utilità ──────────────────────────────────────────────────────────── */
async function leggiJson(request) {
  try { return await request.json(); } catch (e) { return null; }
}
function json(corpo, stato = 200, testate = {}) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: Object.assign(
      { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      testate
    ),
  });
}
