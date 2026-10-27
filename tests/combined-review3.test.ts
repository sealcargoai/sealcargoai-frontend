// Independent adversarial review of combined requirements (v2026.10.26-p): 110 cases.
// Adversarial combined-conditions cases for SEAL SmartTrade AI (review 3).
// Run from /tmp/claude-0/review3:  npx vite-node combo.ts > combo-results.txt
// (vite-node, not tsx: differences.ts → componentMatch → costCalculator reads import.meta.env;
//  the chat part alone also runs with tsx.)
import { describe, it, expect, afterEach } from "vitest";
import { replayConversation } from "../src/utils/chatReply";
import { matchElectric } from "../src/utils/electricMatch";
import { listingDifferences } from "../src/utils/differences";

type Sev = "high" | "medium" | "low";
interface ChatCase { id: string; lang?: "es" | "en"; msgs: string[]; at?: number; must: RegExp[]; not?: RegExp[]; sev: Sev; root: string; expected: string }
interface ListCase { id: string; lang?: "es" | "en"; d: string; t: string; must?: RegExp[]; not?: RegExp[]; sev: Sev; root: string; expected: string }
const setLang = (l: "es" | "en") => ((globalThis as any).document = { documentElement: { lang: l } });

const PEN = "Necesito 500 lápices. Cada set trae 12 lápices y cada caja trae 10 sets.";
const PENW = "Necesito 500 lápices. Cada set trae 12 lápices y cada caja trae 10 sets. Solo venden cajas completas. ¿Cuántas cajas?";
const STK = "Necesito 200 pares, cajas de 20 pares, mínimo 15 cajas, solo tienen 12 disponibles. ¿Cuántas cajas?";
const MAS = "Necesito 500 piezas, 24 por caja, 6 cajas por master. ¿Cuántos masters?";
const SHO = "Necesito 100 pares. Cada caja trae 30 zapatos individuales. Mínimo 120 pares, en múltiplos de 2 cajas. ¿Cuántas cajas?";
const KIT = "Quiero 240 botellas, cada set trae 1 botella y 3 tazas, mínimo 300 sets. ¿Cuántos sets?";

const chat: ChatCase[] = [
  // ── nested packs + minimum + stock
  { id: "C01", msgs: [`${PEN} Mínimo 3 cajas, solo tienen 4 cajas disponibles. ¿Cuántas cajas?`], must: [/4 cajas disponibles[^.]*no alcanzan/], sev: "high", root: "R1", expected: "5 cajas needed (600 lápices); stock 4 cajas = 480 → not enough (min 3 met)" },
  { id: "C02", msgs: [`${PEN} Solo venden cajas completas. El proveedor solo tiene 3 cajas disponibles. ¿Cuántas cajas?`], must: [/3 cajas disponibles[^.]*no alcanzan/, /360 lápices/], sev: "high", root: "R1", expected: "5 cajas needed; only 3 (360 lápices) → short 140" },
  { id: "C03", msgs: ["Necesito 500 lápices, sets de 12, cajas de 10 sets, mínimo 60 sets. ¿Cuántas cajas?"], must: [/6 cajas/, /720 lápices/], not: [/No pude aplicar/], sev: "medium", root: "R2", expected: "min 60 sets = 6 cajas → 6 cajas = 720 lápices" },
  { id: "C04", msgs: ["Necesito 300 pares. Cada caja trae 12 pares y cada master trae 4 cajas. Solo venden masters completos. ¿Cuántos masters?"], must: [/7 masters/, /336 pares/], sev: "high", root: "R3", expected: "25 cajas → 7 masters (28 cajas = 336 pares)" },
  { id: "C05", msgs: ["Necesito 300 pares. Cada caja trae 12 pares y cada master trae 4 cajas. Solo venden masters completos. Solo tienen 200 pares disponibles. ¿Cuántos masters?"], must: [/7 masters/, /no alcanzan/], sev: "high", root: "R3+R4", expected: "7 masters; stock 200 pares (<300) not enough" },
  { id: "C06", msgs: ["Necesito 200 pares. Cada caja trae 20 pares. Solo tienen 300 zapatos disponibles. ¿Cuántas cajas?"], must: [/no alcanzan/], not: [/15 cajas disponibles/], sev: "high", root: "R4", expected: "300 zapatos = 150 pares = 7 cajas → not enough for 10 cajas" },
  { id: "C07", msgs: ["Necesito 300 pares. Cada master trae 4 cajas y cada caja trae 12 pares. Solo venden masters completos. ¿Cuántos masters?"], must: [/7 masters/, /336 pares/], sev: "low", root: "-", expected: "7 masters = 336 pares" },
  { id: "C08", msgs: ["Necesito 500 piezas, 24 por caja, 6 cajas por master, mínimo 3 masters. ¿Cuántos masters?"], must: [/4 masters/, /576 piezas/], sev: "low", root: "-", expected: "4 masters (min 3 met)" },
  { id: "C09", msgs: ["Necesito 500 piezas, 24 por caja, 6 cajas por master, solo tienen 2 masters disponibles. ¿Cuántos masters?"], must: [/2 masters disponibles[^.]*no alcanzan/], sev: "high", root: "R1", expected: "4 masters needed, 2 in stock (288 piezas) → not enough" },
  { id: "C10", msgs: ["Necesito 500 piezas, 24 por caja, 6 cajas por master. Solo venden masters completos. ¿Cuántos masters?"], must: [/4 masters/], sev: "low", root: "-", expected: "4 masters" },
  { id: "C11", msgs: ["Necesito 500 piezas, 24 por caja, 6 cajas por master, solo tienen 20 cajas disponibles. ¿Cuántas cajas?"], must: [/20 cajas disponibles[^.]*no alcanzan/], sev: "low", root: "-", expected: "21 cajas needed, 20 in stock" },
  { id: "C12", msgs: ["Necesito 200 pares. Cada caja trae 20 pares. Solo tienen 300 pares disponibles. ¿Cuántas cajas?"], must: [/10 cajas/, /disponibles alcanzan|disponibles[^.]*alcanzan/], sev: "medium", root: "R4", expected: "10 cajas; 300 pares (15 cajas) in stock are enough — stock must be acknowledged" },
  { id: "C13", msgs: ["Necesito 200 pares. Cada caja trae 40 zapatos. Solo tienen 6 cajas disponibles. ¿Cuántas cajas?"], must: [/6 cajas disponibles[^.]*no alcanzan/, /40 pares|pares completos/], sev: "medium", root: "R5", expected: "10 cajas if 40 single shoes (6 not enough); if 40 pares → 5 cajas and stock enough; pair note" },
  { id: "C14", msgs: ["Necesito 200 pares. Cada caja trae 40 zapatos. Mínimo 3 cajas. Solo tienen 400 zapatos disponibles. ¿Cuántas cajas?"], must: [/10 cajas disponibles alcanzan/], sev: "low", root: "-", expected: "10 cajas, stock 10 cajas enough" },
  { id: "C15", msgs: [SHO], must: [/8 cajas/, /120 pares/], sev: "low", root: "-", expected: "8 cajas = 240 zapatos (120 pares)" },
  { id: "C16", msgs: ["Necesito 200 pares. Cada caja trae 20 pares. Solo tienen 150 pares disponibles. ¿Cuántas cajas?"], must: [/no alcanzan/], sev: "high", root: "R4", expected: "10 cajas; stock 150 pares (7 cajas) not enough, 50 pares short" },
  { id: "C17", msgs: ["Necesito 200 pares. Cada caja trae 20 pares. Solo tienen 300 zapatos disponibles. Mínimo 5 cajas. ¿Cuántas cajas?"], must: [/no alcanzan/], not: [/15 cajas disponibles alcanzan/], sev: "high", root: "R4", expected: "10 cajas; 300 zapatos = 150 pares → not enough" },
  // ── kits
  { id: "C18", msgs: ["Quiero 240 botellas, cada set trae 1 botella y 3 tazas, cada caja trae 10 sets. ¿Cuántas cajas?"], must: [/24 cajas/], sev: "medium", root: "R6", expected: "240 sets = 24 cajas" },
  { id: "C19", msgs: ["Quiero 240 botellas, 1 botella y 3 tazas por set, 10 sets por caja. Solo venden cajas completas. ¿Cuántas cajas?"], must: [/24 cajas/], not: [/10 sets de 3 son 30 botellas/], sev: "high", root: "R6", expected: "24 cajas (240 sets, 240 botellas, 720 tazas)" },
  { id: "C20", msgs: ["Quiero 240 botellas, cada set trae 1 botella y 3 tazas. El proveedor solo tiene 100 sets disponibles. ¿Cuántos sets?"], must: [/100 sets disponibles[^.]*no alcanzan/], sev: "high", root: "R7", expected: "240 sets needed, only 100" },
  { id: "C21", msgs: ["Quiero 240 botellas, cada set trae 1 botella y 3 tazas. Mínimo 300 sets. Solo tiene 250 sets disponibles. ¿Cuántos sets?"], must: [/250/], not: [/debes pedir 300 sets/], sev: "high", root: "R7", expected: "250 sets cover 240 botellas but can't meet min 300 → ask supplier" },
  // ── weight/volume packs
  { id: "C22", msgs: ["Necesito 100 kg en bolsas de 5 kg, solo tienen 15 bolsas disponibles. ¿Cuántas bolsas?"], must: [/15 bolsas disponibles[^.]*no alcanzan/], sev: "high", root: "R7", expected: "20 bolsas needed, 15 (75 kg) → 25 kg short" },
  { id: "C23", msgs: ["Necesito 100 kg en bolsas de 5 kg, mínimo 30 bolsas. ¿Cuántas bolsas?"], must: [/30 bolsas/, /150 kg/], sev: "low", root: "-", expected: "30 bolsas = 150 kg" },
  { id: "C24", msgs: ["Necesito 100 kg en bolsas de 5 kg, en múltiplos de 6 bolsas. ¿Cuántas bolsas?"], must: [/24 bolsas/, /120 kg/], sev: "low", root: "-", expected: "24 bolsas" },
  { id: "C25", msgs: ["Necesito 100 kg en sacos de 45 kg, mínimo 5 sacos, solo tienen 4 sacos disponibles. ¿Cuántos sacos?"], must: [/5 sacos/, /4 sacos/], not: [/No pude aplicar «5 sacos»/], sev: "high", root: "R7+R8", expected: "need 3, min 5 → 5 sacos; only 4 → can't meet min" },
  // ── ceilings
  { id: "C26", msgs: ["Necesito menos de 500 piezas en cajas de 24, mínimo 25 cajas. ¿Cuántas cajas?"], must: [/condici|confirm/i], sev: "low", root: "-", expected: "conflict (min 600 > ceiling) → ask" },
  { id: "C27", msgs: ["Necesito menos de 500 piezas en cajas de 24, mínimo 10 cajas. ¿Cuántas cajas?"], must: [/20 cajas/, /480 piezas/], not: [/no coinciden/], sev: "medium", root: "R9", expected: "max 20 cajas = 480 (min 10 met)" },
  { id: "C28", msgs: ["Quiero como máximo 500 piezas en cajas de 24, en múltiplos de 5 cajas. ¿Cuántas cajas?"], must: [/20 cajas/, /480 piezas/], not: [/no coinciden/], sev: "medium", root: "R9", expected: "20 cajas (multiple of 5) = 480" },
  { id: "C29", msgs: ["Quiero menos de 500 piezas en cajas de 24, solo tienen 10 cajas disponibles. ¿Cuántas cajas?"], must: [/240 piezas/], not: [/necesitas 500/], sev: "high", root: "R10", expected: "ceiling → max 20 cajas; stock 10 → at most 10 cajas = 240" },
  { id: "C58", msgs: ["Necesito 600 piezas en cajas de 24, mínimo 30 cajas, menos de 800 piezas. ¿Cuántas cajas?"], must: [/30 cajas/, /720 piezas/], sev: "medium", root: "R9", expected: "25 cajas need, min 30 → 720 < 800 ok" },
  // ── follow-ups
  { id: "C30", msgs: [PENW, "¿y para 1300?"], must: [/11 cajas/, /1,320 lápices/], sev: "low", root: "-", expected: "11 cajas" },
  { id: "C31", msgs: [PENW, "¿y para 1300?", "¿y si el mínimo es 20 cajas?"], must: [/20 cajas = 2,400 lápices/], sev: "low", root: "-", expected: "20 cajas" },
  { id: "C32", msgs: [PENW, "¿y para 1300?", "¿y si el mínimo es 20 cajas?", "quítale el mínimo"], must: [/11 cajas/], not: [/no respondo preguntas abiertas/], sev: "medium", root: "R11", expected: "back to 11 cajas" },
  { id: "C33", msgs: ["Necesito 500 lápices, sets de 12, cajas de 10 sets. ¿Cuántas cajas?", "¿y si vienen de 16?"], must: [/160 lápices|4 cajas|¿/], not: [/16 lápices por caja/, /32 cajas/], sev: "high", root: "R12", expected: "sets of 16 → boxes of 160 → 4 cajas (640), or ask which pack" },
  { id: "C33b", msgs: [PENW, "¿y para 1300?", "¿y si el mínimo es 20 cajas?", "quítale el mínimo", "¿y si vienen de 16?"], must: [/160 lápices|¿/], not: [/82 cajas/], sev: "high", root: "R12", expected: "not 82 boxes of 16 lápices" },
  { id: "C34", msgs: [STK, "quítale el mínimo"], must: [/12 cajas disponibles alcanzan|10 cajas/], sev: "medium", root: "R11", expected: "10 cajas, stock 12 enough" },
  { id: "C35", msgs: [MAS, "¿y para 1000?", "¿y si vienen de 30?"], not: [/30 piezas por master/, /34 masters/], must: [/180 piezas|6 masters|¿/], sev: "high", root: "R12", expected: "cajas de 30 → masters de 180 → 6 masters, or ask" },
  { id: "C53", msgs: ["Necesito 200 pares. Cada caja trae 20 pares.", "El proveedor solo tiene 8 cajas disponibles"], must: [/8 cajas disponibles[^.]*no alcanzan/], not: [/confiable/], sev: "medium", root: "R13", expected: "10 cajas needed, 8 in stock" },
  { id: "C54", msgs: ["Necesito 200 pares. Cada caja trae 20 pares. ¿Cuántas cajas?", "el mínimo es 15 cajas y solo tienen 12 disponibles"], must: [/12 cajas disponibles/], not: [/debes pedir 15 cajas/], sev: "high", root: "R13", expected: "stock 12 covers 200 but can't meet min 15" },
  { id: "C55", msgs: [STK, "¿y si son 500 pares?", "¿y si vienen de 50?"], must: [/12 cajas disponibles sí cubres 500 pares/], sev: "low", root: "-", expected: "10 cajas need, min 15, stock 12" },
  { id: "C59", msgs: ["Necesito 200 pares, cajas de 20 pares, solo tienen 8 cajas disponibles. ¿Cuántas cajas?", "¿y 300 cuadernos en paquetes de 10?"], must: [/30 paquetes/], not: [/disponibles/], sev: "low", root: "-", expected: "30 paquetes, no stock leak" },
  { id: "C60", msgs: ["Necesito 200 pares, cajas de 20 pares, solo tienen 8 cajas disponibles. ¿Cuántas cajas?", "¿y si vienen en cajas de 50 pares?"], must: [/4 cajas/, /8 cajas disponibles alcanzan/], sev: "low", root: "-", expected: "4 cajas, stock enough" },
  { id: "C61", msgs: [PENW, "¿y si el mínimo es 60 sets?"], must: [/6 cajas/, /720 lápices/], sev: "medium", root: "R2", expected: "6 cajas = 720" },
  { id: "C62", msgs: [PENW, "¿y si son 50 cajas?"], must: [/6,000 lápices/], sev: "low", root: "-", expected: "50 cajas = 6,000" },
  { id: "C63", msgs: [STK, "¿y si el mínimo es 10 cajas?"], must: [/10 cajas/, /12 cajas disponibles alcanzan/], sev: "low", root: "-", expected: "10 cajas, stock enough" },
  { id: "C64", msgs: ["Necesito 200 pares, cajas de 20 pares, mínimo 15 cajas. ¿Cuántas cajas?", "¿y si solo tienen 12 disponibles?"], must: [/12 cajas disponibles/], not: [/Para 12 pares/], sev: "high", root: "R13", expected: "stock 12 covers 200 pares, min 15 can't be met" },
  { id: "C65", msgs: [KIT, "¿y si cada set trae 2 botellas?"], must: [/120 sets/, /300 sets/], sev: "low", root: "-", expected: "120 → min 300" },
  { id: "C66", msgs: [SHO, "¿y para 300?"], must: [/20 cajas/, /600 zapatos/], sev: "high", root: "R14", expected: "300 pares = 600 zapatos → 20 cajas" },
  { id: "C67", msgs: ["Necesito 100 pares. Cada caja trae 30 zapatos individuales. Mínimo 120 pares. ¿Cuántas cajas?", "¿y si vienen de 40?"], must: [/6 cajas/], sev: "low", root: "-", expected: "6 cajas (pair note lost: low)" },
  { id: "C68", msgs: ["Necesito 3 docenas de vasos, cajas de 10 vasos, mínimo 5 cajas, solo tienen 4 cajas disponibles. ¿Cuántas cajas?"], must: [/mínimo del proveedor es 5 cajas/, /solo tiene 4/], sev: "low", root: "-", expected: "36 vasos, 4 cajas cover, min 5 not met" },
  // ── odd values combined
  { id: "C45", msgs: ["Necesito 50 kg de tornillos en cajas de 100 tornillos, 10 cajas por master. ¿Cuántos masters?"], must: [/kg|peso/], not: [/Sí alcanza/, /1,000 kg/], sev: "high", root: "R15", expected: "ask for weight per screw / box (kg vs pieces)" },
  { id: "C46", msgs: ["Necesito 500 lápices, sets de 12, cajas de 10 sets, ah no, cajas de 8 sets. ¿Cuántas cajas?"], must: [/corregiste/], sev: "low", root: "-", expected: "ask" },
  { id: "C47", msgs: ["Necesito 500 lápices, sets de 12, cajas de 10 sets, mínimo 3.5 cajas. ¿Cuántas cajas?"], must: [/entero/], sev: "low", root: "-", expected: "ask" },
  { id: "C48", msgs: ["Necesito 500 lápices, sets de 12, cajas de 10 sets, solo tienen 0 cajas disponibles. ¿Cuántas cajas?"], must: [/0 cajas disponibles|no tiene existencias|sin existencias/], sev: "high", root: "R1", expected: "no stock → cannot order" },
  { id: "C49", msgs: ["Necesito 200 pares. Cada caja trae 20 pares. Solo tienen -5 cajas disponibles. ¿Cuántas cajas?"], must: [/negativ/], sev: "low", root: "-", expected: "ask" },
  { id: "C50", msgs: ["Necesito 200 pares. Cada caja trae 20 pares. Solo tienen 0 cajas disponibles. ¿Cuántas cajas?"], must: [/no tiene existencias disponibles/], sev: "low", root: "-", expected: "no stock" },
  { id: "C51", msgs: ["Necesito 200 pares. Cada caja trae 20 pares. Solo tienen 7.5 cajas disponibles. ¿Cuántas cajas?"], not: [/Las 5 cajas disponibles/], must: [/7\.5|7 cajas|entero/], sev: "high", root: "R16", expected: "ask (7.5 boxes) or treat as 7 → 140 pares, not enough" },
  { id: "C52", msgs: ["Necesito entre 400 y 600 lápices, sets de 12, cajas de 10 sets. ¿Cuántas cajas?"], must: [/rango/], sev: "low", root: "-", expected: "ask" },
  { id: "C56", msgs: ["Necesito 200 pares, cajas de 20 pares, mínimo 2 contenedores, solo tienen 8 cajas disponibles. ¿Cuántas cajas?"], must: [/no alcanzan/, /2 contenedores/], sev: "medium", root: "R17", expected: "stock short AND say the container minimum could not be applied" },
  { id: "C57", msgs: ["Necesito 500 lápices y 300 cuadernos. Lápices en sets de 12, solo tienen 30 sets disponibles. Cuadernos en paquetes de 10. ¿Cuántos?"], must: [/30 paquetes|cuadernos|otro pedido/], sev: "medium", root: "R17", expected: "lápices: 42 sets, 30 in stock; cuadernos: 30 paquetes (or say the second order wasn't read)" },
  // ── English
  { id: "E01", lang: "en", msgs: ["I need 200 pairs, 20 pairs per box, only 150 pairs in stock. How many boxes?"], must: [/10 boxes/, /not enough/], not: [/8 boxes/], sev: "high", root: "R4+R18", expected: "10 boxes; 150 pairs in stock not enough" },
  { id: "E02", lang: "en", msgs: ["I need 500 pieces, 24 per box, 6 boxes per master carton, only 2 masters in stock. How many masters?"], must: [/not enough/], not: [/4 master \(/], sev: "high", root: "R1", expected: "4 masters needed, 2 in stock" },
  { id: "E03", lang: "en", msgs: ["I need 240 bottles, each set has 1 bottle and 3 cups, minimum 300 sets, only 250 sets in stock. How many sets?"], must: [/250/], not: [/you should order 300 sets/], sev: "high", root: "R7", expected: "stock 250 < min 300" },
  { id: "E04", lang: "en", msgs: ["I need 100 kg in bags of 5 kg, only 15 bags available. How many bags?"], must: [/15 bags available[^.]*not enough/], sev: "high", root: "R7", expected: "20 bags needed, 15 available" },
  { id: "E05", lang: "en", msgs: ["I need fewer than 500 pieces in boxes of 24, minimum 10 boxes. How many boxes?"], must: [/20 boxes/, /480/], sev: "medium", root: "R9", expected: "20 boxes = 480" },
  { id: "E06", lang: "en", msgs: ["I need 300 pairs. Each box holds 12 pairs and each master holds 4 boxes. Only full masters. How many masters?"], must: [/7 master/, /336 pairs/], sev: "high", root: "R3", expected: "7 masters = 336 pairs" },
  { id: "E07", lang: "en", msgs: ["I need 200 pairs, 20 pairs per box, minimum 15 boxes, only 12 boxes in stock.", "what about 300?"], must: [/12 boxes available[^.]*not enough/], sev: "low", root: "-", expected: "stock not enough" },
  { id: "E08", lang: "en", msgs: ["I need 240 bottles, 1 bottle and 3 cups per set, 10 sets per box. Only full boxes. How many boxes?"], must: [/24 boxes/], not: [/30 bottles/], sev: "high", root: "R6", expected: "24 boxes" },
  { id: "E09", lang: "en", msgs: ["I need 500 pencils. Each set has 12 pencils and each box holds 10 sets. Only full boxes. The supplier only has 3 boxes in stock. How many boxes?"], must: [/3 boxes available[^.]*not enough/], sev: "high", root: "R1", expected: "5 boxes needed, 3 in stock" },
  { id: "E10", lang: "en", msgs: ["I need 200 pairs, 20 pairs per box, minimum 15 boxes. How many boxes?", "what if they only have 12 in stock?"], must: [/12 boxes/], not: [/For 12 pairs/], sev: "high", root: "R13", expected: "stock 12 can't meet min 15" },
];

const L = (id: string, d: string, t: string, sev: Sev, root: string, expected: string, must?: RegExp[], not?: RegExp[], lang?: "es" | "en"): ListCase => ({ id, d, t, sev, root, expected, must, not, lang });
const list: ListCase[] = [
  L("L01", "Molino de maíz 220V trifásico 60Hz", "220V three phase 50Hz corn mill", "high", "R20", "flag 50 Hz vs 60 Hz", [/50\s*Hz/i]),
  L("L02", "Molino de maíz 220V trifásico 60 Hz", "corn mill 220v 3 phase 50/60hz", "low", "-", "match (60 Hz offered)", [/^match/]),
  L("L03", "Molino 220V monofásico, 60Hz", "single phase 220V 50HZ grinder", "high", "R20", "flag 50 Hz", [/50\s*Hz/i]),
  L("L04", "Molino 220V, no 110V", "110V corn grinder", "high", "R21", "110 V listing excluded → other", [/^other/, /110/]),
  L("L05", "Molino 220V, no 110V", "corn grinder 110v single phase", "high", "R21", "other", [/^other/]),
  L("L06", "Molino 220V trifásico", "single phase 220V or three phase 380V rice mill", "medium", "R22", "say 220 V is offered only single-phase (three-phase is 380 V)", [/380/]),
  L("L07", "Molino 380V trifásico", "single phase 380V / three phase 220V rice mill", "medium", "R22", "same", [/220/]),
  L("L08", "Molino 220V", "220-240V rice mill", "medium", "R23", "220 is inside 220-240 → match/confirm, not 'other: 240 V'", undefined, [/^other/]),
  L("L09", "Molino 220-240V", "rice mill 230V", "medium", "R23", "230 within asked range", undefined, [/^other/]),
  L("L10", "Molino 220V trifásico", "rice mill 220V/380V three phase", "low", "-", "match", [/^match/]),
  L("L11", "Molino eléctrico 220V sin motor diésel", "diesel engine rice mill 220V", "high", "R24", "flag diesel (excluded)", [/di[eé]sel/i], [/^match/]),
  L("L12", "Molino eléctrico 220V sin motor diésel", "Rice mill with diesel engine or electric motor 220V", "medium", "R24", "confirm which motor (diesel offered)", [/di[eé]sel/i]),
  L("L13", "Molino de arroz eléctrico, no diésel", "rice mill diesel engine", "high", "R24", "flag diesel", [/di[eé]sel/i]),
  L("L14", "Molino de acero inoxidable 304, no inoxidable 201", "201 stainless steel rice mill", "high", "R25", "flag 201 (excluded grade)", [/201/]),
  L("L15", "Mesa de acero inoxidable 304, no 201", "stainless steel 201 work table", "high", "R25", "flag 201", [/201/]),
  L("L16", "Mesa de acero inoxidable, no inoxidable 201", "SS201 work table", "high", "R25", "flag SS201", [/201/]),
  L("L17", "Mesa de acero inoxidable 304", "stainless steel 201/304 table", "medium", "R25", "confirm grade (201 or 304)", [/201|grado|grade/i]),
  L("L18", "Molino 500 kg/h, 15 kW, 380V trifásico", "rice mill 500kg/h 7.5kw 380v three phase", "high", "R26", "flag 7.5 kW vs 15 kW", [/kw/i]),
  L("L19", "Molino 500 kg/h, 20 HP, 380V trifásico", "rice mill 500kg/h 10hp 380v three phase", "high", "R26", "flag 10 HP vs 20 HP", [/hp/i]),
  L("L20", "Molino 500 kg/h 220V trifásico", "rice mill 200-300kg/h 220v single phase", "low", "-", "phase + capacity both flagged", [/monofásico/, /menos de lo pedido/]),
  L("L21", "Molino de maíz 500 kg/h, trifásico, no para carne", "meat grinder 500kg/h three phase", "low", "-", "use flagged", [/carne/]),
  L("L22", "rice mill 220V three phase 60Hz, no single phase", "single phase 220V 60Hz rice mill", "low", "-", "other", [/^other/]),
  L("L23", "rice mill 220V three phase 60Hz", "three phase 220V 50Hz rice mill", "high", "R20", "flag 50 Hz", [/50\s*Hz/i]),
  L("L24", "Molino trifásico, no monofásico, 220V", "Monofásico/trifásico 220V molino", "low", "-", "confirm", [/^unknown/]),
  L("L25", "Molino 220V trifásico no monofásico", "220V monofasico molino de arroz", "low", "-", "other", [/^other/]),
  L("L26", "Molino trifásico 440V", "three-phase 380V/440V rice mill", "low", "-", "match", [/^match/]),
  L("L27", "Molino 3 fases 220 V", "3-phase 220 volt mill", "low", "-", "match", [/^match/]),
  L("L28", "Molino 220v 3F", "single phase 220v mill", "high", "R27", "3F = trifásico → other", [/^other/]),
  L("L29", "Molino 220 V trifásico", "220V 3PH mill", "low", "-", "match", [/^match/]),
  L("L30", "Molino 220 V trifásico", "220V 1PH mill", "low", "-", "other", [/^other/]),
  L("L31", "Molino 220V trifásico", "220V 2 phase mill", "low", "-", "not match", undefined, [/^match/]),
  L("L32", "Molino de acero inoxidable, no aluminio", "aluminum and stainless steel mill", "low", "-", "flag aluminio", [/aluminio/]),
  L("L33", "Molino de acero inoxidable 304 para maíz, 220V trifásico", "304 stainless steel corn mill 220V single phase", "low", "-", "phase flagged", [/monofásico/]),
  L("L34", "electric rice mill 220V, no diesel engine", "rice mill with diesel engine 220V", "high", "R24", "flag diesel", [/diesel/i], [/^match/], "en"),
  L("L35", "stainless steel 304 table, not 201", "201 stainless steel table", "high", "R25", "flag 201", [/201/], undefined, "en"),
  L("L36", "corn mill 220V, not 110V", "110V corn mill", "high", "R21", "other", [/^other/], undefined, "en"),
  L("L37", "corn mill 220V single phase 60Hz", "220V single phase 50Hz corn mill", "high", "R20", "flag 50 Hz", [/50\s*Hz/i], undefined, "en"),
  L("L38", "Molino 220V trifásico, no 380V", "380V 220V three phase mill", "medium", "R21", "should not say it asked 380 V; confirm which voltage", undefined, [/220 V \/ 380 V/], "en"),
  L("L39", "Molino 220V trifásico", "three phase 380V, single phase 220V mill", "medium", "R22", "say 220 V is the single-phase option", [/380/], undefined, "en"),
  L("L40", "Molino 110V monofásico", "110V/220V mill", "low", "-", "confirm phase", [/^unknown/], undefined, "en"),
];


afterEach(() => setLang("es"));
describe("combined conditions — chat (independent review 3)", () => {
  for (const c of chat)
    it(`${c.id}: ${c.expected}`, () => {
      setLang(c.lang || "es");
      const r = replayConversation(c.msgs);
      const reply = r[c.at ?? r.length - 1];
      for (const re of c.must) expect(reply, `${c.msgs.join(" ⟶ ")}\n${reply}`).toMatch(re);
      for (const re of c.not || []) expect(reply, `${c.msgs.join(" ⟶ ")}\n${reply}`).not.toMatch(re);
    });
});
describe("combined conditions — listing checks (independent review 3)", () => {
  for (const c of list)
    it(`${c.id}: ${c.expected}`, () => {
      setLang(c.lang || "es");
      const e = matchElectric(c.d, c.t);
      const items = listingDifferences(c.d, { productName: c.t }).items;
      const s = `${e ? `${e.status} | ${e.text}` : "electric:null"} || ${items.join(" ") || "(no differences)"}`;
      for (const re of c.must || []) expect(s, `${c.d} / ${c.t}\n${s}`).toMatch(re);
      for (const re of c.not || []) expect(s, `${c.d} / ${c.t}\n${s}`).not.toMatch(re);
    });
});
