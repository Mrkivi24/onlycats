const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads with 10MB limit
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/images'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

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
  try {
    if (!req.file) {
      throw new Error('No image file provided');
    }

    const { title, category, tags = '', title_color = '#ff6b9d' } = req.body;
    
    if (!title || !category) {
      throw new Error('Title and category are required');
    }

    const imagePath = `/images/${req.file.filename}`;
    
    await db.runAsync(
      'INSERT INTO pictures (title, category, tags, image_path, title_color) VALUES (?, ?, ?, ?, ?)',
      [title, category, tags, imagePath, title_color]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Upload error:', err.message);
    res.status(400).json({ 
      success: false, 
      error: err.message || 'Failed to upload image' 
    });
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
    console.error('Error fetching pictures:', err);
    res.status(500).json({ error: 'Failed to fetch pictures' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    
    const pictures = await db.allAsync(
      `SELECT * FROM pictures 
       WHERE LOWER(title) LIKE ? OR LOWER(category) LIKE ? OR LOWER(tags) LIKE ? 
       ORDER BY likes DESC`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
    res.json(pictures);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.post('/api/like/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userIp = req.ip;
    
    const existingLike = await db.getAsync(
      'SELECT * FROM likes WHERE picture_id = ? AND user_ip = ?',
      [id, userIp]
    );
    
    if (existingLike) {
      return res.json({ success: false, message: 'Already liked' });
    }
    
    await db.runAsync(
      'INSERT INTO likes (picture_id, user_ip) VALUES (?, ?)',
      [id, userIp]
    );
    
    await db.runAsync(
      'UPDATE pictures SET likes = likes + 1 WHERE id = ?',
      [id]
    );
    
    const picture = await db.getAsync('SELECT * FROM pictures WHERE id = ?', [id]);
    
    res.json({ 
      success: true, 
      newLikeCount: picture.likes,
      hasGoldenSparkle: picture.likes >= 100
    });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Failed to like picture' });
  }
});

// Admin endpoints
const adminAuth = (req, res, next) => {
  try {
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
  } catch (err) {
    res.status(400).json({ error: 'Invalid authorization header' });
  }
};

app.delete('/api/pictures/:id', adminAuth, async (req, res) => {
  try {
    await db.runAsync('DELETE FROM pictures WHERE id = ?', [req.params.id]);
    await db.runAsync('DELETE FROM likes WHERE picture_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete picture' });
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
    console.error('Sparkle error:', err);
    res.status(500).json({ error: 'Failed to add golden sparkle' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        success: false, 
        error: 'File size exceeds 10MB limit' 
      });
    }
    return res.status(400).json({ 
      success: false, 
      error: err.message || 'File upload error' 
    });
  }
  
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});