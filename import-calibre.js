const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const { pool } = require('./db');

const DEFAULT_CALIBRE_PATH = path.join(os.homedir(), 'Documents', 'Calibre Library');

function readCalibreBooks(calibrePath) {
  const metadataDb = path.join(calibrePath, 'metadata.db');
  const calibreDb = new Database(metadataDb, { readonly: true });
  try {
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
    return calibreDb.prepare(query).all();
  } finally {
    calibreDb.close();
  }
}

function parseCalibrePubYear(pubdate) {
  if (!pubdate) return null;
  const date = new Date(pubdate);
  if (isNaN(date) || date.getFullYear() <= 100) return null;
  return date.getFullYear().toString();
}

async function importFromCalibre({ calibrePath = DEFAULT_CALIBRE_PATH, onProgress } = {}) {
  const books = readCalibreBooks(calibrePath);
  const total = books.length;

  const insertedIds = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    onProgress?.({ phase: 'import', current: i + 1, total, title: book.title });

    const filePath = book.file_name
      ? path.join(calibrePath, book.book_path, book.file_name)
      : null;

    // Dedup on Calibre's b.id (stored as calibre_id). Each Calibre book maps to
    // at most one manager record; duplicate (title, author) pairs in Calibre
    // yield independent manager rows now.
    const existing = await pool.query(
      'SELECT id FROM books WHERE calibre_id = $1',
      [book.id]
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    const publishDate = parseCalibrePubYear(book.pubdate);

    const result = await pool.query(
      `INSERT INTO books (title, author, isbn, publisher, publish_date, type, file_path, reading_status, progress, calibre_id)
       VALUES ($1, $2, $3, $4, $5, 'ebook', $6, 'unread', 0, $7)
       RETURNING id`,
      [book.title, book.authors, book.isbn, book.publisher, publishDate, filePath, book.id]
    );
    insertedIds.push(result.rows[0].id);
    imported++;
  }

  return { imported, skipped, total, ids: insertedIds };
}

module.exports = { importFromCalibre, DEFAULT_CALIBRE_PATH };

if (require.main === module) {
  const calibrePath = process.argv[2] || DEFAULT_CALIBRE_PATH;
  console.log(`Reading Calibre library from: ${calibrePath}`);
  importFromCalibre({
    calibrePath,
    onProgress: ({ current, total, title }) => {
      console.log(`[${current}/${total}] ${title}`);
    },
  })
    .then(({ imported, skipped }) => {
      console.log(`\nDone! Imported: ${imported}, Skipped: ${skipped}`);
      return pool.end();
    })
    .catch(err => {
      console.error('Error importing:', err);
      pool.end().finally(() => process.exit(1));
    });
}
