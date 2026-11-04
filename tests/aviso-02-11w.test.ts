// @vitest-environment jsdom
// 02-11w — El aviso «Excel descargado» tapaba el campo del código del informe en un teléfono con el teclado
// abierto (recorrido móvil local). Nunca toma los toques, sube cuando hay una ventana abierta y se quita al
// escribir en un campo.
import { describe, it, expect, beforeEach } from "vitest";
import { showNotice } from "../src/utils/notice";

beforeEach(() => (document.body.innerHTML = ""));
const notice = () => document.querySelector("[data-notice]") as HTMLElement | null;

describe("aviso en pantalla", () => {
  it("no toma los toques y va abajo cuando no hay ventana abierta", () => {
    showNotice("Excel descargado");
    expect(notice()?.style.pointerEvents).toBe("none");
    expect(notice()?.style.bottom).toBe("24px");
  });
  it("con una ventana abierta (el envío del informe) va arriba", () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"><input id="code"></div>';
    showNotice("Excel descargado");
    expect(notice()?.style.top).toBe("12px");
    expect(notice()?.style.bottom).toBe("");
  });
  it("se quita al empezar a escribir en un campo (el código)", () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"><input id="code"><button id="b">x</button></div>';
    showNotice("Excel descargado");
    (document.getElementById("b") as HTMLButtonElement).focus();
    expect(notice()).not.toBeNull();
    (document.getElementById("code") as HTMLInputElement).focus();
    expect(notice()).toBeNull();
  });
});
