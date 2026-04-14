import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";

// Importy pro statistiky a achievementy
import { calculateStatsFromLogs, CalculatedStats } from "@/lib/achievements";
import { AchievementSection } from "@/components/AchievementSection";

import { ScreenContainer } from "@/components/screen-container";
import { SectionCard } from "@/components/section-card";
import { Button, Field } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { acceptFriendRequest, getFriendOverview, searchPotentialFriends, sendFriendRequestByUsername } from "@/lib/friends";
import { getMyProfile } from "@/lib/profile";
import type { Profile as ProfileType } from "@/types/database";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [myProfile, setMyProfile] = useState<ProfileType | null>(null);
  const [friendOverview, setFriendOverview] = useState<Awaited<ReturnType<typeof getFriendOverview>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 1. Inicializace statů se všemi povinnými poli
  const [stats, setStats] = useState<CalculatedStats>({ 
    totalWeight: 0, 
    totalSets: 0, 
    totalReps: 0,
    maxBench: 0, 
    maxDeadlift: 0, 
    maxSquat: 0,
    bigThreeTotal: 0,
    uniqueExercisesCount: 0,
    totalWorkouts: 0,
    morningWorkouts: 0,
    nightWorkouts: 0,
    currentStreak: 0
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileType[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 2. Funkce pro načtení dat
  const refresh = async () => {
    setIsLoading(true);
    try {
      // Načítáme profil, přátele i workout logy najednou
      const [profile, overview, logsResponse] = await Promise.all([
        getMyProfile(),
        getFriendOverview(),
        supabase.from('workout_logs').select('*, exercises(name)').eq('user_id', user?.id)
      ]);

      setMyProfile(profile);
      setFriendOverview(overview);
      
      // Výpočet statistik z logů (pokud existují)
      if (logsResponse.data) {
        const calculated = calculateStatsFromLogs(logsResponse.data);
        setStats(calculated);
      }
    } catch (e) {
      console.error("Chyba při refreshování profilu:", e);
      Alert.alert("Chyba", "Nepodařilo se načíst všechna data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) void refresh();
  }, [user?.id]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert("Chyba", error.message);
    }
  };

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
    } catch (e: any) {
      Alert.alert("Chyba", "Nepodařilo se vyhledat uživatele.");
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
    } catch (e: any) {
      Alert.alert("Chyba", "Nepodařilo se odeslat žádost.");
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-900">
      <ScreenContainer>
        <View className="gap-2">
          <Text className="text-3xl font-bold text-text">Profil</Text>
          <Text className="text-base leading-6 text-muted">
            Tvůj progres, statistiky a přátelé.
          </Text>
        </View>

        {isLoading ? (
          <View className="items-center py-10">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : (
          <>
            <SectionCard title="Můj profil" subtitle="Základní informace o tvém účtu.">
              <View className="flex-row justify-between mb-2 items-center">
  <View>
    <Text className="text-text font-bold text-lg">@{myProfile?.username}</Text>
    <Text className="text-orange-500 font-bold">Level {myProfile?.level}</Text>
  </View>
  
  {/* Zobrazení Streaku */}
  <View className="bg-orange-500/10 px-3 py-2 rounded-2xl flex-row items-center border border-orange-500/20">
    <Text className="text-xl mr-1">🔥</Text>
    <Text className="text-orange-500 font-black text-lg">{stats.currentStreak}</Text>
  </View>
</View>
            
              <Text className="text-sm text-muted mb-4">
                Strength points: {myProfile?.strength_points ?? 0} SP
              </Text>

              <Button onPress={() => void handleSignOut()} variant="secondary">
                Odhlásit se
              </Button>
            </SectionCard>

            {/* --- SEKCE ACHIEVEMENTŮ --- */}
            <AchievementSection stats={stats} />

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
              <SectionCard title="🏆 Žebříček přátel" subtitle="Kdo je momentálně největší dříč?">
  <View className="gap-2">
    {/* Seřadíme přátele + přidáme sebe do seznamu */}
    {[
      ...(friendOverview?.accepted ?? []),
      { id: 'me', username: 'Ty', strength_points: myProfile?.strength_points ?? 0, level: myProfile?.level }
    ]
      .sort((a, b) => (b.strength_points ?? 0) - (a.strength_points ?? 0))
      .map((p, index) => (
        <View 
          key={p.id} 
          className={`flex-row items-center justify-between p-3 rounded-xl ${p.id === 'me' ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-surface/50'}`}
        >
          <View className="flex-row items-center">
            <Text className="text-muted font-bold w-6">{index + 1}.</Text>
            <Text className={`font-bold ${p.id === 'me' ? 'text-orange-500' : 'text-text'}`}>
              {p.username}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-text font-bold">{p.strength_points} SP</Text>
            <Text className="text-[10px] text-muted">Level {p.level}</Text>
          </View>
        </View>
      ))}
  </View>
</SectionCard>

              {/* Výsledky vyhledávání */}
              {searchResults.length > 0 && (
                <View className="gap-2 pt-3">
                  {searchResults.map((p) => (
                    <View key={p.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
                      <Text className="text-sm font-semibold text-text">
                        {p.username ?? "Uživatel"}
                      </Text>
                      <Text className="text-xs text-muted mb-2">
                        Level: {p.level} · {p.strength_points} SP
                      </Text>
                      <Button onPress={() => void handleSendRequest(p)}>
                        Poslat žádost
                      </Button>
                    </View>
                  ))}
                </View>
              )}

              <View className="gap-3 pt-4">
                {/* Žádosti (příchozí) */}
                <Text className="text-sm font-semibold text-text">
                  Příchozí žádosti ({friendOverview?.pendingIncoming.length ?? 0})
                </Text>
                {friendOverview?.pendingIncoming.map((p) => (
                  <View key={p.id} className="rounded-2xl border border-border bg-surface px-4 py-3 flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-text">{p.username}</Text>
                    <TouchableOpacity 
                      onPress={() => void acceptFriendRequest(p.id).then(refresh)}
                      className="bg-orange-500 px-4 py-2 rounded-lg"
                    >
                      <Text className="text-white font-bold text-xs">Schválit</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Seznam přátel */}
                <Text className="text-sm font-semibold text-text mt-2">
                  Přátelé ({friendOverview?.accepted.length ?? 0})
                </Text>
                {friendOverview?.accepted.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => router.push(`/friend/${p.id}`)}
                    className="rounded-2xl border border-border bg-surface px-4 py-3 flex-row items-center justify-between"
                  >
                    <View>
                      <Text className="text-sm font-semibold text-text">{p.username}</Text>
                      <Text className="text-xs text-muted">
                        Level: {p.level} · {p.strength_points} SP
                      </Text>
                    </View>
                    <Text className="text-orange-500 font-bold">→</Text>
                  </TouchableOpacity>
                ))}
                {(!friendOverview?.accepted.length) && (
                  <Text className="text-sm text-muted">Zatím žádní přátelé.</Text>
                )}
              </View>
            </SectionCard>
            
            <View className="h-10" />
          </>
        )}
      </ScreenContainer>
    </ScrollView>
  );
}