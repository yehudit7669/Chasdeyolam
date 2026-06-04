import { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, ChevronRight, ChevronLeft } from 'lucide-react';
import { Layout } from '../components/Layout';
import { useStore } from '../store/useStore';

interface Recommendation {
  id: number;
  rabbiName: string;
  title: string;
  institution: string;
  imageSrc: string;
  pdfSrc: string;
}

const GROUP_A: Recommendation[] = [
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
];

const GROUP_B: Recommendation[] = [
  {
    id: 3,
    rabbiName: 'הרב רפאל צבי ובר',
    title: 'רב שכונת נוה יעקב',
    institution: 'ירושלים',
    imageSrc: '/recommendations/images/המלצה_הרב_ובר.svg',
    pdfSrc: '/recommendations/pdfs/המלצה_הרב_ובר.pdf',
  },
  {
    id: 4,
    rabbiName: 'הרב ישראל יצחק זילברמן',
    title: 'רב שכונת נוה יעקב מרכז',
    institution: 'ירושלים',
    imageSrc: '/recommendations/images/הרב_זילברמן.svg',
    pdfSrc: '/recommendations/pdfs/הרב_זילברמן.pdf',
  },
];

const ALL = [...GROUP_A, ...GROUP_B];

function Lightbox({
  items,
  startIndex,
  onClose,
}: {
  items: Recommendation[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const total = items.length;

  const next = useCallback(() => { setIndex(i => (i + 1) % total); setZoom(1); }, [total]);
  const prev = useCallback(() => { setIndex(i => (i - 1 + total) % total); setZoom(1); }, [total]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') prev();
      if (e.key === 'ArrowLeft') next();
      if (e.key === '+') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, onClose]);

  const rec = items[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(10, 25, 47, 0.93)' }}
      onClick={onClose}
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart === null) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
        setTouchStart(null);
      }}
    >
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '85vw', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="absolute top-0 inset-x-0 z-10 bg-[#0A192F]/90 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between rounded-t-xl" dir="rtl">
          <div>
            <div className="text-white font-bold text-sm leading-tight">{rec.rabbiName}</div>
            <div className="text-[#C6A75E] text-xs mt-0.5">{rec.title} · {rec.institution}</div>
          </div>
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-white/60 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <ZoomIn size={14} />
            </button>
            <div className="w-px h-5 bg-white/20 mx-1" />
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-red-500/80 flex items-center justify-center text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="overflow-auto rounded-xl" style={{ maxWidth: '85vw', maxHeight: '85vh' }}>
          <img
            src={rec.imageSrc}
            alt={`מכתב המלצה – ${rec.rabbiName}`}
            className="block transition-transform duration-200 select-none rounded-xl"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', maxWidth: '85vw', maxHeight: '85vh', objectFit: 'contain' }}
            draggable={false}
          />
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 inset-x-0 z-10 bg-[#0A192F]/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between rounded-b-xl" dir="rtl">
          <button onClick={prev} className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-medium">
            <ChevronRight size={15} /><span>הקודם</span>
          </button>
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => { setIndex(i); setZoom(1); }}
                className={`rounded-full transition-all duration-200 ${i === index ? 'w-5 h-1.5 bg-[#C6A75E]' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'}`}
              />
            ))}
          </div>
          <button onClick={next} className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm font-medium">
            <span>הבא</span><ChevronLeft size={15} />
          </button>
        </div>
      </div>

      {/* Side arrows (desktop) */}
      <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors hidden lg:flex">
        <ChevronRight size={22} />
      </button>
      <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute left-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-colors hidden lg:flex">
        <ChevronLeft size={22} />
      </button>
    </div>
  );
}

function LetterCard({ rec, globalIndex, onOpen }: { rec: Recommendation; globalIndex: number; onOpen: (i: number) => void }) {
  return (
    <div
      className="group cursor-pointer"
      onClick={() => onOpen(globalIndex)}
    >
      <div className="rounded-2xl overflow-hidden border border-[#E5E1D8] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(176,141,87,0.14)] hover:border-[#C6A75E]/30 transition-all duration-300 flex flex-col h-full">
        <div className="relative overflow-hidden bg-[#F9F8F4]" style={{ aspectRatio: '3/4' }}>
          <img
            src={rec.imageSrc}
            alt={`מכתב המלצה – ${rec.rabbiName}`}
            className="w-full h-full transition-transform duration-700 group-hover:scale-105"
            style={{ objectFit: 'contain', objectPosition: 'top' }}
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-5">
            <span className="text-white text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30 flex items-center gap-1.5">
              <ZoomIn size={13} />
              לחץ לצפייה
            </span>
          </div>
        </div>
        <div className="p-4 border-t border-[#F0EDE8] bg-white" dir="rtl">
          <div className="text-[#0A192F] font-bold text-sm leading-tight mb-0.5">{rec.rabbiName}</div>
          <div className="text-[#B08D57] text-xs font-semibold mb-0.5">{rec.title}</div>
          <div className="text-[#33332D]/55 text-xs">{rec.institution}</div>
        </div>
      </div>
    </div>
  );
}

export default function RecommendationsPage() {
  const language = useStore((state) => state.language);
  const isRtl = language === 'he';
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <Layout>
      <section className="py-24 bg-[#F7F5F0]" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="max-w-5xl mx-auto px-6">

          {/* Page header */}
          <div className="text-center mb-20">
            <p className="text-[10px] font-bold text-[#B08D57] tracking-[0.3em] uppercase mb-6">
              {isRtl ? 'המלצות' : 'Endorsements'}
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-[#0A192F] tracking-tight leading-tight mb-6">
              {isRtl
                ? 'מכתבי המלצה ותמיכה מרבנים וגדולי ישראל'
                : 'Letters of Endorsement from Leading Rabbinical Authorities'}
            </h1>
            <div className="w-16 h-1 bg-[#D4B483] mx-auto" />
          </div>

          {/* Group A */}
          <div className="mb-20">
            <h2 className="text-xl font-bold text-[#0A192F] mb-8 pb-4 border-b border-[#E5E1D8]" dir="rtl">
              {isRtl
                ? 'מכתבי המלצה על חשיבות התמיכה לאור חוק הגמ"חים'
                : 'Letters of Endorsement Regarding Support for the GMACH Law'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {GROUP_A.map((rec) => {
                const globalIndex = ALL.findIndex((r) => r.id === rec.id);
                return (
                  <LetterCard key={rec.id} rec={rec} globalIndex={globalIndex} onOpen={setLightboxIndex} />
                );
              })}
            </div>
          </div>

          {/* Group B */}
          <div>
            <h2 className="text-xl font-bold text-[#0A192F] mb-8 pb-4 border-b border-[#E5E1D8]" dir="rtl">
              {isRtl
                ? 'מכתבי תמיכה בפעילות גמ"ח חסדי עולם'
                : 'Letters of Support for Chasdei Olam GMACH Activities'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
              {GROUP_B.map((rec) => {
                const globalIndex = ALL.findIndex((r) => r.id === rec.id);
                return (
                  <LetterCard key={rec.id} rec={rec} globalIndex={globalIndex} onOpen={setLightboxIndex} />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {lightboxIndex !== null && (
        <Lightbox items={ALL} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </Layout>
  );
}
