// Chat calculations: units (pieces, pairs, dozens, sets), mixed sets, minimum
// order, multiples, follow-ups and data that must be asked instead of guessed.
// Each case is a conversation; the LAST reply must match every "must" pattern
// and none of the "mustNot" ones. Run with: npm test
import { describe, it, expect } from "vitest";
import { replayConversation } from "../src/utils/chatReply";

type Case = [string[], RegExp[], RegExp[]?];
const C: Case[] = [
  // ── basics (approved before) ──
  [["¿Cuántos sets de 12 cubren 500 lápices?"], [/42 sets/, /504 lápices/]],
  [["Quiero 500 lápices, cada set trae 12, ¿cuántos sets?"], [/42 sets/]],
  [["¿Alcanzan 40 sets de 12 para 500 lápices?"], [/No alcanza/, /42 sets/]],
  [["Necesito 500 lápices en sets de 12 y 300 cuadernos en paquetes de 10. ¿Cuántos de cada uno?"], [/42 sets/, /30 paquetes/]],
  [["Necesito 500 lápices en sets de 12 y 300 cuadernos en paquetes de 10. ¿Cuántos?", "¿Y si los cuadernos vienen en paquetes de 16 en lugar de 10?"], [/19 paquetes/]],
  [["Necesito 500 lápices en sets de 12 y 300 cuadernos en paquetes de 10. ¿Cuántos?", "¿Y si los cuadernos vienen en paquetes de 16 en lugar de 10?", "¿Y para 320 cuadernos?"], [/20 paquetes/]],
  [["Quiero 2 mil vasos, vienen en cajas de 48. ¿Cuántas cajas?"], [/42 cajas/]],
  [["40 cajas de 100 guantes, ¿cuántos guantes son?"], [/4,000 guantes/]],
  [["Necesito 3000 guantes, cajas de 100, ¿alcanzan 50 cajas?"], [/5,000 guantes/, /2,000 guantes adicionales/]],
  // ── pairs / dozens ──
  [["Necesito 1000 pares de guantes. Cada caja trae 100 guantes individuales. ¿Cuántas cajas necesito?"], [/20 cajas/]],
  [["Necesito 501 pares de zapatos. Cada caja trae 20 pares. ¿Cuántas cajas necesito?"], [/26 cajas/, /520 pares/, /19 pares adicionales/]],
  [["205 pares, cajas de 50 zapatos individuales, ¿cuántas cajas?"], [/9 cajas/, /40 zapatos \(20 pares\) adicionales/]],
  [["Tengo 200 pares de zapatos; en cada caja hay 40 zapatos individuales. ¿Cuántas cajas necesito?"], [/10 cajas/]],
  [["Necesito 50 docenas de lápices, cada caja trae 100 lápices. ¿Cuántas cajas?"], [/6 cajas/]],
  [["Necesito 2000 guantes sueltos y cada caja trae 50 pares. ¿Cuántas cajas necesito?"], [/20 cajas/]],
  [["I need 1,000 pairs of gloves. Each box has 100 individual gloves. How many boxes do I need?"], [/20 cajas|20 boxes/]],
  [["Necesito 1000 pares de guantes, ¿cuántas cajas?", "Cada caja trae 100 guantes individuales"], [/20 cajas/]],
  // ── kits ──
  [["Quiero 240 botellas, con una botella y tres tazas por set. ¿Cuántos sets necesito?"], [/240 sets/, /720 tazas/]],
  [["Necesito 241 botellas; cada set trae 2 botellas y 3 tazas. ¿Cuántos sets?"], [/121 sets/, /242 botellas/, /363 tazas/]],
  [["Cada kit trae 12 lápices y 2 borradores, necesito 500 lápices. ¿Cuántos kits?"], [/42 kits/, /84 borradores/]],
  [["Compraré 100 sets con 1 botella y 3 tazas, ¿cuántas tazas son?"], [/300 tazas/]],
  // ── zero ──
  [["Necesito 500 lápices y cada set trae cero lápices, ¿cuántos sets necesito?"], [/mayor que cero/]],
  // ── MINIMUM ORDER ──
  [["Necesito 200 pares de zapatos. Cada caja trae 20 pares. Mi proveedor exige un mínimo de 15 cajas. ¿Cuántos pares recibiré y cuántos me sobran?"], [/15 cajas/, /300 pares/, /100 pares/], [/^Necesitarías 10 cajas/]],
  [["Necesito 201 pares de zapatos en cajas de 20 pares, con pedido mínimo de 15 cajas. ¿Cuántas cajas compro?"], [/15 cajas/, /300 pares/, /99 pares/]],
  [["Mínimo 15 cajas. Cada caja trae 20 pares. Necesito 201 pares, ¿cuántas cajas?"], [/15 cajas/, /300 pares/]],
  [["Necesito 3000 guantes, cada caja trae 100 y el mínimo es 50 cajas. ¿Cuántas cajas?"], [/50 cajas/, /5,000 guantes/, /2,000 guantes/]],
  [["Necesito 3000 guantes en cajas de 100; MOQ 50 cajas. ¿Cuántos guantes recibo?"], [/50 cajas/, /5,000 guantes/]],
  [["Necesito 400 pares, cajas de 20 pares, mínimo 15 cajas, ¿cuántas cajas?"], [/20 cajas/, /cumple|cubre|supera/i]],
  [["Necesito 200 pares, cajas de 20 pares, el proveedor pide 300 pares como mínimo. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/, /100 pares/]],
  [["Necesito 1000 pares de guantes. Cada caja trae 100 guantes individuales. El mínimo es 30 cajas. ¿Cuántas cajas?"], [/30 cajas/, /3,000 guantes/, /1,000 guantes/]],
  [["Necesito 240 botellas, cada set trae 1 botella y 3 tazas, mínimo 300 sets. ¿Cuántos sets?"], [/300 sets/, /900 tazas/]],
  [["I need 200 pairs of shoes, each box has 20 pairs, minimum order 15 boxes. How many boxes?"], [/15 (cajas|boxes)/, /300 (pares|pairs)/]],
  [["Necesito 200 pares de zapatos. Cada caja trae 20 pares. Mínimo 15 cajas.", "¿y para 400?"], [/20 cajas/]],
  [["Necesito 200 pares de zapatos. Cada caja trae 20 pares. Mínimo 15 cajas. ¿Cuántas cajas?", "¿y para 250?"], [/15 cajas/, /300 pares/, /50 pares/]],
  [["¿Alcanzan 10 cajas de 20 pares para 200 pares si el mínimo es 15 cajas?"], [/15 cajas/, /mínimo/]],
  [["Necesito 200 pares de zapatos, cajas de 20 pares. Pedido mínimo: 15 cajas. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/]],
  [["Necesito 200 pares de zapatos, cajas de 20 pares; compra mínima de 15 cajas. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/]],
  [["Necesito 200 pares de zapatos, cajas de 20 pares; mínimo de compra 300 pares. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/]],
  [["Necesito 200 pares de zapatos, cajas de 20 pares; no venden menos de 15 cajas. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/]],
  [["Necesito 200 pares de zapatos, cajas de 20 pares; el proveedor vende al menos 15 cajas. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/]],
  [["Necesito 200 pares de zapatos, cajas de 20 pares; MOQ: 15 cajas. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/]],
  [["Necesito al menos 200 pares de zapatos, cajas de 20 pares. ¿Cuántas cajas?"], [/10 cajas/], [/mínimo del proveedor/]],
  [["Necesito 200 pares de zapatos, cajas de 20 pares, 15 cajas mínimo. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/]],
  [["Necesito 3,000 guantes. Cada caja trae 100. Mínimo de 5,000 guantes. ¿Cuántas cajas?"], [/50 cajas/, /5,000 guantes/]],
  [["Necesito 200 pares de zapatos. Cada caja trae 20 pares. Mínimo 15 cajas. ¿Cuántas cajas?", "¿y para 400?"], [/20 cajas/, /Cumples/]],
  [["Necesito 500 lápices en sets de 12, ¿cuántos sets?", "el mínimo es 50 sets"], [/50 sets/, /600 lápices/]],
  [["¿Cuántas cajas de 100 necesito para 5000 guantes si el pedido mínimo es de 10 cajas?"], [/50 cajas/, /Cumples/]],
  [["Necesito como mínimo 200 pares, cajas de 20 pares, ¿cuántas cajas?"], [/10 cajas/], [/mínimo del proveedor/]],
  [["Necesito mínimo 205 pares de zapatos en cajas de 20 pares, ¿cuántas cajas?"], [/11 cajas/], [/mínimo del proveedor/]],
  // ── Case A: units + minimum ──
  [["Necesito 200 pares de zapatos. Cada caja trae 40 zapatos individuales, no 40 pares. El mínimo del proveedor es 15 cajas. ¿Cuántos pares recibiré y cuántos me sobran?"], [/15 cajas/, /600 zapatos \(300 pares\)/, /200 zapatos \(100 pares\)/, /pares completos/], [/^Necesitarías 10 cajas/]],
  [["Necesito 200 pares de zapatos; en cada caja hay 40 zapatos individuales y el proveedor pide un mínimo de 15 cajas. ¿Cuántos pares recibo?"], [/15 cajas/, /300 pares/]],
  [["200 pares de zapatos, cajas de 40 zapatos sueltos, mínimo de compra 15 cajas, ¿cuántas cajas y cuántos pares sobran?"], [/15 cajas/, /100 pares/]],
  [["I need 200 pairs of shoes. Each box has 40 single shoes, not 40 pairs. The supplier's minimum is 15 boxes. How many pairs will I get?"], [/15 (cajas|boxes)/, /300 (pares|pairs)/]],
  // ── Case B: minimum + multiples ──
  [["Necesito 200 pares. Cada caja trae 20 pares. El mínimo es 15 cajas y solo venden en múltiplos de 6 cajas. ¿Cuántas cajas debo pedir y cuántos pares sobran?"], [/18 cajas/, /360 pares/, /160 pares/, /múltiplos de 6 cajas/]],
  [["Necesito 200 pares, cajas de 20 pares, mínimo 15 cajas, venden de 6 en 6 cajas. ¿Cuántas cajas?"], [/18 cajas/, /360 pares/]],
  [["Necesito 200 pares, cajas de 20 pares, en lotes de 6 cajas. ¿Cuántas cajas?"], [/12 cajas/, /240 pares/, /40 pares/]],
  [["Necesito 200 pares, cajas de 20 pares, solo venden en múltiplos de 100 pares. ¿Cuántas cajas?"], [/10 cajas/, /Cumples/]],
  [["Necesito 210 pares, cajas de 20 pares, solo venden en múltiplos de 100 pares. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/, /90 pares/]],
  [["Necesito 200 pares, cajas de 20 pares, múltiplos de 30 pares. ¿Cuántas cajas?"], [/12 cajas/, /240 pares/]],
  [["Necesito 360 pares, cajas de 20 pares, mínimo 15 cajas, múltiplos de 6 cajas. ¿Cuántas cajas?"], [/18 cajas/, /Cumples/]],
  [["Necesito 200 pares. Cada caja trae 20 pares. El mínimo es 15 cajas.", "¿y si además solo venden en múltiplos de 6 cajas?"], [/18 cajas/, /360 pares/]],
  [["Necesito 200 pares. Cada caja trae 20 pares. El mínimo es 15 cajas y múltiplos de 6 cajas. ¿Cuántas?", "¿y para 400?"], [/24 cajas/, /480 pares/]],
  [["I need 200 pairs, each box has 20 pairs, minimum 15 boxes and only in multiples of 6 boxes. How many boxes?"], [/18 (cajas|boxes)/, /360 (pares|pairs)/]],
  [["Necesito 3000 guantes en cajas de 100, mínimo 10 cajas, múltiplos de 4 cajas. ¿Cuántas?"], [/32 cajas/, /3,200 guantes/]],
  [["Necesito 240 botellas; cada set trae 1 botella y 3 tazas; mínimo 100 sets; múltiplos de 50 sets. ¿Cuántos sets?"], [/250 sets/, /750 tazas/]],
  [["¿Alcanzan 16 cajas de 20 pares para 200 pares si el mínimo es 15 cajas y venden en múltiplos de 6 cajas?"], [/18 cajas/]],
  // ── Case C: pairs can't be assured ──
  [["Necesito 200 pares de zapatos. El proveedor dice 40 zapatos individuales por caja, pero no indicó cuántos son izquierdos o derechos ni si coinciden en talla. ¿Puedo asegurar que son 20 pares vendibles por caja?"], [/^No: con esa información no se puede asegurar que sean 20 pares/, /izquierdos/, /talla/, /10 cajas/], [/aduana|importación sea autorizada|confiable/]],
  [["¿Se puede asumir que 40 zapatos sueltos por caja forman 20 pares?"], [/no se puede asegurar/, /izquierdos/]],
  [["Can I be sure that 40 single shoes per box make 20 sellable pairs?"], [/no se puede asegurar|can't be sure/]],
  [["Cada caja trae 41 zapatos individuales, ¿puedo asegurar que forman pares completos?"], [/impar/]],
  // ── invalid / contradictory data ──
  [["Necesito -200 pares, cajas de 20 pares. ¿Cuántas cajas?"], [/negativ/], [/Necesitarías/]],
  [["Necesito 0 pares, cajas de 20 pares. ¿Cuántas cajas?"], [/0/, /Cuántas unidades|cantidad/], [/Necesitarías/]],
  [["Necesito 200.5 pares, cajas de 20 pares. ¿Cuántas cajas?"], [/decimales/], [/Necesitarías/]],
  [["Necesito 200 pares, cajas de 12,5 pares. ¿Cuántas cajas?"], [/decimales/], [/Necesitarías/]],
  [["Necesito 200 pares. Cada caja trae 20 pares. Las cajas de 25 pares son las que tengo. ¿Cuántas cajas?"], [/distintos|correcto/], [/Necesitarías/]],
  [["Necesito 200 pares, cajas de 20 pares, mínimo 15 cajas, mínimo 20 cajas. ¿Cuántas cajas?"], [/no coinciden/], [/Necesitarías/]],
  [["Necesito entre 200 y 300 pares, cajas de 20 pares. ¿Cuántas cajas?"], [/rango/], [/Necesitarías/]],
  [["Necesito 500 kg de clavos, cada caja trae 100 clavos. ¿Cuántas cajas?"], [/kg/, /no adivinar|peso/], [/Necesitarías/]],
  [["Necesito 500 kg de clavos, cajas de 25 kg. ¿Cuántas cajas?"], [/20 cajas/]],
  [["Necesito 1.000 pares, cajas de 20 pares, mínimo 15 cajas. ¿Cuántas cajas?"], [/50 cajas/, /Cumples/]],
  [["Necesito 1,000 pares, cajas de 20 pares. ¿Cuántas cajas?"], [/50 cajas/]],
  [["Necesito 2 mil pares, cajas de 20 pares. ¿Cuántas cajas?"], [/100 cajas/]],
  [["Necesito 200 pares, cajas de 20 pares, mínimo 2.5 cajas. ¿Cuántas cajas?"], [/entero/], [/Necesitarías/]],
  [["Necesito 200 pares, cajas de 30 pares, múltiplos de 45 zapatos. ¿Cuántas cajas?"], [/no coinciden|no se pueden cumplir|no pude aplicar|otra unidad|necesito un dato/i]],
  [["¿Cuántas cajas me alcanzan si son 20 pares y algo así como varias docenas?"], [/No pude leer|prefiero no adivinar|cuántos/i]],
  [["Sin mínimo, necesito 200 pares en cajas de 20 pares, ¿cuántas cajas?"], [/10 cajas/], [/mínimo del proveedor/]],
  [["El mínimo es de 15 días para producir; necesito 200 pares en cajas de 20 pares, ¿cuántas cajas?"], [/10 cajas/], [/mínimo del proveedor/]],
  // ── reformulations give the same numbers ──
  [["¿Cuántas cajas de 20 pares necesito para 200 pares si el mínimo es 15 cajas?"], [/15 cajas/, /300 pares/]],
  [["Para 200 pares con cajas de 20 pares y un pedido mínimo de 15 cajas, ¿cuántas cajas compro?"], [/15 cajas/, /300 pares/]],
  [["Mínimo 15 cajas; 20 pares por caja; necesito 200 pares. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/]],
  [["Quiero 200 pares. 20 pares por caja. MOQ 15 cajas. ¿Cuántas cajas?"], [/15 cajas/, /300 pares/]],
  // ── non math stays non math ──
  [["¿Cuál es el pedido mínimo de este proveedor?"], [/./], [/Necesitarías/]],
  [["¿Es confiable este proveedor?"], [/No puedo confirmar/]],
];

describe("chat calculations", () => {
  for (const [msgs, must, mustNot = []] of C) {
    it(msgs.join(" ⟶ ").slice(0, 140), () => {
      const replies = replayConversation(msgs);
      const last = replies[replies.length - 1];
      for (const re of must) expect(last, `should match ${re}`).toMatch(re);
      for (const re of mustNot) expect(last, `should not match ${re}`).not.toMatch(re);
      expect(last).not.toMatch(/NaN|undefined|Infinity/);
    });
  }
});
