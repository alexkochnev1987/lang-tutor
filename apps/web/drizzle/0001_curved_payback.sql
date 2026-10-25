CREATE TABLE "lexeme_status" (
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"lexeme_id" text NOT NULL,
	"status" text NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lexeme_status_user_id_course_id_lexeme_id_pk" PRIMARY KEY("user_id","course_id","lexeme_id")
);
--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD COLUMN "kind" text DEFAULT 'day' NOT NULL;--> statement-breakpoint
ALTER TABLE "lexeme_status" ADD CONSTRAINT "lexeme_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;