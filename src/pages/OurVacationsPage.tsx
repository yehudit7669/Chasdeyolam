import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, Moon, Star, Sparkles, X, ChevronLeft, ChevronRight, Hotel as HotelIcon } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PREVIEW_PLAN_META, planMetaByLevel, ALL_REGIONS } from '../data/previewVacations';
import { useAllVacationImages } from '../hooks/useVacationImages';
import { useVacationPlaces } from '../hooks/useVacationPlaces';

export default function OurVacationsPage() {
  const navigate = useNavigate();
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('הכל');
  const [lightbox, setLightbox] = useState<{ index: number } | null>(null);
  const { imagesByPlace } = useAllVacationImages();
  const { places: allPlaces } = useVacationPlaces();

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

  // lightbox navigation
  const openLightbox = (index: number) => setLightbox({ index });
  const closeLightbox = () => setLightbox(null);
  const prevPhoto = () => {
    if (!lightbox) return;
    setLightbox({ index: (lightbox.index - 1 + filtered.length) % filtered.length });
  };
  const nextPhoto = () => {
    if (!lightbox) return;
    setLightbox({ index: (lightbox.index + 1) % filtered.length });
  };

  const lightboxPlace = lightbox ? filtered[lightbox.index] : null;

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

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#626D58]/10 text-[#626D58] text-xs font-semibold uppercase tracking-widest mb-4">
              <Sparkles size={12} />
              <span>הנופשים שלנו</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-[#0A192F] tracking-tight mb-4">
              המקומות שמחכים לכם
            </h1>
            <p className="text-[#33332D]/50 max-w-xl mx-auto font-light text-lg">
              מבחר מלונות, וילות וצימרים מפנקים בכל רחבי הצפון — חופשה זוגית שמגיעה לכם.
            </p>
          </div>

          {/* Filters bar */}
          <div className="max-w-3xl mx-auto bg-white rounded-[1.75rem] border border-[#E5E1D8]/70 p-5 md:p-6 mb-8" style={{ boxShadow: '0 4px 24px rgba(98,109,88,0.06)' }}>
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

          {/* Count */}
          <p className="text-center text-xs text-[#33332D]/35 mb-8 font-medium tracking-wide">
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
                  {/* Image */}
                  {(() => {
                    const dbImages = imagesByPlace[place.id];
                    const coverUrl = dbImages?.find((i) => i.media_type !== 'video')?.url ?? place.image_url;
                    return (
                  <div
                    className="relative h-52 bg-gradient-to-br from-[#E5E1D8] to-[#F7F5F0] flex items-center justify-center cursor-pointer group"
                    onClick={() => openLightbox(idx)}
                  >
                    {coverUrl ? (
                      <img
                        src={coverUrl}
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

                    {/* Rating badge */}
                    <div className="absolute top-3 end-3 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/90 text-xs font-bold text-[#B08D57]">
                      <Star size={11} fill="currentColor" />
                      <span>5.0</span>
                    </div>

                    {/* "חדש" badge */}
                    {place.is_new && (
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
                      </div>
                      <h3 className="text-lg font-bold text-[#0A192F]">{place.name_he}</h3>
                    </div>

                    {/* תיאור */}
                    <p className="text-xs text-[#33332D]/55 leading-relaxed mb-4 font-light">
                      {place.description_he}
                    </p>

                    {/* מה מקבלים */}
                    {meta && (
                      <div className="flex items-center gap-2 text-sm text-[#33332D]/60 mb-4">
                        <Moon size={14} className="text-[#626D58]" />
                        <span>{meta.nights} לילות באמצע השבוע · חופשה זוגית</span>
                      </div>
                    )}

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
                        onClick={() => navigate('/plans')}
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

          <div
            className="max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxPlace.image_url ? (
              <img
                src={lightboxPlace.image_url}
                alt={lightboxPlace.name_he}
                className="w-full h-72 object-cover"
              />
            ) : (
              <div className="w-full h-72 bg-gradient-to-br from-[#E5E1D8] to-[#F7F5F0] flex items-center justify-center">
                <HotelIcon className="text-[#33332D]/20" size={56} />
              </div>
            )}
            <div className="p-6" dir="rtl">
              <div className="flex items-center gap-2 mb-1">
                {lightboxPlace.is_new && (
                  <span className="px-2 py-0.5 rounded-lg bg-[#626D58] text-white text-[10px] font-bold">חדש</span>
                )}
                <span className="text-xs text-[#33332D]/40 flex items-center gap-1">
                  <MapPin size={11} className="text-[#626D58]" />
                  {lightboxPlace.city_he} · {lightboxPlace.region}
                </span>
              </div>
              <h3 className="text-xl font-black text-[#0A192F] mb-2">{lightboxPlace.name_he}</h3>
              <p className="text-sm text-[#33332D]/60 leading-relaxed font-light mb-4">
                {lightboxPlace.description_he}
              </p>
              <button
                onClick={() => { closeLightbox(); navigate('/plans'); }}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-[#0A192F] text-white hover:bg-[#0A192F]/90 transition-all"
              >
                הצטרפו לתוכנית
              </button>
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
            {lightbox.index + 1} / {filtered.length}
          </div>
        </div>
      )}
    </Layout>
  );
}
