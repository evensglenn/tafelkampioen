export type Operation = 'multiplication' | 'division';

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
  exerciseCount: 10 | 20 | 50 | 'all';
}

export interface SessionResult {
  id: string;
  playerName: string;
  correct: number;
  total: number;
  timestamp: number;
}

export interface MasteryData {
  [key: string]: number; // Format: "multiplication-5" or "division-5"
}
