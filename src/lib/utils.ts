import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(
  amountInMinor: number,
  currency: string = "INR",
  locale: string = "en-IN",
) {
  const value = amountInMinor / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatTonnage(tons: number | string, unit: string = "Tons") {
  const n = typeof tons === "string" ? Number(tons) : tons;
  if (Number.isNaN(n)) return `0 ${unit}`;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit}`;
}

export function toMinorUnits(major: number) {
  return Math.round(major * 100);
}

export function fromMinorUnits(minor: number) {
  return minor / 100;
}
