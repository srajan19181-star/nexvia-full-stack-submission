export interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface CommentReplyItem {
  id: string;
  commentId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
  canDelete: boolean;
}

export interface CommentItem {
  id: string;
  pageId: string;
  authorId: string;
  body: string;
  anchorStart: string | null;
  anchorEnd: string | null;
  anchorStateVector: string | null;
  anchorGeneration: number;
  anchorQuote: string | null;
  anchorStatus: "ATTACHED" | "ORPHANED";
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
  resolvedBy: Pick<CommentAuthor, "id" | "name"> | null;
  replies: CommentReplyItem[];
  canDelete: boolean;
  canResolve: boolean;
}
