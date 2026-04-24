const test = require('node:test');
const assert = require('node:assert/strict');

const { lookupISBN, lookupCover, cleanIsbn } = require('../lookup-isbn');

// Minimal stand-in for the parts of fetch Response lookup-isbn consumes.
function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function installFetch(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return handler(url, calls.length);
  };
  return {
    calls,
    restore() { globalThis.fetch = original; },
  };
}

test('cleanIsbn strips hyphens and whitespace', () => {
  assert.equal(cleanIsbn('978-0-306-40615-7'), '9780306406157');
  assert.equal(cleanIsbn('  978 0306 40615 7 '), '9780306406157');
  assert.equal(cleanIsbn(null), '');
  assert.equal(cleanIsbn(undefined), '');
});

test('lookupISBN returns null for empty input without calling fetch', async () => {
  const fetchMock = installFetch(() => { throw new Error('should not be called'); });
  try {
    assert.equal(await lookupISBN(''), null);
    assert.equal(await lookupISBN(null), null);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});

test('lookupISBN normalises Open Library response and skips Google on hit', async () => {
  const isbn = '9780306406157';
  const fetchMock = installFetch((url) => {
    if (url.includes('openlibrary.org')) {
      return jsonResponse({
        [`ISBN:${isbn}`]: {
          title: 'A Book',
          authors: [{ name: 'Alice' }, { name: 'Bob' }],
          publishers: [{ name: 'PubCo' }],
          publish_date: '2024',
          cover: { medium: 'http://ol/cover-m.jpg', small: 'http://ol/cover-s.jpg' },
          subjects: [{ name: 'Fiction' }],
        },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    const result = await lookupISBN(isbn);
    assert.deepEqual(result, {
      title: 'A Book',
      authors: 'Alice & Bob',
      isbn,
      publisher: 'PubCo',
      publish_date: '2024',
      cover_url: 'http://ol/cover-m.jpg',
      genre: 'Fiction',
    });
    assert.equal(fetchMock.calls.length, 1, 'Google Books should not be called on OL hit');
  } finally {
    fetchMock.restore();
  }
});

test('lookupISBN falls back to Google Books when Open Library returns empty map', async () => {
  const isbn = '9780439708180';
  const fetchMock = installFetch((url) => {
    if (url.includes('openlibrary.org')) return jsonResponse({});
    if (url.includes('googleapis.com')) {
      return jsonResponse({
        items: [{ volumeInfo: {
          title: 'Harry Potter',
          authors: ['J.K. Rowling'],
          publisher: 'Scholastic',
          publishedDate: '1998',
          imageLinks: { thumbnail: 'http://g/cover.jpg' },
          categories: ['Young Adult'],
        } }],
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    const result = await lookupISBN(isbn);
    assert.equal(result.title, 'Harry Potter');
    assert.equal(result.authors, 'J.K. Rowling');
    assert.equal(result.cover_url, 'http://g/cover.jpg');
    assert.equal(result.genre, 'Young Adult');
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
  }
});

test('lookupISBN swallows Open Library errors and still tries Google Books', async () => {
  const fetchMock = installFetch((url) => {
    if (url.includes('openlibrary.org')) throw new Error('ECONNRESET');
    if (url.includes('googleapis.com')) {
      return jsonResponse({ items: [{ volumeInfo: { title: 'Recovered' } }] });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    const result = await lookupISBN('9780000000002');
    assert.equal(result.title, 'Recovered');
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
  }
});

test('lookupISBN returns null when both providers miss', async () => {
  const fetchMock = installFetch((url) => {
    if (url.includes('openlibrary.org')) return jsonResponse({}, { status: 404, ok: false });
    if (url.includes('googleapis.com')) return jsonResponse({});
    throw new Error(`unexpected fetch: ${url}`);
  });
  try {
    assert.equal(await lookupISBN('9780000000003'), null);
    assert.equal(fetchMock.calls.length, 2);
  } finally {
    fetchMock.restore();
  }
});

test('lookupCover returns the cover_url from a successful lookup', async () => {
  const fetchMock = installFetch(() =>
    jsonResponse({
      'ISBN:9780000000004': {
        title: 'X',
        cover: { medium: 'http://ol/x.jpg' },
      },
    })
  );
  try {
    assert.equal(await lookupCover('9780000000004'), 'http://ol/x.jpg');
  } finally {
    fetchMock.restore();
  }
});

test('lookupCover returns null when no provider has a cover', async () => {
  const fetchMock = installFetch(() => jsonResponse({}));
  try {
    assert.equal(await lookupCover('9780000000005'), null);
  } finally {
    fetchMock.restore();
  }
});
