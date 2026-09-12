export type TaskStatus = "draft" | "open" | "closed" | "finished" | "cancelled";
export type ParticipationStatus =
  | "joined"
  | "submitted"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "expired"
  | "cancelled";
export type CommunityTask = {
  id: string;
  owner: string;
  owner_name: string;
  title: string;
  description: string;
  requirements: string;
  category: string;
  city: string;
  place: string;
  deadline: number;
  capacity: number;
  reward: number;
  status: TaskStatus;
  created: number;
  updated: number;
  cancel_reason: string;
  joined_count: number;
  approved_count: number;
  pending_count: number;
  my_id: string | null;
  my_status: ParticipationStatus | null;
};
export type Participation = {
  id: string;
  task: string;
  user: string;
  name: string;
  status: ParticipationStatus;
  note: string;
  feedback: string;
  joined: number;
  submitted: number | null;
  reviewed: number | null;
};
export type TaskDetail = {
  task: CommunityTask;
  participations: Participation[];
  history: { id: string; action: string; detail: string; created: number }[];
  attachments: { id: string; run: string; type: string; size: number }[];
};
export type CommunityState = {
  user: {
    id: string;
    name: string;
    city: string;
    role: string;
    username: string;
  };
  tasks: CommunityTask[];
  xp: number;
  stats: {
    joined: number;
    approved: number;
    published: number;
    pending: number;
  };
  now: number;
};
