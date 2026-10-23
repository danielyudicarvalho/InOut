import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthRepository } from "./index";
export function createSupabaseAuthRepository(
  client: SupabaseClient,
  redirectTo: string,
): AuthRepository;
