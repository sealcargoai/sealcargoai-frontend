// 02-11h — el correo se escribe solo en ASCII imprimible, igual que exige el servidor: una dirección con
// tildes, eñes, homógrafos o caracteres invisibles recibe un mensaje claro antes de enviar nada.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { emailProblem } from "../src/utils/emailFormat";

describe("emailProblem", () => {
  it("direcciones ASCII válidas pasan (también alias + y mayúsculas)", () => {
    for (const e of ["ana@empresa.com", " Ana.Qa+informes@Empresa.GT ", "a_b-c@xn--prueba-9za.test"]) expect(emailProblem(e)).toBeNull();
  });
  it("Unicode, homógrafos, IDN sin punycode e invisibles → «unsupported»", () => {
    for (const e of ["Ka@prueba.test", "kа@prueba.test", "ｋａ@prueba.test", "k​a@prueba.test", "josé@empresa.gt", "ana@pruéba.test", "ká@prueba.test"])
      expect(emailProblem(e), JSON.stringify(e)).toBe("unsupported");
  });
  it("formato incompleto → «format»", () => {
    for (const e of ["", "ana", "ana@", "ana@empresa", "ana@@empresa.com"]) expect(emailProblem(e)).toBe("format");
  });
  it("inicio y «Hablar con SEAL» usan la misma regla", () => {
    for (const f of ["src/app/components/LandingPage.tsx", "src/app/components/ContactSeal.tsx"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).toMatch(/emailProblem\(/);
      expect(src).toMatch(/sin tildes, eñes ni caracteres especiales/);
    }
  });
});
