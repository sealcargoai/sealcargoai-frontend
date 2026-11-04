// 02-11s: what the results page recommends. A listing whose title contradicts the request is taken out
// BEFORE any ordering by reputation, price or popularity; listings that state everything asked come
// first, and those that leave something unstated follow as a separate group ("por confirmar").
import { listingVerdict, type Verdict } from "./differences";
import type { ComponentFlag } from "./componentMatch";

export interface Excluded<T> {
  item: T;
  reasons: string[];
}
export function groupByVerdict<T extends { productName?: string; componentFlag?: ComponentFlag }>(
  list: T[],
  description: string,
): { shown: (T & { verdict: Verdict; verdictNotes: string[] })[]; excluded: Excluded<T>[] } {
  const match: (T & { verdict: Verdict; verdictNotes: string[] })[] = [];
  const confirm: (T & { verdict: Verdict; verdictNotes: string[] })[] = [];
  const excluded: Excluded<T>[] = [];
  for (const item of list) {
    const v = listingVerdict(description, item);
    if (v.verdict === "incompatible") excluded.push({ item, reasons: v.reasons });
    else (v.verdict === "match" ? match : confirm).push({ ...item, verdict: v.verdict, verdictNotes: v.toConfirm });
  }
  return { shown: [...match, ...confirm], excluded };
}

/** Sorting the client picks applies inside each group: unconfirmed listings never climb above clear ones. */
export function sortWithinGroups<T extends { verdict?: Verdict }>(list: T[], sort: (l: T[]) => T[]): T[] {
  return [...sort(list.filter((s) => s.verdict !== "confirm")), ...sort(list.filter((s) => s.verdict === "confirm"))];
}
