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
  multiplicationTables: number[];
  divisionTables: number[];
  exerciseCount: 10 | 20 | 50 | 'all';
}

export interface MasteryData {
  [key: string]: number; // Format: "multiplication-5" or "division-5"
}
