import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SectionCard } from "@/components/section-card";
import { Button, Field } from "@/components/ui";
import { signIn, signUpAndSignIn } from "@/lib/auth";

type FeedbackState = {
  type: "error" | "info";
  message: string;
} | null;

export default function SignInScreen() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const isSignUp = mode === "sign-up";

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      setFeedback({
        type: "error",
        message: "Vypln uzivatelske jmeno i heslo.",
      });
      return;
    }

    if (isSignUp && !email.trim()) {
      setFeedback({
        type: "error",
        message: "Vypln email.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      if (isSignUp) {
        await signUpAndSignIn({
          username: username.trim(),
          password: password.trim(),
          email: email.trim(),
        });
      } else {
        await signIn({
          username: username.trim(),
          password: password.trim(),
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo se dokoncit auth.";
      setFeedback({
        type: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View className="gap-3">
        <View className="self-start rounded-full border border-border bg-card px-3 py-1">
          <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
            Bonfire Fitness
          </Text>
        </View>
        <Text className="text-4xl font-bold text-text">
          {isSignUp ? "Vytvor si ucet" : "Vitej zpet"}
        </Text>
        <Text className="text-base leading-6 text-muted">
          {isSignUp
            ? "Par udaju a muzeme jit na trenink."
            : "Prihlas se a pokracuj tam, kde jsi skoncil."}
        </Text>
      </View>

      <SectionCard title={isSignUp ? "Registrace" : "Prihlaseni"}>
        {feedback ? (
          <View
            className={`rounded-2xl border px-4 py-3 ${
              feedback.type === "error"
                ? "border-rose-500/40 bg-rose-500/10"
                : "border-emerald-500/40 bg-emerald-500/10"
            }`}
          >
            <Text
              className={`text-sm ${
                feedback.type === "error" ? "text-red-200" : "text-emerald-200"
              }`}
            >
              {feedback.message}
            </Text>
          </View>
        ) : null}
        {isSignUp ? (
          <Field
            label="Email"
            placeholder="ty@bonfire.app"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
        ) : null}
        <Field
          label="Uzivatelske jmeno"
          placeholder="napr. pavelbench"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <Field
          label="Heslo"
          placeholder="Minimalne 6 znaku"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Button onPress={() => void handleSubmit()} disabled={isSubmitting}>
          {isSubmitting
            ? "Pracuji..."
            : isSignUp
              ? "Vytvorit ucet"
              : "Prihlasit se"}
        </Button>
        <Pressable
          onPress={() => {
            setMode(isSignUp ? "sign-in" : "sign-up");
            setFeedback(null);
            setEmail("");
          }}
        >
          <Text className="text-center text-sm text-primary">
            {isSignUp
              ? "Uz mas ucet? Prepnout na prihlaseni."
              : "Jsi novy? Prepnout na registraci."}
          </Text>
        </Pressable>
      </SectionCard>
    </ScreenContainer>
  );
}
