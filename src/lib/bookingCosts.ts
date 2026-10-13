// רווחיות הזמנות: כמה הלקוח שילם (סכום התוכנית) פחות כמה עלה לנו המלון.
// העלות: "מחיר רגיל" של המלון (hotel_costs) או מחיר אחר שהמנהל הזין להזמנה (booking_admin_tracking).

export type CostMode = 'default' | 'custom';

export interface BookingCostInput {
  cost_mode?: CostMode | null;
  custom_cost?: number | null;
}

// העלות בפועל של הזמנה, או null אם לא ידועה (אין מחיר רגיל למלון ולא הוזן מחיר אחר)
export const bookingCost = (t: BookingCostInput | undefined, hotelDefaultCost: number | null | undefined): number | null => {
  if (t?.cost_mode === 'custom') return t.custom_cost ?? null;
  return hotelDefaultCost ?? null;
};

export const planTotal = (plan: { monthly_amount: number; required_successful_payments: number } | null | undefined) =>
  plan ? plan.monthly_amount * plan.required_successful_payments : null;

export const shekel = (n: number | null | undefined) =>
  n == null ? '—' : `₪${Math.round(n).toLocaleString('he-IL')}`;
