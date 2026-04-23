import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Platform, DeviceEventEmitter } from "react-native";
import { supabase } from "@/lib/supabase";
import { useRouter } from 'expo-router';
import { Search, Globe, Lock, Check } from 'lucide-react-native';
import { useLanguage } from "@/hooks/useLanguage";

import { EXERCISE_DATABASE, getLocalizedExerciseName, getLocalizedMuscleLabels } from '@/lib/muscleMap';

type BuilderExercise = {
  tempId: string;
  exercise_id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
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
  const router = useRouter(); 
  const { language } = useLanguage();
  const isCs = language === "cs";
  const muscleLabels = getLocalizedMuscleLabels(language);
  
  const [viewMode, setViewMode] = useState<'list' | 'builder'>('list');
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // BUILDER STAVY
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [builderDays, setBuilderDays] = useState<BuilderDay[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [targetDayIndex, setTargetDayIndex] = useState<number | null>(null);
  const [targetExIndex, setTargetExIndex] = useState<number | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setPlans(data);
    }
    setLoading(false);
  };

  useEffect(() => { 
    fetchPlans(); 
  }, [viewMode]);

  // NOVÉ: Funkce umí jak zvolit, tak zrušit zvolení plánu
  const handleToggleActive = async (planId: string, currentlyActive: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Nejprve pro jistotu vše odznačíme
    await supabase.from('workout_plans').update({ is_active: false }).eq('user_id', user.id);
    
    // Pokud na to klikáme, když to aktivní nebylo, tak to zapneme
    if (!currentlyActive) {
      await supabase.from('workout_plans').update({ is_active: true }).eq('id', planId);
    }
    
    // VYSLÁNÍ SIGNÁLU: Toto zachytí index.tsx a hned se updatne!
    DeviceEventEmitter.emit('planChanged');
    
    fetchPlans();
  };

  const togglePublicStatus = async (plan: any) => {
    try {
      if (plan.is_public) {
        await supabase.from('workout_plans').update({ is_public: false }).eq('id', plan.id);
        fetchPlans();
        if (Platform.OS === 'web') {
          window.alert(isCs ? "Skryto 🔒\nPlán už není v Tržišti viditelný." : "Hidden 🔒\nThe plan is no longer visible in the marketplace.");
        } else {
          Alert.alert(isCs ? "Skryto 🔒" : "Hidden 🔒", isCs ? "Plán už není v Tržišti viditelný." : "The plan is no longer visible in the marketplace.");
        }
        return;
      }

      if (!plan.description || plan.description.length < 10) {
        if (Platform.OS === 'web') {
          window.alert(isCs ? "Chybí popis\nAbys mohl plán sdílet, přidej mu přes tlačítko 'Upravit' smysluplný popis (alespoň 10 znaků)." : "Description missing\nTo share the plan, add a meaningful description with the Edit button (at least 10 characters).");
        } else {
          Alert.alert(isCs ? "Chybí popis" : "Description missing", isCs ? "Abys mohl plán sdílet, přidej mu přes tlačítko 'Upravit' smysluplný popis (alespoň 10 znaků)." : "To share the plan, add a meaningful description with the Edit button (at least 10 characters).");
        }
        return;
      }

      const { data: days, error } = await supabase
        .from('plan_days')
        .select('id, plan_exercises(id)')
        .eq('plan_id', plan.id);
      
      if (error) throw error;

      let totalExercises = 0;
      days?.forEach(d => { 
        totalExercises += d.plan_exercises?.length || 0; 
      });

      if (totalExercises < 5) {
        if (Platform.OS === 'web') {
          window.alert(isCs ? `Málo cviků\nTvůj plán má aktuálně jen ${totalExercises} cviků. Pro sdílení komunitě jich musí mít alespoň 5.` : `Not enough exercises\nYour plan currently has only ${totalExercises} exercises. It needs at least 5 to be shared.`);
        } else {
          Alert.alert(isCs ? "Málo cviků" : "Not enough exercises", isCs ? `Tvůj plán má aktuálně jen ${totalExercises} cviků. Pro sdílení komunitě jich musí mít alespoň 5.` : `Your plan currently has only ${totalExercises} exercises. It needs at least 5 to be shared.`);
        }
        return;
      }

      await supabase.from('workout_plans').update({ is_public: true }).eq('id', plan.id);
      fetchPlans();
      
      if (Platform.OS === 'web') {
        window.alert(isCs ? "Sdíleno! 🚀\nTvůj plán je nyní veřejně na Tržišti a může ho kdokoli vidět a použít." : "Shared! 🚀\nYour plan is now public in the marketplace and anyone can use it.");
      } else {
        Alert.alert(isCs ? "Sdíleno! 🚀" : "Shared! 🚀", isCs ? "Tvůj plán je nyní veřejně na Tržišti a může ho kdokoli vidět a použít." : "Your plan is now public in the marketplace and anyone can use it.");
      }
    } catch (e: any) {
      if (Platform.OS === 'web') {
        window.alert((isCs ? "Chyba: " : "Error: ") + e.message);
      } else {
        Alert.alert(isCs ? "Chyba" : "Error", e.message);
      }
    }
  };

  const handleDeletePlan = async (planId: string) => {
    const executeDeletion = async () => {
      try {
        const { error } = await supabase.from('workout_plans').delete().eq('id', planId);
        if (error) throw error;
        
        DeviceEventEmitter.emit('planChanged'); // Kdyby smazal zrovna aktivní plán
        fetchPlans();
      } catch (err: any) { 
        Alert.alert(isCs ? "Chyba" : "Error", err.message); 
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(isCs ? "Opravdu chceš smazat celou šablonu?" : "Do you really want to delete the whole template?")) {
        executeDeletion();
      }
    } else {
      Alert.alert(isCs ? "Smazat plán" : "Delete plan", isCs ? "Opravdu smazat celou šablonu?" : "Do you really want to delete the whole template?", [
        { text: isCs ? "Zrušit" : "Cancel", style: "cancel" },
        { text: isCs ? "Smazat" : "Delete", style: "destructive", onPress: executeDeletion }
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
      setPlanDescription(data.description || ""); 
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
          weight: ex.weight?.toString() || "",
          rpe: ex.rpe?.toString() || "", 
          percentage: ex.percentage?.toString() || "", 
          notes: ex.notes || ""
        })).sort((a: any, b: any) => a.sort_order - b.sort_order)
      }));

      setBuilderDays(loadedDays); 
      setViewMode('builder');
    } catch (e: any) { 
      Alert.alert(isCs ? "Chyba" : "Error", e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const addDay = () => {
    setBuilderDays([
      ...builderDays, 
      { tempId: Math.random().toString(), day_of_week: 1, name: "", exercises: [] }
    ]);
  };
  
  const addExercise = (dayIndex: number) => {
    const newDays = [...builderDays];
    newDays[dayIndex].exercises.push({ 
      tempId: Math.random().toString(), 
      exercise_id: "", 
      exercise_name: isCs ? "Vybrat cvik..." : "Choose exercise...", 
      sets: "", 
      reps: "", 
      weight: "", 
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
    if (!planName.trim()) {
      Alert.alert(isCs ? "Chyba" : "Error", isCs ? "Zadej název plánu." : "Enter a plan name.");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(isCs ? "Nejsi přihlášen" : "You are not signed in");

      let finalPlanId = editingPlanId;

      if (editingPlanId) {
        await supabase.from('workout_plans').update({ name: planName, description: planDescription }).eq('id', editingPlanId);
        await supabase.from('plan_days').delete().eq('plan_id', editingPlanId);
      } else {
        const { data: planData, error: planErr } = await supabase
          .from('workout_plans')
          .insert({ 
            user_id: user.id, 
            name: planName, 
            description: planDescription, 
            is_active: plans.length === 0 
          })
          .select()
          .single();
        
        if (planErr) throw planErr;
        finalPlanId = planData.id;
      }

      for (const day of builderDays) {
        const { data: dayData, error: dayErr } = await supabase
          .from('plan_days')
          .insert({ 
            plan_id: finalPlanId, 
            day_of_week: day.day_of_week, 
            name: day.name 
          })
          .select()
          .single();
        
        if (dayErr) throw dayErr;

        for (let i = 0; i < day.exercises.length; i++) {
          const ex = day.exercises[i];
          if (!ex.exercise_id) continue;
          
          await supabase.from('plan_exercises').insert({
            plan_day_id: dayData.id, 
            exercise_id: ex.exercise_id, 
            sets: parseInt(ex.sets) || 0, 
            reps: parseInt(ex.reps) || 0,
            weight: parseFloat(ex.weight) || 0, 
            rpe: parseFloat(ex.rpe) || null, 
            percentage: parseFloat(ex.percentage) || null,
            notes: ex.notes, 
            sort_order: i
          });
        }
      }

      DeviceEventEmitter.emit('planChanged'); // Aktualizuje index
      Alert.alert(isCs ? "Úspěch!" : "Success!", isCs ? "Plán uložen." : "Plan saved.");
      setPlanName(""); 
      setPlanDescription(""); 
      setBuilderDays([]); 
      setEditingPlanId(null); 
      setViewMode('list');
    } catch (e: any) { 
      Alert.alert(isCs ? "Chyba" : "Error", e.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const openExerciseSearch = (dayIdx: number, exIdx: number) => {
    setTargetDayIndex(dayIdx); 
    setTargetExIndex(exIdx); 
    setSearchQuery(""); 
    setIsSearchOpen(true);
  };

  const selectExercise = async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || targetDayIndex === null || targetExIndex === null) return;
    
    const trimmedName = name.trim();
    
    try {
      let { data: existing } = await supabase
        .from('exercises')
        .select('id, name')
        .ilike('name', trimmedName)
        .maybeSingle();
      
      let finalId = existing?.id;
      let finalName = existing?.name;

      if (!finalId) {
        const { data: newEx, error } = await supabase
          .from('exercises')
          .insert({ 
            name: trimmedName, 
            creator_id: user.id, 
            muscle_group: 'full_body' 
          })
          .select()
          .single();
        
        if (error) throw error;
        finalId = newEx.id;
        finalName = newEx.name;
      }

      if (finalId && finalName) {
        const newDays = [...builderDays];
        newDays[targetDayIndex].exercises[targetExIndex].exercise_id = finalId;
        newDays[targetDayIndex].exercises[targetExIndex].exercise_name = finalName;
        setBuilderDays(newDays);
      }
      
      setIsSearchOpen(false);
    } catch (e: any) { 
      Alert.alert(isCs ? "Chyba při ukládání cviku" : "Exercise save failed", e.message); 
    }
  };

  const filteredLocalExercises = EXERCISE_DATABASE.filter(ex => 
    getLocalizedExerciseName(ex, language).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // BUILDER MÓD ZŮSTÁVÁ STEJNÝ...
  if (viewMode === 'builder') {
    return (
      <View className="flex-1 bg-slate-900">
        <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          
          <View className="flex-row justify-between items-center mb-6 mt-2">
            <Text className="text-3xl font-bold text-white">
              {editingPlanId ? (isCs ? "Úprava" : "Edit plan") : isCs ? "Nový plán" : "New plan"}
            </Text>
            <TouchableOpacity 
              onPress={() => { 
                setViewMode('list'); 
                setEditingPlanId(null); 
                setPlanName(""); 
                setPlanDescription(""); 
                setBuilderDays([]); 
              }} 
              className="bg-slate-800 px-4 py-2 rounded-lg"
            >
              <Text className="text-slate-300 font-bold">{isCs ? "Zpět" : "Back"}</Text>
            </TouchableOpacity>
          </View>

          <TextInput 
            placeholder={isCs ? "Název plánu" : "Plan name"} 
            placeholderTextColor="#64748b" 
            value={planName} 
            onChangeText={setPlanName} 
            className="bg-slate-800 text-white p-4 rounded-xl text-lg font-bold mb-3 border border-slate-700" 
          />
          
          <TextInput 
            placeholder={isCs ? "Popis plánu (cil, délka trvání...)" : "Plan description (goal, duration...)"} 
            placeholderTextColor="#64748b" 
            value={planDescription} 
            onChangeText={setPlanDescription} 
            multiline 
            className="bg-slate-800 text-white p-4 rounded-xl mb-6 border border-slate-700 h-24 text-top" 
          />

          {builderDays.map((day, dIdx) => (
            <View key={day.tempId} className="bg-slate-800/80 p-4 rounded-xl mb-6 border border-slate-700">
              
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-white">{isCs ? "Den" : "Day"} {dIdx + 1}</Text>
                <TouchableOpacity onPress={() => setBuilderDays(builderDays.filter((_, i) => i !== dIdx))}>
                  <Text className="text-red-500 font-bold">{isCs ? "Smazat den" : "Delete day"}</Text>
                </TouchableOpacity>
              </View>

              <TextInput 
                placeholder={isCs ? "Název dne (např. Tahy)" : "Day name (e.g. Pull)"} 
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
                    <Text className={`font-bold ${day.day_of_week === i + 1 ? 'text-white' : 'text-slate-400'}`}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {day.exercises.map((ex, eIdx) => (
                <View key={ex.tempId} className="bg-slate-900 p-3 rounded-lg mb-3 border border-slate-700">
                  
                  <View className="flex-row justify-between items-center mb-3">
                    <TouchableOpacity 
                      onPress={() => openExerciseSearch(dIdx, eIdx)} 
                      className="flex-1 bg-slate-800 p-3 rounded-lg border border-slate-600 mr-2"
                    >
                      <Text className={ex.exercise_id ? "text-white font-bold" : "text-orange-400 font-bold"}>
                        {ex.exercise_name}
                      </Text>
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
                      <Text className="text-slate-500 text-[8px] uppercase font-bold mb-1 ml-1 text-center">{isCs ? "Série" : "Sets"}</Text>
                      
                      <TextInput 
                        placeholder="S" 
                        placeholderTextColor="#475569" 
                        keyboardType="numeric" 
                        value={ex.sets} 
                        onChangeText={(v) => updateExercise(dIdx, eIdx, 'sets', v)} 
                        className="bg-slate-800 text-white p-2 rounded-lg text-center border border-slate-700" 
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[8px] uppercase font-bold mb-1 ml-1 text-center">{isCs ? "Opak." : "Reps"}</Text>
                      <TextInput 
                        placeholder="O" 
                        placeholderTextColor="#475569" 
                        keyboardType="numeric" 
                        value={ex.reps} 
                        onChangeText={(v) => updateExercise(dIdx, eIdx, 'reps', v)} 
                        className="bg-slate-800 text-white p-2 rounded-lg text-center border border-slate-700" 
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-orange-400 text-[8px] uppercase font-bold mb-1 ml-1 text-center">{isCs ? "Váha" : "Weight"}</Text>
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
                      <TextInput 
                        placeholder="R" 
                        placeholderTextColor="#475569" 
                        keyboardType="numeric" 
                        value={ex.rpe} 
                        onChangeText={(v) => updateExercise(dIdx, eIdx, 'rpe', v)} 
                        className="bg-slate-800 text-white p-2 rounded-lg text-center border border-slate-700" 
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-500 text-[8px] uppercase font-bold mb-1 ml-1 text-center">%</Text>
                      <TextInput 
                        placeholder="%" 
                        placeholderTextColor="#475569" 
                        keyboardType="numeric" 
                        value={ex.percentage} 
                        onChangeText={(v) => updateExercise(dIdx, eIdx, 'percentage', v)} 
                        className="bg-slate-800 text-white p-2 rounded-lg text-center border border-slate-700" 
                      />
                    </View>
                  </View>

                  <TextInput 
                    placeholder={isCs ? "Instrukce k cviku (technika, tempo...)" : "Exercise instructions (technique, tempo...)"} 
                    placeholderTextColor="#475569" 
                    value={ex.notes} 
                    onChangeText={(v) => updateExercise(dIdx, eIdx, 'notes', v)} 
                    className="bg-slate-800 text-white p-3 rounded-lg border border-slate-700 text-sm" 
                  />
                </View>
              ))}

              <TouchableOpacity 
                onPress={() => addExercise(dIdx)} 
                className="bg-slate-700 py-3 rounded-lg items-center border border-slate-600 border-dashed mt-2"
              >
                <Text className="text-white font-bold">{isCs ? "+ Přidat cvik" : "+ Add exercise"}</Text>
              </TouchableOpacity>

            </View>
          ))}

          <TouchableOpacity 
            onPress={addDay} 
            className="bg-slate-800 py-4 rounded-xl items-center border-2 border-slate-700 border-dashed mb-8"
          >
            <Text className="text-orange-400 font-bold text-lg">{isCs ? "+ Přidat tréninkový den" : "+ Add workout day"}</Text>
          </TouchableOpacity>

        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900 border-t border-slate-800">
          <TouchableOpacity 
            onPress={handleSavePlan} 
            disabled={isSaving} 
            className={`py-4 rounded-xl items-center ${isSaving ? 'bg-orange-800' : 'bg-orange-500'}`}
          >
            <Text className="text-white font-bold text-xl">
              {isSaving ? (isCs ? "Ukládám..." : "Saving...") : isCs ? "Uložit celou šablonu" : "Save full template"}
            </Text>
          </TouchableOpacity>
        </View>

        <Modal visible={isSearchOpen} animationType="slide" transparent={true}>
          <View className="flex-1 bg-slate-900/95 justify-end pt-12">
            <View className="bg-slate-800 rounded-t-3xl border-t border-slate-700 flex-1 p-4 shadow-2xl">
              
              <View className="flex-row justify-between items-center mb-6 mt-2">
                <Text className="text-2xl font-bold text-white">{isCs ? "Vybrat cvik" : "Choose exercise"}</Text>
                <TouchableOpacity onPress={() => setIsSearchOpen(false)} className="bg-slate-700 p-2 px-4 rounded-lg">
                  <Text className="text-slate-300 font-bold">{isCs ? "Zavřít" : "Close"}</Text>
                </TouchableOpacity>
              </View>

              <TextInput 
                autoFocus 
                placeholder={isCs ? "Napiš název cviku..." : "Type an exercise name..."} 
                placeholderTextColor="#64748b" 
                value={searchQuery} 
                onChangeText={setSearchQuery} 
                className="bg-slate-900 text-white p-4 text-lg rounded-xl border border-slate-600 mb-4" 
              />
              
              <ScrollView keyboardShouldPersistTaps="handled">
                {filteredLocalExercises.length > 0 ? (
                  filteredLocalExercises.map(ex => (
                    <TouchableOpacity 
                      key={ex.id} 
                      onPress={() => selectExercise(getLocalizedExerciseName(ex, language))} 
                      className="bg-slate-900 p-4 rounded-xl border border-slate-700 mb-2 flex-row justify-between items-center"
                    >
                      <Text className="text-white font-bold text-lg">{getLocalizedExerciseName(ex, language)}</Text>
                      <Text className="text-slate-500 text-xs uppercase font-bold">{muscleLabels[ex.primary[0]]}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View className="p-8 items-center border border-slate-700 border-dashed rounded-2xl bg-slate-900/50">
                    <Text className="text-slate-400 italic text-center mb-2">{isCs ? "Tento cvik ještě neznáme." : "We don't know this exercise yet."}</Text>
                    <TouchableOpacity 
                      onPress={() => selectExercise(searchQuery)} 
                      className="bg-orange-500 px-6 py-3 rounded-xl mt-2"
                    >
                      <Text className="text-white font-bold">{isCs ? `Vytvořit "${searchQuery.trim()}"` : `Create "${searchQuery.trim()}"`}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

      </View>
    );
  }

  // -------------------------------------------------------------
  // RENDER: LIST MÓD
  // -------------------------------------------------------------
  return (
    <ScrollView className="flex-1 bg-slate-900 p-4">
      <Text className="text-3xl font-bold text-white mb-4 mt-2">{isCs ? "Moje Plány" : "My Plans"}</Text>

      <TouchableOpacity 
        activeOpacity={0.8} 
        onPress={() => router.push('/discover')} 
        className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex-row items-center justify-between shadow-sm mb-4"
      >
        <View className="flex-row items-center">
          <View className="bg-orange-500/20 p-3 rounded-xl mr-4 border border-orange-500/30">
            <Search size={22} color="#f97316" />
          </View>
          <View>
            <Text className="text-white font-bold text-lg">{isCs ? "Tržiště plánů" : "Plan marketplace"}</Text>
            <Text className="text-slate-400 text-xs">{isCs ? "Objev inspiraci od ostatních" : "Discover inspiration from others"}</Text>
          </View>
        </View>
        <Text className="text-orange-500 font-bold text-xl">→</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => { 
          setViewMode('builder'); 
          setEditingPlanId(null); 
          setPlanName(""); 
          setPlanDescription(""); 
          setBuilderDays([]); 
        }} 
        className="bg-orange-500 p-4 rounded-xl mb-8 items-center flex-row justify-center gap-2 shadow-lg"
      >
        <Text className="text-white font-bold text-lg">{isCs ? "Vytvořit nový plán" : "Create a new plan"}</Text>
      </TouchableOpacity>
      
      {plans.map((plan) => (
        <View 
          key={plan.id} 
          className={`p-4 rounded-xl mb-4 border ${plan.is_active ? 'bg-orange-500/10 border-orange-500' : 'bg-slate-800 border-slate-700'}`}
        >
          <View className="flex-row justify-between items-start mb-1">
            <Text className="text-xl font-bold text-white flex-1">{plan.name}</Text>
            
            <TouchableOpacity 
              onPress={() => togglePublicStatus(plan)} 
              className={`px-3 py-1.5 rounded-lg flex-row items-center ml-2 border ${plan.is_public ? 'bg-blue-900/30 border-blue-500/30' : 'bg-slate-700 border-slate-600'}`}
            >
              {plan.is_public ? <Globe size={14} color="#60a5fa" /> : <Lock size={14} color="#94a3b8" />}
              <Text className={`font-bold text-xs ml-1.5 ${plan.is_public ? 'text-blue-400' : 'text-slate-400'}`}>
                {plan.is_public ? (isCs ? 'Veřejný' : 'Public') : isCs ? 'Sdílet' : 'Share'}
              </Text>
            </TouchableOpacity>
          </View>

          {plan.description ? (
            <Text className="text-slate-400 text-xs mb-4" numberOfLines={2}>
              {plan.description}
            </Text>
          ) : (
            <View className="mb-4" />
          )}

          <View className="flex-row justify-between items-center">
            <View className="flex-row gap-2">
              <TouchableOpacity 
                className={`px-4 py-2 rounded-lg flex-row items-center ${plan.is_active ? 'bg-orange-500' : 'bg-slate-700'}`} 
                onPress={() => handleToggleActive(plan.id, plan.is_active)}
              >
                {plan.is_active && <Check size={16} color="white" style={{marginRight: 4}} />}
                <Text className="text-white font-semibold">
                  {plan.is_active ? (isCs ? "Aktivní" : "Active") : (isCs ? "Zvolit" : "Select")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                className="bg-slate-700 px-4 py-2 rounded-lg" 
                onPress={() => handleEditPlan(plan.id)}
              >
                <Text className="text-white font-semibold">{isCs ? "Upravit" : "Edit"}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => handleDeletePlan(plan.id)}>
              <Text className="text-red-500 font-bold">{isCs ? "Smazat" : "Delete"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}