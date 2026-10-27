// Whoever wants to move forward is sent to SEAL first, before general answers.
import { describe, it, expect, afterEach } from "vitest";
import { contactIntent, replyKinds, replayConversation } from "../src/utils/chatReply";

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
    expect(r).toMatch(/^Claro, te conecto con una persona de SEAL/);
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
    expect(r.indexOf("te conecto con SEAL")).toBeLessThan(r.indexOf("estimación preliminar"));
  });
  it("contact first even with a calculation", () => {
    expect(replyKinds("Mi carga ya viene: 300 piezas en cajas de 25, ¿cuántas cajas son?")[0]).toBe("contact");
  });
  it("in the middle of a conversation, without losing the product", () => {
    const r = replayConversation(["Quiero importar termos de acero", "Quiero hablar con alguien", "¿Necesito certificado?"]);
    expect(r[1]).toMatch(/te conecto con una persona de SEAL/);
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
