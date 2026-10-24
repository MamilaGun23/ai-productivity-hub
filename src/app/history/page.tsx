"use client";
import { Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Button, ConfirmDialog } from "@/components/ui";
import { RecentActivity } from "@/components/dashboard/recent-activity";
export default function HistoryPage() {
  const workspace = useWorkspace();
  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR WORK, WITHIN REACH</div>
          <h1>
            Workspace history<span className="accent">.</span>
          </h1>
          <p>Saved by you. Stored only in this browser.</p>
        </div>
        <ConfirmDialog
          title="Clear all saved history?"
          description="This removes saved AI outputs from this browser. Export anything you want to keep first."
          trigger={
            <Button variant="danger" disabled={!workspace.entries.length}>
              <Trash2 size={15} />
              Clear all
            </Button>
          }
          onConfirm={workspace.clear}
        />
      </div>
      <RecentActivity full />
    </div>
  );
}
