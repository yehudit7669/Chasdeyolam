import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield } from 'lucide-react';

export default function TermsOfUsePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F5F0]" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E1D8]/60 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] transition-colors"
          >
            <ArrowRight size={16} />
            <span>חזרה</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-[#626D58] font-semibold">
            <Shield size={14} />
            <span>מסמך משפטי רשמי</span>
          </div>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white rounded-[2rem] border border-[#E5E1D8]/60 overflow-hidden"
          style={{ boxShadow: '0 4px 40px rgba(98,109,88,0.08)' }}>

          {/* Document header */}
          <div className="px-8 pt-10 pb-8 border-b border-[#E5E1D8]/40">
            <div className="text-center">
              <h1 className="text-3xl font-black text-[#0A192F] mb-3">תקנון ותנאי שימוש</h1>
              <p className="text-[#33332D]/60 text-sm">עמותת "חסדי עולם" (ע"ר)</p>
            </div>
          </div>

          {/* Preamble */}
          <div className="px-8 py-6 bg-[#F9F8F4] border-b border-[#E5E1D8]/40">
            <p className="text-[#0A192F] font-bold leading-relaxed mb-3">
              ברוך הבא לאתר של גמ"ח ועמותת "חסדי עולם" (להלן: "העמותה" או "הגמ"ח").
            </p>
            <p className="text-[#33332D]/70 text-sm leading-relaxed">
              הצטרפותך לתוכנית התרומות, לחיצה על כפתור התשלום וביצוע חיוב בפועל, מהוויים הסכמה מלאה,
              מפורשת ובלתי חוזרת לכל התנאים המפורטים בתקנון זה שלהלן:
            </p>
          </div>

          {/* Content */}
          <div className="px-8 py-8 space-y-10">

            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-black text-[#0A192F] mb-4 pb-2 border-b border-[#E5E1D8]/60">
                1. מהות התוכנית והגדרת הכספים כתרומה
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    כל התשלומים המבוצעים באתר זה, לרבות תשלומים חודשיים במסגרת הוראת קבע (להלן:
                    "התוכנית"), מוגדרים מבחינה משפטית כתרומה וצדקה המיועדת למטרות החסד של העמותה.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    ההטבות המוצעות באתר (כגון שוברי אירוח בסופי שבוע במלונות) (להלן: "ההטבה") הינן
                    מתנות הוקרה מוענקות על ידי העמותה לפנים משורת הדין, אך ורק לתורמים
                    שהתמידו והשלימו את תוכנית התרומה שנבחרה.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    במידה והתורם יחליט להפסיק את התוכנית, לבטל את התוכנית, לפגוע בהוראת הקבע, ולא
                    יסדרו לפני תום התוכנית – התורם לא יהיה זכאי לקבלת ההטבה (או חלק ממנה), ולא יהיה זכאי
                    להחזר כספי כלשהו עבור התשלומים ששולמו עד לאותו מועד, שכן אלו שימשו כבר למטרות
                    הצדקה של העמותה ומהוויים תרומה בלתי הדירה.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-black text-[#0A192F] mb-4 pb-2 border-b border-[#E5E1D8]/60">
                2. התחייבות הגמ"ח להענקת ההטבה בתום התוכנית
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    העמותה מתחייבת באופן מפורש ומלא כי עם השלמת מלוא תנאי התוכנית שנבחרה, וצבירת
                    מספר התשלומים המוצלחים הנדרש בפועל (לדוגמה: 15 חיובים שנסלקו בהצלחה), היא תנפיק
                    ותספק לתורם את שובר הזכאות להטבה המובטחת בתוכנית ללא שיהוי, ובכפוף לתנאי המימוש
                    המפורטים בתקנון זה.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    ספירת התשלומים לצורך התגבשות התחייבות העמותה תתבצע על פי רישומי המערכת לגבי
                    חיובים שנסלקו בפועל (<span className="font-mono text-xs bg-[#F9F8F4] px-1 py-0.5 rounded">successful_payments_count</span>) ולא על פי ותק חודשי חולף.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-black text-[#0A192F] mb-4 pb-2 border-b border-[#E5E1D8]/60">
                3. זכות להחלפת מלונות במקרה של שינוי / כוח עליון
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    העמותה מתקשרת עם מלונות שונים לצורך אספקת ההטבות. המשתמש מצהיר כי ידוע לו כי
                    העמותה עלולה להיות תלויה בצדדים שלישיים אלו.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    במקרה של סגירת מלון, הפרת הסכם מצד המלון, העלאת מחירים מצד המלון, או
                    במקרה של כוח עליון (לרבות חיים לבנות מלחמה, מגפה, פגעי טבע וכדומה), העמותה
                    שומרת לעצמה את הזכות הבלעדית להחליף את המלון המצוין בתוכנית במלון חלופי
                    באותה רמת אירוח (לפי סיווג העמותה, כגון רמת פרימיום). העמותה מתחייבת
                    לספק מלון חלופי פי יכולתה, ולתורם לא תהיה כל תביעה כנגד העמותה בשל עצם
                    החלפת המלון, ולתורם לא יהיה זכאי להחזר כספי מטעם זה.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-black text-[#0A192F] mb-4 pb-2 border-b border-[#E5E1D8]/60">
                4. מימוש ההטבה, תאריכים ותוספות (אחריות המלון בלבד)
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    אספקת שירותי האירוח בפועל היא באחריות הבלעדית של המלון מהמארח.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    מימוש ההטבה וקביעת תאריכי האירוח כפופים ללוח המועדים שהוסכם בין ראש הגמ"ח
                    למלון, וכן לזמינות החדרים ולתפוסת המלון.
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    כל בקשה לשינוי תאריך שאינו בטווח המוסכם, הוספת נפשות, שדרוג חדרים, שדרוג
                    נוסף על שינוי (ילדים/מבוגרים) מעבר למגבלת בתוכנית המקורית, תתבצע על ידי
                    המשתמש מול המלון ישירות ולתפוסות אלו. הגמ"ח אינו נושא בכל נושא ואין אחריות
                    לשינויים אלו.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-black text-[#0A192F] mb-4 pb-2 border-b border-[#E5E1D8]/60">
                5. הגבלת אחריות לתקלות טכנולוגיות
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    מערכת האתר מסתנכרנת מול ספקי סליקה חיצוניים (מערכת "נדרים פלוס"). המשתמש מודע
                    לכך שבמערכות טכנולוגיות עלולות לעלולות שגיאות, תקלות תקשורת, או חוסר סנכרון בנתונים
                    (כגון חישוב תאריכי חיוב עתידיים או סטטוסים מנוי).
                  </p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    בכל מקרה של תקלה, חיוב יתר, או סתירה בנתונים, הסעד היחיד של המשתמש יהיה
                    פנייה לזכות שירות הלקוחות של העמותה, הסעד של הלקוחות ידני של הרישום או הזיכוי
                    בהתאם לצורך. המשתמש מוותר מראש על כל זכות לתביעה או פיצוי בגין תקלות טכניות כאמור.
                  </p>
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-black text-[#0A192F] mb-4 pb-2 border-b border-[#E5E1D8]/60">
                6. סמכות שיפוט
              </h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#626D58] flex-shrink-0 mt-2"></span>
                  <p className="text-[#33332D]/70 text-sm leading-relaxed">
                    על תקנון זה יחולו דיני מדינת ישראל. כל מחלוקת משפטית תובא אך ורק בפני בית המשפט
                    המוסמך במחוז ירושלים.
                  </p>
                </li>
              </ul>
            </section>

            {/* Footer note */}
            <div className="pt-6 border-t border-[#E5E1D8]/60">
              <p className="text-center text-xs text-[#33332D]/40 leading-relaxed">
                מסמך זה מהווה את הנוסח המלא והמחייב של תנאי השימוש באתר.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#0A192F] text-white font-semibold rounded-xl hover:bg-[#0A192F]/90 transition-all text-sm"
          >
            <ArrowRight size={16} />
            חזרה ואישור התנאים
          </button>
        </div>
      </div>
    </div>
  );
}
