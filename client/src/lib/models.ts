export interface Player {
  id: string;
  name: string;
  score: number;
  scoreDay: number;
  best: number;
  bad: number;
}

export interface Category {
  id: string;
  name: string;
  points: number;
}

export interface DaySession {
  currentSessionId: string | null;
  startedAt: string | null;
  isFinalized: boolean;
  finalizedAt: string | null;
}

export interface DayEvent {
  id: string;
  sessionId: string;
  playerId: string;
  categoryId: string;
  categoryName: string;
  points: number;
  count: number;
  totalPoints: number;
  createdAt: string | null;
}
