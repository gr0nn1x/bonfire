import { supabase } from "@/lib/supabase";
import type { Profile as ProfileType } from "@/types/database";

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function getMyProfile(): Promise<ProfileType | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return (data ?? null) as ProfileType | null;
}

export async function searchProfilesByUsername(
  query: string,
): Promise<ProfileType[]> {
  const q = normalizeUsername(query);
  if (!q) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    // case-insensitive match
    .ilike("username", `%${q}%`)
    .limit(10);

  if (error) throw error;
  return (data ?? []) as ProfileType[];
}

