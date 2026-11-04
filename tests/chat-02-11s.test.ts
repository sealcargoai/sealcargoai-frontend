// 02-11s — Chat: orientación con pasos concretos (baterías de litio por avión; qué pedir antes del anticipo),
// sin afirmar que la carga está autorizada ni que el proveedor es confiable; preguntas combinadas con un
// cambio del caso; hipótesis y negaciones. Datos ficticios.
import { describe, it, expect, afterEach } from "vitest";
import { replayConversation } from "../src/utils/chatReply";

const setLang = (l: "es" | "en") => ((globalThis as any).document = { documentElement: { lang: l } });
afterEach(() => setLang("es"));
const reply = (q: string, msg: string) => replayConversation([msg], q).join("\n");
// affirmative claims the tool must never make
const PROMISE = /(?:^|[.;:]\s*)(?:s[ií],?\s+)?(?:puedes|se\s+puede|est[aá]\s+permitid|est[aá]n?\s+autorizad|ser[aá]\s+aceptad|es\s+confiable|es\s+seguro\s+pagar|you\s+can\s+ship|it\s+is\s+allowed|is\s+reliable)/i;

describe("baterías de litio por avión", () => {
  it("ES: pide los datos técnicos y de embalaje, deja la decisión al transportista y lleva a SEAL", () => {
    const r = reply("baterías de litio para scooters", "¿Puedo importar baterías de litio por avión?");
    for (const must of [/mercanc[ií]a peligrosa/, /Wh/, /UN38\.3/, /MSDS\/SDS/, /embalaje/, /estado de carga/, /transportista/, /SEAL/, /\+502 5996 4664/])
      expect(r).toMatch(must);
    expect(r).toMatch(/no puedo confirmar que tu carga sea aceptada/);
    expect(r).not.toMatch(PROMISE);
    expect(r).not.toMatch(/no respondo preguntas abiertas/);
  });
  it("EN", () => {
    setLang("en");
    const r = reply("lithium batteries for scooters", "Can I import lithium batteries by air?");
    expect(r).toMatch(/dangerous goods/);
    expect(r).toMatch(/UN38\.3/);
    expect(r).toMatch(/I can't confirm your cargo will be accepted/);
    expect(r).not.toMatch(/[áéíóúñ¿]/);
  });
  it("hipótesis: responde sin cambiar el producto del caso", () => {
    const r = reply("scooters eléctricos", "¿Y si fueran baterías de litio sueltas, se pueden mandar por avión?");
    expect(r).toMatch(/mercanc[ií]a peligrosa/);
    expect(r).not.toMatch(/Actualizado|Tu producto ahora es/);
  });
  it("negación: «no son baterías de litio, son sillas» no recibe la orientación de baterías", () => {
    expect(reply("sillas plásticas apilables", "no quiero baterías de litio, son sillas")).not.toMatch(/mercanc[ií]a peligrosa/);
  });
});

describe("qué pedir antes de pagar el anticipo", () => {
  it("ES: proforma, especificaciones, condiciones de pago y beneficiario = proveedor; sin aval del proveedor", () => {
    const r = reply("sillas plásticas apilables", "¿Qué le pido al proveedor antes de pagar el anticipo?");
    for (const must of [/proforma/, /especificaciones/, /Incoterm/, /condiciones de pago/, /saldo/, /beneficiario de la cuenta bancaria sea la misma empresa/, /canal distinto/, /no confirma que el proveedor sea confiable/, /SEAL/])
      expect(r).toMatch(must);
    expect(r).not.toMatch(PROMISE);
    // the earlier generic answer is gone
    expect(r).not.toMatch(/continúa con el formulario para ver opciones ordenadas/);
  });
  it("EN", () => {
    setLang("en");
    const r = reply("plastic chairs", "What should I ask the supplier before paying the deposit?");
    expect(r).toMatch(/proforma invoice/);
    expect(r).toMatch(/bank account beneficiary is the same company/);
    expect(r).not.toMatch(/[áéíóúñ¿]/);
  });
  it("«¿me garantizan que es confiable si pago el anticipo?»: no promete y no habla de permisos de aduana", () => {
    const r = reply("sillas plásticas apilables", "¿Me garantizan que el proveedor es confiable si pago el anticipo?");
    expect(r).toMatch(/no confirma que el proveedor sea confiable/);
    expect(r).not.toMatch(/pase la aduana/);
  });
  it("el cálculo del anticipo sigue funcionando (no se reemplaza por la orientación)", () => {
    expect(reply("sillas plásticas apilables", "El anticipo es del 30%, ¿cuánto pago si son 200 sillas a US$12?")).toMatch(/US\$2,400\.00/);
  });
});

describe("cambio del caso y pregunta en el mismo mensaje", () => {
  it("«Son 300 sillas. ¿Cuánto tarda en llegar?»: actualiza la cantidad y responde el tránsito", () => {
    const r = reply("sillas plásticas apilables", "Son 300 sillas. ¿Cuánto tarda en llegar?");
    expect(r).toMatch(/cantidad 300/);
    expect(r).toMatch(/tr[aá]nsito mar[ií]timo/);
  });
  it("si la intención es dudosa no cambia nada, lo pregunta y aun así responde la pregunta", () => {
    const r = reply("sillas plásticas apilables", "Son 300 sillas. ¿Qué le pido al proveedor antes de pagar el anticipo?");
    expect(r).toMatch(/no cambié nada/);
    expect(r).toMatch(/s[ií], apl[ií]calo/);
    expect(r).toMatch(/Antes de pagar el anticipo/);
    expect(r).not.toMatch(/«300 sillas\. Qu[eé]/);
  });
});
