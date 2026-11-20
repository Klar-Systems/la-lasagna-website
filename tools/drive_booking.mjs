#!/usr/bin/env node
/* Drives the real booking form on contact.html (klar-embed.js, mounted and
 * re-mounted by js/lala-klar.js) in headless Chrome, with the Klar API faked
 * inside the page, and checks what a guest sees.
 *
 *   node tools/drive_booking.mjs                      the files on disk
 *   node tools/drive_booking.mjs --rev origin/main    every file served from that commit
 *   node tools/drive_booking.mjs --only 09            cases whose name contains "09"
 *
 * Exit 0 = every case holds, 1 = a case failed, 2 = it could not run (no
 * Chrome). Chrome: $CHROME, else Playwright's headless shell.
 *
 * NOTHING LEAVES THE MACHINE. The site is served from 127.0.0.1 by this
 * process; window.fetch is replaced before any page script runs, so every call
 * to the booking API is answered by the case's own fake; and every other
 * request the browser tries (fonts, the map, analytics) is refused at the
 * network layer and counted. No real venue is asked anything.
 *
 * Takes about a minute and a half: two cases wait out the form's real
 * 20-second booking deadline and one its 12-second availability deadline. */
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(join(dirname(new URL(import.meta.url).pathname), ".."));
const argv = process.argv.slice(2);
const rev = argv.includes("--rev") ? argv[argv.indexOf("--rev") + 1] : null;
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
const CHROME =
  process.env.CHROME ||
  join(process.env.HOME || "", "Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell");
if (!existsSync(CHROME)) {
  console.log(`DID NOT RUN  no Chrome at ${CHROME} (set CHROME=/path/to/chrome)`);
  process.exit(2);
}

/* ---- the site, from disk or from a commit ---- */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const cache = new Map();
function readSite(rel) {
  if (cache.has(rel)) return cache.get(rel);
  let buf = null;
  if (rev) {
    try { buf = execFileSync("git", ["-C", root, "show", `${rev}:${rel}`], { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 }); }
    catch { buf = null; }
  } else {
    const p = join(root, rel);
    if (existsSync(p) && statSync(p).isFile()) buf = readFileSync(p);
  }
  cache.set(rel, buf);
  return buf;
}
const server = createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  let buf = readSite(rel);
  if (!buf && !extname(rel)) { rel += ".html"; buf = readSite(rel); }
  if (!buf) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[extname(rel)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(buf);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* ---- Chrome, killed by its own pid whatever happens ---- */
const profile = mkdtempSync(join(tmpdir(), "lala-drive-"));
const chrome = spawn(CHROME, [
  "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
  "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-default-apps",
  "--disable-domain-reliability", "--window-size=1280,2000", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { process.kill(chrome.pid, "SIGKILL"); } catch {}
  try { server.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(130); });

const wsBrowser = await new Promise((resolveWs, reject) => {
  let err = "";
  const t = setTimeout(() => reject(new Error("Chrome did not start: " + err)), 15000);
  chrome.stderr.on("data", (d) => {
    err += d;
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(err);
    if (m) { clearTimeout(t); resolveWs(m[1]); }
  });
});
const debugPort = new URL(wsBrowser).port;
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const pageTarget = targets.find((x) => x.type === "page");
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { ok, fail } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
  } else if (msg.method) listeners.forEach((l) => l(msg));
});
const cdp = (method, params = {}) =>
  new Promise((ok, fail) => { const id = ++nextId; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })); });

let blocked = [];
let pageErrors = [];
listeners.push((m) => {
  if (m.method === "Fetch.requestPaused") {
    const url = m.params.request.url;
    if (url.startsWith(ORIGIN + "/")) cdp("Fetch.continueRequest", { requestId: m.params.requestId }).catch(() => {});
    else { blocked.push(url); cdp("Fetch.failRequest", { requestId: m.params.requestId, errorReason: "BlockedByClient" }).catch(() => {}); }
  }
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    pageErrors.push((d.exception && d.exception.description) || d.text);
  }
});
await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Fetch.enable", { patterns: [{ urlPattern: "*" }] });

/* ---- the fake API, installed in the page before its own scripts ---- */
function stubSource(cfg) {
  return `(function(){
  var cfg = ${JSON.stringify(cfg)};
  try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
  Object.keys(cfg.storage || {}).forEach(function(k){ localStorage.setItem(k, cfg.storage[k]); });
  window.__calls = [];
  window.__api = cfg.api || {};
  function route(url){ var m = /\\/api\\/[^/?]+\\/([a-z-]+)/.exec(String(url)); return m ? m[1] : null; }
  window.fetch = function(url, opts){
    opts = opts || {};
    var r = route(url), body = null;
    try { body = opts.body ? JSON.parse(opts.body) : null; } catch (e) { body = opts.body; }
    window.__calls.push({ route: r, url: String(url), method: opts.method || 'GET', body: body });
    if(!r) return Promise.reject(new TypeError('Failed to fetch'));
    if(r === 'widget-events') return Promise.resolve(new Response('{}', { status: 200 }));
    var q = window.__api[r] || [], spec = null;
    for(var i = 0; i < q.length; i++){
      if(!q[i].when || String(url).indexOf(q[i].when) !== -1){ spec = q[i]; if(spec.once) q.splice(i, 1); break; }
    }
    spec = spec || { status: 500, body: { error: 'no fake for ' + r } };
    return new Promise(function(resolve, reject){
      var done = false;
      function abort(){ if(!done){ done = true; reject(new DOMException('The operation was aborted.', 'AbortError')); } }
      if(opts.signal){ if(opts.signal.aborted) return abort(); opts.signal.addEventListener('abort', abort); }
      if(spec.hang) return;
      setTimeout(function(){
        if(done) return;
        done = true;
        if(spec.network) return reject(new TypeError('Failed to fetch'));
        var text = typeof spec.body === 'string' ? spec.body : JSON.stringify(spec.body || {});
        resolve(new Response(text, { status: spec.status || 200, headers: { 'Content-Type': spec.type || 'application/json' } }));
      }, spec.delay || 0);
    });
  };
})();`;
}
let scriptId = null;
async function open(path, cfg) {
  if (scriptId) await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId });
  scriptId = (await cdp("Page.addScriptToEvaluateOnNewDocument", { source: stubSource(cfg) })).identifier;
  pageErrors = [];
  await cdp("Page.navigate", { url: ORIGIN + path });
  await waitFor("document.readyState === 'complete'", 15000);
}
async function js(expr) {
  const r = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error("in page: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function waitFor(expr, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    let v = false;
    try { v = await js(expr); } catch {}
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for: ${expr}`);
    await new Promise((r) => setTimeout(r, 60));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- fixtures ---- */
const helsinki = (plus = 0) => {
  const d = new Date(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" }) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + plus);
  return d.toISOString().slice(0, 10);
};
const slotsAt = (...times) => times.map((time) => ({ time, available: true, remaining: 3 }));
const avail = (extra = {}, more = {}) => ({ status: 200, body: { restaurant: "Test", slots: slotsAt("18:00", "20:00"), booking_horizon_days: 180, ...extra }, ...more });
const booked = { status: 201, body: { booking: { id: "b1", date: helsinki(3), time_slot: "20:00", party_size: 2 }, email_sent: true } };

const M = "#klar-book";
const q = (sel) => `${M} ${sel}`;
const visible = (sel) => `(function(){ var e = document.querySelector(${JSON.stringify(sel)}); if(!e) return false;
  var s = getComputedStyle(e); return !e.hidden && s.display !== 'none' && e.getClientRects().length > 0; })()`;
const text = (sel) => `(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`;
const value = (sel) => `(document.querySelector(${JSON.stringify(sel)}) || {}).value`;
const setValue = (sel, v) => js(`(function(){ var e = document.querySelector(${JSON.stringify(sel)});
  e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
const click = (sel) => js(`(function(){ var e = document.querySelector(${JSON.stringify(sel)}); if(!e) throw new Error('nothing at ' + ${JSON.stringify(sel)}); e.click(); return true; })()`);
const calls = (route) => js(`window.__calls.filter(function(c){ return c.route === ${JSON.stringify(route)}; })`);
const start = () => js(`(function(){ var m = document.querySelector('${M}'); if(m && m.klarStart) m.klarStart(); return !!(m && m.klarStart); })()`);
const anySlot = q("button[data-klar-slot]");

async function openForm(cfg) {
  await open("/contact.html", cfg);
  await waitFor(`!!document.querySelector('${M}') && typeof document.querySelector('${M}').klarStart === 'function'`, 10000);
  await start();
}
async function pickDate(iso) {
  await setValue(q('[data-klar="date"]'), iso);
}
async function fill() {
  await waitFor(`!!document.querySelector('${anySlot}:not([disabled])')`);
  await click(`${anySlot}:not([disabled])`);
  await setValue(q('[data-klar="bname"]'), "Test Guest");
  await setValue(q('[data-klar="bphone"]'), "040 123 4567");
  await setValue(q('[data-klar="bemail"]'), "guest@example.invalid");
}
async function book() {
  await click(q('[data-klar="book-submit"]'));
}
const errText = () => js(text(q('[data-klar="book-err"]')));
const FINNISH = /[äö]|Tämä|Tällä|Virheellinen|Tarkista tiedot/;

const cases = [];
cases.push(["WIDGET-04 the picker reaches the venue's 180 days, and a later date is refused with the reason", async () => {
  await openForm({ api: { availability: [avail()] } });
  await waitFor(`!!document.querySelector('${anySlot}')`);
  const max = await js(`document.querySelector('${q('[data-klar="date"]')}').max`);
  if (max !== helsinki(180)) throw new Error(`the date picker stops at ${max}; the venue takes ${helsinki(180)}`);
  await pickDate(helsinki(200));
  await sleep(400);
  const s = await js(text(q('[data-klar="slots"]')));
  if (s.indexOf("180 days") === -1) throw new Error(`200 days out: "${s}"`);
}]);
cases.push(["WIDGET-08 the English form prints no Finnish refusal", async () => {
  const want = [
    [{ status: 409, body: { error: "Tämä aika on juuri varattu. Valitse toinen aika.", code: "SLOT_TAKEN" } }, "just taken"],
    [{ status: 409, body: { error: "Tämä aika on täynnä" } }, "just taken"],
    [{ status: 400, body: { error: "Tarkista tiedot", code: "VALIDATION_ERROR", fields: { guest_phone: "Virheellinen puhelinnumero" } } }, "Check the phone number"],
    [{ status: 409, body: { error: "Tällä puhelinnumerolla on jo varaus tälle päivälle. Soita ravintolaan, jos haluat muuttaa sitä.", code: "DUPLICATE_BOOKING" } }, "already has a booking"],
    [{ status: 400, body: { error: "Keittiö sulkeutuu 21:30 — sen jälkeen ei voi varata pöytää", code: "VALIDATION_ERROR" } }, "can no longer be booked online"],
    [{ status: 403, body: { error: "Varausta ei voitu tehdä verkossa. Ota yhteyttä suoraan ravintolaan.", code: "BOOKING_REFUSED" } }, "cannot be made online"],
    [{ status: 429, body: { error: "Tähän osoitteeseen on juuri lähetetty vahvistuslinkki. Tarkista sähköpostisi.", code: "RATE_LIMITED" } }, "confirmation link was just sent"],
  ];
  const wrong = [];
  for (const [answer, words] of want) {
    await openForm({ api: { availability: [avail()], book: [answer] } });
    await fill();
    await book();
    await waitFor(visible(q('[data-klar="book-err"]')));
    const e = await errText();
    if (e.indexOf(words) === -1 || FINNISH.test(e)) wrong.push(`${answer.body.code || "no code"} ${answer.status}: "${e}"`);
  }
  if (wrong.length) throw new Error(wrong.join("\n      "));
}]);
cases.push(["WIDGET-09 a booking call that never answers gives the button back after 20 s and says to check the email", async () => {
  await openForm({ api: { availability: [avail()], book: [{ hang: true }] } });
  await fill();
  await book();
  await sleep(21500);
  const btn = await js(`(function(){ var b = document.querySelector('${q('[data-klar="book-submit"]')}'); return { disabled: b.disabled, text: b.textContent }; })()`);
  if (btn.disabled) throw new Error(`after 21.5 s the button is still disabled, reading "${btn.text}"`);
  const e = await errText();
  if (e.indexOf("Check your email") === -1) throw new Error(`after the deadline: "${e}"`);
}]);
cases.push(["WIDGET-09 a 2xx with no booking in it is not 'Table booked'", async () => {
  await openForm({ api: { availability: [avail()], book: [{ status: 200, type: "text/html", body: "<html>Welcome to the hotel Wi-Fi</html>" }] } });
  await fill();
  await book();
  await sleep(800);
  const ok = await js(text(q('[data-klar="book-ok"]')));
  if (/Table booked/.test(ok)) throw new Error(`a captive-portal 200 showed "${ok.slice(0, 80)}"`);
  const e = await errText();
  if (e.indexOf("do not know whether your booking arrived") === -1) throw new Error(`the guest was told: "${e}"`);
}]);
cases.push(["WIDGET-09 any 202 is 'check your email, there is no booking yet', never 'Table booked'", async () => {
  await openForm({ api: { availability: [avail()], book: [{ status: 202, body: {} }] } });
  await fill();
  await book();
  await waitFor(visible(q('[data-klar="book-ok"]')));
  const ok = await js(text(q('[data-klar="book-ok"]')));
  if (/Table booked/.test(ok) || ok.indexOf("no booking yet") === -1) throw new Error(`a 202 showed: "${ok.slice(0, 120)}"`);
}]);
cases.push(["WIDGET-10 the booking says which language it was made in, and follows the switch", async () => {
  await openForm({ api: { availability: [avail()], book: [booked] } });
  await fill();
  await book();
  await waitFor(`window.__calls.some(function(c){ return c.route === 'book'; })`);
  let [b] = await calls("book");
  if (b.body.language !== "en") throw new Error(`English form sent language ${JSON.stringify(b.body.language)}`);
  await openForm({ api: { availability: [avail()], book: [booked] } });
  await click('.lala-lang-opt[data-lang="fi"]');
  await waitFor(`document.querySelector('${M}') && document.querySelector('${M}').getAttribute('data-klar-locale') === 'fi' && document.querySelector('${M}').dataset.klarMounted === '1'`);
  await start();
  await fill();
  await book();
  await waitFor(`window.__calls.some(function(c){ return c.route === 'book'; })`);
  [b] = await calls("book");
  if (b.body.language !== "fi") throw new Error(`Finnish form sent language ${JSON.stringify(b.body.language)}`);
}]);
cases.push(["WIDGET-15 a late answer for the date the guest left does not overwrite the date they picked", async () => {
  const A = helsinki(3), B = helsinki(4);
  await openForm({ api: { availability: [
    avail({ slots: slotsAt("18:00") }, { when: `date=${A}`, delay: 1500 }),
    avail({ slots: slotsAt("20:30") }, { when: `date=${B}` }),
    avail(),
  ] } });
  await waitFor(`!!document.querySelector('${anySlot}')`);
  await pickDate(A);
  await sleep(100);
  await pickDate(B);
  await sleep(2200);
  const shown = await js(`[].map.call(document.querySelectorAll('${anySlot}'), function(b){ return b.textContent; }).join(',')`);
  if (shown !== "20:30") throw new Error(`the date reads ${await js(value(q('[data-klar="date"]')))} and the grid shows ${shown || "nothing"}`);
}]);
cases.push(["WIDGET-15 an availability call that never answers ends in a sentence, not 'Looking for free times…' for ever", async () => {
  await openForm({ api: { availability: [{ hang: true }] } });
  await sleep(13500);
  const s = await js(text(q('[data-klar="slots"]')));
  if (/Looking for free times/.test(s)) throw new Error(`after 13.5 s: "${s}"`);
}]);
cases.push(["WIDGET-15 a time chosen, then two quick changes, is still chosen when it is still free", async () => {
  await openForm({ api: { availability: [avail({}, { delay: 600 })] } });
  await waitFor(`!!document.querySelector('${anySlot}')`);
  await click(`${anySlot}[data-klar-slot="20:00"]`);
  await pickDate(helsinki(2));
  await sleep(50);
  await setValue(q('[data-klar="party"]'), "4");
  await sleep(1500);
  const on = await js(`(document.querySelector('${anySlot}.klar-on') || {}).textContent || ''`);
  if (on !== "20:00") throw new Error(`the guest's 20:00 is ${on ? "now " + on : "gone, with nothing said"}`);
}]);
cases.push(["WIDGET-16 the opening search does not move a date the guest has just picked", async () => {
  const today = helsinki(0);
  await openForm({ api: { availability: [
    avail({ slots: [] }, { when: `date=${today}`, delay: 1200 }),
    avail(),
  ] } });
  await pickDate(helsinki(5));
  await sleep(2000);
  const d = await js(value(q('[data-klar="date"]')));
  if (d !== helsinki(5)) throw new Error(`the guest picked ${helsinki(5)}; the field now reads ${d}`);
}]);
cases.push(["WIDGET-07 today with every time gone, and a party bigger than the room, are not 'closed on this day'", async () => {
  await openForm({ api: { availability: [avail({ slots: [] }, { when: "party_size=2" }), avail({ slots: [], party_too_large: true, max_party_size: 16 })] } });
  await sleep(300);
  await pickDate(helsinki(0));
  await sleep(600);
  let s = await js(text(q('[data-klar="slots"]')));
  if (s.indexOf("no more times to book online today") === -1) throw new Error(`today, no times left: "${s}"`);
  await setValue(q('[data-klar="party"]'), "18");
  await sleep(600);
  s = await js(text(q('[data-klar="slots"]')));
  if (s.indexOf("cannot be booked online") === -1) throw new Error(`a party of 18 in a 16-seat room: "${s}"`);
}]);
cases.push(["WIDGET-17 switching to Finnish keeps the date, the party, the time and what was typed", async () => {
  await openForm({ api: { availability: [avail()] } });
  await waitFor(`!!document.querySelector('${anySlot}')`);
  await pickDate(helsinki(3));
  await waitFor(`!!document.querySelector('${anySlot}[data-klar-slot="20:00"]')`);
  await setValue(q('[data-klar="party"]'), "4");
  await waitFor(`!!document.querySelector('${anySlot}[data-klar-slot="20:00"]')`);
  await click(`${anySlot}[data-klar-slot="20:00"]`);
  await setValue(q('[data-klar="bname"]'), "Test Guest");
  await setValue(q('[data-klar="bphone"]'), "040 123 4567");
  await setValue(q('[data-klar="bemail"]'), "guest@example.invalid");
  await click('.lala-lang-opt[data-lang="fi"]');
  await waitFor(`document.querySelector('${M}').getAttribute('data-klar-locale') === 'fi' && document.querySelector('${M}').dataset.klarMounted === '1'`);
  await waitFor(`!!document.querySelector('${anySlot}')`);
  await sleep(300);
  const got = await js(`({ date: ${value(q('[data-klar="date"]'))}, party: ${value(q('[data-klar="party"]'))},
    slot: (document.querySelector('${anySlot}.klar-on') || {}).textContent || '', name: ${value(q('[data-klar="bname"]'))},
    phone: ${value(q('[data-klar="bphone"]'))}, email: ${value(q('[data-klar="bemail"]'))},
    button: ${text(q('[data-klar="book-submit"]'))} })`);
  const want = { date: helsinki(3), party: "4", slot: "20:00", name: "Test Guest", phone: "040 123 4567", email: "guest@example.invalid", button: "Varaa pöytä" };
  const diff = Object.keys(want).filter((k) => got[k] !== want[k]).map((k) => `${k}: ${JSON.stringify(got[k])} (was ${JSON.stringify(want[k])})`);
  if (diff.length) throw new Error("after the switch " + diff.join(", "));
}]);
cases.push(["WIDGET-17 a switch while the booking is in flight waits, and the answer is not lost", async () => {
  await openForm({ api: { availability: [avail()], book: [{ status: 202, delay: 2500, body: { status: "verification_required", email: "guest@example.invalid" } }] } });
  await fill();
  await book();
  await sleep(200);
  await click('.lala-lang-opt[data-lang="fi"]');
  await sleep(3500);
  const ok = await js(text(q('[data-klar="book-ok"]')));
  if (!(await js(visible(q('[data-klar="book-ok"]')))) || ok.indexOf("guest@example.invalid") === -1) {
    throw new Error(`the guest pressed Book, switched language, and now sees: "${(await js(text(M))).slice(0, 100)}"`);
  }
}]);

/* ---- run ---- */
let failed = 0, ran = 0;
console.log(`serving ${rev ? "commit " + rev : "the working tree"} from ${ORIGIN}`);
for (const [name, run] of cases) {
  if (only && name.indexOf(only) === -1) continue;
  ran++;
  try {
    await run();
    const errs = pageErrors.filter((e) => !/Failed to fetch|aborted/i.test(e));
    if (errs.length) throw new Error("the page threw: " + errs[0]);
    console.log(`ok    ${name}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${name}\n      ${err.message}`);
  }
}
const outside = blocked.filter((u) => !u.startsWith("data:"));
console.log(`\n${ran - failed} of ${ran} case(s) hold. ${outside.length} request(s) to anywhere but ${ORIGIN} were refused before leaving the machine.`);
cleanup();
process.exit(failed ? 1 : 0);
