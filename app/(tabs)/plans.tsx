import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Pressable, Platform } from "react-native";
import { supabase } from "@/lib/supabase";

type BuilderExercise = {
  tempId: string;
  exercise_id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string; // PŘIDÁNO
  rpe: string;
  percentage: string;
  notes: string;
};

type BuilderDay = {
  tempId: string;
  day_of_week: number;
  name: string;
  exercises: BuilderExercise[];
};

const DAYS_OF_WEEK = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export default function PlansScreen() {
  const [viewMode, setViewMode] = useState<'list' | 'builder'>('list');
  
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // BUILDER STAVY
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState(""); // PŘIDÁNO
  const [builderDays, setBuilderDays] = useState<BuilderDay[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [targetDayIndex, setTargetDayIndex] = useState<number | null>(null);
  const [targetExIndex, setTargetExIndex] = useState<number | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('workout_plans').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (data) setPlans(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, [viewMode]);

  const handleSetActive = async (planId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('workout_plans').update({ is_active: false }).eq('user_id', user.id);
    await supabase.from('workout_plans').update({ is_active: true }).eq('id', planId);
    fetchPlans();
  };

  const handleDeletePlan = async (planId: string) => {
    const executeDeletion = async () => {
      try {
        const { error } = await supabase.from('workout_plans').delete().eq('id', planId);
        if (error) throw error;
        fetchPlans();
      } catch (err: any) { Alert.alert("Chyba", err.message); }
    };

    if (Platform.OS === 'web') {
      if (window.confirm("Opravdu chceš smazat celou šablonu?")) executeDeletion();
    } else {
      Alert.alert("Smazat plán", "Opravdu smazat celou šablonu?", [
        { text: "Zrušit", style: "cancel" },
        { text: "Smazat", style: "destructive", onPress: executeDeletion }
      ]);
    }
  };

  const handleEditPlan = async (planId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*, plan_days(*, plan_exercises(*, exercises(name)))')
        .eq('id', planId)
        .single();
      
      if (error) throw error;

      setPlanName(data.name);
      setPlanDescription(data.description || ""); // NAČTENÍ POPISU
      setEditingPlanId(data.id);

      const loadedDays: BuilderDay[] = data.plan_days.map((d: any) => ({
        tempId: Math.random().toString(),
        day_of_week: d.day_of_week,
        name: d.name || "",
        exercises: d.plan_exercises.map((ex: any) => ({
          tempId: Math.random().toString(),
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercises.name,
          sets: ex.sets?.toString() || "",
          reps: ex.reps?.toString() || "",
          weight: ex.weight?.toString() || "", // NAČTENÍ VÁHY
          rpe: ex.rpe?.toString() || "",
          percentage: ex.percentage?.toString() || "",
          notes: ex.notes || ""
        })).sort((a: any, b: any) => a.sort_order - b.sort_order)
      }));

      setBuilderDays(loadedDays);
      setViewMode('builder');
    } catch (e: any) {
      Alert.alert("Chyba", e.message);
    } finally {
      setLoading(false);
    }
  };

  const addDay = () => setBuilderDays([...builderDays, { tempId: Math.random().toString(), day_of_week: 1, name: "", exercises: [] }]);
  
  const addExercise = (dayIndex: number) => {
    const newDays = [...builderDays];
    newDays[dayIndex].exercises.push({ 
      tempId: Math.random().toString(), 
      exercise_id: "", 
      exercise_name: "Vybrat cvik...", 
      sets: "", 
      reps: "", 
      weight: "", // PŘIDÁNO
      rpe: "", 
      percentage: "", 
      notes: "" 
    });
    setBuilderDays(newDays);
  };

  const updateExercise = (dayIndex: number, exIndex: number, field: keyof BuilderExercise, value: string) => {
    const newDays = [...builderDays];
    newDays[dayIndex].exercises[exIndex][field] = value;
    setBuilderDays(newDays);
  };

  const handleSavePlan = async () => {
    if (!planName.trim()) return Alert.alert("Chyba", "Zadej název plánu.");
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nejsi přihlášen");

      let finalPlanId = editingPlanId;

      if (editingPlanId) {
        // UPDATE PLÁNU VČETNĚ DESCRIPTION
        await supabase.from('workout_plans').update({ name: planName, description: planDescription }).eq('id', editingPlanId);
        await supabase.from('plan_days').delete().eq('plan_id', editingPlanId);
      } else {
        // NOVÝ PLÁN
        const { data: planData, error: planErr } = await supabase.from('workout_plans').insert({ 
          user_id: user.id, 
          name: planName, 
          description: planDescription, // PŘIDÁNO
          is_active: plans.length === 0 
        }).select().single();
        if (planErr) throw planErr;
        finalPlanId = planData.id;
      }

      for (const day of builderDays) {
        const { data: dayData, error: dayErr } = await supabase
          .from('plan_days')
          .insert({ plan_id: finalPlanId, day_of_week: day.day_of_week, name: day.name })
          .select().single();
        if (dayErr) throw dayErr;

        for (let i = 0; i < day.exercises.length; i++) {
          const ex = day.exercises[i];
          if (!ex.exercise_id) continue;
          
          await supabase.from('plan_exercises').insert({
            plan_day_id: dayData.id,
            exercise_id: ex.exercise_id,
            sets: parseInt(ex.sets) || 0,
            reps: parseInt(ex.reps) || 0,
            weight: parseFloat(ex.weight) || 0, // UKLÁDÁNÍ VÁHY
            rpe: parseFloat(ex.rpe) || null,
            percentage: parseFloat(ex.percentage) || null,
            notes: ex.notes,
            sort_order: i
          });
        }
      }

      Alert.alert("Úspěch!", "Plán uložen.");
      setPlanName("");
      setPlanDescription("");
      setBuilderDays([]);
      setEditingPlanId(null);
      setViewMode('list');
    } catch (e: any) {
      Alert.alert("Chyba", e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openExerciseSearch = (dayIdx: number, exIdx: number) => {
    setTargetDayIndex(dayIdx); setTargetExIndex(exIdx); setSearchQuery(""); setSearchResults([]); setIsSearchOpen(true);
  };
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length > 0) {
      const { data } = await supabase.from('exercises').select('id, name').ilike('name', `%${text}%`).limit(15);
      if (data) setSearchResults(data);
    } else { setSearchResults([]); }
  };
  const selectExercise = (id: string, name: string) => {
    if (targetDayIndex !== null && targetExIndex !== null) {
      const newDays = [...builderDays];
      newDays[targetDayIndex].exercises[targetExIndex].exercise_id = id;
      newDays[targetDayIndex].exercises[targetExIndex].exercise_name = name;
      setBuilderDays(newDays);
    }
    setIsSearchOpen(false);
  };

  const createAndSelectExercise = async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const trimmedName = name.trim();
    try {
      let { data: existing } = await supabase.from('exercises').select('id, name').ilike('name', trimmedName).maybeSingle();
      if (existing) return selectExercise(existing.id, existing.name);

      const { data: newEx, error } = await supabase.from('exercises').insert({ name: trimmedName, creator_id: user.id, muscle_group: 'full_body' }).select().single();
      if (error) throw error;
      selectExercise(newEx.id, newEx.name);
    } catch (e: any) { Alert.alert("Chyba", e.message); }
  };

  if (viewMode === 'builder') {
    return (
      <View className="flex-1 bg-slate-900">
        <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <View className="flex-row justify-between items-center mb-6 mt-2">
            <Text className="text-3xl font-bold text-white">{editingPlanId ? "Úprava" : "Nový plán"}</Text>
            <TouchableOpacity onPress={() => { setViewMode('list'); setEditingPlanId(null); setPlanName(""); setPlanDescription(""); setBuilderDays([]); }} className="bg-slate-800 px-4 py-2 rounded-lg">
              <Text className="text-slate-300 font-bold">Zpět</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            placeholder="Název plánu"
            placeholderTextColor="#64748b"
            value={planName}
            onChangeText={setPlanName}
            className="bg-slate-800 text-white p-4 rounded-xl text-lg font-bold mb-3 border border-slate-700"
          />

          <TextInput
            placeholder="Popis plánu (cil, délka trvání...)"
            placeholderTextColor="#64748b"
            value={planDescription}
            onChangeText={setPlanDescription}
            multiline
            className="bg-slate-800 text-white p-4 rounded-xl mb-6 border border-slate-700 h-24 text-top"
          />

          {builderDays.map((day, dIdx) => (
            <View key={day.tempId} className="bg-slate-800/80 p-4 rounded-xl mb-6 border border-slate-700">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-white">Den {dIdx + 1}</Text>
                <TouchableOpacity onPress={() => setBuilderDays(builderDays.filter((_, i) => i !== dIdx))}>
                  <Text className="text-red-500 font-bold">Smazat den</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                placeholder="Název dne (např. Tahy)"
                placeholderTextColor="#64748b"
                value={day.name}
                onChangeText={(val) => {
                  const newDays = [...builderDays];
                  newDays[dIdx].name = val;
                  setBuilderDays(newDays);
                }}
                className="bg-slate-900 text-white p-3 rounded-lg border border-slate-600 mb-4"
              />

              <View className="flex-row justify-between mb-6">
                {DAYS_OF_WEEK.map((d, i) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => {
                      const newDays = [...builderDays];
                      newDays[dIdx].day_of_week = i + 1;
                      setBuilderDays(newDays);
                    }}
                    className={`w-10 h-10 items-center justify-center rounded-full ${day.day_of_week === i + 1 ? 'bg-orange-500' : 'bg-slate-900 border border-slate-700'}`}
                  >
                    <Text className={`font-bold ${day.day_of_week === i + 1 ? 'text-white' : 'text-slate-400'}`}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {day.exercises.map((ex, eIdx) => (
                <View key={ex.tempId} className="bg-slate-900 p-3 rounded-lg mb-3 border border-slate-700">
                  <View className="flex-row justify-between items-center mb-3">
                    <TouchableOpacity onPress={() => openExerciseSearch(dIdx, eIdx)} className="flex-1 bg-slate-800 p-3 rounded-lg border border-slate-600 mr-2">
                      <Text className={ex.exercise_id ? "text-white font-bold" : "text-orange-400 font-bold"}>{ex.exercise_name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      const newDays = [...builderDays];
                      newDays[dIdx].exercises = newDays[dIdx].exercises.filter((_, i) => i !== eIdx);
                      setBuilderDays(newDays);
                    }}>
                      <Text className="text-red-500 text-xl font-bold px-2">×</Text>
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row gap-1.5 mb-2">
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[8px] uppercase font-bold mb-1 ml-1 text-center">Série</Text>
                      <TextInput placeholder="S" placeholderTextColor="#475569" keyboardType="numeric" value={ex.sets} onChangeText={(v) => updateExercise(dIdx, eIdx, 'sets', v)} className="bg-slate-800 text-white p-2 rounded-lg text-center border border-slate-700" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[8px] uppercase font-bold mb-1 ml-1 text-center">Opak.</Text>
                      <TextInput placeholder="O" placeholderTextColor="#475569" keyboardType="numeric" value={ex.reps} onChangeText={(v) => updateExercise(dIdx, eIdx, 'reps', v)} className="bg-slate-800 text-white p-2 rounded-lg text-center border border-slate-700" />
                    </View>
                    {/* NOVÁ KOLONKA VÁHA */}
                    <View className="flex-1">
  <Text className="text-orange-400 text-[8px] uppercase font-bold mb-1 ml-1 text-center">Váha</Text>
  <TextInput 
    placeholder="Kg" 
    placeholderTextColor="#475569" 
    keyboardType="numeric" 
    value={ex.weight} 
    onChangeText={(v) => updateExercise(dIdx, eIdx, 'weight', v)} 
    className="bg-slate-800 text-white p-2 rounded-lg text-center border border-orange-500/20" 
  />
</View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[8px] uppercase font-bold mb-1 ml-1 text-center">RPE</Text>
                      <TextInput placeholder="R" placeholderTextColor="#475569" keyboardType="numeric" value={ex.rpe} onChangeText={(v) => updateExercise(dIdx, eIdx, 'rpe', v)} className="bg-slate-800 text-white p-2 rounded-lg text-center border border-slate-700" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[8px] uppercase font-bold mb-1 ml-1 text-center">%</Text>
                      <TextInput placeholder="%" placeholderTextColor="#475569" keyboardType="numeric" value={ex.percentage} onChangeText={(v) => updateExercise(dIdx, eIdx, 'percentage', v)} className="bg-slate-800 text-white p-2 rounded-lg text-center border border-slate-700" />
                    </View>
                  </View>

                  <TextInput 
                    placeholder="Instrukce k cviku (technika, tempo...)" 
                    placeholderTextColor="#475569" 
                    value={ex.notes} 
                    onChangeText={(v) => updateExercise(dIdx, eIdx, 'notes', v)} 
                    className="bg-slate-800 text-white p-3 rounded-lg border border-slate-700 text-sm" 
                  />
                </View>
              ))}

              <TouchableOpacity onPress={() => addExercise(dIdx)} className="bg-slate-700 py-3 rounded-lg items-center border border-slate-600 border-dashed mt-2">
                <Text className="text-white font-bold">+ Přidat cvik</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity onPress={addDay} className="bg-slate-800 py-4 rounded-xl items-center border-2 border-slate-700 border-dashed mb-8">
            <Text className="text-orange-400 font-bold text-lg">+ Přidat tréninkový den</Text>
          </TouchableOpacity>
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800">
          <TouchableOpacity onPress={handleSavePlan} disabled={isSaving} className={`py-4 rounded-xl items-center ${isSaving ? 'bg-orange-800' : 'bg-orange-500'}`}>
            <Text className="text-white font-bold text-xl">{isSaving ? "Ukládám..." : "Uložit celou šablonu"}</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={isSearchOpen} animationType="slide" transparent={true}>
          <View className="flex-1 bg-slate-900/95 justify-center p-4 pt-12">
            <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-1 mb-8">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-white">Hledat cvik</Text>
                <TouchableOpacity onPress={() => setIsSearchOpen(false)}><Text className="text-red-500 font-bold">Zavřít</Text></TouchableOpacity>
              </View>
              <TextInput autoFocus placeholder="Název..." placeholderTextColor="#64748b" value={searchQuery} onChangeText={handleSearch} className="bg-slate-900 text-white p-4 rounded-lg border border-slate-600 mb-4" />
              <ScrollView keyboardShouldPersistTaps="handled">
                {searchResults.map(ex => (
                  <TouchableOpacity key={ex.id} onPress={() => selectExercise(ex.id, ex.name)} className="bg-slate-700 p-4 rounded-lg mb-2"><Text className="text-white font-bold">{ex.name}</Text></TouchableOpacity>
                ))}
                {searchQuery.length > 0 && !searchResults.some(ex => ex.name.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                  <TouchableOpacity onPress={() => createAndSelectExercise(searchQuery)} className="bg-orange-500 p-4 rounded-lg mt-2"><Text className="text-white font-bold">Vytvořit "{searchQuery.trim()}"</Text></TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-900 p-4">
      <Text className="text-3xl font-bold text-white mb-6 mt-2">Moje Plány</Text>
      <TouchableOpacity onPress={() => { setViewMode('builder'); setEditingPlanId(null); setPlanName(""); setPlanDescription(""); setBuilderDays([]); }} className="bg-orange-500 p-4 rounded-xl mb-8 items-center flex-row justify-center gap-2 shadow-lg">
        <Text className="text-white font-bold text-lg">Vytvořit nový plán</Text>
      </TouchableOpacity>
      {plans.map((plan) => (
        <View key={plan.id} className={`p-4 rounded-xl mb-4 border ${plan.is_active ? 'bg-orange-500/10 border-orange-500' : 'bg-slate-800 border-slate-700'}`}>
          <Text className="text-xl font-bold text-white mb-1">{plan.name}</Text>
          {plan.description ? <Text className="text-slate-400 text-xs mb-4" numberOfLines={2}>{plan.description}</Text> : null}
          <View className="flex-row justify-between items-center">
            <View className="flex-row gap-2">
              {!plan.is_active && <TouchableOpacity className="bg-slate-700 px-4 py-2 rounded-lg" onPress={() => handleSetActive(plan.id)}><Text className="text-white font-semibold">Zvolit</Text></TouchableOpacity>}
              <TouchableOpacity className="bg-slate-700 px-4 py-2 rounded-lg" onPress={() => handleEditPlan(plan.id)}><Text className="text-white font-semibold">Upravit</Text></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => handleDeletePlan(plan.id)}><Text className="text-red-500 font-bold">Smazat</Text></TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}