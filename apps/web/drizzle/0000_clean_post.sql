CREATE TABLE "lesson_sessions" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"day_number" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"planned_budget_ms" integer NOT NULL,
	"actual_ms" integer,
	"items_reviewed" integer NOT NULL,
	"items_correct" integer NOT NULL,
	CONSTRAINT "lesson_sessions_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "module_readiness" (
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"module_id" text NOT NULL,
	"estimated_percent" real NOT NULL,
	"confidence" real NOT NULL,
	"last_mock_score" real,
	"last_mock_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_readiness_user_id_course_id_module_id_pk" PRIMARY KEY("user_id","course_id","module_id")
);
--> statement-breakpoint
CREATE TABLE "personal_dict" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"lemma" text NOT NULL,
	"translation" text NOT NULL,
	"source_url" text,
	"context" text,
	"linked_lexeme_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "personal_dict_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"study_item_id" text NOT NULL,
	"rating" integer NOT NULL,
	"state" integer NOT NULL,
	"stability" real NOT NULL,
	"difficulty" real NOT NULL,
	"elapsed_days" integer NOT NULL,
	"scheduled_days" integer NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"exercise_id" text,
	"response_ms" integer
);
--> statement-breakpoint
CREATE TABLE "rule_mastery" (
	"user_id" text NOT NULL,
	"grammar_rule_id" text NOT NULL,
	"mastery" real NOT NULL,
	"attempts" integer NOT NULL,
	"correct" integer NOT NULL,
	"recent_window" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_practiced_at" timestamp with time zone,
	"introduced_on_day" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_mastery_user_id_grammar_rule_id_pk" PRIMARY KEY("user_id","grammar_rule_id")
);
--> statement-breakpoint
CREATE TABLE "study_items" (
	"id" text NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"stability" real NOT NULL,
	"difficulty" real NOT NULL,
	"elapsed_days" integer NOT NULL,
	"scheduled_days" integer NOT NULL,
	"learning_steps" integer NOT NULL,
	"reps" integer NOT NULL,
	"lapses" integer NOT NULL,
	"state" integer NOT NULL,
	"last_review" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_items_user_id_id_pk" PRIMARY KEY("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "user_courses" (
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"target_exam_date" timestamp with time zone,
	"entry_track" text NOT NULL,
	"daily_budget_minutes" integer DEFAULT 15 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_courses_user_id_course_id_pk" PRIMARY KEY("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"google_sub" text,
	"email" text,
	"name" text,
	"picture" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD CONSTRAINT "lesson_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_readiness" ADD CONSTRAINT "module_readiness_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_dict" ADD CONSTRAINT "personal_dict_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_mastery" ADD CONSTRAINT "rule_mastery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_items" ADD CONSTRAINT "study_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_courses" ADD CONSTRAINT "user_courses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_sessions_day_idx" ON "lesson_sessions" USING btree ("user_id","course_id","day_number");--> statement-breakpoint
CREATE INDEX "review_logs_user_time_idx" ON "review_logs" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "study_items_due_idx" ON "study_items" USING btree ("user_id","course_id","due");