// 02-11o — Desafío adaptativo (prueba de trabajo) y renovación con sesión verificada (frontend).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const store: Record<string, string> = {};
(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
const { sha256Words, leadingZeroBits, solveChallenge } = await import("../src/utils/pow");
const v = await import("../src/utils/verifiedEmail");

const hex = (w: Uint32Array) => [...w].map((x) => x.toString(16).padStart(8, "0")).join("");
const serverBits = (c: string, n: string) => {
  const d = createHash("sha256").update(`${c}:${n}`).digest();
  let bits = 0;
  for (const b of d) {
    if (b === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(b) - 24;
    break;
  }
  return bits;
};

describe("SHA-256 del navegador = el del servidor", () => {
  it("coincide en textos de 0 a 200 caracteres (cruza los bordes de bloque)", () => {
    for (let n = 0; n <= 200; n++) {
      const t = "1793790000000.AbCdEfGhIjKl.16.xyz:" .repeat(8).slice(0, n);
      expect(hex(sha256Words(t)), `n=${n}`).toBe(createHash("sha256").update(t).digest("hex"));
    }
  });
  it("cuenta los ceros iniciales igual que el servidor y resuelve un desafío de 12 bits", async () => {
    const c = "1793790000000.Q2hhbGxlbmdl.12.abcdefghijklmnopqrstuv";
    for (let n = 0; n < 300; n++) expect(leadingZeroBits(c, String(n))).toBe(serverBits(c, String(n)));
    const nonce = await solveChallenge(c, 12);
    expect(serverBits(c, nonce)).toBeGreaterThanOrEqual(12);
  });
});

describe("pedir código con desafío y renovar con sesión", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });
  it("428 → el navegador resuelve el desafío y vuelve a pedir con challenge y nonce", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_u: string, opt: { body: string }) => {
      const b = JSON.parse(opt.body);
      bodies.push(b);
      if (!b.challenge) return new Response(JSON.stringify({ error: "challenge_required", challenge: "1793790000000.Q2g.8.mac", difficulty: 8 }), { status: 428 });
      return new Response(JSON.stringify({ sent: true }), { status: 200 });
    });
    const states: boolean[] = [];
    expect(await v.startVerification("a@cliente-ficticio.test", "es", (r) => states.push(r))).toBe("sent");
    expect(bodies).toHaveLength(2);
    expect(serverBits(String(bodies[1].challenge), String(bodies[1].nonce))).toBeGreaterThanOrEqual(8);
    expect(states).toEqual([true, false]);
  });
  it("un desafío inválido o repetido sin fin no deja al navegador en un bucle", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return new Response(JSON.stringify({ error: "challenge_required", challenge: "x", difficulty: 2 }), { status: 428 });
    });
    expect(await v.startVerification("a@cliente-ficticio.test", "es")).toBe("error");
    expect(calls).toBe(4);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "challenge_required", challenge: "x", difficulty: 40 }), { status: 428 }));
    expect(await v.startVerification("a@cliente-ficticio.test", "es")).toBe("error");
  });
  it("renovar: sin sesión no llama al servidor; con sesión devuelve la autorización; si el servidor la rechaza, vuelve al código", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      calls.push(u);
      return new Response(JSON.stringify({ reportGrant: "g".repeat(43), grantSeconds: 1800 }), { status: 200 });
    });
    expect(await v.renewGrant("a@cliente-ficticio.test")).toBe("");
    expect(calls).toHaveLength(0);
    v.rememberVerifiedSession("a@cliente-ficticio.test", "s".repeat(43), 3600);
    expect(await v.renewGrant("A@Cliente-Ficticio.test")).toBe("g".repeat(43));
    expect(calls[0]).toMatch(/\/api\/email\/verify\/renew$/);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "session_invalid" }), { status: 403 }));
    expect(await v.renewGrant("a@cliente-ficticio.test")).toBe("");
  });
});

describe("02-11p: comprobación acotada", () => {
  it("informa el progreso, se puede cancelar y se detiene al llegar al tiempo máximo", async () => {
    const seen: number[] = [];
    // 30 bits is out of range: refused at once
    expect(await solveChallenge("c", 30)).toBe("");
    // impossible in time: stops at maxMs
    const t0 = Date.now();
    expect(await solveChallenge("1793790000000.Q2g.24.mac", 24, { maxMs: 300, onProgress: (p) => seen.push(p) })).toBe("");
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(seen.length).toBeGreaterThan(0);
    expect(Math.max(...seen)).toBeLessThanOrEqual(0.95);
    expect(seen.every((p, i) => i === 0 || p >= seen[i - 1])).toBe(true);
    // cancelled
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 50);
    expect(await solveChallenge("1793790000000.Q2g.24.mac", 24, { signal: ac.signal })).toBe("");
  });
  it("startVerification: cancelado → «cancelled»; sin tiempo → «too_slow» (nada se pide al servidor después)", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return new Response(JSON.stringify({ error: "challenge_required", challenge: "1793790000000.Q2g.24.mac", difficulty: 24 }), { status: 428 });
    });
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 50);
    expect(await v.startVerification("a@cliente-ficticio.test", "es", undefined, ac.signal)).toBe("cancelled");
    expect(calls).toBe(1);
    calls = 0;
    expect(await v.startVerification("a@cliente-ficticio.test", "es", undefined, undefined, 200)).toBe("too_slow");
    expect(calls).toBe(1);
  });
});

describe("pantalla del informe", () => {
  const s = readFileSync(new URL("../src/app/components/FinalCTA.tsx", import.meta.url), "utf8");
  it("intenta renovar antes de pedir un código, y avisa en ES/EN durante la comprobación", () => {
    expect(s.indexOf("renewed = await renewGrant(emailRecipient)")).toBeGreaterThan(0);
    expect(s.indexOf("renewed = await renewGrant(emailRecipient)")).toBeLessThan(s.indexOf("await startVerification("));
    expect(s).toMatch(/tu navegador hace una comprobación breve/);
    expect(s).toMatch(/your browser is doing a short check/);
  });
  it("02-11p: progreso en %, botón «Cancelar la comprobación», límite de 30 s y mensajes ES/EN de cancelado y demasiado lento", () => {
    expect(s).toMatch(/comprobación breve antes de pedir el código \(\$\{pct\} %\)/);
    expect(s).toMatch(/Cancelar la comprobación", "Cancel the check"/);
    expect(s).toMatch(/Cancelaste la comprobación; no se pidió ningún código/);
    expect(s).toMatch(/You cancelled the check; no code was requested/);
    expect(s).toMatch(/tardó demasiado en este dispositivo/);
    expect(s).toMatch(/took too long on this device/);
    expect(s).toMatch(/checkAbort\.current\?\.abort\(\)/);
  });
});
