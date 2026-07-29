export type VoucherStatus = "active" | "inactive" | "scheduled" | "expired";

export function voucherStatus(
  voucher: {
    active: boolean;
    startDate: string | null;
    endDate: string | null;
  },
  now = new Date(),
): VoucherStatus {
  if (!voucher.active) return "inactive";
  if (voucher.startDate && new Date(voucher.startDate) > now) return "scheduled";
  if (voucher.endDate && new Date(voucher.endDate) < now) return "expired";
  return "active";
}
