// What a listing title says against the request: power supply, materials,
// use, and the "differences" section the PDF and Excel carry.
import { describe, it, expect } from "vitest";
import { matchElectric } from "../src/utils/electricMatch";
import { matchMaterial } from "../src/utils/materialMatch";
import { listingDifferences } from "../src/utils/differences";

describe("phase and voltage", () => {
  const d = "Molino de martillos para maíz 220 V trifásico";
  it("single phase vs three phase is a difference", () => {
    const m = matchElectric(d, "Hammer mill single phase 220V corn grinder")!;
    expect(m.status).toBe("other");
    expect(m.text).toMatch(/indica monofásico; pediste trifásico/);
  });
  it("other voltage is a difference", () => expect(matchElectric(d, "Hammer mill 380V three phase")!.status).toBe("other"));
  it("same phase and voltage matches", () => expect(matchElectric(d, "Hammer mill 220v 3 phase")!.status).toBe("match"));
  it("not stated is to confirm, never a match", () => expect(matchElectric(d, "Hammer mill corn")!.status).toBe("unknown"));
  it("both phases offered is to confirm", () => expect(matchElectric(d, "Hammer mill 220V/380V single/three phase")!.status).toBe("unknown"));
  it("no electrical request, nothing to say", () => expect(matchElectric("guantes de nitrilo", "single phase 220V")).toBeNull());
});

describe("materials", () => {
  it("a blend is flagged, not labelled as the requested material", () => {
    const m = matchMaterial("guantes de nitrilo", "Disposable Vinyl Nitrile Blend Gloves")!;
    expect(m.status).toBe("match");
    expect(m.mixed).toMatch(/nitrilo, vinilo/);
  });
  it("coating vs body is a combination to confirm", () => {
    expect(matchMaterial("guantes de nitrilo", "Nitrile coated nylon gloves")!.mixed).toMatch(/recubrimiento/);
  });
  it("another material is a difference", () => expect(matchMaterial("guantes de nitrilo", "Vinyl gloves")!.status).toBe("other"));
});

describe("differences for the reports", () => {
  it("excluded medical use travels with the title", () => {
    const d = listingDifferences("Guantes de nitrilo para limpieza industrial, no uso médico", {
      productName: "black nitrile exam gloves box medical powderfree",
    });
    expect(d.title).toMatch(/medical/);
    expect(d.items.join(" ")).toMatch(/uso médico, un uso que excluiste/);
  });
  it("power supply and capacity differences", () => {
    const d = listingDifferences("Molino de martillos para maíz 220 V trifásico, 500 kg/h", { productName: "Corn hammer mill single phase 220V 300kg/h" });
    expect(d.items.join(" ")).toMatch(/monofásico; pediste trifásico/);
    expect(d.items.join(" ")).toMatch(/300 kg\/hora \(menos de lo pedido\)/);
  });
  it("no title, no section", () => expect(listingDifferences("x", {}).items).toEqual([]));
});
