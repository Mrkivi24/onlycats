const express = require('express');
const path = require('path');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/images'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/views/index.html'));
});

app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/views/search.html'));
});

app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/views/upload.html'));
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/views/gallery.html'));
});

// API Routes
app.post('/api/upload', upload.single('image'), async (req, res) => {
  const { title, category, tags } = req.body;
  const imagePath = `/images/${req.file.filename}`;
  
  try {
    await db.run(
      'INSERT INTO pictures (title, category, tags, image_path, likes) VALUES (?, ?, ?, ?, 0)',
      [title, category, tags, imagePath]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pictures', async (req, res) => {
  try {
    const pictures = await db.all('SELECT * FROM pictures ORDER BY likes DESC');
    res.json(pictures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', async (req, res) => {
  const query = req.query.q.toLowerCase();
  
  try {
    const pictures = await db.all(
      `SELECT * FROM pictures 
       WHERE LOWER(title) LIKE ? OR LOWER(category) LIKE ? OR LOWER(tags) LIKE ? 
       ORDER BY likes DESC`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
    res.json(pictures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/like/:id', async (req, res) => {
  const { id } = req.params;
  const userIp = req.ip;
  
  try {
    // Check if user already liked
    const existingLike = await db.get(
      'SELECT * FROM likes WHERE picture_id = ? AND user_ip = ?',
      [id, userIp]
    );
    
    if (existingLike) {
      return res.json({ success: false, message: 'Already liked' });
    }
    
    // Record the like
    await db.run(
      'INSERT INTO likes (picture_id, user_ip) VALUES (?, ?)',
      [id, userIp]
    );
    
    // Update picture like count
    await db.run(
      'UPDATE pictures SET likes = likes + 1 WHERE id = ?',
      [id]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize database
async function initializeDatabase() {
  await db.run(`
    CREATE TABLE IF NOT EXISTS pictures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL,
      image_path TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      picture_id INTEGER NOT NULL,
      user_ip TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (picture_id) REFERENCES pictures (id)
    )
  `);
}

// Start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});