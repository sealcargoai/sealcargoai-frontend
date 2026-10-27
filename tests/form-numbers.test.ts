// How the form reads the numbers people type (quantity, budget, volume, weight)
import { describe, it, expect } from "vitest";
import { plainNumber } from "../src/utils/plainNumber";

describe("plainNumber", () => {
  const cases: [string, string, string][] = [
    ["quantity", "1000", "1000"],
    ["quantity", "1,000", "1000"],
    ["quantity", "1.000", "1000"],
    ["quantity", "12,500,000", "12500000"],
    ["quantity", " 2 500 ", "2500"],
    ["quantity", "1.5", "1.5"], // stays as typed → the form says it must be whole
    ["quantity", "1,5", "1,5"],
    ["quantity", "1.000,5", "1.000,5"],
    ["budget", "50,000", "50000"],
    ["budget", "US$50,000.50", "50000.50"],
    ["budget", "$1,250", "1250"],
    ["budget", "50.000", "50.000"], // a point is a decimal point here: 50
    ["budget", "Q500", "500"],
    ["volumeCbm", "3,5", "3.5"],
    ["volumeCbm", "3.5", "3.5"],
    ["weightKg", "1,200", "1200"],
    ["weightKg", "12,75", "12.75"],
    ["weightKg", "abc", "abc"],
    ["budget", "", ""],
  ];
  for (const [field, typed, plain] of cases) it(`${field} "${typed}"`, () => expect(plainNumber(field, typed)).toBe(plain));
});
