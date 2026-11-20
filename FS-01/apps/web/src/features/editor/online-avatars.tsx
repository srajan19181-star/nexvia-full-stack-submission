import { UsersRound } from "lucide-react";
import type { OnlineMember } from "./use-collaboration";
import { initials } from "./editor-utils";

export function OnlineAvatars({ members }: { members: OnlineMember[] }) {
  const visible = members.slice(0, 4);
  if (members.length === 0) {
    return <span className="hidden items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass)] px-2.5 py-1.5 text-xs text-[var(--muted-foreground)] md:flex"><span className="size-1.5 rounded-full bg-[var(--success)] shadow-[0_0_10px_var(--success)]" /><UsersRound className="size-3.5" /> Just you</span>;
  }

  return (
    <div className="hidden items-center rounded-full border border-[var(--glass-border)] bg-[var(--glass)] py-1 pl-1 pr-2.5 md:flex" aria-label={`${members.length} online ${members.length === 1 ? "member" : "members"}`}>
      <div className="flex -space-x-2">
        {visible.map((member) => (
          <span
            key={member.id}
            title={`${member.name}${member.clientCount > 1 ? ` (${member.clientCount} devices)` : ""}`}
            className="grid size-7 place-items-center overflow-hidden rounded-full border-2 border-[var(--surface)] text-[9px] font-bold text-white shadow-[0_0_16px_-6px_currentColor]"
            style={{ backgroundColor: member.color }}
          >
            {member.avatarUrl ? <img src={member.avatarUrl} alt="" className="size-full object-cover" /> : initials(member.name)}
          </span>
        ))}
        {members.length > visible.length && <span className="grid size-7 place-items-center rounded-full border-2 border-[var(--surface)] bg-[var(--glass-strong)] text-[9px] font-semibold">+{members.length - visible.length}</span>}
      </div>
      <span className="ml-2 flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]"><span className="size-1.5 rounded-full bg-[var(--success)] shadow-[0_0_10px_var(--success)]" />{members.length} online</span>
    </div>
  );
}
