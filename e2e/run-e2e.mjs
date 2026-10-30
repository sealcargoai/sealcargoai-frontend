// CIERRE 29-b — browser tests (real Chromium, Playwright) of a SANDBOX build of the site.
// Environment: "browser · local sandbox build" (served by vite preview from dist-sandbox/).
//   node e2e/run-e2e.mjs                 → builds with APP_SANDBOX=1, serves it, runs the scenarios
//   E2E_BASE_URL=https://… node e2e/run-e2e.mjs → runs them against an already deployed sandbox
// Two independent safeguards: (1) the build is a sandbox (utils/sandbox.ts answers every write in
// the browser); (2) Playwright aborts EVERY request that is not to the site's own origin and
// records it — the run fails if any request to an API host or analytics host was even attempted
// outside the sandbox. Nothing is sent: no leads, emails, events or searches.
import { createRequire } from "node:module";
// Playwright: the project's devDependency if installed, else the machine's global install
const { chromium } = createRequire(import.meta.url)("playwright");
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";

const EXPECT_VERSION = "2026.10.30-d";
let BASE = process.env.E2E_BASE_URL || "";
let server = null;
if (!BASE) {
  const commit = execSync("git rev-parse --short=7 HEAD").toString().trim();
  execSync("npx vite build --outDir dist-sandbox", { stdio: "inherit", env: { ...process.env, APP_SANDBOX: "1", APP_COMMIT: commit, VITE_API_URL: "https://api.sandbox.invalid" } });
  const port = 4600 + Math.floor(Math.random() * 300);
  server = spawn("npx", ["vite", "preview", "--outDir", "dist-sandbox", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { stdio: ["ignore", "pipe", "pipe"] });
  BASE = `http://127.0.0.1:${port}`;
  await new Promise((r) => setTimeout(r, 2500));
}
const origin = new URL(BASE).origin;
const C = "compresores industriales de tornillo, trifásicos 220 V, 60 Hz, tanque de 500 litros, libres de aceite";
const results = [];
const outside = [];
let browser;

async function newPage(lang = "es") {
  const ctx = await browser.newContext({ locale: lang === "en" ? "en-US" : "es-GT" });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.origin === origin) return route.continue();
    outside.push(`${route.request().method()} ${u.origin}${u.pathname}`);
    return route.abort();
  });
  await ctx.addInitScript((l) => {
    try {
      localStorage.setItem("seal_lang", l);
    } catch {}
    // storage fault injection, switched on per test
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      const f = window.__fail || "";
      if (f === "all" || (f && f === k)) throw new DOMException("QuotaExceededError", "QuotaExceededError");
      return orig.call(this, k, v);
    };
  }, lang);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => results.push({ id: "page-error", ok: false, detail: String(e) }));
  return { ctx, page };
}
const state = (page) =>
  page.evaluate(() => {
    const d = JSON.parse(sessionStorage.getItem("seal_qualify_draft") || "null");
    const c = JSON.parse(sessionStorage.getItem("seal_case") || "null");
    return {
      draft: d?.formData ? { product: d.formData.productType, quantity: d.formData.quantity, budget: d.formData.budget, rev: d.rev, caseId: d.caseId } : null,
      mirror: c ? { product: c.product, quantity: c.quantity, budget: c.budget, rev: c.rev, caseId: c.caseId } : null,
      pending: sessionStorage.getItem("seal_pending"),
    };
  });
async function startCase(page, qty = "4", budget = "5000") {
  // the case as the form saves it (same shape and version fields the page writes)
  await page.goto(`${BASE}/?qa=1`);
  await page.evaluate(
    ({ C, qty, budget }) => {
      sessionStorage.clear();
      const caseId = "e2e" + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(
        "seal_qualify_draft",
        JSON.stringify({ formData: { productType: C, quantity: qty, budget, destination: "GT", volumeCbm: "", weightKg: "", material: "" }, step: 2, prev: null, caseId, rev: 1 }),
      );
      sessionStorage.setItem("seal_case", JSON.stringify({ product: C, quantity: qty, budget: "US$" + Number(budget).toLocaleString("en-US"), caseId, rev: 1 }));
      sessionStorage.setItem("seal_product", C);
      sessionStorage.setItem("seal_qa", "1");
    },
    { C, qty, budget },
  );
  await page.goto(`${BASE}/chat`);
  await page.waitForSelector("input[type=text]");
}
async function say(page, text) {
  const before = await page.locator(".whitespace-pre-line").count();
  await page.fill("input[type=text]", text);
  await page.keyboard.press("Enter");
  await page.waitForFunction((n) => document.querySelectorAll(".whitespace-pre-line").length >= n + 2, before);
  await page.waitForFunction(() => !/Escribiendo…|Typing…/.test(document.body.innerText), null, { timeout: 5000 });
  const all = await page.locator(".whitespace-pre-line").allInnerTexts();
  return all[all.length - 1];
}
function check(id, ok, detail = "") {
  results.push({ id, ok: !!ok, detail });
}
const caseOf = (s) => ({ q: s.draft?.quantity, b: s.draft?.budget, p: s.draft?.product, mq: s.mirror?.quantity, mb: s.mirror?.budget, mp: s.mirror?.product, sync: s.draft?.rev === s.mirror?.rev });

try {
  browser = await chromium.launch();
  {
    const { ctx, page } = await newPage();
    await page.goto(`${BASE}/?qa=1`);
    const footer = await page.locator("text=/v2026\\.10\\.\\d+-[a-z]/").first().innerText();
    check("B01 version and commit visible", footer.includes(EXPECT_VERSION) && /·\s*[0-9a-f]{7}|·\s*local/.test(footer), footer);
    check("B02 sandbox banner visible", await page.locator("text=ENTORNO DE PRUEBA").count(), "");
    check("B03 no Google Tag Manager in the sandbox page", !(await page.content()).includes("googletagmanager.com/gtm.js"), "");
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage();
    await startCase(page);
    const a = await say(page, "La compra será de 3.5 compresores. No cambies nada hasta confirmar si aceptas cantidades fraccionarias.");
    let s = caseOf(await state(page));
    check("B10 S1 rejected, case 4/5000 in draft and mirror", /fraccionarias/.test(a) && !/Actualizado/.test(a) && s.q === "4" && s.mq === "4" && s.sync, JSON.stringify(s));
    await say(page, "Necesito 500 lápices en cajas de 12, ¿cuántas cajas necesito?");
    const b = await say(page, "Corrijo: serán 10,000,001 compresores; actualiza solo la cantidad.");
    s = caseOf(await state(page));
    check("B11 math then S2: rejected by max, math not reused", /10,000,000/.test(b) && !/lápices|cajas/.test(b) && s.q === "4", b.slice(0, 120));
    const d1 = await say(page, "Cambia la cantidad a 7, pero pídeme confirmación antes de cambiarla");
    s = caseOf(await state(page));
    check("B12 D1 proposal pending, not applied", /no cambié nada/i.test(d1) && s.q === "4" && (await state(page)).pending, d1.slice(0, 100));
    const d1b = await say(page, "Sí, aplícalo");
    s = caseOf(await state(page));
    check("B13 D1 confirmed → 7 everywhere", /4 → 7/.test(d1b) && s.q === "7" && s.mq === "7" && s.sync, JSON.stringify(s));
    const d2 = await say(page, "Do not update the quantity to 8");
    s = caseOf(await state(page));
    check("B14 D2 prohibition respected", /no cambié la cantidad/i.test(d2) && s.q === "7", d2.slice(0, 100));
    const d3 = await say(page, "Cambia la cantidad a 5e2");
    s = caseOf(await state(page));
    check("B15 D3 5e2 asked, not applied", /notación/.test(d3) && s.q === "7", d3.slice(0, 100));
    const d4 = await say(page, "¿Y si cambio de producto: ahora quiero importar bombas industriales?");
    s = caseOf(await state(page));
    check("B16 D4 hypothetical product change: product kept", /hipotética/.test(d4) && s.p === C && s.mp === C, d4.slice(0, 100));
    const t300 = await say(page, "Cambia la capacidad del tanque de 500 a 300 litros");
    s = caseOf(await state(page));
    check("B17 tank 500 → 300 L, quantity and budget kept", s.p === C.replace("500 litros", "300 litros") && s.q === "7" && s.b === "5000", t300.slice(0, 100));
    // reload: same conversation, same case
    const textBefore = await page.locator(".whitespace-pre-line").allInnerTexts();
    await page.reload();
    await page.waitForSelector("input[type=text]");
    const textAfter = await page.locator(".whitespace-pre-line").allInnerTexts();
    check(
      "B18 reload keeps the conversation and the case",
      JSON.stringify(textBefore) === JSON.stringify(textAfter) && caseOf(await state(page)).q === "7",
      `${textBefore.length}/${textAfter.length}`,
    );
    // chat → form → chat
    await page.getByText(/Continuar a Calificación/).click();
    await page.waitForURL(/\/qualify/);
    const qv = await page
      .locator("input[placeholder='1000']")
      .inputValue()
      .catch(() => "");
    const bv = await page
      .locator("input[placeholder='50000']")
      .inputValue()
      .catch(() => "");
    check("B19 form opens with the chat's case (7, 5000)", qv === "7" && bv === "5000", `${qv}/${bv}`);
    if (await page.locator("input[placeholder='50000']").count()) {
      await page.fill("input[placeholder='50000']", "8000");
      await page.locator("input[placeholder='50000']").blur();
    }
    await page.waitForTimeout(300);
    await page.goBack();
    await page.waitForSelector("input[type=text]");
    const r = await say(page, "Cambia la cantidad a 9");
    s = caseOf(await state(page));
    check("B20 back in chat: form's budget kept, chat change applied", s.q === "9" && s.b === "8000" && s.mb === "US$8,000" && s.sync, JSON.stringify(s));
    // summary visible = payload
    await page
      .getByRole("button", { name: /Hablar con SEAL/ })
      .first()
      .click();
    await page.waitForTimeout(300);
    const dialog = await page.locator("[role=dialog]").innerText();
    await page.locator("[role=dialog] input").nth(0).fill("PRUEBA QA");
    await page.locator("[role=dialog] input[type=email], [role=dialog] input").nth(1).fill("qa-prueba@example.com");
    await page.locator("[role=dialog] button[type=submit]").click();
    await page.waitForTimeout(500);
    const sent = await page.evaluate(() => window.__sealSandbox?.sent || []);
    const body = sent.at(-1)?.body || {};
    const shows = (v) => dialog.includes(String(v));
    check(
      "B21 summary shown = payload sent (product, quantity, budget)",
      body.quantity === "9" && body.budget === "US$8,000" && shows("9") && shows("US$8,000") && dialog.includes(body.product?.slice(0, 40)) && !("rev" in body),
      JSON.stringify({ q: body.quantity, b: body.budget }),
    );
    const receipt = await page.locator("[role=dialog]").innerText();
    check("B22 sandbox receipt (simulated number, nothing sent)", /SEAL-SANDBOX-/.test(receipt), receipt.slice(0, 80));
    await ctx.close();
  }
  {
    // partial storage failure in a real browser
    const { ctx, page } = await newPage();
    await startCase(page);
    await page.evaluate(() => (window.__fail = "seal_case"));
    const r = await say(page, "Cambia la cantidad a 6");
    await page.evaluate(() => (window.__fail = ""));
    const s = caseOf(await state(page));
    check("B30 D6 partial write: rolled back, not announced", /No pude guardar/.test(r) && s.q === "4" && s.mq === "4" && s.sync, JSON.stringify(s));
    await page.evaluate(() => (window.__fail = "all"));
    const r2 = await say(page, "Cambia la cantidad a 6");
    await page.evaluate(() => (window.__fail = ""));
    check("B31 total failure: not announced, case intact", /No pude guardar/.test(r2) && caseOf(await state(page)).q === "4", "");
    await ctx.close();
  }
  {
    // damaged history opens
    const { ctx, page } = await newPage();
    await startCase(page);
    await page.evaluate(
      (C) => sessionStorage.setItem("seal_chat", JSON.stringify({ query: C, messages: [{ role: "user", content: "Hola", id: 1 }, { role: "ai", content: "{roto", id: 1 }, null] })),
      C,
    );
    await page.reload();
    const ok = await page.locator("input[type=text]").count();
    const r = ok ? await say(page, "Cambia la cantidad a 6") : "";
    check("B40 D5 damaged reply: chat opens and works", ok && /4 → 6/.test(r), r.slice(0, 60));
    await ctx.close();
  }
  {
    // rapid messages + double click
    const { ctx, page } = await newPage();
    await startCase(page);
    await page.fill("input[type=text]", "Cambia la cantidad a 6");
    await page.keyboard.press("Enter");
    await page.fill("input[type=text]", "Actualiza el presupuesto a US$7,000");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    let s = caseOf(await state(page));
    check("B50 two fast messages: both applied in order", s.q === "6" && s.b === "7000" && s.sync, JSON.stringify(s));
    await page.fill("input[type=text]", "Cambia la cantidad a 3");
    const btn = page.locator("input[type=text] + button");
    await btn.dblclick();
    await page.waitForTimeout(1000);
    const users = (await page.locator("p.text-white").allInnerTexts()).filter((x) => x === "Cambia la cantidad a 3").length;
    check("B51 double click sends once", users === 1 && caseOf(await state(page)).q === "3", String(users));
    await ctx.close();
  }
  {
    // new case from the start page: nothing inherited
    const { ctx, page } = await newPage();
    await startCase(page);
    await say(page, "Cambia la cantidad a 7, pero pídeme confirmación antes");
    await page.goto(`${BASE}/?qa=1`);
    await page.fill(`input[placeholder^="${"Ej"}"], textarea`, "termos de acero inoxidable 304 de 500 ml para cafetería").catch(() => {});
    // the start form: query, then name/email
    const q = page.locator("form input").first();
    await q.fill("termos de acero inoxidable 304 de 500 ml para cafetería");
    await q.press("Enter");
    await page.waitForTimeout(300);
    await page.fill("input[placeholder='Juan Pérez']", "PRUEBA QA");
    await page.fill("input[placeholder='juan@empresa.com']", "qa-prueba@example.com");
    await page.locator("input[placeholder='juan@empresa.com']").press("Enter");
    await page.waitForURL(/\/chat/);
    const r = await say(page, "sí");
    const st = await state(page);
    check("B60 new case: no inherited data or pending proposal", !/compresor|cantidad 7/.test(r) && !st.pending && !st.mirror?.quantity, JSON.stringify(st).slice(0, 160));
    await ctx.close();
  }
  {
    // two independent conversations (two tabs: each tab keeps its own case)
    const { ctx, page } = await newPage();
    await startCase(page);
    const page2 = await ctx.newPage();
    await page2.goto(`${BASE}/?qa=1`);
    await page2.evaluate(() => {
      sessionStorage.clear();
      sessionStorage.setItem(
        "seal_qualify_draft",
        JSON.stringify({ formData: { productType: "guantes de nitrilo talla M sin polvo", quantity: "2000", budget: "300", destination: "GT" }, step: 2, prev: null, caseId: "e2eB", rev: 1 }),
      );
      sessionStorage.setItem("seal_product", "guantes de nitrilo talla M sin polvo");
    });
    await page2.goto(`${BASE}/chat`);
    await page2.waitForSelector("input[type=text]");
    await say(page, "Cambia la cantidad a 6");
    await say(page2, "Cambia la cantidad a 2500");
    const a = caseOf(await state(page));
    const b = caseOf(await state(page2));
    check("B61 two tabs, two independent cases", a.q === "6" && a.p === C && b.q === "2500" && /guantes/.test(b.p || ""), `${a.q}/${b.q}`);
    await ctx.close();
  }
  {
    // English
    const { ctx, page } = await newPage("en");
    await startCase(page);
    const r = await say(page, "Do not update the quantity to 8");
    const r2 = await say(page, "Change the quantity to 3.5");
    check(
      "B70 English replies are English and correct",
      /As you asked, I didn't change the quantity/.test(r) && /whole number/.test(r2) && !/cantidad|No cambié/.test(r + r2) && caseOf(await state(page)).q === "4",
      (r + " | " + r2).slice(0, 160),
    );
    await ctx.close();
  }
  {
    // REGRESIÓN-PRODUCCIÓN 2026-10-30: the three cases reported in v2026.10.28-n, through the real start page
    const { ctx, page } = await newPage();
    await page.goto(`${BASE}/?qa=1`);
    const q = page.locator("form input").first();
    await q.fill("Quiero importar 4 compresores industriales de tornillo de 220 V con un presupuesto de US$5,000");
    await q.press("Enter");
    await page.waitForTimeout(300);
    await page.fill("input[placeholder='Juan Pérez']", "PRUEBA QA");
    await page.fill("input[placeholder='juan@empresa.com']", "qa-prueba@example.com");
    await page.locator("input[placeholder='juan@empresa.com']").press("Enter");
    await page.waitForURL(/\/chat/);
    let s = caseOf(await state(page));
    check(
      "B80 presupuesto y cantidad del pedido inicial en el caso (4, US$5,000)",
      s.q === "4" && s.b === "5000" && s.mq === "4" && s.mb === "US$5,000" && s.p === "compresores industriales de tornillo de 220 V" && s.sync,
      JSON.stringify(s),
    );
    const r1 = await say(page, "La compra será de 3.5 compresores. No cambies nada hasta confirmar si aceptas cantidades fraccionarias.");
    s = caseOf(await state(page));
    check("B81 con 4 compresores, 3.5 + 'no cambies nada' no modifica (no 4 → 5)", !/→ 5|cantidad 5|Actualizado/.test(r1) && s.q === "4" && s.b === "5000" && s.sync, r1.slice(0, 100));
    const r2 = await say(page, "serían 10,000,001 compresores");
    s = caseOf(await state(page));
    check("B82 'serían 10,000,001 compresores' no se acepta", !/Actualizado/.test(r2) && s.q === "4" && s.mq === "4", r2.slice(0, 100));
    await page.getByText(/Continuar a Calificación/).click();
    await page.waitForURL(/\/qualify/);
    // a new case opens the form on step 1 (product): the quantity and budget are on step 2
    await page.waitForTimeout(500);
    if (!(await page.locator("input[placeholder='1000']").count())) {
      const next = page.getByRole("button", { name: /Siguiente Paso/ });
      await next.scrollIntoViewIfNeeded();
      await next.click();
      await page.waitForSelector("input[placeholder='1000']", { timeout: 5000 });
    }
    const fq = await page.locator("input[placeholder='1000']").inputValue();
    const fb = await page.locator("input[placeholder='50000']").inputValue();
    await page
      .getByRole("button", { name: /Volver al Chat/ })
      .first()
      .click();
    await page.waitForSelector("input[type=text]");
    const chatText = await page.locator(".whitespace-pre-line").allInnerTexts();
    const lastCase = chatText.filter((x) => /cantidad \d|cantidad sin indicar/.test(x)).pop() || "";
    check("B84 la última respuesta del chat dice lo mismo (cantidad 4; US$5,000)", /cantidad 4;/.test(lastCase) && /US\$5,000/.test(lastCase), lastCase.slice(0, 160));
    await page
      .getByRole("button", { name: /Hablar con SEAL/ })
      .first()
      .click();
    await page.waitForTimeout(300);
    const dlg = await page.locator("[role=dialog]").innerText();
    const lines = dlg.split("\n").filter((x) => /^(Producto|Cantidad|Presupuesto de compra):/.test(x));
    check(
      "B83 chat, formulario y resumen coinciden: 4 y US$5,000; 10,000,001 en ninguna parte",
      fq === "4" && fb === "5000" && lines.includes("Cantidad: 4") && lines.includes("Presupuesto de compra: US$5,000") && !/10,000,001/.test(dlg),
      JSON.stringify({ fq, fb, lines }),
    );
    await ctx.close();
  }
  {
    // REGRESIÓN 30-b: pedido inicial con notas de control, los dos mensajes exactos, aislamiento de un cálculo, recarga
    const { ctx, page } = await newPage();
    await page.goto(`${BASE}/?qa=1`);
    const q = page.locator("form input").first();
    await q.fill("PRUEBA QA – No enviar caso comercial. Quiero importar 4 compresores industriales de tornillo de 220 V con un presupuesto de US$5,000. No enviar caso comercial.");
    await q.press("Enter");
    await page.waitForTimeout(300);
    await page.fill("input[placeholder='Juan Pérez']", "PRUEBA QA");
    await page.fill("input[placeholder='juan@empresa.com']", "qa-prueba@example.com");
    await page.locator("input[placeholder='juan@empresa.com']").press("Enter");
    await page.waitForURL(/\/chat/);
    let s = caseOf(await state(page));
    const greet = (await page.locator(".whitespace-pre-line").allInnerTexts()).join(" ");
    check(
      "B85 nota de control fuera del producto; cantidad 4 y US$5,000 tomados",
      s.p === "compresores industriales de tornillo de 220 V" && s.q === "4" && s.b === "5000" && s.mb === "US$5,000" && s.sync && /como una nota/.test(greet) && !/No tomé/.test(greet),
      JSON.stringify(s),
    );
    const r1 = await say(page, "Corrijo: serían 10,000,001 compresores; actualiza únicamente la cantidad y conserva lo demás.");
    s = caseOf(await state(page));
    check("B86 «Corrijo: serían 10,000,001…» rechazado; caso intacto", /10,000,000/.test(r1) && !/Actualizado/.test(r1) && s.q === "4" && s.b === "5000" && s.mq === "4" && s.sync, r1.slice(0, 120));
    await say(page, "Necesito 500 lápices en cajas de 12, ¿cuántas cajas necesito?");
    const r2 = await say(page, "Y para 10,000,001?");
    const r3 = await say(page, "Son 600");
    s = caseOf(await state(page));
    check(
      "B87 número suelto después de un cálculo: se pregunta, no se responde con el cálculo ni se cambia el caso",
      /cálculo anterior/.test(r2) && /cálculo anterior/.test(r3) && !/\d+ cajas/.test(r2 + r3) && s.q === "4" && s.b === "5000",
      (r2 + " | " + r3).slice(0, 160),
    );
    const r4 = await say(page, "No enviar caso comercial.");
    await page.reload();
    await page.waitForSelector("input[type=text]");
    s = caseOf(await state(page));
    const after = (await page.locator(".whitespace-pre-line").allInnerTexts()).join(" ");
    check(
      "B88 frase de control sola: no cambia nada; tras recargar el caso y el historial siguen iguales",
      /no se envía nada a SEAL/.test(r4) && s.q === "4" && s.b === "5000" && s.p === "compresores industriales de tornillo de 220 V" && /Son 600/.test(after) && /como una nota/.test(after),
      JSON.stringify(s),
    );
    await ctx.close();
  }
  {
    // VALIDACIÓN 30-c: aviso de inicio (doble envío, respuesta lenta), nota «No enviar.» y mensajes válidos no previstos
    const { ctx, page } = await newPage();
    const landing = async (text, mode) => {
      await page.goto(`${BASE}/?qa=1`);
      await page.evaluate((mode) => {
        sessionStorage.clear();
        window.__leads = 0;
        const of = window.fetch;
        window.fetch = function (u, o) {
          if (/\/api\/email\/lead/.test(String(u))) {
            window.__leads++;
            if (mode === "slow")
              return new Promise((r, j) => {
                const s = o && o.signal;
                s && s.addEventListener("abort", () => j(new DOMException("aborted", "AbortError")));
                setTimeout(() => r(new Response("{}", { status: 200 })), 20000);
              });
          }
          return of.apply(this, arguments);
        };
      }, mode);
      const q = page.locator("form input").first();
      await q.fill(text);
      await q.press("Enter");
      await page.waitForTimeout(300);
      await page.fill("input[placeholder='Juan Pérez']", "PRUEBA QA");
      await page.fill("input[placeholder='juan@empresa.com']", "qa-prueba@example.com");
      const t0 = Date.now();
      if (mode === "double")
        await page.evaluate(() => {
          const f = document.querySelector("input[placeholder='juan@empresa.com']").form;
          f.requestSubmit();
          f.requestSubmit();
        });
      else await page.locator("input[placeholder='juan@empresa.com']").press("Enter");
      await page.waitForURL(/\/chat/, { timeout: 15000 });
      return { ms: Date.now() - t0, leads: await page.evaluate(() => window.__leads) };
    };
    const REQ = "Quiero importar 4 compresores industriales de tornillo de 220 V con un presupuesto de US$5,000";
    const d = await landing(REQ, "double");
    check("B91 doble envío en el mismo instante: un solo aviso de inicio", d.leads === 1, JSON.stringify(d));
    const sl = await landing(REQ, "slow");
    check("B92 aviso lento (20 s): el análisis abre en menos de 6 s", sl.ms < 6000 && sl.leads === 1, JSON.stringify(sl));
    await landing(`PRUEBA QA. ${REQ}. No enviar.`, "normal");
    let s = caseOf(await state(page));
    check("B93 «No enviar.» al final del pedido no entra en el producto", s.p === "compresores industriales de tornillo de 220 V" && s.q === "4" && s.b === "5000" && s.sync, JSON.stringify(s));
    await say(page, "La cantidad es 3");
    await say(page, "El presupuesto es US$4,000");
    const v1 = await say(page, "Son cuatro unidades, cada una con tanque de 500 litros.");
    const s1 = caseOf(await state(page));
    const v2 = await say(page, "El presupuesto máximo de compra es cinco mil dólares.");
    const s2 = caseOf(await state(page));
    const v3 = await say(page, "Corrijo únicamente el presupuesto a US$4,800; conserva los demás datos.");
    const s3 = caseOf(await state(page));
    const v4 = await say(page, "El equipo es para uso industrial; todavía no tengo marca definida.");
    const s4 = caseOf(await state(page));
    check(
      "B94 mensajes válidos no previstos: 4 unidades, US$5,000, US$4,800, dato sin campo; nada más cambia",
      s1.q === "4" &&
        s1.b === "4000" &&
        /No agregué «tanque de 500 litros»/.test(v1) &&
        s2.q === "4" &&
        s2.b === "5000" &&
        s3.q === "4" &&
        s3.b === "4800" &&
        s4.q === "4" &&
        s4.b === "4800" &&
        /^Anotado\./.test(v4) &&
        s4.p === "compresores industriales de tornillo de 220 V" &&
        s4.sync,
      JSON.stringify([s1, s2, s3, s4].map((x) => [x.q, x.b])) + " " + (v2 + " | " + v4).slice(0, 120),
    );
    await ctx.close();
  }
  {
    // 30-d · B95-B97: «Pedir a SEAL que revise mi caso» (search failed) asks for confirmation first;
    // cancel sends nothing; a double click on «Sí, enviar a SEAL» sends ONE case. B98: chat corrections.
    const { ctx, page } = await newPage("es");
    await startCase(page, "4", "5000");
    const r1 = await say(page, "me equivoqué, son 7 unidades");
    const s1 = caseOf(await state(page));
    const r2 = await say(page, "son 9 unidades. Me equivoqué");
    const s2 = caseOf(await state(page));
    check(
      "B98 «me equivoqué, son 7» se toma; «son 9. Me equivoqué» no cambia nada",
      s1.q === "7" && s1.mq === "7" && s2.q === "7" && s2.mq === "7" && s2.sync,
      JSON.stringify([s1.q, s2.q]) + " " + (r1 + " | " + r2).slice(0, 120),
    );
    await page.evaluate(() =>
      localStorage.setItem("sealcargo_user_data", JSON.stringify({ userId: "user_e2e", email: "qa-prueba@example.com", name: "PRUEBA QA", searchCount: 0, searches: [], limitReached: false })),
    );
    await page.goto(`${BASE}/qualify`);
    await page.waitForSelector("text=Paso");
    for (let i = 0; i < 3 && (await page.getByRole("button", { name: /Consultar referencias/ }).count()) === 0; i++) await page.getByRole("button", { name: /Siguiente Paso/ }).click();
    await page.getByRole("button", { name: /Consultar referencias/ }).click();
    await page.getByRole("button", { name: /Pedir a SEAL que revise mi caso/ }).waitFor({ timeout: 15000 });
    const sent = () => page.evaluate(() => (window.__sealSandbox?.sent || []).filter((x) => x.url === "/api/email/quote").length);
    await page.getByRole("button", { name: /Pedir a SEAL que revise mi caso/ }).click();
    const box = await page.getByRole("group", { name: /Confirmar envío a SEAL/ }).innerText();
    const n0 = await sent();
    check(
      "B95 «Pedir a SEAL…» no envía: muestra qué recibirá SEAL y pide confirmar",
      n0 === 0 && /tu nombre, tu correo/.test(box) && /No se comparten con proveedores/.test(box),
      `${n0} ${box.slice(0, 80)}`,
    );
    await page.getByRole("button", { name: /^Cancelar$/ }).click();
    const n1 = await sent();
    const back = await page.getByRole("button", { name: /Pedir a SEAL que revise mi caso/ }).count();
    check("B96 cancelar no envía nada y vuelve al botón", n1 === 0 && back === 1, `${n1} ${back}`);
    await page.getByRole("button", { name: /Pedir a SEAL que revise mi caso/ }).click();
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /Sí, enviar a SEAL/.test(x.innerText));
      b.click();
      b.click();
    });
    await page.waitForFunction(() => /SEAL-SANDBOX|recib|caso/i.test(document.body.innerText) && !/Enviando…/.test(document.body.innerText), null, { timeout: 10000 });
    await page.waitForTimeout(500);
    const n2 = await sent();
    const body = await page.evaluate(() => (window.__sealSandbox?.sent || []).find((x) => x.url === "/api/email/quote")?.body || {});
    check(
      "B97 doble clic en «Sí, enviar a SEAL»: un solo caso, con cantidad 7 y US$5,000",
      n2 === 1 && String(body.quantity) === "7" && /5,?000/.test(String(body.budget)),
      `${n2} ${JSON.stringify({ q: body.quantity, b: body.budget })}`,
    );
    await ctx.close();
  }
  const apiAttempts = outside.filter((x) => /\/api\/|\/health|googletagmanager|google-analytics|doubleclick/.test(x));
  check("B90 no request to an API or analytics host left the browser", apiAttempts.length === 0, JSON.stringify(apiAttempts.slice(0, 5)));
} catch (e) {
  results.push({ id: "runner", ok: false, detail: String((e && e.stack) || e).slice(0, 400) });
} finally {
  await browser?.close();
  server?.kill();
}
const lines = results.map((r) => `${r.ok ? "PASS" : "FAIL"} ${r.id}${r.detail ? ` — ${r.detail}` : ""}`);
console.log(lines.join("\n"));
console.log(`\nbrowser e2e @ ${BASE}: ${results.filter((r) => r.ok).length}/${results.length} passed; requests aborted outside the origin: ${outside.length}`);
fs.mkdirSync("e2e/out", { recursive: true });
fs.writeFileSync("e2e/out/last-run.json", JSON.stringify({ base: BASE, results, outside }, null, 2));
process.exit(results.every((r) => r.ok) ? 0 : 1);
