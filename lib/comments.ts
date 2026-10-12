export type CommentData = {
  id: number;
  parentId: number | null;
  content: string;
  imageUrl: string | null;
  likeCount: number;
  liked: boolean;
  createdAt: string;
  author: { username: string; avatarUrl: string | null } | null;
  mine: boolean;
  canDelete: boolean;
};

export type AddResult =
  | { ok: true; comment: CommentData }
  | { ok: false; error: string };

export const COMMENT_MAX = 500;
export const COMMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const COMMENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Comment images must be "<your-user-id>-cmt-<timestamp>.<ext>". */
export function isOwnCommentPath(path: unknown, userId: string): path is string {
  if (typeof path !== "string" || !UUID_REGEX.test(userId)) return false;
  return new RegExp(`^${userId}-cmt-\\d{10,16}\\.[a-z0-9]{2,5}$`, "i").test(path);
}