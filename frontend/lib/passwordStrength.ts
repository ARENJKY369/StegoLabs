export interface Strength {
  /** 0..4 → Weak, Fair, Good, Strong, Excellent */
  score: number;
  label: "Weak" | "Fair" | "Good" | "Strong" | "Excellent";
}

const LABELS: Strength["label"][] = [
  "Weak",
  "Fair",
  "Good",
  "Strong",
  "Excellent",
];

/**
 * Pragmatic strength estimate: length carries the most weight (it is the
 * only thing PBKDF2 cannot compensate for), variety and non-repetition
 * add the rest. No network calls, no dictionaries shipped to the client.
 */
export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: LABELS[0] };

  let points = 0;
  const len = password.length;

  if (len >= 8) points += 1;
  if (len >= 12) points += 1;
  if (len >= 20) points += 1;

  const variety =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  if (variety >= 2) points += 1;
  if (variety >= 3) points += 1;

  // Penalties: all one character class repeated, or very short.
  if (/^(.)\1+$/.test(password)) points = 0;
  if (len < 6) points = Math.min(points, 1);

  const score = Math.max(0, Math.min(4, points - 1));
  return { score, label: LABELS[score] };
}
