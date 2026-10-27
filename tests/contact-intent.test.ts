// Whoever wants to move forward is sent to SEAL first, before general answers.
import { describe, it, expect, afterEach } from "vitest";
import { contactIntent, replyKinds, replayConversation, nextSpec, productMention } from "../src/utils/chatReply";

const setLang = (lang: "es" | "en") => {
  (globalThis as { document?: unknown }).document = { documentElement: { lang } };
};
afterEach(() => setLang("es"));

const YES: [string, string][] = [
  ["Quiero contratar", "contratar"],
  ["quiero contratar el servicio de SEAL", "contratar"],
  ["¿Cómo los contrato?", ""], // "contrato" is ambiguous (a contract): not forced
  ["¿Cómo puedo contratarlos?", "contratar"],
  ["Me interesa contratar a SEAL para mi importación", "contratar"],
  ["Quiero hablar con alguien", "hablar_persona"],
  ["¿Puedo hablar con una persona?", "hablar_persona"],
  ["necesito hablar con un asesor", "hablar_persona"],
  ["que me llamen por favor", "hablar_persona"],
  ["Tengo proforma", "proforma"],
  ["Ya tengo la proforma del proveedor, ¿me ayudan?", "proforma"],
  ["me enviaron una factura proforma de 2000 termos", "proforma"],
  ["Mi carga ya viene", "carga_en_camino"],
  ["mi contenedor ya salió de Shanghai", "carga_en_camino"],
  ["Mi mercadería está en camino, ¿qué hago para la aduana?", "carga_en_camino"],
  ["Ya pagué al proveedor", "carga_en_camino"],
  ["Ya tengo proveedor", "ya_tiene_proveedor"],
  ["I want to hire you", "contratar"],
  ["Can I talk to someone?", "hablar_persona"],
  ["I have a proforma from my supplier", "proforma"],
  ["My shipment is already on its way", "carga_en_camino"],
  ["I already have a supplier", "ya_tiene_proveedor"],
];
const NO = [
  "Quiero importar 500 termos de acero",
  "¿Qué es una proforma?",
  "Todavía no quiero contratar, solo estoy viendo",
  "Aún no tengo proforma",
  "Necesito hablar con el proveedor sobre el precio",
  "¿El proveedor es confiable?",
  "Necesito 200 pares; cada caja trae 20 pares",
  "Tengo una pregunta sobre el DAI",
];

describe("intent detection", () => {
  for (const [q, k] of YES) it(`${q} → ${k || "none"}`, () => expect(contactIntent(q)).toBe(k));
  for (const q of NO) it(`${q} → none`, () => expect(contactIntent(q)).toBe(""));
});

describe("SEAL contact comes first, before general answers", () => {
  it("open message: contact instead of the general reply", () => {
    const r = replayConversation(["Quiero hablar con alguien"])[0];
    expect(r).toMatch(/^Claro, te conecto con un ejecutivo de SEAL/);
    expect(r).toMatch(/Enviar mi caso a SEAL/);
    expect(r).not.toMatch(/no respondo preguntas abiertas/);
  });
  it("proforma: no supplier search needed", () => {
    const r = replayConversation(["Tengo proforma"])[0];
    expect(r).toMatch(/proforma.*SEAL la revise/);
    expect(r).not.toMatch(/continúa con el formulario para ver opciones/);
  });
  it("ya tengo proveedor is not answered as a reliability question", () => {
    const r = replayConversation(["Ya tengo proveedor en China"])[0];
    expect(r).not.toMatch(/No puedo confirmar si un proveedor es real/);
    expect(replyKinds("Ya tengo proveedor, ¿es confiable?")).toEqual(["contact", "supplier"]);
  });
  it("contact first, the cost question still answered after it", () => {
    expect(replyKinds("Quiero contratar, ¿cuánto cuesta?")).toEqual(["contact", "cost"]);
    const r = replayConversation(["Quiero contratar, ¿cuánto cuesta?"])[0];
    expect(r.indexOf("te conecto con SEAL")).toBeLessThan(r.indexOf("cotización de SEAL"));
    // one next step: no second path to the form after the way to SEAL
    expect(r).not.toMatch(/formulario/);
  });
  it("contact first even with a calculation", () => {
    expect(replyKinds("Mi carga ya viene: 300 piezas en cajas de 25, ¿cuántas cajas son?")[0]).toBe("contact");
  });
  it("in the middle of a conversation, without losing the product", () => {
    const r = replayConversation(["Quiero importar termos de acero", "Quiero hablar con alguien", "¿Necesito certificado?"]);
    expect(r[1]).toMatch(/te conecto con un ejecutivo de SEAL/);
    expect(r[2]).toMatch(/termos/);
  });
  it("EN", () => {
    setLang("en");
    const r = replayConversation(["My cargo is already on its way"])[0];
    expect(r).toMatch(/^If your cargo is already on its way, SEAL handles/);
    expect(r).toMatch(/Send my case to SEAL/);
  });
  it("not yet: the usual answer", () => {
    expect(replayConversation(["Todavía no quiero contratar, solo estoy viendo"])[0]).not.toMatch(/te conecto/);
  });
});

// Víctor's report (27-b): urgent request with "no necesito buscar proveedores"
describe("urgent request: attention prevails over the word 'proveedores'", () => {
  const Q = "Mi carga llega mañana a Guatemala y necesito que un ejecutivo de SEAL revise mi caso hoy. Ya tengo documentos y no necesito buscar proveedores.";
  it("detected as cargo on its way, contact first, nothing about suppliers or the form", () => {
    expect(contactIntent(Q)).toBe("carga_en_camino");
    expect(replyKinds(Q)).toEqual(["contact"]);
    const r = replayConversation([Q])[0];
    expect(r).toMatch(/^Si tu carga ya viene en camino, SEAL te atiende directamente/);
    expect(r).toMatch(/Enviar mi caso a SEAL/);
    expect(r).toMatch(/Como es urgente/);
    expect(r).toMatch(/No puedo garantizarte desde aquí un tiempo de atención ni el resultado del despacho/);
    expect(r).not.toMatch(/No puedo confirmar si un proveedor|formulario|índice referencial/);
  });
  it("same in a conversation that already talked about a product", () => {
    const r = replayConversation(["Quiero importar termos de acero", Q]);
    expect(r[1]).toMatch(/^Si tu carga ya viene en camino/);
    expect(r[1]).not.toMatch(/No puedo confirmar si un proveedor/);
  });
  const more: [string, string][] = [
    ["Necesito que un ejecutivo revise mi caso hoy", "hablar_persona"],
    ["Que SEAL revise mi caso, ya tengo los documentos", "documentos"],
    ["Ya tengo el BL y la factura comercial", "documentos"],
    ["Mi contenedor llega el viernes", "carga_en_camino"],
    ["El embarque llega mañana", "carga_en_camino"],
    ["No necesito buscar proveedores", "ya_tiene_proveedor"],
    ["No necesito proveedor, solo el despacho", "ya_tiene_proveedor"],
    ["My shipment arrives tomorrow and I need someone from SEAL to review my case today", "carga_en_camino"],
    ["I don't need to search for suppliers", "ya_tiene_proveedor"],
    ["Aún no tengo proforma, pero quiero hablar con alguien", "hablar_persona"],
    ["No tengo documentos todavía", ""],
    ["No quiero hablar con nadie, solo ver precios", ""],
  ];
  for (const [q, k] of more) it(`${q} → ${k || "none"}`, () => expect(contactIntent(q)).toBe(k));
  it("EN urgent", () => {
    setLang("en");
    const r = replayConversation(["My shipment arrives tomorrow and I need someone from SEAL to review my case today. I don't need to search for suppliers."])[0];
    expect(r).toMatch(/^If your cargo is already on its way/);
    expect(r).toMatch(/Since it's urgent/);
    expect(r).not.toMatch(/reliable|the form/);
  });
  it("not urgent: no urgency sentence", () => {
    expect(replayConversation(["Tengo proforma"])[0]).not.toMatch(/urgente/);
  });
});

// Víctor's report (27-d): "¿ya llegó mi solicitud?" without having pressed Send
import { requestStatusQuestion, buildReply, nextSpec } from "../src/utils/chatReply";
describe("asking whether the request arrived", () => {
  const YES = [
    "¿Ya llegó mi solicitud? Aclaro que no he pulsado Enviar",
    "¿Recibieron mi solicitud?",
    "¿Ya les llegó mi caso?",
    "¿Mi solicitud ya fue recibida?",
    "¿Quedó registrada mi solicitud?",
    "Did you get my request?",
    "Has my request arrived?",
  ];
  const NO = ["Mi carga ya llegó al puerto", "¿Cuándo llega mi pedido?", "Quiero enviar una solicitud", "Necesito 200 pares; cada caja trae 20 pares"];
  for (const q of YES) it(`${q} → status question`, () => expect(requestStatusQuestion(q)).toBe(true));
  for (const q of NO) it(`${q} → not a status question`, () => expect(requestStatusQuestion(q)).toBe(false));
  it("nothing sent: explains it must be filled in and sent, no 'open questions' answer", () => {
    const r = replayConversation(["¿Ya llegó mi solicitud? No he pulsado Enviar"])[0];
    expect(r).toMatch(/^Todavía no: aún debes completar y enviar el formulario «Enviar mi caso a SEAL»/);
    expect(r).toMatch(/recibirás la confirmación con tu número de caso/);
    expect(r).not.toMatch(/preguntas abiertas|proveedor/);
  });
  it("sent from this tab: gives the real case number", () => {
    const spec = { ...nextSpec("¿Recibieron mi solicitud?", [], "", 0), sentCase: "SEAL-20261027-ABC123" };
    expect(buildReply(spec)).toMatch(/^Sí: tu solicitud quedó registrada con el número de caso SEAL-20261027-ABC123/);
  });
  it("EN", () => {
    setLang("en");
    expect(replayConversation(["Did you get my request?"])[0]).toMatch(/^Not yet: you still need to fill in and send/);
  });
  it("the calculation follow-up still works (500 pencils, then 1001 with the same pack)", () => {
    const r = replayConversation(["Necesito 500 lápices, vienen 120 por caja. ¿Cuántas cajas?", "¿Y si necesito 1001 con el mismo empaque?"]);
    expect(r[1]).toMatch(/9 cajas/);
    expect(r[1]).toMatch(/1,080/);
    expect(r[1]).toMatch(/79/);
  });
});

// Víctor's report (27-h): review request with a negation, product subtotal, implied verbs
describe("27-i: review request, subtotal, natural pack wordings", () => {
  it("«revisión de la proforma por SEAL, no buscar proveedores» → SEAL first, nothing about reliability", () => {
    const q = "Necesito revisión de la proforma por SEAL, no buscar proveedores";
    expect(contactIntent(q)).toBe("proforma");
    const r = replayConversation([q])[0];
    expect(r).toMatch(/^Con una proforma, lo mejor es que SEAL la revise/);
    expect(r).toMatch(/Enviar mi caso a SEAL/);
    expect(r).not.toMatch(/confiable|índice referencial|formulario/);
  });
  for (const q of ["Quiero que SEAL revise mi proforma", "Pueden revisar la proforma que me mandaron?", "I need a review of my proforma"])
    it(`${q} → proforma`, () => expect(contactIntent(q)).toBe("proforma"));
  it("subtotal: 2,000 guantes a US$0.03 cada uno = US$60, not a quote", () => {
    const r = replayConversation(["¿Cuánto serían 2,000 guantes a US$0.03 cada uno?"])[0];
    expect(r).toMatch(/^2,000 guantes × US\$0\.03 = US\$60\.00 de producto, con el precio que indicaste/);
    expect(r).toMatch(/no una cotización confirmada/);
    expect(r).not.toMatch(/preguntas abiertas/);
  });
  for (const [q, total] of [["2000 guantes a 0.03 dólares c/u", "US\\$60\\.00"], ["Si compro 500 sillas a $12.50 cada una, ¿cuánto es?", "US\\$6,250\\.00"], ["1.500 piezas a US$2 por unidad", "US\\$3,000\\.00"]] as [string, string][])
    it(`${q} → ${total}`, () => expect(replayConversation([q])[0]).toMatch(new RegExp(`= ${total} de producto`)));
  it("pack content is not a price: «500 piezas a 25 por caja» stays a pack calculation", () => {
    expect(replyKinds("Necesito 500 piezas a 25 por caja, ¿cuántas cajas?")[0]).toBe("math");
  });
  it("«cada set trae 12 y cada caja 10 sets» keeps the box→sets relation", () => {
    const r = replayConversation(["Necesito 500 lápices. Cada set trae 12 y cada caja 10 sets. ¿Cuántas cajas?"])[0];
    expect(r).toMatch(/Cada caja trae 10 sets de 12 lápices = 120 lápices\. Necesitarías 5 cajas/);
  });
  it("with a minimum in boxes: applied, not «otra unidad»", () => {
    const r = replayConversation(["Necesito 1000 lápices; cada set trae 12, cada caja 10 sets, mínimo 5 cajas. ¿Cuántas cajas?"])[0];
    expect(r).toMatch(/Necesitarías 9 cajas/);
    expect(r).toMatch(/Cumples el mínimo de 5 cajas/);
  });
  it("if the relation is missing it asks instead of concluding", () => {
    const r = replayConversation(["Necesito 1000 lápices; cada set trae 12, mínimo 5 cajas. ¿Cuántos sets?"])[0];
    expect(r).toMatch(/necesito un dato: ¿cuántos sets trae cada caja\?/);
    expect(r).not.toMatch(/otra unidad/);
  });
});

describe("27-j: an order counted in the outer packs is boxes, never pieces", () => {
  const last = (m: string) => replayConversation([m], "guantes").slice(-1)[0];
  for (const m of [
    "Cada set trae 12 y cada caja 10 sets, quiero 5 cajas",
    "Quiero 5 cajas; cada caja tiene 10 sets de 12",
    "5 cajas, cada caja con 10 sets y cada set con 12 piezas",
    "necesito 5 cajas de 10 sets de 12",
  ])
    it(m, () => {
      const r = last(m);
      expect(r).toMatch(/5 cajas \(50 sets\) de 120 son 600 piezas/);
      expect(r).not.toMatch(/Necesitarías 1 caja|115 piezas adicionales/);
    });
  it("pairs keep their unit", () => expect(last("5 masters, cada master trae 4 cajas de 12 pares")).toMatch(/240 pares/));
  it("boxes of sets with no content per set: counted in sets", () => expect(last("quiero 5 cajas de 10 sets")).toMatch(/son 50 sets/));
  it("an order in items still goes the long way", () => expect(last("Cada set trae 12 y cada caja 10 sets, necesito 500 piezas")).toMatch(/Necesitarías 5 cajas \(50 sets\): 600 piezas/));
});

describe("27-j: a quick subtotal never replaces the case product", () => {
  it("«2,000 guantes a US$0.03» keeps «lapiceros de colores»", () => {
    const s = nextSpec("Son 2,000 guantes a US$0.03 cada uno, ¿cuánto es?", [], "lapiceros de colores", 0);
    expect(s.product).toBe("lapiceros de colores");
    expect(s.mentioned).toBeUndefined();
    expect(s.newProduct).toBeUndefined();
  });
  it("a price is never part of a product name", () => expect(productMention("Me interesan guantes a US$0.03 cada uno")).toBe("guantes"));
});
