"use client";

import { useEffect, useState } from "react";
import {
  acceptProjectInvitation,
  declineProjectInvitation,
  listMyInvitations,
} from "@/lib/projects";
import { errorMessage } from "@/lib/api";
import type { Project, ProjectInvitation } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  ErrorBanner,
  VisibilityBadge,
} from "@/components/ui/primitives";
import { relativeTime } from "@/components/activity/ActivityFeed";

/**
 * 내가 받은 수락 대기 초대
 */
export function ProjectInvitations({ onAccepted }: { onAccepted: (project: Project) => void }) {
  const { loading: authLoading } = useAuth();
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    listMyInvitations()
      .then((list) => {
        if (!cancelled) setInvitations(list);
      })
      .catch(() => {
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading]);

  async function respond(invitation: ProjectInvitation, accept: boolean) {
    setBusyId(invitation.project_id);
    setError(null);
    try {
      if (accept) {
        onAccepted(await acceptProjectInvitation(String(invitation.project_id)));
      } else {
        await declineProjectInvitation(String(invitation.project_id));
      }
      setInvitations((prev) => prev.filter((i) => i.project_id !== invitation.project_id));
    } catch (e) {
      setError(errorMessage(e, accept ? "초대 수락에 실패했습니다." : "초대 거절에 실패했습니다."));
    } finally {
      setBusyId(null);
    }
  }

  if (invitations.length === 0) return null;

  return (
    <Card className="shrink-0">
      <CardHeader>
        <CardTitle>받은 초대</CardTitle>
        <span className="tnum text-xs text-ink-muted">{invitations.length}건</span>
      </CardHeader>
      <ul className="divide-y divide-border">
        {invitations.map((invitation) => (
          <li
            key={invitation.project_id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-ink">
                  {invitation.project_name}
                </span>
                <VisibilityBadge visibility={invitation.visibility} />
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-muted">
                {invitation.invited_by_name || invitation.invited_by_email || "알 수 없는 사용자"}
                님의 초대 · {relativeTime(invitation.invited_at)}
                {invitation.project_description ? ` · ${invitation.project_description}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                onClick={() => respond(invitation, false)}
                disabled={busyId === invitation.project_id}
              >
                거절
              </Button>
              <Button
                variant="dark"
                onClick={() => respond(invitation, true)}
                disabled={busyId === invitation.project_id}
              >
                {busyId === invitation.project_id ? "처리 중…" : "수락"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <div className="px-5 pb-4">
          <ErrorBanner message={error} />
        </div>
      )}
    </Card>
  );
}
