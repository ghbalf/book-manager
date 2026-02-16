# Book Manager

A web application for managing physical books and ebooks with PostgreSQL database and vanilla HTML/CSS/JS frontend.

## Features

- Add, view, edit, delete books
- Book types: physical or ebook
- Physical books: location field (e.g., "living room shelf")
- Ebooks: file path field
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

## Project Structure

```
books/
├── package.json           # Dependencies and scripts
├── server.js              # Express server & API routes
├── db.js                  # PostgreSQL connection & queries
├── schema.sql             # Database schema
├── public/                # Frontend files
│   ├── index.html         # Main UI
│   ├── style.css          # Styles
│   └── app.js             # Frontend JavaScript
├── covers/                # Downloaded cover images
├── import-calibre.js      # Import ebooks from Calibre
├── update-calibre-metadata.js  # Update Calibre books with publisher/date
├── add-physical.js        # Interactive script to add physical books
├── fetch-covers.js        # Fetch covers for physical books
└── download-covers.js     # Download external covers locally
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

### Environment Variables

Configure the database connection via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | bookmanager | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `PORT` | 3000 | Server port |
| `CALIBRE_PATH` | ~/Documents/Calibre Library | Path to Calibre library |

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
- Skips books that already exist (matching title + author)

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Get book counts (total, physical, ebooks) |
| GET | `/api/books` | List books with optional filters |
| GET | `/api/books/:id` | Get single book |
| POST | `/api/books` | Add new book |
| PUT | `/api/books/:id` | Update book |
| DELETE | `/api/books/:id` | Delete book |
| GET | `/api/covers/:id` | Get cover image for book |

### Query Parameters for GET /api/books

| Parameter | Description |
|-----------|-------------|
| `search` | Search in title, author, ISBN |
| `type` | Filter by type: `physical` or `ebook` |
| `status` | Filter by status: `unread`, `reading`, `finished` |
| `genre` | Filter by genre (partial match) |
| `sort` | Sort by: `updated`, `title`, `author`, `rating` |

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

If importing from Calibre and want to serve covers, ensure the Calibre library path is accessible:

```bash
# Set environment variable
export CALIBRE_PATH=/path/to/Calibre\ Library
```

Or download all covers locally:
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
