export type Profile = {
  id: string;
  name: string;
  role: string;
  city: string;
  answers: number[];
  discoverable: number;
  created: number;
};
export type Run = {
  id: string;
  user: string;
  task: string;
  day: string;
  status: "active" | "completed" | "cancelled";
  started: number;
  deadline: number;
  completed: number | null;
  note: string;
  place: string;
  invitation: string;
  location: string | null;
  partner: string | null;
  match_id: string | null;
};
export type Media = { id: string; run: string; type: string; size: number };
export type Offer = {
  id: string;
  task: string;
  started: number;
  name: string;
  role: string;
  city: string;
  place: string;
};
export type GameState = {
  communityXp: number;
  profile: Profile | null;
  runs: Run[];
  media: Media[];
  favorites: string[];
  offers: Offer[];
  encounters: {
    name: string;
    role: string;
    city: string;
    task: string;
    completed: number;
  }[];
  event: { id: string; started: number; completed: number | null } | null;
  participants: number;
  now: number;
};
