import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View, TouchableOpacity, ScrollView, Modal, TextInput, Image } from "react-native";
import { calculateStatsFromLogs, CalculatedStats, syncAchievements } from "@/lib/achievements";
import { AchievementSection } from "@/components/AchievementSection";
import { ScreenContainer } from "@/components/screen-container";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { getMyProfile } from "@/lib/profile";
import type { Profile as ProfileType } from "@/types/database";
import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  const { user } = useAuth();
  const [myProfile, setMyProfile] = useState<ProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [stats, setStats] = useState<CalculatedStats>({ 
    totalWeight: 0, totalSets: 0, totalReps: 0,
    maxBench: 0, maxDeadlift: 0, maxSquat: 0,
    bigThreeTotal: 0, uniqueExercisesCount: 0,
    totalWorkouts: 0, morningWorkouts: 0, nightWorkouts: 0, currentStreak: 0
  });

  // Stavy pro úpravu profilu
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const [profile, logsResponse] = await Promise.all([
        getMyProfile(),
        supabase.from('workout_logs').select('*, exercises(name)').eq('user_id', user?.id)
      ]);

      setMyProfile(profile);
      if (profile) {
        setEditBio(profile.bio || "");
        setEditAvatar(profile.avatar_url || "");
      }
      
      if (logsResponse.data) {
        // 1. Spočítáme aktuální statistiky
        const calculated = calculateStatsFromLogs(logsResponse.data);
        // 2. Uložíme do stavu pro zobrazení
        setStats(calculated);
        
        // 3. Synchronizujeme do databáze
        if (user?.id) {
          await syncAchievements(user.id, calculated);
        }
      }
    } catch (e) {
      Alert.alert("Chyba", "Nepodařilo se načíst profil.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) void refresh();
  }, [user?.id]);

  const handleSignOut = async () => {
    try { await signOut(); } catch (error: any) { Alert.alert("Chyba", error.message); }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase.from('profiles').update({ bio: editBio, avatar_url: editAvatar }).eq('id', user.id);
      if (error) throw error;
      setIsEditModalOpen(false);
      refresh();
    } catch (e: any) {
      Alert.alert("Chyba", "Nepodařilo se uložit profil.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-900">
      <ScreenContainer>
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-3xl font-bold text-text">Můj Profil</Text>
            <Text className="text-base leading-6 text-muted">Tvůj progres a nastavení.</Text>
          </View>
          <TouchableOpacity onPress={() => setIsEditModalOpen(true)} className="bg-slate-800 p-3 rounded-xl border border-slate-700">
            <Text className="text-orange-500 font-bold">⚙️ Upravit</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View className="items-center py-10"><ActivityIndicator size="large" color="#f97316" /></View>
        ) : (
          <>
            <SectionCard title="Osobní info" subtitle="Základní informace o tvém účtu.">
              <View className="flex-row items-center mb-4">
                <View className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 items-center justify-center overflow-hidden mr-4">
                  {myProfile?.avatar_url ? (
                    <Image source={{ uri: myProfile.avatar_url }} className="w-full h-full" />
                  ) : (
                    <Text className="text-slate-400 font-bold text-xl">{myProfile?.username?.charAt(0).toUpperCase()}</Text>
                  )}
                </View>

                <View className="flex-1">
                  <View className="flex-row justify-between items-center">
                    <View>
                      <Text className="text-text font-bold text-lg">@{myProfile?.username}</Text>
                      <Text className="text-orange-500 font-bold">Level {myProfile?.level}</Text>
                    </View>
                    <View className="bg-orange-500/10 px-3 py-2 rounded-2xl flex-row items-center border border-orange-500/20">
                      <Text className="text-xl mr-1">🔥</Text>
                      <Text className="text-orange-500 font-black text-lg">{stats.currentStreak}</Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted mt-1">{myProfile?.strength_points ?? 0} SP</Text>
                </View>
              </View>

              {myProfile?.bio && (
                <View className="bg-slate-800/50 p-3 rounded-xl mb-4 border border-slate-700/50">
                  <Text className="text-slate-300 italic">"{myProfile.bio}"</Text>
                </View>
              )}

              <Button onPress={() => void handleSignOut()} variant="secondary">Odhlásit se</Button>
            </SectionCard>

            <AchievementSection stats={stats} />
            <View className="h-10" />
          </>
        )}

        {/* MODAL PRO ÚPRAVU */}
        <Modal visible={isEditModalOpen} animationType="slide" transparent={true}>
          <View className="flex-1 bg-slate-900/95 justify-center p-4 pt-12">
            <View className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-white">Upravit Profil</Text>
                <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                  <Text className="text-slate-400 font-bold text-2xl">×</Text>
                </TouchableOpacity>
              </View>

              <Text className="text-slate-400 text-xs font-bold uppercase mb-2 ml-1">Tvoje Bio</Text>
              <TextInput value={editBio} onChangeText={setEditBio} placeholder="Napiš něco o sobě..." placeholderTextColor="#64748b" multiline className="bg-slate-900 text-white p-4 rounded-xl border border-slate-700 mb-4 min-h-[100px] text-top" />
              <Text className="text-slate-400 text-xs font-bold uppercase mb-2 ml-1">URL Profilovky (Odkaz)</Text>
              <TextInput value={editAvatar} onChangeText={setEditAvatar} placeholder="https://..." placeholderTextColor="#64748b" className="bg-slate-900 text-white p-4 rounded-xl border border-slate-700 mb-8" />

              <TouchableOpacity onPress={handleSaveProfile} disabled={isSavingProfile} className={`p-4 rounded-xl items-center ${isSavingProfile ? 'bg-orange-800' : 'bg-orange-500'}`}>
                <Text className="text-white font-bold text-lg">{isSavingProfile ? "Ukládám..." : "Uložit změny"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScreenContainer>
    </ScrollView>
  );
}