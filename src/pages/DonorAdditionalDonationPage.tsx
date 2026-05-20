import { useState } from 'react';
import { Heart } from 'lucide-react';
import DonorLayout from '../components/DonorLayout';

export default function DonorAdditionalDonationPage() {
  const [amount, setAmount] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('');

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

  const ADDITIONAL_DONATION_URL = 'https://www.matara.pro/nedarimplus/online/?mosad=7010422&groupe=%D7%AA%D7%A9%D7%9C%D7%95%D7%9D%20%D7%93%D7%A8%D7%9A%20%D7%90%D7%AA%D7%A8%20%D7%A0%D7%A6%D7%99%D7%91%D7%99%D7%9D&groupelock=1';

  const handleDonate = () => {
    if (!amount || parseInt(amount) < 10) {
      alert('נא להזין סכום של לפחות ₪10');
      return;
    }
    window.open(ADDITIONAL_DONATION_URL, '_blank', 'noopener,noreferrer');
  };

  const selectedAmount = parseInt(amount) || 0;

  return (
    <DonorLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black text-[#0A192F]">תרומה נוספת</h1>
          <p className="text-[#33332D]/50 text-sm mt-1 font-light">
            תרום סכום נוסף מעבר למנוי החודשי שלך
          </p>
        </div>

        {/* Main card */}
        <div
          className="bg-white rounded-[2rem] p-8 border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.08)' }}
        >
          <h2 className="text-lg font-black text-[#0A192F] mb-6">בחר סכום לתרומה</h2>

          {/* Preset amounts */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {predefinedAmounts.map((value) => (
              <button
                key={value}
                onClick={() => handleAmountSelect(value)}
                className={`p-5 rounded-2xl border-2 transition-all text-center ${
                  amount === value.toString()
                    ? 'border-[#626D58] bg-[#626D58]/5 shadow-sm'
                    : 'border-[#E5E1D8] hover:border-[#D4B483]/60 hover:bg-[#F9F8F4]'
                }`}
              >
                <div className={`text-2xl font-black mb-0.5 ${
                  amount === value.toString() ? 'text-[#626D58]' : 'text-[#0A192F]'
                }`}>
                  ₪{value.toLocaleString()}
                </div>
                <div className="text-xs text-[#33332D]/40">תרומה חד פעמית</div>
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="mb-8">
            <label className="block text-sm font-semibold text-[#33332D]/70 mb-3">
              או הזן סכום אחר:
            </label>
            <div className="relative">
              <span className="absolute start-4 top-1/2 -translate-y-1/2 text-[#33332D]/40 font-semibold text-lg pointer-events-none">
                ₪
              </span>
              <input
                type="text"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                placeholder="0"
                className="w-full ps-10 pe-4 py-3.5 bg-[#F9F8F4] border border-[#E5E1D8] rounded-xl text-[#0A192F] text-lg font-bold placeholder-[#33332D]/20 focus:outline-none focus:ring-2 focus:ring-[#D4B483]/30 focus:border-[#D4B483] transition-all"
                dir="ltr"
              />
            </div>
            <p className="text-xs text-[#33332D]/40 mt-2">סכום מינימלי: ₪10</p>
          </div>

          {/* Summary */}
          {selectedAmount > 0 && (
            <div
              className="flex items-center justify-between p-5 rounded-2xl border border-[#D4B483]/30 mb-6"
              style={{ backgroundColor: 'rgba(212,180,131,0.05)' }}
            >
              <span className="text-sm font-semibold text-[#33332D]/60">סכום לתרומה</span>
              <span className="text-2xl font-black text-[#0A192F]">₪{selectedAmount.toLocaleString()}</span>
            </div>
          )}

          <button
            onClick={handleDonate}
            disabled={selectedAmount < 10}
            className={`w-full py-4 rounded-xl font-semibold text-base transition-all flex items-center justify-center gap-2 ${
              selectedAmount >= 10
                ? 'bg-[#0A192F] text-white hover:bg-[#0A192F]/90 shadow-sm hover:shadow-md'
                : 'bg-[#F7F5F0] text-[#33332D]/30 cursor-not-allowed border border-[#E5E1D8]'
            }`}
          >
            <Heart size={18} className={selectedAmount >= 10 ? 'text-[#D4B483]' : ''} />
            <span>
              {selectedAmount >= 10
                ? `תרום ₪${selectedAmount.toLocaleString()} עכשיו`
                : 'בחר סכום לתרומה'}
            </span>
          </button>
        </div>

        {/* Why donate more */}
        <div
          className="bg-white rounded-[2rem] p-7 border border-[#E5E1D8]/60"
          style={{ boxShadow: '0 4px 24px 0 rgba(98,109,88,0.06)' }}
        >
          <h3 className="text-base font-bold text-[#0A192F] mb-4">למה לתרום תרומה נוספת?</h3>
          <ul className="space-y-3">
            {[
              'תרומתך מסייעת לנו להמשיך לעזור למשפחות נזקקות',
              'כל שקל עוזר לנו לספק שירותי אירוח איכותיים יותר',
              'תרומה נוספת מאפשרת לנו להרחיב את מאגר המלונות',
            ].map((text) => (
              <li key={text} className="flex items-start gap-3 text-sm text-[#33332D]/60 font-light">
                <div className="w-5 h-5 rounded-full bg-[#D4B483]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Heart size={10} className="text-[#B08D57]" fill="currentColor" />
                </div>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DonorLayout>
  );
}
