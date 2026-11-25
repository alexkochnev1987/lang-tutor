CREATE TABLE "lesson_assignments" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "course_id" text NOT NULL,
  "day_number" integer NOT NULL,
  "stages" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "course_id", "day_number")
);
--> statement-breakpoint
CREATE TABLE "exercise_attempts" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "course_id" text NOT NULL,
  "day_number" integer NOT NULL,
  "exercise_id" text NOT NULL,
  "attempts" integer NOT NULL,
  "correct" integer NOT NULL,
  "answer" text NOT NULL,
  "expected" text NOT NULL,
  "error_kind" text,
  "completed_at" timestamptz NOT NULL,
  PRIMARY KEY ("user_id", "course_id", "day_number", "exercise_id", "completed_at")
);
--> statement-breakpoint
CREATE FUNCTION archive_exercise_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO exercise_attempts (user_id, course_id, day_number, exercise_id, attempts, correct, answer, expected, error_kind, completed_at)
  VALUES (NEW.user_id, NEW.course_id, NEW.day_number, NEW.exercise_id, NEW.attempts, NEW.correct, NEW.answer, NEW.expected, NEW.error_kind, NEW.completed_at)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER archive_exercise_attempt_trigger
AFTER INSERT OR UPDATE ON exercise_results FOR EACH ROW
EXECUTE FUNCTION archive_exercise_attempt();
--> statement-breakpoint
INSERT INTO exercise_attempts (user_id, course_id, day_number, exercise_id, attempts, correct, answer, expected, error_kind, completed_at)
SELECT user_id, course_id, day_number, exercise_id, attempts, correct, answer, expected, error_kind, completed_at FROM exercise_results
ON CONFLICT DO NOTHING;
