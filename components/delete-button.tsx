"use client";

import { useTransition } from "react";

export function DeleteButton({
  postId,
  deleteAction,
}: {
  postId: number;
  deleteAction: (postId: number) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (confirm("Are you sure you want to delete this post?")) {
          startTransition(() => {
            deleteAction(postId);
          });
        }
      }}
      disabled={isPending}
      className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
    >
      {isPending ? "Deleting..." : "Delete"}
    </button>
  );
}