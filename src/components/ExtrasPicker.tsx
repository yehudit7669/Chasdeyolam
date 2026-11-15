import { Minus, Plus, PlusCircle } from 'lucide-react';
import { HotelExtra, SelectedExtra, extrasTotal, fmtShekel } from '../lib/hotelExtras';

// בחירת תוספות בתשלום בהזמנת מלון — כמות לכל תוספת (0 = לא נבחר)
export function ExtrasPicker({ extras, value, onChange }: {
  extras: HotelExtra[];
  value: SelectedExtra[];
  onChange: (v: SelectedExtra[]) => void;
}) {
  if (!extras.length) return null;
  const qtyOf = (label: string) => value.find((v) => v.label === label)?.qty ?? 0;
  const setQty = (extra: HotelExtra, qty: number) => {
    const rest = value.filter((v) => v.label !== extra.label);
    onChange(qty > 0 ? [...rest, { ...extra, qty }] : rest);
  };
  const total = extrasTotal(value);

  return (
    <div className="rounded-xl border border-[#E5E1D8] bg-white p-3 text-right">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#33332D]/70 mb-2">
        <PlusCircle size={13} className="text-[#626D58]" /> תוספות בתשלום <span className="font-normal text-[#33332D]/40">(לא חובה)</span>
      </div>
      <div className="space-y-2">
        {extras.map((e) => {
          const q = qtyOf(e.label);
          return (
            <div key={e.label} className="flex items-center justify-between gap-3 text-sm">
              <span className={q ? 'text-[#0A192F] font-semibold' : 'text-[#33332D]/75'}>
                {e.label} <span className="text-[#33332D]/45 font-normal">· {fmtShekel(e.price)}</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0" dir="ltr">
                <button type="button" onClick={() => setQty(e, Math.max(0, q - 1))} disabled={!q}
                  className="w-7 h-7 rounded-lg border border-[#E5E1D8] flex items-center justify-center text-[#33332D]/60 hover:bg-[#F7F5F0] disabled:opacity-30">
                  <Minus size={13} />
                </button>
                <span className="w-5 text-center font-semibold text-[#0A192F]">{q}</span>
                <button type="button" onClick={() => setQty(e, Math.min(10, q + 1))}
                  className="w-7 h-7 rounded-lg border border-[#E5E1D8] flex items-center justify-center text-[#33332D]/60 hover:bg-[#F7F5F0]">
                  <Plus size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {total > 0 && (
        <div className="mt-3 pt-2 border-t border-[#E5E1D8]/70 text-sm">
          <div className="flex justify-between font-bold text-[#0A192F]"><span>סה״כ תוספות</span><span>{fmtShekel(total)}</span></div>
          <p className="text-[11px] text-[#33332D]/50 mt-1">התשלום על התוספות לא נגבה באתר — נתאם אותו איתכם יחד עם אישור ההזמנה.</p>
        </div>
      )}
    </div>
  );
}

// תצוגה למנהל: מה הלקוח בחר + סה"כ
export function SelectedExtrasSummary({ extras }: { extras: SelectedExtra[] }) {
  if (!extras.length) return null;
  return (
    <div>
      <b className="font-semibold">תוספות בתשלום:</b>{' '}
      {extras.map((e) => `${e.label}${e.qty > 1 ? ` ×${e.qty}` : ''} (${fmtShekel(e.price * e.qty)})`).join(' · ')}
      {' '}— <b className="font-semibold">סה״כ {fmtShekel(extrasTotal(extras))}</b>
    </div>
  );
}
