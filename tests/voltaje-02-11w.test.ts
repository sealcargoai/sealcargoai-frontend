// 02-11w — Cualquier voltaje (24 V, 12 V DC…), AC/DC y lo que el anuncio excluye, con el mismo veredicto y las
// mismas palabras que el servidor (backend test/voltaje-02-11w.test.mjs usa estos mismos títulos).
// Lo que ve el cliente: los incompatibles salen de las recomendaciones; los que no dicen algo quedan aparte,
// «por confirmar», después de las coincidencias.
import { describe, it, expect, afterEach } from "vitest";
import { groupByVerdict } from "../src/utils/verdictGroups";
import { matchElectric } from "../src/utils/electricMatch";
import { voltageCheck } from "../src/utils/voltage";

const setLang = (l: "es" | "en") => ((globalThis as any).document = { documentElement: { lang: l } });
afterEach(() => setLang("es"));

const PUMPS = [
  "Submersible water pump 24V DC brushless",
  "Submersible water pump 12V DC",
  "Submersible water pump 220V AC",
  "Submersible water pump 24V AC",
  "Submersible water pump 48V DC",
  "Submersible water pump 24V",
  "Submersible water pump",
  "Submersible water pump 12V/24V DC",
].map((productName, i) => ({ productName, price: 100 + i }));

describe("bomba de agua sumergible 24 V DC — lo que se ve en resultados", () => {
  it.each(["es", "en"] as const)("%s: coincidencias primero, «por confirmar» aparte, incompatibles fuera", (lang) => {
    setLang(lang);
    const g = groupByVerdict(PUMPS, "bomba de agua sumergible 24 V DC");
    expect(g.shown.map((s) => [s.productName, s.verdict])).toEqual([
      ["Submersible water pump 24V DC brushless", "match"],
      ["Submersible water pump 24V", "confirm"],
      ["Submersible water pump", "confirm"],
      ["Submersible water pump 12V/24V DC", "confirm"],
    ]);
    expect(g.excluded.map((e) => e.item.productName)).toEqual([
      "Submersible water pump 12V DC",
      "Submersible water pump 220V AC",
      "Submersible water pump 24V AC",
      "Submersible water pump 48V DC",
    ]);
    const words =
      lang === "es"
        ? ["Esta publicación indica 12 V DC; solicitaste 24 V DC", "Esta publicación indica 220 V AC; solicitaste 24 V DC", "Esta publicación indica 24 V AC; solicitaste 24 V DC", "Esta publicación indica 48 V DC; solicitaste 24 V DC"]
        : ["This listing states 12 V DC; you asked for 24 V DC", "This listing states 220 V AC; you asked for 24 V DC", "This listing states 24 V AC; you asked for 24 V DC", "This listing states 48 V DC; you asked for 24 V DC"];
    g.excluded.forEach((e, i) => expect(e.reasons.join(" ")).toContain(words[i]));
    expect(g.shown[1].verdictNotes.join(" ")).toContain(
      lang === "es" ? "Tipo de corriente por confirmar: el título indica 24 V sin decir si es AC o DC; pediste 24 V DC" : "Current type to confirm: the title states 24 V without saying whether it is AC or DC; you asked for 24 V DC",
    );
  });

  it("la etiqueta de coincidencia dice el tipo pedido y nunca lo inventa", () => {
    expect(matchElectric("bomba de agua 24 V DC", "Water pump 24V DC")?.text).toBe("Indica la alimentación pedida: 24 V DC");
    expect(matchElectric("bomba de agua 24 V", "Water pump 24V DC")?.text).toBe("Indica la alimentación pedida: 24 V");
    expect(matchElectric("bomba de agua 24 V", "Water pump 12V DC")?.status).toBe("other");
  });
});

describe("220 V — negaciones y falsos negativos", () => {
  it("«380 V, not 220 V» queda fuera con el motivo del servidor", () => {
    const g = groupByVerdict([{ productName: "Oil free screw compressor 380 V, not 220 V" }, { productName: "Oil free screw compressor 220V" }], "compresor de tornillo sin aceite 220 V");
    expect(g.shown.map((s) => [s.productName, s.verdict])).toEqual([["Oil free screw compressor 220V", "match"]]);
    expect(g.excluded[0].reasons.join(" ")).toContain("Esta publicación indica 380 V y excluye 220 V; solicitaste 220 V");
  });
  it.each([
    ["compresor sin aceite 220 V", "Oil free compressor 220V", "match"],
    ["compresor de 220 V, no quiero 110 V", "Compressor 110V", "incompatible"],
    ["compresor, no 110 ni 127 V", "Compressor 127V", "incompatible"],
    ["screw compressor 220 V", "Screw compressor 380V, 220V not available", "incompatible"],
    ["compresor de tornillo 220 V", "Compresor de tornillo 380 V, no apto para 220 V", "incompatible"],
  ])("%s / %s → %s", (d, t, v) => {
    expect(voltageCheck(d, t)?.verdict ?? "match").toBe(v);
  });
});

import parity from "./fixtures/voltage-parity.json";
describe("paridad con el servidor (backend test/fixtures/voltage-parity.json)", () => {
  it("18 pedidos × 60 títulos difíciles: mismo veredicto y mismas palabras", () => {
    let i = 0;
    for (const d of parity.descriptions) for (const t of parity.titles) expect(voltageCheck(d, t), `${d} / ${t}`).toEqual(parity.results[i++]);
    expect(i).toBe(1080);
  });
});
