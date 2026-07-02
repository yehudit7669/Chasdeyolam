import {
  Waves, Droplets, Flame, Sparkles, Mountain, ChefHat, Wind, Car, Wifi,
  BadgeCheck, Landmark, Gamepad2, BedDouble, Tv, Lock, Trees, Users,
  Accessibility, CheckCircle2, type LucideIcon,
} from 'lucide-react';

// זיהוי אייקון מתאים לפי מילות מפתח בטקסט החופשי שהמנהל הדביק
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/בריכ/, Waves],
  [/ג['׳]?קוזי|ג['׳]?יקוזי/, Droplets],
  [/סאונ/, Flame],
  [/ספא\b/, Sparkles],
  [/נוף/, Mountain],
  [/מנגל|ברביקיו|bbq/i, Flame],
  [/מטבח|כיריים|תנור|מקרר|מיקרוגל|קפה|אספרסו|מיניבר|סכו["']?ם/, ChefHat],
  [/מיזוג|מזגן/, Wind],
  [/חני[הת]/, Car],
  [/וופי|wifi|אינטרנט|רשת אלחוטית/i, Wifi],
  [/כשר|הכשר|בד["']?ץ|מהדרין/, BadgeCheck],
  [/בית כנסת|מקווה/, Landmark],
  [/פינג פונג|סנוקר|ביליארד|כדורגל|כדורסל|משחק/, Gamepad2],
  [/מיט[הות]|חדר[י]? שינה/, BedDouble],
  [/טלוויזיה|טלויזיה/, Tv],
  [/שקט|פרטיות/, Lock],
  [/גינה|חצר/, Trees],
  [/ילדים|משפחתי/, Users],
  [/נגיש|נכים|מוגבלויות/, Accessibility],
];

const iconFor = (text: string): LucideIcon => {
  for (const [pattern, Icon] of ICON_RULES) if (pattern.test(text)) return Icon;
  return CheckCircle2;
};

interface ParsedDescription {
  intro: string;
  items: { text: string; isHeader: boolean }[];
}

// הופך טקסט חופשי (לרוב מודבק מאתר הצימר/מלון) לכותרת פתיחה + רשימת מאפיינים
export function parseDescription(raw: string): ParsedDescription {
  const lines = (raw || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { intro: '', items: [] };

  const [intro, ...rest] = lines;
  const items = rest.map((line) => {
    const cleaned = line.replace(/^[-•*]\s*/, '').trim();
    const isHeader = /:$/.test(cleaned) && cleaned.length < 40;
    return { text: cleaned, isHeader };
  });

  return { intro, items };
}

export function FormattedDescription({ text, variant = 'full' }: { text: string; variant?: 'full' | 'compact' }) {
  const { intro, items } = parseDescription(text);

  if (variant === 'compact') {
    return <p className="leading-relaxed">{intro}</p>;
  }

  return (
    <div className="space-y-4">
      {intro && <p className="leading-relaxed">{intro}</p>}
      {items.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
          {items.map((item, i) =>
            item.isHeader ? (
              <div key={i} className="col-span-full text-xs font-bold uppercase tracking-widest text-[#33332D]/40 mt-2 first:mt-0">
                {item.text.replace(/:$/, '')}
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2 text-sm text-[#33332D]/70">
                {(() => { const Icon = iconFor(item.text); return <Icon size={15} className="text-[#626D58] mt-0.5 shrink-0" />; })()}
                <span>{item.text}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
