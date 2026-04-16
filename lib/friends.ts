import { supabase } from "@/lib/supabase";
import type { Profile as ProfileType } from "@/types/database";
import { getMyProfile, searchProfilesByUsername } from "@/lib/profile";

export type FriendOverview = {
  accepted: ProfileType[];
  pendingIncoming: ProfileType[];
  pendingOutgoing: ProfileType[];
};

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function sendFriendRequestByUsername(
  targetUsername: string,
) {
  const mine = await getMyProfile();
  if (!mine) throw new Error("Musíš být přihlášený.");

  const normalizedTarget = normalizeUsername(targetUsername);
  if (!normalizedTarget) throw new Error("Vyplň jméno uživatele.");

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id")
    // Exact match, case-insensitive
    .ilike("username", normalizedTarget)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target?.id) throw new Error("Uživatel nebyl nalezen.");
  if (target.id === mine.id) throw new Error("Nemůžeš poslat žádost sám sobě.");

  const { error } = await supabase.from("friendships").insert({
    user_id: mine.id,
    friend_id: target.id,
    status: "pending",
  });

  if (error) {
    // If already exists, surface a user-friendly message.
    const msg = error.message.toLowerCase();
    if (msg.includes("duplicate") || msg.includes("primary") || msg.includes("unique")) {
      throw new Error("Žádost už existuje.");
    }
    throw error;
  }
}

export async function acceptFriendRequest(fromUserId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("Musíš být přihlášený.");

  const myId = data.user.id;

  const { error: updateError } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("user_id", fromUserId)
    .eq("friend_id", myId);

  if (updateError) throw updateError;
}

export async function getFriendOverview(): Promise<FriendOverview> {
  const mine = await getMyProfile();
  if (!mine) throw new Error("Musíš být přihlášený.");

  const [
    pendingIncomingRows,
    pendingOutgoingRows,
    acceptedOutgoingRows,
    acceptedIncomingRows,
  ] = await Promise.all([
    supabase
      .from("friendships")
      .select("user_id")
      .eq("friend_id", mine.id)
      .eq("status", "pending"),
    supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", mine.id)
      .eq("status", "pending"),
    supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", mine.id)
      .eq("status", "accepted"),
    supabase
      .from("friendships")
      .select("user_id")
      .eq("friend_id", mine.id)
      .eq("status", "accepted"),
  ]);

  const fetchProfilesByIds = async (ids: string[]) => {
    const unique = Array.from(new Set(ids)).filter(Boolean);
    if (unique.length === 0) return [];
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", unique);
    if (error) throw error;
    return (data ?? []) as ProfileType[];
  };

  const pendingIncomingIds =
    (pendingIncomingRows.data ?? []).map((r) => r.user_id as string);
  const pendingOutgoingIds =
    (pendingOutgoingRows.data ?? []).map((r) => r.friend_id as string);
  const acceptedOutgoingIds =
    (acceptedOutgoingRows.data ?? []).map((r) => r.friend_id as string);
  const acceptedIncomingIds =
    (acceptedIncomingRows.data ?? []).map((r) => r.user_id as string);

  const [pendingIncoming, pendingOutgoing, accepted1, accepted2] =
    await Promise.all([
      fetchProfilesByIds(pendingIncomingIds),
      fetchProfilesByIds(pendingOutgoingIds),
      fetchProfilesByIds(acceptedOutgoingIds),
      fetchProfilesByIds(acceptedIncomingIds),
    ]);

  return {
    pendingIncoming,
    pendingOutgoing,
    accepted: [...accepted1, ...accepted2],
  };
}

export async function searchPotentialFriends(
  query: string,
): Promise<ProfileType[]> {
  const mine = await getMyProfile();
  if (!mine) throw new Error("Musíš být přihlášený.");

  const results = await searchProfilesByUsername(query);
  return results.filter((p) => p.id !== mine.id);
}

// Přidej toto na konec souboru lib/friends.ts
export async function removeFriend(friendId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Uživatel není přihlášen");

  const { error } = await supabase
    .from('friendships')
    .delete()
    // Smaže záznam, kde jsem já poslal žádost JEMU, nebo ON poslal MĚ
    .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);

  if (error) throw error;
}