// CIERRE 02-11c — chat seguro (preguntas, cálculos, negaciones, contradicciones, lectura de vuelta) y
// clasificación QA del navegador. Entorno: local, almacenamiento en memoria, nada se envía.
import { describe, it, expect } from "vitest";

const store: Record<string, string> = {};
let failWrites = false;
const storage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    if (failWrites) throw new DOMException("QuotaExceededError", "QuotaExceededError");
    store[k] = String(v);
  },
  removeItem: (k: string) => void delete store[k],
};
const g = globalThis as Record<string, unknown>;
g.sessionStorage = storage;
g.localStorage = storage;
const loc = { search: "" };
g.window = Object.assign(globalThis, { location: loc });
const doc = { documentElement: { lang: "es" } };
g.document = doc;
g.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const c = await import("../src/utils/chatReply");
const { applyChatMessage } = await import("../src/utils/chatCase");
const { currentCase, saveFormDraft, formStart, leadingNumber } = await import("../src/utils/caseStore");
const { isQaSession } = await import("../src/utils/funnel");

const C = "compresores industriales de tornillo 220 V, tanque de 500 litros";
function start(lang: "es" | "en" = "es") {
  failWrites = false;
  for (const k of Object.keys(store)) delete store[k];
  doc.documentElement.lang = lang;
  expect(saveFormDraft({ productType: C, quantity: "4", budget: "5000", destination: "GT", volumeCbm: "", weightKg: "" }, 2, null).ok).toBe(true);
}
function chat(messages: string[], specs: c.ReplySpec[] = []) {
  const replies: string[] = [];
  for (const text of messages) {
    const lastNamed = [...specs].reverse().find((x) => x.newProduct || x.mentioned);
    const spec = applyChatMessage(text, specs, { currentProduct: lastNamed?.newProduct || lastNamed?.mentioned || currentCase().product, currentQuantity: c.quantityInForce(specs) });
    specs.push(JSON.parse(JSON.stringify(spec)));
    replies.push(c.buildReply(spec));
  }
  return { specs, replies, reply: replies[replies.length - 1] };
}
/** The case as READ BACK from storage: saved case and the form draft. */
const saved = () => {
  const f = formStart("").formData;
  const s = currentCase();
  return { product: s.product, q: s.quantity, b: s.budget, formQ: leadingNumber(f.quantity), formB: leadingNumber(f.budget) };
};
const UNCHANGED = { product: C, q: 4, b: 5000, formQ: 4, formB: 5000 };

describe("C1 · preguntas y cálculos no cambian datos", () => {
  it("«¿Cuánto es 10 x 650?» → 6,500, sin cambios", () => {
    start();
    expect(chat(["¿Cuánto es 10 x 650?"]).reply).toContain("10 × 650 = 6,500");
    expect(saved()).toEqual(UNCHANGED);
  });
  it("«Son 4 cajas de 12, ¿cuántas unidades son?» → 48 unidades; después «48» pregunta y no cambia", () => {
    start();
    const { replies } = chat(["Son 4 cajas de 12, ¿cuántas unidades son?", "48"]);
    expect(replies[0]).toMatch(/4 cajas de 12 son 48 unidades/);
    expect(replies[1]).toMatch(/¿Ese número es para el cálculo anterior/);
    expect(saved()).toEqual(UNCHANGED);
  });
  it("cálculo inverso «¿cuántas cajas de 12 son 48 unidades?» → 4 cajas, sin cambios", () => {
    start();
    expect(chat(["¿cuántas cajas de 12 son 48 unidades?"]).reply).toMatch(/4 cajas/);
    expect(saved()).toEqual(UNCHANGED);
  });
});

describe("C2 · negaciones y prohibiciones", () => {
  it("«No cambies la cantidad; el presupuesto es US$7,000» → solo el presupuesto (leído de vuelta)", () => {
    start();
    expect(chat(["No cambies la cantidad; el presupuesto es US$7,000"]).reply).toMatch(/US\$5,000 → US\$7,000/);
    expect(saved()).toEqual({ ...UNCHANGED, b: 7000, formB: 7000 });
  });
  it("«¿Cuánto es 12 × 24? Para el caso son 48, pero todavía no cambies la cantidad» → 288 y aclara, sin cambiar", () => {
    start();
    const r = chat(["¿Cuánto es 12 × 24? Para el caso son 48, pero todavía no cambies la cantidad"]).reply;
    expect(r).toContain("12 × 24 = 288");
    expect(r).toMatch(/mencionaste 48 para tu caso; como pediste, todavía no cambié la cantidad/);
    expect(r).toContain("«la cantidad es 48»");
    expect(saved()).toEqual(UNCHANGED);
  });
  it("sin la prohibición, «¿Cuánto es 12 x 24? Para el caso son 48» responde 288 y PREGUNTA por 48", () => {
    start();
    const r = chat(["¿Cuánto es 12 x 24? Para el caso son 48"]).reply;
    expect(r).toContain("12 × 24 = 288");
    expect(r).toMatch(/¿es la nueva cantidad de tu caso\? No cambié nada/);
    expect(r).not.toMatch(/estimación preliminar con los datos del formulario/);
    expect(saved()).toEqual(UNCHANGED);
  });
  it("inglés: «How much is 12 x 24? For the case it's 48»", () => {
    start("en");
    const r = chat(["How much is 12 x 24? For the case it's 48"]).reply;
    expect(r).toContain("12 × 24 = 288");
    expect(r).toMatch(/is it the new quantity of your case\?/);
    expect(saved()).toEqual(UNCHANGED);
  });
});

describe("C3 · valores incompatibles en una frase → pregunta antes de aplicar", () => {
  for (const [msg, re] of [
    ["la cantidad es 10 y la cantidad es 12", /dos cantidades distintas \(10 y 12\)/],
    ["cambia la cantidad a 10; la cantidad es 12", /dos cantidades distintas \(10 y 12\)/],
    ["la cantidad es 10 y el presupuesto US$8,000, bueno no, la cantidad 12", /dos cantidades distintas \(10 y 12\)/],
    ["el presupuesto es US$7,000 y el presupuesto es US$9,000", /dos presupuestos de compra distintos \(US\$7,000 y US\$9,000\)/],
  ] as const)
    it(msg, () => {
      start();
      expect(chat([msg]).reply).toMatch(re);
      expect(saved()).toEqual(UNCHANGED);
    });
  it("inglés: «the quantity is 10 and the quantity is 12»", () => {
    start("en");
    expect(chat(["the quantity is 10 and the quantity is 12"]).reply).toMatch(/two different quantities \(10 and 12\)/);
    expect(saved()).toEqual(UNCHANGED);
  });
  it("un cambio normal de una cantidad sigue funcionando («cambia la cantidad de 4 a 8»)", () => {
    start();
    chat(["cambia la cantidad de 4 a 8"]);
    expect(saved().q).toBe(8);
  });
});

describe("C4 · lectura de vuelta: si el cambio no quedó guardado, el chat no lo anuncia", () => {
  it("almacenamiento bloqueado: «la cantidad es 9» → avisa que no pudo guardar, el caso sigue en 4", () => {
    start();
    failWrites = true;
    const r = chat(["la cantidad es 9"]).reply;
    failWrites = false;
    expect(r).toMatch(/No pude guardar el cambio/);
    expect(r).not.toMatch(/Actualizado/);
    expect(saved()).toEqual(UNCHANGED);
  });
});

describe("C5 · sesión QA del navegador solo con señal explícita (?qa=1), nunca por palabras", () => {
  it("nombre «Demo Prueba» y correo de example.com no son QA", () => {
    start();
    store["sealcargo_user_data"] = JSON.stringify({ name: "Demo Prueba Testing", email: "demo@example.com" });
    loc.search = "";
    expect(isQaSession()).toBe(false);
  });
  it("?qa=1 sí marca la sesión como QA", () => {
    start();
    loc.search = "?qa=1";
    expect(isQaSession()).toBe(true);
    loc.search = "";
  });
});

describe("T · textos ES/EN: sin afirmaciones de aval y sin claves internas", () => {
  const RISKY = /\b(?:proveedor(?:es)?\s+(?:calificad|verificad|confiable)\w*|mejor(?:es)?\s+(?:proveedor|opci)\w*|mejor\s+ubicad\w*|garantizamos|te\s+garantiza|cotizaci[oó]n\s+confirmada|costo\s+final\s+(?:de|es)|calificaci[oó]n\s+de\s+producto|qualified\s+suppliers?|best\s+(?:supplier|option)s?|top-ranked|we\s+guarantee|guaranteed\s+(?:price|cost)|confirmed\s+(?:quote|cost))\b/i;
  it("ningún texto visible (diccionario ES/EN y componentes) afirma aval, «mejor» proveedor o costo confirmado", async () => {
    const fs = await import("node:fs");
    const files = ["src/app/context/LanguageContext.tsx", ...fs.readdirSync("src/app/components").filter((f: string) => f.endsWith(".tsx")).map((f: string) => `src/app/components/${f}`), "src/utils/costCalculator.ts", "src/utils/costPdf.ts", "src/utils/reportExports.ts", "src/utils/costNotes.ts"];
    const hits: string[] = [];
    for (const f of files) {
      for (const [i, line] of fs.readFileSync(f, "utf8").split("\n").entries()) {
        // comments, and compatibility rewrites of OLD cached texts (the old text is the input, never shown)
        if (/^\s*\/\//.test(line) || /^\s*\.replace\(/.test(line)) continue;
        const m = line.match(RISKY);
        if (m) hits.push(`${f}:${i + 1} «${m[0]}»`);
      }
    }
    expect(hits).toEqual([]);
  });
  it("las aclaraciones correctas siguen: la insignia es de la plataforma y SEAL no verificó al proveedor", async () => {
    const { trustDetail } = await import("../src/app/components/SelectedSupplier");
    doc.documentElement.lang = "es";
    const es = trustDetail("Insignia de la plataforma: Verified Supplier (auditoría de un tercero, no de SEAL)");
    expect(es).toMatch(/Insignia de la plataforma: Verified Supplier \(auditoría de un tercero, no de SEAL\)/);
    expect(trustDetail("Proveedor verificado (auditoría de tercero)")).toBe(es); // cached older results
    doc.documentElement.lang = "en";
    expect(trustDetail("Insignia de la plataforma: Verified Supplier (auditoría de un tercero, no de SEAL)")).toBe("Platform badge: Verified Supplier (third-party audit, not SEAL's)");
    doc.documentElement.lang = "es";
  });
  it("títulos y etiquetas revisados (ES/EN)", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/app/context/LanguageContext.tsx", "utf8");
    for (const s of [
      '"qualification.title": "Datos del producto"',
      '"chat.ctaButton": "Continuar con los datos del producto"',
      '"suppliers.selectedSupplier": "Proveedor considerado"',
      '"suppliers.selectedSupplier": "Supplier considered"',
      '"final.step1": "Revisar los datos de las referencias y contactar a las que quieras investigar"',
      '"final.qualityControlDesc": "Inspección previa al embarque: servicio adicional que SEAL puede cotizarte"',
      '"final.qualityControlDesc": "Pre-shipment inspection: an additional service SEAL can quote for you"',
      '"cost.title": "Estimación preliminar de costos en Guatemala"',
      '"cost.title": "Preliminary cost estimate in Guatemala"',
    ])
      expect(src).toContain(s);
  });
  it("claves internas: una categoría nunca se imprime como «machinery» u «other»", async () => {
    const { productText, categoryLabel } = await import("../src/utils/category");
    doc.documentElement.lang = "es";
    expect(productText("machinery")).toBe("Maquinaria / equipo");
    expect(productText("other")).toBe("Otro");
    expect(productText("compresores de tornillo")).toBe("compresores de tornillo");
    doc.documentElement.lang = "en";
    expect(categoryLabel("other")).toBe("Other");
    doc.documentElement.lang = "es";
  });
});

describe("C6 · cálculo + número: se pregunta por el campo correcto (revisión independiente)", () => {
  it("«Presupuesto 5000. ¿Cuánto es 5000/4?» → 1,250 y pregunta por el presupuesto, no por la cantidad", () => {
    start();
    const r = chat(["Presupuesto 5000. ¿Cuánto es 5000/4?"]).reply;
    expect(r).toContain("5,000 ÷ 4 = 1,250");
    expect(r).toMatch(/¿es el nuevo presupuesto de compra\?/);
    expect(r).not.toMatch(/la cantidad es 5000/);
    expect(saved()).toEqual(UNCHANGED);
  });
  it("«¿Cuánto es 12 × 24? Son tanques de 500 litros.» → 288, sin proponer «la cantidad es 500»", () => {
    start();
    const r = chat(["¿Cuánto es 12 × 24? Son tanques de 500 litros."]).reply;
    expect(r).toContain("12 × 24 = 288");
    expect(r).not.toMatch(/la cantidad es 500/);
    expect(saved()).toEqual(UNCHANGED);
  });
});
