// תוספות בתשלום במלון (ילד נוסף, שדרוג חדר...): המנהל מגדיר ב-hotels.extras,
// הלקוח מסמן בהזמנה ונשמר ב-selected_extras עם המחיר של אותו רגע.

export interface HotelExtra {
  label: string;
  price: number;
}

export interface SelectedExtra extends HotelExtra {
  qty: number;
}

// מנקה ערך שהגיע מה-DB (jsonb) לרשימה תקינה
export const parseExtras = (raw: unknown): HotelExtra[] =>
  Array.isArray(raw)
    ? raw
        .filter((e) => e && typeof e.label === 'string' && e.label.trim())
        .map((e) => ({ label: String(e.label).trim(), price: Number(e.price) || 0 }))
    : [];

export const parseSelectedExtras = (raw: unknown): SelectedExtra[] =>
  Array.isArray(raw)
    ? raw
        .filter((e) => e && typeof e.label === 'string' && Number(e.qty) > 0)
        .map((e) => ({ label: String(e.label), price: Number(e.price) || 0, qty: Number(e.qty) }))
    : [];

export const extrasTotal = (sel: SelectedExtra[] | null | undefined) =>
  (sel ?? []).reduce((sum, e) => sum + e.price * e.qty, 0);

// לשמירה ב-DB: רק מה שסומן, או null אם לא סומן כלום
export const selectedExtrasColumn = (sel: SelectedExtra[]) => {
  const chosen = sel.filter((e) => e.qty > 0);
  return chosen.length ? chosen : null;
};

export const fmtShekel = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;
