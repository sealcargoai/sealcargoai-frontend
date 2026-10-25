// Product category from the client's description (decides the review topics).
import { wantedText } from "./useMatch";

export const CATEGORY_KEYWORDS: Record<string, RegExp> = {
  machinery: /m[aá]quina|machine|bordador(a|as)?\b|embroider|cosedora|sewing|overlock|remalladora|tejedora|knitting|\btelar|\bloom\b|cortadora l[aá]ser|laser cutt|tostador(a|es|as)?\b|roast(er|ing)|molino|\bmill\b|grinder|moledora|\bhornos?\b|\boven|mezcladora|\bmixer|batidora|procesadora|processor|despulpadora|secadora|dryer|extrusora|extruder|\bprensa\b|selladora|sealer|embotelladora|llenadora|filling|cortadora|cutter|freidora|fryer|caldera|boiler|congelador|freezer|refrigerador|enfriador|chiller|maquinaria|maquinaria|machinery|equipo industrial|industrial equipment|\bmotor(es)?\b|\bbomba|\bpump|compresor|compressor|generador|generator|\btorno|\blathe|\bcnc\b|montacarga|forklift|excavadora|excavator|envasadora|empacadora|packing machine|horno industrial/i,
  // protective equipment: what the product IS decides, not that it's "for food"
  ppe: /\bguantes?\b|\bgloves?\b|mascarillas?|cubrebocas|tapabocas|\bmasks?\b|respirador(es)?\b|respirators?|cascos? de seguridad|hard hats?|chalecos? (reflectivos?|de seguridad)|safety vests?|(lentes|gafas|anteojos) de seguridad|safety glasses|goggles|protector(es)? auditivos?|tapones auditivos|ear ?plugs|batas? desechables?|gorros? desechables?|cofias?|redecillas?|hair ?nets?|delantal(es)?|\baprons?\b|\bepp\b|\bppe\b|equipo de protecci[oó]n|protective equipment/i,
  stationery: /l[aá]pi(z|ces)\b|\bpencils?\b|bol[ií]grafos?|\bpens?\b|cuadernos?|papeler[ií]a|stationery|crayon(es|s)?|marcadores?|markers?|borradores?|erasers?|sacapuntas|sharpeners?|[uú]tiles escolares|school supplies|resaltadores?|highlighters?/i,
  electronics: /electr[oó]nic|electronic|celular|tel[eé]fono|\bphone|laptop|computador|tablet|cargador|charger|bater[ií]a|battery|\bleds?\b|\bcables?\b|aud[ií]fono|headphone|bocina|speaker|c[aá]mara|camera|\bmonitor|televisor|\btv\b|\bchips?\b|circuit/i,
  food: /\balimentos?\b|\bcomida\b|\bfood\b|\bsnacks?\b|\bbebidas?\b|\bbeverages?\b|\bcaf[eé](?![a-záéíóúñ])|\bcoffee\b|\bt[eé](?![a-záéíóúñ])|\btea\b|\bdulces?\b|\bcandy\b|\bgalletas?\b|\bcookies?\b|\bsalsa|\bespecias\b|\bspices?\b|\bharina\b|\bflour\b|\bconservas?\b/i,
  textiles: /textil|\btela|fabric|\bropa\b|clothing|camis|shirt|pantal[oó]n|\bpants\b|vestido|\bdress|algod[oó]n|cotton|poli[eé]ster|polyester|uniforme|uniform|toalla|towel|zapato|\bshoe|calzado|\bbotas?\b|\bboots?\b|\bgorras?\b|\bcaps?\b/i,
  furniture: /mueble|furniture|\bsillas?\b|\bchairs?\b|\bmesas?\b|\btables?\b|escritorio|\bdesk|sof[aá]|sill[oó]n|\bcamas?\b|\bbeds?\b|colch[oó]n|mattress|gabinete|cabinet|estanter|\bshelf|closet|ropero/i,
};

// "para alimentos", "for food", "grado alimenticio"… say what the product is
// used with, not what it is: gloves for food are gloves, not food.
const USE_PHRASE =
  /\b(?:para|for|apt[oa]s?\s+para|suitable\s+for|de\s+grado|grado|food[- ]grade|contacto\s+con|en\s+contacto|uso\s+(?:en|con|para)|used\s+(?:in|with|for)|que\s+sirva)\b[^.,;:!?]*/gi;
const HEAD_END = /\s(?:para|for|que|apt[oa]s?|uso|used|grado|de\s+grado)\s/i;

export function inferCategory(description: string): string {
  // uses the client rules out ("no para alimentos") don't decide the category
  const text = wantedText(description);
  const find = (t: string) => Object.entries(CATEGORY_KEYWORDS).find(([, re]) => re.test(t))?.[0];
  // 1) the product name at the start ("Guantes de nitrilo" in "Guantes de nitrilo para alimentos")
  const cut = text.search(HEAD_END);
  const head = cut > 0 ? text.slice(0, cut) : text;
  // 2) the whole text without its "para …" use phrases
  return find(head) || find(text.replace(USE_PHRASE, " ")) || "other";
}

// Machines whose description mentions food use get the food-contact topic
export const FOOD_USE = /aliment|comida|\bfood|caf[eé](?![a-záéíóúñ])|coffee|panader|bakery|\bpan\b|bread|tortill|carne|\bmeat|l[aá]cte|leche|dairy|\bmilk|bebida|beverage|jugo|juice|snack|chocolate|cacao|az[uú]car|sugar|harina|flour|granos?\b|grain|ma[ií]z|\bcorn\b|frut|fruit|verdura|vegetable|cocina|kitchen|restaurante|restaurant/i;
