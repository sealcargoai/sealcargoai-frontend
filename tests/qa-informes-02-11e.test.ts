// 02-11e — respuesta del servidor al envío de informes: un rechazo QA no se confunde con «no se pudo
// enviar desde aquí» (que descarga el PDF y sugiere reenviarlo).
import { describe, it, expect } from "vitest";
import { reportRefusal } from "../src/utils/reportSend";
import fs from "node:fs";

describe("reportRefusal", () => {
  it("403 qa_recipient_not_allowed → rechazo QA (no se envió nada)", () => {
    expect(reportRefusal(403, "qa_recipient_not_allowed")).toBe("qa_recipient");
  });
  it("503 → enrutamiento QA no disponible", () => expect(reportRefusal(503, "qa_routing_unavailable")).toBe("qa_routing"));
  it("403 de sesión y 429 de límite → no enviado desde aquí (se descarga el PDF)", () => {
    expect(reportRefusal(403, "report_not_allowed")).toBe("not_sent_here");
    expect(reportRefusal(403)).toBe("not_sent_here");
    expect(reportRefusal(429, "report_limit")).toBe("not_sent_here");
  });
  it("400 → correo inválido; 200 → no es rechazo", () => {
    expect(reportRefusal(400)).toBe("invalid_email");
    expect(reportRefusal(200)).toBeNull();
  });
  it("la página no decide quién es QA: el envío no lleva marcas de prueba del navegador", () => {
    const src = fs.readFileSync("src/app/components/FinalCTA.tsx", "utf8");
    const body = src.slice(src.indexOf("/api/email/report"), src.indexOf("lang: Lx(\"es\", \"en\")"));
    expect(body).not.toMatch(/isQaSession|qa=1|\btest\s*:/);
    expect(src).toMatch(/reportRefusal\(res\.status/);
  });
});
