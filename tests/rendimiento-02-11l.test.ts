// 02-11l — rendimiento: imagen del logo, rutas diferidas, exportaciones bajo demanda, ExcelJS sin eval;
// y mensajes de la verificación (espera indicada por el servidor, almacén no disponible).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, statSync, readdirSync } from "node:fs";

const store: Record<string, string> = {};
(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const srcFiles = (dir: string): string[] =>
  readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? srcFiles(`${dir}${d.name}/`) : /\.(tsx?|css)$/.test(d.name) ? [`${dir}${d.name}`] : []));

describe("imagen del logo", () => {
  it("ninguna pantalla importa el PNG de 2.2 MB; el WebP pesa menos de 40 KB", () => {
    const all = srcFiles("../src/").map(read).join("\n");
    expect(all).not.toMatch(/ChatGPT_Image_Apr_27/);
    expect(all).toMatch(/imports\/seal-logo\.webp/);
    expect(statSync(new URL("../src/imports/seal-logo.webp", import.meta.url)).size).toBeLessThan(40_000);
  });
});

describe("paquete inicial", () => {
  const routes = read("../src/app/routes.tsx");
  it("chat y formulario se cargan diferidos (y se precargan cuando la portada está libre)", () => {
    expect(routes).not.toMatch(/^import .*(ChatInterface|ProductQualification)/m);
    expect(routes).toMatch(/path: "chat", lazy: \(\) => import\("\.\/components\/ChatInterface"\)/);
    expect(routes).toMatch(/path: "qualify", lazy: \(\) => import\("\.\/components\/ProductQualification"\)/);
    expect(routes).toMatch(/requestIdleCallback/);
  });
  it("ExcelJS y jsPDF solo entran por import() dinámico, nunca por import estático de una pantalla", () => {
    for (const f of srcFiles("../src/").filter((x) => !/reportExports|costPdf|lazyExports/.test(x))) {
      const s = read(f);
      expect(s, f).not.toMatch(/from\s+["'](?:exceljs|jspdf|jspdf-autotable)["']/);
      expect(s, f).not.toMatch(/from\s+["'][./]*(?:utils\/)?(?:reportExports|costPdf)["']/);
    }
    expect(read("../src/utils/lazyExports.ts")).toMatch(/import\("\.\/reportExports"\)/);
  });
  it("ExcelJS 4.x: su distribución de navegador ya no trae eval", () => {
    const pkg = JSON.parse(read("../node_modules/exceljs/package.json"));
    expect(Number(pkg.version.split(".")[0])).toBeGreaterThanOrEqual(4);
    expect(read("../node_modules/exceljs/dist/exceljs.min.js")).not.toMatch(/\beval\(/);
  });
});

describe("verificación: respuestas del servidor (02-11l)", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });
  it("429 con espera progresiva → «limit» y los segundos indicados; 503 → «unavailable»", async () => {
    const v = await import("../src/utils/verifiedEmail");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "verify_limit", retryAfterSeconds: 30 }), { status: 429 }));
    expect(await v.startVerification("a@cliente-ficticio.test", "es")).toBe("limit");
    expect(v.lastRetryAfterSeconds).toBe(30);
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "verify_unavailable" }), { status: 503 }));
    expect(await v.startVerification("a@cliente-ficticio.test", "es")).toBe("unavailable");
    expect(await v.confirmVerification("a@cliente-ficticio.test", "ABCDE23456")).toEqual({ ok: false, reason: "unavailable" });
  });
  it("la pantalla del informe: espera indicada, «Ya tengo un código» y almacén caído sin enviar nada", () => {
    const s = read("../src/app/components/FinalCTA.tsx");
    expect(s).toMatch(/Ya tengo un código/);
    expect(s).toMatch(/lastRetryAfterSeconds/);
    // 02-11m: a wait of hours is said in hours (the daily cap per address)
    expect(s).toMatch(/hrs === 1 \? "hora" : "horas"/);
    // 02-11n: 10-character codes (letters and digits), typed as text
    expect(s).toMatch(/aria-label=\{L\("Código de 10 caracteres", "10-character code"\)\}/);
    // 02-11n: the daily report cap is said as such, in both languages
    expect(s).toMatch(/máximo de informes de hoy \(3 en 24 horas\)/);
    expect(s).toMatch(/today's maximum of reports \(3 in 24 hours\)/);
    expect(s).toMatch(/inputMode="text"/);
    expect(s).not.toMatch(/6 dígitos|6-digit|8 caracteres|8-character/);
    expect(s).toMatch(/hrs === 1 \? "hour" : "hours"/);
    expect(s).toMatch(/res\.status === 503 && refusalError === "verify_unavailable"/);
    expect(s).toMatch(/no está disponible en este momento y no se envió nada/);
    expect(s).toMatch(/is unavailable right now and nothing was sent/);
    // the unused authorization is kept for a retry (no new code needed when nothing was sent)
    expect(s).toMatch(/setPendingGrant\(\{ email: emailRecipient\.trim\(\), grant: v\.reportGrant \}\)/);
    expect(s).toMatch(/const reuse = renewed \|\| \(pendingGrant && pendingGrant\.email === emailRecipient\.trim\(\)/);
  });
});
