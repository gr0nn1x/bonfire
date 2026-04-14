// lib/plates.ts

export const AVAILABLE_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export function calculatePlates(targetWeight: number, barWeight: number = 20) {
  if (targetWeight <= barWeight) return [];

  let weightOnOneSide = (targetWeight - barWeight) / 2;
  const result: number[] = [];

  for (const plate of AVAILABLE_PLATES) {
    while (weightOnOneSide >= plate) {
      result.push(plate);
      weightOnOneSide -= plate;
    }
  }

  return result; // Vrátí pole kotoučů, např. [20, 10, 5]
}