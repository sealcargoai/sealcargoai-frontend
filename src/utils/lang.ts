// Current UI language for code that runs outside React components
// (calculator labels, PDF and Excel exports). The LanguageProvider keeps
// <html lang> in sync with the ES / EN switch.
export function getLang(): "es" | "en" {
  try {
    return document.documentElement.lang === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

/** "1 unidad" / "2 unidades" (or units) */
export function unitsWord(n: number): string {
  return n === 1 ? Lx("unidad", "unit") : Lx("unidades", "units");
}

/** Singular or plural, in the current language: plural(1, "proveedor", "proveedores", "supplier", "suppliers"). */
export function plural(n: number, esOne: string, esMany: string, enOne: string, enMany: string): string {
  return n === 1 ? Lx(esOne, enOne) : Lx(esMany, enMany);
}

/** Text in both languages, resolved with the current language. */
export function Lx(es: string, en: string): string {
  return getLang() === "en" ? en : es;
}
