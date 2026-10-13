import { Mail, MapPin, Users, Sparkles } from 'lucide-react';

// פרטי אורחים בהזמנת מלון: שמות, כתובת ומייל (אפשר לבחור את המייל שאיתו נרשם),
// ובקשת שדרוג לא מחייבת.
export interface GuestDetails {
  names: string;
  address: string;
  useAccountEmail: boolean;
  otherEmail: string;
  upgrade: string;
}

export const emptyGuestDetails = (): GuestDetails => ({ names: '', address: '', useAccountEmail: true, otherEmail: '', upgrade: '' });

export const guestEmailOf = (g: GuestDetails, accountEmail: string | null | undefined) =>
  (g.useAccountEmail && accountEmail ? accountEmail : g.otherEmail).trim();

// מחזיר הודעת שגיאה, או null אם הכל מולא
export const validateGuestDetails = (g: GuestDetails, accountEmail: string | null | undefined): string | null => {
  if (!g.names.trim()) return 'נא למלא את שמות האורחים';
  if (!g.address.trim()) return 'נא למלא כתובת';
  const email = guestEmailOf(g, accountEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'נא למלא כתובת מייל תקינה';
  return null;
};

// הערכים לשמירה ב-DB (immediate_requests / availability_checks)
export const guestColumns = (g: GuestDetails, accountEmail: string | null | undefined) => ({
  guest_names: g.names.trim(),
  guest_address: g.address.trim(),
  guest_email: guestEmailOf(g, accountEmail),
  upgrade_request: g.upgrade.trim() || null,
});

const inputCls = 'w-full border border-[#E5E1D8] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0A192F]';

export function GuestDetailsFields({ value, onChange, accountEmail }: {
  value: GuestDetails;
  onChange: (v: GuestDetails) => void;
  accountEmail: string | null | undefined;
}) {
  const set = (patch: Partial<GuestDetails>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-3 text-right">
      <label className="block">
        <span className="flex items-center gap-1.5 text-xs text-[#33332D]/55 mb-1"><Users size={12} /> שמות האורחים</span>
        <textarea rows={2} value={value.names} onChange={(e) => set({ names: e.target.value })}
          placeholder="לדוגמה: ישראל ושרה כהן" className={`${inputCls} resize-none`} />
      </label>
      <label className="block">
        <span className="flex items-center gap-1.5 text-xs text-[#33332D]/55 mb-1"><MapPin size={12} /> כתובת</span>
        <input type="text" value={value.address} onChange={(e) => set({ address: e.target.value })}
          placeholder="רחוב, מספר, עיר" className={inputCls} />
      </label>
      <div>
        <span className="flex items-center gap-1.5 text-xs text-[#33332D]/55 mb-1.5"><Mail size={12} /> מייל לקבלת פרטי ההזמנה</span>
        <div className="space-y-1.5">
          {accountEmail && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" className="accent-[#626D58]" checked={value.useAccountEmail} onChange={() => set({ useAccountEmail: true })} />
              <span>המייל שנרשמתי איתו <span dir="ltr" className="text-[#33332D]/55">({accountEmail})</span></span>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" className="accent-[#626D58]" checked={!value.useAccountEmail || !accountEmail} onChange={() => set({ useAccountEmail: false })} />
            <span>מייל אחר</span>
          </label>
          {(!value.useAccountEmail || !accountEmail) && (
            <input type="email" dir="ltr" value={value.otherEmail} onChange={(e) => set({ otherEmail: e.target.value })}
              placeholder="name@example.com" className={`${inputCls} text-left`} />
          )}
        </div>
      </div>
      <label className="block">
        <span className="flex items-center gap-1.5 text-xs text-[#33332D]/55 mb-1"><Sparkles size={12} /> בקשת שדרוג <span className="text-[#33332D]/35">(לא חובה)</span></span>
        <textarea rows={2} value={value.upgrade} onChange={(e) => set({ upgrade: e.target.value })}
          placeholder="לדוגמה: חדר עם נוף, מיטה זוגית, קומה גבוהה" className={`${inputCls} resize-none`} />
        <span className="block text-[11px] text-[#33332D]/45 mt-1">נעשה מאמץ להיענות לבקשה, אך איננו מתחייבים לשדרוג.</span>
      </label>
    </div>
  );
}
