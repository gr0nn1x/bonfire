import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { supabase } from "@/lib/supabase";

export type AppLanguage = "en" | "cs";

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

const STORAGE_KEY = "bonfire-language";

const LanguageContext = createContext<LanguageContextValue | null>(null);

async function readStoredLanguage() {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored === "cs" ? "cs" : "en";
}

async function writeStoredLanguage(language: AppLanguage) {
  await AsyncStorage.setItem(STORAGE_KEY, language);
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>("en");

  useEffect(() => {
    let isMounted = true;

    const syncLanguage = async () => {
      const storedLanguage = await readStoredLanguage();
      if (isMounted) {
        setLanguageState(storedLanguage);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .maybeSingle();

      if (!isMounted || error || !data?.language) return;

      const nextLanguage = data.language === "cs" ? "cs" : "en";
      setLanguageState(nextLanguage);
      await writeStoredLanguage(nextLanguage);
    };

    void syncLanguage();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!isMounted || error || !data?.language) return;

      const nextLanguage = data.language === "cs" ? "cs" : "en";
      setLanguageState(nextLanguage);
      await writeStoredLanguage(nextLanguage);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setLanguage = async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    await writeStoredLanguage(nextLanguage);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ language: nextLanguage })
      .eq("id", user.id);

    if (error) {
      console.warn("Failed to persist language to profile:", error.message);
    }
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }

  return context;
}
