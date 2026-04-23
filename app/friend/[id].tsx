import { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Dimensions, ActivityIndicator, TouchableOpacity, Alert, Pressable, Image, Platform } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { LineChart } from "react-native-chart-kit";
import { supabase } from "@/lib/supabase";
import { Calendar, LocaleConfig } from 'react-native-calendars';

// Importy pro statistiky a achievementy
import { calculateStatsFromLogs, CalculatedStats } from "@/lib/achievements";
import { AchievementSection } from "@/components/AchievementSection";
import { removeFriend } from "@/lib/friends";
import { useLanguage } from "@/hooks/useLanguage";

const screenWidth = Dimensions.get("window").width;
const DAYS_NAMES_SHORT = ["?", "Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

// --- LOKALIZACE KALENDÁŘE ---
LocaleConfig.locales['cs'] = {
  monthNames: ['Leden','Únor','Březen','Duben','Květen','Červen','Červenec','Srpen','Září','Říjen','Listopad','Prosinec'],
  monthNamesShort: ['Led','Úno','Bře','Dub','Kvě','Čer','Čvc','Srp','Zář','Říj','Lis','Pro'],
  dayNames: ['Neděle','Pondělí','Úterý','Středa','Čtvrtek','Pátek','Sobota'],
  dayNamesShort: ['Ne','Po','Út','St','Čt','Pá','So'],
  today: 'Dnes'
};
LocaleConfig.locales['en'] = {
  monthNames: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  monthNamesShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  dayNames: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  dayNamesShort: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  today: 'Today'
};

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function FriendProfileScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { language } = useLanguage();
  const isCs = language === "cs";
  LocaleConfig.defaultLocale = isCs ? 'cs' : 'en';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  
  // --- NOVÉ STAVY PRO KALENDÁŘ ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  
  const [stats, setStats] = useState<CalculatedStats>({ 
    totalWeight: 0, totalSets: 0, totalReps: 0, maxBench: 0, maxDeadlift: 0, maxSquat: 0,
    bigThreeTotal: 0, uniqueExercisesCount: 0, totalWorkouts: 0, morningWorkouts: 0,
    nightWorkouts: 0, currentStreak: 0
  });

  const fetchFriendData = async () => {
    try {
      setLoading(true);
      
      const [profile, plans, weight, logs] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('workout_plans')
          .select('*, plan_days(*, plan_exercises(*, exercises(name)))')
          .eq('user_id', id), 
        supabase.from('body_weight_logs').select('date, weight').eq('user_id', id).order('date'),
        supabase.from('workout_logs').select('date, sets, weight_lifted, reps_done, exercises(name)').eq('user_id', id).order('date')
      ]);

      if (logs.data) {
        const calculated = calculateStatsFromLogs(logs.data);
        setStats(calculated);
        setAllLogs(logs.data);
        const dates = logs.data.map((l: any) => l.date.split('T')[0]);
        setCompletedDates([...new Set(dates)]);
      }

      // Najdeme aktivní plán přítele pro kalendář
      const active = plans.data?.find((p: any) => p.is_active);
      setActivePlan(active || null);

      const exerciseGraphs: any = {};
      logs.data?.forEach((log: any) => {
        const exInfo: any = log.exercises;
        const name = Array.isArray(exInfo) ? exInfo[0]?.name : exInfo?.name;
        if (!name) return;
        if (!exerciseGraphs[name]) exerciseGraphs[name] = { labels: [], data: [] };
        exerciseGraphs[name].labels.push(new Date(log.date).toLocaleDateString('cs-CZ').slice(0, 5));
        const oneRM = log.weight_lifted * (1 + log.reps_done / 30);
        exerciseGraphs[name].data.push(oneRM);
      });

      setData({
        profile: profile.data,
        plans: plans.data || [],
        weight: weight.data?.length ? { 
          labels: weight.data.map(d => d.date.slice(5, 10)), 
          datasets: [{ data: weight.data.map(d => parseFloat(d.weight)) }] 
        } : null,
        graphs: Object.entries(exerciseGraphs).map(([name, chart]: any) => ({ 
          name, 
          chart: { labels: chart.labels, datasets: [{ data: chart.data }] } 
        }))
      });
    } catch (e) {
      console.error("CHYBA FETCH:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (id) fetchFriendData(); 
  }, [id]);

  // --- LOGIKA KALENDÁŘE (Generování teček) ---
  const markedDates = useMemo(() => {
    const marks: any = {};
    const selectedStr = getLocalDateString(selectedDate);

    // Oranžové tečky pro dny, kdy má kamarád aktivní plán
    if (activePlan?.plan_days) {
      const plannedDays = activePlan.plan_days.map((pd: any) => pd.day_of_week);
      for (let i = -30; i < 60; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        let dw = d.getDay(); dw = dw === 0 ? 7 : dw;
        if (plannedDays.includes(dw)) {
          marks[getLocalDateString(d)] = { marked: true, dotColor: '#f97316' };
        }
      }
    }

    // Zelené tečky pro dny, kdy reálně něco odjel
    completedDates.forEach(dateStr => {
      marks[dateStr] = { marked: true, dotColor: '#22C55E' };
    });

    // Zvýraznění vybraného dne
    marks[selectedStr] = {
      ...marks[selectedStr],
      selected: true,
      selectedColor: '#F97316',
    };

    return marks;
  }, [completedDates, selectedDate, activePlan]);

  const handleDayPress = (day: any) => {
    const [y, m, d] = day.dateString.split('-');
    const newDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    setSelectedDate(newDate);
  };

  const currentDayLogs = useMemo(() => {
    const dateStr = getLocalDateString(selectedDate);
    return allLogs.filter((l: any) => l.date.split('T')[0] === dateStr);
  }, [allLogs, selectedDate]);

  const isDone = completedDates.includes(getLocalDateString(selectedDate));

  // Získání tréninku pro dnešní den z aktivního plánu (pokud ho ten den má v plánu)
  const plannedWorkoutForDay = useMemo(() => {
    if (!activePlan) return null;
    let dayNum = selectedDate.getDay();
    dayNum = dayNum === 0 ? 7 : dayNum;
    return activePlan.plan_days?.find((d: any) => d.day_of_week === dayNum);
  }, [activePlan, selectedDate]);

  // (Funkce pro kopírování plánu a smazání kamaráda zůstávají beze změn)
  const handleCopyPlan = async (plan: any) => {
    if (isCopying) return;
    setIsCopying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: newPlan, error: planErr } = await supabase
        .from('workout_plans')
        .insert({ 
          user_id: user.id, 
          name: `${plan.name || plan.title} (od ${data.profile?.username})`, 
          is_active: false 
        })
        .select().single();

      if (planErr) throw planErr;

      for (const day of plan.plan_days) {
        const { data: newDay, error: dayErr } = await supabase
          .from('plan_days')
          .insert({ plan_id: newPlan.id, day_of_week: day.day_of_week, name: day.name })
          .select().single();

        if (dayErr) throw dayErr;

        const exToInsert = day.plan_exercises.map((ex: any) => ({
          plan_day_id: newDay.id,
          exercise_id: ex.exercise_id,
          sets: parseInt(ex.sets) || 0,
          reps: parseInt(ex.reps) || 0,
          rpe: ex.rpe ? parseFloat(ex.rpe) : null,
          percentage: ex.percentage ? parseFloat(ex.percentage) : null,
          notes: ex.notes || null,
          sort_order: ex.sort_order || 0
        }));

        if (exToInsert.length > 0) {
          await supabase.from('plan_exercises').insert(exToInsert);
        }
      }
      Alert.alert(isCs ? "Úspěch!" : "Success!", isCs ? "Plán zkopírován." : "Plan copied.");
      router.push("/plans");
    } catch (e: any) {
      Alert.alert(isCs ? "Chyba" : "Error", e.message);
    } finally {
      setIsCopying(false);
    }
  };

  const handleRemoveFriend = async () => {
    const username = data?.profile?.username;
    const goBackSafely = () => {
      if (router.canGoBack()) router.back();
      else router.replace('/feed'); 
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(isCs ? `Opravdu chceš odebrat uživatele @${username}?` : `Do you really want to remove @${username}?`);
      if (confirmed) {
        try {
          await removeFriend(id as string);
          goBackSafely();
        } catch (e) {
          alert(isCs ? "Nepodařilo se odebrat přítele." : "Could not remove friend.");
        }
      }
    } else {
      Alert.alert(
        isCs ? "Odebrat z přátel" : "Remove friend",
        isCs ? `Opravdu chceš odebrat uživatele @${username}?` : `Do you really want to remove @${username}?`,
        [
          { text: isCs ? "Zrušit" : "Cancel", style: "cancel" },
          { 
            text: isCs ? "Odebrat" : "Remove", 
            style: "destructive",
            onPress: async () => {
              try {
                await removeFriend(id as string);
                goBackSafely(); 
              } catch (e) {
                Alert.alert(isCs ? "Chyba" : "Error", isCs ? "Nepodařilo se odebrat přítele." : "Could not remove friend.");
              }
            }
          }
        ]
      );
    }
  };

  if (loading || !data) return <ActivityIndicator className="flex-1 bg-slate-900" color="#f97316" />;

  return (
    <ScrollView className="flex-1 bg-slate-900 p-4">
      <Stack.Screen options={{ title: data.profile?.username || (isCs ? "Profil" : "Profile"), headerBackTitle: isCs ? "Zpět" : "Back" }} />
      
      {/* HLAVIČKA */}
      <View className="bg-slate-800 p-5 rounded-[32px] border border-slate-700 mb-6 mt-2">
        <View className="flex-row items-center mb-4">
          <View className="w-16 h-16 rounded-full bg-slate-700 items-center justify-center mr-4 overflow-hidden border border-slate-600">
            {data.profile?.avatar_url ? (
              <Image source={{ uri: data.profile.avatar_url }} className="w-full h-full" />
            ) : (
              <Text className="text-slate-300 font-bold text-xl">
                {data.profile?.username?.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-3xl font-bold text-white mb-1">@{data.profile?.username}</Text>
            <View className="flex-row items-center">
               <Text className="text-orange-500 font-bold mr-3 text-sm">
                Level {data.profile?.level} • {data.profile?.strength_points} SP
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
           {data.profile?.bio ? (
              <View className="flex-1 mr-4">
                 <Text className="text-slate-300 italic text-sm">"{data.profile.bio}"</Text>
                 <TouchableOpacity 
                   onPress={handleRemoveFriend}
                   className="mt-4 bg-red-900/40 p-3 rounded-xl border border-red-500/50 items-center"
                 >
                   <Text className="text-red-400 font-bold">{isCs ? "🗑️ Odebrat z přátel" : "🗑️ Remove friend"}</Text>
                 </TouchableOpacity>
              </View>
           ) : (
              <View className="flex-1" />
           )}
           <View className="bg-orange-500/10 px-3 py-2 rounded-2xl flex-row items-center border border-orange-500/20 self-start">
             <Text className="text-xl mr-1">🔥</Text>
             <Text className="text-orange-500 font-black text-lg">{stats.currentStreak}</Text>
           </View>
        </View>
      </View>

      <AchievementSection stats={stats} />

      {/* --- KALENDÁŘ KAMARÁDA --- */}
      <Text className="text-xl font-bold text-white mt-6 mb-4">{isCs ? "Tréninkový Deník" : "Workout Log"}</Text>
      
      <View className="bg-slate-800 rounded-2xl overflow-hidden mb-6 border border-slate-700 shadow-xl">
        <Calendar
          current={getLocalDateString(selectedDate)}
          onDayPress={handleDayPress}
          markedDates={markedDates}
          firstDay={1} 
          theme={{
            backgroundColor: '#1E293B',
            calendarBackground: '#1E293B',
            textSectionTitleColor: '#94A3B8',
            selectedDayBackgroundColor: '#F97316',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#F97316',
            dayTextColor: '#F1F5F9',
            textDisabledColor: '#334155',
            dotColor: '#F97316', 
            selectedDotColor: '#ffffff',
            arrowColor: '#F97316',
            monthTextColor: '#F1F5F9',
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '600',
          }}
        />
      </View>

      {/* DETAIL VYBRANÉHO DNE */}
      <View className="bg-slate-800 p-5 rounded-[32px] border border-slate-700 shadow-xl mb-6">
        {isDone ? (
          <View>
            <Text className="text-green-500 font-bold uppercase tracking-widest text-[10px] mb-1">
              ✓ {isCs ? "ODCVIČENO" : "COMPLETED"}
            </Text>
            <Text className="text-2xl font-bold text-white mb-3">
              {plannedWorkoutForDay ? plannedWorkoutForDay.name : (isCs ? "Volný trénink" : "Free Workout")}
            </Text>
            
            <View className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/50">
              {currentDayLogs.map((log: any, i: number) => (
                <Text key={i} className="text-slate-400 text-sm mb-1">
                  • {log.exercises?.name} ({log.sets ? `${log.sets}x ` : ''}{log.weight_lifted}kg x {log.reps_done})
                </Text>
              ))}
            </View>
          </View>
        ) : (
          <View>
            {plannedWorkoutForDay ? (
              <View>
                <Text className="text-orange-500 font-bold uppercase tracking-widest text-[10px] mb-1">
                  {isCs ? "V PLÁNU" : "PLANNED"}
                </Text>
                <Text className="text-2xl font-bold text-white mb-3">{plannedWorkoutForDay.name}</Text>
                <View className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/50">
                  {plannedWorkoutForDay.plan_exercises?.map((ex: any) => (
                    <Text key={ex.id} className="text-slate-400 text-sm mb-1">
                      • {ex.exercises?.name} ({ex.sets}x{ex.reps})
                    </Text>
                  ))}
                </View>
              </View>
            ) : (
              <View className="items-center py-4">
                <Text className="text-slate-400 italic text-center">
                  {isCs ? "Žádný záznam ani plán pro tento den. 🧘" : "No record or plan for this day. 🧘"}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* --- TRÉNINKOVÉ PLÁNY (Původní) --- */}
      <Text className="text-xl font-bold text-white mb-4">{isCs ? "Všechny Plány" : "All Plans"}</Text>
      {data.plans.length === 0 ? (
        <Text className="text-slate-500 italic mb-6">{isCs ? "Uživatel nemá žádné plány." : "This user has no plans."}</Text>
      ) : (
        data.plans.map((p: any) => (
          <View key={p.id} className="bg-slate-800 rounded-2xl mb-4 border border-slate-700 overflow-hidden">
            <TouchableOpacity 
              onPress={() => setExpandedPlanId(expandedPlanId === p.id ? null : p.id)}
              className="p-4 flex-row justify-between items-center"
            >
              <View className="flex-1">
                <Text className="text-white font-bold text-lg">{p.name || p.title}</Text>
                <Text className="text-slate-400 text-xs">{p.plan_days?.length || 0} {isCs ? "tréninkové dny" : "workout days"}</Text>
              </View>
              <Text className="text-orange-500 font-bold">
                {expandedPlanId === p.id ? (isCs ? "Zavřít ▲" : "Close ▲") : isCs ? "Detail ▼" : "Details ▼"}
              </Text>
            </TouchableOpacity>

            {expandedPlanId === p.id && (
              <View className="bg-slate-900/50 p-4 border-t border-slate-700">
                {p.plan_days?.sort((a: any, b: any) => a.day_of_week - b.day_of_week).map((day: any) => (
                  <View key={day.id} className="mb-3">
                    <Text className="text-orange-400 font-bold mb-1">
                      {DAYS_NAMES_SHORT[day.day_of_week]} - {day.name || (isCs ? "Trénink" : "Workout")}
                    </Text>
                    {day.plan_exercises?.map((ex: any) => (
                      <Text key={ex.id} className="text-slate-300 text-sm ml-2">
                        • {ex.exercises?.name} ({ex.sets}x{ex.reps})
                      </Text>
                    ))}
                  </View>
                ))}
                <Pressable 
                  onPress={() => handleCopyPlan(p)} 
                  style={({ pressed }) => ({ 
                    backgroundColor: isCopying ? '#9a3412' : (pressed ? '#ea580c' : '#f97316'), 
                    padding: 14, 
                    borderRadius: 12, 
                    marginTop: 8, 
                    alignItems: 'center' 
                  })}
                >
                  <Text className="text-white font-bold">{isCs ? "📥 Kopírovat k sobě" : "📥 Copy to my plans"}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))
      )}

      {/* --- GRAFY VÁHY --- */}
      {data.weight && (
        <View className="mb-6">
          <Text className="text-xl font-bold text-white mt-4 mb-4">{isCs ? "Vývoj Váhy" : "Weight Progress"}</Text>
          <View className="rounded-xl overflow-hidden bg-slate-800/50 p-2 border border-slate-700">
            <LineChart 
              data={data.weight} 
              width={screenWidth - 48} 
              height={180} 
              chartConfig={{ 
                color: (op = 1) => `rgba(249, 115, 22, ${op})`, 
                backgroundGradientFrom: "#1e293b", 
                backgroundGradientTo: "#1e293b", 
                decimalPlaces: 1, 
                labelColor: (op = 1) => `rgba(255, 255, 255, ${op})` 
              }} 
              bezier 
            />
          </View>
        </View>
      )}

      {/* --- GRAFY VÝKONŮ --- */}
      <Text className="text-xl font-bold text-white mt-4 mb-4">{isCs ? "Výkony (1RM)" : "Performance (1RM)"}</Text>
      {data.graphs.map((g: any, i: number) => (
        <View key={i} className="mb-8 bg-slate-800/30 p-3 rounded-2xl border border-slate-700">
          <Text className="text-slate-200 font-bold mb-2 ml-1 text-lg">{g.name}</Text>
          <View className="rounded-xl overflow-hidden">
            <LineChart 
              data={g.chart} 
              width={screenWidth - 56} 
              height={150} 
              chartConfig={{ 
                color: (op = 1) => `rgba(34, 197, 94, ${op})`, 
                backgroundGradientFrom: "#1e293b", 
                backgroundGradientTo: "#1e293b", 
                decimalPlaces: 0, 
                labelColor: (op = 1) => `rgba(255, 255, 255, ${op})` 
              }} 
              bezier 
            />
          </View>
        </View>
      ))}
      <View className="h-10" />
    </ScrollView>
  );
}