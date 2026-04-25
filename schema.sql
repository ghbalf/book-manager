-- Book Manager Database Schema

CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT,                      -- multiple authors separated by &
  isbn VARCHAR(50),
  publisher TEXT,
  publish_date VARCHAR(20),         -- flexible format: "2020", "2020-05", "2020-05-15"
  genre VARCHAR(100),
  type VARCHAR(20) NOT NULL CHECK (type IN ('physical', 'ebook')),
  location TEXT,                    -- for physical books
  file_path TEXT,                   -- for ebooks
  cover_url TEXT,
  reading_status VARCHAR(20) DEFAULT 'unread' CHECK (reading_status IN ('unread', 'reading', 'finished')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  calibre_id INTEGER,               -- Calibre b.id for ebooks synced from Calibre; NULL otherwise
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for common search fields
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_books_genre ON books(genre);
CREATE INDEX IF NOT EXISTS idx_books_type ON books(type);
CREATE INDEX IF NOT EXISTS idx_books_reading_status ON books(reading_status);

-- Each Calibre b.id can map to at most one manager record. Partial index
-- so multiple non-Calibre records (physical books, manual ebooks) can coexist with NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_books_calibre_id ON books(calibre_id) WHERE calibre_id IS NOT NULL;
