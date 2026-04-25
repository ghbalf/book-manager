const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const { pool } = require('./db');

const DEFAULT_CALIBRE_PATH = path.join(os.homedir(), 'Documents', 'Calibre Library');

function readCalibreMetadata(calibrePath) {
  const metadataDb = path.join(calibrePath, 'metadata.db');
  const calibreDb = new Database(metadataDb, { readonly: true });
  try {
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

// updateCalibreMetadata(opts)
//   opts.ids  — optional array of our-DB book IDs to restrict updates to.
//   opts.onProgress — called with { phase, current, total, title } per book.
async function updateCalibreMetadata({ calibrePath = DEFAULT_CALIBRE_PATH, ids, onProgress } = {}) {
  const calibreBooks = readCalibreMetadata(calibrePath);
  const total = calibreBooks.length;
  const idFilter = Array.isArray(ids) ? new Set(ids) : null;

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (let i = 0; i < calibreBooks.length; i++) {
    const book = calibreBooks[i];
    onProgress?.({ phase: 'metadata', current: i + 1, total, title: book.title });

    const publishDate = parseCalibrePubYear(book.pubdate);

    if (!book.publisher && !publishDate && !book.isbn) {
      skipped++;
      continue;
    }

    const result = await pool.query(
      `SELECT id, publisher, publish_date, isbn FROM books
       WHERE calibre_id = $1`,
      [book.id]
    );

    if (result.rows.length === 0) {
      notFound++;
      continue;
    }

    const dbBook = result.rows[0];

    if (idFilter && !idFilter.has(dbBook.id)) {
      skipped++;
      continue;
    }

    if (dbBook.publisher && dbBook.publish_date && dbBook.isbn) {
      skipped++;
      continue;
    }

    await pool.query(
      `UPDATE books SET
         publisher = COALESCE(publisher, $1),
         publish_date = COALESCE(publish_date, $2),
         isbn = COALESCE(isbn, $3),
         updated_at = NOW()
       WHERE id = $4`,
      [book.publisher, publishDate, book.isbn, dbBook.id]
    );
    updated++;
  }

  return { updated, skipped, notFound, total };
}

module.exports = { updateCalibreMetadata, DEFAULT_CALIBRE_PATH };

if (require.main === module) {
  const calibrePath = process.argv[2] || DEFAULT_CALIBRE_PATH;
  console.log(`Reading Calibre library from: ${calibrePath}\n`);
  updateCalibreMetadata({
    calibrePath,
    onProgress: ({ current, total, title }) => {
      console.log(`[${current}/${total}] ${title}`);
    },
  })
    .then(({ updated, skipped, notFound }) => {
      console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Not found: ${notFound}`);
      return pool.end();
    })
    .catch(err => {
      console.error('Error:', err);
      pool.end().finally(() => process.exit(1));
    });
}
