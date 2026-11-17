let currentProtein = null;
let glviewer = null;
let isSpinning = true;
let isDarkViewerBg = true;
let currentStyle = 'cartoon';
let aminoChart = null;

// Helper to get compare list
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
  updateDetailCompareButton();
}

function updateDetailCompareButton() {
  const btn = document.getElementById('btnDetailCompare');
  if (!btn || !currentProtein) return;
  const ids = getCompareIds();
  const isSelected = ids.includes(currentProtein.id);

  if (isSelected) {
    btn.innerHTML = '✓ Terpilih di Komparasi';
    btn.classList.add('selected');
  } else {
    btn.innerHTML = '⚖️ Tambah ke Komparasi';
    btn.classList.remove('selected');
  }
}

async function loadProteinDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  const loader = document.getElementById('loader');
  const content = document.getElementById('detailContent');
  const errorEl = document.getElementById('detailError');

  if (!id) {
    alert('ID protein tidak ditemukan pada URL');
    window.location.href = '/';
    return;
  }

  // Reset state
  if (loader) loader.style.display = 'block';
  if (content) content.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  try {
    const res = await fetch(`/api/proteins/${id}`);

    if (!res.ok) {
      let errorMsg = `Gagal memuat detail protein (HTTP ${res.status}).`;
      try {
        const errJson = await res.json();
        if (errJson.error) errorMsg += ' ' + errJson.error;
      } catch (e) {
        errorMsg += ' ' + res.statusText;
      }
      throw new Error(errorMsg);
    }

    const json = await res.json();

    if (loader) loader.style.display = 'none';
    if (json.success && json.data) {
      currentProtein = json.data;
      renderDetail(json.data);
      if (content) content.style.display = 'block';
      init3DViewer(json.data.pdb_id);
      renderAminoAcidChart(json.data.parsed_amino_acids || [], 'bar');
      renderAminoAcidTable(json.data.parsed_amino_acids || []);
      updateDetailCompareButton();
    } else {
      alert('Protein tidak ditemukan: ' + (json.error || ''));
      window.location.href = '/';
    }
  } catch (err) {
    if (loader) loader.style.display = 'none';
    console.error('Failed to load detail:', err);

    if (errorEl) {
      errorEl.querySelector('.error-message').textContent = err.message;
      errorEl.style.display = 'block';
    } else {
      alert('Gagal memuat detail protein: ' + err.message);
    }
  }
}

// Expose untuk tombol Coba Lagi di HTML
window.retryLoadProteinDetail = loadProteinDetail;

function renderDetail(p) {
  document.title = `${p.name} — Protein Pangan`;
  
  // Breadcrumbs
  const bcCat = document.getElementById('breadcrumbCategory');
  const bcName = document.getElementById('breadcrumbName');
  if (bcCat) bcCat.textContent = p.source_category || 'Detail Protein';
  if (bcName) bcName.textContent = p.name;

  // Header
  document.getElementById('proteinName').textContent = p.name;
  document.getElementById('commonName').textContent = p.common_name || p.food_source;

  const isHewani = (p.source_category || '').toLowerCase() === 'hewani';
  const badgeCategory = document.getElementById('badgeCategory');
  if (badgeCategory) {
    badgeCategory.textContent = isHewani ? '🥩 Hewani' : '🌱 Nabati';
    badgeCategory.className = 'badge ' + (isHewani ? 'badge-hewani' : 'badge-nabati');
  }

  const sourceBadge = document.getElementById('sourceBadge');
  if (sourceBadge) {
    sourceBadge.textContent = p.food_source || '-';
  }

  const uniprotBadge = document.getElementById('uniprotBadge');
  if (uniprotBadge) {
    uniprotBadge.textContent = `UniProt: ${p.uniprot_id || '-'}`;
  }

  const pdbBadge = document.getElementById('pdbBadge');
  if (pdbBadge) {
    pdbBadge.textContent = `PDB: ${p.pdb_id || '-'}`;
  }

  const pdbHeaderBadge = document.getElementById('pdbHeaderBadge');
  if (pdbHeaderBadge) {
    pdbHeaderBadge.textContent = `PDB ID: ${p.pdb_id || '-'}`;
  }

  // Physicochemical Stats
  document.getElementById('valMw').textContent = p.molecular_weight ? `${p.molecular_weight} kDa` : '-';
  document.getElementById('valPi').textContent = p.isoelectric_point ? `${p.isoelectric_point}` : '-';
  document.getElementById('valScore').textContent = p.digestibility_score ? `${p.digestibility_score}% (Tinggi)` : '-';
  document.getElementById('valSource').textContent = p.food_source || '-';
  document.getElementById('valCategory').textContent = p.source_category || '-';
  document.getElementById('valPdb').textContent = p.pdb_id || '-';

  // Overview
  document.getElementById('proteinDesc').textContent = p.description || 'Tidak ada deskripsi tersedia.';
  document.getElementById('bioFunc').textContent = p.biological_function || '-';

  // External Links
  const pdbUrl = `https://www.rcsb.org/structure/${p.pdb_id}`;
  const uniprotUrl = p.reference_url || `https://www.uniprot.org/uniprotkb/${p.uniprot_id}/entry`;

  const refPdb = document.getElementById('refPdbLink');
  if (refPdb) refPdb.href = pdbUrl;

  const refUniprot = document.getElementById('refUniprotLink');
  if (refUniprot) refUniprot.href = uniprotUrl;
}

// 3Dmol.js Viewer Initialization
function init3DViewer(pdbId) {
  const container = document.getElementById('viewer3d');
  const loading = document.getElementById('viewerLoading');
  if (!container || !window.$3Dmol) {
    console.warn('3Dmol library not loaded yet');
    return;
  }

  container.innerHTML = '';
  if (loading) container.appendChild(loading);
  const bgColor = isDarkViewerBg ? '#090d16' : '#f8fafc';
  const config = { backgroundColor: bgColor };
  glviewer = $3Dmol.createViewer(container, config);

  if (!pdbId) {
    if (loading) loading.innerHTML = '<span>PDB ID tidak tersedia untuk protein ini.</span>';
    return;
  }

  // Download PDB directly from RCSB PDB using 3Dmol helper
  $3Dmol.download(`pdb:${pdbId}`, glviewer, {}, function() {
    if (loading) loading.style.display = 'none';
    applyViewerStyle(currentStyle);
    glviewer.zoomTo();
    glviewer.render();
    glviewer.spin(true);
    isSpinning = true;
    const spinBtn = document.getElementById('btnSpin');
    if (spinBtn) {
      spinBtn.textContent = '🔄 Putar: ON';
      spinBtn.classList.add('active');
    }
  });
}

function applyViewerStyle(style) {
  if (!glviewer) return;
  currentStyle = style;
  glviewer.removeAllSurfaces();

  switch (style) {
    case 'stick':
      glviewer.setStyle({}, { stick: { colorscheme: 'amino' } });
      break;
    case 'sphere':
      glviewer.setStyle({}, { sphere: { scale: 0.85, colorscheme: 'spectrum' } });
      break;
    case 'surface':
      glviewer.setStyle({}, { cartoon: { color: 'spectrum' } });
      glviewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.85, colorscheme: 'whiteCarbon' });
      break;
    case 'cartoon':
    default:
      glviewer.setStyle({}, { cartoon: { color: 'spectrum' } });
      break;
  }
  glviewer.render();
}

// Amino Acid Chart Rendering (Chart.js)
function renderAminoAcidChart(aminoAcids, chartType = 'bar') {
  const canvas = document.getElementById('aminoChart') || document.getElementById('aminoAcidChart');
  if (!canvas || !window.Chart) return;

  if (aminoChart) {
    aminoChart.destroy();
  }

  const labels = aminoAcids.map(a => `${a.name} (${a.code})`);
  const data = aminoAcids.map(a => a.amount);
  const backgroundColors = aminoAcids.map(a =>
    a.is_essential ? 'rgba(13, 148, 136, 0.85)' : 'rgba(59, 130, 246, 0.75)'
  );
  const borderColors = aminoAcids.map(a =>
    a.is_essential ? '#0f766e' : '#2563eb'
  );

  const ctx = canvas.getContext('2d');

  if (chartType === 'radar') {
    aminoChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: aminoAcids.map(a => a.code),
        datasets: [{
          label: 'Kandungan Asam Amino (g/100g)',
          data: data,
          backgroundColor: 'rgba(13, 148, 136, 0.25)',
          borderColor: '#0d9488',
          borderWidth: 2,
          pointBackgroundColor: '#0f766e',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#0d9488',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' } }
          }
        },
        scales: {
          r: {
            angleLines: { color: '#e2e8f0' },
            grid: { color: '#e2e8f0' },
            pointLabels: { 
              font: { family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' },
              color: '#334155'
            },
            ticks: { beginAtZero: true, color: '#64748b' }
          }
        }
      }
    });
  } else {
    // Default Bar Chart
    aminoChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Kandungan Asam Amino (g / 100g protein)',
          data: data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterLabel: function(ctx) {
                const item = aminoAcids[ctx.dataIndex];
                return item.is_essential ? 'Kategori: Asam Amino Esensial' : 'Kategori: Asam Amino Non-Esensial';
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { 
              display: true, 
              text: 'g / 100g Protein Murni',
              font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' }
            },
            grid: { color: '#f1f5f9' }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 30,
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }
            },
            grid: { display: false }
          }
        }
      }
    });
  }
}

// Amino Acid Table
function renderAminoAcidTable(aminoAcids) {
  const tbody = document.getElementById('aminoTableBody');
  if (!tbody) return;

  const maxAmount = Math.max(...aminoAcids.map(a => a.amount), 20);

  tbody.innerHTML = aminoAcids.map(a => {
    const pct = ((a.amount / maxAmount) * 100).toFixed(0);
    const badgeType = a.is_essential
      ? '<span class="badge badge-essential">Esensial</span>'
      : '<span class="badge badge-non-essential">Non-Esensial</span>';

    return `
      <tr>
        <td><strong>${escapeHTML(a.name)}</strong></td>
        <td><code class="font-mono">${escapeHTML(a.code)}</code></td>
        <td>${badgeType}</td>
        <td><strong>${a.amount.toFixed(1)} g</strong></td>
        <td style="width: 35%;">
          <div class="ratio-bar-wrap">
            <div class="ratio-bar-fill ${a.is_essential ? 'fill-essential' : 'fill-non-essential'}" style="width: ${pct}%;"></div>
          </div>
        </td>
      </tr>
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

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadProteinDetail();

  // Detail Compare Toggle Button
  const btnDetailCompare = document.getElementById('btnDetailCompare');
  if (btnDetailCompare) {
    btnDetailCompare.addEventListener('click', () => {
      if (!currentProtein) return;
      let ids = getCompareIds();
      const index = ids.indexOf(currentProtein.id);
      if (index > -1) {
        ids.splice(index, 1);
      } else {
        if (ids.length >= 4) {
          alert('Maksimal 4 protein dapat dibandingkan sekaligus.');
          return;
        }
        ids.push(currentProtein.id);
      }
      saveCompareIds(ids);
    });
  }

  // Viewer Style Select
  const styleSelect = document.getElementById('styleSelect');
  if (styleSelect) {
    styleSelect.addEventListener('change', () => {
      applyViewerStyle(styleSelect.value);
    });
  }

  // Spin Toggle Button
  const spinBtn = document.getElementById('btnSpin');
  if (spinBtn) {
    spinBtn.addEventListener('click', () => {
      if (!glviewer) return;
      isSpinning = !isSpinning;
      glviewer.spin(isSpinning);
      glviewer.render();
      spinBtn.textContent = `🔄 Putar: ${isSpinning ? 'ON' : 'OFF'}`;
      spinBtn.classList.toggle('active', isSpinning);
    });
  }

  // Reset Camera Button
  const resetBtn = document.getElementById('btnResetView');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!glviewer) return;
      glviewer.zoomTo();
      glviewer.render();
    });
  }

  // Background Theme Toggle for 3D Viewer
  const bgToggleBtn = document.getElementById('btnBgToggle');
  if (bgToggleBtn) {
    bgToggleBtn.addEventListener('click', () => {
      if (!glviewer) return;
      isDarkViewerBg = !isDarkViewerBg;
      const newBg = isDarkViewerBg ? '#090d16' : '#f8fafc';
      glviewer.setBackgroundColor(newBg);
      glviewer.render();
      bgToggleBtn.classList.toggle('active', !isDarkViewerBg);
    });
  }

  // Chart Type Toggles
  const barBtn = document.getElementById('btnChartBar');
  const radarBtn = document.getElementById('btnChartRadar');

  if (barBtn && radarBtn) {
    barBtn.addEventListener('click', () => {
      barBtn.classList.add('active');
      radarBtn.classList.remove('active');
      if (currentProtein) renderAminoAcidChart(currentProtein.parsed_amino_acids || [], 'bar');
    });

    radarBtn.addEventListener('click', () => {
      radarBtn.classList.add('active');
      barBtn.classList.remove('active');
      if (currentProtein) renderAminoAcidChart(currentProtein.parsed_amino_acids || [], 'radar');
    });
  }
});
