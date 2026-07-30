import { describe, expect, it } from "vitest";
import { dashboardSections } from "./sections";

describe("Ghanem dashboard navigation", () => {
  it("exposes only the current operator workflows", () => {
    const visibleItems = dashboardSections
      .flatMap((section) => section.items)
      .filter((item) => !item.hidden)
      .map((item) => item.label);

    expect(visibleItems).toEqual([
      "Overview",
      "Promotions",
      "Promotion codes",
      "Orders",
    ]);
  });

  it("keeps deferred OfferKit modules available but hidden", () => {
    const hiddenItems = dashboardSections
      .flatMap((section) => section.items)
      .filter((item) => item.hidden)
      .map((item) => item.label);

    expect(hiddenItems).toEqual(
      expect.arrayContaining([
        "Customers",
        "Segments",
        "Insights",
        "Loyalty",
        "Referrals",
        "Validation rules",
        "Reward types",
        "Events",
        "Webhooks",
        "API keys",
        "Audit log",
        "Users",
        "Workspace",
      ]),
    );
  });
});
