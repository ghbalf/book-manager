const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { lookupISBN, lookupCover, cleanIsbn } = require('./lookup-isbn');
const { getConfig, setConfig, getDbInfo, EDITABLE_KEYS } = require('./config');
const calibreSync = require('./calibre-sync');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/covers', express.static(path.join(__dirname, 'covers')));

// GET /api/covers/:id - Serve cover image for a book
app.get('/api/covers/:id', async (req, res) => {
  try {
    const book = await db.getBookById(req.params.id);
    if (!book) {
      return res.status(404).send('Book not found');
    }

    // If book has a cover_url, redirect to it
    if (book.cover_url) {
      return res.redirect(book.cover_url);
    }

    // For ebooks from Calibre, try to find cover.jpg in the book's directory
    // file_path is like: .../Author/Book Title (123)/FORMAT/file.epub
    // cover.jpg is at:   .../Author/Book Title (123)/cover.jpg
    if (book.type === 'ebook' && book.file_path) {
      const bookDir = path.dirname(path.dirname(book.file_path));
      const coverPath = path.join(bookDir, 'cover.jpg');

      if (fs.existsSync(coverPath)) {
        return res.sendFile(coverPath);
      }
    }

    res.status(404).send('Cover not found');
  } catch (err) {
    console.error('Error serving cover:', err);
    res.status(500).send('Error serving cover');
  }
});

// GET /api/books/:id/read - Serve epub file for reading
app.get('/api/books/:id/read', async (req, res) => {
  try {
    const book = await db.getBookById(req.params.id);
    if (!book) {
      return res.status(404).send('Book not found');
    }

    if (book.type !== 'ebook' || !book.file_path) {
      return res.status(400).send('No ebook file available');
    }

    // The book directory is two levels up from the stored file_path
    // (file_path pattern: .../Author/Book Title (ID)/FORMAT/file.ext)
    // Actual epub lives at: .../Author/Book Title (ID)/file.epub
    const bookDir = path.dirname(path.dirname(book.file_path));
    const files = fs.existsSync(bookDir) ? fs.readdirSync(bookDir) : [];
    const epubFile = files.find(f => f.toLowerCase().endsWith('.epub'));

    if (!epubFile) {
      console.log('[read] No .epub found in:', bookDir);
      return res.status(404).send('No epub file found for this book');
    }

    const epubPath = path.join(bookDir, epubFile);
    console.log('[read] Serving epub:', epubPath);
    res.sendFile(epubPath, {
      headers: { 'Content-Type': 'application/epub+zip' }
    });
  } catch (err) {
    console.error('Error serving ebook:', err);
    res.status(500).send('Error serving ebook');
  }
});

// GET /api/stats - Get book counts
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/books - List all books with optional filters
app.get('/api/books', async (req, res) => {
  try {
    const filters = {
      search: req.query.search,
      type: req.query.type,
      status: req.query.status,
      genre: req.query.genre,
      sort: req.query.sort,
    };
    const books = await db.getAllBooks(filters);
    res.json(books);
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// GET /api/books/:id - Get single book
app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await db.getBookById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(book);
  } catch (err) {
    console.error('Error fetching book:', err);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// POST /api/books - Add new book
app.post('/api/books', async (req, res) => {
  try {
    const { title, type } = req.body;
    if (!title || !type) {
      return res.status(400).json({ error: 'Title and type are required' });
    }
    if (!['physical', 'ebook'].includes(type)) {
      return res.status(400).json({ error: 'Type must be physical or ebook' });
    }
    const book = await db.createBook(req.body);
    res.status(201).json(book);
  } catch (err) {
    console.error('Error creating book:', err);
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// PUT /api/books/:id - Update book
app.put('/api/books/:id', async (req, res) => {
  try {
    const { title, type } = req.body;
    if (!title || !type) {
      return res.status(400).json({ error: 'Title and type are required' });
    }
    if (!['physical', 'ebook'].includes(type)) {
      return res.status(400).json({ error: 'Type must be physical or ebook' });
    }
    const book = await db.updateBook(req.params.id, req.body);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json(book);
  } catch (err) {
    console.error('Error updating book:', err);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// DELETE /api/books/:id - Delete book
app.delete('/api/books/:id', async (req, res) => {
  try {
    const book = await db.deleteBook(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    res.json({ message: 'Book deleted successfully', book });
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// --- Config ---

// GET /api/config - Return editable config plus read-only DB info
app.get('/api/config', (req, res) => {
  res.json({ ...getConfig(), db: getDbInfo() });
});

// PUT /api/config - Update editable config fields
app.put('/api/config', (req, res) => {
  try {
    const patch = {};
    for (const key of EDITABLE_KEYS) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    const next = setConfig(patch);
    res.json({ ...next, db: getDbInfo() });
  } catch (err) {
    console.error('Error saving config:', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// --- ISBN / cover lookup ---

// GET /api/lookup/isbn?isbn=X - Full metadata lookup
app.get('/api/lookup/isbn', async (req, res) => {
  const isbn = cleanIsbn(req.query.isbn);
  if (!isbn) return res.status(400).json({ error: 'ISBN query param is required' });
  try {
    const book = await lookupISBN(isbn);
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json(book);
  } catch (err) {
    console.error('Error looking up ISBN:', err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// GET /api/lookup/cover?isbn=X - Cover-only lookup
app.get('/api/lookup/cover', async (req, res) => {
  const isbn = cleanIsbn(req.query.isbn);
  if (!isbn) return res.status(400).json({ error: 'ISBN query param is required' });
  try {
    const url = await lookupCover(isbn);
    if (!url) return res.status(404).json({ error: 'Not found' });
    res.json({ url });
  } catch (err) {
    console.error('Error looking up cover:', err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// --- Calibre sync ---

// POST /api/calibre/sync - Start import + new-ebook metadata update
app.post('/api/calibre/sync', (req, res) => {
  if (calibreSync.isRunning()) {
    return res.status(409).json({ error: 'Sync already running' });
  }
  calibreSync.runSync().catch(err => console.error('Sync failed:', err));
  res.status(202).json({ started: true });
});

// POST /api/calibre/rescan - Rescan metadata for all ebooks
app.post('/api/calibre/rescan', (req, res) => {
  if (calibreSync.isRunning()) {
    return res.status(409).json({ error: 'Sync already running' });
  }
  calibreSync.runRescan().catch(err => console.error('Rescan failed:', err));
  res.status(202).json({ started: true });
});

// GET /api/calibre/sync/stream - SSE progress stream
app.get('/api/calibre/sync/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const send = (event) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'done' || event.type === 'error') {
      res.end();
    }
  };

  const unsubscribe = calibreSync.subscribe(send);
  req.on('close', unsubscribe);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
