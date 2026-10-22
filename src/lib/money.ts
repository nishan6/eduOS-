/** Money is handled as integer paise everywhere. These helpers are the only place rupees appear. */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function formatPaise(paise: number): string {
  return inr.format(paise / 100);
}

/** Parses a user-entered rupee amount ("1,250.50") into paise. Returns null when invalid or > 2 decimals. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}
