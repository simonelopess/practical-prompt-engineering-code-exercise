CREATE TABLE prompts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL, -- JSON (model, createdAt, tokenEstimate, …)
  user_rating INTEGER -- 1–5 stars, or NULL
);

CREATE TABLE notes (
  id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (id, prompt_id),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_prompt ON notes(prompt_id);