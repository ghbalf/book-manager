const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

// Calibre library path
const CALIBRE_PATH = path.join(os.homedir(), 'Documents', 'Calibre Library');
const METADATA_DB = path.join(CALIBRE_PATH, 'metadata.db');

const DRY_RUN = process.argv.includes('--dry-run');

// Priority order for source format (best to worst for conversion to EPUB)
const FORMAT_PRIORITY = ['AZW3', 'MOBI', 'KFX', 'FB2', 'HTMLZ', 'DOCX', 'DOC', 'PDF', 'TXT'];
const SKIP_FORMATS = new Set(['CBR', 'CBZ', 'LRF', 'AZW', 'AZW1', 'AZW4', 'PRC', 'ZIP']);

function pickBestFormat(formats) {
  for (const fmt of FORMAT_PRIORITY) {
    const match = formats.find(f => f.format === fmt);
    if (match) return match;
  }
  return null;
}

function convert(source, output) {
  return new Promise((resolve, reject) => {
    execFile('ebook-convert', [source, output], { timeout: 5 * 60 * 1000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

function registerWithCalibre(bookId, epubPath) {
  return new Promise((resolve, reject) => {
    execFile('calibredb', ['add_format', String(bookId), epubPath, '--library-path', CALIBRE_PATH], { timeout: 60 * 1000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

async function main() {
  console.log(`Calibre library: ${CALIBRE_PATH}`);
  if (DRY_RUN) console.log('DRY RUN — no conversions will be performed\n');

  const db = new Database(METADATA_DB, { readonly: true });

  // Get all formats for all books
  const rows = db.prepare(`
    SELECT d.book, d.format, d.name, b.title, b.path
    FROM data d
    JOIN books b ON b.id = d.book
    ORDER BY d.book
  `).all();

  db.close();

  // Group by book
  const books = new Map();
  for (const row of rows) {
    if (!books.has(row.book)) {
      books.set(row.book, { id: row.book, title: row.title, bookPath: row.path, formats: [] });
    }
    books.get(row.book).formats.push({ format: row.format, name: row.name });
  }

  // Find books missing EPUB
  const needsConversion = [];
  let alreadyHasEpub = 0;

  for (const book of books.values()) {
    const hasEpub = book.formats.some(f => f.format === 'EPUB');
    if (hasEpub) {
      alreadyHasEpub++;
      continue;
    }
    const source = pickBestFormat(book.formats);
    if (source) {
      needsConversion.push({ ...book, source });
    }
  }

  console.log(`Total books: ${books.size}`);
  console.log(`Already have EPUB: ${alreadyHasEpub}`);
  console.log(`To convert: ${needsConversion.length}`);

  if (needsConversion.length === 0) {
    console.log('\nNothing to convert.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nBooks that would be converted:');
    for (const book of needsConversion) {
      console.log(`  ${book.title} (${book.source.format} → EPUB)`);
    }
    return;
  }

  console.log('');

  let converted = 0;
  let failed = 0;

  for (let i = 0; i < needsConversion.length; i++) {
    const book = needsConversion[i];
    const srcExt = book.source.format.toLowerCase();
    const srcPath = path.join(CALIBRE_PATH, book.bookPath, `${book.source.name}.${srcExt}`);
    const epubPath = path.join(CALIBRE_PATH, book.bookPath, `${book.source.name}.epub`);

    process.stdout.write(`[${i + 1}/${needsConversion.length}] Converting: ${book.title} (${book.source.format} → EPUB)... `);

    try {
      await convert(srcPath, epubPath);
      await registerWithCalibre(book.id, epubPath);
      console.log('OK');
      converted++;
    } catch (err) {
      console.log('FAILED');
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone! Converted: ${converted}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
