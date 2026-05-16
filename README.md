# Chasdei Olam - חסדי עולם

A production-ready SaaS application for managing recurring donation subscriptions with hotel stay rewards.

## Features

### Donor Features
- User registration and authentication
- Subscription to donation plans
- Progress tracking dashboard
- Automatic payment processing via Stripe
- Hotel booking system when eligible
- Support ticket system
- Hebrew RTL interface with English option

### Admin Features
- Comprehensive dashboard with KPIs
- Plan management
- Subscription monitoring
- Payment tracking
- Hotel and inventory management
- Booking oversight
- Support ticket management

### Payment Logic
- Tracks successful payments (not months)
- Automatic retry on payment failure (up to 3 attempts)
- Subscription freezing after failed attempts
- Eligibility based on successful payment count
- Stripe webhook integration for real-time updates

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL (via Supabase)
- **Payments**: Stripe Subscriptions
- **Edge Functions**: Supabase Edge Functions (Deno)
- **State Management**: Zustand
- **Internationalization**: Custom i18n with Hebrew/English

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Stripe account (for payment processing)

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

For the Stripe webhook edge function, these are automatically configured:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Database Setup

The database schema is automatically created via migrations:

1. **Main Schema** (`create_chasdei_olam_schema`):
   - profiles, plans, subscriptions, payments
   - hotels, hotel_inventory, bookings
   - support_threads, support_messages
   - Full RLS policies
   - Indexes for performance

2. **Sample Data** (`add_sample_data`):
   - 3 subscription plans (Basic, Premium, VIP)
   - 6 sample hotels across different cities
   - 90 days of inventory for each hotel

## Creating an Admin User

1. Create a user through Supabase Auth dashboard or signup page
2. Update the user's profile role:
```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'admin@example.com';
```

## Stripe Webhook Configuration

The Stripe webhook edge function is deployed at:
```
https://your-project.supabase.co/functions/v1/stripe-webhook
```

Configure this URL in your Stripe dashboard webhook settings.

**Events to listen for:**
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`

## Subscription States

- **active**: Normal subscription with ongoing payments
- **frozen**: Subscription frozen after 3 failed payment attempts
- **canceled**: User canceled subscription
- **completed**: Eligibility achieved and hotel booked

## Eligibility Logic

Users become eligible when:
```
successful_payments_count >= plan.required_successful_payments
```

## Key Features Implementation

### Payment Tracking
- Only successful payments count toward eligibility
- Failed payments increment `failed_payment_attempts`
- After 3 failed attempts, status becomes `frozen`
- Frozen subscriptions cannot book hotels

### Hotel Booking
- Only eligible users can access booking page
- Real-time inventory checking
- Support for extra rooms with pricing
- Atomic inventory decrement
- Voucher generation
- Change deadline enforcement

### Support System
- Thread-based messaging
- User and admin messages
- Open/closed status tracking
- Booking-related support requests

## Design System

### Colors
- Primary: `#0B3C5D` (Deep Blue)
- Accent Gold: `#C6A75E`
- Background: `#FFFFFF`
- Secondary Background: `#F5F7FA`
- Text: `#1A1A1A`
- Success: `#2E7D32`
- Error: `#C62828`

### Typography
- Hebrew: Heebo
- English: Inter
- Line height: 150% for body, 120% for headings

### RTL Support
Full RTL support with automatic direction switching based on language selection.

## Security

- Row Level Security (RLS) enabled on all tables
- Donors can only access their own data
- Admin role required for management operations
- Stripe handles all payment card data (PCI compliant)
- Edge functions use service role for database operations

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Deploy to your hosting provider (Vercel, Netlify, etc.)

3. Ensure environment variables are configured in production

4. Set up Stripe webhook endpoint

5. Test all flows thoroughly before going live

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── Layout.tsx
│   └── ProtectedRoute.tsx
├── contexts/           # React contexts
│   └── AuthContext.tsx
├── hooks/              # Custom hooks
│   └── useTranslation.ts
├── i18n/              # Translations
│   └── translations.ts
├── lib/               # Utilities and configs
│   ├── supabase.ts
│   └── stripe.ts
├── pages/             # Route pages
│   ├── admin/
│   │   └── AdminDashboard.tsx
│   ├── BookingPage.tsx
│   ├── Dashboard.tsx
│   ├── PlansPage.tsx
│   ├── SignIn.tsx
│   ├── SignUp.tsx
│   └── SupportPage.tsx
├── store/             # State management
│   └── useStore.ts
├── App.tsx
└── main.tsx

supabase/
└── functions/
    └── stripe-webhook/
        └── index.ts
```

## Support

For issues and questions, use the in-app support system.
