/*
  # Restore admin role for admin account

  The profile for yehudit7669@gmail.com (id: 6fa1f16e-2b77-4e6e-885d-62f13afcd175)
  has full_name = 'Admin User' and is the designated admin account, but its role
  was set to 'donor'. This migration restores it to 'admin' so the admin sidebar
  and navigation are accessible again.

  No data is destroyed — the subscription linked to this user remains intact.
  Admin users are redirected to /admin by the routing logic in App.tsx.
*/

UPDATE profiles
SET role = 'admin'
WHERE id = '6fa1f16e-2b77-4e6e-885d-62f13afcd175'
  AND email = 'yehudit7669@gmail.com';
