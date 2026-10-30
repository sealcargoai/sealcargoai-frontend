// CIERRE 29-b — the preview sandbox (utils/sandbox.ts): what it answers in the browser and what it
// lets through. Environment: local unit test (no network).
import { describe, it, expect } from "vitest";
import { sandboxResponse } from "../src/utils/sandbox";

const st = () => ({ sent: [] as { url: string; body: unknown; at: number }[], blocked: [] as string[] });
const API = "https://sealcargoai-backend-production.up.railway.app";

describe("sandbox: nothing that creates a lead, an email, an event or spends a search leaves the browser", () => {
  it("quote: simulated case number, payload kept for inspection", async () => {
    const s = st();
    const r = sandboxResponse(`${API}/api/email/quote`, "POST", { product: "x", quantity: "4" }, s)!;
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.id).toMatch(/^SEAL-SANDBOX-/);
    expect(j.test).toBe(true);
    expect(s.sent[0].body).toEqual({ product: "x", quantity: "4" });
  });
  for (const p of ["/api/email/lead", "/api/email/report"])
    it(`${p}: answered locally`, () => {
      const s = st();
      expect(sandboxResponse(`${API}${p}`, "POST", {}, s)!.status).toBe(200);
      expect(s.sent.length).toBe(1);
    });
  it("events dropped; search refused; any other write refused", () => {
    const s = st();
    expect(sandboxResponse(`${API}/api/events`, "POST", {}, s)!.status).toBe(204);
    expect(sandboxResponse(`${API}/api/suppliers/search`, "POST", {}, s)!.status).toBe(503);
    expect(sandboxResponse(`${API}/api/leads/act/SEAL-1`, "POST", {}, s)!.status).toBe(503);
    expect(sandboxResponse("http://localhost:3001/api/anything", "PUT", {}, s)!.status).toBe(503);
  });
  it("quota simulated; read-only GET rates and non-API URLs pass", () => {
    const s = st();
    expect(sandboxResponse(`${API}/api/suppliers/quota?email=a`, "GET", undefined, s)!.status).toBe(200);
    expect(sandboxResponse(`${API}/api/rates`, "GET", undefined, s)).toBeNull();
    expect(sandboxResponse("https://example.com/logo.png", "GET", undefined, s)).toBeNull();
  });
});
