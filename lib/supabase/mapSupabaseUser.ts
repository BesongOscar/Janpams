/**
 * Map Supabase Auth user to app User type so UI and context stay unchanged.
 */

import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { User } from '@/interfaces';

export function mapSupabaseUser(supabaseUser: SupabaseUser): User {
  const meta = supabaseUser.user_metadata ?? {};
  return {
    id: supabaseUser.id,
    email_address: supabaseUser.email ?? undefined,
    phone_number: supabaseUser.phone ?? undefined,
    first_name: meta.first_name ?? meta.firstName ?? undefined,
    last_name: meta.last_name ?? meta.lastName ?? undefined,
    first_middle_name: meta.first_middle_name ?? meta.middleNames ?? undefined,
    image: meta.profile_image ?? meta.profileImage ?? undefined,
    created_at: supabaseUser.created_at,
    confirmed_at:
      supabaseUser.email_confirmed_at ?? supabaseUser.phone_confirmed_at ?? undefined,
  };
}
