// Chat answers: short, honest, and tied to the product the client actually
// named. Without a known product the answer stays general and asks for it.
import { Lx } from "./lang";
import { inferCategory, FOOD_USE, CATEGORY_KEYWORDS } from "./category";
import { wantedText } from "./useMatch";

export interface ChatCtx {
  product: string; // what the client said they import ("" when unknown)
}

// "son lápices escolares", "es un molino", "mi producto es…", "quiero importar…"
const STATEMENT =
  /^\s*(?:no[,.]?\s+)?(?:(?:te\s+(?:aclaro|digo|dije|repito|coment[eé])|ya\s+te\s+(?:dije|indiqu[eé])|como\s+te\s+dije|repito|aclaro|i\s+(?:said|told\s+you)|as\s+i\s+said)\s+(?:que\s+|that\s+)?)?(?:(?:en\s+realidad|realmente|perd[oó]n|corrijo)[,.]?\s+)?(?:son|es|eran|era|se\s+trata\s+de|mi\s+producto\s+es|el\s+producto\s+es|lo\s+que\s+importo\s+(?:es|son)|quiero\s+importar|voy\s+a\s+importar|importar[eé]|hablo\s+de|me\s+refiero\s+a|(?:they|it)\s+(?:are|is)|it's|my\s+product\s+is|i(?:'m|\s+am)\s+importing|i\s+want\s+to\s+import|i\s+mean)\s+(.{3,120}?)\s*[.!]?\s*$/i;

// verbs that clearly introduce the product; "es …" / "son …" alone also start
// ordinary sentences ("es confiable este proveedor"), so they need a product word
const STRONG = /^\s*(?:no[,.]?\s+)?(?:mi\s+producto\s+es|el\s+producto\s+es|lo\s+que\s+importo\s+(?:es|son)|quiero\s+importar|voy\s+a\s+importar|importar[eé]|se\s+trata\s+de|my\s+product\s+is|i(?:'m|\s+am)\s+importing|i\s+want\s+to\s+import)(?=\s|$)/i;
const QUESTION_WORD = /^(?:¿)?\s*(?:qu[eé]|c[oó]mo|cu[aá]nt[oa]s?|cu[aá]l(?:es)?|d[oó]nde|cu[aá]ndo|por\s*qu[eé]|qui[eé]n|puedo|puedes|pueden|hay|tienen|tiene|es\s+(?:confiable|seguro|real|verdad|posible|necesario|cierto)|what|how|which|where|when|why|who|can|is|are|do|does)\b/i;
const NOT_A_PRODUCT = /^(?:desde|de|del|a|algo|cosas|productos|mercader[ií]a|urgente|from|something|stuff|goods|products|confiable|seguro|segura|real|verdad|posible|necesario|cierto|caro|barato|legal|ilegal|bueno|malo|el\s+proveedor|este\s+proveedor|la\s+aduana|reliable|safe|true|possible|legit|expensive|cheap)\b/i;

/** The product the message states, or null. */
export function productFromMessage(text: string): string | null {
  const t = String(text || "").trim();
  const m = t.replace(/[¿?]/g, "").match(STATEMENT);
  // the verb itself ("quiero importar") is not a question about customs
  const asks = /\?/.test(t) || QUESTION_WORD.test(t) || replyKinds(m ? m[1] : t).length > 0;
  if (m) {
    // the product ends where a question or another clause starts
    const cap = clean(m[1].split(/[,;¿]|\s+(?:y|and|pero|but)\s+(?:qu[eé]|c[oó]mo|cu[aá]nto|necesit|what|how|do|does)\b/i)[0]);
    if (!cap || NOT_A_PRODUCT.test(cap) || QUESTION_WORD.test(cap)) return null;
    // a strong verb names the product; "es/son …" or a question need a product word
    if ((STRONG.test(t) && !asks) || inferCategory(cap) !== "other") return cap;
    return null;
  }
  // a bare product name ("lápices escolares") right after a question about it
  if (!asks && t.split(/\s+/).length <= 4 && inferCategory(t) !== "other") return clean(t);
  // a product named inside a longer sentence ("mi pregunta era por lápices escolares")
  if (!asks) return productMention(t);
  return null;
}

/** The product a message mentions, even inside a question ("¿el CE sirve para lápices escolares?"). */
export function productMention(text: string): string | null {
  const t = wantedText(String(text || "").replace(/[¿?¡!]/g, " "));
  let best: { at: number; end: number } | null = null;
  for (const re of Object.values(CATEGORY_KEYWORDS)) {
    const m = t.match(new RegExp(re.source, "i"));
    if (m && m.index !== undefined && (!best || m.index < best.at)) best = { at: m.index, end: m.index + m[0].length };
  }
  if (!best) return null;
  // the word and up to three following words, until punctuation or a new clause
  const tail = t.slice(best.at).split(/[,.;:]|\s+(?:y|o|pero|que|and|or|but|that|para\s+(?:qu[eé]|saber))\s+/i)[0];
  const words = tail.trim().split(/\s+/).slice(0, 6);
  // drop trailing connectors ("lápices de")
  while (words.length > 1 && /^(?:de|del|para|con|en|a|of|for|with|in)$/i.test(words[words.length - 1])) words.pop();
  const out = clean(words.join(" "));
  return out.length >= 3 ? out : null;
}
const clean = (s: string) => s.replace(/^(?:un|una|unos|unas|los|las|el|la|a|an|the)\s+/i, "").replace(/[.!]+$/, "").trim();

export function replyKinds(text: string): string[] {
  const t = text.toLowerCase();
  const kinds: string[] = [];
  if (/certificad|certificaci|certificate|certification|\bce\b|\bfda\b|\biso\b|\bul\b|\brohs\b|\bsgs\b|grado alimenticio|food[- ]grade|apto para alimentos|suitable for food/.test(t)) kinds.push("certificate");
  if (/proveedor|supplier|seller|vendedor|f[aá]brica|factory|confiable|reliable|\breal\b|estafa|fraude|scam|verificad|verificaci|verified|verification|legit/.test(t)) kinds.push("supplier");
  // "Guarantee" goes to customs authorization only when the question is about the import itself
  const customsCtx = /importaci|aduana|autoriz|permiso|aprobad|aprobaci|liberaci|despacho|que pase|customs|import(?!ar\b|ing\b)|authoriz|permit|approv/.test(t);
  const guaranteeWord = /garantiz|garant[ií]a de que|asegur|sin problema|guarantee/.test(t);
  if (customsCtx || (guaranteeWord && !kinds.includes("certificate"))) kinds.push("guarantee");
  if (/\bdai\b|arancel|partida|impuesto|\biva\b|tributo|tariff|duty|duties|\btax/.test(t)) kinds.push("dai");
  if (/precio|costo|cu[aá]nto|cotiz|price|cost|quote|how much/.test(t)) kinds.push("cost");
  return kinds;
}

function certificateReply(text: string, ctx: ChatCtx): string {
  const asksGuarantee = /garant|guarantee|verific|verified|asegur|demuestra que el proveedor|proves the supplier/i.test(text);
  const base = Lx(
    "No puedo validar certificados desde la herramienta: solo muestro las certificaciones que el proveedor declara en la plataforma. Antes de comprar, pide copia del certificado y confirma que corresponda al modelo exacto y al fabricante (número, fecha y organismo que lo emitió).",
    "I can't validate certificates from the tool: I only show the certifications the supplier declares on the platform. Before buying, ask for a copy of the certificate and confirm it matches the exact model and manufacturer (number, date and issuing body).",
  );
  const ce = /\bce\b/i.test(text)
    ? " " +
      Lx(
        `Una marca como CE indica que se declara que el producto cumple ciertas normas europeas${asksGuarantee ? "; no verifica al proveedor ni es una garantía de la compra o de la calidad" : ""}.`,
        `A mark like CE indicates the product is declared to meet certain European standards${asksGuarantee ? "; it does not verify the supplier and is not a guarantee of the purchase or the quality" : ""}.`,
      )
    : asksGuarantee
      ? " " + Lx("Un certificado no verifica al proveedor ni es una garantía de la compra.", "A certificate does not verify the supplier and is not a guarantee of the purchase.")
      : "";
  if (!ctx.product) {
    return (
      base +
      ce +
      " " +
      Lx(
        "¿Qué producto vas a importar? Con eso te digo qué conviene revisar en ese caso.",
        "What product are you importing? With that I can tell you what to check in that case.",
      )
    );
  }
  const cat = inferCategory(ctx.product);
  const food = FOOD_USE.test(wantedText(ctx.product));
  ctx = { product: ctx.product.length > 60 ? `${ctx.product.slice(0, 57).trim()}…` : ctx.product };
  let tail = "";
  if (food && (cat === "machinery" || cat === "ppe" || cat === "other"))
    tail = Lx(
      `Para «${ctx.product}», el certificado no demuestra por sí solo que sea apto para contacto con alimentos: pide al fabricante la especificación de los materiales que tocan el alimento o su reporte de prueba.`,
      `For "${ctx.product}", the certificate does not by itself show it is suitable for food contact: ask the manufacturer for the specification of the materials that touch the food or its test report.`,
    );
  else if (cat === "stationery")
    tail = Lx(
      `Para «${ctx.product}», si son para niños, pide los reportes de prueba o certificados de seguridad de materiales que declare el fabricante.`,
      `For "${ctx.product}", if they are for children, ask for the material safety test reports or certificates the manufacturer declares.`,
    );
  else if (cat === "electronics")
    tail = Lx(
      `Para «${ctx.product}», confirma que el certificado cubra el modelo exacto, incluido el voltaje y el cargador si lo trae.`,
      `For "${ctx.product}", confirm the certificate covers the exact model, including voltage and the charger if included.`,
    );
  else
    tail = Lx(
      `Para «${ctx.product}», confirma con SEAL qué documentos pide la importación según su partida.`,
      `For "${ctx.product}", confirm with SEAL which documents the import needs for its tariff heading.`,
    );
  return `${base}${ce} ${tail}`;
}

const FIXED: Record<string, () => string> = {
  supplier: () =>
    Lx(
      "No puedo confirmar si un proveedor es real o confiable: la herramienta solo organiza lo que publica la plataforma (insignias, años, reseñas) y no lo verifica. Siguiente paso: continúa con el formulario para ver opciones ordenadas por índice referencial y, si vas a comprar, pide a SEAL la verificación del proveedor en China (servicio adicional).",
      "I can't confirm whether a supplier is real or reliable: the tool only organizes what the platform publishes (badges, years, reviews) and doesn't verify it. Next step: continue with the form to see options sorted by reference index and, if you're going to buy, ask SEAL for the supplier verification in China (additional service).",
    ),
  guarantee: () =>
    Lx(
      "Tampoco puedo garantizar que la importación sea autorizada ni que pase la aduana sin observaciones: eso depende de la partida arancelaria, de los permisos que esa partida pida y de que la documentación del embarque coincida. Dato a confirmar: la ficha técnica del producto, para que SEAL revise la partida y los permisos antes de comprar.",
      "I also can't guarantee the import will be authorized or clear customs without remarks: that depends on the tariff heading, the permits it requires and the shipping documents matching. Data to confirm: the product's technical sheet, so SEAL can review the heading and permits before you buy.",
    ),
  dai: () =>
    Lx(
      "No puedo dar el impuesto exacto sin la ficha técnica: el DAI depende de la partida arancelaria, y la partida se define con lo que dice esa ficha (qué es el producto, material, uso). En la estimación usamos 15% de DAI como referencia y el IVA de 12% sobre CIF + DAI. Siguiente paso: completa el formulario para ver el escenario y, para la partida exacta, comparte la ficha técnica con un agente aduanero de SEAL (WhatsApp +502 5996 4664).",
      "I can't give the exact tax without the technical sheet: the DAI depends on the tariff heading, and the heading is set from that sheet (what the product is, material, use). The estimate uses 15% DAI as reference and 12% IVA on CIF + DAI. Next step: complete the form to see the scenario and, for the exact heading, share the technical sheet with a SEAL customs broker (WhatsApp +502 5996 4664).",
    ),
  cost: () =>
    Lx(
      "Puedo prepararte una estimación preliminar con los datos del formulario (producto, cantidad y, si lo tienes, volumen o peso). Un costo confirmado solo lo da una cotización de SEAL. Siguiente paso: continúa con el formulario.",
      "I can prepare a preliminary estimate with the form data (product, quantity and, if you have it, volume or weight). A confirmed cost only comes from a SEAL quote. Next step: continue with the form.",
    ),
  general: () =>
    Lx(
      "Gracias. Por ahora no respondo preguntas abiertas en este chat. Para orientarte, continúa con el formulario: ahí ordenamos tus datos y preparamos las referencias y estimaciones. Si prefieres hablar con una persona, escribe al WhatsApp de SEAL +502 5996 4664.",
      "Thanks. For now I don't answer open questions in this chat. To guide you, continue with the form: there we organize your data and prepare the references and estimates. If you'd rather talk to a person, message SEAL on WhatsApp +502 5996 4664.",
    ),
};

export interface ReplySpec {
  text: string; // the client's message
  product: string; // product known when answering
  newProduct?: string; // product the message stated (correction or first mention)
  mentioned?: string; // product named inside a question (used as context, no acknowledgement)
  previous?: string; // product before this message ("" when unknown)
  reask?: string; // earlier question to answer again for the new product
  earlierFood?: boolean; // an earlier answer talked about food-contact materials
}

/** Whether a certificate answer for this product talks about food contact. */
export function foodAdvice(product: string): boolean {
  if (!product) return false;
  const cat = inferCategory(product);
  return FOOD_USE.test(wantedText(product)) && (cat === "machinery" || cat === "ppe" || cat === "other");
}

/** Builds the reply in the current language (called at render time). */
export function buildReply(r: ReplySpec): string {
  const ctx: ChatCtx = { product: r.product };
  const parts: string[] = [];
  if (r.newProduct) {
    const changed = !!r.previous && r.previous.toLowerCase() !== r.newProduct.toLowerCase();
    const wrongAdvice = !!r.earlierFood && !foodAdvice(r.newProduct);
    parts.push(
      changed || wrongAdvice
        ? Lx(
            `Gracias por aclararlo: tu producto es «${r.newProduct}». Corrijo lo anterior: ${wrongAdvice ? "lo que dije sobre materiales en contacto con alimentos no aplica a este producto" : "lo que respondí pensando en otro producto no aplica"}; tomo «${r.newProduct}» para lo que sigue y para el formulario.`,
            `Thanks for clarifying: your product is "${r.newProduct}". Correcting what I said: ${wrongAdvice ? "what I said about food-contact materials doesn't apply to this product" : "what I answered with another product in mind doesn't apply"}; I'll use "${r.newProduct}" from here on and in the form.`,
          )
        : Lx(
            `Anotado: tu producto es «${r.newProduct}»; lo uso para lo que sigue y para el formulario.`,
            `Noted: your product is "${r.newProduct}"; I'll use it from here on and in the form.`,
          ),
    );
  }
  let q = r.text;
  let kinds = replyKinds(q);
  // a bare product statement answers the earlier question again, now for this product
  if (!kinds.length && r.newProduct && r.reask) {
    q = r.reask;
    kinds = replyKinds(q).filter((k) => k === "certificate");
  }
  if (!kinds.length && !r.newProduct) kinds = ["general"];
  kinds.forEach((k, i) => {
    let t = k === "certificate" ? certificateReply(q, ctx) : (FIXED[k] ?? FIXED.general)();
    if (i === 0 && !parts.length) t = t.replace(/^Tampoco puedo/, "No puedo").replace(/^I also can't/, "I can't");
    parts.push(t);
  });
  if (r.newProduct && !kinds.length)
    parts.push(Lx("Para orientarte con ese producto, continúa con el formulario.", "To guide you on that product, continue with the form."));
  return parts.join("\n\n");
}
