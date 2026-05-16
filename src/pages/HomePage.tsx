import { useNavigate } from 'react-router-dom';
import { Heart, Hotel, Gift, Users, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white" dir="rtl">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Heart className="text-blue-600" size={32} />
              <h1 className="text-2xl font-bold text-gray-900">חסדי עולם</h1>
            </div>
            <div className="flex gap-3">
              {user ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  לדשבורד שלי
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/signin')}
                    className="px-4 py-2 text-gray-700 hover:text-blue-600 transition-colors"
                  >
                    כניסה
                  </button>
                  <button
                    onClick={handleGetStarted}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    התחל עכשיו
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main>
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              תרומה חודשית שמעניקה לך חופשה
            </h2>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              הצטרפו לאלפי משפחות שתורמות מדי חודש ונהנות מחופשות במלונות מובחרים ברחבי הארץ.
              <br />
              תרמו לעתיד טוב יותר וקבלו פינוק מגיע.
            </p>
            <button
              onClick={handleGetStarted}
              className="px-8 py-4 bg-blue-600 text-white text-lg rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
            >
              בחר תוכנית תרומה
            </button>
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
              איך זה עובד?
            </h3>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Gift className="text-blue-600" size={32} />
                </div>
                <h4 className="text-xl font-semibold text-gray-900 mb-3">1. בחר תוכנית</h4>
                <p className="text-gray-600">
                  בחר את תוכנית התרומה המתאימה לך - כל תוכנית מעניקה זכאות למלונות ברמות שונות
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="text-blue-600" size={32} />
                </div>
                <h4 className="text-xl font-semibold text-gray-900 mb-3">2. תרום באופן קבוע</h4>
                <p className="text-gray-600">
                  בצע תרומה חודשית קבועה והשלם את מספר התשלומים הנדרש לפי התוכנית
                </p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Hotel className="text-blue-600" size={32} />
                </div>
                <h4 className="text-xl font-semibold text-gray-900 mb-3">3. תהנה מחופשה</h4>
                <p className="text-gray-600">
                  לאחר השלמת התשלומים, בחר מלון מתוך רשימת המלונות הזכאים והזמן את החופשה שלך
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-gradient-to-b from-blue-50 to-white">
          <div className="max-w-6xl mx-auto px-4">
            <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
              למה לבחור בחסדי עולם?
            </h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h4 className="text-xl font-semibold text-gray-900 mb-3">תרומה עם משמעות</h4>
                <p className="text-gray-600">
                  התרומה שלך עוזרת למשפחות נזקקות ומממנת פעילויות חסד חיוניות בקהילה
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h4 className="text-xl font-semibold text-gray-900 mb-3">מלונות איכותיים</h4>
                <p className="text-gray-600">
                  גישה למגוון רחב של מלונות בדירוגים שונים ברחבי הארץ, מותאמים לכל תקציב
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h4 className="text-xl font-semibold text-gray-900 mb-3">תהליך פשוט ונוח</h4>
                <p className="text-gray-600">
                  מערכת דיגיטלית מתקדמת לניהול התרומות והזמנת המלונות בקלות ובמהירות
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h4 className="text-xl font-semibold text-gray-900 mb-3">שקיפות מלאה</h4>
                <p className="text-gray-600">
                  מעקב מלא אחר התרומות שלך, מצב הזכאות והתקדמות לקראת החופשה
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-blue-600 text-white">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h3 className="text-4xl font-bold mb-6">
              מוכנים להצטרף?
            </h3>
            <p className="text-xl mb-8 text-blue-100">
              הצטרפו עוד היום ותתחילו את המסע לחופשה הבאה שלכם
            </p>
            <button
              onClick={handleGetStarted}
              className="px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-xl hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl inline-flex items-center gap-2"
            >
              <span>בחר תוכנית תרומה</span>
              <ArrowLeft size={20} />
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Heart className="text-blue-400" size={24} />
            <span className="text-white font-semibold">חסדי עולם</span>
          </div>
          <p className="text-sm">
            © {new Date().getFullYear()} חסדי עולם. כל הזכויות שמורות.
          </p>
        </div>
      </footer>
    </div>
  );
}
