import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, MapPin, Moon, Star, ExternalLink, X, ChevronLeft, ChevronRight, Hotel as HotelIcon, Sparkles, Video, PlayCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { planMetaByLevel } from '../data/previewVacations';
import { useVacationImages, getVideoEmbedUrl } from '../hooks/useVacationImages';
import { useVacationPlaces } from '../hooks/useVacationPlaces';
import { FormattedDescription } from '../components/FormattedDescription';

interface MediaItem { url: string; type: 'image' | 'video'; }

export default function VacationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { places, loading } = useVacationPlaces();
  const place = places.find((p) => p.id === id);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const { images: dbImages } = useVacationImages(id ?? '');

  if (!place) {
    if (loading) return <Layout><div className="min-h-[60vh]" /></Layout>;
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4" dir="rtl">
          <p className="text-[#33332D]/50 text-lg">המקום לא נמצא</p>
          <button onClick={() => navigate('/our-vacations')} className="text-sm text-[#0A192F] underline">
            חזרה לנופשים שלנו
          </button>
        </div>
      </Layout>
    );
  }

  const meta = planMetaByLevel(place.level);
  // DB מדיה (תמונות+סרטונים) גוברת על הסטטיק
  const gallery: MediaItem[] = dbImages.length
    ? dbImages.map((i) => ({ url: i.url, type: i.media_type === 'video' ? 'video' as const : 'image' as const }))
    : place.images?.length
    ? place.images.map((url) => ({ url, type: 'image' as const }))
    : place.image_url
    ? [{ url: place.image_url, type: 'image' as const }]
    : [];
  const hasGallery = gallery.length > 0;
  const websiteUrl = place.website_url;
  const mapUrl = place.map_url;

  const openLightbox = (idx: number) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const prev = () => setLightboxIdx((i) => (i === null ? 0 : (i - 1 + gallery.length) % gallery.length));
  const next = () => setLightboxIdx((i) => (i === null ? 0 : (i + 1) % gallery.length));

  return (
    <Layout>
      <div className="py-16 px-4" dir="rtl">
        <div className="max-w-5xl mx-auto">

          {/* Back */}
          <button
            onClick={() => navigate('/our-vacations')}
            className="inline-flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-8 transition-colors"
          >
            <ArrowRight size={16} />
            <span>חזרה לכל המקומות</span>
          </button>

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-[#33332D]/45">
                <MapPin size={14} className="text-[#626D58]" />
                <span>{place.city_he}</span>
                <span className="text-[#33332D]/20">·</span>
                <span>{place.region}</span>
              </div>
              {place.is_new && (
                <span className="px-2.5 py-1 rounded-lg bg-[#626D58] text-white text-[10px] font-bold tracking-wide">
                  חדש
                </span>
              )}
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#B08D57]/10 text-xs font-bold text-[#B08D57]">
                <Star size={11} fill="currentColor" />
                <span>5.0</span>
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-[#0A192F] mb-3">{place.name_he}</h1>
            <div className="text-[#33332D]/60 text-base max-w-2xl">
              <FormattedDescription text={place.description_he} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-start">

            {/* Gallery — 2/3 */}
            <div className="md:col-span-2">
              {hasGallery ? (
                <div className="space-y-3">
                  {/* פריט ראשי */}
                  <div
                    className="relative rounded-3xl overflow-hidden h-80 cursor-pointer group bg-black/5"
                    onClick={() => openLightbox(0)}
                  >
                    {gallery[0].type === 'video' ? (
                      getVideoEmbedUrl(gallery[0].url) ? (
                        <div className="w-full h-full flex items-center justify-center bg-[#0A192F]/5">
                          <PlayCircle className="text-[#33332D]/25" size={64} />
                        </div>
                      ) : (
                        <video src={gallery[0].url} className="w-full h-full object-cover" muted preload="metadata" />
                      )
                    ) : (
                      <img src={gallery[0].url} alt={place.name_he} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all flex items-center justify-center">
                      {gallery[0].type === 'video' ? (
                        <PlayCircle className="text-white/90 drop-shadow-lg" size={56} />
                      ) : (
                        <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-semibold bg-black/40 px-4 py-2 rounded-full transition-all">
                          הגדל
                        </span>
                      )}
                    </div>
                  </div>
                  {/* שאר הפריטים */}
                  {gallery.length > 1 && (
                    <div className="grid grid-cols-3 gap-3">
                      {gallery.slice(1).map((item, i) => (
                        <div
                          key={i}
                          className="relative rounded-2xl overflow-hidden h-28 cursor-pointer group bg-black/5"
                          onClick={() => openLightbox(i + 1)}
                        >
                          {item.type === 'video' ? (
                            getVideoEmbedUrl(item.url) ? (
                              <div className="w-full h-full flex items-center justify-center bg-[#0A192F]/5">
                                <Video className="text-[#33332D]/25" size={22} />
                              </div>
                            ) : (
                              <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
                            )
                          ) : (
                            <img src={item.url} alt={`${place.name_he} ${i + 2}`} className="w-full h-full object-cover" loading="lazy" />
                          )}
                          {item.type === 'video' && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <PlayCircle className="text-white/90 drop-shadow-lg" size={26} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Placeholder כשאין תמונות */
                <div className="rounded-3xl overflow-hidden h-80 bg-gradient-to-br from-[#E5E1D8] to-[#F7F5F0] flex flex-col items-center justify-center gap-3">
                  <HotelIcon className="text-[#33332D]/15" size={56} />
                  <p className="text-sm text-[#33332D]/30 font-medium">תמונות יתווספו בקרוב</p>
                  <p className="text-xs text-[#33332D]/20">המנהל יעלה תמונות דרך ממשק האדמין</p>
                </div>
              )}

              {/* קישור לאתר המלון + ניווט */}
              <div className="mt-4 flex flex-wrap gap-3">
                {websiteUrl ? (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[#0A192F] text-sm font-semibold text-[#0A192F] hover:bg-[#0A192F] hover:text-white transition-all"
                  >
                    <ExternalLink size={15} />
                    <span>לאתר {place.name_he}</span>
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-[#E5E1D8] text-sm text-[#33332D]/30">
                    <ExternalLink size={15} />
                    <span>קישור לאתר יתווסף בקרוב</span>
                  </div>
                )}

                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#626D58] text-sm font-semibold text-white hover:bg-[#626D58]/90 transition-all"
                  >
                    <MapPin size={15} />
                    <span>נווט למקום</span>
                  </a>
                )}
              </div>
            </div>

            {/* Sidebar — 1/3 */}
            <div className="space-y-4">

              {/* מפרט */}
              <div className="bg-white border border-[#E5E1D8]/60 rounded-3xl p-6" style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.07)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-[#F0EDE6] flex items-center justify-center">
                    <Sparkles size={15} className="text-[#B08D57]" />
                  </div>
                  <h2 className="text-base font-bold text-[#0A192F]">מפרט החופשה</h2>
                </div>

                <div className="space-y-3">
                  {meta && (
                    <>
                      <div className="flex items-center justify-between py-2.5 border-b border-[#E5E1D8]/40">
                        <span className="text-xs text-[#33332D]/50">לילות</span>
                        <span className="text-sm font-bold text-[#0A192F] flex items-center gap-1">
                          <Moon size={13} className="text-[#626D58]" />
                          {meta.nights} לילות באמצע השבוע
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5 border-b border-[#E5E1D8]/40">
                        <span className="text-xs text-[#33332D]/50">סוג</span>
                        <span className="text-sm font-bold text-[#0A192F]">חופשה זוגית</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5 border-b border-[#E5E1D8]/40">
                        <span className="text-xs text-[#33332D]/50">כשרות</span>
                        <span className="text-sm font-bold text-[#0A192F]">כשר למהדרין</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs text-[#33332D]/50">אזור</span>
                    <span className="text-sm font-bold text-[#0A192F]">{place.region}</span>
                  </div>
                </div>
              </div>

              {/* תוכנית */}
              {meta && (
                <div className="bg-[#0A192F] rounded-3xl p-6 text-white">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                    משויך לתוכנית
                  </div>
                  <div className="text-lg font-black mb-0.5">{meta.name_he}</div>
                  <div className="text-[#D4B483] font-bold text-sm mb-1">₪{meta.monthly_amount} לחודש</div>
                  <div className="text-white/40 text-xs mb-5">למשך {meta.months} חודש</div>
                  <button
                    onClick={() => navigate('/plans')}
                    className="w-full py-3 rounded-xl font-bold text-sm text-[#0A192F] hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)' }}
                  >
                    הצטרפו לתוכנית
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && hasGallery && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 end-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            onClick={closeLightbox}
          >
            <X size={22} />
          </button>

          {gallery.length > 1 && (
            <>
              <button
                className="absolute end-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                onClick={(e) => { e.stopPropagation(); prev(); }}
              >
                <ChevronRight size={22} />
              </button>
              <button
                className="absolute start-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                onClick={(e) => { e.stopPropagation(); next(); }}
              >
                <ChevronLeft size={22} />
              </button>
            </>
          )}

          {gallery[lightboxIdx].type === 'video' ? (
            getVideoEmbedUrl(gallery[lightboxIdx].url) ? (
              <iframe
                src={getVideoEmbedUrl(gallery[lightboxIdx].url) as string}
                className="w-full max-w-3xl aspect-video rounded-2xl shadow-2xl"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <video
                src={gallery[lightboxIdx].url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            )
          ) : (
            <img
              src={gallery[lightboxIdx].url}
              alt={place.name_he}
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {gallery.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
              {lightboxIdx + 1} / {gallery.length}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
