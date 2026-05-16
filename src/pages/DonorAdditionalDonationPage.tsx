import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Heart, CheckCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import DonorLayout from '../components/DonorLayout';

export default function DonorAdditionalDonationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);

  const predefinedAmounts = [50, 100, 180, 250, 500, 1000];

  const handleAmountSelect = (value: number) => {
    setAmount(value.toString());
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    const numValue = value.replace(/[^0-9]/g, '');
    setCustomAmount(numValue);
    setAmount(numValue);
  };

  const handleDonate = async () => {
    if (!amount || parseInt(amount) < 10) {
      alert('נא להזין סכום של לפחות ₪10');
      return;
    }

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setAmount('');
      setCustomAmount('');
    }, 3000);
  };

  const selectedAmount = parseInt(amount) || 0;

  return (
    <DonorLayout>
      <div className="max-w-3xl mx-auto">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-8 text-white mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-full">
              <Heart size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">תרומה נוספת</h1>
              <p className="text-blue-100">תרום סכום נוסף מעבר למנוי החודשי שלך</p>
            </div>
          </div>
        </div>

        {showSuccess && (
          <div className="mb-8 p-6 bg-green-50 border-2 border-green-200 rounded-xl">
            <div className="flex items-center gap-4">
              <CheckCircle className="text-green-600 flex-shrink-0" size={32} />
              <div>
                <h3 className="text-lg font-bold text-green-900 mb-1">התרומה התקבלה בהצלחה!</h3>
                <p className="text-green-800">תודה רבה על תרומתך הנדיבה של ₪{selectedAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">בחר סכום לתרומה</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {predefinedAmounts.map((value) => (
              <button
                key={value}
                onClick={() => handleAmountSelect(value)}
                className={`p-6 rounded-xl border-2 transition-all ${
                  amount === value.toString()
                    ? 'border-blue-600 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    ₪{value.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">תרומה חד פעמית</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mb-8">
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              או הזן סכום אחר:
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <DollarSign className="text-gray-400" size={24} />
              </div>
              <input
                type="text"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                placeholder="הזן סכום..."
                className="w-full pr-12 pl-4 py-4 text-xl border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none transition-colors"
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span className="text-gray-500 text-xl">₪</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">סכום מינימלי: ₪10</p>
          </div>

          {selectedAmount > 0 && (
            <div className="mb-8 p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-semibold text-gray-900">סכום לתרומה:</span>
                <span className="text-3xl font-bold text-blue-600">
                  ₪{selectedAmount.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                תרומה זו תתווסף למערכת ותעזור לנו להמשיך את פעילותנו
              </p>
            </div>
          )}

          <button
            onClick={handleDonate}
            disabled={selectedAmount < 10}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              selectedAmount >= 10
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg hover:scale-[1.02]'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {selectedAmount >= 10
              ? `תרום ₪${selectedAmount.toLocaleString()} עכשיו`
              : 'בחר סכום לתרומה'}
          </button>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              התרומה תעובד באמצעות מערכת התשלומים המאובטחת שלנו
            </p>
          </div>
        </div>

        <div className="mt-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-lg p-6 border-2 border-amber-200">
          <h3 className="text-xl font-bold text-gray-900 mb-3">למה לתרום תרומה נוספת?</h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <Heart className="text-amber-600 flex-shrink-0 mt-1" size={20} />
              <span>תרומתך מסייעת לנו להמשיך לעזור למשפחות נזקקות</span>
            </li>
            <li className="flex items-start gap-2">
              <Heart className="text-amber-600 flex-shrink-0 mt-1" size={20} />
              <span>כל שקל עוזר לנו לספק שירותי אירוח איכוותיים יותר</span>
            </li>
            <li className="flex items-start gap-2">
              <Heart className="text-amber-600 flex-shrink-0 mt-1" size={20} />
              <span>תרומה נוספת מאפשרת לנו להרחיב את מאגר המלונות</span>
            </li>
          </ul>
        </div>
      </div>
    </DonorLayout>
  );
}
