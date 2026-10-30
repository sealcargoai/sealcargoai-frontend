// @vitest-environment jsdom
// CIERRE 29-b — the chat page as React renders it (jsdom), under React.StrictMode.
// Environment: local, component test with mocks (fetch mocked; nothing is sent). This does NOT
// replace the browser tests of the preview (see CIERRE-29-B.md): it covers React behaviour —
// StrictMode double initializers/effects, damaged history, double clicks, key repeat, fast messages.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StrictMode } from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { LanguageProvider } from "../src/app/context/LanguageContext";
import { ChatInterface } from "../src/app/components/ChatInterface";
import { currentCase, saveFormDraft, caseVersion } from "../src/utils/caseStore";
import { caseContext } from "../src/utils/caseContext";

const C = "compresores industriales de tornillo, trifásicos 220 V, 60 Hz, tanque de 500 litros, libres de aceite";
const sent: unknown[] = [];

function mount() {
  return render(
    <StrictMode>
      <LanguageProvider>
        <MemoryRouter initialEntries={[{ pathname: "/chat", state: { query: C, name: "QA" } }]}>
          <Routes>
            <Route path="/chat" element={<ChatInterface />} />
            <Route path="/qualify" element={<div>FORM</div>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </StrictMode>,
  );
}
const input = () => screen.getByPlaceholderText(/Pregunta sobre proveedores/) as HTMLInputElement;
const sendBtn = () => input().parentElement!.querySelector("button") as HTMLButtonElement;
function type(text: string) {
  fireEvent.change(input(), { target: { value: text } });
}
const userBubbles = () => [...document.querySelectorAll("p.text-white")].map((p) => p.textContent);
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(800);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  localStorage.clear();
  sent.length = 0;
  globalThis.fetch = (async (url: string, opt?: { body?: string }) => {
    if (/\/api\/email\//.test(String(url))) sent.push(opt?.body);
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  }) as unknown as typeof fetch;
  Element.prototype.scrollIntoView = () => {};
  expect(saveFormDraft({ productType: C, quantity: "4", budget: "5000", destination: "GT", volumeCbm: "", weightKg: "" }, 2, null).ok).toBe(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("R16/D5 · a damaged stored reply never prevents opening the chat", () => {
  it("corrupted assistant JSON, wrong shapes and junk entries are dropped; the rest renders and the chat works", async () => {
    sessionStorage.setItem(
      "seal_chat",
      JSON.stringify({
        query: C,
        name: "QA",
        messages: [
          { role: "user", content: "Hola", id: 1 },
          { role: "ai", content: "{this is not json", id: 1 },
          { role: "ai", content: JSON.stringify([1, 2]), id: 2 },
          { role: "ai", content: JSON.stringify({ text: 5 }), id: 3 },
          { role: "user", content: { evil: true }, id: 4 },
          null,
          "texto suelto",
          { role: "system", content: "x" },
        ],
      }),
    );
    expect(() => mount()).not.toThrow();
    expect(screen.getByText("Hola")).toBeTruthy();
    type("Cambia la cantidad a 6");
    fireEvent.click(sendBtn());
    await settle();
    expect(document.body.textContent).toMatch(/cantidad 4 → 6/);
    expect(currentCase().quantity).toBe(6);
  });
  it("the whole saved chat not being JSON: starts clean, no crash", () => {
    sessionStorage.setItem("seal_chat", "{{{");
    expect(() => mount()).not.toThrow();
    expect(input()).toBeTruthy();
  });
});

describe("R15 · React.StrictMode", () => {
  it("a product changed in the form is announced once and moved to history once (initializer runs twice)", async () => {
    sessionStorage.setItem(
      "seal_chat",
      JSON.stringify({
        query: C,
        name: "QA",
        messages: [
          { role: "user", content: "Hola", id: 1 },
          { role: "ai", content: JSON.stringify({ text: "Hola", product: C }), id: 1 },
        ],
      }),
    );
    // the client then changed the product in the form
    expect(saveFormDraft({ productType: "bombas centrífugas industriales de 5 HP", quantity: "", budget: "", destination: "GT", volumeCbm: "", weightKg: "" }, 1, null).ok).toBe(true);
    mount();
    await settle();
    expect(document.body.textContent!.match(/Actualizaste el producto en el formulario/g)?.length).toBe(1);
    const earlier = caseContext().earlier || [];
    expect(earlier.filter((x) => /compresores/.test(x)).length).toBe(1);
    expect(currentCase().product).toBe("bombas centrífugas industriales de 5 HP");
  });
  it("one message under StrictMode is applied exactly once (one version bump, one reply)", async () => {
    mount();
    const v0 = caseVersion().rev;
    type("Cambia la cantidad a 6");
    fireEvent.click(sendBtn());
    await settle();
    expect(caseVersion().rev).toBe(v0 + 1);
    expect(userBubbles().filter((x) => x === "Cambia la cantidad a 6").length).toBe(1);
  });
});

describe("R13/R14 · double clicks, key repeat and fast messages", () => {
  it("double click on send (before React re-renders) sends once", async () => {
    mount();
    type("Cambia la cantidad a 6");
    fireEvent.click(sendBtn());
    fireEvent.click(sendBtn());
    await settle();
    expect(userBubbles().filter((x) => x === "Cambia la cantidad a 6").length).toBe(1);
    expect(currentCase().quantity).toBe(6);
  });
  it("held-down Enter (repeat) sends once", async () => {
    mount();
    type("Cambia la cantidad a 6");
    fireEvent.keyDown(input(), { key: "Enter" });
    fireEvent.keyDown(input(), { key: "Enter", repeat: true });
    await settle();
    expect(userBubbles().filter((x) => x === "Cambia la cantidad a 6").length).toBe(1);
  });
  it("two messages sent while the first reply is still 'typing': both answered, in order, on the saved case", async () => {
    mount();
    type("Cambia la cantidad a 6");
    fireEvent.click(sendBtn());
    type("Actualiza el presupuesto a US$7,000");
    fireEvent.click(sendBtn());
    await settle();
    const text = document.body.textContent!;
    expect(text.indexOf("cantidad 4 → 6")).toBeGreaterThan(-1);
    expect(text.indexOf("US$5,000 → US$7,000")).toBeGreaterThan(text.indexOf("cantidad 4 → 6"));
    expect(currentCase()).toEqual({ product: C, quantity: 6, budget: 7000 });
  });
  it("D1 in the page: proposal shown, case unchanged; 'sí, aplícalo' applies it; nothing sent to SEAL", async () => {
    mount();
    type("Cambia la cantidad a 7, pero pídeme confirmación antes de cambiarla");
    fireEvent.click(sendBtn());
    await settle();
    expect(document.body.textContent).toMatch(/no cambié nada/i);
    expect(currentCase().quantity).toBe(4);
    type("Sí, aplícalo");
    fireEvent.click(sendBtn());
    await settle();
    expect(currentCase().quantity).toBe(7);
    expect(sent.length).toBe(0);
  });
  it("reload: the conversation re-renders from storage with the same replies", async () => {
    const first = mount();
    type("Cambia la cantidad a 3.5");
    fireEvent.click(sendBtn());
    type("Cambia la cantidad a 6");
    fireEvent.click(sendBtn());
    await settle();
    const before = document.body.textContent;
    first.unmount();
    mount();
    await settle();
    expect(document.body.textContent).toBe(before);
  });
});
