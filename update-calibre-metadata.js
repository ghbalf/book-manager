const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const { pool } = require('./db');

const CALIBRE_PATH = process.argv[2] || path.join(os.homedir(), 'Documents', 'Calibre Library');
const METADATA_DB = path.join(CALIBRE_PATH, 'metadata.db');

async function main() {
  console.log(`Reading Calibre library from: ${CALIBRE_PATH}\n`);

  const calibreDb = new Database(METADATA_DB, { readonly: true });

  // Query to get books with publisher, pubdate, and ISBN
  const query = `
    SELECT
      b.id,
      b.title,
      b.pubdate,
      GROUP_CONCAT(a.name, ' & ') as authors,
      (SELECT name FROM publishers WHERE id IN (SELECT publisher FROM books_publishers_link WHERE book = b.id) LIMIT 1) as publisher,
      (SELECT val FROM identifiers WHERE book = b.id AND type = 'isbn' LIMIT 1) as isbn
    FROM books b
    LEFT JOIN books_authors_link bal ON b.id = bal.book
    LEFT JOIN authors a ON bal.author = a.id
    GROUP BY b.id
  `;

  const calibreBooks = calibreDb.prepare(query).all();
  console.log(`Found ${calibreBooks.length} books in Calibre\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const book of calibreBooks) {
    // Parse publish date
    let publishDate = null;
    if (book.pubdate) {
      const date = new Date(book.pubdate);
      if (!isNaN(date) && date.getFullYear() > 100) {
        publishDate = date.getFullYear().toString();
      }
    }

    // Skip if no metadata to update
    if (!book.publisher && !publishDate && !book.isbn) {
      skipped++;
      continue;
    }

    // Find matching book in our database
    const result = await pool.query(
      `SELECT id, publisher, publish_date, isbn FROM books
       WHERE title = $1 AND author = $2 AND type = 'ebook'`,
      [book.title, book.authors]
    );

    if (result.rows.length === 0) {
      notFound++;
      continue;
    }

    const dbBook = result.rows[0];

    // Skip if already has all metadata
    if (dbBook.publisher && dbBook.publish_date && dbBook.isbn) {
      skipped++;
      continue;
    }

    // Update with new metadata
    await pool.query(
      `UPDATE books SET
         publisher = COALESCE(publisher, $1),
         publish_date = COALESCE(publish_date, $2),
         isbn = COALESCE(isbn, $3),
         updated_at = NOW()
       WHERE id = $4`,
      [book.publisher, publishDate, book.isbn, dbBook.id]
    );

    console.log(`Updated: ${book.title}`);
    updated++;
  }

  calibreDb.close();
  await pool.end();

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Not found: ${notFound}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
