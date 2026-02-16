const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const { pool } = require('./db');

// Calibre library path
const CALIBRE_PATH = process.argv[2] || path.join(os.homedir(), 'Documents', 'Calibre Library');
const METADATA_DB = path.join(CALIBRE_PATH, 'metadata.db');

async function importFromCalibre() {
  console.log(`Reading Calibre library from: ${CALIBRE_PATH}`);

  // Open Calibre's SQLite database (read-only)
  const calibreDb = new Database(METADATA_DB, { readonly: true });

  // Query to get books with authors, ISBN, publisher, pubdate, and file paths
  const query = `
    SELECT
      b.id,
      b.title,
      b.path as book_path,
      b.pubdate,
      GROUP_CONCAT(a.name, ' & ') as authors,
      (SELECT val FROM identifiers WHERE book = b.id AND type = 'isbn' LIMIT 1) as isbn,
      (SELECT name FROM publishers WHERE id IN (SELECT publisher FROM books_publishers_link WHERE book = b.id) LIMIT 1) as publisher,
      (SELECT format || '/' || name || '.' || lower(format) FROM data WHERE book = b.id LIMIT 1) as file_name
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    GROUP BY b.id
    ORDER BY b.title
  `;

  const books = calibreDb.prepare(query).all();
  console.log(`Found ${books.length} books in Calibre`);

  let imported = 0;
  let skipped = 0;

  for (const book of books) {
    // Build full file path
    const filePath = book.file_name
      ? path.join(CALIBRE_PATH, book.book_path, book.file_name)
      : null;

    // Check if book already exists (by title and author)
    const existing = await pool.query(
      'SELECT id FROM books WHERE title = $1 AND author = $2',
      [book.title, book.authors]
    );

    if (existing.rows.length > 0) {
      console.log(`Skipping (exists): ${book.title}`);
      skipped++;
      continue;
    }

    // Parse publish date (Calibre stores as ISO timestamp)
    let publishDate = null;
    if (book.pubdate) {
      const date = new Date(book.pubdate);
      if (!isNaN(date) && date.getFullYear() > 100) {
        publishDate = date.getFullYear().toString();
      }
    }

    // Insert into our database
    await pool.query(
      `INSERT INTO books (title, author, isbn, publisher, publish_date, type, file_path, reading_status, progress)
       VALUES ($1, $2, $3, $4, $5, 'ebook', $6, 'unread', 0)`,
      [book.title, book.authors, book.isbn, book.publisher, publishDate, filePath]
    );

    console.log(`Imported: ${book.title}`);
    imported++;
  }

  calibreDb.close();
  await pool.end();

  console.log(`\nDone! Imported: ${imported}, Skipped: ${skipped}`);
}

importFromCalibre().catch(err => {
  console.error('Error importing:', err);
  process.exit(1);
});
