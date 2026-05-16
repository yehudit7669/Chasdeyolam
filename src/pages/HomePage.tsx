import { useNavigate } from 'react-router-dom';
import { Heart, Hotel, Gift, Users, ArrowLeft, CheckCircle, Star, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/plans');
    }
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-[#F7F5F0]">
        {/* Background decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-[#D4B483]/8 blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] rounded-full bg-[#626D58]/8 blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center" dir="rtl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#626D58]/10 border border-[#626D58]/20 text-[#626D58] text-xs font-semibold uppercase tracking-widest mb-8">
            <Star size={12} fill="currentColor" />
            <span>תרומה חודשית • חופשה יוקרתית</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-[#0A192F] tracking-tight mb-6 leading-[1.05]">
            תרומה חודשית<br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)' }}>
              שמעניקה לך חופשה
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#33332D]/60 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            הצטרפו לאלפי משפחות שתורמות מדי חודש ונהנות מחופשות במלונות מובחרים ברחבי הארץ.
            תרמו לעתיד טוב יותר וקבלו פינוק מגיע.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleGetStarted}
              className="group flex items-center gap-3 px-8 py-4 bg-[#0A192F] text-white text-base font-semibold rounded-2xl hover:bg-[#0A192F]/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              <span>בחר תוכנית תרומה</span>
              <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
            </button>
            <button
              onClick={() => navigate('/signin')}
              className="px-8 py-4 bg-white text-[#0A192F] text-base font-semibold rounded-2xl border-2 border-[#E5E1D8] hover:border-[#D4B483] transition-all"
            >
              כניסה למנויים
            </button>
          </div>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-8 mt-14 flex-wrap">
            {[
              { icon: Shield, text: 'תשלום מאובטח' },
              { icon: CheckCircle, text: 'ביטול בכל עת' },
              { icon: Heart, text: 'מאות תורמים מרוצים' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-sm text-[#33332D]/50">
                <Icon size={16} className="text-[#626D58]" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4" dir="rtl">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A192F]/5 text-[#0A192F] text-xs font-semibold uppercase tracking-widest mb-4">
              <span>שלושה צעדים פשוטים</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[#0A192F] tracking-tight">
              איך זה עובד?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Gift,
                step: '01',
                title: 'בחר תוכנית',
                desc: 'בחר את תוכנית התרומה המתאימה לך — כל תוכנית מעניקה זכאות למלונות ברמות שונות',
                dark: true,
              },
              {
                icon: Users,
                step: '02',
                title: 'תרום באופן קבוע',
                desc: 'בצע תרומה חודשית קבועה והשלם את מספר התשלומים הנדרש לפי התוכנית',
                dark: false,
              },
              {
                icon: Hotel,
                step: '03',
                title: 'תהנה מחופשה',
                desc: 'לאחר השלמת התשלומים, בחר מלון מרשימת המלונות הזכאים והזמן את החופשה',
                dark: false,
              },
            ].map(({ icon: Icon, step, title, desc, dark }) => (
              <div
                key={step}
                className={`relative p-8 rounded-[2rem] transition-all duration-300 hover:-translate-y-1 ${
                  dark
                    ? 'bg-[#0A192F] text-white'
                    : 'bg-white border border-[#E5E1D8]/60'
                }`}
                style={{ boxShadow: dark ? '0 20px 60px rgba(10,25,47,0.15)' : '0 4px 24px 0 rgba(98,109,88,0.08)' }}
              >
                <div className={`text-xs font-bold uppercase tracking-[0.3em] mb-6 ${dark ? 'text-[#D4B483]/60' : 'text-[#33332D]/30'}`}>
                  {step}
                </div>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
                  dark ? 'bg-white/10' : 'bg-[#F7F5F0]'
                }`}>
                  <Icon size={26} className={dark ? 'text-[#D4B483]' : 'text-[#626D58]'} />
                </div>
                <h3 className={`text-xl font-bold mb-3 ${dark ? 'text-white' : 'text-[#0A192F]'}`}>{title}</h3>
                <p className={`text-sm leading-relaxed font-light ${dark ? 'text-white/60' : 'text-[#33332D]/60'}`}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Chasdei Olam */}
      <section className="py-24 px-4 bg-white" dir="rtl">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-[#0A192F] tracking-tight">
              למה לבחור בחסדי עולם?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'תרומה עם משמעות',
                desc: 'התרומה שלך עוזרת למשפחות נזקקות ומממנת פעילויות חסד חיוניות בקהילה',
                accent: '#D4B483',
              },
              {
                title: 'מלונות איכותיים',
                desc: 'גישה למגוון רחב של מלונות בדירוגים שונים ברחבי הארץ, מותאמים לכל תקציב',
                accent: '#626D58',
              },
              {
                title: 'תהליך פשוט ונוח',
                desc: 'מערכת דיגיטלית מתקדמת לניהול התרומות והזמנת המלונות בקלות ובמהירות',
                accent: '#0A192F',
              },
              {
                title: 'שקיפות מלאה',
                desc: 'מעקב מלא אחר התרומות שלך, מצב הזכאות והתקדמות לקראת החופשה',
                accent: '#B08D57',
              },
            ].map(({ title, desc, accent }) => (
              <div
                key={title}
                className="p-8 rounded-[2rem] bg-[#F9F8F4] border border-[#E5E1D8]/50 hover:border-[#D4B483]/40 transition-all duration-300 hover:-translate-y-0.5 group"
                style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.06)' }}
              >
                <div
                  className="w-2 h-10 rounded-full mb-5 transition-all duration-300 group-hover:h-14"
                  style={{ backgroundColor: accent }}
                />
                <h4 className="text-xl font-bold text-[#0A192F] mb-3">{title}</h4>
                <p className="text-sm text-[#33332D]/60 leading-relaxed font-light">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-24 px-4" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#626D58]/10 text-[#626D58] text-xs font-semibold uppercase tracking-widest mb-4">
              <span>הסיפור שלנו</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-[#0A192F] tracking-tight">
              מהשורשים אל הפירות
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                year: 'תשס"ב',
                title: 'השורשים',
                text: 'גמ"ח חסדי עולם הוקם בס"ד בקיץ תשס"ב, בהשראת תורותיו העמוקות של החפץ חיים על כוחה של הנתינה.',
              },
              {
                year: 'תשס"ד',
                title: 'הצמיחה',
                text: 'מרעיון לממשות — ניצוץ של מאה דולר אחד הפך לתנועה שלמה של חסד.',
              },
              {
                year: 'היום',
                title: 'הפריחה',
                text: 'פעילות הגמ"ח עברה מפה לאוזן, ופרחה במשך 24 שנים עם אלפי משפחות תורמות.',
              },
            ].map(({ year, title, text }) => (
              <div key={title} className="flex gap-6 p-6 rounded-2xl bg-white border border-[#E5E1D8]/50 hover:border-[#D4B483]/30 transition-colors" style={{ boxShadow: '0 2px 12px rgba(98,109,88,0.05)' }}>
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="text-xs font-bold uppercase tracking-widest text-[#D4B483]">{year}</div>
                </div>
                <div>
                  <h4 className="font-bold text-[#0A192F] mb-1">{title}</h4>
                  <p className="text-sm text-[#33332D]/60 leading-relaxed font-light">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div
            className="relative rounded-[2.5rem] overflow-hidden p-12 md:p-16 text-center"
            style={{ background: 'linear-gradient(135deg, #0A192F 0%, #2D3E40 100%)' }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#D4B483]/10 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-[#626D58]/20 blur-3xl" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/70 text-xs font-semibold uppercase tracking-widest mb-8">
                <Heart size={12} fill="currentColor" className="text-[#D4B483]" />
                <span>הצטרפו לקהילה</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-6">
                מוכנים להצטרף?
              </h2>
              <p className="text-lg text-white/60 mb-10 font-light">
                הצטרפו עוד היום ותתחילו את המסע לחופשה הבאה שלכם
              </p>
              <button
                onClick={handleGetStarted}
                className="group inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-semibold text-[#0A192F] transition-all hover:-translate-y-0.5 hover:shadow-xl"
                style={{ background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)', boxShadow: '0 8px 32px rgba(212,180,131,0.3)' }}
              >
                <span>בחר תוכנית תרומה</span>
                <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
