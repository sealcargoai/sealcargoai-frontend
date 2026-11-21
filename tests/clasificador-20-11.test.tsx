// @vitest-environment jsdom
// 20-11 — Clasificador arancelario: el DAI elegido se usa en la estimación solo para ese producto; la
// página recorre datos → código → mercancía → resultado con fetch simulado (nada sale).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LanguageProvider } from "../src/app/context/LanguageContext";
import { saveDutyForCase, dutyForCurrentCase, clearSavedDuty, type ClassificationResult } from "../src/utils/classification";
import { calculateCosts, scenarioVariables, DEFAULT_RATES } from "../src/utils/costCalculator";
import { TariffClassifier } from "../src/app/components/TariffClassifier";

const RESULT: ClassificationResult = {
  inciso: "6403.99.90.00",
  descripcion: "CALZADO CON SUELA DE CAUCHO, PLÁSTICO, CUERO NATURAL O REGENERADO Y PARTE SUPERIOR DE CUERO NATURAL > Los demás calzados: > Los demás: > Otros",
  confianza: "media",
  resumen: "Zapato de cuero con suela de caucho.",
  descripcionTecnica: "Calzado de cuero natural.",
  fundamento: { reglas_aplicadas: "RGI 1 y 6", naturaleza: "cuero" },
  alternativas: [{ inciso: "6403.91.90.00", cuando: "si cubre el tobillo", descripcion: "…" }],
  datosFaltantes: ["¿Cubre el tobillo?"],
  origen: { iso: "ES", nombre: "España" },
  dai: { general: { pct: 15, text: "15%" }, preferencial: { agreement: "Acuerdo de Asociación Unión Europea – Centroamérica", column: "EU", pct: 1, text: "1%", note: "reglas de origen" }, aplicable: 1, nota: [] },
  iva: 12,
  permisos: [],
  fuente: "Arancel 2026",
  aviso: "Clasificación preliminar.",
  caso: "C-1",
  restantes: 2,
};

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DAI del clasificador en la estimación", () => {
  it("se guarda ligado al producto y solo aplica a ese producto", () => {
    const s = saveDutyForCase("zapato casual de cuero", RESULT);
    expect(s?.dutyRate).toBeCloseTo(0.01, 9);
    expect(s?.basis).toMatch(/Unión Europea/);
    expect(dutyForCurrentCase("zapatos casuales de cuero para hombre")?.inciso).toBe("6403.99.90.00");
    expect(dutyForCurrentCase("bomba de agua sumergible")).toBeNull();
    clearSavedDuty();
    expect(dutyForCurrentCase("zapato casual de cuero")).toBeNull();
  });
  it("sin tratado aplicable se usa el DAI general", () => {
    const s = saveDutyForCase("zapato", { ...RESULT, origen: { iso: "CN", nombre: "China" }, dai: { general: { pct: 15, text: "15%" }, preferencial: null, aplicable: 15, nota: [] } });
    expect(s?.dutyRate).toBeCloseTo(0.15, 9);
    expect(s?.basis).toBe("DAI general (NMF)");
  });
  it("un DAI desconocido (contingente) no reemplaza la referencia", () => {
    expect(saveDutyForCase("azúcar", { ...RESULT, dai: { ...RESULT.dai, aplicable: null } })).toBeNull();
  });
  it("la fila del DAI y las variables dicen el inciso y la base", () => {
    const rates = { ...DEFAULT_RATES, dutyRate: 0.01, dutySource: { inciso: "6403.99.90.00", basis: "Acuerdo de Asociación Unión Europea – Centroamérica" } };
    const c = calculateCosts({ price: 10, quantity: 100 }, rates);
    const duty = c.lines.find((l) => l.key === "duties")!;
    expect(duty.label).toMatch(/6403\.99\.90\.00/);
    expect(c.importDuties).toBeCloseTo(c.cif * 0.01, 6);
    expect(scenarioVariables(c).join(" ")).toMatch(/clasificador SEAL \(inciso 6403\.99\.90\.00/);
    // without a classification nothing changes
    expect(scenarioVariables(calculateCosts({ price: 10, quantity: 100 })).join(" ")).toMatch(/como referencia/);
  });
});

describe("página /clasificador", () => {
  it("datos → código → mercancía → resultado, con el DAI general y preferencial", async () => {
    const calls: { url: string; body: any; headers: any }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, body, headers: init?.headers });
      const ok = (j: unknown) => ({ ok: true, status: 200, json: async () => j });
      if (url.includes("/verify/start")) return ok({ sent: true });
      if (url.includes("/verify/confirm")) return ok({ verified: true, session: "sess-123", reportGrant: "g", sessionSeconds: 3600, grantSeconds: 60 });
      if (url.includes("/classify/quota")) return ok({ remaining: 3 });
      if (url.includes("/api/classify")) return ok(RESULT);
      return ok({});
    }));
    render(
      <LanguageProvider>
        <MemoryRouter>
          <TariffClassifier />
        </MemoryRouter>
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByText(/Consultar mi mercancía/));
    const inputs = () => Array.from(document.querySelectorAll("input"));
    fireEvent.change(inputs()[0], { target: { value: "Ana Prueba" } });
    fireEvent.change(inputs()[1], { target: { value: "+502 5555 1111" } });
    fireEvent.change(inputs()[2], { target: { value: "ana@ficticio.test" } });
    fireEvent.click(screen.getByText(/Continuar/));
    expect(await screen.findByText(/Para continuar, acepte/)).toBeTruthy();
    fireEvent.click(document.querySelector('input[type="checkbox"]')!);
    fireEvent.click(screen.getByText(/Continuar/));
    await screen.findByText(/Le enviamos un código/);
    fireEvent.change(document.querySelector('input[autocomplete="one-time-code"]')!, { target: { value: "ABCDE-12345" } });
    fireEvent.click(screen.getByText(/Confirmar correo/));
    await screen.findByText(/Información de la mercancía/);
    expect(screen.getByText(/Consultas disponibles con este correo: 3/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Clasificar mi mercancía/));
    expect(await screen.findByText(/Escriba el nombre comercial/)).toBeTruthy();
    fireEvent.change(inputs()[0], { target: { value: "Zapato casual de hombre" } });
    fireEvent.change(document.querySelector("textarea")!, { target: { value: "Zapato de cuero natural con suela de caucho" } });
    fireEvent.change(document.querySelector("select")!, { target: { value: "ES" } });
    fireEvent.click(screen.getByText(/Clasificar mi mercancía/));
    await screen.findByText("6403.99.90.00");
    const sent = calls.find((c) => c.url.endsWith("/api/classify"))!;
    expect(sent.headers["X-Verified-Session"]).toBe("sess-123");
    expect(sent.body).toMatchObject({ name: "Ana Prueba", phone: "+502 5555 1111", email: "ana@ficticio.test", productName: "Zapato casual de hombre", origin: "ES" });
    expect(screen.getByText("15%")).toBeTruthy();
    expect(screen.getByText("1%")).toBeTruthy();
    expect(screen.getByText(/No identificamos permisos/)).toBeTruthy();
    fireEvent.click(screen.getByText(/Usar este DAI \(1%\)/));
    await waitFor(() => expect(screen.getByText(/el cálculo de importación usará un DAI de 1%/)).toBeTruthy());
    expect(dutyForCurrentCase("Zapato casual de hombre")?.inciso).toBe("6403.99.90.00");
  });
});
