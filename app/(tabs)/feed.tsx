import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, RefreshControl, Image, ActivityIndicator, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { ScreenContainer } from '@/components/screen-container';
import { SectionCard } from '@/components/section-card';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { getMyProfile } from '@/lib/profile';
import { Button, Field } from '@/components/ui';
import { getFriendOverview, searchPotentialFriends, sendFriendRequestByUsername, acceptFriendRequest, removeFriend } from '@/lib/friends';
import { Alert } from 'react-native'; // Nezapomeň importovat Alert z react-native!

export default function FeedScreen() {
  const router = useRouter();
  
  // Přepínač pohledu: Feed (Zeď) vs Friends (Přátelé)
  const [activeTab, setActiveTab] = useState<'feed' | 'friends'>('feed');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stavy pro Feed
  const [activities, setActivities] = useState<any[]>([]);

  // Stavy pro Přátele
  const [myProfile, setMyProfile] = useState<any>(null);
  const [friendOverview, setFriendOverview] = useState<Awaited<ReturnType<typeof getFriendOverview>> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Hlavní funkce na načtení VŠEHO
  const fetchAllData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Načteme přátele a můj profil (potřebujeme pro Feed i Žebříček)
      const [overview, profile] = await Promise.all([
        getFriendOverview(),
        getMyProfile()
      ]);
      setFriendOverview(overview);
      setMyProfile(profile);

      // 2. Načteme Feed jen pro schválené přátele + mě
      const friendIds = overview.accepted.map(f => f.id);
      const feedUserIds = [...friendIds, user.id];

      const { data: feedData, error: feedErr } = await supabase
        .from('activity_feed')
        .select(`*, profiles:user_id (username, avatar_url, level)`)
        .in('user_id', feedUserIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (feedErr) throw feedErr;
      setActivities(feedData || []);

    } catch (e: any) {
      console.error('Chyba feedu:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAllData(); }, []);

  // --- FUNKCE PRO PŘÁTELE ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const results = await searchPotentialFriends(searchQuery.trim());
      setSearchResults(results);
    } finally { setIsSearching(false); }
  };

  const handleSendRequest = async (p: any) => {
    try {
      await sendFriendRequestByUsername(p.username);
      alert("Žádost odeslána! 🤝");
      setSearchQuery(""); setSearchResults([]); fetchAllData();
    } catch (e) { alert("Chyba při odesílání."); }
  };
  const handleRemoveFriend = async (friendId: string, username: string) => {
    // Pokud jsme na WEBU (prohlížeč)
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Opravdu chceš odebrat uživatele @${username} ze svých přátel?`);
      if (confirmed) {
        try {
          await removeFriend(friendId);
          fetchAllData(); // Refreshne data po smazání
        } catch (e) {
          alert("Nepodařilo se odebrat přítele.");
        }
      }
    } 
    // Pokud jsme na MOBILU (iOS / Android)
    else {
      Alert.alert(
        "Odebrat z přátel",
        `Opravdu chceš odebrat uživatele @${username} ze svých přátel?`,
        [
          { text: "Zrušit", style: "cancel" },
          { 
            text: "Odebrat", 
            style: "destructive",
            onPress: async () => {
              try {
                await removeFriend(friendId);
                fetchAllData(); 
              } catch (e) {
                alert("Nepodařilo se odebrat přítele.");
              }
            }
          }
        ]
      );
    }
  };
  // --- RENDER JEDNOHO PŘÍSPĚVKU VE FEEDU ---
  const renderFeedItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={() => router.push(`/friend/${item.user_id}`)}
      className="bg-slate-800 m-4 p-4 rounded-[24px] border border-slate-700 shadow-sm"
    >
      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 rounded-full bg-slate-700 items-center justify-center mr-3 border border-slate-600 overflow-hidden">
          {item.profiles?.avatar_url ? (
            <Image source={{ uri: item.profiles.avatar_url }} className="w-full h-full" />
          ) : (
            <Text className="text-slate-300 font-bold">{item.profiles?.username?.charAt(0).toUpperCase() || '?'}</Text>
          )}
        </View>
        <View>
          <Text className="text-white font-bold">{item.profiles?.username || 'Anonymní svalovec'}</Text>
          <Text className="text-slate-500 text-[10px]">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: cs })}</Text>
        </View>
      </View>

      <Text className={`font-black text-lg mb-1 ${item.event_type === 'level_up' ? 'text-blue-400' : item.event_type === 'achievement_unlocked' ? 'text-yellow-400' : 'text-orange-500'}`}>
        {item.title}
      </Text>
      <Text className="text-slate-300 leading-5">{item.body}</Text>

      {item.event_type === 'personal_record' && (
        <View className="mt-3 bg-orange-500/10 border border-orange-500/20 p-3 rounded-xl items-center">
          <Text className="text-orange-500 font-bold tracking-widest uppercase text-xs">Nové maximum! 🏆</Text>
        </View>
      )}
      {item.event_type === 'level_up' && (
        <View className="mt-3 bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl items-center">
          <Text className="text-blue-400 font-bold tracking-widest uppercase text-xs">Level {item.metadata?.new_level} dosažen! 🚀</Text>
        </View>
      )}
      {item.event_type === 'achievement_unlocked' && (
        <View className="mt-3 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl items-center">
          <Text className="text-yellow-400 font-bold tracking-widest uppercase text-xs">{item.metadata?.achievement_title} 🏅</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) return <ActivityIndicator className="flex-1 bg-slate-900 justify-center" color="#f97316" />;

  return (
    <ScreenContainer>
      <View className="p-4 pt-2">
        <Text className="text-3xl font-black text-white">Komunita 🔥</Text>
        <Text className="text-slate-400 mb-4">Výkony a přátelé</Text>

        {/* PŘEPÍNAČ: ZEĎ vs PŘÁTELÉ */}
        <View className="flex-row bg-slate-800 p-1 rounded-2xl border border-slate-700">
          <TouchableOpacity onPress={() => setActiveTab('feed')} className={`flex-1 p-3 rounded-xl items-center ${activeTab === 'feed' ? 'bg-slate-700' : ''}`}>
            <Text className={`font-bold ${activeTab === 'feed' ? 'text-orange-500' : 'text-slate-400'}`}>Zeď</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('friends')} className={`flex-1 p-3 rounded-xl items-center ${activeTab === 'friends' ? 'bg-slate-700' : ''}`}>
            <Text className={`font-bold ${activeTab === 'friends' ? 'text-orange-500' : 'text-slate-400'}`}>Přátelé ({friendOverview?.accepted?.length || 0})</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* OBSAH PODLE ZVOLENÉ ZÁLOŽKY */}
      {activeTab === 'feed' ? (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderFeedItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAllData(); }} tintColor="#f97316" />}
          ListEmptyComponent={<Text className="text-slate-500 text-center mt-20 italic">Zatím se nic neděje. Ulož trénink nebo si přidej přátele!</Text>}
        />
      ) : (
        <ScrollView className="px-4 pt-2" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAllData(); }} tintColor="#f97316" />}>
          
          <SectionCard title="Najít přátele" subtitle="Hledej podle uživatelského jména">
            <View className="gap-2">
              <Field label="Username" placeholder="např. pavelbench" value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="none" />
              <Button variant="secondary" disabled={isSearching} onPress={handleSearch}>{isSearching ? "Hledám..." : "Hledat"}</Button>
            </View>
            
            {searchResults.length > 0 && (
              <View className="gap-2 pt-3">
                {searchResults.map((p) => (
                  <View key={p.id} className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 flex-row justify-between items-center">
                    <View>
                      <Text className="text-sm font-semibold text-white">@{p.username}</Text>
                      <Text className="text-xs text-slate-400">Level {p.level}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleSendRequest(p)} className="bg-orange-500 px-3 py-2 rounded-xl">
                      <Text className="text-white font-bold text-xs">PŘIDAT</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

          <SectionCard title="🏆 Žebříček" subtitle="Kdo má nejvíc bodů?">
            <View className="gap-2">
              {[...(friendOverview?.accepted ?? []), { id: 'me', username: 'Ty', strength_points: myProfile?.strength_points ?? 0, level: myProfile?.level }]
                .sort((a, b) => (b.strength_points ?? 0) - (a.strength_points ?? 0))
                .map((p, index) => (
                  <View key={p.id} className={`flex-row items-center justify-between p-3 rounded-xl ${p.id === 'me' ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-slate-800'}`}>
                    <View className="flex-row items-center">
                      <Text className="text-slate-400 font-bold w-6">{index + 1}.</Text>
                      <Text className={`font-bold ${p.id === 'me' ? 'text-orange-500' : 'text-white'}`}>{p.username}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-white font-bold">{p.strength_points} SP</Text>
                      <Text className="text-[10px] text-slate-400">Level {p.level}</Text>
                    </View>
                  </View>
                ))}
            </View>
          </SectionCard>

          <SectionCard title="Spravovat přátele" subtitle="Žádosti a aktuální seznam">
            <Text className="text-sm font-semibold text-white mb-2">Příchozí žádosti ({friendOverview?.pendingIncoming.length ?? 0})</Text>
            {friendOverview?.pendingIncoming.map((p) => (
              <View key={p.id} className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 flex-row items-center justify-between mb-2">
                <Text className="text-sm font-semibold text-white">@{p.username}</Text>
                <TouchableOpacity onPress={() => void acceptFriendRequest(p.id).then(fetchAllData)} className="bg-green-600 px-4 py-2 rounded-lg">
                  <Text className="text-white font-bold text-xs">Schválit</Text>
                </TouchableOpacity>
              </View>
            ))}
            {friendOverview?.pendingIncoming.length === 0 && <Text className="text-slate-500 italic mb-4">Žádné nové žádosti.</Text>}

            <Text className="text-sm font-semibold text-white mt-4 mb-2">Moji přátelé ({friendOverview?.accepted.length ?? 0})</Text>
            {friendOverview?.accepted.map((p) => (
              <TouchableOpacity key={p.id} onPress={() => router.push(`/friend/${p.id}`)} className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 flex-row items-center justify-between mb-2">
                <View>
                  <Text className="text-sm font-semibold text-white">@{p.username}</Text>
                  <Text className="text-xs text-slate-400">Level: {p.level} · {p.strength_points} SP</Text>
                </View>
                <Text className="text-orange-500 font-bold">→</Text>
              </TouchableOpacity>
            ))}
            {(!friendOverview?.accepted.length) && <Text className="text-sm text-slate-500 italic">Zatím žádní přátelé.</Text>}
          </SectionCard>
          <View className="h-10" />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}