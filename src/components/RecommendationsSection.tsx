import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronRight, ChevronLeft, X, ZoomIn, ZoomOut } from 'lucide-react';

interface Recommendation {
  id: number;
  rabbiName: string;
  title: string;
  institution: string;
  imageSrc: string;
  pdfSrc: string;
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: 1,
    rabbiName: 'הרב יצחק אזרחי',
    title: 'מראשי הישיבה',
    institution: 'ישיבת מיר ירושלים',
    imageSrc: '/recommendations/images/המלצה_הרב_יצחק_אזרחי.svg',
    pdfSrc: '/recommendations/pdfs/המלצה_הרב_יצחק_אזרחי.pdf',
  },
  {
    id: 2,
    rabbiName: 'הרב בנימין פינקל',
    title: 'ראש הישיבה',
    institution: 'ישיבת מיר ירושלים',
    imageSrc: '/recommendations/images/המלצה_הרב_בנימין_פינקל.svg',
    pdfSrc: '/recommendations/pdfs/המלצה_הרב_בנימין_פינקל.pdf',
  },
  {
    id: 3,
    rabbiName: 'הרב ישראל יצחק זילברמן',
    title: 'רב שכונת נוה יעקב מרכז',
    institution: 'ירושלים',
    imageSrc: '/recommendations/images/הרב_זילברמן.svg',
    pdfSrc: '/recommendations/pdfs/הרב_זילברמן.pdf',
  },
  {
    id: 4,
    rabbiName: 'הרב רפאל צבי ובר',
    title: 'רב שכונת נוה יעקב',
    institution: 'ירושלים',
    imageSrc: '/recommendations/images/המלצה_הרב_ובר.svg',
    pdfSrc: '/recommendations/pdfs/המלצה_הרב_ובר.pdf',
  },
];

// How many cards are visible per breakpoint
const VISIBLE = { mobile: 1, tablet: 2, desktop: 3 } as const;

function useVisibleCount() {
  const [count, setCount] = useState(3);
  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setCount(1);
      else if (window.innerWidth < 1024) setCount(2);
      else setCount(3);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return count;
}

export function RecommendationsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [lbTouchStart, setLbTouchStart] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = RECOMMENDATIONS.length;
  const visibleCount = useVisibleCount();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const next = useCallback(() => {
    setActiveIndex((i) => (i + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (isPaused || lightboxIndex !== null) return;
    autoScrollRef.current = setInterval(next, 6000);
    return () => { if (autoScrollRef.current) clearInterval(autoScrollRef.current); };
  }, [isPaused, lightboxIndex, next]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') lightboxPrev();
      if (e.key === 'ArrowLeft') lightboxNext();
      if (e.key === '+') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setZoom(1);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
    setZoom(1);
    document.body.style.overflow = '';
  };

  const lightboxNext = () => {
    setLightboxIndex((i) => i === null ? null : (i + 1) % total);
    setZoom(1);
  };

  const lightboxPrev = () => {
    setLightboxIndex((i) => i === null ? null : (i - 1 + total) % total);
    setZoom(1);
  };

  // Carousel swipe
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    setTouchStart(null);
  };

  // Lightbox swipe
  const handleLbTouchStart = (e: React.TouchEvent) => setLbTouchStart(e.touches[0].clientX);
  const handleLbTouchEnd = (e: React.TouchEvent) => {
    if (lbTouchStart === null) return;
    const diff = lbTouchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? lightboxNext() : lightboxPrev();
    setLbTouchStart(null);
  };

  // Build the ordered list of indices to render in the single row.
  // We always show `visibleCount` cards starting from activeIndex.
  const visibleIndices = Array.from(
    { length: visibleCount },
    (_, k) => (activeIndex + k) % total
  );

  return (
    <section
      ref={sectionRef}
      dir="rtl"
      className={`py-32 bg-[#F7F5F0] relative overflow-hidden transition-all duration-1000 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-[#C6A75E]/5 to-transparent rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-[#626D58]/4 to-transparent rounded-full translate-x-1/2 translate-y-1/2 blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 relative z-10">

        {/* Section header */}
        <div className="text-center mb-20">
          <p className="text-[10px] font-bold text-[#B08D57] tracking-[0.3em] uppercase mb-6">
            המלצות
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-[#0A192F] tracking-tight leading-tight mb-6">
            המלצות גדולי ישראל
            <br />
            <span className="text-[#B08D57] font-serif italic font-normal text-3xl md:text-4xl">
              על פעילות הגמ״ח
            </span>
          </h2>
          <div className="w-16 h-1 bg-[#D4B483] mx-auto mb-8" />
          <p className="text-lg text-[#33332D]/65 max-w-xl mx-auto leading-relaxed font-light">
            מכתבי המלצה וברכה מגדולי התורה על פעילות גמ״ח חסדי עולם
          </p>
        </div>

        {/* ── Carousel ── */}
        <div
          className="relative max-w-3xl mx-auto"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Single-row track — never wraps */}
          <div
            className="flex gap-4 overflow-hidden"
            style={{ flexWrap: 'nowrap' }}
          >
            {visibleIndices.map((recIdx, slot) => {
              const rec = RECOMMENDATIONS[recIdx];
              const isFirst = slot === 0;
              return (
                <div
                  key={`${recIdx}-${slot}`}
                  className="group cursor-pointer flex-shrink-0 transition-all duration-500"
                  style={{ width: `calc((100% - ${(visibleCount - 1) * 16}px) / ${visibleCount})` }}
                  onClick={() => openLightbox(recIdx)}
                >
                  <div
                    className={`rounded-2xl overflow-hidden border transition-all duration-500 flex flex-col h-full ${
                      isFirst && visibleCount === 1
                        ? 'border-[#C6A75E]/40 shadow-[0_20px_60px_rgba(176,141,87,0.18)]'
                        : 'border-[#E5E1D8] shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(176,141,87,0.14)] hover:border-[#C6A75E]/30'
                    } bg-white`}
                  >
                    {/* Image */}
                    <div className="relative overflow-hidden bg-[#F9F8F4]" style={{ aspectRatio: '3/4' }}>
                      <img
                        src={rec.imageSrc}
                        alt={`מכתב המלצה – ${rec.rabbiName}`}
                        className="w-full h-full transition-transform duration-700 group-hover:scale-105"
                        style={{ objectFit: 'contain', objectPosition: 'top' }}
                        loading="lazy"
                        decoding="async"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-5">
                        <span className="text-white text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30 flex items-center gap-1.5">
                          <ZoomIn size={13} />
                          לחץ לצפייה
                        </span>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[#F0EDE8] bg-white">
                      <div className="text-[#0A192F] font-bold text-sm leading-tight mb-0.5" dir="rtl">
                        {rec.rabbiName}
                      </div>
                      <div className="text-[#B08D57] text-xs font-semibold mb-0.5">{rec.title}</div>
                      <div className="text-[#33332D]/55 text-xs">{rec.institution}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Arrows */}
          <button
            onClick={prev}
            className="absolute -right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-[#E5E1D8] shadow-md flex items-center justify-center text-[#0A192F] hover:bg-[#0A192F] hover:text-white hover:border-[#0A192F] transition-all duration-200 z-20"
            aria-label="הקודם"
          >
            <ChevronRight size={17} />
          </button>
          <button
            onClick={next}
            className="absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-[#E5E1D8] shadow-md flex items-center justify-center text-[#0A192F] hover:bg-[#0A192F] hover:text-white hover:border-[#0A192F] transition-all duration-200 z-20"
            aria-label="הבא"
          >
            <ChevronLeft size={17} />
          </button>
        </div>

        {/* Dot navigation */}
        <div className="flex justify-center gap-2.5 mt-10">
          {RECOMMENDATIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`transition-all duration-300 rounded-full ${
                i === activeIndex
                  ? 'w-7 h-2 bg-[#B08D57]'
                  : 'w-2 h-2 bg-[#D4B483]/40 hover:bg-[#D4B483]/70'
              }`}
              aria-label={`מכתב ${i + 1}`}
            />
          ))}
        </div>

        <p className="text-center text-xs text-[#33332D]/40 mt-4 sm:hidden">
          החלק לצפייה בהמלצות נוספות
        </p>
      </div>

      {/* ─── LIGHTBOX ─── */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(10, 25, 47, 0.93)' }}
          onClick={closeLightbox}
          onTouchStart={handleLbTouchStart}
          onTouchEnd={handleLbTouchEnd}
        >
          {/* Centered image with header/footer overlaid */}
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '85vw', maxHeight: '85vh' }}
          >
            {/* Header bar */}
            <div className="absolute top-0 inset-x-0 z-10 bg-[#0A192F]/90 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between rounded-t-xl" dir="rtl">
              <div>
                <div className="text-white font-bold text-sm leading-tight">
                  {RECOMMENDATIONS[lightboxIndex].rabbiName}
                </div>
                <div className="text-[#C6A75E] text-xs mt-0.5">
                  {RECOMMENDATIONS[lightboxIndex].title} · {RECOMMENDATIONS[lightboxIndex].institution}
                </div>
              </div>
              <div className="flex items-center gap-2 mr-4">
                <button
                  onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title="הקטן"
                >
                  <ZoomOut size={14} />
                </button>
                <span className="text-white/60 text-xs w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title="הגדל"
                >
                  <ZoomIn size={14} />
                </button>
                <div className="w-px h-5 bg-white/20 mx-1" />
                <button
                  onClick={closeLightbox}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-red-500/80 flex items-center justify-center text-white transition-colors"
                  title="סגור (ESC)"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Image */}
            <div className="overflow-auto rounded-xl" style={{ maxWidth: '85vw', maxHeight: '85vh' }}>
              <img
                src={RECOMMENDATIONS[lightboxIndex].imageSrc}
                alt={`מכתב המלצה – ${RECOMMENDATIONS[lightboxIndex].rabbiName}`}
                className="block transition-transform duration-200 select-none rounded-xl"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                  maxWidth: '85vw',
                  maxHeight: '85vh',
                  objectFit: 'contain',
                }}
                draggable={false}
              />
            </div>

            {/* Footer nav */}
            <div className="absolute bottom-0 inset-x-0 z-10 bg-[#0A192F]/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between rounded-b-xl" dir="rtl">
              <button
                onClick={lightboxPrev}
                className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-medium"
              >
                <ChevronRight size={15} />
                <span>הקודם</span>
              </button>
              <div className="flex gap-1.5">
                {RECOMMENDATIONS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setLightboxIndex(i); setZoom(1); }}
                    className={`rounded-full transition-all duration-200 ${
                      i === lightboxIndex
                        ? 'w-5 h-1.5 bg-[#C6A75E]'
                        : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={lightboxNext}
                className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-medium"
              >
                <span>הבא</span>
                <ChevronLeft size={15} />
              </button>
            </div>
          </div>

          {/* Desktop side arrows */}
          <button
            onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
            className="absolute right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors hidden lg:flex"
          >
            <ChevronRight size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
            className="absolute left-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors hidden lg:flex"
          >
            <ChevronLeft size={22} />
          </button>
        </div>
      )}
    </section>
  );
}
