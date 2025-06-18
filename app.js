const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Configure upload directory with proper permissions
const imagesDir = path.join(__dirname, 'public', 'images');

// Ensure directory exists with proper permissions
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.chmodSync(imagesDir, 0o755); // Read/write permissions
}

// 2. Enhanced multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, GIF, and WEBP images are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: fileFilter
});

// 3. Middleware setup
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 4. Route handlers
const routes = [
  { path: '/', file: 'index.html' },
  { path: '/search', file: 'search.html' },
  { path: '/upload', file: 'upload.html' },
  { path: '/gallery', file: 'gallery.html' },
  { path: '/admin', file: 'admin.html' }
];

routes.forEach(route => {
  app.get(route.path, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/views', route.file));
  });
});

// 5. API Endpoints with robust error handling

// Upload endpoint with complete file management
app.post('/api/upload', upload.single('image'), async (req, res) => {
  let fileCleanupRequired = !!req.file;
  
  try {
    // Validate required fields
    if (!req.file) {
      throw new Error('No image file provided');
    }

    // Verify file was saved
    if (!fs.existsSync(req.file.path)) {
      throw new Error('Failed to save uploaded file');
    }

    const { title, category, tags = '', title_color = '#ff6b9d' } = req.body;
    
    if (!title?.trim()) {
      throw new Error('Title is required');
    }
    
    if (!category?.trim()) {
      throw new Error('Category is required');
    }

    const imagePath = `/images/${req.file.filename}`;
    
    // Database operation
    await db.runAsync(
      'INSERT INTO pictures (title, category, tags, image_path, title_color) VALUES (?, ?, ?, ?, ?)',
      [title.trim(), category.trim(), tags.trim(), imagePath, title_color]
    );
    
    fileCleanupRequired = false;
    res.json({ success: true, imagePath });
    
  } catch (err) {
    // Clean up file if error occurred
    if (fileCleanupRequired && req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Upload Error:', err.message);
    res.status(400).json({ 
      success: false, 
      error: err.message || 'Failed to upload image',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Pictures API
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
    console.error('Database Error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch pictures',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Search API
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q ? req.query.q.toLowerCase().trim() : '';
    
    if (!query) {
      return res.json([]);
    }

    const pictures = await db.allAsync(
      `SELECT * FROM pictures 
       WHERE LOWER(title) LIKE ? OR LOWER(category) LIKE ? OR LOWER(tags) LIKE ? 
       ORDER BY likes DESC`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
    res.json(pictures);
  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ 
      error: 'Search failed',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Like API
app.post('/api/like/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userIp = req.ip.replace(/^::ffff:/, ''); // Clean IPv6-mapped IPv4 addresses
    
    if (!id || isNaN(Number(id))) {
      throw new Error('Invalid picture ID');
    }

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
    console.error('Like Error:', err);
    res.status(500).json({ 
      error: 'Failed to like picture',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 6. Admin Endpoints with proper authentication
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
      return next();
    }
    
    res.status(403).json({ error: 'Invalid credentials' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid authorization header' });
  }
};

// Delete picture endpoint
app.delete('/api/pictures/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the image path for cleanup
    const picture = await db.getAsync('SELECT image_path FROM pictures WHERE id = ?', [id]);
    
    if (!picture) {
      return res.status(404).json({ error: 'Picture not found' });
    }

    // Delete from database
    await db.runAsync('DELETE FROM pictures WHERE id = ?', [id]);
    await db.runAsync('DELETE FROM likes WHERE picture_id = ?', [id]);
    
    // Delete the actual file
    const imagePath = path.join(__dirname, 'public', picture.image_path);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete Error:', err);
    res.status(500).json({ 
      error: 'Failed to delete picture',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Golden sparkle endpoint
app.post('/api/pictures/:id/sparkle', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.runAsync(
      'UPDATE pictures SET has_golden_sparkle = 1 WHERE id = ?',
      [id]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Sparkle Error:', err);
    res.status(500).json({ 
      error: 'Failed to add golden sparkle',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// 7. Error handling middleware
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
  
  console.error('Server Error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 8. Start server with validation
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${imagesDir}`);
  
  // Verify directory permissions
  try {
    fs.accessSync(imagesDir, fs.constants.R_OK | fs.constants.W_OK);
    console.log('✅ Upload directory is accessible');
  } catch (err) {
    console.error('❌ Upload directory permission error:', err);
  }
});
