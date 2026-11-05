// 02-11x: optional product photo in step 1. The AI SUGGESTS what the product is; the client decides what goes
// into the description. The photo is shrunk here (no GPS/EXIF), analysed once and never stored or sent to SEAL.
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X, Plus } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { shrinkPhoto, withPhotoProduct, withPhotoSpec, type PhotoError } from "../../utils/photo";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

type Result =
  | { kind: "product"; productEs: string; productEn: string; visibleSpecs: string[]; confidence: string }
  | { kind: "not_product" }
  | { kind: "unavailable" }
  | { kind: "error"; code: PhotoError | "image_type" | "image_size" | "image_invalid" | "network" | "too_many" };

export function PhotoAssist({ description, onChange }: { description: string; onChange: (next: string) => void }) {
  const { L } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
    setResult(null);
    setUsed([]);
    if (input.current) input.current.value = "";
  };

  async function onFile(file?: File) {
    if (!file) return;
    reset();
    setBusy(true);
    try {
      const shrunk = await shrinkPhoto(file);
      if ("error" in shrunk) {
        setResult({ kind: "error", code: shrunk.error });
        return;
      }
      setPreview(URL.createObjectURL(file));
      const r = await fetch(`${API}/api/suppliers/image-analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: shrunk.dataUrl, description, lang: document.documentElement.lang === "en" ? "en" : "es" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) setResult({ kind: "error", code: "too_many" });
      else if (r.status === 400 && ["image_type", "image_size", "image_invalid"].includes(j.error)) setResult({ kind: "error", code: j.error });
      else if (!r.ok) setResult({ kind: "unavailable" });
      else if (j.unavailable) setResult({ kind: "unavailable" });
      else if (j.ok && j.isProduct && j.productEs) setResult({ kind: "product", productEs: j.productEs, productEn: j.productEn || "", visibleSpecs: Array.isArray(j.visibleSpecs) ? j.visibleSpecs : [], confidence: j.confidence || "low" });
      else setResult({ kind: "not_product" });
    } catch {
      setResult({ kind: "error", code: "network" });
    } finally {
      setBusy(false);
    }
  }

  const errorText = (code: string) =>
    code === "photo_type" || code === "image_type"
      ? L("Usa una foto JPG, PNG o WebP.", "Use a JPG, PNG or WebP photo.")
      : code === "photo_too_big" || code === "image_size"
        ? L("La foto es demasiado pesada. Prueba con otra o tómala de nuevo.", "The photo is too large. Try another one or take it again.")
        : code === "photo_unreadable" || code === "image_invalid"
          ? L("No pudimos leer esa foto. Prueba con una JPG o PNG.", "We couldn't read that photo. Try a JPG or PNG.")
          : code === "too_many"
            ? L("Se analizaron muchas fotos desde esta conexión. Continúa con la descripción o intenta más tarde.", "Many photos were analysed from this connection. Continue with the description or try later.")
            : L("No pudimos enviar la foto. Revisa tu conexión o continúa con la descripción.", "We couldn't send the photo. Check your connection or continue with the description.");

  const empty = !description.trim();
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-3 space-y-3" data-testid="photo-assist">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        id="product-photo"
        aria-label={L("Foto del producto (opcional)", "Product photo (optional)")}
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {!preview && !busy && (
        <label htmlFor="product-photo" className="flex items-center gap-2 text-sm font-medium text-blue-700 cursor-pointer hover:underline">
          <Camera className="w-4 h-4" />
          {L("Agregar una foto del producto (opcional)", "Add a product photo (optional)")}
        </label>
      )}
      {busy && (
        <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
          <Loader2 className="w-4 h-4 animate-spin" />
          {L("Analizando la foto…", "Analysing the photo…")}
        </p>
      )}
      {preview && !busy && (
        <div className="flex items-start gap-3">
          <img src={preview} alt={L("Foto del producto", "Product photo")} className="w-16 h-16 object-cover rounded border border-slate-200" />
          <div className="flex-1 min-w-0 space-y-2 text-sm" role="status" aria-live="polite">
            {result?.kind === "product" && (
              <>
                <p className="text-slate-700">
                  {L("En la foto vemos:", "In the photo we see:")} <strong>{result.productEs}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => onChange(withPhotoProduct(description, result.productEs))}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                >
                  {empty ? L("Usar como descripción", "Use as description") : L("Agregar a mi descripción", "Add to my description")}
                </button>
                {result.visibleSpecs.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">{L("Datos impresos en la foto (confírmalos antes de agregarlos):", "Data printed in the photo (confirm them before adding):")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.visibleSpecs.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={used.includes(s)}
                          onClick={() => {
                            onChange(withPhotoSpec(description, s));
                            setUsed((u) => [...u, s]);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-500">{L("La IA puede equivocarse: revisa la descripción antes de continuar.", "The AI can be wrong: check the description before continuing.")}</p>
              </>
            )}
            {result?.kind === "not_product" && <p className="text-amber-700">{L("La foto no parece mostrar un producto. Prueba con otra foto o escribe la descripción.", "The photo doesn't seem to show a product. Try another photo or write the description.")}</p>}
            {result?.kind === "unavailable" && <p className="text-amber-700">{L("No pudimos analizar la foto en este momento. Puedes continuar con la descripción.", "We couldn't analyse the photo right now. You can continue with the description.")}</p>}
            {result?.kind === "error" && <p className="text-red-600">{errorText(result.code)}</p>}
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
              <X className="w-3 h-3" />
              {L("Quitar foto", "Remove photo")}
            </button>
          </div>
        </div>
      )}
      {!preview && !busy && result?.kind === "error" && <p className="text-sm text-red-600" role="alert">{errorText(result.code)}</p>}
      <p className="text-xs text-slate-500">
        {L(
          "La foto se envía a un servicio de IA solo para reconocer el producto. No la guardamos ni la enviamos a SEAL.",
          "The photo is sent to an AI service only to recognise the product. We don't keep it or send it to SEAL.",
        )}
      </p>
    </div>
  );
}
