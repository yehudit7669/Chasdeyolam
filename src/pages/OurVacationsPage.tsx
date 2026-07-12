import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Moon, Star, Sparkles, X, ChevronLeft, ChevronRight, Hotel as HotelIcon, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { stayTypeLabel } from '../lib/stayType';
import { Layout } from '../components/Layout';
import { PREVIEW_PLAN_META, planMetaByLevel, ALL_REGIONS } from '../data/previewVacations';
import { useAllVacationImages } from '../hooks/useVacationImages';
import { useVacationPlaces } from '../hooks/useVacationPlaces';
import { FormattedDescription } from '../components/FormattedDescription';

export default function OurVacationsPage() {
  const navigate = useNavigate();
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('הכל');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ placeIdx: number } | null>(null);
  const [imgIndex, setImgIndex] = useState<Record<string, number>>({});
  const { imagesByPlace } = useAllVacationImages();
  const { places: allPlaces, availByHotel, hotelInfoById } = useVacationPlaces();

  const planFilters = [
    { key: 'all', label: 'כל התוכניות' },
    ...PREVIEW_PLAN_META.map((p) => ({
      key: p.level,
      label: `${p.name_he} · ₪${p.monthly_amount}`,
    })),
  ];

  const filtered = allPlaces.filter((p) => {
    const byPlan = planFilter === 'all' || p.level === planFilter;
    const byRegion = regionFilter === 'הכל' || p.region === regionFilter;
    return byPlan && byRegion;
  });

  const activeFilterCount = (planFilter !== 'all' ? 1 : 0) + (regionFilter !== 'הכל' ? 1 : 0);

  // גלריית תמונות לכל כרטיסייה — כל תמונות ה-DB של המקום (או fallback לתמונה הסטטית)
  const getGallery = (place: (typeof allPlaces)[number]) => {
    const dbImages = imagesByPlace[place.id]?.filter((i) => i.media_type !== 'video') ?? [];
    return dbImages.length ? dbImages.map((i) => i.url) : place.image_url ? [place.image_url] : [];
  };

  const stepImage = (placeId: string, dir: 1 | -1, count: number) => {
    if (count < 2) return;
    setImgIndex((prev) => {
      const cur = prev[placeId] ?? 0;
      return { ...prev, [placeId]: (cur + dir + count) % count };
    });
  };

  // lightbox navigation — גלילה בין כל התמונות של אותו מקום
  const openLightbox = (placeIdx: number) => setLightbox({ placeIdx });
  const closeLightbox = () => setLightbox(null);

  const lightboxPlace = lightbox ? filtered[lightbox.placeIdx] : null;
  const lightboxGallery = lightboxPlace ? getGallery(lightboxPlace) : [];
  const lightboxIdx = lightboxPlace ? (imgIndex[lightboxPlace.id] ?? 0) % Math.max(lightboxGallery.length, 1) : 0;
  const prevPhoto = () => { if (lightboxPlace) stepImage(lightboxPlace.id, -1, lightboxGallery.length); };
  const nextPhoto = () => { if (lightboxPlace) stepImage(lightboxPlace.id, 1, lightboxGallery.length); };

  return (
    <Layout>
      <div className="py-16 px-4" dir="rtl">
        <div className="max-w-7xl mx-auto">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-8 transition-colors"
          >
            <ArrowRight size={16} />
            <span>חזרה</span>
          </button>

          {/* Header — קומפקטי כדי שהמקומות יופיעו מיד */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#626D58]/10 text-[#626D58] text-[11px] font-semibold uppercase tracking-widest mb-2">
                <Sparkles size={11} />
                <span>הנופשים שלנו</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-[#0A192F] tracking-tight">
                המקומות שמחכים לכם
              </h1>
            </div>

            {/* כפתור הגדרות סינון יחיד */}
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                filtersOpen ? 'bg-[#0A192F] text-white border-[#0A192F]' : 'bg-white text-[#0A192F] border-[#E5E1D8] hover:bg-[#F7F5F0]'}`}
            >
              <SlidersHorizontal size={15} />
              <span>הגדרות סינון</span>
              {activeFilterCount > 0 && (
                <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${filtersOpen ? 'bg-white/25' : 'bg-[#626D58] text-white'}`}>
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown size={14} className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* פאנל סינון — נפתח/נסגר לפי הכפתור */}
          {filtersOpen && (
            <div className="bg-white rounded-[1.75rem] border border-[#E5E1D8]/70 p-5 md:p-6 mb-6" style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.06)' }}>
              {/* תוכנית */}
              <div className="mb-5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#33332D]/35 mb-2.5">
                  <Sparkles size={12} className="text-[#626D58]" /> תוכנית
                </div>
                <div className="flex flex-wrap gap-2">
                  {planFilters.map((f) => (
                    <button key={f.key} onClick={() => setPlanFilter(f.key)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        planFilter === f.key ? 'bg-[#0A192F] text-white shadow-sm' : 'bg-[#F7F5F0] text-[#33332D]/55 hover:bg-[#E5E1D8]/70'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* אזור */}
              <div className="pt-5 border-t border-[#E5E1D8]/60">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#33332D]/35 mb-2.5">
                  <MapPin size={12} className="text-[#626D58]" /> אזור
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_REGIONS.map((r) => (
                    <button key={r} onClick={() => setRegionFilter(r)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        regionFilter === r ? 'bg-[#626D58] text-white shadow-sm' : 'bg-[#F7F5F0] text-[#33332D]/50 hover:bg-[#E5E1D8]/70'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Count */}
          <p className="text-start text-xs text-[#33332D]/35 mb-4 font-medium tracking-wide">
            {filtered.length} מקומות
          </p>

          {/* Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((place, idx) => {
              const meta = planMetaByLevel(place.level);
              return (
                <div
                  key={place.id}
                  className="bg-white rounded-[2rem] overflow-hidden border border-[#E5E1D8]/60 transition-all duration-300 hover:-translate-y-1 flex flex-col"
                  style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
                >
                  {/* Image — גלריה עם דפדוף בין כל התמונות בלי לפתוח את הכרטיסייה */}
                  {(() => {
                    const gallery = getGallery(place);
                    const curIdx = (imgIndex[place.id] ?? 0) % Math.max(gallery.length, 1);
                    const activeUrl = gallery[curIdx];
                    return (
                  <div className="relative h-52 bg-gradient-to-br from-[#E5E1D8] to-[#F7F5F0] flex items-center justify-center group">
                    <div className="absolute inset-0 cursor-pointer" onClick={() => openLightbox(idx)}>
                    {activeUrl ? (
                      <img
                        src={activeUrl}
                        alt={place.name_he}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <>
                        <HotelIcon className="text-[#33332D]/15" size={44} />
                        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-[#33332D]/30 font-medium">
                          תמונות יתווספו בקרוב
                        </span>
                      </>
                    )}

                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white text-xs font-semibold bg-black/40 px-3 py-1.5 rounded-full transition-all">
                        הגדל
                      </span>
                    </div>
                    </div>

                    {/* חצי דפדוף בין תמונות המקום — בלי לפתוח את הכרטיסייה */}
                    {gallery.length > 1 && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); stepImage(place.id, -1, gallery.length); }}
                          className="absolute start-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#33332D] p-2 rounded-xl transition-colors shadow-sm z-10"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); stepImage(place.id, 1, gallery.length); }}
                          className="absolute end-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-[#33332D] p-2 rounded-xl transition-colors shadow-sm z-10"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                          {gallery.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all ${i === curIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Rating badge */}
                    <div className="absolute top-3 end-3 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/90 text-xs font-bold text-[#B08D57]">
                      <Star size={11} fill="currentColor" />
                      <span>5.0</span>
                    </div>

                    {/* תגית זמינות */}
                    {place.linked_hotel_id && (
                      <div className={`absolute top-3 start-3 px-2.5 py-1 rounded-xl text-[10px] font-bold tracking-wide ${
                        availByHotel[place.linked_hotel_id]
                          ? 'bg-green-500 text-white'
                          : 'bg-[#33332D]/40 text-white'
                      }`}>
                        {availByHotel[place.linked_hotel_id] ? 'תאריכים פנויים ✓' : 'לא זמין כרגע'}
                      </div>
                    )}

                    {/* "חדש" badge */}
                    {!place.linked_hotel_id && place.is_new && (
                      <div className="absolute top-3 start-3 px-2.5 py-1 rounded-xl bg-[#626D58] text-white text-[10px] font-bold tracking-wide">
                        חדש
                      </div>
                    )}
                  </div>
                    );
                  })()}

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-[#33332D]/40 mb-1.5">
                        <MapPin size={12} className="text-[#626D58]" />
                        <span>{place.city_he}</span>
                        <span className="text-[#33332D]/20">·</span>
                        <span>{place.region}</span>
                        {place.map_url && (
                          <a
                            href={place.map_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#626D58] font-semibold hover:underline mr-auto"
                          >
                            נווט
                          </a>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-[#0A192F]">{place.name_he}</h3>
                    </div>

                    {/* תיאור */}
                    <div className="text-xs text-[#33332D]/55 leading-relaxed mb-4 font-light line-clamp-2">
                      <FormattedDescription text={place.description_he} variant="compact" />
                    </div>

                    {/* מה מקבלים */}
                    {(() => {
                      const hotelInfo = place.linked_hotel_id ? hotelInfoById[place.linked_hotel_id] : null;
                      const nights = hotelInfo?.bookable_nights ?? meta?.nights;
                      const stayLabel = hotelInfo?.stay_type ? stayTypeLabel(hotelInfo.stay_type) : 'אמצע השבוע';
                      return nights ? (
                        <div className="flex items-center gap-2 text-sm text-[#33332D]/60 mb-4">
                          <Moon size={14} className="text-[#626D58]" />
                          <span>{nights} לילות · {stayLabel} · חופשה זוגית</span>
                        </div>
                      ) : null;
                    })()}

                    {/* משויך לתוכנית */}
                    {meta && (
                      <div className="mt-auto rounded-xl bg-[#626D58]/8 border border-[#626D58]/15 px-4 py-3 mb-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#626D58]/60 mb-0.5">
                          משויך לתוכנית
                        </div>
                        <div className="text-sm font-bold text-[#0A192F]">
                          {meta.name_he} — ₪{meta.monthly_amount} לחודש
                        </div>
                        <div className="text-xs text-[#33332D]/45">למשך {meta.months} חודש</div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/our-vacations/${place.id}`)}
                        className="flex-1 py-3 rounded-xl font-semibold text-sm border-2 border-[#0A192F] text-[#0A192F] hover:bg-[#0A192F]/5 transition-all"
                      >
                        פרטים נוספים
                      </button>
                      <button
                        onClick={() => navigate(meta ? `/plans?level=${meta.hotel_level}` : '/plans')}
                        className="flex-1 py-3 rounded-xl font-semibold text-sm bg-[#0A192F] text-white hover:bg-[#0A192F]/90 hover:shadow-md transition-all"
                      >
                        הצטרפו
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-14 text-center">
            <button
              onClick={() => navigate('/plans')}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-[#0A192F] transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)' }}
            >
              <span>לבחירת תוכנית</span>
              <ArrowRight size={18} className="rotate-180" />
            </button>
          </div>

        </div>
      </div>

      {/* Lightbox */}
      {lightbox && lightboxPlace && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 end-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            onClick={closeLightbox}
          >
            <X size={22} />
          </button>

          {lightboxGallery.length > 1 && (
            <>
              <button
                className="absolute end-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
              >
                <ChevronRight size={22} />
              </button>
              <button
                className="absolute start-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
              >
                <ChevronLeft size={22} />
              </button>
            </>
          )}

          {lightboxGallery[lightboxIdx] ? (
            <img
              src={lightboxGallery[lightboxIdx]}
              alt={lightboxPlace.name_he}
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="w-full max-w-2xl h-72 rounded-3xl bg-gradient-to-br from-[#E5E1D8] to-[#F7F5F0] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <HotelIcon className="text-[#33332D]/20" size={56} />
            </div>
          )}

          {lightboxGallery.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
              {lightboxIdx + 1} / {lightboxGallery.length}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
