import { ReactNode, useState } from 'react';
import { BedDouble, UtensilsCrossed, Moon, Check } from 'lucide-react';

// "מה מקבלים" במלון — נערך בניהול האתר ← מלונות, מוצג ללקוח בכפתור "עוד" ליד שם המלון
export interface HotelPackage {
  room_type?: string | null;
  meals?: string | null;
  package_includes?: string | null;
  bookable_nights?: number | null;
}

// העמודות שצריך לבחור מ-hotels כדי להציג את הפירוט
export const HOTEL_PACKAGE_COLUMNS = 'room_type, meals, package_includes, bookable_nights';

export const hasPackageDetails = (h: HotelPackage) =>
  !!(h.room_type?.trim() || h.meals?.trim() || h.package_includes?.trim());

export function HotelPackagePanel({ hotel }: { hotel: HotelPackage }) {
  const includes = (hotel.package_includes ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const row = 'flex items-start gap-2';
  const icon = 'mt-0.5 shrink-0 text-[#626D58]';
  return (
    <div className="mt-2 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8]/70 px-4 py-3 space-y-1.5 text-sm font-normal text-[#33332D]/75 text-right">
      {hotel.room_type?.trim() && <div className={row}><BedDouble size={14} className={icon} /><span><b className="font-semibold text-[#0A192F]">חדר:</b> {hotel.room_type}</span></div>}
      {hotel.meals?.trim() && <div className={row}><UtensilsCrossed size={14} className={icon} /><span><b className="font-semibold text-[#0A192F]">ארוחות:</b> {hotel.meals}</span></div>}
      {!!hotel.bookable_nights && (
        <div className={row}><Moon size={14} className={icon} /><span>{hotel.bookable_nights} {hotel.bookable_nights === 1 ? 'לילה' : 'לילות'}</span></div>
      )}
      {includes.map((line, i) => (
        <div key={i} className={row}><Check size={14} className={icon} /><span>{line}</span></div>
      ))}
    </div>
  );
}

// כפתור "עוד" שפותח את הפירוט. מחזיר את הכפתור ואת הפאנל בנפרד כדי שאפשר יהיה לשים
// את הכפתור ליד השם ואת הפאנל מתחת — גם כשהשם יושב בתוך כרטיס לחיץ.
export function useHotelPackageToggle(hotel: HotelPackage, onToggle?: () => void) {
  const [open, setOpen] = useState(false);
  const has = hasPackageDetails(hotel);
  const button: ReactNode = has ? (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); onToggle?.(); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); onToggle?.(); } }}
      className="inline-block text-xs font-semibold text-[#626D58] underline underline-offset-2 hover:text-[#0A192F] cursor-pointer whitespace-nowrap"
    >
      {open ? 'פחות' : 'עוד'}
    </span>
  ) : null;
  const panel: ReactNode = has && open ? <HotelPackagePanel hotel={hotel} /> : null;
  return { button, panel };
}

// שורת שם מלון + "עוד" + פאנל — לרשימות פשוטות
export function HotelNameWithDetails({ hotel, children, className, onToggle }: {
  hotel: HotelPackage; children: ReactNode; className?: string; onToggle?: () => void;
}) {
  const { button, panel } = useHotelPackageToggle(hotel, onToggle);
  return (
    <div className={className}>
      <div className="flex items-start gap-2 flex-wrap">{children}{button}</div>
      {panel}
    </div>
  );
}
