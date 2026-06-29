import { commentRepository, Comment } from "../repositories/commentRepository";
import { getMarketById } from "./marketService";
import { AppError } from "../errors/AppError";

export interface CreateCommentServiceParams {
  marketId: string;
  userId: string;
  content: string;
}

export async function createComment(
  params: CreateCommentServiceParams,
): Promise<Comment> {
  const market = await getMarketById(params.marketId);
  if (!market) {
    throw AppError.notFound("Market not found");
  }

  return commentRepository.createComment(params);
}
