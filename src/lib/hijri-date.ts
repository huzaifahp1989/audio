import { ISLAMIC_MONTHS } from '@/data/islamic-months';

export interface UkHijriDate {
  /** Day of the Hijri month (1-30). */
  day: number;
  /** 1-based Hijri month number (1-12). */
  monthNumber: number;
  /** Kid-friendly English month name (from ISLAMIC_MONTHS). */
  monthName: string;
  /** Arabic script month name. */
  monthArabic: string;
  /** Hijri year. */
  year: number;
  /** Weekday name, e.g. "Wednesday". */
  weekday: string;
  /** Short readable Hijri date, e.g. "15 Ramadan 1447 AH". */
  formatted: string;
  /** The matching UK Gregorian date, e.g. "Wednesday, 22 July 2026". */
  gregorian: string;
}

/** UK-relevant timezone. The Hijri day rolls over at UK local midnight. */
const UK_TIME_ZONE = 'Europe/London';

/**
 * Islamic calendar used for the calculation. `islamic-umalqura` (the Umm al-Qura
 * calendar) is the most widely used civil Hijri calendar.
 */
const HIJRI_LOCALE = 'en-GB-u-ca-islamic-umalqura';

/**
 * Day adjustment applied to the Umm al-Qura result to match the date observed in
 * the UK. UK moon-sighting typically runs one day behind the Umm al-Qura
 * calculation, so we shift the Hijri computation back by a day. The Gregorian
 * date shown to the user is NOT shifted — it always reflects the real calendar day.
 */
const UK_HIJRI_ADJUSTMENT_DAYS = -1;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? '';
}

/**
 * Compute the current Islamic (Hijri) date as observed in the UK.
 *
 * Uses the browser/Node `Intl` Umm al-Qura calendar in the Europe/London
 * timezone so the date is correct for UK users and rolls over at UK midnight.
 */
export function getUkHijriDate(date: Date = new Date()): UkHijriDate {
  // Shift only the Hijri computation to match UK moon-sighting; the Gregorian
  // display below still uses the unshifted `date`.
  const hijriDate = new Date(date.getTime() + UK_HIJRI_ADJUSTMENT_DAYS * MS_PER_DAY);

  const hijriParts = new Intl.DateTimeFormat(HIJRI_LOCALE, {
    timeZone: UK_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(hijriDate);

  const day = parseInt(partValue(hijriParts, 'day'), 10) || 1;
  const monthNumber = parseInt(partValue(hijriParts, 'month'), 10) || 1;
  const year = parseInt(partValue(hijriParts, 'year').replace(/[^0-9]/g, ''), 10) || 0;
  // Weekday reflects the real calendar day, not the Hijri-adjusted one.
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIME_ZONE,
    weekday: 'long',
  }).format(date);

  // Prefer our consistent, kid-friendly spelling from the data file, falling
  // back to the value Intl produced if the number is somehow out of range.
  const monthData = ISLAMIC_MONTHS.find((m) => m.number === monthNumber);
  const monthName = monthData?.name ?? partValue(hijriParts, 'month');
  const monthArabic = monthData?.arabic ?? '';

  const gregorian = new Intl.DateTimeFormat('en-GB', {
    timeZone: UK_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

  return {
    day,
    monthNumber,
    monthName,
    monthArabic,
    year,
    weekday,
    formatted: `${day} ${monthName} ${year} AH`,
    gregorian,
  };
}
