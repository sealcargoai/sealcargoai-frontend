// CIERRE 02-11 — regresión de los defectos encontrados en la auditoría del 2 de noviembre.
// Entorno: local, integración con mocks (sessionStorage en memoria, fetch simulado: nada se envía).
// Cada caso revisa el ESTADO guardado del caso (formulario, caso, lo que recibiría SEAL) y el texto.
import { describe, it, expect } from "vitest";
import fs from "node:fs";

const store: Record<string, string> = {};
const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = String(v)), removeItem: (k: string) => void delete store[k] };
const g = globalThis as Record<string, unknown>;
g.sessionStorage = storage;
g.localStorage = storage;
g.window = globalThis;
const doc = { documentElement: { lang: "es" } };
g.document = doc;
g.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });

const c = await import("../src/utils/chatReply");
const { applyChatMessage } = await import("../src/utils/chatCase");
const { currentCase, saveFormDraft, formStart, leadingNumber } = await import("../src/utils/caseStore");
const cc = await import("../src/utils/costCalculator");
const { overLimitMessage } = await import("../src/utils/formValidation");

const C = "compresores industriales de tornillo 220 V, tanque de 500 litros";
const P = "lápices de madera para estudiantes";
function start(product = C, qty = "4", budget = "5000", lang: "es" | "en" = "es") {
  for (const k of Object.keys(store)) delete store[k];
  doc.documentElement.lang = lang;
  expect(saveFormDraft({ productType: product, quantity: qty, budget, destination: "GT", volumeCbm: "", weightKg: "" }, 2, null).ok).toBe(true);
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
const caseNow = () => {
  const f = formStart("").formData;
  const s = currentCase();
  return { form: { q: leadingNumber(f.quantity), b: leadingNumber(f.budget) }, saved: { q: s.quantity, b: s.budget } };
};

describe("D1 · un número solo después de un cálculo se pregunta (antes: «no respondo preguntas abiertas»)", () => {
  it("«48» tras «4 cajas de 12» pregunta y ofrece el ejemplo con 48 (antes «la cantidad es 6»); nada cambia", () => {
    start();
    const { reply } = chat(["son 4 cajas de 12, ¿cuántas unidades son?", "48"]);
    expect(reply).toMatch(/¿Ese número es para el cálculo anterior/);
    expect(reply).toContain("«la cantidad es 48»");
    expect(reply).toContain("«¿y para 48 cajas?»");
    expect(reply).not.toMatch(/la cantidad es 6»|600/);
    expect(reply).not.toMatch(/preguntas abiertas/);
    expect(caseNow()).toEqual({ form: { q: 4, b: 5000 }, saved: { q: 4, b: 5000 } });
  });
  it("«sí» a esa pregunta la repite; «para mi caso» aplica 48 en formulario y caso", () => {
    start();
    const specs: c.ReplySpec[] = [];
    chat(["son 4 cajas de 12, ¿cuántas unidades son?", "48"], specs);
    const yes = chat(["sí"], specs).reply;
    expect(yes).toMatch(/¿Ese número es para el cálculo anterior/);
    expect(caseNow().saved.q).toBe(4);
    const mine = chat(["para mi caso"], specs).reply;
    expect(mine).toMatch(/cantidad 4 → 48/);
    expect(caseNow()).toEqual({ form: { q: 48, b: 5000 }, saved: { q: 48, b: 5000 } });
  });
  it("«para el cálculo» responde el cálculo con lo ofrecido (48 cajas de 12 = 576) y no toca el caso", () => {
    start();
    const { reply } = chat(["son 4 cajas de 12, ¿cuántas unidades son?", "son 48", "para el cálculo"]);
    expect(reply).toMatch(/48 cajas de 12 son 576 unidades/);
    expect(caseNow().saved.q).toBe(4);
  });
  it("en inglés también", () => {
    start(C, "4", "5000", "en");
    const { reply } = chat(["4 boxes of 12, how many units is that?", "48"]);
    expect(reply).toMatch(/Is that number for the earlier calculation/);
    expect(reply).toContain('"the quantity is 48"');
  });
});

describe("D2 · un número solo sin cálculo previo se pregunta, nunca se ignora ni se adivina", () => {
  it("producto con medidas: ¿cantidad o característica? (sin cambios)", () => {
    start();
    const { reply } = chat(["72"]);
    expect(reply).toMatch(/¿«72» es la nueva cantidad de unidades o el valor de una característica/);
    expect(caseNow().saved).toEqual({ q: 4, b: 5000 });
  });
  it("producto sin medidas: ¿cantidad o presupuesto? (sin cambios)", () => {
    start(P, "500", "");
    const { reply } = chat(["48"]);
    expect(reply).toMatch(/¿«48» es la nueva cantidad de unidades o el presupuesto de compra\?/);
    expect(reply).toContain("«la cantidad es 48»");
    expect(caseNow().saved.q).toBe(500);
  });
});

describe("D3 · cálculos aritméticos simples se responden; con «no cambies nada» también, sin cambios", () => {
  for (const [msg, res] of [
    ["¿cuánto es 10 x 650?", "10 × 650 = 6,500"],
    ["cuanto es 1,000 entre 8", "1,000 ÷ 8 = 125"],
    ["¿cuánto es 3 por 250?", "3 × 250 = 750"],
    ["how much is 4 times 250?", "4 × 250 = 1,000"],
    ["¿cuánto es 7 más 5?", "7 + 5 = 12"],
  ] as const)
    it(msg, () => {
      start();
      const { reply } = chat([msg]);
      expect(reply).toContain(res);
      expect(reply).not.toMatch(/estimación preliminar con los datos del formulario/);
      expect(caseNow().saved).toEqual({ q: 4, b: 5000 });
    });
  it("«no cambies nada, solo pregunto: ¿cuánto es 10 x 650?»", () => {
    start();
    const { reply } = chat(["no cambies nada, solo pregunto: ¿cuánto es 10 x 650?"]);
    expect(reply).toMatch(/no cambié nada/);
    expect(reply).toContain("10 × 650 = 6,500");
    expect(caseNow().saved).toEqual({ q: 4, b: 5000 });
  });
  it("una medida («10x12 cm») o un pedido no es aritmética", () => {
    expect(c.plainArithmetic("¿cuánto cuesta una caja de 10x12 cm?")).toBeNull();
    expect(c.plainArithmetic("necesito 10 x 650 piezas")).toBeNull();
    expect(c.plainArithmetic("¿cuánto es 5 / 0?")?.result).toBeNull();
  });
});

describe("D4 · un mensaje no entendido se explica con la parte no entendida (no «negación o condición»)", () => {
  it("«make it 12 and set the budget to US$9,000»", () => {
    start(C, "4", "5000", "en");
    const { reply } = chat(["make it 12 and set the budget to US$9,000"]);
    expect(reply).toMatch(/I didn't understand "make it 12/);
    expect(reply).not.toMatch(/negation, a condition or a question/);
    expect(caseNow().saved).toEqual({ q: 4, b: 5000 });
  });
});

describe("D5 · los porcentajes suman 100 y la misma línea muestra el mismo % en la página, PDF y Excel", () => {
  const costs = {
    freightPending: true,
    lines: [
      { key: "product", amount: 5002 },
      { key: "freight", amount: 0 },
      { key: "insurance", amount: 250 },
      { key: "duties", amount: 787.8 },
      { key: "vat", amount: 724.776 },
      { key: "customs", amount: 1200 / 7.9 },
      { key: "local", amount: 9500 / 7.9 },
    ],
  };
  it("caso observado (antes 62+15+10+9+3+2 = 101% y 62% vs 61%)", () => {
    const whole = cc.lineShares(costs, 7.9, 0);
    expect(whole).toEqual([61, null, 3, 10, 9, 2, 15]);
    expect((whole.filter((x) => x !== null) as number[]).reduce((a, b) => a + b, 0)).toBe(100);
    const tenth = cc.lineShares(costs, 7.9, 1);
    expect(tenth).toEqual([61.6, null, 3.1, 9.7, 8.9, 1.9, 14.8]);
  });
  it("propiedad: 2,000 escenarios al azar suman exactamente 100 (enteros y décimas)", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2000; i++) {
      const amounts = Array.from({ length: 2 + Math.floor(rnd() * 6) }, () => Math.round(rnd() * 1e6) / 100);
      for (const d of [0, 1]) {
        const s = cc.shareValues(amounts, d).filter((x): x is number => x !== null);
        expect(Math.round(s.reduce((a, b) => a + b, 0) * 10 ** d)).toBe(100 * 10 ** d);
      }
    }
  });
  it("texto: «<0.1%» para una línea positiva diminuta y «—» sin participación", () => {
    expect(cc.shareText(0, 0.01, 1)).toBe("<0.1%");
    expect(cc.shareText(null, 0, 1)).toBe("—");
    expect(cc.shareText(61.6, 1, 1)).toBe("61.6%");
  });
  it("la página, el PDF y el Excel usan el mismo cálculo (no fórmulas propias)", () => {
    const page = fs.readFileSync("src/app/components/CostBreakdown.tsx", "utf8");
    const pdf = fs.readFileSync("src/utils/costPdf.ts", "utf8");
    const xls = fs.readFileSync("src/utils/reportExports.ts", "utf8");
    for (const src of [page, pdf, xls]) {
      expect(src).toMatch(/lineShares\(/);
      expect(src).not.toMatch(/\/ (?:d\.)?costs\.totalCost\) \* 100\)\.toFixed\(1\)/);
    }
    expect(page).not.toMatch(/Math\.round\(pct\)/);
  });
});

describe("D6 · contador, aviso y validación cuentan el mismo texto (1,615 → «te pasaste por 115»)", () => {
  it("el mensaje calcula el excedente exacto", () => {
    doc.documentElement.lang = "es";
    expect(overLimitMessage(1615, 1500)).toMatch(/te pasaste por 115 caracteres/);
    expect(overLimitMessage(1501, 1500)).toMatch(/te pasaste por 1 carácter\./);
  });
  it("inicio y formulario muestran el contador con el texto recortado, igual que el límite", () => {
    const landing = fs.readFileSync("src/app/components/LandingPage.tsx", "utf8");
    const form = fs.readFileSync("src/app/components/ProductQualification.tsx", "utf8");
    expect(landing).toMatch(/\{queryTrim\.length\.toLocaleString\("en-US"\)\}\/\{QUERY_MAX/);
    expect(landing).not.toMatch(/\{query\.length\.toLocaleString/);
    expect(form).toMatch(/formData\.productType\.trim\(\)\.length\.toLocaleString/);
    expect(form).not.toMatch(/\{formData\.productType\.length\.toLocaleString|overLimitMessage\(formData\.productType\.length,/);
  });
});

describe("D7 · textos: referencias para investigar, no «mejores»; estimación, no costo confirmado; flete con origen", () => {
  const all = ["src/app/components/SupplierResults.tsx", "src/app/context/LanguageContext.tsx", "src/utils/costCalculator.ts", "src/app/components/FinalCTA.tsx"]
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n");
  it("sin «mejor clasificado», «mejores opciones», «best options», «te confirma el costo»", () => {
    expect(all).not.toMatch(/mejor clasificad|mejores opciones|best options|top-ranked|te confirma el costo|confirms the cost before shipment/);
  });
  it("el título de costos no dice «total» sin flete y el flete dice su origen", () => {
    doc.documentElement.lang = "es";
    const rates = {
      container40: 6000,
      container20: 0,
      container40Cbm: 55,
      container20Cbm: 25,
      lclFactor: 1.8,
      lclMinCbm: 1,
      lclMaxCbm: 15,
      transitDays: "30-45",
      exchangeRate: 7.9,
    } as unknown as Parameters<typeof cc.calculateFreight>[2];
    expect(cc.calculateFreight(2, 0, rates).detail).toMatch(/tarifa referencial de SEAL, no es cotización de naviera/);
    expect(cc.calculateFreight(40, 0, rates).detail).toMatch(/tarifa referencial de SEAL/);
    expect(all).toMatch(/"cost\.title": "Estimación preliminar de costos en Guatemala"/);
    expect(all).toMatch(/"cost\.totalLandedCost": "Costo estimado en Guatemala \(incluye flete referencial\)"/);
  });
});

describe("D8 · una prohibición no se extiende al campo que la frase siguiente cambia", () => {
  it("«no cambies la cantidad, el presupuesto es US$7,000» → presupuesto 7,000, cantidad igual", () => {
    start();
    const { reply } = chat(["no cambies la cantidad, el presupuesto es US$7,000"]);
    expect(reply).toMatch(/US\$5,000 → US\$7,000/);
    expect(reply).not.toMatch(/no cambié el presupuesto/);
    expect(caseNow()).toEqual({ form: { q: 4, b: 7000 }, saved: { q: 4, b: 7000 } });
  });
  it("«don't change the quantity, the budget is US$7,000» (EN)", () => {
    start(C, "4", "5000", "en");
    chat(["don't change the quantity, the budget is US$7,000"]);
    expect(caseNow().saved).toEqual({ q: 4, b: 7000 });
  });
  it("«no cambies la cantidad ni el presupuesto, el presupuesto es 9000» sigue sin cambiar el presupuesto", () => {
    start();
    const { reply } = chat(["no cambies la cantidad ni el presupuesto"]);
    expect(reply).toMatch(/Como pediste, no cambié la cantidad ni el presupuesto/);
    expect(caseNow().saved).toEqual({ q: 4, b: 5000 });
    expect([...c.prohibitions("no cambies la cantidad, ni el presupuesto").fields].sort()).toEqual(["budget", "quantity"]);
  });
});
