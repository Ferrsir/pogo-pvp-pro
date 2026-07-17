ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_trainer_level_check
-- statement-breakpoint
ALTER TABLE users
ADD CONSTRAINT users_trainer_level_check CHECK (trainer_level BETWEEN 1 AND 80)
