import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Gift, Users, Hotel, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useStore } from '../store/useStore';
import { Layout } from '../components/Layout';
import { RecommendationsSection } from '../components/RecommendationsSection';
import donationRequestImg from '../assets/בקשת_תרומה_גמח.jpg';

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const language = useStore((state) => state.language);
  const isRtl = language === 'he';

  return (
    <Layout>
      {/* ───────────────── HERO ───────────────── */}
      <section className="relative overflow-hidden pt-32 pb-40">
        <div className="absolute inset-0 bg-[#F7F5F0] -z-20" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-[#B08D57]/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-[#626D58]/5 to-transparent rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl -z-10" />

        <div className="max-w-6xl mx-auto px-4 text-center" dir={isRtl ? 'rtl' : 'ltr'}>
          <div
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-[#E5E1D8] bg-white/80 backdrop-blur-sm text-[#626D58] font-semibold text-sm mb-10 tracking-wide"
          >
            <Star size={14} className="text-[#B08D57]" fill="currentColor" />
            <span className="uppercase tracking-widest text-xs">
              {isRtl ? "אתר 'הנציבים' של גמ\"ח חסדי עולם" : "The 'Delegates' Site of Chasdei Olam GMACH"}
            </span>
          </div>

          <h1 className="text-6xl md:text-[5.5rem] font-black text-[#2D3E40] leading-[1.05] tracking-tighter mb-10">
            {isRtl ? 'תרומה חודשית' : 'A Monthly Donation'}
            <br />
            <span className="text-[#B08D57] font-serif italic font-normal tracking-normal">
              {isRtl ? 'שמעניקה לך חופשה' : 'That Gives You a Vacation'}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-[#33332D]/70 max-w-2xl mx-auto leading-relaxed mb-14 font-light">
            {isRtl
              ? 'הצטרפו להיות מנציבי הגמ"ח ע"י תרומה חודשית [אפשר ממעשרות*]\nשתעניק לך זכות לחופשה זוגית**'
              : "Join as GMACH delegates with a monthly donation [tithes accepted*] that grants you the right to a couples' vacation.**"}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button
              onClick={() => navigate(user ? '/dashboard' : '/plans')}
              className="group flex items-center gap-3 px-12 py-5 rounded-[2rem] font-bold text-lg text-white transition-all hover:-translate-y-0.5 hover:shadow-2xl w-full sm:w-auto justify-center"
              style={{
                background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)',
                boxShadow: '0 8px 40px rgba(176,141,87,0.35)',
              }}
            >
              <span>
                {user
                  ? (isRtl ? 'לדשבורד שלי' : 'View Dashboard')
                  : (isRtl ? 'הצטרפות עכשיו' : 'Start Your Journey')}
              </span>
              <ChevronLeft
                className={`transition-transform group-hover:-translate-x-1 ${isRtl ? '' : 'rotate-180'}`}
                size={20}
              />
            </button>

            <button
              onClick={() => {
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto text-[#2D3E40] hover:text-[#626D58] transition-colors font-medium"
            >
              <span className="border-b border-[#2D3E40]/20 pb-1">
                {isRtl ? 'איך זה עובד?' : 'Explore our methodology'}
              </span>
            </button>
          </div>

          <p className="mt-6 text-xs text-[#33332D]/50 max-w-xl mx-auto leading-relaxed">
            {isRtl
              ? '* החופשה אינה מקוזזת מהתרומה , אלא מכספי קרן שהוקמה ע"י אחד מהתורמים.'
              : '* The vacation is not deducted from the donation, but from a fund established by one of the donors.'}
          </p>
          {isRtl && (
            <p className="mt-2 text-xs text-[#33332D]/50 max-w-xl mx-auto leading-relaxed">
              ** בכפוף לתאריכים הניתנים ע"י הגמ"ח, לא כולל בין הזמנים וחגים.{' '}
              <Link
                to="/terms-of-use"
                className="underline underline-offset-2 hover:text-[#626D58] transition-colors"
              >
                קרא עוד
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ───────────────── RECOMMENDATIONS ───────────────── */}
      <RecommendationsSection />

      {/* ───────────────── ROOTS TO FRUITS ───────────────── */}
      <section className="py-40 bg-white mb-20">
        <div className="max-w-6xl mx-auto px-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="text-center mb-24">
            <p className="text-[10px] font-bold text-[#B08D57] tracking-[0.3em] uppercase mb-6">
              {isRtl ? 'הסיפור שלנו' : 'The Genesis'}
            </p>
            <h2 className="text-5xl md:text-6xl font-black text-[#0A192F] tracking-tighter">
              {isRtl ? 'מהשורשים אל הפירות' : 'From Roots to Fruit'}
            </h2>
          </div>

          <div className="space-y-24 relative">
            {/* Timeline line */}
            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gradient-to-b from-[#E5E1D8] via-[#D4B483]/30 to-[#E5E1D8] hidden md:block" />

            {/* Step 1 — The Roots */}
            <div className="relative grid md:grid-cols-2 gap-16 items-center">
              <div className="md:text-right md:pr-16 order-2 md:order-1">
                <div className="text-7xl font-black text-[#0A192F]/5 leading-none select-none">01</div>
                <h3 className="text-3xl font-black text-[#0A192F] mt-2 mb-6 tracking-tight">
                  {isRtl ? 'השורשים' : 'The Roots'}
                </h3>
                <div className={`w-20 h-1 bg-[#D4B483] mb-8 ${isRtl ? 'mr-auto md:ml-auto md:mr-0' : ''}`} />
                <p className="text-lg text-[#33332D]/70 leading-relaxed font-medium italic">
                  {isRtl
                    ? '"גמ"ח חסדי עולם" הוקם בס"ד בקיץ תשס"ב, בעקבות דבריו המלהיבים של החפץ חיים בספרו \'אהבת חסד\'. אנו עדים לסייעתא דשמיא מרובה בפעילות הגמ"ח, ואנו חשים שרוחו הגדולה של מרן החפץ חיים זצוק"ל מלווה אותנו.'
                    : 'Founded in 2002, inspired by the profound teachings of the Chafetz Chaim, our roots are deeply planted in the soil of pure kindness.'}
                </p>
              </div>
              <div className="order-1 md:order-2 flex justify-center">
                <div className="w-24 h-24 rounded-full border border-[#E5E1D8] flex items-center justify-center relative bg-white z-10 shadow-sm">
                  <div className="w-3 h-3 bg-[#D4B483] rounded-full" />
                </div>
              </div>
            </div>

            {/* Step 2 — The Growth */}
            <div className="relative grid md:grid-cols-2 gap-16 items-center">
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full border border-[#E5E1D8] flex items-center justify-center relative bg-white z-10 shadow-sm">
                  <div className="w-6 h-6 bg-[#D4B483]/30 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-[#D4B483] rounded-full" />
                  </div>
                </div>
              </div>
              <div className={`${isRtl ? 'md:pr-16 text-right' : 'md:pl-16'}`}>
                <div className="text-7xl font-black text-[#0A192F]/5 leading-none select-none">02</div>
                <h3 className="text-3xl font-black text-[#0A192F] mt-2 mb-6 tracking-tight">
                  {isRtl ? 'הצמיחה' : 'The Growth'}
                </h3>
                <div className="w-20 h-1 bg-[#D4B483] mb-8" />
                <p className="text-lg text-[#33332D]/70 leading-relaxed font-medium italic">
                  {isRtl
                    ? 'הרעיון התגבש, אך השתהה מלהיות לעובדה קיימת. זכה יהודי מיוחד מתמיד ותלמיד חכם, שהוציא מכיסו שטר של 100 דולר בהכרזה, \'הנה בזה, זה עתה נפתח הגמ"ח\'! זו היתה ההפקדה הראשונה לגמ"ח.'
                    : "From a mere concept to a living reality, sparked by a single 100-dollar bill that declared the beginning of our mission."}
                </p>
              </div>
            </div>

            {/* Step 3 — The Blooming */}
            <div className="relative grid md:grid-cols-2 gap-16 items-center">
              <div className={`${isRtl ? 'md:pr-16 text-right' : 'md:pr-16 text-right'} order-2 md:order-1`}>
                <div className="text-7xl font-black text-[#0A192F]/5 leading-none select-none">03</div>
                <h3 className="text-3xl font-black text-[#0A192F] mt-2 mb-6 tracking-tight">
                  {isRtl ? 'הפריחה' : 'The Blooming'}
                </h3>
                <div className={`w-20 h-1 bg-[#D4B483] mb-8 ${isRtl ? 'mr-auto md:ml-auto md:mr-0' : 'ml-auto'}`} />
                <p className="text-lg text-[#33332D]/70 leading-relaxed font-medium italic">
                  {isRtl
                    ? 'פעילות הגמ"ח עברה מפה לאוזן, ומאז שנת תשס"ב ועד היום, משך 24 שנים, הגמ"ח גדל מאד והינו אחד מגדולי הגמ"חים בארץ. פעילות הגמ"ח נותנת מענה למטרות שונות ומסייעת בידי אברכים בני תורה במגוון צרכים.'
                    : 'Growth spread through word of mouth, blossoming over 24 years into one of the largest and most impactful institutions in the land.'}
                </p>
              </div>
              <div className="order-1 md:order-2 flex justify-center">
                <div className="w-24 h-24 rounded-full border border-[#E5E1D8] flex items-center justify-center relative bg-white z-10 shadow-sm">
                  <div className="w-10 h-10 bg-[#D4B483]/20 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-[#D4B483] rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 — The Fruits */}
            <div className="relative grid md:grid-cols-2 gap-16 items-center">
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full border border-[#E5E1D8] flex items-center justify-center relative bg-white z-10 shadow-sm">
                  <div className="w-14 h-14 bg-[#D4B483]/10 rounded-full flex items-center justify-center">
                    <div className="w-6 h-6 bg-[#D4B483] rounded-full" />
                  </div>
                </div>
              </div>
              <div className={`${isRtl ? 'md:pr-16 text-right' : 'md:pl-16'}`}>
                <div className="text-7xl font-black text-[#0A192F]/5 leading-none select-none">04</div>
                <h3 className="text-3xl font-black text-[#0A192F] mt-2 mb-6 tracking-tight">
                  {isRtl ? 'הפירות' : 'The Fruits'}
                </h3>
                <div className="w-20 h-1 bg-[#D4B483] mb-8" />
                <p className="text-lg text-[#33332D]/70 leading-relaxed font-medium italic">
                  {isRtl
                    ? 'הפירות האמתיים שיש למפקידים בגמ"ח, הם הזכויות הרבות שצוברים המפקידים מידי יום יום, כפי שכתב מרן החפץ חיים בספרו \'אהבת חסד\'. חוץ מכך, מבחינה כלכלית הכסף נמצא במקום בטוח ללא סיכונים.'
                    : 'The true fruits are the spiritual merits accumulated daily, alongside the peace of mind that comes with absolute financial security.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Irrigation System (dark callout) ── */}
        <div className="max-w-6xl mx-auto px-4 mt-24" dir={isRtl ? 'rtl' : 'ltr'}>
          <div
            className="rounded-[4rem] p-16 md:p-32 text-center text-white relative overflow-hidden"
            style={{
              background: '#0A192F',
              boxShadow: '0 40px 100px rgba(10,25,47,0.25)',
            }}
          >
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#D4B483]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl opacity-50 pointer-events-none" />

            <div className="relative z-10 max-w-4xl mx-auto">
              <span className="inline-block px-4 py-1.5 rounded-full bg-[#0A192F]/80 border border-white/10 text-[#D4B483] text-[10px] font-bold uppercase tracking-[0.3em] mb-8">
                {isRtl ? 'מקור האנרגיה' : 'The Energy Source'}
              </span>

              <h3 className="text-4xl md:text-6xl font-black mb-12 tracking-tighter leading-tight">
                {isRtl ? 'מקור האנרגיה' : 'The Energy Source'}
              </h3>

              <div className={`text-lg md:text-xl text-white/70 font-medium leading-relaxed italic space-y-8 ${isRtl ? 'text-right' : 'text-center'}`}>
                <p>
                  {isRtl
                    ? 'לאחר שחל עלינו "חוק הגמחים", אנו נדרשים להעמיד קרן בגובה של 5% מסך ההפקדות כהון עצמי (לא מההפקדות עצמן), שזה סכום עתק, כתנאי לקבלת רישיון לניהול הגמ"ח.'
                    : 'Our GMACH operations require consistent financial resources. The funds in our possession were deposited to provide loans, not to be used for expenses. We need a stable financial source to serve as the energy for all the extensive activities of the GMACH.'}
                </p>
                <p>
                  {isRtl
                    ? 'כל זאת, בנוסף להוצאות חודשיות שאנו נדרשים להעמיד בכל חודש כדי לתפעל את הגמ"ח.'
                    : 'In addition to the monthly expenses, we require equity capital under the "GMACH Law" which mandates this as a condition for obtaining an operating license.'}
                </p>
                <div className="py-12 border-y border-white/10 my-12">
                  <p className="text-2xl md:text-3xl text-white font-black tracking-tight leading-snug not-italic">
                    {isRtl
                      ? 'אנו פונים אליך בקריאת ידידות, הצטרף נא להיות ממחזקי פעילות הגמ"ח, ותזכה להיות שותף מלא באלפי פעילויות חסד שיזקפו לזכותך כפי שכתב לנו מרן רבי חיים קנייבסקי זצוק"ל.'
                      : 'We call upon you in friendship — please join to be among the supporters of the GMACH\'s activities, and merit being a full partner in thousands of acts of kindness credited to your account, as written to us by Maran Rabbi Chaim Kanievsky zt"l.'}
                  </p>
                </div>
              </div>

              <div className="mt-20">
                <button
                  onClick={() => navigate(user ? '/donor/additional-donation' : '/plans')}
                  className="px-20 py-6 text-xl font-bold rounded-[2rem] transition-all hover:scale-105 hover:shadow-2xl"
                  style={{
                    background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)',
                    color: '#0A192F',
                    boxShadow: '0 8px 40px rgba(176,141,87,0.4)',
                  }}
                >
                  {isRtl ? 'לחצו כאן' : 'Commit Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── DONATION REQUEST IMAGE ───────────────── */}
      <section className="py-16 md:py-24 bg-[#F7F5F0]">
        <div className="max-w-5xl mx-auto px-4">
          <div
            className="overflow-hidden rounded-[2rem] shadow-[0_8px_40px_0_rgba(98,109,88,0.12),0_2px_10px_0_rgba(51,51,45,0.08)]"
          >
            <img
              src={donationRequestImg}
              alt={isRtl ? 'בקשת תרומה גמ"ח חסדי עולם' : 'Chasdei Olam GMACH Donation Request'}
              className="w-full h-auto block"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>

      {/* ───────────────── HOW IT WORKS ───────────────── */}
      <section id="how-it-works" className="py-40 bg-[#F7F5F0] border-y border-[#E5E1D8]/30">
        <div className="max-w-6xl mx-auto px-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="text-center mb-24">
            <p className="text-xs font-bold text-[#B08D57] tracking-[0.2em] uppercase mb-4">
              {isRtl ? 'איך זה עובד?' : 'The Process'}
            </p>
            <h2 className="text-4xl md:text-5xl font-black text-[#2D3E40]">
              {isRtl ? 'שלושה שלבים לנתינה וריענון' : 'Three Steps to Refreshment'}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-16 items-stretch">
            {(
              [
                {
                  Icon: Gift,
                  title: isRtl ? 'נתינה מתמדת' : 'Continuous Giving',
                  desc: isRtl
                    ? (<>בחרו תוכנית תרומה חודשית שמתאימה לכם.<br />ניתן לתרום מכספי מעשרות על פי הוראת רבנים.</>)
                    : 'Select a monthly plan that reflects your philanthropic goals and become partners in the vital work of our GMACH.',
                  step: 'I',
                },
                {
                  Icon: Users,
                  title: isRtl ? 'צבירת זכויות' : 'Growing Equity',
                  desc: isRtl
                    ? 'בכל תשלום אתם נכנסים כשותפים לפעילות הענפה של הגמ"ח ובנוסף כל חודש מקרב אתכם ליעד הזכאות לחופשה חלומית.'
                    : "Each contribution makes you a partner in the GMACH's extensive activities while bringing you closer to your dream vacation eligibility.",
                  step: 'II',
                },
                {
                  Icon: Hotel,
                  title: isRtl ? 'חופשת יוקרה' : 'Luxury Rest',
                  desc: isRtl
                    ? 'עם השלמת מלוא חיובי התוכנית, תהיו זכאים לשובר אירוח חגיגי במלון שבחרתם. מימוש השובר מתבצע בתיאום מראש במועדים המוסכמים מול המלונות (למעט חגים ומועדי "בין הזמנים").'
                    : 'Upon completing all plan payments, you will receive a hotel voucher of your choice, redeemed in advance coordination with the hotels at agreed dates.',
                  step: 'III',
                },
              ] as { Icon: React.ElementType; title: string; desc: React.ReactNode; step: string }[]
            ).map(({ Icon, title, desc, step }, i) => (
              <div key={i} className="group relative h-full">
                <div
                  className="h-full flex flex-col items-center p-12 text-center bg-white rounded-[2rem] border border-[#E5E1D8]/40 hover:border-[#B08D57]/30 transition-all duration-500 hover:-translate-y-2"
                  style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
                >
                  <div className="mb-10 w-24 h-24 bg-[#F9F8F4] text-[#B08D57] rounded-full flex items-center justify-center relative z-10 transition-all duration-500 group-hover:bg-[#B08D57] group-hover:text-white shrink-0">
                    <Icon size={40} strokeWidth={1} />
                  </div>
                  <span className="block text-sm font-bold text-[#B08D57]/40 tracking-widest mb-4 shrink-0">
                    {step}
                  </span>
                  <h3 className="text-2xl font-bold text-[#2D3E40] mb-5 shrink-0">{title}</h3>
                  <p className="text-[#33332D]/70 leading-relaxed font-light flex-1">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── CTA BANNER ───────────────── */}
      <section className="py-32 bg-white">
        <div className="max-w-6xl mx-auto px-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div
            className="rounded-[4rem] p-16 md:p-32 text-center text-white relative overflow-hidden"
            style={{
              background: '#2D3E40',
              boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)',
            }}
          >
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#B08D57]/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#626D58]/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-black mb-10 leading-[1.1] tracking-tight">
                {isRtl
                  ? 'מוכנים להפוך את הנתינה לחופשה?'
                  : 'Manifest Your Compassion Into Memories'}
              </h2>
              <p className="text-xl md:text-2xl text-white/70 max-w-2xl mx-auto mb-16 font-light">
                {isRtl
                  ? 'הצטרפו עוד היום והתחילו לצבור זכויות נופש במלונות הטובים ביותר.'
                  : 'Begin your contribution today and watch your impact grow into exquisite retreats.'}
              </p>
              <button
                onClick={() => navigate('/plans')}
                className="group inline-flex items-center gap-3 px-16 py-6 text-xl font-bold rounded-[2rem] transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #D4B483 0%, #B08D57 100%)',
                  color: '#0A192F',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                }}
              >
                <span className="font-bold tracking-tight uppercase">
                  {isRtl ? 'הצטרפות עכשיו' : 'Initialize Membership'}
                </span>
                <ChevronLeft
                  className={`transition-transform group-hover:-translate-x-1 ${isRtl ? '' : 'rotate-180'}`}
                  size={28}
                />
              </button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
