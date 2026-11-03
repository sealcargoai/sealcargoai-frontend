// 02-11i — coherencia del frontend con la identidad exacta del servidor. Si la búsqueda se rechaza por
// el correo («email_not_supported»: un correo con tildes guardado antes de 02-11h), la página lo dice y
// no culpa a la descripción ni a la cantidad. La página no decide quién es QA (solo el servidor).
import { describe, it, expect } from "vitest";
import fs from "node:fs";

const src = fs.readFileSync("src/app/components/ProductQualification.tsx", "utf8");

describe("búsqueda rechazada por el correo", () => {
  it("lee el código de error del 400 y muestra un mensaje sobre el correo", () => {
    expect(src).toMatch(/response\.status === 400\) e\.code = String\(\(await response\.json\(\)/);
    const i = src.indexOf('e?.code === "email_not_supported"');
    const j = src.indexOf("e?.status && e.status >= 400 && e.status < 500");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(j); // checked before the generic «revisa la descripción y la cantidad»
    expect(src.slice(i, j)).toMatch(/Tu correo tiene tildes, eñes o caracteres especiales/);
    expect(src.slice(i, j)).toMatch(/Your email has accents or special characters/);
  });
});

describe("la página no clasifica QA por el correo", () => {
  it("ningún componente decide QA con «+etiqueta» ni con la lista QA", () => {
    for (const f of ["src/utils/funnel.ts", "src/app/components/FinalCTA.tsx", "src/app/components/LandingPage.tsx", "src/app/components/ContactSeal.tsx"]) {
      const s = fs.readFileSync(f, "utf8");
      expect(s, f).not.toMatch(/QA_EMAILS|\.replace\(\/\\\+\.\*/);
    }
  });
});
