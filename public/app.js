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

// Reader state
let currentBook = null;
let currentEpub = null;
let currentRendition = null;
let readerFontSize = 100;

// Badge translation map: DB value -> i18n key
const badgeTypeKeys = { physical: 'badgePhysical', ebook: 'badgeEbook' };
const badgeStatusKeys = { unread: 'badgeUnread', reading: 'badgeReading', finished: 'badgeFinished' };

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  applyLanguage(currentLang);
  updateThemeButton();
  loadBooks();
  loadStats();
  setupEventListeners();
  setupConfigModal();
});

async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();
    document.getElementById('stats').innerHTML = `
      <span>${t('statsTotal')} <span class="count">${stats.total}</span></span>
      <span>${t('statsPhysical')} <span class="count">${stats.physical}</span></span>
      <span>${t('statsEbooks')} <span class="count">${stats.ebooks}</span></span>
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

  // Physical read modal
  document.getElementById('closeReadPhysicalBtn').addEventListener('click', closeReadPhysicalModal);

  // Reader controls
  document.getElementById('readerCloseBtn').addEventListener('click', closeEbookReader);
  document.getElementById('readerPrevBtn').addEventListener('click', () => { if (currentRendition) currentRendition.prev(); });
  document.getElementById('readerNextBtn').addEventListener('click', () => { if (currentRendition) currentRendition.next(); });
  document.getElementById('readerTocBtn').addEventListener('click', () => {
    document.getElementById('readerTocPanel').classList.toggle('active');
  });
  document.getElementById('readerFontSmallerBtn').addEventListener('click', () => changeReaderFontSize(-10));
  document.getElementById('readerFontLargerBtn').addEventListener('click', () => changeReaderFontSize(10));
  document.addEventListener('keydown', handleReaderKeyboard);

  // Close modals on outside click
  const readPhysicalModal = document.getElementById('readPhysicalModal');
  window.addEventListener('click', (e) => {
    if (e.target === bookModal) closeModal();
    if (e.target === deleteModal) closeDeleteModal();
    if (e.target === readPhysicalModal) closeReadPhysicalModal();
  });

  // Language switcher
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      applyLanguage(btn.dataset.lang);
      loadBooks();
      loadStats();
    });
  });

  // Theme toggle
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    toggleTheme();
  });

  // Sync from Calibre
  document.getElementById('syncBtn').addEventListener('click', startSync);
  document.getElementById('syncCloseBtn').addEventListener('click', closeSyncModal);

  // Config
  document.getElementById('configBtn').addEventListener('click', openConfigModal);

  // ISBN / cover lookup buttons inside Add/Edit modal
  document.getElementById('lookupIsbnBtn').addEventListener('click', handleIsbnLookup);
  document.getElementById('lookupCoverBtn').addEventListener('click', handleCoverLookup);
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
    booksList.innerHTML = `<div class="empty-state"><h3>${t('errorLoadingTitle')}</h3><p>${t('errorLoadingText')}</p></div>`;
  }
}

function renderBooks(books) {
  booksList.className = currentView === 'list' ? 'books-list' : 'books-grid';

  if (books.length === 0) {
    booksList.innerHTML = `<div class="empty-state"><h3>${t('noBooksTitle')}</h3><p>${t('noBooksText')}</p></div>`;
    return;
  }

  booksList.innerHTML = books.map(book => `
    <div class="book-card">
      <img src="${book.cover_url ? escapeHtml(book.cover_url) : `/api/covers/${book.id}`}" alt="${escapeHtml(book.title)}" class="book-cover" onerror="this.outerHTML='<div class=\\'book-cover-placeholder\\'>&#128214;</div>'">
      <div class="book-info">
        <h3 class="book-title">${escapeHtml(book.title)}</h3>
        ${book.author ? `<p class="book-author">${escapeHtml(book.author)}</p>` : ''}
        <p class="book-id">ID: ${book.id}${book.isbn ? ` · ISBN: ${escapeHtml(book.isbn)}` : ''}</p>
        ${book.publisher || book.publish_date ? `<p class="book-publisher">${escapeHtml(book.publisher || '')}${book.publisher && book.publish_date ? ', ' : ''}${escapeHtml(book.publish_date || '')}</p>` : ''}
        <div class="book-meta">
          <span class="badge badge-${book.type}">${t(badgeTypeKeys[book.type] || book.type)}</span>
          <span class="badge badge-${book.reading_status}">${t(badgeStatusKeys[book.reading_status] || book.reading_status)}</span>
          ${book.genre ? `<span class="badge">${escapeHtml(book.genre)}</span>` : ''}
        </div>
        ${book.reading_status !== 'unread' ? `
          <div class="book-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${book.progress}%"></div>
            </div>
            <span class="progress-text">${book.progress}${t('progressComplete')}</span>
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
          <button class="btn btn-read btn-small" onclick="handleReadBook(${book.id})">${t('read')}</button>
          <button class="btn btn-secondary btn-small" onclick="openModal(${book.id})">${t('edit')}</button>
          <button class="btn btn-danger btn-small" onclick="openDeleteModal(${book.id}, '${escapeHtml(book.title).replace(/'/g, "\\'")}')">${t('delete')}</button>
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
    modalTitle.textContent = t('editBookTitle');
    modalTitle.dataset.i18n = 'editBookTitle';
    loadBook(bookId);
  } else {
    modalTitle.textContent = t('addBookTitle');
    modalTitle.dataset.i18n = 'addBookTitle';
    document.getElementById('bookId').value = '';
    document.getElementById('idGroup').style.display = 'none';
  }

  bookModal.style.display = 'block';
}

async function loadBook(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`);
    const book = await response.json();

    document.getElementById('bookId').value = book.id;
    document.getElementById('displayId').value = book.id;
    document.getElementById('idGroup').style.display = 'block';
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
    alert(t('errorLoadBook'));
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
      throw new Error(error.error || t('errorSaveBook'));
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
      throw new Error(t('errorDeleteBook'));
    }

    closeDeleteModal();
    loadBooks();
    loadStats();
  } catch (error) {
    console.error('Error deleting book:', error);
    alert(t('errorDeleteBook'));
  }
}

// --- Read Book ---

async function handleReadBook(bookId) {
  try {
    const response = await fetch(`${API_URL}/${bookId}`);
    const book = await response.json();

    if (book.type === 'physical') {
      openReadPhysicalModal(book);
    } else if (book.type === 'ebook') {
      if (!book.file_path) {
        alert(t('readerNoFile'));
        return;
      }
      openEbookReader(book);
    }
  } catch (error) {
    console.error('Error fetching book for read:', error);
  }
}

// --- Physical Read Modal ---

function openReadPhysicalModal(book) {
  document.getElementById('readPhysicalBookTitle').textContent = book.title;
  const locationEl = document.getElementById('readPhysicalLocation');
  if (book.location) {
    locationEl.innerHTML = `<strong>${t('readPhysicalLocation')}</strong> ${escapeHtml(book.location)}`;
  } else {
    locationEl.textContent = t('readPhysicalNoLocation');
  }
  document.getElementById('readPhysicalModal').style.display = 'block';
}

function closeReadPhysicalModal() {
  document.getElementById('readPhysicalModal').style.display = 'none';
}

// --- Ebook Reader ---

function openEbookReader(book) {
  currentBook = book;
  readerFontSize = 100;
  document.getElementById('readerBookTitle').textContent = book.title;
  document.getElementById('readerOverlay').classList.add('active');
  document.getElementById('readerTocPanel').classList.remove('active');

  // Wait one frame so the overlay is laid out and #epubViewer has dimensions
  requestAnimationFrame(async () => {
    try {
      const viewer = document.getElementById('epubViewer');

      // Fetch the entire epub as a binary blob so epub.js doesn't try
      // to resolve internal paths relative to the URL
      const response = await fetch(`/api/books/${book.id}/read`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const blob = await response.arrayBuffer();

      currentEpub = ePub(blob);
      currentRendition = currentEpub.renderTo(viewer, {
        width: viewer.clientWidth,
        height: viewer.clientHeight,
        spread: 'auto'
      });

      await currentRendition.display();
      applyReaderTheme();

      currentEpub.loaded.navigation.then(nav => {
        renderToc(nav.toc);
      });

      // Bind keyboard inside iframe
      currentRendition.on('keydown', handleReaderKeyboard);
    } catch (err) {
      console.error('Error opening ebook:', err);
      alert(t('readerError'));
      closeEbookReader();
    }
  });
}

function destroyReader() {
  if (currentRendition) {
    currentRendition.destroy();
    currentRendition = null;
  }
  if (currentEpub) {
    currentEpub.destroy();
    currentEpub = null;
  }
  currentBook = null;
  document.getElementById('epubViewer').innerHTML = '';
  document.getElementById('readerTocList').innerHTML = '';
}

function closeEbookReader() {
  destroyReader();
  document.getElementById('readerOverlay').classList.remove('active');
  document.getElementById('readerTocPanel').classList.remove('active');
}

function handleReaderKeyboard(e) {
  if (!document.getElementById('readerOverlay').classList.contains('active')) return;

  if (e.key === 'ArrowLeft') {
    if (currentRendition) currentRendition.prev();
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    if (currentRendition) currentRendition.next();
    e.preventDefault();
  } else if (e.key === 'Escape') {
    closeEbookReader();
    e.preventDefault();
  }
}

function applyReaderTheme() {
  if (!currentRendition) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  if (isDark) {
    currentRendition.themes.default({
      body: { color: '#e0e0e0', background: '#2c2c3e' },
      'a, a:link, a:visited': { color: '#5dade2' }
    });
  } else {
    currentRendition.themes.default({
      body: { color: '#333333', background: '#ffffff' },
      'a, a:link, a:visited': { color: '#3498db' }
    });
  }
}

function renderToc(toc) {
  const list = document.getElementById('readerTocList');
  list.innerHTML = '';

  function buildItems(items, parent) {
    items.forEach(item => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.textContent = item.label.trim();
      a.href = '#';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentRendition) currentRendition.display(item.href);
        document.getElementById('readerTocPanel').classList.remove('active');
      });
      li.appendChild(a);

      if (item.subitems && item.subitems.length > 0) {
        const subList = document.createElement('ul');
        buildItems(item.subitems, subList);
        li.appendChild(subList);
      }

      parent.appendChild(li);
    });
  }

  buildItems(toc, list);
}

function changeReaderFontSize(delta) {
  readerFontSize = Math.max(60, Math.min(200, readerFontSize + delta));
  if (currentRendition) {
    currentRendition.themes.fontSize(readerFontSize + '%');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- Calibre sync ---

let syncSource = null;

async function startSync(endpoint, titleKey) {
  endpoint = endpoint || '/api/calibre/sync';
  titleKey = titleKey || 'syncModalTitle';
  openSyncModal(titleKey);

  try {
    const res = await fetch(endpoint, { method: 'POST' });
    if (!res.ok && res.status !== 409) {
      showSyncError(t('syncFailed'));
      return;
    }
  } catch (err) {
    showSyncError(t('syncFailed'));
    return;
  }

  attachSyncStream();
}

function openSyncModal(titleKey) {
  document.getElementById('syncModalTitle').textContent = t(titleKey || 'syncModalTitle');
  document.getElementById('syncPhase').textContent = t('syncStarting');
  document.getElementById('syncProgressFill').style.width = '0%';
  document.getElementById('syncCounter').textContent = '';
  document.getElementById('syncCurrentTitle').textContent = '';
  const resultEl = document.getElementById('syncResult');
  resultEl.className = 'sync-result';
  resultEl.textContent = '';
  document.getElementById('syncCloseBtn').disabled = true;
  document.getElementById('syncModal').style.display = 'block';
}

function closeSyncModal() {
  document.getElementById('syncModal').style.display = 'none';
  if (syncSource) {
    syncSource.close();
    syncSource = null;
  }
}

function attachSyncStream() {
  if (syncSource) syncSource.close();
  syncSource = new EventSource('/api/calibre/sync/stream');

  syncSource.onmessage = (e) => {
    const event = JSON.parse(e.data);
    handleSyncEvent(event);
  };

  syncSource.onerror = () => {
    if (syncSource) {
      syncSource.close();
      syncSource = null;
    }
  };
}

function handleSyncEvent(event) {
  const phaseEl = document.getElementById('syncPhase');
  const fillEl = document.getElementById('syncProgressFill');
  const counterEl = document.getElementById('syncCounter');
  const titleEl = document.getElementById('syncCurrentTitle');

  if (event.type === 'progress') {
    const phaseKey = event.phase === 'import' ? 'syncPhaseImport' : 'syncPhaseMetadata';
    phaseEl.textContent = t(phaseKey);
    const pct = event.total ? Math.round((event.current / event.total) * 100) : 0;
    fillEl.style.width = pct + '%';
    counterEl.textContent = `${event.current} / ${event.total}`;
    titleEl.textContent = event.title || '';
  } else if (event.type === 'done') {
    fillEl.style.width = '100%';
    titleEl.textContent = '';
    counterEl.textContent = '';
    const parts = [];
    if (event.import) {
      parts.push(`${t('syncImported')}: ${event.import.imported}`);
      parts.push(`${t('syncSkipped')}: ${event.import.skipped}`);
    }
    if (event.metadata) {
      parts.push(`${t('syncUpdated')}: ${event.metadata.updated}`);
      if (event.metadata.notFound) parts.push(`${t('syncNotFound')}: ${event.metadata.notFound}`);
    }
    const resultEl = document.getElementById('syncResult');
    resultEl.className = 'sync-result success';
    resultEl.textContent = parts.join(' · ');
    phaseEl.textContent = t('syncDone');
    document.getElementById('syncCloseBtn').disabled = false;
    loadBooks();
    loadStats();
  } else if (event.type === 'error') {
    showSyncError(event.message || t('syncFailed'));
  }
}

function showSyncError(message) {
  const resultEl = document.getElementById('syncResult');
  resultEl.className = 'sync-result error';
  resultEl.textContent = message;
  document.getElementById('syncPhase').textContent = t('syncFailed');
  document.getElementById('syncCloseBtn').disabled = false;
}

// --- Config ---

async function openConfigModal() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('Failed to load config');
    const config = await res.json();
    populateConfigModal(config);
    document.getElementById('configModal').style.display = 'block';
  } catch (err) {
    console.error(err);
    alert(t('configLoadError'));
  }
}

function populateConfigModal(config) {
  document.getElementById('configCalibrePath').value = config.calibrePath || '';
  document.getElementById('configCoversDir').value = config.coversDir || '';
  document.getElementById('configDefaultLanguage').value = config.defaultLanguage || 'en';
  document.getElementById('configCoverDelay').value = config.coverLookupDelayMs ?? 200;

  const db = config.db || {};
  const grid = document.getElementById('configDbGrid');
  while (grid.firstChild) grid.removeChild(grid.firstChild);

  const rows = [
    ['host', `${db.host || ''}:${db.port || ''}`],
    ['database', db.database || ''],
    ['user', db.user || ''],
  ];
  for (const [label, value] of rows) {
    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.textContent = value;
    grid.appendChild(labelEl);
    grid.appendChild(valueEl);
  }
}

function closeConfigModal() {
  document.getElementById('configModal').style.display = 'none';
}

async function handleConfigSave(e) {
  e.preventDefault();
  const patch = {
    calibrePath: document.getElementById('configCalibrePath').value,
    coversDir: document.getElementById('configCoversDir').value,
    defaultLanguage: document.getElementById('configDefaultLanguage').value,
    coverLookupDelayMs: parseInt(document.getElementById('configCoverDelay').value, 10) || 0,
  };
  try {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to save config');
    closeConfigModal();
  } catch (err) {
    console.error(err);
    alert(t('configSaveError'));
  }
}

function setupConfigModal() {
  document.getElementById('configCloseX').addEventListener('click', closeConfigModal);
  document.getElementById('configCancelBtn').addEventListener('click', closeConfigModal);
  document.getElementById('configForm').addEventListener('submit', handleConfigSave);
  document.getElementById('configRescanBtn').addEventListener('click', () => {
    closeConfigModal();
    startSync('/api/calibre/rescan', 'rescanModalTitle');
  });
  const modal = document.getElementById('configModal');
  modal.addEventListener('click', (e) => { if (e.target === modal) closeConfigModal(); });
}

// --- ISBN / cover lookup ---

async function handleIsbnLookup() {
  const isbn = document.getElementById('isbn').value.trim();
  if (!isbn) {
    alert(t('lookupNeedIsbn'));
    return;
  }
  const btn = document.getElementById('lookupIsbnBtn');
  btn.disabled = true;
  try {
    const res = await fetch(`/api/lookup/isbn?isbn=${encodeURIComponent(isbn)}`);
    if (res.status === 404) {
      alert(t('lookupNotFound'));
      return;
    }
    if (!res.ok) throw new Error('Lookup failed');
    const book = await res.json();
    applyLookupResult(book);
  } catch (err) {
    console.error(err);
    alert(t('lookupFailed'));
  } finally {
    btn.disabled = false;
  }
}

function applyLookupResult(book) {
  const mapping = [
    ['title', book.title, t('labelTitle')],
    ['author', book.authors, t('labelAuthor')],
    ['publisher', book.publisher, t('labelPublisher')],
    ['publishDate', book.publish_date, t('labelPublishDate')],
    ['genre', book.genre, t('labelGenre')],
    ['coverUrl', book.cover_url, t('labelCoverUrl')],
  ];

  for (const [fieldId, value, label] of mapping) {
    if (!value) continue;
    const el = document.getElementById(fieldId);
    if (!el.value) {
      el.value = value;
    } else if (el.value !== value) {
      if (confirm(`${t('lookupOverwritePrompt')}\n\n${label}: ${el.value}\n→ ${value}`)) {
        el.value = value;
      }
    }
  }
}

async function handleCoverLookup() {
  const isbn = document.getElementById('isbn').value.trim();
  if (!isbn) {
    alert(t('lookupNeedIsbn'));
    return;
  }
  const btn = document.getElementById('lookupCoverBtn');
  btn.disabled = true;
  try {
    const res = await fetch(`/api/lookup/cover?isbn=${encodeURIComponent(isbn)}`);
    if (res.status === 404) {
      alert(t('lookupNotFound'));
      return;
    }
    if (!res.ok) throw new Error('Lookup failed');
    const { url } = await res.json();
    const el = document.getElementById('coverUrl');
    if (!el.value || confirm(`${t('lookupOverwritePrompt')}\n\n${el.value}\n→ ${url}`)) {
      el.value = url;
    }
  } catch (err) {
    console.error(err);
    alert(t('lookupFailed'));
  } finally {
    btn.disabled = false;
  }
}
