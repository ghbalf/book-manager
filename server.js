const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const CALIBRE_PATH = process.env.CALIBRE_PATH || path.join(require('os').homedir(), 'Documents', 'Calibre Library');

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
