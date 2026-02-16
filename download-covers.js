const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const COVERS_DIR = path.join(__dirname, 'covers');

async function downloadCover(url, bookId) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get('content-type') || '';
    let ext = '.jpg';
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('gif')) ext = '.gif';
    else if (contentType.includes('webp')) ext = '.webp';

    const buffer = await response.arrayBuffer();
    const filePath = path.join(COVERS_DIR, `${bookId}${ext}`);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    return ext;
  } catch (error) {
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Downloading cover images...\n');

  // Ensure covers directory exists
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }

  // Find all books with cover_url that haven't been downloaded yet
  const result = await pool.query(`
    SELECT id, title, cover_url
    FROM books
    WHERE cover_url IS NOT NULL
      AND cover_url != ''
      AND cover_url LIKE 'http%'
  `);

  const books = result.rows;
  console.log(`Found ${books.length} books with external cover URLs.\n`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const book of books) {
    // Check if already downloaded
    const existingFiles = fs.readdirSync(COVERS_DIR).filter(f => f.startsWith(`${book.id}.`));
    if (existingFiles.length > 0) {
      console.log(`Skipping (exists): ${book.title}`);
      skipped++;
      continue;
    }

    process.stdout.write(`Downloading: ${book.title}... `);

    const ext = await downloadCover(book.cover_url, book.id);

    if (ext) {
      // Update database to use local path
      await pool.query(
        'UPDATE books SET cover_url = $1, updated_at = NOW() WHERE id = $2',
        [`/covers/${book.id}${ext}`, book.id]
      );
      console.log('OK');
      downloaded++;
    } else {
      console.log('Failed');
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nDone! Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
