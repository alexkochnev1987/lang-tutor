-- Preserve the current course language for existing users.
UPDATE "users"
SET "settings" = jsonb_build_object('targetLanguage', 'pl') || "settings"
WHERE NOT ("settings" ? 'targetLanguage');
