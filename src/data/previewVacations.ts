// ⚠️ נתוני תצוגה מקדימה מקומית בלבד — לא מ-DB ולא מופיע באתר החי.
// מקור אמת משותף לדף התוכניות (PlanSelectionPage) ולדף "הנופשים שלנו" (OurVacationsPage).
// בעלייה לאוויר: להעביר ל-DB (admin/migration: plans + hotels + תמונות) ולמחוק את הקובץ.

export interface PreviewPlanMeta {
  level: string;
  name_he: string;
  monthly_amount: number;
  months: number;
  nights: number;
  hotel_level: string; // מיפוי לעמודת plans.hotel_level האמיתית ב-DB (השמות לא זהים ל-level המקומי)
}

export interface PreviewPlace {
  id: string;
  name_he: string;
  city_he: string;
  region: string;       // אזור: 'טבריה' | 'צפת' | 'גליל' | 'כרמל' | 'מרכז' | 'דרום'
  level: string;
  description_he: string;
  image_url?: string;       // תמונה ראשית (כרטיסייה)
  images?: string[];        // גלריה מלאה — URLs מ-Supabase Storage
  website_url?: string;     // קישור לאתר המלון/צימר
  map_url?: string;         // קישור לניווט (Waze / Google Maps)
  is_new?: boolean;         // תגית "חדש"
}

export const PREVIEW_PLAN_META: PreviewPlanMeta[] = [
  // תוכניות חדשות
  { level: 'preview-215', name_he: 'נופש זוגי', monthly_amount: 215, months: 12, nights: 2, hotel_level: 'plan215' },
  { level: 'preview-250', name_he: 'נופש זוגי', monthly_amount: 250, months: 12, nights: 2, hotel_level: 'plan250' },
  // תוכניות קיימות מ-DB (bronze=שבת זוגית, platinum=סופ"ש זוגי/משפחתי)
  { level: 'bronze', name_he: 'שבת זוגית', monthly_amount: 250, months: 15, nights: 2, hotel_level: 'gold' },
  { level: 'platinum', name_he: 'סופ"ש זוגי/משפחתי', monthly_amount: 350, months: 15, nights: 2, hotel_level: 'platinum' },
];

export const PREVIEW_PLACES: PreviewPlace[] = [
  // תוכנית 250 (חדשה)
  {
    id: 'p250-1', name_he: 'מלון כינורות', city_he: 'טבריה', region: 'טבריה', level: 'preview-250',
    description_he: 'מלון בוטיק על שפת הכינרת עם נוף פנורמי למים. בריכה, ספא ומטבח כשר למהדרין.',
    is_new: true,
  },
  {
    id: 'p250-2', name_he: 'סוויטת רויה', city_he: 'דלתון', region: 'גליל', level: 'preview-250',
    description_he: 'סוויטה פרטית מפנקת עם ג׳קוזי, נוף הרים ושקט מוחלט. כשרות מלאה.',
    is_new: true,
  },
  {
    id: 'p250-3', name_he: 'מלון ניר עציון', city_he: 'חוף הכרמל', region: 'כרמל', level: 'preview-250',
    description_he: 'ממוקם בין הים להר הכרמל. בריכה מחוממת, ספא ומסעדה כשרה עם נוף לים.',
    is_new: true,
  },
  {
    id: 'p250-4', name_he: 'וילה גני הצוק', city_he: 'צפת', region: 'צפת', level: 'preview-250',
    description_he: 'וילה פרטית בלב צפת העתיקה. גינה מקסימה, מטבח מאובזר ואווירה רוחנית ייחודית.',
  },
  {
    id: 'p250-5', name_he: 'וילת כינרת דלוקס', city_he: 'צפת', region: 'צפת', level: 'preview-250',
    description_he: 'וילה מרווחת עם נוף מרהיב לכינרת. עיצוב יוקרתי, ג׳קוזי ומטבח כשר מסודר.',
  },
  {
    id: 'p250-6', name_he: 'סוויטה פיק', city_he: 'ספסופה', region: 'גליל', level: 'preview-250',
    description_he: 'סוויטה רומנטית בכפר הדרוזי ספסופה. מרפסת עם נוף להרי גליל ואוכל מסורתי.',
  },
  // תוכנית 215 (חדשה)
  {
    id: 'p215-1', name_he: 'וילה נרקיס', city_he: 'עין יעקב', region: 'גליל', level: 'preview-215',
    description_he: 'וילה אינטימית בין עצי פרי בגליל. בריכה פרטית, מטבח כשר ושקט אמיתי.',
    is_new: true,
  },
  {
    id: 'p215-2', name_he: 'וילה לה טוקיו', city_he: 'צפת', region: 'צפת', level: 'preview-215',
    description_he: 'עיצוב יפני–ישראלי ייחודי בצפת. חדר שינה מפנק, אמבטיה גדולה ונוף עוצר נשימה.',
  },
  {
    id: 'p215-3', name_he: 'וילה וויו כינרת', city_he: 'צפת', region: 'צפת', level: 'preview-215',
    description_he: 'נוף ישיר לכינרת מכל חדר. מרפסת מרווחת, ג׳קוזי ומטבח כשר מאובזר.',
  },
  // תוכנית שבת זוגית (קיימת ב-DB — bronze)
  {
    id: 'b-1', name_he: 'מלון חוף התמרים', city_he: 'עכו', region: 'גליל', level: 'bronze',
    description_he: 'מלון בוטיק על חוף הים בעכו. בריכה, ספא ומטבח כשר. גישה נוחה לעיר העתיקה.',
  },
  {
    id: 'b-2', name_he: 'בית הארחה ציפורי בכפר', city_he: 'חפץ חיים', region: 'מרכז', level: 'bronze',
    description_he: 'אירוח חמים בכפר חפץ חיים. אוכל ביתי מכשרות מהודרת, שקט ואווירה קהילתית.',
  },
  {
    id: 'b-3', name_he: 'מלון גלי תמר', city_he: 'אשקלון', region: 'דרום', level: 'bronze',
    description_he: 'מלון ים בחוף אשקלון. בריכה מחוממת, מסעדה כשרה ופינוקים לזוגות.',
  },
  {
    id: 'b-4', name_he: 'מלון ירמיהו 33', city_he: 'ירושלים', region: 'מרכז', level: 'bronze',
    description_he: 'מלון בוטיק בלב ירושלים. עיצוב ירושלמי קלאסי, מטבח כשר חלק ונגישות מרכזית.',
  },
  {
    id: 'b-5', name_he: 'מלון כינורות', city_he: 'טבריה', region: 'טבריה', level: 'bronze',
    description_he: 'נוף פנורמי לכינרת מהחדרים. בריכה, ספא וארוחות בופה כשרות למהדרין.',
  },
  {
    id: 'b-6', name_he: 'מלון כינר גליל', city_he: 'כינרת', region: 'טבריה', level: 'bronze',
    description_he: 'מלון ממוקם ממש על חוף הכינרת. גישה לחוף פרטי ומסעדה כשרה עם נוף למים.',
  },
  {
    id: 'b-7', name_he: 'מלון ניר עציון', city_he: 'מושב ניר עציון', region: 'כרמל', level: 'bronze',
    description_he: 'שקט הרים ורוח ים בכרמל. בריכה, ספא ומסעדה עם תפריט כשר מגוון.',
  },
  {
    id: 'b-8', name_he: 'מלון ציפורי בכנרת', city_he: 'טבריה', region: 'טבריה', level: 'bronze',
    description_he: 'מלון מפנק בטבריה עם גישה לחוף. ספא, בריכה ואוכל כשר מהודר.',
  },
  {
    id: 'b-9', name_he: 'מלון קיבוץ לביא', city_he: 'קיבוץ לביא', region: 'גליל', level: 'bronze',
    description_he: 'מלון קיבוצי אוטנטי בגליל התחתון. אוכל ביתי, בריכה ירוקה ונוף שדות מרהיב.',
  },
  // תוכנית סופ"ש זוגי/משפחתי (קיימת ב-DB — platinum)
  {
    id: 'pl-1', name_he: 'וילה בטבריה', city_he: 'טבריה', region: 'טבריה', level: 'platinum',
    description_he: 'וילה פרטית יוקרתית עם נוף לכינרת. בריכה פרטית, ג׳קוזי ומטבח כשר מאובזר.',
    is_new: true,
  },
  {
    id: 'pl-2', name_he: 'מלון גלי צאנז', city_he: 'נתניה', region: 'מרכז', level: 'platinum',
    description_he: 'מלון יוקרה על חוף הים בנתניה. ספא, בריכת ים, מסעדה כשרה ואווירה חסידית.',
  },
];

export const planMetaByLevel = (level: string): PreviewPlanMeta | undefined =>
  PREVIEW_PLAN_META.find((p) => p.level === level);

export const ALL_REGIONS = ['הכל', 'טבריה', 'צפת', 'גליל', 'כרמל', 'מרכז', 'דרום'];
