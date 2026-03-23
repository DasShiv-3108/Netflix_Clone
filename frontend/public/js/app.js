/* ═══════════════════════════════════════════
   NETSTREAM — APP.JS
   3-Tier Netflix Clone Frontend Logic
════════════════════════════════════════════ */

const API = '/api';
let currentUser = null;
let myList = [];
let currentHeroMovie = null;
let currentModalMovie = null;
let searchTimeout = null;

// ─── Init ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupNavbarScroll();

  const stored = sessionStorage.getItem('nsUser');
  if (stored) {
    currentUser = JSON.parse(stored);
    launchApp();
  }
});

// ─── Auth ─────────────────────────────────
async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errEl = document.getElementById('loginError');
  const btn = document.querySelector('.btn-signin');

  if (!email || !password) {
    errEl.textContent = 'Please fill in all fields.';
    return;
  }

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.success) {
      currentUser = data.data;
      sessionStorage.setItem('nsUser', JSON.stringify(currentUser));
      document.getElementById('navAvatar').textContent = currentUser.avatar || currentUser.name[0].toUpperCase();
      launchApp();
    } else {
      errEl.textContent = data.error || 'Login failed. Try demo@netflix.com / demo123';
    }
  } catch (e) {
    errEl.textContent = 'Cannot connect to server. Make sure backend is running.';
  } finally {
    btn.innerHTML = '<span>Sign In</span>';
    btn.disabled = false;
  }
}

function skipLogin() {
  currentUser = { name: 'Guest', avatar: 'G', plan: 'basic' };
  launchApp();
}

function launchApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp();
}

// ─── Navbar ───────────────────────────────
function setupNavbarScroll() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) navbar.classList.add('scrolled');
    else navbar.classList.remove('scrolled');
  }, { passive: true });
}

// Nav link active state
document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const section = link.dataset.section;
    filterSection(section);
  });
});

function filterSection(section) {
  const trendingRow = document.getElementById('trendingRow');
  const popularRow = document.getElementById('popularRow');
  const newRow = document.getElementById('newRow');
  const myListRow = document.getElementById('myListRow');
  const heroSection = document.querySelector('.hero');

  // Reset all
  [trendingRow, popularRow, newRow, myListRow, heroSection].forEach(el => {
    el.classList.remove('hidden');
  });

  if (section === 'mylist') {
    heroSection.classList.add('hidden');
    trendingRow.classList.add('hidden');
    popularRow.classList.add('hidden');
    newRow.classList.add('hidden');
    myListRow.classList.remove('hidden');
    renderMyList();
  } else if (section === 'series') {
    heroSection.classList.add('hidden');
    renderFilteredRow('trendingSlider', { type: 'series' });
    renderFilteredRow('popularSlider', { type: 'series' });
    newRow.classList.add('hidden');
    myListRow.classList.add('hidden');
  } else if (section === 'movies') {
    heroSection.classList.add('hidden');
    renderFilteredRow('trendingSlider', { type: 'movie' });
    renderFilteredRow('popularSlider', { type: 'movie' });
    newRow.classList.add('hidden');
    myListRow.classList.add('hidden');
  } else {
    // Home
    initApp();
  }
}

// ─── Init App ─────────────────────────────
async function initApp() {
  try {
    await Promise.all([
      loadFeatured(),
      loadRow('trendingSlider', 'trending'),
      loadRow('popularSlider', 'popular'),
      loadRow('newSlider', 'new')
    ]);
  } catch (e) {
    console.error('Init error:', e);
    showToast('⚠️ Could not connect to API. Showing demo data.');
    loadDemoData();
  }
}

// ─── Hero ─────────────────────────────────
async function loadFeatured() {
  try {
    const res = await fetch(`${API}/movies/featured`);
    const data = await res.json();
    if (data.success && data.data) {
      renderHero(data.data);
    } else {
      // fallback: pick first trending
      const res2 = await fetch(`${API}/categories/trending`);
      const data2 = await res2.json();
      if (data2.success && data2.data.length > 0) {
        renderHero(data2.data[0]);
      }
    }
  } catch (e) {
    throw e;
  }
}

function renderHero(movie) {
  currentHeroMovie = movie;
  const heroBg = document.getElementById('heroBg');
  const heroTitle = document.getElementById('heroTitle');
  const heroMeta = document.getElementById('heroMeta');
  const heroDesc = document.getElementById('heroDesc');
  const heroGenre = document.getElementById('heroGenre');
  const heroContent = document.getElementById('heroContent');

  heroBg.style.backgroundImage = `url('${movie.backdrop || movie.thumbnail}')`;
  heroTitle.textContent = movie.title;
  heroDesc.textContent = movie.description;

  heroMeta.innerHTML = `
    <span class="hero-rating"><i class="fas fa-star"></i> ${movie.rating}</span>
    <span class="hero-year">${movie.year}</span>
    <span class="hero-duration">${movie.duration}</span>
    <span class="hero-type-badge">${movie.type === 'series' ? 'SERIES' : 'MOVIE'}</span>
  `;

  heroGenre.innerHTML = movie.genre.slice(0, 3).map(g =>
    `<span class="genre-tag">${g}</span>`
  ).join('');

  // Reset animation
  heroContent.style.animation = 'none';
  heroContent.offsetHeight; // reflow
  heroContent.style.animation = '';

  // Update add btn
  const addBtn = document.getElementById('heroAddBtn');
  updateAddBtn(addBtn, movie._id);
}

// ─── Rows ─────────────────────────────────
async function loadRow(sliderId, category) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;

  // Show skeleton
  slider.innerHTML = Array(6).fill(0).map(() => `
    <div style="flex:0 0 220px;border-radius:8px;overflow:hidden">
      <div class="skeleton" style="height:130px"></div>
      <div style="padding:10px;background:var(--surface)">
        <div class="skeleton" style="height:14px;margin-bottom:6px;border-radius:4px"></div>
        <div class="skeleton" style="height:12px;width:60%;border-radius:4px"></div>
      </div>
    </div>
  `).join('');

  try {
    const res = await fetch(`${API}/categories/${category}`);
    const data = await res.json();
    if (data.success) {
      renderCards(slider, data.data);
    }
  } catch (e) {
    throw e;
  }
}

function renderCards(container, movies) {
  if (!movies || movies.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:20px">No titles found.</p>';
    return;
  }

  container.innerHTML = movies.map((movie, idx) => `
    <div class="card" onclick="openModal('${movie._id}')">
      <span class="card-rank">${String(idx + 1).padStart(2, '0')}</span>
      <span class="card-type-badge">${movie.type === 'series' ? 'SERIES' : 'FILM'}</span>
      <img class="card-img" src="${movie.thumbnail}" alt="${movie.title}"
           onerror="this.src='https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=500&q=60'"
           loading="lazy"/>
      <div class="card-overlay">
        <button class="card-play-btn" onclick="event.stopPropagation();playCard('${movie._id}')">
          <i class="fas fa-play"></i>
        </button>
        <button class="card-info-btn" onclick="event.stopPropagation();openModal('${movie._id}')">
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <div class="card-body">
        <div class="card-title" title="${movie.title}">${movie.title}</div>
        <div class="card-meta">
          <span class="card-rating"><i class="fas fa-star" style="font-size:0.65rem"></i> ${movie.rating}</span>
          <span>${movie.year}</span>
        </div>
        <div class="card-genres">
          ${movie.genre.slice(0,2).map(g => `<span class="genre-tag">${g}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

async function renderFilteredRow(sliderId, filters) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;

  const params = new URLSearchParams(filters);
  try {
    const res = await fetch(`${API}/movies?${params}`);
    const data = await res.json();
    if (data.success) renderCards(slider, data.data);
  } catch (e) {
    console.error(e);
  }
}

// ─── My List ──────────────────────────────
function renderMyList() {
  const slider = document.getElementById('myListSlider');
  const row = document.getElementById('myListRow');

  if (myList.length === 0) {
    slider.innerHTML = '<p style="color:var(--text-muted);padding:20px 0">Your list is empty. Add some titles!</p>';
  } else {
    renderCards(slider, myList);
  }
  row.classList.remove('hidden');
}

function addToMyList() {
  if (!currentHeroMovie) return;
  toggleMyList(currentHeroMovie, document.getElementById('heroAddBtn'));
}

function addToMyListFromModal() {
  if (!currentModalMovie) return;
  toggleMyList(currentModalMovie, document.getElementById('modalAddBtn'));
}

function toggleMyList(movie, btn) {
  const exists = myList.some(m => m._id === movie._id);
  if (exists) {
    myList = myList.filter(m => m._id !== movie._id);
    showToast(`Removed "${movie.title}" from My List`);
  } else {
    myList.push(movie);
    showToast(`Added "${movie.title}" to My List`);
  }
  updateAddBtn(btn, movie._id);
}

function updateAddBtn(btn, movieId) {
  if (!btn) return;
  const inList = myList.some(m => m._id === movieId);
  if (inList) {
    btn.classList.add('added');
    btn.innerHTML = '<i class="fas fa-check"></i>';
  } else {
    btn.classList.remove('added');
    btn.innerHTML = '<i class="fas fa-plus"></i>';
  }
}

// ─── Modal ────────────────────────────────
async function openModal(movieId) {
  const modal = document.getElementById('movieModal');
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  try {
    const res = await fetch(`${API}/movies/${movieId}`);
    const data = await res.json();
    if (data.success) {
      currentModalMovie = data.data;
      populateModal(data.data);
    }
  } catch (e) {
    console.error('Modal load error:', e);
  }
}

function populateModal(movie) {
  document.getElementById('modalTitle').textContent = movie.title;
  document.getElementById('modalDesc').textContent = movie.description;
  document.getElementById('modalCast').textContent = movie.cast.join(', ');
  document.getElementById('modalGenre').textContent = movie.genre.join(', ');
  document.getElementById('modalLang').textContent = movie.language;
  document.getElementById('modalMaturity').textContent = movie.maturityRating;

  document.getElementById('modalMeta').innerHTML = `
    <span class="rating-badge"><i class="fas fa-star"></i> ${movie.rating}/10</span>
    <span class="year">${movie.year}</span>
    <span class="duration">${movie.duration}</span>
    <span class="maturity">${movie.maturityRating}</span>
    <span style="color:var(--red);font-weight:600;font-size:0.75rem">${movie.type.toUpperCase()}</span>
  `;

  const modalHero = document.getElementById('modalHero');
  modalHero.style.backgroundImage = `url('${movie.backdrop || movie.thumbnail}')`;

  updateAddBtn(document.getElementById('modalAddBtn'), movie._id);
}

function closeModal() {
  document.getElementById('movieModal').classList.add('hidden');
  document.body.style.overflow = '';
  currentModalMovie = null;
}

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ─── Play ─────────────────────────────────
function playMovie() {
  showToast('▶ Playing "' + (currentHeroMovie?.title || 'Title') + '"');
}

function playCard(id) {
  showToast('▶ Playing now...');
}

function showMoreInfo() {
  if (currentHeroMovie) openModal(currentHeroMovie._id);
}

// ─── Search ───────────────────────────────
function handleSearch(query) {
  clearTimeout(searchTimeout);
  const overlay = document.getElementById('searchOverlay');

  if (!query.trim()) {
    overlay.classList.add('hidden');
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`${API}/movies?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        renderSearchResults(data.data, query);
        overlay.classList.remove('hidden');
      }
    } catch (e) {
      console.error(e);
    }
  }, 350);
}

function renderSearchResults(movies, query) {
  const container = document.getElementById('searchResults');
  if (movies.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);padding:8px">No results for "<em>${query}</em>"</p>`;
    return;
  }

  container.innerHTML = movies.map(movie => `
    <div class="card" style="flex:0 0 180px" onclick="openModal('${movie._id}');closeSearch()">
      <img class="card-img" src="${movie.thumbnail}" alt="${movie.title}"
           onerror="this.src='https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=500&q=60'"
           style="height:110px" loading="lazy"/>
      <div class="card-body">
        <div class="card-title">${movie.title}</div>
        <div class="card-meta">
          <span class="card-rating"><i class="fas fa-star" style="font-size:0.65rem"></i> ${movie.rating}</span>
          <span>${movie.year}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function closeSearch() {
  document.getElementById('searchOverlay').classList.add('hidden');
  document.getElementById('searchInput').value = '';
}

// Close search on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-bar') && !e.target.closest('.search-overlay')) {
    closeSearch();
  }
});

// ─── Toast ────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ─── Demo Fallback Data ───────────────────
function loadDemoData() {
  const demoMovies = [
    { _id: '1', title: 'Stranger Things', description: 'A thrilling sci-fi horror series.', genre: ['Sci-Fi', 'Horror'], rating: 8.7, year: 2016, duration: '50 min/ep', type: 'series', thumbnail: 'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=500&q=80', backdrop: 'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=1280&q=80', cast: ['Millie Bobby Brown'], language: 'English', maturityRating: 'TV-14' },
    { _id: '2', title: 'Breaking Bad', description: 'Chemistry teacher turned drug lord.', genre: ['Crime', 'Drama'], rating: 9.5, year: 2008, duration: '47 min/ep', type: 'series', thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80', backdrop: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1280&q=80', cast: ['Bryan Cranston'], language: 'English', maturityRating: 'TV-MA' },
    { _id: '3', title: 'Inception', description: 'Dream within a dream.', genre: ['Action', 'Sci-Fi'], rating: 8.8, year: 2010, duration: '148 min', type: 'movie', thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80', backdrop: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1280&q=80', cast: ['Leonardo DiCaprio'], language: 'English', maturityRating: 'PG-13' },
    { _id: '4', title: 'Interstellar', description: 'Through a wormhole in space.', genre: ['Adventure', 'Sci-Fi'], rating: 8.6, year: 2014, duration: '169 min', type: 'movie', thumbnail: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=500&q=80', backdrop: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1280&q=80', cast: ['Matthew McConaughey'], language: 'English', maturityRating: 'PG-13' },
    { _id: '5', title: 'Dark', description: 'German time-travel mystery.', genre: ['Mystery', 'Drama'], rating: 8.8, year: 2017, duration: '60 min/ep', type: 'series', thumbnail: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=500&q=80', backdrop: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=1280&q=80', cast: ['Louis Hofmann'], language: 'German', maturityRating: 'TV-MA' },
    { _id: '6', title: 'Squid Game', description: 'Life or death games.', genre: ['Action', 'Drama'], rating: 8.0, year: 2021, duration: '54 min/ep', type: 'series', thumbnail: 'https://images.unsplash.com/photo-1614729939124-032d1e6c9945?w=500&q=80', backdrop: 'https://images.unsplash.com/photo-1614729939124-032d1e6c9945?w=1280&q=80', cast: ['Lee Jung-jae'], language: 'Korean', maturityRating: 'TV-MA' },
  ];

  renderHero({ ...demoMovies[0], featured: true });
  const trendingSlider = document.getElementById('trendingSlider');
  const popularSlider = document.getElementById('popularSlider');
  const newSlider = document.getElementById('newSlider');
  renderCards(trendingSlider, demoMovies.slice(0, 3));
  renderCards(popularSlider, demoMovies.slice(2, 5));
  renderCards(newSlider, demoMovies.slice(3, 6));
}
