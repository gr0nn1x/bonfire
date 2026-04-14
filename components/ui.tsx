import type { PropsWithChildren } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";

interface InputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
}

export function Field({
  label,
  placeholder,
  value,
  onChangeText,
  multiline = false,
  keyboardType = "default",
  secureTextEntry = false,
  autoCapitalize = "none",
  autoCorrect = false,
}: InputProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-text">{label}</Text>
      <TextInput
        className={`rounded-2xl border border-border bg-surface px-4 py-3 text-text ${
          multiline ? "min-h-28" : ""
        }`}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

interface ToggleFieldProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleField({
  label,
  description,
  value,
  onValueChange,
}: ToggleFieldProps) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl border border-border bg-surface p-4">
      <View className="mr-4 flex-1">
        <Text className="text-base font-semibold text-text">{label}</Text>
        <Text className="mt-1 text-sm text-muted">{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

interface ButtonProps extends PropsWithChildren {
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

export function Button({
  onPress,
  variant = "primary",
  disabled = false,
  children,
}: ButtonProps) {
  const className =
    variant === "primary"
      ? "bg-primary"
      : "border border-border bg-surface";

  return (
    <Pressable
      className={`rounded-2xl px-4 py-4 ${className} ${
        disabled ? "opacity-60" : ""
      }`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        className={`text-center text-base font-semibold ${
          variant === "primary" ? "text-background" : "text-text"
        }`}
      >
        {children}
      </Text>
    </Pressable>
  );
}
