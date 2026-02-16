const { pool } = require('./db');

async function lookupCover(isbn) {
  const cleanISBN = isbn.replace(/[-\s]/g, '');

  // Try Open Library API
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`;
    const response = await fetch(url);
    const data = await response.json();

    const key = `ISBN:${cleanISBN}`;
    if (data[key]?.cover?.medium) {
      return data[key].cover.medium;
    }
    if (data[key]?.cover?.small) {
      return data[key].cover.small;
    }
  } catch (error) {
    // Continue to Google Books
  }

  // Try Google Books API as fallback
  try {
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanISBN}`;
    const googleResponse = await fetch(googleUrl);
    const googleData = await googleResponse.json();

    if (googleData.items?.[0]?.volumeInfo?.imageLinks?.thumbnail) {
      return googleData.items[0].volumeInfo.imageLinks.thumbnail;
    }
  } catch (error) {
    // No cover found
  }

  return null;
}

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
