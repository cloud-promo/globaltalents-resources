import "server-only";
import { one } from "./db";
import { canRetake, type Scores } from "./personality";

export type PersonalityResult = { id: string; scores: Scores; profile: string; created_at: string };

export async function latestPersonality(userId: string) {
  return one<PersonalityResult>(
    `SELECT id,scores,profile,created_at FROM personality_results WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
}

export async function retakeStatus(userId: string) {
  const r = await one<{ first: string | null; last: string | null; n: number }>(
    `SELECT min(created_at) first, max(created_at) last, count(*)::int n FROM personality_results WHERE user_id=$1`,
    [userId],
  );
  const st = canRetake(r?.first ? new Date(r.first) : null, r?.last ? new Date(r.last) : null);
  return { ...st, count: r?.n ?? 0 };
}
