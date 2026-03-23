const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/netflixdb';

// ─── Middleware ───────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// ─── MongoDB Connection ───────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ─── Models ──────────────────────────────────
const movieSchema = new mongoose.Schema({
  title: String,
  description: String,
  genre: [String],
  rating: Number,
  year: Number,
  duration: String,
  type: { type: String, enum: ['movie', 'series'] },
  category: { type: String, enum: ['trending', 'popular', 'new'] },
  thumbnail: String,
  backdrop: String,
  featured: { type: Boolean, default: false },
  cast: [String],
  language: String,
  maturityRating: String
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  plan: { type: String, default: 'basic' },
  avatar: String,
  myList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie' }]
}, { timestamps: true });

const Movie = mongoose.model('Movie', movieSchema);
const User = mongoose.model('User', userSchema);

// ─── Routes ──────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Netflix API Running 🎬', timestamp: new Date() });
});

// GET all movies
app.get('/api/movies', async (req, res) => {
  try {
    const { category, type, genre, search } = req.query;
    let filter = {};
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (genre) filter.genre = { $in: [genre] };
    if (search) filter.title = { $regex: search, $options: 'i' };
    const movies = await Movie.find(filter).sort({ rating: -1 });
    res.json({ success: true, count: movies.length, data: movies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET featured movie — MUST be before /:id route
app.get('/api/movies/featured', async (req, res) => {
  try {
    let movie = await Movie.findOne({ featured: true });
    // fallback: return highest rated if none marked featured
    if (!movie) movie = await Movie.findOne().sort({ rating: -1 });
    res.json({ success: true, data: movie });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET single movie — keep AFTER /featured
app.get('/api/movies/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ success: false, error: 'Movie not found' });
    res.json({ success: true, data: movie });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET movies by category
app.get('/api/categories/trending', async (req, res) => {
  try {
    const movies = await Movie.find({ category: 'trending' }).sort({ rating: -1 }).limit(10);
    res.json({ success: true, data: movies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/categories/popular', async (req, res) => {
  try {
    const movies = await Movie.find({ category: 'popular' }).sort({ rating: -1 }).limit(10);
    res.json({ success: true, data: movies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/categories/new', async (req, res) => {
  try {
    const movies = await Movie.find({ category: 'new' }).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: movies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST - Add to My List
app.post('/api/user/mylist/:movieId', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { myList: req.params.movieId } },
      { new: true }
    ).populate('myList');
    res.json({ success: true, data: user.myList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST login (demo - no real auth)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email === 'demo@netflix.com' && password === 'demo123') {
      const user = await User.findOne({ email });
      res.json({
        success: true,
        data: {
          _id: user?._id || 'demo-id',
          name: 'Demo User',
          email,
          plan: 'premium',
          avatar: 'D'
        },
        token: 'demo-jwt-token'
      });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials. Use demo@netflix.com / demo123' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Start Server ─────────────────────────────
app.listen(PORT, () => {
  console.log(`🎬 Netflix API running on port ${PORT}`);
});
