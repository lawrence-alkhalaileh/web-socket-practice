import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
  MATCH_STATUS,
} from "../validation/matches.ts";
import { getMatchStatus } from "../utils/match-status.ts";
import type { Request, Response } from "express";
import { matches } from "../db/schema.ts";
import { db } from "../db/db.ts";
import { desc } from "drizzle-orm";

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get("/", async (req: Request, res: Response) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid Query.",
      details: JSON.stringify(parsed.error.issues),
    });
  }

  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);

    return res.status(200).json({ data });
  } catch (e) {
    res.status(500).json({ error: "Failed to list matches." });
  }
});

matchRouter.post("/", async (req: Request, res: Response) => {
  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({
      path: issue.path.join(""),
      message: issue.message,
    }));

    return res.status(400).json({
      error: "Invalid payload.",
      details: errors,
    });
  }

  const { startTime, endTime, homeScore, awayScore } = parsed.data;

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        homeScore: homeScore ?? 0,
        awayScore: awayScore ?? 0,
        status: getMatchStatus(startTime, endTime) ?? MATCH_STATUS.SCHEDULED,
      })
      .returning();

    if (res.app.locals.broadcastMatchCreated) {
      res.app.locals.broadcastMatchCreated(event);
    }

    return res.status(201).json({ data: event });
  } catch (e) {
    res.status(500).json({ error: "Failed to create match." });
  }
});
