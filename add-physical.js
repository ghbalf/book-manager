const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { pool } = require('./db');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function lookupISBN(isbn) {
  // Clean ISBN (remove dashes and spaces)
  const cleanISBN = isbn.replace(/[-\s]/g, '');

  // Try Open Library API
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanISBN}&format=json&jscmd=data`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const key = `ISBN:${cleanISBN}`;
    if (data[key]) {
      const book = data[key];
      return {
        title: book.title,
        authors: book.authors?.map(a => a.name).join(' & ') || null,
        isbn: cleanISBN,
        publisher: book.publishers?.[0]?.name || null,
        publish_date: book.publish_date || null,
        cover_url: book.cover?.medium || book.cover?.small || null,
        genre: book.subjects?.[0]?.name || null
      };
    }

    // Try Google Books API as fallback
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanISBN}`;
    const googleResponse = await fetch(googleUrl);
    const googleData = await googleResponse.json();

    if (googleData.items?.length > 0) {
      const book = googleData.items[0].volumeInfo;
      return {
        title: book.title,
        authors: book.authors?.join(' & ') || null,
        isbn: cleanISBN,
        publisher: book.publisher || null,
        publish_date: book.publishedDate || null,
        cover_url: book.imageLinks?.thumbnail || null,
        genre: book.categories?.[0] || null
      };
    }

    return null;
  } catch (error) {
    throw new Error(`API lookup failed: ${error.message}`);
  }
}

async function checkDuplicate(isbn) {
  const result = await pool.query(
    'SELECT id, title FROM books WHERE isbn = $1',
    [isbn]
  );
  return result.rows[0] || null;
}

async function addBook(bookData) {
  const result = await pool.query(
    `INSERT INTO books (title, author, isbn, publisher, publish_date, genre, type, location, cover_url, reading_status, progress)
     VALUES ($1, $2, $3, $4, $5, $6, 'physical', $7, $8, 'unread', 0)
     RETURNING id`,
    [bookData.title, bookData.authors, bookData.isbn, bookData.publisher, bookData.publish_date, bookData.genre, bookData.location, bookData.cover_url]
  );
  return result.rows[0].id;
}

// --- Batch import from file ---

async function batchImport(filePath, location) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const isbns = lines
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  if (isbns.length === 0) {
    console.error('No ISBNs found in file.');
    process.exit(1);
  }

  console.log(`=== Batch Import Physical Books ===`);
  console.log(`File:     ${resolvedPath}`);
  console.log(`Location: ${location || '(none)'}`);
  console.log(`ISBNs:    ${isbns.length}\n`);

  const failures = [];
  let added = 0;

  for (const rawIsbn of isbns) {
    const cleanISBN = rawIsbn.replace(/[-\s]/g, '');
    process.stdout.write(`${cleanISBN} ... `);

    // Check for duplicate
    const existing = await checkDuplicate(cleanISBN);
    if (existing) {
      const reason = `Duplicate — already in database as ID ${existing.id}: "${existing.title}"`;
      console.log(`SKIP (${reason})`);
      failures.push({ isbn: cleanISBN, reason });
      continue;
    }

    // Look up metadata
    let book;
    try {
      book = await lookupISBN(rawIsbn);
    } catch (error) {
      const reason = error.message;
      console.log(`FAIL (${reason})`);
      failures.push({ isbn: cleanISBN, reason });
      continue;
    }

    if (!book) {
      const reason = 'Not found in Open Library or Google Books';
      console.log(`FAIL (${reason})`);
      failures.push({ isbn: cleanISBN, reason });
      continue;
    }

    // Insert into database
    book.location = location || null;
    try {
      const id = await addBook(book);
      console.log(`OK — ID ${id}: "${book.title}" by ${book.authors || 'unknown'}`);
      added++;
    } catch (error) {
      const reason = `Database error: ${error.message}`;
      console.log(`FAIL (${reason})`);
      failures.push({ isbn: cleanISBN, reason });
    }
  }

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Added:  ${added}`);
  console.log(`Failed: ${failures.length}`);
  console.log(`Total:  ${isbns.length}`);

  // Write protocol file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const protocolPath = path.join(
    path.dirname(resolvedPath),
    `add-physical-protocol-${timestamp}.txt`
  );

  const protocolLines = [
    `Add Physical Books — Import Protocol`,
    `Date:   ${new Date().toISOString()}`,
    `Source: ${resolvedPath}`,
    `Location: ${location || '(none)'}`,
    ``,
    `Result: ${added} added, ${failures.length} failed out of ${isbns.length} total`,
    ``,
  ];

  if (failures.length > 0) {
    protocolLines.push(`Failed ISBNs:`);
    protocolLines.push(``);
    for (const { isbn, reason } of failures) {
      protocolLines.push(`  ${isbn} — ${reason}`);
    }
  } else {
    protocolLines.push(`All ISBNs imported successfully.`);
  }

  protocolLines.push(``);
  fs.writeFileSync(protocolPath, protocolLines.join('\n'));
  console.log(`\nProtocol written to: ${protocolPath}`);
}

// --- Interactive mode ---

async function interactive() {
  console.log('=== Add Physical Books ===');
  console.log('Enter ISBN to look up book data. Type "quit" to exit.\n');

  while (true) {
    const isbn = await prompt('ISBN: ');

    if (isbn.toLowerCase() === 'quit' || isbn.toLowerCase() === 'q') {
      break;
    }

    if (!isbn.trim()) {
      continue;
    }

    console.log('Looking up...');
    let book;
    try {
      book = await lookupISBN(isbn);
    } catch (error) {
      console.error('Error looking up ISBN:', error.message);
      book = null;
    }

    if (!book) {
      console.log('Book not found. Enter manually or try another ISBN.\n');
      const manual = await prompt('Enter manually? (y/n): ');
      if (manual.toLowerCase() === 'y') {
        book = {
          title: await prompt('Title: '),
          authors: await prompt('Author(s): '),
          isbn: isbn.replace(/[-\s]/g, ''),
          publisher: await prompt('Publisher: ') || null,
          publish_date: await prompt('Publish date: ') || null,
          genre: await prompt('Genre: ') || null,
          cover_url: null
        };
      } else {
        continue;
      }
    }

    console.log('\nFound:');
    console.log(`  Title:     ${book.title}`);
    console.log(`  Author:    ${book.authors || '(unknown)'}`);
    console.log(`  Publisher: ${book.publisher || '(unknown)'}`);
    console.log(`  Published: ${book.publish_date || '(unknown)'}`);
    console.log(`  Genre:     ${book.genre || '(none)'}`);
    console.log(`  Cover:     ${book.cover_url ? 'Yes' : 'No'}`);

    const confirm = await prompt('\nAdd this book? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Skipped.\n');
      continue;
    }

    const location = await prompt('Location (e.g., "living room shelf"): ');
    book.location = location || null;

    try {
      const id = await addBook(book);
      console.log(`Added with ID ${id}.\n`);
    } catch (error) {
      console.error('Error adding book:', error.message, '\n');
    }
  }

  console.log('Goodbye!');
}

// --- Entry point ---

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // Batch mode: node add-physical.js <isbn-file> [location]
    await batchImport(args[0], args[1] || null);
  } else {
    // Interactive mode (original behavior)
    await interactive();
  }

  rl.close();
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
