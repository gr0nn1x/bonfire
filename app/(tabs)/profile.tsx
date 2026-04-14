import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SectionCard } from "@/components/section-card";
import { Button, Field } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { acceptFriendRequest, getFriendOverview, searchPotentialFriends, sendFriendRequestByUsername } from "@/lib/friends";
import { getMyProfile } from "@/lib/profile";
import type { Profile as ProfileType } from "@/types/database";

export default function ProfileScreen() {
  const { user } = useAuth();
  const [myProfile, setMyProfile] = useState<ProfileType | null>(null);
  const [friendOverview, setFriendOverview] = useState<Awaited<ReturnType<typeof getFriendOverview>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileType[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo se odhlasit.";
      Alert.alert("Chyba", message);
    }
  };

  const refresh = async () => {
    setIsLoading(true);
    try {
      const [profile, overview] = await Promise.all([
        getMyProfile(),
        getFriendOverview(),
      ]);
      setMyProfile(profile);
      setFriendOverview(overview);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Nepodařilo se načíst profil.";
      Alert.alert("Chyba", message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const results = await searchPotentialFriends(q);
      setSearchResults(results);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Nepodařilo se vyhledat uživatele.";
      Alert.alert("Chyba", message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (p: ProfileType) => {
    if (!p.username) {
      Alert.alert("Nelze odeslat", "Uživatel nemá vyplněné username.");
      return;
    }

    try {
      await sendFriendRequestByUsername(p.username);
      Alert.alert("Hotovo", "Žádost o přátelství byla odeslána.");
      setSearchResults([]);
      setSearchQuery("");
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Nepodařilo se odeslat žádost.";
      Alert.alert("Chyba", message);
    }
  };

  return (
    <ScreenContainer>
      <View className="gap-2">
        <Text className="text-3xl font-bold text-text">Profil</Text>
        <Text className="text-base leading-6 text-muted">
          Level, strength points a přátelé.
        </Text>
      </View>

      {isLoading ? (
        <View className="items-center py-6">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      ) : (
        <>
          <SectionCard title="Můj profil" subtitle="Stats v appce se počítají z workout logů.">
            <Text className="text-sm leading-6 text-text">
              Username: {myProfile?.username ?? "—"}
            </Text>
            <Text className="text-sm leading-6 text-text">
              Level: {myProfile?.level ?? 1}
            </Text>
            <Text className="text-sm leading-6 text-text">
              Strength points: {myProfile?.strength_points ?? 0}
            </Text>

            <Button onPress={() => void handleSignOut()} variant="secondary">
              Odhlásit se
            </Button>
          </SectionCard>

          <SectionCard title="Přátelé" subtitle="Najdi lidi podle jména a pošli žádost.">
            <View className="gap-2">
              <Field
                label="Vyhledat lidi"
                placeholder="např. pavelbench"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
              <Button
                variant="secondary"
                disabled={isSearching}
                onPress={() => void handleSearch()}
              >
                {isSearching ? "Hledám..." : "Hledat"}
              </Button>
            </View>

            {searchResults.length > 0 ? (
              <View className="gap-2 pt-3">
                {searchResults.map((p) => (
                  <View
                    key={p.id}
                    className="rounded-2xl border border-border bg-surface px-4 py-3"
                  >
                    <Text className="text-sm font-semibold text-text">
                      {p.username ?? "Uživatel"}
                    </Text>
                    <Text className="text-xs text-muted">
                      Level: {p.level} · {p.strength_points} SP
                    </Text>
                    <Button onPress={() => void handleSendRequest(p)}>
                      Poslat žádost
                    </Button>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="gap-3 pt-4">
              <Text className="text-sm font-semibold text-text">
                Žádosti (příchozí): {friendOverview?.pendingIncoming.length ?? 0}
              </Text>
              {friendOverview?.pendingIncoming.length ? (
                <View className="gap-2">
                  {friendOverview.pendingIncoming.map((p) => (
                    <View
                      key={p.id}
                      className="rounded-2xl border border-border bg-surface px-4 py-3"
                    >
                      <Text className="text-sm font-semibold text-text">
                        {p.username ?? "Uživatel"}
                      </Text>
                      <Button
                        variant="secondary"
                        onPress={() => void acceptFriendRequest(p.id).then(refresh)}
                      >
                        Schválit
                      </Button>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-muted">Zatím žádné příchozí žádosti.</Text>
              )}

              <Text className="text-sm font-semibold text-text">
                Čeká na vás (odeslané): {friendOverview?.pendingOutgoing.length ?? 0}
              </Text>
              {friendOverview?.pendingOutgoing.length ? (
                <View className="gap-2">
                  {friendOverview.pendingOutgoing.map((p) => (
                    <View
                      key={p.id}
                      className="rounded-2xl border border-border bg-surface px-4 py-3"
                    >
                      <Text className="text-sm font-semibold text-text">
                        {p.username ?? "Uživatel"}
                      </Text>
                      <Text className="text-sm text-muted">Čeká se na schválení.</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-muted">Nic nečeká.</Text>
              )}

              <Text className="text-sm font-semibold text-text">
                Přátelé: {friendOverview?.accepted.length ?? 0}
              </Text>
              {friendOverview?.accepted.length ? (
                <View className="gap-2">
                  {friendOverview.accepted.map((p) => (
                    <View
                      key={p.id}
                      className="rounded-2xl border border-border bg-surface px-4 py-3"
                    >
                      <Text className="text-sm font-semibold text-text">
                        {p.username ?? "Uživatel"}
                      </Text>
                      <Text className="text-xs text-muted">
                        Level: {p.level} · {p.strength_points} SP
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-muted">Zatím žádní přátelé.</Text>
              )}
            </View>
          </SectionCard>
        </>
      )}
    </ScreenContainer>
  );
}
