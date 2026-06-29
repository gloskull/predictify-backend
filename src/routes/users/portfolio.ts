import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getUserPortfolio } from "../../services/userService";
import { logger } from "../../config/logger";
import { getRequestId } from "../../lib/requestContext";

export const userPortfolioRouter = Router();

const stellarAddressSchema = z.string().regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar address");

userPortfolioRouter.get("/:address/portfolio", async (req: Request, res: Response, next: NextFunction) => {
  const reqId = getRequestId() ?? (typeof (req as { id?: unknown }).id === "string" ? (req as { id?: string }).id : undefined);
  const address = req.params.address as string;

  try {
    const parseResult = stellarAddressSchema.safeParse(address);
    if (!parseResult.success) {
      logger.warn(
        { reqId, address, issues: parseResult.error.issues },
        "user_portfolio_validation_failed",
      );
      return res.status(400).json({
        error: {
          code: "validation_error",
          message: parseResult.error.issues[0]?.message ?? "invalid stellar address",
          requestId: reqId,
        },
      });
    }

    const result = await getUserPortfolio(address);

    if (!result.ok) {
        if (result.error.kind === "NotFound") {
            return res.status(404).json({
                error: {
                    code: "not_found",
                    message: result.error.message,
                    requestId: reqId,
                },
            });
        }
        throw result.error;
    }

    return res.json({ data: result.value });
  } catch (e) {
    return next(e);
  }
});
