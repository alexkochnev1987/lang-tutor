CREATE TABLE "word_study_skips" (
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"day_number" integer NOT NULL,
	"lexeme_id" text NOT NULL,
	"skipped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "word_study_skips_user_id_course_id_day_number_lexeme_id_pk" PRIMARY KEY("user_id","course_id","day_number","lexeme_id")
);
--> statement-breakpoint
ALTER TABLE "word_study_skips" ADD CONSTRAINT "word_study_skips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "word_study_skips_user_day_idx" ON "word_study_skips" USING btree ("user_id","course_id","day_number");