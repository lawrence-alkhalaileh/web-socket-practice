import arcjet, { detectBot, shield } from "@arcjet/node";
import { Request, Response, NextFunction } from "express";
const arcjetKey = process.env.ARCJET_KEY;
const arcjetMode = process.env.ARCJET_MODE === "DRY_RUN" ? "DRY_RUN" : "LIVE";

if (!arcjetKey) throw new Error("ARCJET_KEY environment variable is missing.");

export const arcjetConfig = arcjetKey
  ? arcjet({
      key: arcjetKey,
      rules: [
        shield({ mode: arcjetMode }),
        detectBot({
          mode: arcjetMode,
          allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:PREVIEW", "POSTMAN"],
        }),
      ],
    })
  : null;

export function securityMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!arcjetConfig) return next();

    try {
      const decision = await arcjetConfig.protect(req);
      console.log(decision);
      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          return res.status(429).json({ error: "Too many requests." });
        }

        return res.status(403).json({ error: "Forbidden." });
      }
    } catch (e) {
      console.error("Arcjet Middleware error: ", e);
      return res.status(503).json({ error: "Service Unavailable" });
    }

    next();
  };
}
