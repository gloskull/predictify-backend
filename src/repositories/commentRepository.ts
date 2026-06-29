import { getDb } from "../db/client";
import { marketComments } from "../db/schema";

export interface CreateCommentParams {
  marketId: string;
  userId: string;
  content: string;
}

export interface Comment {
  id: string;
  marketId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface CommentRepository {
  createComment(params: CreateCommentParams): Promise<Comment>;
}

export class DrizzleCommentRepository implements CommentRepository {
  constructor(private readonly database: any = null) {}

  async createComment(params: CreateCommentParams): Promise<Comment> {
    const [result] = await (this.database ?? getDb())
      .insert(marketComments)
      .values({
        marketId: params.marketId,
        userId: params.userId,
        content: params.content,
      })
      .returning();

    return result;
  }
}

export const commentRepository: CommentRepository = new DrizzleCommentRepository();
