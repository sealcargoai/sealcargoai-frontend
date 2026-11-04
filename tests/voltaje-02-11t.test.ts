// 02-11t — Voltaje del EQUIPO (no de un componente) y mismo veredicto y razón que el servidor.
// tests/fixtures/voltage-vectors.json es copia exacta de backend test/fixtures/voltage-vectors.json.
import { describe, it, expect, afterEach } from "vitest";
import vectors from "./fixtures/voltage-vectors.json";
import { listingVerdict } from "../src/utils/differences";
import { flagComponents } from "../src/utils/componentMatch";
import { voltageCheck } from "../src/utils/voltage";

const setLang = (l: "es" | "en") => ((globalThis as any).document = { documentElement: { lang: l } });
afterEach(() => setLang("es"));
const verdictOf = (d: string, t: string) => listingVerdict(d, flagComponents([{ productName: t, price: 10 }], d)[0]);

describe("vectores compartidos con el servidor", () => {
  it.each(vectors.map((v) => [v.t, v]))("%s", (_t, v) => {
    for (const lang of ["es", "en"] as const) {
      setLang(lang);
      const r = verdictOf(v.d, v.t);
      expect(r.verdict, `${lang}: ${v.d} / ${v.t}`).toBe(v.expect);
      const words = lang === "es" ? v.es : v.en;
      if (words && v.sameWords) expect([...r.reasons, ...r.toConfirm].join(" ")).toContain(words);
    }
  });
});

describe("Hz, W, kW, kV y mAh no son voltaje", () => {
  it.each(["Screw compressor 220Hz", "Screw compressor 220W", "Screw compressor 220kW", "Screw compressor 220 kV", "Battery 2200mAh compressor", "Screw compressor 380 kw 50/60Hz"])("%s", (t) => {
    const v = voltageCheck("compresor de tornillo 220 V", t);
    expect(v?.verdict).toBe("confirm");
    expect(v?.es).toMatch(/^Voltaje del equipo por confirmar; pediste 220 V$/);
  });
});

describe("no se inventan variantes ni coincidencias", () => {
  it("un título con dos cifras sin decir a qué corresponden no es «variante» ni coincidencia", () => {
    const v = voltageCheck("compresor de tornillo 220 V", "Screw compressor 220V 380V");
    expect(v?.verdict).toBe("confirm");
    expect(v?.es).toMatch(/sin decir a qué corresponde cada cifra/);
    expect(v?.es).not.toMatch(/variante/);
  });
  it("la coincidencia se dice «según el anuncio» en la pantalla, nunca como verificación", () => {
    const v = voltageCheck("compresor de tornillo 220 V", "Screw compressor 220V");
    expect(v?.verdict).toBe("match");
    expect(v?.es).not.toMatch(/verific|SEAL/i);
  });
});
