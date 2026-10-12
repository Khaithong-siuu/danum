"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/sheet";
import { ReportSheet } from "@/components/report-sheet";
import { timeAgo } from "@/lib/time";
import {
  COMMENT_IMAGE_MAX_BYTES,
  COMMENT_IMAGE_TYPES,
  COMMENT_MAX,
  type AddResult,
  type CommentData,
} from "@/lib/comments";

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function CommentRow({
  c,
  size,
  onReply,
  onLike,
  onDelete,
  onReport,
}: {
  c: CommentData;
  size: number;
  onReply: (c: CommentData) => void;
  onLike: (c: CommentData) => void;
  onDelete: (c: CommentData) => void;
  onReport: (c: CommentData) => void;
}) {
  return (
    <div className="flex gap-3 py-2">
      {c.author?.avatarUrl ? (
        <Image
          src={c.author.avatarUrl}
          alt=""
          width={size}
          height={size}
          className="shrink-0 rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="shrink-0 rounded-full bg-foreground/10"
          style={{ width: size, height: size }}
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm">
          {c.author ? (
            <Link
              href={`/u/${c.author.username}`}
              className="mr-2 font-semibold hover:underline"
            >
              {c.author.username}
            </Link>
          ) : (
            <span className="mr-2 font-semibold">Deleted user</span>
          )}
          <span className="whitespace-pre-wrap break-words">{c.content}</span>
        </p>

        {c.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.imageUrl}
            alt="Comment attachment"
            loading="lazy"
            className="mt-2 max-h-56 rounded-xl object-cover"
          />
        )}

        <div className="mt-1 flex items-center gap-4 text-xs text-foreground/50">
          <span>{timeAgo(c.createdAt)}</span>
          <button type="button" onClick={() => onReply(c)} className="font-medium">
            Reply
          </button>
          {c.canDelete && (
            <button
              type="button"
              onClick={() => onDelete(c)}
              className="font-medium text-red-500"
            >
              Delete
            </button>
          )}
          {!c.mine && (
            <button
              type="button"
              onClick={() => onReport(c)}
              className="font-medium"
            >
              Report
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onLike(c)}
        aria-label={c.liked ? "Unlike comment" : "Like comment"}
        className={`flex shrink-0 flex-col items-center self-start pt-1 text-xs ${
          c.liked ? "text-red-500" : "text-foreground/50"
        }`}
      >
        <Heart filled={c.liked} />
        <span>{c.likeCount > 0 ? c.likeCount : ""}</span>
      </button>
    </div>
  );
}

export function CommentsSheet({
  postId,
  userId,
  onClose,
  onCountChange,
  getComments,
  addComment,
  toggleCommentLike,
  deleteComment,
}: {
  postId: number;
  userId: string;
  onClose: () => void;
  onCountChange: (delta: number) => void;
  getComments: (postId: number) => Promise<CommentData[]>;
  addComment: (input: {
    postId: number;
    parentId: number | null;
    content: string;
    imagePath: string | null;
  }) => Promise<AddResult>;
  toggleCommentLike: (id: number) => Promise<void>;
  deleteComment: (id: number) => Promise<void>;
}) {
  const supabase = useMemo(() => createClient(), []);
  const topRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [comments, setComments] = useState<CommentData[] | null>(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{
    parentId: number;
    username: string;
  } | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getComments(postId)
      .then((list) => {
        if (!cancelled) setComments(list);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, getComments]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const all = comments ?? [];
  const tops = all
    .filter((c) => c.parentId === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const repliesOf = new Map<number, CommentData[]>();
  for (const c of all) {
    if (c.parentId === null) continue;
    const list = repliesOf.get(c.parentId) ?? [];
    list.push(c);
    repliesOf.set(c.parentId, list);
  }
  repliesOf.forEach((list) =>
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  );

  function patch(id: number, changes: Partial<CommentData>) {
    setComments((prev) =>
      (prev ?? []).map((c) => (c.id === id ? { ...c, ...changes } : c))
    );
  }

  function startReply(c: CommentData) {
    const username = c.author?.username ?? "someone";
    setReplyTo({ parentId: c.parentId ?? c.id, username });
    setText(`@${username} `);
    inputRef.current?.focus();
  }

  async function handleLike(c: CommentData) {
    const next = !c.liked;
    patch(c.id, {
      liked: next,
      likeCount: Math.max(0, c.likeCount + (next ? 1 : -1)),
    });
    try {
      await toggleCommentLike(c.id);
    } catch {
      patch(c.id, { liked: c.liked, likeCount: c.likeCount });
    }
  }

  async function handleDelete(c: CommentData) {
    if (!window.confirm("Delete this comment?")) return;

    const replyCount = c.parentId === null ? (repliesOf.get(c.id)?.length ?? 0) : 0;

    await deleteComment(c.id);

    setComments((prev) =>
      (prev ?? []).filter((x) => x.id !== c.id && x.parentId !== c.id)
    );
    onCountChange(-(1 + replyCount));
  }

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (!COMMENT_IMAGE_TYPES.includes(f.type)) {
      setError("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (f.size > COMMENT_IMAGE_MAX_BYTES) {
      setError("Images can be up to 5 MB.");
      return;
    }

    setError(null);
    setImage(f);
    setImagePreview(URL.createObjectURL(f));
  }

  function clearImage() {
    setImage(null);
    setImagePreview(null);
  }

  async function send() {
    const content = text.trim();
    if ((!content && !image) || sending) return;

    setSending(true);
    setError(null);

    let imagePath: string | null = null;

    if (image) {
      const rawExt = (image.name.split(".").pop() || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const ext = rawExt.length >= 2 && rawExt.length <= 5 ? rawExt : "jpg";
      const path = `${userId}-cmt-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, image, { contentType: image.type, upsert: false });

      if (uploadError) {
        setSending(false);
        setError("Image upload failed. Please try again.");
        return;
      }
      imagePath = path;
    }

    const result = await addComment({
      postId,
      parentId: replyTo?.parentId ?? null,
      content,
      imagePath,
    }).catch(() => ({ ok: false as const, error: "Could not post your comment." }));

    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setComments((prev) => [...(prev ?? []), result.comment]);
    onCountChange(1);
    setText("");
    setReplyTo(null);
    clearImage();

    if (!result.comment.parentId) {
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <>
      <Sheet
        title="Comments"
        tall
        onClose={onClose}
        footer={
          <div>
            {replyTo && (
              <div className="flex items-center justify-between pb-2 text-xs text-foreground/60">
                <span>Replying to @{replyTo.username}</span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setText("");
                  }}
                  aria-label="Cancel reply"
                >
                  ✕
                </button>
              </div>
            )}

            {imagePreview && (
              <div className="relative mb-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Attachment preview"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label="Remove image"
                  className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-foreground text-xs text-background"
                >
                  ✕
                </button>
              </div>
            )}

            {error && <p className="pb-2 text-xs text-red-600">{error}</p>}

            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={pickImage}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Add a photo"
                className="text-xl"
              >
                📷
              </button>
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void send();
                  }
                }}
                maxLength={COMMENT_MAX}
                placeholder={replyTo ? "Write a reply..." : "Add a comment..."}
                className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || (!text.trim() && !image)}
                className="px-2 text-sm font-semibold text-brand disabled:opacity-40"
              >
                {sending ? "..." : "Post"}
              </button>
            </div>
          </div>
        }
      >
        <div ref={topRef} />

        {comments === null ? (
          <p className="py-10 text-center text-sm text-foreground/50">Loading...</p>
        ) : tops.length === 0 ? (
          <p className="py-10 text-center text-sm text-foreground/50">
            No comments yet. Start the conversation.
          </p>
        ) : (
          <div className="pb-4">
            {tops.map((c) => (
              <div key={c.id}>
                <CommentRow
                  c={c}
                  size={36}
                  onReply={startReply}
                  onLike={handleLike}
                  onDelete={handleDelete}
                  onReport={(x) => setReportId(x.id)}
                />
                {(repliesOf.get(c.id) ?? []).length > 0 && (
                  <div className="ml-12 border-l border-foreground/10 pl-3">
                    {(repliesOf.get(c.id) ?? []).map((r) => (
                      <CommentRow
                        key={r.id}
                        c={r}
                        size={28}
                        onReply={startReply}
                        onLike={handleLike}
                        onDelete={handleDelete}
                        onReport={(x) => setReportId(x.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {reportId !== null && (
        <ReportSheet
          targetType="comment"
          targetId={String(reportId)}
          onClose={() => setReportId(null)}
        />
      )}
    </>
  );
}