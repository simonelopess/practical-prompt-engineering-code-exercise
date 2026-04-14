-- Run once if you created the DB before user_rating existed:
-- wrangler d1 execute prompt-library-db --remote --file=./migrations/0001_add_user_rating.sql
ALTER TABLE prompts ADD COLUMN user_rating INTEGER;
