const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'bookmanager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// SQL expression to extract family name from first author
// Handles: "John Doe" -> "Doe", "Doe, John" -> "Doe", "John Doe & Jane Smith" -> "Doe"
const FAMILY_NAME_SQL = `
  CASE
    WHEN split_part(author, '&', 1) LIKE '%,%'
    THEN trim(split_part(split_part(author, '&', 1), ',', 1))
    ELSE trim(reverse(split_part(reverse(trim(split_part(author, '&', 1))), ' ', 1)))
  END
`;

async function getAllBooks(filters = {}) {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (filters.search) {
    // Search in title, author (by family name pattern), and ISBN
    conditions.push(`(title ILIKE $${paramIndex} OR author ILIKE $${paramIndex} OR isbn ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters.type) {
    conditions.push(`type = $${paramIndex}`);
    values.push(filters.type);
    paramIndex++;
  }

  if (filters.status) {
    conditions.push(`reading_status = $${paramIndex}`);
    values.push(filters.status);
    paramIndex++;
  }

  if (filters.genre) {
    conditions.push(`genre ILIKE $${paramIndex}`);
    values.push(`%${filters.genre}%`);
    paramIndex++;
  }

  let query = 'SELECT * FROM books';
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  // Sorting
  const sortOptions = {
    'updated': 'updated_at DESC',
    'title': 'title ASC',
    'author': `${FAMILY_NAME_SQL} ASC NULLS LAST, title ASC`,
    'rating': 'rating DESC NULLS LAST, title ASC',
  };
  const orderBy = sortOptions[filters.sort] || sortOptions['updated'];
  query += ` ORDER BY ${orderBy}`;

  const result = await pool.query(query, values);
  return result.rows;
}

async function getBookById(id) {
  const result = await pool.query('SELECT * FROM books WHERE id = $1', [id]);
  return result.rows[0];
}

async function createBook(book) {
  const result = await pool.query(
    `INSERT INTO books (title, author, isbn, publisher, publish_date, genre, type, location, file_path, cover_url, reading_status, progress, rating, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      book.title,
      book.author || null,
      book.isbn || null,
      book.publisher || null,
      book.publish_date || null,
      book.genre || null,
      book.type,
      book.location || null,
      book.file_path || null,
      book.cover_url || null,
      book.reading_status || 'unread',
      book.progress || 0,
      book.rating || null,
      book.notes || null,
    ]
  );
  return result.rows[0];
}

async function updateBook(id, book) {
  const result = await pool.query(
    `UPDATE books SET
       title = $1,
       author = $2,
       isbn = $3,
       publisher = $4,
       publish_date = $5,
       genre = $6,
       type = $7,
       location = $8,
       file_path = $9,
       cover_url = $10,
       reading_status = $11,
       progress = $12,
       rating = $13,
       notes = $14,
       updated_at = NOW()
     WHERE id = $15
     RETURNING *`,
    [
      book.title,
      book.author || null,
      book.isbn || null,
      book.publisher || null,
      book.publish_date || null,
      book.genre || null,
      book.type,
      book.location || null,
      book.file_path || null,
      book.cover_url || null,
      book.reading_status || 'unread',
      book.progress || 0,
      book.rating || null,
      book.notes || null,
      id,
    ]
  );
  return result.rows[0];
}

async function deleteBook(id) {
  const result = await pool.query('DELETE FROM books WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

async function getStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE type = 'ebook') as ebooks,
      COUNT(*) FILTER (WHERE type = 'physical') as physical
    FROM books
  `);
  return result.rows[0];
}

module.exports = {
  pool,
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getStats,
};
