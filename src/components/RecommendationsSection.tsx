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

export function RecommendationsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = RECOMMENDATIONS.length;

  // Intersection observer for fade-in
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

  // Auto-scroll
  useEffect(() => {
    if (isPaused || lightboxIndex !== null) return;
    autoScrollRef.current = setInterval(next, 6000);
    return () => { if (autoScrollRef.current) clearInterval(autoScrollRef.current); };
  }, [isPaused, lightboxIndex, next]);

  // Keyboard navigation for lightbox
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

  // Swipe handlers for carousel
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
    setTouchStart(null);
  };

  // Lightbox swipe
  const [lbTouchStart, setLbTouchStart] = useState<number | null>(null);
  const handleLbTouchStart = (e: React.TouchEvent) => setLbTouchStart(e.touches[0].clientX);
  const handleLbTouchEnd = (e: React.TouchEvent) => {
    if (lbTouchStart === null) return;
    const diff = lbTouchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) lightboxNext();
      else lightboxPrev();
    }
    setLbTouchStart(null);
  };

  // Compute visible cards based on screen — we use CSS grid with responsive columns
  // activeIndex determines center card

  const getCardOffset = (cardIndex: number) => {
    let diff = cardIndex - activeIndex;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  };

  return (
    <section
      ref={sectionRef}
      dir="rtl"
      className={`py-32 bg-[#F7F5F0] relative overflow-hidden transition-all duration-1000 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {/* Subtle background decoration */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-[#C6A75E]/5 to-transparent rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-tl from-[#626D58]/4 to-transparent rounded-full translate-x-1/2 translate-y-1/2 blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 relative z-10">

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

        {/* Carousel */}
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative min-h-[420px]">
            {RECOMMENDATIONS.map((rec, i) => {
              const offset = getCardOffset(i);
              const isCenter = offset === 0;
              const isVisible2 =
                Math.abs(offset) <= 1 ||
                (typeof window !== 'undefined' && window.innerWidth < 640 && offset === 0) ||
                (typeof window !== 'undefined' && window.innerWidth < 1024 && Math.abs(offset) <= 1);

              return (
                <div
                  key={rec.id}
                  className={`group cursor-pointer transition-all duration-500 ${
                    isCenter
                      ? 'lg:scale-105 z-10'
                      : 'scale-95 opacity-80 hover:opacity-100 hover:scale-100'
                  } ${
                    // Hide on mobile if not center; hide 3rd+ on tablet
                    offset === 0 ? '' :
                    Math.abs(offset) === 1 ? 'hidden sm:block' :
                    'hidden lg:block'
                  }`}
                  onClick={() => openLightbox(i)}
                >
                  <div
                    className={`rounded-2xl overflow-hidden border transition-all duration-500 h-full flex flex-col ${
                      isCenter
                        ? 'border-[#C6A75E]/40 shadow-[0_20px_60px_rgba(176,141,87,0.18)]'
                        : 'border-[#E5E1D8] shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(176,141,87,0.14)] hover:border-[#C6A75E]/30'
                    } bg-white`}
                  >
                    {/* Image preview */}
                    <div className="relative overflow-hidden bg-[#F9F8F4] flex-1" style={{ minHeight: '280px' }}>
                      <img
                        src={rec.imageSrc}
                        alt={`מכתב המלצה – ${rec.rabbiName}`}
                        className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                        style={{ minHeight: '280px', objectFit: 'cover', objectPosition: 'top' }}
                        loading="lazy"
                        decoding="async"
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
                        <span className="text-white text-sm font-semibold bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full border border-white/30 flex items-center gap-2">
                          <ZoomIn size={14} />
                          לחץ לצפייה
                        </span>
                      </div>
                      {/* Decorative corner badge */}
                      {isCenter && (
                        <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#C6A75E] flex items-center justify-center shadow-md">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                    </div>

                    {/* Card footer */}
                    <div className="p-5 border-t border-[#F0EDE8] bg-white">
                      <div className="text-[#0A192F] font-bold text-base leading-tight mb-1" dir="rtl">
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

          {/* Navigation arrows */}
          <button
            onClick={prev}
            className="absolute -right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white border border-[#E5E1D8] shadow-md flex items-center justify-center text-[#0A192F] hover:bg-[#0A192F] hover:text-white hover:border-[#0A192F] transition-all duration-200 z-20 hidden sm:flex"
            aria-label="הקודם"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={next}
            className="absolute -left-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white border border-[#E5E1D8] shadow-md flex items-center justify-center text-[#0A192F] hover:bg-[#0A192F] hover:text-white hover:border-[#0A192F] transition-all duration-200 z-20 hidden sm:flex"
            aria-label="הבא"
          >
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Dot navigation */}
        <div className="flex justify-center gap-3 mt-10">
          {RECOMMENDATIONS.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`transition-all duration-300 rounded-full ${
                i === activeIndex
                  ? 'w-8 h-2.5 bg-[#B08D57]'
                  : 'w-2.5 h-2.5 bg-[#D4B483]/40 hover:bg-[#D4B483]/70'
              }`}
              aria-label={`מכתב ${i + 1}`}
            />
          ))}
        </div>

        {/* Mobile swipe hint */}
        <p className="text-center text-xs text-[#33332D]/40 mt-4 sm:hidden">
          החלק לצפייה בהמלצות נוספות
        </p>
      </div>

      {/* ─── LIGHTBOX ─── */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 25, 47, 0.92)' }}
          onClick={closeLightbox}
          onTouchStart={handleLbTouchStart}
          onTouchEnd={handleLbTouchEnd}
        >
          {/* Modal content */}
          <div
            className="relative max-w-2xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox header */}
            <div className="bg-[#0A192F] px-6 py-4 flex items-center justify-between flex-shrink-0" dir="rtl">
              <div>
                <div className="text-white font-bold text-base">
                  {RECOMMENDATIONS[lightboxIndex].rabbiName}
                </div>
                <div className="text-[#C6A75E] text-xs mt-0.5">
                  {RECOMMENDATIONS[lightboxIndex].title} · {RECOMMENDATIONS[lightboxIndex].institution}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Zoom controls */}
                <button
                  onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title="הקטן"
                >
                  <ZoomOut size={15} />
                </button>
                <span className="text-white/60 text-xs min-w-[3rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  title="הגדל"
                >
                  <ZoomIn size={15} />
                </button>
                <div className="w-px h-6 bg-white/20 mx-1" />
                <button
                  onClick={closeLightbox}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500/80 flex items-center justify-center text-white transition-colors"
                  title="סגור (ESC)"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Image area */}
            <div className="overflow-auto bg-[#F9F8F4] flex-1" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              <div
                className="flex items-start justify-center p-4 min-h-full"
                style={{ minHeight: '400px' }}
              >
                <img
                  src={RECOMMENDATIONS[lightboxIndex].imageSrc}
                  alt={`מכתב המלצה – ${RECOMMENDATIONS[lightboxIndex].rabbiName}`}
                  className="transition-transform duration-200 rounded-sm shadow-lg select-none"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                    maxWidth: '100%',
                    width: '100%',
                  }}
                  draggable={false}
                />
              </div>
            </div>

            {/* Lightbox navigation */}
            <div className="bg-[#0A192F]/95 px-6 py-3 flex items-center justify-between flex-shrink-0" dir="rtl">
              <button
                onClick={lightboxPrev}
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
              >
                <ChevronRight size={16} />
                <span>הקודם</span>
              </button>

              {/* Page indicator */}
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
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
              >
                <span>הבא</span>
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>

          {/* Side arrows for desktop */}
          <button
            onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors hidden lg:flex"
          >
            <ChevronRight size={22} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
            className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors hidden lg:flex"
          >
            <ChevronLeft size={22} />
          </button>
        </div>
      )}
    </section>
  );
}
