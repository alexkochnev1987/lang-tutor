import { sql } from "drizzle-orm";
import { pg } from "@/lib/db/pg";
import { wordStudySkips } from "@/lib/db/schema";
import { withUser } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? "pl-b1-ru";

interface Body {
  dayNumber: number;
  lexemeId: string;
}

export const POST = withUser(async ({ userId, req }) => {
  const { dayNumber, lexemeId } = (await req.json()) as Body;
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || !lexemeId) {
    throw new Error("bad_word_study_skip");
  }

  await pg
    .insert(wordStudySkips)
    .values({
      userId,
      courseId: COURSE_ID,
      dayNumber,
      lexemeId,
    })
    .onConflictDoUpdate({
      target: [
        wordStudySkips.userId,
        wordStudySkips.courseId,
        wordStudySkips.dayNumber,
        wordStudySkips.lexemeId,
      ],
      set: { skippedAt: sql`now()` },
    });

  return { ok: true };
});
