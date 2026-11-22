/**
 * Всё состояние пользователя одним запросом.
 *
 * Экран «Сегодня» раньше делал четыре параллельных чтения из IndexedDB;
 * по сети четыре round-trip вместо одного — это заметно. Объём маленький:
 * несколько сотен строк даже к концу курса.
 */
import { and, eq, isNull } from "drizzle-orm";
import { pg } from "@/lib/db/pg";
import {
  lessonSessions,
  lexemeStatus,
  moduleReadiness,
  personalDict,
  exerciseResults,
  ruleMastery,
  studyItems,
  userCourses,
  users,
  wordStudySkips,
} from "@/lib/db/schema";
import { withUser } from "@/lib/api/handler";
import { fullProfileName, parseProfileName, profileNameFromAccount } from "@/lib/data/profile-name";

export const runtime = "nodejs"; // node-postgres на edge не работает
export const dynamic = "force-dynamic"; // ответ зависит от cookie

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? "pl-b1-ru";

export const GET = withUser(async ({ userId }) => {
  const [user] = await pg
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [
    course,
    items,
    mastery,
    readiness,
    sessions,
    dict,
    statuses,
    results,
    skips,
  ] = await Promise.all([
    pg
      .select()
      .from(userCourses)
      .where(
        and(
          eq(userCourses.userId, userId),
          eq(userCourses.courseId, COURSE_ID),
        ),
      )
      .limit(1),
    pg
      .select()
      .from(studyItems)
      .where(
        and(eq(studyItems.userId, userId), eq(studyItems.courseId, COURSE_ID)),
      ),
    pg.select().from(ruleMastery).where(eq(ruleMastery.userId, userId)),
    pg
      .select()
      .from(moduleReadiness)
      .where(
        and(
          eq(moduleReadiness.userId, userId),
          eq(moduleReadiness.courseId, COURSE_ID),
        ),
      ),
    pg
      .select()
      .from(lessonSessions)
      .where(
        and(
          eq(lessonSessions.userId, userId),
          eq(lessonSessions.courseId, COURSE_ID),
        ),
      ),
    pg
      .select()
      .from(personalDict)
      .where(
        and(eq(personalDict.userId, userId), isNull(personalDict.deletedAt)),
      ),
    pg
      .select()
      .from(lexemeStatus)
      .where(
        and(
          eq(lexemeStatus.userId, userId),
          eq(lexemeStatus.courseId, COURSE_ID),
        ),
      ),
    pg
      .select()
      .from(exerciseResults)
      .where(
        and(
          eq(exerciseResults.userId, userId),
          eq(exerciseResults.courseId, COURSE_ID),
        ),
      ),
    pg
      .select()
      .from(wordStudySkips)
      .where(
        and(
          eq(wordStudySkips.userId, userId),
          eq(wordStudySkips.courseId, COURSE_ID),
        ),
      ),
  ]);

  const { profileName: savedName, ...settings } = (user?.settings ?? {}) as Record<string, unknown>;
  const profileName = parseProfileName(savedName) ?? profileNameFromAccount(user?.name ?? null);

  return {
    user: {
      id: userId,
      signedIn: Boolean(user?.googleSub),
      ...profileName,
      name: fullProfileName(profileName),
      email: user?.email ?? null,
      picture: user?.picture ?? null,
    },
    settings,
    course: course[0] ?? null,
    studyItems: items,
    mastery,
    exerciseResults: results,
    readiness,
    sessions,
    personalDict: dict,
    lexemeStatus: statuses,
    wordStudySkips: skips,
  };
});
