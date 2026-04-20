import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

// 1. Koeficienty pro DOTS (Polynomická rovnice)
const DOTS_COEFFS = {
  male: {
    a: -0.000001093, b: 0.000739129, c: -0.191875922, d: 24.0900756, e: -307.75076
  },
  female: {
    a: -0.0000010706, b: 0.0005158568, c: -0.1126655495, d: 13.6175032, e: -57.96288
  }
};

// 2. Koeficienty pro IPF GL (Exponenciální rovnice pro RAW silový trojboj)
const IPF_GL_COEFFS = {
  male: { a: 1199.72839, b: 1025.18162, c: 0.00921 },
  female: { a: 610.32796, b: 1045.59282, c: 0.03048 }
};

export function DotsCalculator({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) {
  const [scoringSystem, setScoringSystem] = useState<'dots' | 'ipf'>('dots');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [bw, setBw] = useState('');
  const [total, setTotal] = useState('');

  const bodyweight = parseFloat(bw.replace(',', '.')) || 0;
  const liftedTotal = parseFloat(total.replace(',', '.')) || 0;

  let score = 0;

  if (bodyweight > 0 && liftedTotal > 0) {
    if (scoringSystem === 'dots') {
      // Výpočet DOTS
      const c = DOTS_COEFFS[gender];
      const denom = (c.a * Math.pow(bodyweight, 4)) + (c.b * Math.pow(bodyweight, 3)) + (c.c * Math.pow(bodyweight, 2)) + (c.d * bodyweight) + c.e;
      score = liftedTotal * (500 / denom);
    } else {
      // Výpočet IPF GL
      const c = IPF_GL_COEFFS[gender];
      const denom = c.a - (c.b * Math.exp(-c.c * bodyweight));
      score = liftedTotal * (100 / denom);
    }
  }

  return (
    <Modal visible={isVisible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-slate-900/90">
        <View className="bg-slate-800 rounded-t-[32px] border-t border-slate-700 p-6 pb-12 shadow-2xl">
          
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white text-xl font-bold">Bodová Kalkulačka 🏆</Text>
            <TouchableOpacity onPress={onClose} className="bg-slate-700 h-8 w-8 rounded-full items-center justify-center">
              <Text className="text-white font-bold mb-0.5">×</Text>
            </TouchableOpacity>
          </View>

          {/* Přepínač systému (DOTS vs IPF GL) */}
          <View className="flex-row mb-4 bg-slate-900 p-1 rounded-xl border border-slate-700">
            <TouchableOpacity onPress={() => setScoringSystem('dots')} className={`flex-1 p-2.5 rounded-lg ${scoringSystem === 'dots' ? 'bg-blue-600' : ''}`}>
              <Text className={`text-center font-bold ${scoringSystem === 'dots' ? 'text-white' : 'text-slate-400'}`}>DOTS</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setScoringSystem('ipf')} className={`flex-1 p-2.5 rounded-lg ${scoringSystem === 'ipf' ? 'bg-blue-600' : ''}`}>
              <Text className={`text-center font-bold ${scoringSystem === 'ipf' ? 'text-white' : 'text-slate-400'}`}>IPF GL</Text>
            </TouchableOpacity>
          </View>

          {/* Přepínač pohlaví */}
          <View className="flex-row mb-8 bg-slate-900 p-1 rounded-xl">
            <TouchableOpacity onPress={() => setGender('male')} className={`flex-1 p-3 rounded-lg ${gender === 'male' ? 'bg-orange-500' : ''}`}>
              <Text className={`text-center font-bold ${gender === 'male' ? 'text-white' : 'text-slate-400'}`}>Muž</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setGender('female')} className={`flex-1 p-3 rounded-lg ${gender === 'female' ? 'bg-orange-500' : ''}`}>
              <Text className={`text-center font-bold ${gender === 'female' ? 'text-white' : 'text-slate-400'}`}>Žena</Text>
            </TouchableOpacity>
          </View>

          {/* Vstupní pole */}
          <View className="flex-row gap-4 mb-8">
            <View className="flex-1">
              <Text className="text-slate-500 font-bold uppercase text-[10px] mb-2 ml-1">Váha těla (kg)</Text>
              <TextInput 
                keyboardType="numeric" 
                value={bw} 
                onChangeText={setBw} 
                placeholder="85" 
                placeholderTextColor="#475569" 
                className="bg-slate-900 text-white font-bold text-xl p-4 rounded-2xl border border-slate-700 text-center" 
              />
            </View>
            <View className="flex-1">
              <Text className="text-slate-500 font-bold uppercase text-[10px] mb-2 ml-1">Total (kg)</Text>
              <TextInput 
                keyboardType="numeric" 
                value={total} 
                onChangeText={setTotal} 
                placeholder="500" 
                placeholderTextColor="#475569" 
                className="bg-slate-900 text-white font-bold text-xl p-4 rounded-2xl border border-slate-700 text-center" 
              />
            </View>
          </View>

          {/* Zobrazení výsledku */}
          <View className="items-center bg-blue-500/10 p-6 rounded-[32px] border border-blue-500/30">
            <Text className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-1">
              Tvoje {scoringSystem === 'dots' ? 'DOTS' : 'IPF GL'} body
            </Text>
            <Text className="text-white font-black text-6xl tracking-tighter">
              {score > 0 ? score.toFixed(2) : '0.00'}
            </Text>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}