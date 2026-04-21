import AsyncStorage from "@react-native-async-storage/async-storage";

import type { AppLanguage } from "@/hooks/useLanguage";

const STORAGE_KEY = "bonfire-language";

export async function getStoredLanguage(): Promise<AppLanguage> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored === "cs" ? "cs" : "en";
}

export async function tByLanguage<T>(messages: { en: T; cs: T }) {
  const language = await getStoredLanguage();
  return language === "cs" ? messages.cs : messages.en;
}
