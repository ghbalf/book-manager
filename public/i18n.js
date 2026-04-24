// i18n & Theme System
const translations = {
  en: {
    // Page
    pageTitle: 'Book Manager',
    addBook: '+ Add Book',

    // Stats
    statsTotal: 'Total:',
    statsPhysical: 'Physical:',
    statsEbooks: 'Ebooks:',

    // Filters
    searchPlaceholder: 'Search by title, author, or ISBN...',
    allTypes: 'All Types',
    physical: 'Physical',
    ebook: 'Ebook',
    allStatus: 'All Status',
    unread: 'Unread',
    reading: 'Reading',
    finished: 'Finished',
    genrePlaceholder: 'Filter by genre...',
    sortUpdated: 'Sort: Recently Updated',
    sortTitle: 'Sort: Title',
    sortAuthor: 'Sort: Author',
    sortRating: 'Sort: Rating',
    gridView: 'Grid view',
    listView: 'List view',

    // Form labels
    labelId: 'ID',
    labelTitle: 'Title *',
    labelAuthor: 'Author(s)',
    labelIsbn: 'ISBN',
    labelPublisher: 'Publisher',
    labelPublishDate: 'Publish Date',
    labelGenre: 'Genre',
    labelType: 'Type *',
    labelLocation: 'Location',
    labelFilePath: 'File Path / Source',
    labelCoverUrl: 'Cover Image URL',
    labelReadingStatus: 'Reading Status',
    labelProgress: 'Progress (%)',
    labelRating: 'Rating',
    labelNotes: 'Notes',

    // Form placeholders
    authorPlaceholder: 'e.g., John Doe & Jane Smith',
    isbnPlaceholder: 'e.g., 978-0-13-468599-1',
    publishDatePlaceholder: 'e.g., 2020 or 2020-05-15',
    locationPlaceholder: 'e.g., Living room shelf',
    filePathPlaceholder: 'e.g., /books/mybook.epub',
    coverUrlPlaceholder: 'https://...',

    // Buttons
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    read: 'Read',
    close: 'Close',

    // Modal titles
    addBookTitle: 'Add Book',
    editBookTitle: 'Edit Book',
    deleteBookTitle: 'Delete Book',

    // Delete modal
    deleteConfirmPrefix: 'Are you sure you want to delete "',
    deleteConfirmSuffix: '"?',

    // Badges
    badgePhysical: 'Physical',
    badgeEbook: 'Ebook',
    badgeUnread: 'Unread',
    badgeReading: 'Reading',
    badgeFinished: 'Finished',

    // Book card
    progressComplete: '% complete',

    // Empty / Error states
    noBooksTitle: 'No books found',
    noBooksText: 'Add your first book to get started!',
    errorLoadingTitle: 'Error loading books',
    errorLoadingText: 'Please try again later.',
    errorLoadBook: 'Failed to load book details',
    errorSaveBook: 'Failed to save book',
    errorDeleteBook: 'Failed to delete book',

    // Reader
    readerClose: 'Close reader',
    readerPrev: 'Previous',
    readerNext: 'Next',
    readerToc: 'Table of Contents',
    readerFontSmaller: 'A−',
    readerFontLarger: 'A+',
    readerError: 'Failed to load ebook. The file may be missing or corrupted.',
    readerNoFile: 'No ebook file is associated with this book.',

    // Physical read modal
    readPhysicalTitle: 'Find Your Book',
    readPhysicalMessage: 'This is a physical book. Pick it up from your shelf!',
    readPhysicalLocation: 'Location:',
    readPhysicalNoLocation: 'No location recorded for this book.',

    // Theme
    themeLight: 'Light',
    themeDark: 'Dark',

    // Sync from Calibre
    syncFromCalibre: '⟳ Sync',
    syncFromCalibreTitle: 'Sync from Calibre (import new ebooks)',
    syncModalTitle: 'Syncing from Calibre',
    rescanModalTitle: 'Re-scanning all metadata',
    syncStarting: 'Starting…',
    syncPhaseImport: 'Importing books',
    syncPhaseMetadata: 'Updating metadata',
    syncDone: 'Done',
    syncFailed: 'Sync failed',
    syncStreamFailed: 'Could not connect to sync progress stream',
    syncStreamLost: 'Sync progress stream was interrupted',
    syncImported: 'Imported',
    syncSkipped: 'Skipped',
    syncUpdated: 'Updated',
    syncNotFound: 'Not found',

    // Config
    configTitle: 'Settings',
    configCalibrePath: 'Calibre library path',
    configCoversDir: 'Covers directory',
    configDefaultLanguage: 'Default language',
    configCoverDelay: 'Cover lookup delay (ms)',
    configDbSection: 'Database (read-only)',
    configActionsSection: 'Maintenance',
    configRescanAll: 'Re-scan all metadata from Calibre',
    configLoadError: 'Failed to load settings',
    configSaveError: 'Failed to save settings',

    // ISBN / cover lookup
    lookupIsbnBtn: '🔍',
    lookupIsbnTitle: 'Look up book metadata by ISBN',
    lookupCoverBtn: '🔍',
    lookupCoverTitle: 'Look up cover image by ISBN',
    lookupNeedIsbn: 'Please enter an ISBN first.',
    lookupNotFound: 'No match found for this ISBN.',
    lookupFailed: 'Lookup failed. Please try again.',
    lookupOverwritePrompt: 'Overwrite the existing value?',
  },
  de: {
    // Page
    pageTitle: 'Buchverwaltung',
    addBook: '+ Buch hinzufügen',

    // Stats
    statsTotal: 'Gesamt:',
    statsPhysical: 'Physisch:',
    statsEbooks: 'E-Books:',

    // Filters
    searchPlaceholder: 'Suche nach Titel, Autor oder ISBN...',
    allTypes: 'Alle Typen',
    physical: 'Physisch',
    ebook: 'E-Book',
    allStatus: 'Alle Status',
    unread: 'Ungelesen',
    reading: 'Lesend',
    finished: 'Beendet',
    genrePlaceholder: 'Nach Genre filtern...',
    sortUpdated: 'Sortierung: Zuletzt aktualisiert',
    sortTitle: 'Sortierung: Titel',
    sortAuthor: 'Sortierung: Autor',
    sortRating: 'Sortierung: Bewertung',
    gridView: 'Rasteransicht',
    listView: 'Listenansicht',

    // Form labels
    labelId: 'ID',
    labelTitle: 'Titel *',
    labelAuthor: 'Autor(en)',
    labelIsbn: 'ISBN',
    labelPublisher: 'Verlag',
    labelPublishDate: 'Erscheinungsdatum',
    labelGenre: 'Genre',
    labelType: 'Typ *',
    labelLocation: 'Standort',
    labelFilePath: 'Dateipfad / Quelle',
    labelCoverUrl: 'Cover-Bild-URL',
    labelReadingStatus: 'Lesestatus',
    labelProgress: 'Fortschritt (%)',
    labelRating: 'Bewertung',
    labelNotes: 'Notizen',

    // Form placeholders
    authorPlaceholder: 'z.B., Max Mustermann & Erika Musterfrau',
    isbnPlaceholder: 'z.B., 978-0-13-468599-1',
    publishDatePlaceholder: 'z.B., 2020 oder 2020-05-15',
    locationPlaceholder: 'z.B., Wohnzimmerregal',
    filePathPlaceholder: 'z.B., /books/meinbuch.epub',
    coverUrlPlaceholder: 'https://...',

    // Buttons
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    read: 'Lesen',
    close: 'Schließen',

    // Modal titles
    addBookTitle: 'Buch hinzufügen',
    editBookTitle: 'Buch bearbeiten',
    deleteBookTitle: 'Buch löschen',

    // Delete modal
    deleteConfirmPrefix: 'Möchten Sie „',
    deleteConfirmSuffix: '" wirklich löschen?',

    // Badges
    badgePhysical: 'Physisch',
    badgeEbook: 'E-Book',
    badgeUnread: 'Ungelesen',
    badgeReading: 'Lesend',
    badgeFinished: 'Beendet',

    // Book card
    progressComplete: ' % abgeschlossen',

    // Empty / Error states
    noBooksTitle: 'Keine Bücher gefunden',
    noBooksText: 'Fügen Sie Ihr erstes Buch hinzu!',
    errorLoadingTitle: 'Fehler beim Laden der Bücher',
    errorLoadingText: 'Bitte versuchen Sie es später erneut.',
    errorLoadBook: 'Buchdetails konnten nicht geladen werden',
    errorSaveBook: 'Buch konnte nicht gespeichert werden',
    errorDeleteBook: 'Buch konnte nicht gelöscht werden',

    // Reader
    readerClose: 'Reader schließen',
    readerPrev: 'Zurück',
    readerNext: 'Weiter',
    readerToc: 'Inhaltsverzeichnis',
    readerFontSmaller: 'A−',
    readerFontLarger: 'A+',
    readerError: 'E-Book konnte nicht geladen werden. Die Datei fehlt möglicherweise oder ist beschädigt.',
    readerNoFile: 'Diesem Buch ist keine E-Book-Datei zugeordnet.',

    // Physical read modal
    readPhysicalTitle: 'Buch finden',
    readPhysicalMessage: 'Dies ist ein physisches Buch. Holen Sie es aus Ihrem Regal!',
    readPhysicalLocation: 'Standort:',
    readPhysicalNoLocation: 'Kein Standort für dieses Buch hinterlegt.',

    // Theme
    themeLight: 'Hell',
    themeDark: 'Dunkel',

    // Sync from Calibre
    syncFromCalibre: '⟳ Synchronisieren',
    syncFromCalibreTitle: 'Von Calibre synchronisieren (neue E-Books importieren)',
    syncModalTitle: 'Synchronisiere mit Calibre',
    rescanModalTitle: 'Metadaten neu einlesen',
    syncStarting: 'Starte…',
    syncPhaseImport: 'Bücher importieren',
    syncPhaseMetadata: 'Metadaten aktualisieren',
    syncDone: 'Fertig',
    syncFailed: 'Synchronisierung fehlgeschlagen',
    syncStreamFailed: 'Verbindung zum Synchronisierungs-Stream nicht möglich',
    syncStreamLost: 'Verbindung zum Synchronisierungs-Stream unterbrochen',
    syncImported: 'Importiert',
    syncSkipped: 'Übersprungen',
    syncUpdated: 'Aktualisiert',
    syncNotFound: 'Nicht gefunden',

    // Config
    configTitle: 'Einstellungen',
    configCalibrePath: 'Calibre-Bibliothekspfad',
    configCoversDir: 'Cover-Verzeichnis',
    configDefaultLanguage: 'Standardsprache',
    configCoverDelay: 'Cover-Suchverzögerung (ms)',
    configDbSection: 'Datenbank (nur lesen)',
    configActionsSection: 'Wartung',
    configRescanAll: 'Alle Metadaten von Calibre neu einlesen',
    configLoadError: 'Einstellungen konnten nicht geladen werden',
    configSaveError: 'Einstellungen konnten nicht gespeichert werden',

    // ISBN / cover lookup
    lookupIsbnBtn: '🔍',
    lookupIsbnTitle: 'Buchdaten per ISBN nachschlagen',
    lookupCoverBtn: '🔍',
    lookupCoverTitle: 'Cover-Bild per ISBN nachschlagen',
    lookupNeedIsbn: 'Bitte zuerst eine ISBN eingeben.',
    lookupNotFound: 'Kein Treffer für diese ISBN.',
    lookupFailed: 'Nachschlagen fehlgeschlagen. Bitte erneut versuchen.',
    lookupOverwritePrompt: 'Vorhandenen Wert überschreiben?',
  }
};

let currentLang = localStorage.getItem('lang') || 'en';

function t(key) {
  return (translations[currentLang] && translations[currentLang][key])
    || translations.en[key]
    || key;
}

function applyLanguage(lang) {
  if (lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
  }
  document.documentElement.lang = currentLang;

  // Update elements with data-i18n (textContent)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });

  // Update elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  // Update elements with data-i18n-title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });

  // Update active language button styling
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

// Theme management
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeButton();
  if (typeof applyReaderTheme === 'function') applyReaderTheme();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function updateThemeButton() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  btn.textContent = isDark ? '\u2600\uFE0F' : '\uD83C\uDF19';
  btn.title = isDark ? t('themeLight') : t('themeDark');
}

// Init theme immediately to prevent flash
initTheme();
