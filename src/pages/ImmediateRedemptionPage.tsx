import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Zap, Mail, CheckCircle } from 'lucide-react';
import { Layout } from '../components/Layout';

export default function ImmediateRedemptionPage() {
  const navigate = useNavigate();

  const options = [
    {
      icon: CalendarCheck,
      badge: 'מסלול 1',
      title: 'מימוש לאחר סיום התוכנית',
      subtitle: 'לאחר תשלום כל החודשים',
      steps: [
        'משלמים את כל חודשי התוכנית',
        'בוחרים מקום ותאריך מתוך רשימת המקומות',
        'לאחר אישורנו — מקבלים שובר לחופשה ישירות למייל',
      ],
      featured: false,
    },
    {
      icon: Zap,
      badge: 'מסלול 2',
      title: 'מימוש מיידי',
      subtitle: 'מתחילים ליהנות מהרגע הראשון',
      steps: [
        'לא גובים את כל הסכום מראש',
        'תופסים מסגרת אשראי בגובה עלות התוכנית המלאה — הסכום יורד בתשלומים חודשיים לפי התוכנית שבחרתם',
        'מיד לאחר תפיסת המסגרת — בוחרים נופש ותאריך',
        'לאחר אישורנו — מקבלים שובר לחופשה ישירות למייל',
      ],
      featured: true,
    },
  ];

  return (
    <Layout>
      <div className="py-16 px-4" dir="rtl">
        <div className="max-w-3xl mx-auto">

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-[#33332D]/50 hover:text-[#33332D] mb-10 transition-colors"
          >
            <ArrowRight size={16} />
            <span>חזרה</span>
          </button>

          {/* Header */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#626D58]/10 text-[#626D58] text-xs font-semibold uppercase tracking-widest mb-4">
              <Zap size={12} />
              <span>מימוש הנופש</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-[#0A192F] tracking-tight mb-4">
              איך מממשים את החופשה?
            </h1>
            <p className="text-[#33332D]/55 font-light text-lg leading-relaxed">
              יש לכם שתי דרכים לממש את הזכאות — בחרו את מה שמתאים לכם.
            </p>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-6">
            {options.map((opt) => {
              const Icon = opt.icon;
              return (
                <div
                  key={opt.badge}
                  className={`rounded-[2rem] overflow-hidden ${
                    opt.featured
                      ? 'bg-[#0A192F] text-white'
                      : 'bg-white border border-[#E5E1D8]/60'
                  }`}
                  style={{
                    boxShadow: opt.featured
                      ? '0 24px 60px rgba(10,25,47,0.2)'
                      : '0 4px 24px 0 rgba(98,109,88,0.08)',
                  }}
                >
                  <div className="p-8">
                    {/* Badge + icon */}
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                          opt.featured ? 'bg-[#D4B483]/20' : 'bg-[#626D58]/10'
                        }`}
                      >
                        <Icon
                          size={20}
                          className={opt.featured ? 'text-[#D4B483]' : 'text-[#626D58]'}
                        />
                      </div>
                      <span
                        className={`text-xs font-bold uppercase tracking-widest ${
                          opt.featured ? 'text-[#D4B483]/70' : 'text-[#33332D]/40'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    </div>

                    {/* Title */}
                    <h2
                      className={`text-2xl font-bold mb-1 ${
                        opt.featured ? 'text-white' : 'text-[#0A192F]'
                      }`}
                    >
                      {opt.title}
                    </h2>
                    <p
                      className={`text-sm font-light mb-6 ${
                        opt.featured ? 'text-white/50' : 'text-[#33332D]/50'
                      }`}
                    >
                      {opt.subtitle}
                    </p>

                    {/* Steps */}
                    <ul className="space-y-3">
                      {opt.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <CheckCircle
                            size={17}
                            className={`mt-0.5 flex-shrink-0 ${
                              opt.featured ? 'text-[#D4B483]' : 'text-[#626D58]'
                            }`}
                          />
                          <span
                            className={`text-sm leading-relaxed ${
                              opt.featured ? 'text-white/75' : 'text-[#33332D]/70'
                            }`}
                          >
                            {step}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-10 flex items-start gap-3 p-5 rounded-2xl bg-[#F7F5F0] border border-[#E5E1D8]">
            <Mail size={18} className="text-[#626D58] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#33332D]/65 leading-relaxed">
              השובר נשלח למייל שנרשמתם איתו — בדקו גם בתיקיית הספאם.
              לכל שאלה פנו אלינו דרך עמוד התמיכה.
            </p>
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
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
    </Layout>
  );
}
