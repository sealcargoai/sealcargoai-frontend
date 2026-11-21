// 20-11: SEAL's tariff classifier (page /clasificador) and the duty it hands to the cost calculator.
// The classifier returns a preliminary inciso of the Arancel 2026; the DAI (general or preferential by
// origin) comes from the tariff data on the server, never from the AI. When the client decides to use it
// («Usar este DAI en mi cálculo»), it is kept here tied to the product of the current case: the cost
// estimate then uses that DAI instead of the 15% reference — only for that product.
import { useMemo } from "react";
import { useRates, type Rates } from "./costCalculator";
import { currentCase } from "./caseStore";
import { sameProduct } from "./chatReply";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const KEY = "seal_classification";

export interface Rate {
  pct: number | null;
  text: string;
  excluded?: boolean;
  quota?: boolean;
}
export interface Permit {
  id: string;
  entidad: string;
  tramite: string;
  condicion: string;
  fuente: string;
  validado: boolean;
}
export interface ClassificationResult {
  inciso: string;
  descripcion: string;
  confianza: "alta" | "media" | "baja";
  resumen: string;
  descripcionTecnica: string;
  fundamento: Record<string, string>;
  alternativas: { inciso: string; cuando: string; descripcion: string }[];
  datosFaltantes: string[];
  origen: { iso: string; nombre: string } | null;
  dai: { general: Rate; preferencial: (Rate & { agreement: string; column?: string; note?: string }) | null; aplicable: number | null; nota: string[] };
  iva: number;
  permisos: Permit[];
  fuente: string;
  aviso: string;
  caso: string;
  restantes: number;
}

export interface ProductInput {
  productName: string;
  description: string;
  material: string;
  use: string;
  presentation: string;
  brandModel: string;
  origin: string;
}
export interface ContactInput {
  name: string;
  phone: string;
  email: string;
  company: string;
}
export interface UploadFile {
  name: string;
  type: string;
  data: string; // base64 without the data: prefix
}

export type ClassifyError =
  | "session_invalid"
  | "email_limit"
  | "daily_limit"
  | "not_configured"
  | "not_goods"
  | "no_match"
  | "bad_answer"
  | "classifier_unavailable"
  | "product_required"
  | "contact_required"
  | "file_too_large"
  | "file_type"
  | "too_many_files"
  | "network";

export async function classify(contact: ContactInput, product: ProductInput, files: UploadFile[], session: string, lang: "es" | "en"): Promise<{ ok: true; result: ClassificationResult } | { ok: false; error: ClassifyError }> {
  try {
    const res = await fetch(`${API}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Verified-Session": session },
      body: JSON.stringify({ ...contact, ...product, files, lang }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j?.inciso) return { ok: true, result: j as ClassificationResult };
    return { ok: false, error: (typeof j?.error === "string" ? j.error : "classifier_unavailable") as ClassifyError };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Classifications left for a verified email (null if unknown). */
export async function classifyQuota(email: string, session: string): Promise<number | null> {
  try {
    const res = await fetch(`${API}/api/classify/quota?email=${encodeURIComponent(email.trim())}`, { headers: { "X-Verified-Session": session } });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.remaining === "number" ? j.remaining : null;
  } catch {
    return null;
  }
}

// ── files: technical sheet (PDF) and photos ──────────────────────────────────
export const MAX_FILES = 4;
export const MAX_PDF_BYTES = 4_000_000;
const PHOTO_SIDE = 1600;

/** A photo shrunk in the browser (≤1600 px, JPEG; EXIF dropped) or a PDF as is (≤4 MB). */
export async function prepareFile(file: File): Promise<UploadFile | { error: "file_type" | "file_too_large" | "file_unreadable" }> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) return { error: "file_too_large" };
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { name: file.name, type: "application/pdf", data: btoa(bin) };
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return { error: "file_type" };
  if (file.size > 20_000_000) return { error: "file_too_large" };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return { error: "file_unreadable" };
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.82);
    return { name: file.name.replace(/\.[^.]+$/, ".jpg"), type: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
  } catch {
    return { error: "file_unreadable" };
  }
}

// ── the DAI chosen for the cost estimate ─────────────────────────────────────
export interface SavedDuty {
  product: string;
  inciso: string;
  descripcion: string;
  dutyRate: number; // 0..1
  basis: string; // «DAI general» or the agreement used
  at: number;
}

export function saveDutyForCase(product: string, r: ClassificationResult): SavedDuty | null {
  const pct = r.dai.aplicable;
  if (pct === null || pct === undefined || !Number.isFinite(pct) || !String(product || "").trim()) return null;
  const pref = r.dai.preferencial;
  const basis = pref && pref.pct !== null && !pref.excluded && pref.pct === pct ? pref.agreement : "DAI general (NMF)";
  const saved: SavedDuty = { product: product.trim(), inciso: r.inciso, descripcion: r.descripcion.slice(0, 300), dutyRate: pct / 100, basis, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* storage unavailable: the estimate keeps the reference DAI */
  }
  return saved;
}

export function clearSavedDuty(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

/** The DAI saved for the product of the current case, or null (another product, nothing saved, damaged). */
export function dutyForCurrentCase(product = currentCase().product): SavedDuty | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!s || typeof s.dutyRate !== "number" || !(s.dutyRate >= 0 && s.dutyRate <= 1) || typeof s.inciso !== "string") return null;
    if (!product || !sameProduct(String(s.product || ""), product)) return null;
    return s as SavedDuty;
  } catch {
    return null;
  }
}

/** The rates for the current case: the classified DAI when the client chose to use it, the reference otherwise. */
export function useCaseRates(product?: string): Rates {
  const rates = useRates();
  const p = product ?? currentCase().product;
  return useMemo(() => {
    const d = dutyForCurrentCase(p);
    return d ? { ...rates, dutyRate: d.dutyRate, dutySource: { inciso: d.inciso, basis: d.basis } } : rates;
  }, [rates, p]);
}
