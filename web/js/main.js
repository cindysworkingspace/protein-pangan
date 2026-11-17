// State Management
let currentCategory = 'Semua';
let currentSearch = '';
let currentSort = 'name_asc';
let searchDebounceTimer = null;

// PDB to Fallback SVG illustration mapping
function getProteinFallbackImage(pdbId) {
  const map = {
    '1OVA': '/images/card-ovalbumin.svg',
    '1BSY': '/images/card-whey.svg',
    '1JFP': '/images/card-casein.svg',
    '1EQY': '/images/card-actin.svg',
    '1FXZ': '/images/card-glycinin.svg',
    '1B98': '/images/card-glutenin.svg',
    '1PHS': '/images/card-phaseolin.svg',
    '1CAG': '/images/card-collagen.svg'
  };
  return map[(pdbId || '').toUpperCase()] || '/images/card-generic.svg';
}

function getFoodEmoji(sourceCategory, foodSource) {
  const s = (foodSource || '').toLowerCase();
  if (s.includes('telur')) return '🥚';
  if (s.includes('whey') || s.includes('susu') || s.includes('kasein')) return '🥛';
  if (s.includes('daging') || s.includes('otot')) return '🥩';
  if (s.includes('kedelai')) return '🌱';
  if (s.includes('gandum') || s.includes('terigu')) return '🌾';
  if (s.includes('kacang')) return '🫘';
  if (s.includes('tulang') || s.includes('kolagen') || s.includes('kulit')) return '🦴';
  return (sourceCategory || '').toLowerCase() === 'hewani' ? '🥩' : '🌱';
}

// Compare selection from localStorage
function getCompareIds() {
  try {
    const raw = localStorage.getItem('compare_proteins');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCompareIds(ids) {
  localStorage.setItem('compare_proteins', JSON.stringify(ids));
  updateCompareBar();
}

function toggleCompare(id) {
  let ids = getCompareIds();
  const index = ids.indexOf(id);
  if (index > -1) {
    ids.splice(index, 1);
  } else {
    if (ids.length >= 4) {
      alert('Maksimal 4 protein dapat dibandingkan sekaligus.');
      return;
    }
    ids.push(id);
  }
  saveCompareIds(ids);
  renderProteins(window.latestProteins || []);
}

function updateCompareBar() {
  const ids = getCompareIds();
  const bar = document.getElementById('compareBar');
  const barText = document.getElementById('compareBarText');
  const badge = document.getElementById('compareCountBadge');
  if (!bar) return;

  if (ids.length > 0) {
    bar.classList.remove('hidden');
    if (badge) badge.textContent = ids.length;
    if (barText) barText.textContent = `${ids.length} protein dipilih untuk perbandingan`;
  } else {
    bar.classList.add('hidden');
  }
}

// Fetch Stats for Hero Section
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const json = await res.json();
    if (json.success && json.data) {
      const elTotal = document.getElementById('stat-total');
      const elHewani = document.getElementById('stat-hewani');
      const elNabati = document.getElementById('stat-nabati');
      if (elTotal) elTotal.textContent = json.data.total;
      if (elHewani) elHewani.textContent = json.data.hewani_count;
      if (elNabati) elNabati.textContent = json.data.nabati_count;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Fetch Catalog Proteins
async function fetchProteins() {
  const loader = document.getElementById('loader');
  const grid = document.getElementById('proteinGrid');
  const empty = document.getElementById('emptyState');
  const countEl = document.getElementById('resultsCount');

  if (loader) loader.style.display = 'block';
  if (grid) grid.style.display = 'none';
  if (empty) empty.style.display = 'none';

  const params = new URLSearchParams();
  if (currentSearch) params.append('search', currentSearch);
  if (currentCategory && currentCategory !== 'Semua') params.append('category', currentCategory);
  if (currentSort) params.append('sort', currentSort);

  try {
    const res = await fetch(`/api/proteins?${params.toString()}`);
    const json = await res.json();

    if (loader) loader.style.display = 'none';
    if (json.success && json.data && json.data.length > 0) {
      window.latestProteins = json.data;
      renderProteins(json.data);
      if (grid) grid.style.display = 'grid';
      if (countEl) {
        countEl.textContent = `Menampilkan ${json.data.length} protein (${currentCategory})`;
      }
    } else {
      window.latestProteins = [];
      if (empty) empty.style.display = 'block';
      if (countEl) countEl.textContent = `0 protein ditemukan`;
    }
  } catch (err) {
    if (loader) loader.style.display = 'none';
    if (empty) empty.style.display = 'block';
    if (countEl) countEl.textContent = `Gagal memuat data`;
    console.error('Failed to load proteins:', err);
  }
}

// Render Protein Cards
function renderProteins(proteins) {
  const grid = document.getElementById('proteinGrid');
  if (!grid) return;
  const compareIds = getCompareIds();

  grid.innerHTML = proteins.map(p => {
    const isSelected = compareIds.includes(p.id);
    const isHewani = (p.source_category || '').toLowerCase() === 'hewani';
    const badgeClass = isHewani ? 'badge-hewani' : 'badge-nabati';
    const fallbackSvg = getProteinFallbackImage(p.pdb_id);
    const foodEmoji = getFoodEmoji(p.source_category, p.food_source);
    const pdbCode = (p.pdb_id || '').toUpperCase();
    const rcsbImgUrl = `https://cdn.rcsb.org/images/structures/${pdbCode.toLowerCase()}_assembly-1.jpeg`;

    const score = p.digestibility_score || 0;
    const scoreColorClass = score >= 90 ? 'score-high' : score >= 80 ? 'score-med' : 'score-low';

    return `
      <article class="protein-card ${isSelected ? 'card-selected' : ''}">
        <!-- Top Image / PDB Banner -->
        <div class="card-media">
          <img src="${rcsbImgUrl}" 
               onerror="this.onerror=null; this.src='${fallbackSvg}';" 
               alt="Struktur molekul ${escapeHTML(p.name)}" 
               class="protein-card-img" 
               loading="lazy">
          <div class="card-media-overlay">
            <span class="badge ${badgeClass}">${isHewani ? '🥩 Hewani' : '🌱 Nabati'}</span>
            <span class="badge-pdb">PDB: ${escapeHTML(pdbCode)}</span>
          </div>
          <div class="card-food-chip">
            <span class="chip-icon">${foodEmoji}</span>
            <span class="chip-text">${escapeHTML(p.food_source || p.common_name)}</span>
          </div>
        </div>

        <div class="card-body">
          <div class="card-title-row">
            <h2 class="card-title">${escapeHTML(p.name)}</h2>
          </div>
          <p class="card-subtitle">${escapeHTML(p.common_name || p.food_source)}</p>

          <!-- Daya Cerna Meter Bar -->
          <div class="digest-meter">
            <div class="meter-info">
              <span class="meter-label">Skor Daya Cerna (DIAAS)</span>
              <span class="meter-val ${scoreColorClass}">${score ? score + '%' : '-'}</span>
            </div>
            <div class="meter-track">
              <div class="meter-fill ${scoreColorClass}" style="width: ${Math.min(score, 100)}%;"></div>
            </div>
          </div>

          <!-- Parameter Specs -->
          <div class="card-props">
            <div class="prop-col-item">
              <span class="label">Berat Molekul</span>
              <span class="val">${p.molecular_weight ? p.molecular_weight + ' kDa' : '-'}</span>
            </div>
            <div class="prop-col-item">
              <span class="label">Titik Isoelektrik</span>
              <span class="val">${p.isoelectric_point ? 'pI ' + p.isoelectric_point : '-'}</span>
            </div>
            <div class="prop-col-item">
              <span class="label">UniProt ID</span>
              <span class="val font-mono">${p.uniprot_id || '-'}</span>
            </div>
            <div class="prop-col-item">
              <span class="label">Kategori Pangan</span>
              <span class="val">${escapeHTML(p.source_category)}</span>
            </div>
          </div>

          <p class="card-desc">${escapeHTML(p.biological_function || p.description)}</p>

          <div class="card-actions">
            <a href="/detail?id=${p.id}" class="btn btn-primary card-action-detail">
              <span>🔍 Detail &amp; 3D</span>
            </a>
            <button class="btn btn-secondary btn-compare-toggle ${isSelected ? 'selected' : ''}" 
                    onclick="toggleCompare(${p.id})" 
                    title="${isSelected ? 'Hapus dari daftar komparasi' : 'Pilih protein untuk dikomparasi'}">
              <span>${isSelected ? '✓ Terpilih' : '⚖️ Bandingkan'}</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function resetFilters() {
  currentCategory = 'Semua';
  currentSearch = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.style.display = 'none';

  const filterBtns = document.querySelectorAll('.filter-btn[data-category]');
  filterBtns.forEach(b => {
    if (b.getAttribute('data-category') === 'Semua') {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  fetchProteins();
}
window.resetFilters = resetFilters;

// Initial Bootstrapping
document.addEventListener('DOMContentLoaded', () => {
  fetchStats();
  fetchProteins();
  updateCompareBar();

  // Search input with debounce & clear button
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.style.display = val.length > 0 ? 'block' : 'none';
      }
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        currentSearch = val;
        fetchProteins();
      }, 300);
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      currentSearch = '';
      fetchProteins();
    });
  }

  // Category filter tabs
  const filterBtns = document.querySelectorAll('.filter-btn[data-category]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category');
      fetchProteins();
    });
  });

  // Sort dropdown
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      fetchProteins();
    });
  }

  // Clear compare bar
  const clearBtn = document.getElementById('clearCompareBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      saveCompareIds([]);
      renderProteins(window.latestProteins || []);
    });
  }
});
