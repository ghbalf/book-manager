const API_URL = '/api/books';

// DOM Elements
const booksList = document.getElementById('booksList');
const bookModal = document.getElementById('bookModal');
const deleteModal = document.getElementById('deleteModal');
const bookForm = document.getElementById('bookForm');
const modalTitle = document.getElementById('modalTitle');
const addBookBtn = document.getElementById('addBookBtn');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const statusFilter = document.getElementById('statusFilter');
const genreFilter = document.getElementById('genreFilter');
const sortSelect = document.getElementById('sortSelect');
const typeSelect = document.getElementById('type');
const locationGroup = document.getElementById('locationGroup');
const filePathGroup = document.getElementById('filePathGroup');
const starRating = document.getElementById('starRating');
const ratingInput = document.getElementById('rating');

let deleteBookId = null;
let debounceTimer = null;
let currentView = 'grid';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadBooks();
  loadStats();
  setupEventListeners();
});

async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();
    document.getElementById('stats').innerHTML = `
      <span>Total: <span class="count">${stats.total}</span></span>
      <span>Physical: <span class="count">${stats.physical}</span></span>
      <span>Ebooks: <span class="count">${stats.ebooks}</span></span>
    `;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function setupEventListeners() {
  addBookBtn.addEventListener('click', () => openModal());
  closeBtn.addEventListener('click', () => closeModal());
  cancelBtn.addEventListener('click', () => closeModal());
  bookForm.addEventListener('submit', handleSubmit);

  cancelDeleteBtn.addEventListener('click', () => closeDeleteModal());
  confirmDeleteBtn.addEventListener('click', handleDelete);

  // Filter listeners with debounce
  searchInput.addEventListener('input', debounceLoadBooks);
  typeFilter.addEventListener('change', loadBooks);
  statusFilter.addEventListener('change', loadBooks);
  genreFilter.addEventListener('input', debounceLoadBooks);
  sortSelect.addEventListener('change', loadBooks);

  // Clear buttons
  document.querySelectorAll('.clear-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.value = '';
      input.focus();
      loadBooks();
    });
  });

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      booksList.className = currentView === 'list' ? 'books-list' : 'books-grid';
    });
  });

  // Type change handler
  typeSelect.addEventListener('change', handleTypeChange);

  // Star rating
  starRating.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const value = star.dataset.value;
      setRating(value);
    });
  });

  // Close modals on outside click
  window.addEventListener('click', (e) => {
    if (e.target === bookModal) closeModal();
    if (e.target === deleteModal) closeDeleteModal();
  });
}

function debounceLoadBooks() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadBooks, 300);
}

async function loadBooks() {
  const params = new URLSearchParams();
  if (searchInput.value) params.append('search', searchInput.value);
  if (typeFilter.value) params.append('type', typeFilter.value);
  if (statusFilter.value) params.append('status', statusFilter.value);
  if (genreFilter.value) params.append('genre', genreFilter.value);
  if (sortSelect.value) params.append('sort', sortSelect.value);

  try {
    const response = await fetch(`${API_URL}?${params}`);
    const books = await response.json();
    renderBooks(books);
  } catch (error) {
    console.error('Error loading books:', error);
    booksList.innerHTML = '<div class="empty-state"><h3>Error loading books</h3><p>Please try again later.</p></div>';
  }
}

function renderBooks(books) {
  booksList.className = currentView === 'list' ? 'books-list' : 'books-grid';

  if (books.length === 0) {
    booksList.innerHTML = '<div class="empty-state"><h3>No books found</h3><p>Add your first book to get started!</p></div>';
    return;
  }

  booksList.innerHTML = books.map(book => `
    <div class="book-card">
      <img src="${book.cover_url ? escapeHtml(book.cover_url) : `/api/covers/${book.id}`}" alt="${escapeHtml(book.title)}" class="book-cover" onerror="this.outerHTML='<div class=\\'book-cover-placeholder\\'>&#128214;</div>'">
      <div class="book-info">
        <h3 class="book-title">${escapeHtml(book.title)}</h3>
        ${book.author ? `<p class="book-author">${escapeHtml(book.author)}</p>` : ''}
        ${book.isbn ? `<p class="book-isbn">ISBN: ${escapeHtml(book.isbn)}</p>` : ''}
        ${book.publisher || book.publish_date ? `<p class="book-publisher">${escapeHtml(book.publisher || '')}${book.publisher && book.publish_date ? ', ' : ''}${escapeHtml(book.publish_date || '')}</p>` : ''}
        <div class="book-meta">
          <span class="badge badge-${book.type}">${book.type}</span>
          <span class="badge badge-${book.reading_status}">${book.reading_status}</span>
          ${book.genre ? `<span class="badge">${escapeHtml(book.genre)}</span>` : ''}
        </div>
        ${book.reading_status !== 'unread' ? `
          <div class="book-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${book.progress}%"></div>
            </div>
            <span class="progress-text">${book.progress}% complete</span>
          </div>
        ` : ''}
        ${book.rating ? `
          <div class="book-rating">
            ${renderStars(book.rating)}
          </div>
        ` : ''}
        ${book.type === 'physical' && book.location ? `
          <div class="book-location">&#128205; ${escapeHtml(book.location)}</div>
        ` : ''}
        ${book.type === 'ebook' && book.file_path ? `
          <div class="book-location">&#128196; ${escapeHtml(book.file_path)}</div>
        ` : ''}
        <div class="book-actions">
          <button class="btn btn-secondary btn-small" onclick="openModal(${book.id})">Edit</button>
          <button class="btn btn-danger btn-small" onclick="openDeleteModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += `<span class="${i <= rating ? '' : 'star-empty'}">&#9733;</span>`;
  }
  return stars;
}

function openModal(bookId = null) {
  bookForm.reset();
  setRating(null);
  handleTypeChange();

  if (bookId) {
    modalTitle.textContent = 'Edit Book';
    loadBook(bookId);
  } else {
    modalTitle.textContent = 'Add Book';
    document.getElementById('bookId').value = '';
  }

  bookModal.style.display = 'block';
}

async function loadBook(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`);
    const book = await response.json();

    document.getElementById('bookId').value = book.id;
    document.getElementById('title').value = book.title || '';
    document.getElementById('author').value = book.author || '';
    document.getElementById('isbn').value = book.isbn || '';
    document.getElementById('publisher').value = book.publisher || '';
    document.getElementById('publishDate').value = book.publish_date || '';
    document.getElementById('genre').value = book.genre || '';
    document.getElementById('type').value = book.type;
    document.getElementById('location').value = book.location || '';
    document.getElementById('filePath').value = book.file_path || '';
    document.getElementById('coverUrl').value = book.cover_url || '';
    document.getElementById('readingStatus').value = book.reading_status || 'unread';
    document.getElementById('progress').value = book.progress || 0;
    document.getElementById('notes').value = book.notes || '';

    setRating(book.rating);
    handleTypeChange();
  } catch (error) {
    console.error('Error loading book:', error);
    alert('Failed to load book details');
    closeModal();
  }
}

function closeModal() {
  bookModal.style.display = 'none';
}

async function handleSubmit(e) {
  e.preventDefault();

  const bookId = document.getElementById('bookId').value;
  const bookData = {
    title: document.getElementById('title').value,
    author: document.getElementById('author').value,
    isbn: document.getElementById('isbn').value,
    publisher: document.getElementById('publisher').value,
    publish_date: document.getElementById('publishDate').value,
    genre: document.getElementById('genre').value,
    type: document.getElementById('type').value,
    location: document.getElementById('location').value,
    file_path: document.getElementById('filePath').value,
    cover_url: document.getElementById('coverUrl').value,
    reading_status: document.getElementById('readingStatus').value,
    progress: parseInt(document.getElementById('progress').value) || 0,
    rating: ratingInput.value ? parseInt(ratingInput.value) : null,
    notes: document.getElementById('notes').value,
  };

  try {
    const method = bookId ? 'PUT' : 'POST';
    const url = bookId ? `${API_URL}/${bookId}` : API_URL;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save book');
    }

    closeModal();
    loadBooks();
    loadStats();
  } catch (error) {
    console.error('Error saving book:', error);
    alert(error.message);
  }
}

function handleTypeChange() {
  const type = typeSelect.value;
  if (type === 'physical') {
    locationGroup.style.display = 'block';
    filePathGroup.style.display = 'none';
  } else {
    locationGroup.style.display = 'none';
    filePathGroup.style.display = 'block';
  }
}

function setRating(value) {
  ratingInput.value = value || '';
  starRating.querySelectorAll('.star').forEach(star => {
    star.classList.toggle('active', value && star.dataset.value <= value);
  });
}

function openDeleteModal(id, title) {
  deleteBookId = id;
  document.getElementById('deleteBookTitle').textContent = title;
  deleteModal.style.display = 'block';
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
  deleteBookId = null;
}

async function handleDelete() {
  if (!deleteBookId) return;

  try {
    const response = await fetch(`${API_URL}/${deleteBookId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete book');
    }

    closeDeleteModal();
    loadBooks();
    loadStats();
  } catch (error) {
    console.error('Error deleting book:', error);
    alert('Failed to delete book');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
