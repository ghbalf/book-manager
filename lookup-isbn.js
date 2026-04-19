// Shared ISBN/cover lookup against Open Library and Google Books.
// Used by CLI scripts (add-physical.js, fetch-covers.js) and the HTTP API.

function cleanIsbn(isbn) {
  return String(isbn || '').replace(/[-\s]/g, '');
}

async function tryOpenLibrary(isbn) {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const entry = data[`ISBN:${isbn}`];
  if (!entry) return null;
  return {
    title: entry.title || null,
    authors: entry.authors?.map(a => a.name).join(' & ') || null,
    isbn,
    publisher: entry.publishers?.[0]?.name || null,
    publish_date: entry.publish_date || null,
    cover_url: entry.cover?.medium || entry.cover?.small || null,
    genre: entry.subjects?.[0]?.name || null,
  };
}

async function tryGoogleBooks(isbn) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const info = data.items?.[0]?.volumeInfo;
  if (!info) return null;
  return {
    title: info.title || null,
    authors: info.authors?.join(' & ') || null,
    isbn,
    publisher: info.publisher || null,
    publish_date: info.publishedDate || null,
    cover_url: info.imageLinks?.thumbnail || null,
    genre: info.categories?.[0] || null,
  };
}

// Returns full metadata object or null if not found.
// Network/parse errors per-provider are swallowed so fallback can run.
async function lookupISBN(rawIsbn) {
  const isbn = cleanIsbn(rawIsbn);
  if (!isbn) return null;

  let result = null;
  try { result = await tryOpenLibrary(isbn); } catch { /* try fallback */ }
  if (result) return result;

  try { result = await tryGoogleBooks(isbn); } catch { /* give up */ }
  return result;
}

// Cover-only convenience. Returns URL string or null.
async function lookupCover(rawIsbn) {
  const book = await lookupISBN(rawIsbn);
  return book?.cover_url || null;
}

module.exports = { lookupISBN, lookupCover, cleanIsbn };
