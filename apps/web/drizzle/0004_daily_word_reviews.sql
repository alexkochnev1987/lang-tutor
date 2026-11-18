CREATE TABLE "daily_word_reviews" (
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"day" text NOT NULL,
	"lexeme_id" text NOT NULL,
	"answer_id" text NOT NULL,
	"format" text NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_word_reviews_user_id_course_id_day_lexeme_id_pk" PRIMARY KEY("user_id","course_id","day","lexeme_id")
);
--> statement-breakpoint
ALTER TABLE "daily_word_reviews" ADD CONSTRAINT "daily_word_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;