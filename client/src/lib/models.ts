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
