"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function DeleteButton({
  postId,
  deleteAction,
}: {
  postId: number;
  deleteAction: (postId: number) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this post?"
        message="This can't be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          startTransition(() => {
            void deleteAction(postId);
          });
        }}
      />
    </>
  );
}