import "../global.css"; // ZÁSADNÍ ŘÁDEK PRO DESIGN!
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LoadingScreen } from "@/components/loading-screen";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/query-client";

export default function RootLayout() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      {/* Tady MUSÍ být Stack, nikoliv Tabs! */}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#f8fafc",
          contentStyle: { backgroundColor: "#0f172a" },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="friend/[id]" options={{ title: "Profil" }} />
      </Stack>
    </QueryClientProvider>
  );
}