# Book Manager

A web application for managing physical books and ebooks with PostgreSQL database and vanilla HTML/CSS/JS frontend.

## Features

- Add, view, edit, delete books
- Book types: physical or ebook
- Physical books: location field (e.g., "living room shelf")
- Ebooks: file path field with built-in EPUB reader
- Cover images (URL-based or local)
- Publisher and publish date
- Reading progress (percentage)
- Personal notes
- Star ratings (1-5)
- Search by title, author, or ISBN
- Filter by type, status, genre
- Sort by title, author (family name), rating, or recently updated
- Grid and list view toggle
- Book statistics (total, physical, ebooks)
- UI languages: English and German
- Light and dark theme with system-preference default

### Calibre integration (UI)

- **Sync from Calibre** one-click button in the header — imports new
  ebooks from a Calibre library and updates their metadata live, with
  an SSE-driven progress modal
- **Settings page** for editable paths and options (Calibre path,
  covers directory, default language, cover-lookup delay)
- **Re-scan all metadata** action in the Settings page for full refresh
- **ISBN lookup** button on the Add/Edit dialog — fills title, author,
  publisher, publish date, genre, and cover from Open Library or
  Google Books, prompting before overwriting non-empty fields
- **Cover lookup** button on the Add/Edit dialog — fills just the
  Cover Image URL from ISBN

## Project Structure

```
books/
├── package.json                # Dependencies and scripts
├── server.js                   # Express server & API routes
├── db.js                       # PostgreSQL connection & queries
├── config.js                   # Editable-settings loader (config.json)
├── config.json                 # User config (gitignored, auto-created)
├── schema.sql                  # Database schema
├── migrate-add-calibre-id.js   # One-shot migration for existing installs
├── public/                     # Frontend files
│   ├── index.html              # Main UI
│   ├── style.css               # Styles
│   ├── app.js                  # Frontend JavaScript
│   └── i18n.js                 # EN/DE translations and theme toggle
├── covers/                     # Downloaded cover images (gitignored)
├── lookup-isbn.js              # Shared Open Library / Google Books lookup
├── calibre-sync.js             # In-process sync coordinator with SSE
├── import-calibre.js           # Import ebooks from Calibre (CLI + module)
├── update-calibre-metadata.js  # Update Calibre books (CLI + module)
├── convert-to-epub.js          # Convert Calibre entries to EPUB
├── add-physical.js             # Interactive/batch ISBN import
├── fetch-covers.js             # Fetch covers for physical books
└── download-covers.js          # Download external covers locally
```

## Setup

### Prerequisites

- Node.js (v18 or later recommended)
- PostgreSQL

### Installation

```bash
# Install dependencies
npm install
```

### Database Setup

1. Create the database:
```bash
createdb bookmanager
```

2. Run the schema:
```bash
psql -d bookmanager -f schema.sql
```

3. (Existing installs only) Apply the `calibre_id` migration to switch Calibre
sync dedup from `(title, author)` to Calibre's stable `b.id`:
```bash
node migrate-add-calibre-id.js
```
Idempotent. Reports any Calibre `b.id`s that don't map to a manager record —
those are duplicates inside Calibre that the next sync would otherwise import
as new ebooks.

### Environment Variables

Secrets and connection info live in environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | bookmanager | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `PORT` | 3000 | Server port |

> **Note:** The Calibre library path used to be an env variable
> (`CALIBRE_PATH`). It now lives in `config.json` and is editable from
> the in-app Settings page. Database credentials remain env-only so
> that the web UI cannot change them.

### Application Config (`config.json`)

Non-secret, user-editable options are stored in `config.json` in the
project root. The file is created automatically on first save through
the Settings dialog. It is gitignored.

| Key | Default | Description |
|-----|---------|-------------|
| `calibrePath` | `~/Documents/Calibre Library` | Path to the Calibre library |
| `coversDir` | `./covers` | Directory for downloaded cover images |
| `defaultLanguage` | `en` | UI language fallback (`en` / `de`) |
| `coverLookupDelayMs` | `200` | Delay between external cover lookups |

### Running the Server

```bash
# Development
node server.js

# With custom database
DB_HOST=myserver DB_USER=myuser DB_PASSWORD=mypass node server.js
```

Open http://localhost:3000 in your browser.

---

## Scripts

All Calibre-related scripts below are also exposed through the UI
(header **Sync** button and the **Settings** page). The CLIs remain
available for scripting or one-off use.

### import-calibre.js

Import ebooks from a Calibre library.

```bash
node import-calibre.js [calibre-path]
```

**Arguments:**
- `calibre-path` (optional): Path to Calibre library. Defaults to `~/Documents/Calibre Library`

**What it does:**
- Reads Calibre's `metadata.db` SQLite database
- Extracts title, authors, ISBN, publisher, publish date, and file paths
- Imports books as ebooks with status "unread"
- Dedups against the manager DB by Calibre's `b.id` (stored as `books.calibre_id`).
  Each Calibre row maps to at most one manager record; duplicates inside Calibre
  yield independent manager rows.

Also exported as `importFromCalibre({ calibrePath, onProgress })` for
in-process use (returns `{ imported, skipped, ids }`).

**Example:**
```bash
node import-calibre.js "/mnt/books/Calibre Library"
```

---

### update-calibre-metadata.js

Update existing Calibre books with publisher and publish date from Calibre's metadata.

```bash
node update-calibre-metadata.js [calibre-path]
```

**Arguments:**
- `calibre-path` (optional): Path to Calibre library

**What it does:**
- Finds ebooks in the database that match Calibre books
- Updates publisher and publish_date if missing
- Skips books that already have metadata

Also exported as `updateCalibreMetadata({ calibrePath, ids, onProgress })`.
When `ids` is provided the update is restricted to those book IDs
(used by the sync endpoint to refresh only the books it just
imported).

---

### convert-to-epub.js

Convert Calibre library entries that are not already EPUB into EPUB
using the Calibre `ebook-convert` CLI.

```bash
node convert-to-epub.js [--dry-run]
```

Produces `failed-conversions.txt` listing titles it could not convert.

---

### add-physical.js

Interactive script to add physical books by ISBN lookup.

```bash
node add-physical.js
```

**What it does:**
- Prompts for ISBN
- Looks up book data from Open Library API (fallback: Google Books)
- Shows found data: title, author, publisher, publish date, genre
- Asks for confirmation and location
- Adds book to database as physical book

**Commands:**
- Enter ISBN to look up
- Type `quit` or `q` to exit
- If book not found, option to enter manually

---

### fetch-covers.js

Fetch cover images for physical books from online APIs.

```bash
node fetch-covers.js
```

**What it does:**
- Finds physical books with ISBN but no cover
- Looks up covers from Open Library and Google Books
- Updates database with cover URLs

---

### download-covers.js

Download all external cover images to local storage.

```bash
node download-covers.js
```

**What it does:**
- Finds books with external cover URLs (http...)
- Downloads images to `covers/` directory
- Updates database to use local paths (`/covers/123.jpg`)
- Skips already downloaded covers

**Why use this:**
- Ensures covers remain available if external sources go down
- Faster loading from local storage
- Works offline

---

## API Endpoints

### Books

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Get book counts (total, physical, ebooks) |
| GET | `/api/books` | List books with optional filters |
| GET | `/api/books/:id` | Get single book |
| POST | `/api/books` | Add new book |
| PUT | `/api/books/:id` | Update book |
| DELETE | `/api/books/:id` | Delete book |
| GET | `/api/books/:id/read` | Serve the book's EPUB file for reading |
| GET | `/api/covers/:id` | Get cover image for book |

### Query Parameters for GET /api/books

| Parameter | Description |
|-----------|-------------|
| `search` | Search in title, author, ISBN |
| `type` | Filter by type: `physical` or `ebook` |
| `status` | Filter by status: `unread`, `reading`, `finished` |
| `genre` | Filter by genre (partial match) |
| `sort` | Sort by: `updated`, `title`, `author`, `rating` |

### Config

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Return current config and read-only DB info |
| PUT | `/api/config` | Patch editable config keys |

### Metadata / cover lookup

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lookup/isbn?isbn=…` | Full metadata lookup by ISBN |
| GET | `/api/lookup/cover?isbn=…` | Cover-image URL lookup by ISBN |

Both try Open Library first, then Google Books. They return `404` if
neither provider has a hit.

### Calibre sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/calibre/sync` | Start an import + metadata-for-new run |
| POST | `/api/calibre/rescan` | Start a full metadata rescan |
| GET | `/api/calibre/sync/stream` | Server-Sent Events stream of progress |

Only one sync can run at a time; a second `POST` returns `409`. The
SSE stream sends `{ type: 'progress', phase, current, total, title }`
events during a run and a final `{ type: 'done', ... }` or
`{ type: 'error', ... }` event. Opening the stream without a running
job emits a single `{ type: 'idle' }` event.

---

## Deployment

### Option 1: Direct Node.js

1. Clone/copy the project to your server
2. Install dependencies:
   ```bash
   npm install --production
   ```
3. Set environment variables
4. Run with a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name bookmanager
   pm2 save
   pm2 startup
   ```

### Option 2: Systemd Service

Create `/etc/systemd/system/bookmanager.service`:

```ini
[Unit]
Description=Book Manager
After=network.target postgresql.service

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/books
Environment=DB_HOST=localhost
Environment=DB_USER=bookmanager
Environment=DB_PASSWORD=yourpassword
Environment=DB_NAME=bookmanager
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable bookmanager
sudo systemctl start bookmanager
```

### Option 3: Docker

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=db
      - DB_USER=bookmanager
      - DB_PASSWORD=bookmanager
      - DB_NAME=bookmanager
    depends_on:
      - db
    volumes:
      - ./covers:/app/covers

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=bookmanager
      - POSTGRES_PASSWORD=bookmanager
      - POSTGRES_DB=bookmanager
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql

volumes:
  pgdata:
```

Run:
```bash
docker-compose up -d
```

### Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name books.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Serving Calibre Covers

If importing from Calibre and serving covers, make sure the Calibre
library path (set via the Settings page, stored in `config.json`) is
readable by the server process.

To make the library self-contained and survive upstream URL rot,
download all external covers locally:

```bash
node download-covers.js
```

---

## Database Migrations

If updating an existing database, apply these changes:

### Add ISBN field
```sql
ALTER TABLE books ADD COLUMN isbn VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
```

### Add publisher and publish date
```sql
ALTER TABLE books ADD COLUMN publisher TEXT;
ALTER TABLE books ADD COLUMN publish_date VARCHAR(20);
```

### Expand field sizes
```sql
ALTER TABLE books ALTER COLUMN title TYPE TEXT;
ALTER TABLE books ALTER COLUMN author TYPE TEXT;
ALTER TABLE books ALTER COLUMN location TYPE TEXT;
ALTER TABLE books ALTER COLUMN file_path TYPE TEXT;
ALTER TABLE books ALTER COLUMN cover_url TYPE TEXT;
```

---

## License

MIT
