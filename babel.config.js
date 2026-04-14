module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Zde přidej plugin, pokud ho reanimated vyžaduje explicitně, 
      // i když v Expu 53/54 by měl být auto-included. Pro jistotu ho tam necháme.
      'react-native-reanimated/plugin',
    ],
  };
};