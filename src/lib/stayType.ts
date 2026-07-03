// סוג שהייה של תוכנית — קובע אילו ימי כניסה מותרים

export type StayType = 'midweek' | 'shabbat' | 'weekend' | 'any';

export const STAY_TYPE_OPTIONS: { value: StayType; label: string }[] = [
  { value: 'midweek', label: 'אמצע שבוע (2 לילות)' },
  { value: 'shabbat', label: 'שבת' },
  { value: 'weekend', label: 'סוף שבוע' },
  { value: 'any', label: 'ללא הגבלה' },
];

export function stayTypeLabel(t: string | null | undefined): string {
  return STAY_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? 'ללא הגבלה';
}

// תווית קצרה לתצוגה בכרטיסיות (בלי "2 לילות")
export function stayTypeName(t: string | null | undefined): string {
  switch (t) {
    case 'midweek': return 'אמצע שבוע';
    case 'shabbat': return 'שבת';
    case 'weekend': return 'סוף שבוע';
    default: return '';
  }
}

// ימי כניסה מותרים לפי סוג שהייה (0=ראשון ... 6=שבת)
const ALLOWED_DAYS: Record<StayType, number[]> = {
  midweek: [0, 1, 2, 3],   // ראשון–רביעי
  shabbat: [5],            // שישי (כניסה לשבת)
  weekend: [4, 5],         // חמישי–שישי
  any: [0, 1, 2, 3, 4, 5, 6],
};

export function isDayAllowed(date: Date, stayType: string | null | undefined): boolean {
  const st = (stayType ?? 'any') as StayType;
  const days = ALLOWED_DAYS[st] ?? ALLOWED_DAYS.any;
  return days.includes(date.getDay());
}
