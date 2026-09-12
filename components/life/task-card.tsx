/* Native links also support the standalone SPA runtime. */
"use client";
import { MapPin, Clock, ArrowUpRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { CommunityTask } from "@/lib/community-types";
import { categories, statusNames, date } from "@/lib/community-client";
export default function TaskCard({
  task,
  onClick,
}: {
  task: CommunityTask;
  onClick: () => void;
}) {
  const full = task.joined_count >= task.capacity;
  return (
    <button
      className={"np-task-card cat-" + categories.indexOf(task.category)}
      onClick={onClick}
    >
      <div className="np-card-top">
        <span className="np-category">{task.category}</span>
        <span className={"np-tag " + (task.my_status || task.status)}>
          {task.my_status
            ? statusNames[task.my_status]
            : task.status === "open" && full
              ? "名额已满"
              : statusNames[task.status]}
        </span>
      </div>
      <h3>{task.title}</h3>
      <p>{task.description}</p>
      <div className="np-card-meta">
        <span>
          <MapPin size={15} />
          {task.city} · {task.place}
        </span>
        <span>
          <Clock size={15} />
          {date(task.deadline)} 截止
        </span>
      </div>
      <div className="np-card-progress">
        <Progress
          value={Math.min(100, (task.joined_count / task.capacity) * 100)}
        />
        <span>
          {task.joined_count}/{task.capacity} 人
        </span>
      </div>
      <div className="np-card-bottom">
        <span className="np-owner">
          <i>{task.owner_name.slice(0, 1)}</i>
          {task.owner_name}
        </span>
        <strong>
          +{task.reward} XP <ArrowUpRight size={16} />
        </strong>
      </div>
    </button>
  );
}
