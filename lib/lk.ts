export const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota',
  'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale',
  'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura',
  'Trincomalee', 'Vavuniya',
] as const;

export const GENDERS = ['men', 'women', 'kids', 'unisex'] as const;

// Normalise to WhatsApp format used by the agent: digits only, 94XXXXXXXXX
export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = `94${d.slice(1)}`;
  if (d.length === 9 && d.startsWith('7')) d = `94${d}`;
  return d;
}

// "1,950.50" -> 195050 cents; returns null for invalid input
export function toCents(input: FormDataEntryValue | null): number | null {
  const s = String(input ?? '').replace(/[,\s]/g, '').replace(/^LKR/i, '');
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  const v = cents / 100;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function str(fd: FormData, key: string, max = 500): string | null {
  const v = String(fd.get(key) ?? '').trim().slice(0, max);
  return v === '' ? null : v;
}
