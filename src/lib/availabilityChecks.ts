// בדיקת זמינות לפני תשלום במימוש מיידי — טבלת availability_checks

export const AVAILABILITY_VALID_HOURS = 48;

export interface AvailabilityCheck {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name_he: string | null;
  user_full_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  hotel_id: string;
  alt_hotel_id: string | null;
  date_mode: 'exact' | 'flexible';
  date_from: string;
  date_to: string;
  user_note: string | null;
  guest_names: string | null;
  guest_address: string | null;
  guest_email: string | null;
  upgrade_request: string | null;
  status: 'pending' | 'available' | 'unavailable' | 'used' | 'cancelled';
  approved_hotel_id: string | null;
  approved_date: string | null;
  approved_end_date: string | null;
  admin_note: string | null;
  responded_at: string | null;
  expires_at: string | null;
  used_request_id: string | null;
  created_at: string;
}

// "פג תוקף" לא נשמר כסטטוס — מחושב מ-expires_at
export const isExpired = (c: Pick<AvailabilityCheck, 'status' | 'expires_at'>) =>
  c.status === 'available' && !!c.expires_at && new Date(c.expires_at).getTime() < Date.now();

export const isPayable = (c: Pick<AvailabilityCheck, 'status' | 'expires_at'>) =>
  c.status === 'available' && !isExpired(c);

// תאריכי DB הם 'YYYY-MM-DD' — מפרקים ידנית כדי שלא יזוזו יום בגלל אזור זמן
const parseDay = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export const fmtDay = (s: string, withWeekday = false) =>
  parseDay(s).toLocaleDateString('he-IL', { ...(withWeekday ? { weekday: 'short' as const } : {}), day: 'numeric', month: 'long', year: 'numeric' });

export const fmtRequestedDates = (c: Pick<AvailabilityCheck, 'date_mode' | 'date_from' | 'date_to'>) =>
  c.date_mode === 'exact'
    ? `${fmtDay(c.date_from, true)} עד ${fmtDay(c.date_to, true)}`
    : `גמיש — מתי שהוא בין ${fmtDay(c.date_from)} ל-${fmtDay(c.date_to)}`;

export const fmtExpiry = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
