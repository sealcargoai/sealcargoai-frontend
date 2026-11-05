// @vitest-environment jsdom
// 02-11x — Foto opcional en el paso 1: la IA sugiere, el cliente decide qué entra en la descripción.
// Entorno: componente en jsdom, fetch simulado (nada sale). La compresión real se prueba en el navegador
// (recorrido móvil local); aquí shrinkPhoto se reemplaza porque jsdom no dibuja imágenes.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StrictMode, useState } from "react";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../src/app/context/LanguageContext";

vi.mock("../src/utils/photo", async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, shrinkPhoto: vi.fn(async (f: File) => (/gif/.test(f.type) ? { error: "photo_type" } : { dataUrl: "data:image/jpeg;base64,/9j/AAAA", bytes: 4 })) };
});
const { PhotoAssist } = await import("../src/app/components/PhotoAssist");
const { withPhotoProduct, withPhotoSpec } = await import("../src/utils/photo");

const calls: { url: string; body: any }[] = [];
let answer: { status: number; body: unknown } = { status: 200, body: {} };
beforeEach(() => {
  calls.length = 0;
  document.documentElement.lang = "es";
  (globalThis as any).URL.createObjectURL = () => "blob:foto";
  (globalThis as any).URL.revokeObjectURL = () => {};
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "content-type": "application/json" } });
  }) as any;
});
afterEach(cleanup);

function Host({ start = "" }: { start?: string }) {
  const [d, setD] = useState(start);
  return (
    <>
      <textarea aria-label="desc" value={d} readOnly />
      <PhotoAssist description={d} onChange={setD} />
    </>
  );
}
const mount = (start?: string) =>
  render(
    <StrictMode>
      <LanguageProvider>
        <Host start={start} />
      </LanguageProvider>
    </StrictMode>,
  );
const pick = (type = "image/jpeg") => fireEvent.change(screen.getByLabelText("Foto del producto (opcional)"), { target: { files: [new File(["x"], "foto", { type })] } });
const desc = () => (screen.getByLabelText("desc") as HTMLTextAreaElement).value;
const PUMP = { ok: true, isProduct: true, productEs: "bomba de agua sumergible", productEn: "submersible water pump", visibleSpecs: ["24V DC", "60W"], confidence: "high" };

describe("foto del producto (paso 1)", () => {
  it("sin descripción: sugiere, y solo al tocar el botón pasa a ser la descripción", async () => {
    answer = { status: 200, body: PUMP };
    mount();
    pick();
    await screen.findByText("bomba de agua sumergible");
    expect(desc()).toBe("");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/api\/suppliers\/image-analyze$/);
    expect(Object.keys(calls[0].body).sort()).toEqual(["description", "image", "lang"]);
    fireEvent.click(screen.getByText("Usar como descripción"));
    expect(desc()).toBe("bomba de agua sumergible");
  });

  it("con descripción: se agrega una vez; los datos impresos solo entran si el cliente los toca", async () => {
    answer = { status: 200, body: PUMP };
    mount("bomba para pozo de 30 m");
    pick();
    await screen.findByText("Agregar a mi descripción");
    expect(desc()).toBe("bomba para pozo de 30 m");
    expect(calls[0].body.description).toBe("bomba para pozo de 30 m");
    fireEvent.click(screen.getByText("Agregar a mi descripción"));
    fireEvent.click(screen.getByText("Agregar a mi descripción"));
    expect(desc()).toBe("bomba para pozo de 30 m\nbomba de agua sumergible");
    expect(desc()).not.toMatch(/24V|60W/);
    fireEvent.click(screen.getByText("24V DC"));
    expect(desc()).toBe("bomba para pozo de 30 m\nbomba de agua sumergible, 24V DC");
    expect((screen.getByText("24V DC").closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect(desc()).not.toMatch(/60W/);
  });

  it.each([
    [{ status: 200, body: { ok: true, isProduct: false, productEs: "", productEn: "", visibleSpecs: [], confidence: "high" } }, "La foto no parece mostrar un producto"],
    [{ status: 200, body: { unavailable: true, reason: "busy" } }, "No pudimos analizar la foto en este momento"],
    [{ status: 200, body: { unavailable: true, reason: "daily_limit" } }, "No pudimos analizar la foto en este momento"],
    [{ status: 429, body: { rateLimited: true } }, "Se analizaron muchas fotos"],
    [{ status: 400, body: { error: "image_type" } }, "Usa una foto JPG, PNG o WebP"],
    [{ status: 500, body: {} }, "No pudimos analizar la foto en este momento"],
  ])("respuesta %j → mensaje claro y la descripción no cambia", async (a, text) => {
    answer = a as any;
    mount("bomba para pozo");
    pick();
    await screen.findByText(new RegExp(text as string));
    expect(desc()).toBe("bomba para pozo");
  });

  it("un GIF no se envía", async () => {
    mount();
    pick("image/gif");
    await screen.findByText(/Usa una foto JPG, PNG o WebP/);
    expect(calls).toHaveLength(0);
  });

  it("aviso de privacidad visible; «Quitar foto» limpia la sugerencia", async () => {
    answer = { status: 200, body: PUMP };
    mount();
    // 02-11z: before choosing, it says that the photo AND the description go to an external AI provider
    const note = screen.getByText(/proveedor externo de inteligencia artificial/);
    expect(note.textContent).toMatch(/enviamos la foto y la descripción/);
    expect(note.textContent).toMatch(/SEAL no guarda la foto/);
    expect(screen.queryByText("bomba de agua sumergible")).toBeNull();
    pick();
    await screen.findByText("bomba de agua sumergible");
    fireEvent.click(screen.getByText("Quitar foto"));
    await waitFor(() => expect(screen.queryByText("bomba de agua sumergible")).toBeNull());
    expect(screen.getByText("Agregar una foto del producto (opcional)")).toBeTruthy();
  });
});

it("en inglés el aviso dice lo mismo (foto y descripción)", () => {
    localStorage.setItem("seal_lang", "en");
    mount();
    expect(screen.getByText(/we send the photo and the description you wrote above to an external artificial intelligence provider/)).toBeTruthy();
    localStorage.removeItem("seal_lang");
  });

describe("textos que arma la foto", () => {
  it("no duplica, respeta el máximo y compara sin tildes ni espacios", () => {
    expect(withPhotoProduct("", "bomba")).toBe("bomba");
    expect(withPhotoProduct("Bomba de agua sumergible para pozo", "bomba de agua sumergible")).toBe("Bomba de agua sumergible para pozo");
    expect(withPhotoProduct("x".repeat(1499), "bomba").length).toBe(1500);
    expect(withPhotoSpec("bomba 24 V DC", "24V DC")).toBe("bomba 24 V DC");
    expect(withPhotoSpec("bomba", "60 Hz")).toBe("bomba, 60 Hz");
    expect(withPhotoSpec("", "60 Hz")).toBe("60 Hz");
  });
});
