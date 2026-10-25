/**
 * Всё состояние пользователя одним запросом.
 *
 * Экран «Сегодня» раньше делал четыре параллельных чтения из IndexedDB;
 * по сети четыре round-trip вместо одного — это заметно. Объём маленький:
 * несколько сотен строк даже к концу курса.
 */
import { and, eq, isNull } from 'drizzle-orm'
import { pg } from '@/lib/db/pg'
import {
  lessonSessions, lexemeStatus, moduleReadiness, personalDict,
  ruleMastery, studyItems, userCourses, users,
} from '@/lib/db/schema'
import { withUser } from '@/lib/api/handler'

export const runtime = 'nodejs'          // node-postgres на edge не работает
export const dynamic = 'force-dynamic'   // ответ зависит от cookie

const COURSE_ID = process.env.NEXT_PUBLIC_COURSE_ID ?? 'pl-b1-ru'

export const GET = withUser(async ({ userId }) => {
  const [user] = await pg.select().from(users).where(eq(users.id, userId)).limit(1)

  const [course, items, mastery, readiness, sessions, dict, statuses] = await Promise.all([
    pg.select().from(userCourses)
      .where(and(eq(userCourses.userId, userId), eq(userCourses.courseId, COURSE_ID))).limit(1),
    pg.select().from(studyItems)
      .where(and(eq(studyItems.userId, userId), eq(studyItems.courseId, COURSE_ID))),
    pg.select().from(ruleMastery).where(eq(ruleMastery.userId, userId)),
    pg.select().from(moduleReadiness)
      .where(and(eq(moduleReadiness.userId, userId), eq(moduleReadiness.courseId, COURSE_ID))),
    pg.select().from(lessonSessions)
      .where(and(eq(lessonSessions.userId, userId), eq(lessonSessions.courseId, COURSE_ID))),
    pg.select().from(personalDict)
      .where(and(eq(personalDict.userId, userId), isNull(personalDict.deletedAt))),
    pg.select().from(lexemeStatus)
      .where(and(eq(lexemeStatus.userId, userId), eq(lexemeStatus.courseId, COURSE_ID))),
  ])

  return {
    user: {
      id: userId,
      signedIn: Boolean(user?.googleSub),
      name: user?.name ?? null,
      email: user?.email ?? null,
      picture: user?.picture ?? null,
    },
    settings: user?.settings ?? {},
    course: course[0] ?? null,
    studyItems: items,
    mastery,
    readiness,
    sessions,
    personalDict: dict,
    lexemeStatus: statuses,
  }
})
