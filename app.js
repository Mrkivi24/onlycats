const express = require('express');
const path = require('path');
const multer = require('multer');
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

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/views/admin.html'));
});

// API Routes
app.post('/api/upload', upload.single('image'), async (req, res) => {
  const { title, category, tags, title_color } = req.body;
  const imagePath = `/images/${req.file.filename}`;
  
  try {
    await db.runAsync(
      'INSERT INTO pictures (title, category, tags, image_path, title_color) VALUES (?, ?, ?, ?, ?)',
      [title, category, tags, imagePath, title_color || '#ff6b9d']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pictures', async (req, res) => {
  try {
    const pictures = await db.allAsync(`
      SELECT *, 
      CASE WHEN has_golden_sparkle = 1 THEN 1 ELSE 0 END as has_golden_sparkle
      FROM pictures 
      ORDER BY likes DESC
    `);
    res.json(pictures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', async (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : '';
  
  try {
    const pictures = await db.allAsync(
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
    const existingLike = await db.getAsync(
      'SELECT * FROM likes WHERE picture_id = ? AND user_ip = ?',
      [id, userIp]
    );
    
    if (existingLike) {
      return res.json({ success: false, message: 'Already liked' });
    }
    
    // Record the like
    await db.runAsync(
      'INSERT INTO likes (picture_id, user_ip) VALUES (?, ?)',
      [id, userIp]
    );
    
    // Update picture like count
    await db.runAsync(
      'UPDATE pictures SET likes = likes + 1 WHERE id = ?',
      [id]
    );
    
    // Get updated picture
    const picture = await db.getAsync('SELECT * FROM pictures WHERE id = ?', [id]);
    
    res.json({ 
      success: true, 
      newLikeCount: picture.likes,
      hasGoldenSparkle: picture.likes >= 100 // Set your threshold here
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoints
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64')
    .toString()
    .split(':');
    
  if (username === 'Mike' && password === 'Mike@343') {
    next();
  } else {
    res.status(403).json({ error: 'Invalid credentials' });
  }
};

app.delete('/api/pictures/:id', adminAuth, async (req, res) => {
  try {
    await db.runAsync('DELETE FROM pictures WHERE id = ?', [req.params.id]);
    await db.runAsync('DELETE FROM likes WHERE picture_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pictures/:id/sparkle', adminAuth, async (req, res) => {
  try {
    await db.runAsync(
      'UPDATE pictures SET has_golden_sparkle = 1 WHERE id = ?',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});