let comparedProteins = [];
let compareChart = null;
let currentChartMode = 'bar';

const COLOR_PALETTE = [
  { bg: 'rgba(13, 148, 136, 0.75)', border: '#0d9488', solid: '#0d9488' },
  { bg: 'rgba(37, 99, 235, 0.75)', border: '#2563eb', solid: '#2563eb' },
  { bg: 'rgba(217, 119, 6, 0.75)', border: '#d97706', solid: '#d97706' },
  { bg: 'rgba(225, 29, 72, 0.75)', border: '#e11d48', solid: '#e11d48' },
];

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

function getCompareIds() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramIds = urlParams.get('ids');
  if (paramIds) {
    return paramIds.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
  }
  try {
    const raw = localStorage.getItem('compare_proteins');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveCompareIds(ids) {
  localStorage.setItem('compare_proteins', JSON.stringify(ids));
}

async function loadComparison() {
  const ids = getCompareIds();
  const loader = document.getElementById('loader');
  const content = document.getElementById('compareContent');
  const empty = document.getElementById('emptyCompareState');

  if (ids.length === 0) {
    if (loader) loader.style.display = 'none';
    if (content) content.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (loader) loader.style.display = 'block';
  if (content) content.style.display = 'none';
  if (empty) empty.style.display = 'none';

  try {
    const res = await fetch(`/api/proteins/compare?ids=${ids.join(',')}`);
    const json = await res.json();

    if (loader) loader.style.display = 'none';
    if (json.success && json.data && json.data.length > 0) {
      comparedProteins = json.data;
      renderComparisonTable(comparedProteins);
      renderCompareChart(comparedProteins, currentChartMode);
      if (content) content.style.display = 'block';
    } else {
      if (empty) empty.style.display = 'block';
    }
  } catch (err) {
    if (loader) loader.style.display = 'none';
    if (empty) empty.style.display = 'block';
    console.error('Failed to load comparison:', err);
  }
}

function removeCompareId(id) {
  let ids = getCompareIds();
  ids = ids.filter(i => i !== id);
  saveCompareIds(ids);
  loadComparison();
}

function renderComparisonTable(proteins) {
  const tbody = document.getElementById('compareTableBody') || document.getElementById('comparisonTableBody');
  if (!tbody) return;

  const headerRow = `
    <tr>
      <th class="prop-col">Protein Terpilih</th>
      ${proteins.map((p, idx) => {
        const col = COLOR_PALETTE[idx % COLOR_PALETTE.length];
        const fallbackSvg = getProteinFallbackImage(p.pdb_id);
        const rcsbImgUrl = `https://cdn.rcsb.org/images/structures/${(p.pdb_id || '').toLowerCase()}_assembly-1.jpeg`;

        return `
          <th class="protein-cmp-header" style="border-top: 4px solid ${col.solid};">
            <div class="cmp-card-preview">
              <img src="${rcsbImgUrl}" 
                   onerror="this.onerror=null; this.src='${fallbackSvg}';" 
                   alt="${escapeHTML(p.name)}" 
                   class="cmp-thumb-img">
              <button onclick="removeCompareId(${p.id})" class="cmp-remove-btn" title="Hapus dari perbandingan">✕</button>
            </div>
            <h3 class="cmp-protein-name">${escapeHTML(p.name)}</h3>
            <span class="cmp-food-source">${escapeHTML(p.food_source || p.common_name)}</span>
          </th>
        `;
      }).join('')}
    </tr>
  `;

  const categoryRow = `
    <tr>
      <th class="prop-col">Kategori Sumber</th>
      ${proteins.map(p => `
        <td style="text-align:center;">
          <span class="badge ${p.source_category.toLowerCase() === 'hewani' ? 'badge-hewani' : 'badge-nabati'}">
            ${p.source_category === 'Hewani' ? '🥩 Hewani' : '🌱 Nabati'}
          </span>
        </td>
      `).join('')}
    </tr>
  `;

  const mwRow = `
    <tr>
      <th class="prop-col">Berat Molekul (kDa)</th>
      ${proteins.map(p => `
        <td style="text-align:center; font-weight:700; font-size:1.05rem;">
          ${p.molecular_weight ? p.molecular_weight + ' kDa' : '-'}
        </td>
      `).join('')}
    </tr>
  `;

  const piRow = `
    <tr>
      <th class="prop-col">Titik Isoelektrik (pI)</th>
      ${proteins.map(p => `
        <td style="text-align:center; font-weight:600; font-family:'JetBrains Mono', monospace;">
          ${p.isoelectric_point || '-'}
        </td>
      `).join('')}
    </tr>
  `;

  const scoreRow = `
    <tr>
      <th class="prop-col">Skor Daya Cerna (DIAAS)</th>
      ${proteins.map(p => `
        <td style="text-align:center; font-weight:800; color:var(--primary); font-size:1.1rem;">
          ${p.digestibility_score ? p.digestibility_score + '%' : '-'}
        </td>
      `).join('')}
    </tr>
  `;

  const pdbRow = `
    <tr>
      <th class="prop-col">PDB ID / Struktur 3D</th>
      ${proteins.map(p => `
        <td style="text-align:center;">
          <a href="https://www.rcsb.org/structure/${p.pdb_id}" target="_blank" rel="noopener" class="badge-code font-mono" style="display:inline-block; text-decoration:none;">
            ${p.pdb_id} ↗
          </a>
        </td>
      `).join('')}
    </tr>
  `;

  const uniprotRow = `
    <tr>
      <th class="prop-col">UniProt Accession</th>
      ${proteins.map(p => `
        <td style="text-align:center;">
          <a href="${p.reference_url || 'https://www.uniprot.org/uniprotkb/' + p.uniprot_id + '/entry'}" target="_blank" rel="noopener" style="color:var(--accent); font-weight:600; text-decoration:none;" class="font-mono">
            ${p.uniprot_id} ↗
          </a>
        </td>
      `).join('')}
    </tr>
  `;

  const functionRow = `
    <tr>
      <th class="prop-col">Fungsi Biologis &amp; Pangan</th>
      ${proteins.map(p => `
        <td style="font-size:0.875rem; line-height:1.6; color:#334155; text-align:left;">
          ${escapeHTML(p.biological_function)}
        </td>
      `).join('')}
    </tr>
  `;

  const actionRow = `
    <tr>
      <th class="prop-col">Aksi</th>
      ${proteins.map(p => `
        <td style="text-align:center;">
          <a href="/detail?id=${p.id}" class="btn btn-primary btn-sm">
            🔍 Detail &amp; 3D →
          </a>
        </td>
      `).join('')}
    </tr>
  `;

  tbody.innerHTML = headerRow + categoryRow + mwRow + piRow + scoreRow + pdbRow + uniprotRow + functionRow + actionRow;
}

// Chart.js Multi-Dataset Comparison Chart
function renderCompareChart(proteins, mode = 'bar') {
  const canvas = document.getElementById('compareChart');
  if (!canvas || !window.Chart || proteins.length === 0) return;

  if (compareChart) {
    compareChart.destroy();
  }

  // Get common amino acid labels from the first protein
  const firstAminoList = proteins[0].parsed_amino_acids || [];
  const labels = firstAminoList.map(a => `${a.name} (${a.code})`);
  const codeLabels = firstAminoList.map(a => a.code);

  const datasets = proteins.map((p, idx) => {
    const col = COLOR_PALETTE[idx % COLOR_PALETTE.length];
    const aminoMap = {};
    (p.parsed_amino_acids || []).forEach(a => {
      aminoMap[a.code] = a.amount;
    });

    const data = firstAminoList.map(a => aminoMap[a.code] || 0);

    return {
      label: p.name,
      data: data,
      backgroundColor: mode === 'radar' ? col.bg : col.bg,
      borderColor: col.border,
      borderWidth: 2,
      borderRadius: mode === 'bar' ? 4 : 0,
      pointBackgroundColor: col.solid,
      pointBorderColor: '#fff',
      pointRadius: 4,
      fill: mode === 'radar'
    };
  });

  const ctx = canvas.getContext('2d');

  if (mode === 'radar') {
    compareChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: codeLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' } }
          }
        },
        elements: {
          line: { tension: 0.1 }
        },
        scales: {
          r: {
            angleLines: { color: '#e2e8f0' },
            grid: { color: '#e2e8f0' },
            pointLabels: { 
              font: { family: "'JetBrains Mono', monospace", size: 11, weight: 'bold' },
              color: '#1e293b'
            },
            ticks: { beginAtZero: true }
          }
        }
      }
    });
  } else {
    compareChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' } }
          },
          tooltip: {
            mode: 'index',
            intersect: false
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
              font: { family: "'Plus Jakarta Sans', sans-serif", size: 10.5 }
            },
            grid: { display: false }
          }
        }
      }
    });
  }
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
  loadComparison();

  // Mode toggles
  const barBtn = document.getElementById('cmpBarBtn');
  const radarBtn = document.getElementById('cmpRadarBtn');

  if (barBtn && radarBtn) {
    barBtn.addEventListener('click', () => {
      barBtn.classList.add('active');
      radarBtn.classList.remove('active');
      currentChartMode = 'bar';
      if (comparedProteins.length > 0) renderCompareChart(comparedProteins, 'bar');
    });

    radarBtn.addEventListener('click', () => {
      radarBtn.classList.add('active');
      barBtn.classList.remove('active');
      currentChartMode = 'radar';
      if (comparedProteins.length > 0) renderCompareChart(comparedProteins, 'radar');
    });
  }

  // Clear all compare
  const clearBtn = document.getElementById('btnClearAll') || document.getElementById('clearAllCompareBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('Hapus semua protein dari daftar perbandingan?')) {
        saveCompareIds([]);
        loadComparison();
      }
    });
  }
});
