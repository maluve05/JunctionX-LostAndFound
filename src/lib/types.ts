export interface CandidateItem {
  rank: number;
  name: string;
  lat: number;
  lon: number;
  radius_km: number;
  region: string;
  region_name: string;
  probability: number;
  anchor: string;
  evidence: string[];
  verified_by: string[];
}

export interface AnswerPoint {
  rank: number;
  lat: number;
  lon: number;
}

export interface TopLocation {
  name: string;
  region: string;
  region_name: string;
  probability: number;
  lat: number;
  lon: number;
  radius_km: number;
}

export interface RegionItem {
  code: string;
  name: string;
  probability: number;
}

export interface ClueItem {
  source: string;
  category: string;
  observation: string;
  raw_text?: string | null;
  view_id: string;
  implies: string[];
  confidence: number;
}

export interface QuizQuestion {
  text: string;
  options: string[];
  penalty_factor: number;
}

export interface GeolocationResult {
  image_id: string;
  urban: boolean;
  seconds: number;
  summary: string;
  answer: AnswerPoint[];
  top: TopLocation;
  countries: Record<string, number>;
  regions: RegionItem[];
  candidates: CandidateItem[];
  clues: ClueItem[];
  expected_score: number;
  low_confidence: boolean;
  question?: QuizQuestion | null;
}

export interface JobStatusResponse {
  job_id: string;
  filename: string;
  status: "queued" | "running" | "done" | "error";
  stage: string;
  stages_done: string[];
  elapsed_s: number;
  error?: string | null;
  result?: GeolocationResult | null;
}
