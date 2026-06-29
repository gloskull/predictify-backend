import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createComment } from "../../services/commentService";
import { requireAuth } from "../../middleware/requireAuth";
import { createRateLimiter } from "../../middleware/rateLimit";
import { logger } from "../../config/logger";

const createCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment cannot be empty").max(1000, "Comment too long"),
});

export const commentsRouter = Router({ mergeParams: true });

// Per-user rate limit for posting comments: 5 comments per minute
const commentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
});

commentsRouter.post(
  "/",
  requireAuth,
  commentRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const marketId = req.params.id as string;
      const userId = (req as any).user.id;

      const parsed = createCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: "validation_error",
            details: parsed.error.issues,
          },
        });
        return;
      }

      const comment = await createComment({
        marketId,
        userId,
        content: parsed.data.content,
      });

      logger.info(
        { marketId, userId, commentId: comment.id },
        "market_comment_created",
      );

      res.status(201).json({ data: comment });
    } catch (error) {
      next(error);
    }
  },
);
