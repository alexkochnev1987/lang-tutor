CREATE TABLE "exercise_results" (
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"day_number" integer NOT NULL,
	"exercise_id" text NOT NULL,
	"attempts" integer NOT NULL,
	"correct" integer NOT NULL,
	"answer" text NOT NULL,
	"expected" text NOT NULL,
	"error_kind" text,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_results_user_id_course_id_day_number_exercise_id_pk" PRIMARY KEY("user_id","course_id","day_number","exercise_id")
);
--> statement-breakpoint
ALTER TABLE "exercise_results" ADD CONSTRAINT "exercise_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "exercise_results_user_day_idx" ON "exercise_results" USING btree ("user_id","course_id","day_number");
