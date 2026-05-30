/*
  # Fix next_payment_date to always be a future date

  ## Problem
  Nedarim sends NextDate (e.g. "28/05/2026") which may be in the past at the time
  the subscription is created (e.g. created May 30, billing day is the 28th).
  
  ## Fix
  For each subscription where next_payment_date is in the past, advance it to the
  same day-of-month in the next calendar month (or the month after if that's still past).
  
  ## Backfill
  Updates existing subscriptions where next_payment_date < now().
*/

UPDATE subscriptions
SET next_payment_date = (
  -- Compute the same billing day in the next future month
  -- Extract day from the stored date, add months until it's in the future
  date_trunc('month', now() + interval '1 month')
    + (EXTRACT(DAY FROM next_payment_date) - 1) * interval '1 day'
)
WHERE 
  next_payment_date IS NOT NULL
  AND next_payment_date < now()
  AND status IN ('active', 'frozen');
