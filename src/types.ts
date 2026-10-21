export type Operation = 'multiplication' | 'division';
export type ThemePreference = 'light' | 'dark' | 'auto';

export interface Exercise {
  a: number;
  b: number;
  op: Operation;
  result: number;
  display?: string;
  isChallenge?: boolean;
}

export interface UserSettings {
  playerName: string;
  multiplicationTables: number[];
  divisionTables: number[];
  exerciseCount: 10 | 20 | 50 | 100 | 'all';
  personalBest?: number; // Lowest average time per sum in ms
  trackTime?: boolean; // Whether to track time and enforce countdown timer
  theme?: ThemePreference; // Light/dark mode preference, defaults to 'auto'
}

export interface HistoryItem {
  exercise: Exercise;
  correct: boolean;
  givenAnswer?: number | null; // Ontbreekt bij oudere sessies; null = geen antwoord
}

export interface SessionResult {
  id: string;
  playerName: string;
  correct: number;
  total: number;
  timestamp: number;
  duration?: number; // Total time in ms
  averageTimePerSum?: number; // Average time in ms
  trackTime?: boolean; // Whether time tracking was active for this session
  multiplicationTables: number[];
  divisionTables: number[];
  history: HistoryItem[];
}
