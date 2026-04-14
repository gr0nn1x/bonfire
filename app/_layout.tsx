import "../global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { LoadingScreen } from "@/components/loading-screen";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/query-client";

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#f8fafc",
          contentStyle: { backgroundColor: "#0f172a" },
        }}
      >
        <Stack.Screen
          name="(auth)"
          options={{ headerShown: false }}
          redirect={isAuthenticated}
        />
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
          redirect={!isAuthenticated}
        />
      </Stack>
    </QueryClientProvider>
  );
}
