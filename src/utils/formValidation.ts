// Validation of the qualification form fields (shown next to each field; the search runs only
// when every field is valid). Kept apart from the component so it is tested on its own.
import { plainNumber } from "./plainNumber";
import { descriptionIsDetailed, descriptionDetailMessage, DESCRIPTION_MIN_CHARS, cleanDescription } from "./descriptionCheck";
import { Lx } from "./lang";

// Field limits (shown to the client next to each field)
export const LIMITS = {
  productMin: DESCRIPTION_MIN_CHARS,
  productMax: 1500,
  quantityMax: 10_000_000,
  budgetMax: 100_000_000,
  volumeMax: 5_000,
  weightMax: 5_000_000,
};


/** Returns an error message for the field, or "" when valid. */
export function fieldError(name: string, value: string): string {
  const v = plainNumber(name, value);
  const n = Number(v);
  // "50.000" could be fifty or fifty thousand: ask instead of guessing
  if (name !== "quantity" && name !== "productType" && /^\d{1,3}(?:\.\d{3})+$/.test(v))
    return Lx(
      `¿${v} es ${Number(v.replace(/\./g, "")).toLocaleString("en-US")}? Escríbelo sin puntos de miles (por ejemplo ${v.replace(/\./g, "")}); usa punto solo para decimales.`,
      `Is ${v} meant as ${Number(v.replace(/\./g, "")).toLocaleString("en-US")}? Write it without thousands points (for example ${v.replace(/\./g, "")}); use a point only for decimals.`,
    );
  if (name !== "productType" && v && !(name === "quantity" ? /^\d+$/ : /^\d+(?:\.\d+)?$/).test(v))
    return name === "quantity"
      ? Lx("Escribe solo el número entero, sin letras, decimales ni símbolos (por ejemplo 1000).", "Enter only the whole number, without letters, decimals or symbols (for example 1000).")
      : Lx("Escribe solo el número, sin letras ni símbolos; usa punto para decimales (por ejemplo 3.5).", "Enter only the number, without letters or symbols; use a point for decimals (for example 3.5).");
  switch (name) {
    case "productType":
      // what gets searched is the cleaned text (sentences addressed to the tool are left out)
      if (!descriptionIsDetailed(v) || !descriptionIsDetailed(cleanDescription(v).text)) return descriptionDetailMessage();
      if (v.length > LIMITS.productMax) return Lx(`Máximo ${LIMITS.productMax.toLocaleString("en-US")} caracteres.`, `Maximum ${LIMITS.productMax.toLocaleString("en-US")} characters.`);
      return "";
    case "quantity":
      if (!v) return Lx("La cantidad es obligatoria.", "Quantity is required.");
      if (!Number.isInteger(n) || n < 1) return Lx("Escribe una cantidad entera mayor a 0.", "Enter a whole number greater than 0.");
      if (n > LIMITS.quantityMax) return Lx(`Máximo ${LIMITS.quantityMax.toLocaleString("en-US")} unidades.`, `Maximum ${LIMITS.quantityMax.toLocaleString("en-US")} units.`);
      return "";
    case "budget":
      if (!v) return "";
      if (!(n >= 1)) return Lx("El presupuesto de compra debe ser de al menos US$1.", "The purchase budget must be at least US$1.");
      if (n > LIMITS.budgetMax) return Lx(`Máximo US$${LIMITS.budgetMax.toLocaleString("en-US")}.`, `Maximum US$${LIMITS.budgetMax.toLocaleString("en-US")}.`);
      return "";
    case "volumeCbm":
      if (!v) return "";
      if (!(n > 0)) return Lx("El volumen debe ser mayor a 0.", "Volume must be greater than 0.");
      if (n > LIMITS.volumeMax) return Lx(`Máximo ${LIMITS.volumeMax.toLocaleString("en-US")} m³.`, `Maximum ${LIMITS.volumeMax.toLocaleString("en-US")} m³.`);
      return "";
    case "weightKg":
      if (!v) return "";
      if (!(n > 0)) return Lx("El peso debe ser mayor a 0.", "Weight must be greater than 0.");
      if (n > LIMITS.weightMax) return Lx(`Máximo ${LIMITS.weightMax.toLocaleString("en-US")} kg.`, `Maximum ${LIMITS.weightMax.toLocaleString("en-US")} kg.`);
      return "";
  }
  return "";
}


