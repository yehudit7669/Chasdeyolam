// איפה כל תורם עומד: מתשלומים, דרך בקשת ההזמנה, ועד שקיבל את התמורה (מלון).
// משותף לרשימת התורמים ולכרטיס התורם.

export const CHECKLIST_KEYS = ['payment_verified', 'customer_contacted', 'hotel_booked', 'hotel_paid', 'voucher_sent'];

export interface JourneySub {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  is_eligible: boolean;
}

export interface JourneyRequest {
  id: string;
  user_id: string;
  plan_id: string | null;
  subscription_id: string | null;
  status: string;
  redemption_type: string | null;
  created_at: string;
}

export type RewardStage =
  | 'accumulating' | 'eligible_no_request' | 'pending_review' | 'booking_open'
  | 'awaiting_admin' | 'confirmed_closing' | 'fulfilled' | 'rejected' | 'canceled';

export const REWARD_LABEL: Record<RewardStage, { label: string; cls: string }> = {
  accumulating:        { label: 'צובר תשלומים', cls: 'bg-gray-100 text-gray-600' },
  eligible_no_request: { label: 'זכאי — טרם נפתחה בקשה', cls: 'bg-amber-100 text-amber-700' },
  pending_review:      { label: 'בבדיקת מנהל', cls: 'bg-amber-100 text-amber-700' },
  booking_open:        { label: 'פתוח להזמנה — ממתין ללקוח', cls: 'bg-blue-100 text-blue-700' },
  awaiting_admin:      { label: 'בחר מלון — ממתין לאישורך', cls: 'bg-purple-100 text-purple-700' },
  confirmed_closing:   { label: 'אושר — בסגירה', cls: 'bg-sky-100 text-sky-700' },
  fulfilled:           { label: 'קיבל את התמורה ✓', cls: 'bg-green-100 text-green-700' },
  rejected:            { label: 'נדחה', cls: 'bg-red-100 text-red-700' },
  canceled:            { label: 'המנוי בוטל', cls: 'bg-gray-100 text-gray-400' },
};

export const isChecklistComplete = (checklist: Record<string, boolean> | undefined) =>
  !!checklist && CHECKLIST_KEYS.every((k) => checklist[k]);

// הבקשה ששייכת למנוי: קודם לפי subscription_id, אחרת (מימוש מיידי — נוצר בלי subscription_id)
// לפי אותו משתמש ואותה תוכנית
export const requestForSub = (sub: JourneySub, requests: JourneyRequest[]) =>
  requests.find((r) => r.subscription_id === sub.id)
  ?? requests
    .filter((r) => !r.subscription_id && r.user_id === sub.user_id && r.plan_id === sub.plan_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

export const rewardStage = (
  sub: JourneySub,
  requests: JourneyRequest[],
  checklists: Record<string, Record<string, boolean>>,
): RewardStage => {
  const req = requestForSub(sub, requests);
  if (!req) return sub.status === 'canceled' ? 'canceled' : sub.is_eligible ? 'eligible_no_request' : 'accumulating';
  if (req.status === 'confirmed') return isChecklistComplete(checklists[req.id]) ? 'fulfilled' : 'confirmed_closing';
  if (req.status === 'rejected') return 'rejected';
  if (req.status === 'pending_review' || req.status === 'booking_open' || req.status === 'awaiting_admin') return req.status;
  return 'accumulating';
};

// "הסתיים בהצלחה": קיבל תמורה לפחות פעם אחת, ואין לו תוכנית פתוחה שעוד לא מומשה
export const isDonorFinished = (
  subs: JourneySub[],
  requests: JourneyRequest[],
  checklists: Record<string, Record<string, boolean>>,
) => {
  const stages = subs.map((s) => ({ s, stage: rewardStage(s, requests, checklists) }));
  const anyFulfilled = stages.some((x) => x.stage === 'fulfilled');
  const openNotFulfilled = stages.some((x) => ['active', 'frozen'].includes(x.s.status) && x.stage !== 'fulfilled');
  return anyFulfilled && !openNotFulfilled;
};
