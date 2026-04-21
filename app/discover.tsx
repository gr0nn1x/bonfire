import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { ScreenContainer } from '@/components/screen-container';
import { useRouter } from 'expo-router';
// PŘIDÁNA IKONKA DOWNLOAD
import { Search, ArrowLeft, Download } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';

export default function DiscoverScreen() {
  const { language } = useLanguage();
  const isCs = language === "cs";
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCloning, setIsCloning] = useState(false);
  const router = useRouter();

  const fetchPublicPlans = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const safeUserId = user?.id || '00000000-0000-0000-0000-000000000000';

      const { data: plansData, error: planErr } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('is_public', true)
        .neq('user_id', safeUserId) 
        .order('created_at', { ascending: false });

      if (planErr) throw planErr;

      if (!plansData || plansData.length === 0) {
        setPlans([]);
        return;
      }

      const authorIds = [...new Set(plansData.map(p => p.user_id))];
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, level')
        .in('id', authorIds);

      const enrichedPlans = plansData.map(plan => {
        const author = profilesData?.find(p => p.id === plan.user_id);
        return {
          ...plan,
          profiles: author || { username: isCs ? 'Neznámý' : 'Unknown', level: 1 } 
        };
      });

      setPlans(enrichedPlans);
    } catch (e: any) {
      console.error("Discover error:", e.message);
      if (Platform.OS === 'web') window.alert(isCs ? "Nepodařilo se načíst plány z Tržiště." : "Could not load plans from the marketplace.");
      else Alert.alert(isCs ? "Chyba" : "Error", isCs ? "Nepodařilo se načíst plány z Tržiště." : "Could not load plans from the marketplace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPublicPlans(); }, []);

  const clonePlan = async (sourcePlan: any) => {
    if (isCloning) return;
    setIsCloning(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(isCs ? "Nejsi přihlášen" : "You are not signed in");

      // 1. Zkopírování hlavního plánu
      const { data: newPlan, error: planErr } = await supabase.from('workout_plans').insert({
        user_id: user.id,
        name: `${sourcePlan.name} (od @${sourcePlan.profiles?.username})`,
        description: sourcePlan.description,
        is_active: false,
        is_public: false 
      }).select().single();

      if (planErr) throw planErr;

      // 2. Načtení a zkopírování dnů a cviků
      const { data: oldDays } = await supabase
        .from('plan_days')
        .select('*, plan_exercises(*)')
        .eq('plan_id', sourcePlan.id);

      if (oldDays) {
        for (const day of oldDays) {
          const { data: newDay } = await supabase.from('plan_days').insert({
            plan_id: newPlan.id,
            day_of_week: day.day_of_week,
            name: day.name
          }).select().single();

          if (day.plan_exercises && day.plan_exercises.length > 0) {
            const exercisesToInsert = day.plan_exercises.map((ex: any) => ({
              plan_day_id: newDay.id,
              exercise_id: ex.exercise_id,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight,
              notes: ex.notes,
              sort_order: ex.sort_order
            }));
            await supabase.from('plan_exercises').insert(exercisesToInsert);
          }
        }
      }

      // 3. ZVÝŠENÍ POČÍTADLA U PŮVODNÍHO PLÁNU O +1
      const newCount = (sourcePlan.copies_count || 0) + 1;
      await supabase.from('workout_plans').update({ copies_count: newCount }).eq('id', sourcePlan.id);

      if (Platform.OS === 'web') window.alert(isCs ? "Úspěch! 🎉\nPlán byl přidán do tvé knihovny." : "Success! 🎉\nThe plan was added to your library.");
      else Alert.alert(isCs ? "Úspěch! 🎉" : "Success! 🎉", isCs ? "Plán byl přidán do tvé knihovny." : "The plan was added to your library.");
      
      router.push('/plans');
      
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert((isCs ? "Chyba: " : "Error: ") + e.message);
      else Alert.alert(isCs ? "Chyba při kopírování" : "Copy failed", e.message);
    } finally {
      setIsCloning(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View className="bg-slate-800 m-4 mb-2 p-5 rounded-[24px] border border-slate-700 shadow-sm">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 pr-2">
          <Text className="text-xl font-bold text-white">{item.name}</Text>
          <Text className="text-orange-500 font-bold text-sm">
            {isCs ? "Autor" : "Author"}: @{item.profiles?.username} (Lvl {item.profiles?.level})
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => clonePlan(item)}
          disabled={isCloning}
          className={`px-4 py-2 rounded-xl ${isCloning ? 'bg-orange-800' : 'bg-orange-500'}`}
        >
          <Text className="text-white font-black text-xs uppercase tracking-wider">
            {isCloning ? (isCs ? "Kopíruji..." : "Copying...") : isCs ? "Získat" : "Get"}
          </Text>
        </TouchableOpacity>
      </View>
      
      {item.description ? (
        <Text className="text-slate-400 italic mt-2 leading-5">"{item.description}"</Text>
      ) : (
        <Text className="text-slate-600 italic mt-2">{isCs ? "Bez popisku" : "No description"}</Text>
      )}

      {/* ZDE JE PŘIDÁNO POČÍTADLO STAŽENÍ */}
      <View className="mt-4 flex-row items-center bg-slate-900/50 self-start px-3 py-1.5 rounded-lg border border-slate-700">
        <Download size={14} color="#94a3b8" />
        <Text className="text-slate-400 text-xs font-bold ml-1.5">
          {item.copies_count || 0}x {isCs ? "uloženo" : "saved"}
        </Text>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <View className="p-4 pt-2 flex-row items-center mb-4">
        <TouchableOpacity 
          onPress={() => router.back()} 
          className="mr-4 bg-slate-800 h-10 w-10 items-center justify-center rounded-full border border-slate-700"
        >
          <ArrowLeft size={20} color="#f97316" />
        </TouchableOpacity>
        <View>
          <Text className="text-3xl font-black text-white">{isCs ? "Tržiště 🔍" : "Marketplace 🔍"}</Text>
          <Text className="text-slate-400">{isCs ? "Nejlepší plány od komunity" : "Top plans from the community"}</Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator color="#f97316" size="large" />
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View className="items-center mt-20 px-6">
              <Search size={48} color="#475569" className="mb-4" />
              <Text className="text-slate-400 text-center font-bold text-lg mb-2">{isCs ? "Zatím je tu prázdno" : "Nothing here yet"}</Text>
              <Text className="text-slate-500 text-center text-sm">{isCs ? "Až někdo vytvoří veřejný plán s dostatkem cviků, objeví se právě zde." : "Once someone creates a public plan with enough exercises, it will appear here."}</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
