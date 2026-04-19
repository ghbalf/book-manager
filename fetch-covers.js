const { pool } = require('./db');
const { lookupCover } = require('./lookup-isbn');

async function main() {
  console.log('Fetching covers for physical books...\n');

  // Find physical books with ISBN but no cover
  const result = await pool.query(`
    SELECT id, title, isbn
    FROM books
    WHERE type = 'physical'
      AND isbn IS NOT NULL
      AND isbn != ''
      AND (cover_url IS NULL OR cover_url = '')
  `);

  const books = result.rows;
  console.log(`Found ${books.length} books without covers.\n`);

  let updated = 0;
  let notFound = 0;

  for (const book of books) {
    process.stdout.write(`Looking up: ${book.title}... `);

    const coverUrl = await lookupCover(book.isbn);

    if (coverUrl) {
      await pool.query(
        'UPDATE books SET cover_url = $1, updated_at = NOW() WHERE id = $2',
        [coverUrl, book.id]
      );
      console.log('Found!');
      updated++;
    } else {
      console.log('Not found');
      notFound++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\nDone! Updated: ${updated}, Not found: ${notFound}`);
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
