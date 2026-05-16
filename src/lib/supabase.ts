import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: 'donor' | 'admin';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          role?: 'donor' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string | null;
          role?: 'donor' | 'admin';
          created_at?: string;
          updated_at?: string;
        };
      };
      plans: {
        Row: {
          id: string;
          name_he: string;
          name_en: string;
          description_he: string | null;
          description_en: string | null;
          monthly_amount: number;
          required_successful_payments: number;
          hotel_level: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          status: 'active' | 'frozen' | 'canceled' | 'completed';
          successful_payments_count: number;
          failed_payment_attempts: number;
          is_eligible: boolean;
          started_at: string;
          frozen_at: string | null;
          canceled_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      payments: {
        Row: {
          id: string;
          subscription_id: string;
          stripe_payment_id: string | null;
          amount: number;
          status: 'succeeded' | 'failed' | 'pending';
          attempt_number: number;
          failure_reason: string | null;
          paid_at: string | null;
          created_at: string;
        };
      };
      hotels: {
        Row: {
          id: string;
          name_he: string;
          name_en: string;
          city_he: string;
          city_en: string;
          level: string;
          description_he: string | null;
          description_en: string | null;
          base_rooms: number;
          extra_room_price: number;
          change_deadline_days: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      hotel_inventory: {
        Row: {
          id: string;
          hotel_id: string;
          date: string;
          total_rooms: number;
          available_rooms: number;
          created_at: string;
          updated_at: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          subscription_id: string;
          hotel_id: string;
          user_id: string;
          booking_date: string;
          base_rooms: number;
          extra_rooms: number;
          total_extra_cost: number;
          status: 'confirmed' | 'canceled' | 'changed';
          voucher_code: string;
          voucher_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      support_threads: {
        Row: {
          id: string;
          user_id: string;
          booking_id: string | null;
          subject: string;
          status: 'open' | 'closed';
          created_at: string;
          updated_at: string;
        };
      };
      support_messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_id: string;
          message: string;
          is_admin: boolean;
          created_at: string;
        };
      };
    };
  };
};
