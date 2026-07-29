import { describe, expect, it } from "vitest";
import { voucherStatus } from "./voucher-status";

const now = new Date("2026-07-29T12:00:00.000Z");

describe("voucherStatus", () => {
  it("prioritizes the disabled toggle", () => {
    expect(
      voucherStatus(
        {
          active: false,
          startDate: "2026-07-30T00:00:00.000Z",
          endDate: "2026-08-01T00:00:00.000Z",
        },
        now,
      ),
    ).toBe("inactive");
  });

  it("reports scheduled and expired date windows", () => {
    expect(
      voucherStatus(
        { active: true, startDate: "2026-07-30T00:00:00.000Z", endDate: null },
        now,
      ),
    ).toBe("scheduled");
    expect(
      voucherStatus(
        { active: true, startDate: null, endDate: "2026-07-28T00:00:00.000Z" },
        now,
      ),
    ).toBe("expired");
  });

  it("reports active inside the validity window", () => {
    expect(
      voucherStatus(
        {
          active: true,
          startDate: "2026-07-28T00:00:00.000Z",
          endDate: "2026-07-30T00:00:00.000Z",
        },
        now,
      ),
    ).toBe("active");
  });
});
