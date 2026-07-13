// ימי כניסה מותרים (0=ראשון ... 6=שבת).
// ברירת מחדל נקבעת ברמת התוכנית (plans.bookable_days) וחלה על כל המלונות שלה אוטומטית.
// מלון עם הגדרה עצמית (hotels.bookable_days לא ריק) — זו חריגה שגוברת על ברירת המחדל של התוכנית.

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function formatBookableDays(days: number[] | null | undefined): string {
  if (!days || days.length === 0 || days.length === 7) return 'ללא הגבלה — כל הימים';
  return days.slice().sort((a, b) => a - b).map((d) => DAY_NAMES[d]).join(', ');
}

// הימים שבפועל חלים על מלון: החריגה שלו אם קיימת, אחרת ברירת המחדל של התוכנית
export function effectiveBookableDays(
  hotelDays: number[] | null | undefined,
  planDays: number[] | null | undefined
): number[] {
  if (hotelDays && hotelDays.length > 0) return hotelDays;
  return planDays ?? [];
}

export function isDayAllowed(date: Date, allowedDays: number[] | null | undefined): boolean {
  if (!allowedDays || allowedDays.length === 0) return true;
  return allowedDays.includes(date.getDay());
}
