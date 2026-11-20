/* global L, proj4, PINGTUNG_OFFICES, TOWNSHIPS, INITIAL_CONTROL_POINTS */
'use strict';

// 1. 註冊臺灣常用座標系統至 Proj4js
proj4.defs('EPSG:3824', '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs +type=crs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs +type=crs');
proj4.defs('EPSG:3826', '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs');

const ORDER_META = {
  1: { label: '一等控制點', color: '#b91c1c', shape: 'triangle', symbol: '▲' },
  2: { label: '二等控制點', color: '#c2410c', shape: 'diamond', symbol: '◆' },
  3: { label: '三等控制點', color: '#1d4ed8', shape: 'square', symbol: '■' },
  4: { label: '四等／圖根點', color: '#047857', shape: 'circle', symbol: '●' }
};

// ISO 27001 檔案匯入安全上限
const SECURITY_LIMITS = {
  MAX_FILE_BYTES: 5 * 1024 * 1024, // 5 MB
  MAX_IMPORT_ROWS: 10000,
  ALLOWED_EXTENSIONS: ['.csv', '.geojson', '.json']
};

const state = {
  points: [...INITIAL_CONTROL_POINTS],
  filteredPoints: [],
  currentCrs: 'EPSG:3824',
  selectedOrders: new Set([1, 2, 3, 4]),
  selectedOffice: 'all',
  selectedTownship: 'all',
  selectedStatus: 'all',
  searchQuery: '',
  radiusMeters: 0,
  radiusCenter: null,
  showLabels: true,
  activePoint: null,
  measureMode: false,
  measurePoints: [],
  tableMode: false,
  lastFocusedElement: null,
  auditLogs: []
};

// ISO 27001 A.8.15 作業安全稽核日誌（僅存於本機記憶體工作階段，不寫入敏感個資）
function addAuditLog(action, detail) {
  const ts = new Date().toISOString();
  const entry = `[${ts}] [${action}] ${detail}`;
  state.auditLogs.push(entry);
  if (state.auditLogs.length > 200) state.auditLogs.shift();
}

// 無障礙：螢幕報讀器即時播報
function announce(message) {
  const el = document.getElementById('sr-announcer');
  if (!el) return;
  el.textContent = '';
  window.setTimeout(() => {
    el.textContent = message;
  }, 50);
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function flyToSafe(latlng, zoom) {
  if (prefersReducedMotion()) {
    map.setView(latlng, zoom, { animate: false });
  } else {
    map.flyTo(latlng, zoom, { duration: 0.6 });
  }
}

// 2. 初始化 Leaflet 地圖（中心設於屏東縣）
const map = L.map('map', {
  center: [22.48, 120.58],
  zoom: 10,
  zoomControl: false
});
L.control.zoom({ position: 'topright', zoomInTitle: '放大地圖', zoomOutTitle: '縮小地圖' }).addTo(map);
L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

// 3. 內政部國土測繪中心 HTTPS WMTS 底圖與 OpenStreetMap 備援
const basemaps = {
  EMAP: L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '© 內政部國土測繪中心 (NLSC)'
  }),
  PHOTO2: L.tileLayer('https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: '© 內政部國土測繪中心 (NLSC) 正射影像'
  }),
  B5000: L.tileLayer('https://wmts.nlsc.gov.tw/wmts/B5000/default/GoogleMapsCompatible/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: '© 內政部國土測繪中心 (NLSC) 1/5000基本地形圖'
  }),
  LUIMAP: L.tileLayer('https://wmts.nlsc.gov.tw/wmts/LUIMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
    maxZoom: 18,
    attribution: '© 內政部國土測繪中心 (NLSC) 國土利用現況'
  }),
  OSM: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  })
};

let currentBasemapLayer = basemaps.EMAP.addTo(map);

const overlayEmap2 = L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP2/default/GoogleMapsCompatible/{z}/{y}/{x}', {
  maxZoom: 19,
  opacity: 0.85,
  attribution: '© NLSC EMAP2'
});

const townshipLayer = L.layerGroup().addTo(map);
const pointsLayer = L.layerGroup().addTo(map);
const bufferLayer = L.layerGroup().addTo(map);
const measureLayer = L.layerGroup().addTo(map);

// 4. 安全與座標工具函式
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ISO 27001 / OWASP 防範 CSV 公式注入 (Formula Injection)
function sanitizeCsvCell(value) {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function isValidWgs84(lon, lat) {
  return Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
}

function toDMS(deg, isLat) {
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = ((mFloat - m) * 60).toFixed(3);
  return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(6, '0')}"${dir}`;
}

function convertFromWgs84(lon, lat, targetCrs) {
  if (targetCrs === 'EPSG:4326') {
    return { x: lon, y: lat };
  }
  const [x, y] = proj4('EPSG:4326', targetCrs, [lon, lat]);
  return { x, y };
}

function convertToWgs84(x, y, sourceCrs) {
  if (sourceCrs === 'EPSG:4326') {
    return { lon: x, lat: y };
  }
  const [lon, lat] = proj4(sourceCrs, 'EPSG:4326', [x, y]);
  return { lon, lat };
}

function formatCoordPair(lon, lat, crs = state.currentCrs) {
  const { x, y } = convertFromWgs84(lon, lat, crs);
  if (crs === 'EPSG:3826') {
    return `E ${x.toFixed(3)} m, N ${y.toFixed(3)} m`;
  }
  return `${y.toFixed(6)}°, ${x.toFixed(6)}°`;
}

function createOrderIcon(order, status) {
  const meta = ORDER_META[order] || ORDER_META[4];
  const opacity = status === '遺失' ? 0.6 : 1;
  const stroke = status === '遺失' ? '#0f172a' : '#ffffff';
  let svgShape = '';

  if (meta.shape === 'triangle') {
    svgShape = `<polygon points="12,2 22,20 2,20" fill="${meta.color}" stroke="${stroke}" stroke-width="2"/>`;
  } else if (meta.shape === 'diamond') {
    svgShape = `<polygon points="12,2 22,12 12,22 2,12" fill="${meta.color}" stroke="${stroke}" stroke-width="2"/>`;
  } else if (meta.shape === 'square') {
    svgShape = `<rect x="4" y="4" width="16" height="16" rx="2" fill="${meta.color}" stroke="${stroke}" stroke-width="2"/>`;
  } else {
    svgShape = `<circle cx="12" cy="12" r="8" fill="${meta.color}" stroke="${stroke}" stroke-width="2"/>`;
  }

  return L.divIcon({
    className: 'custom-cp-icon',
    html: `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="opacity:${opacity}">${svgShape}</svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

// 5. 渲染 33 鄉鎮市行政區參考標註
function renderTownshipMarkers() {
  townshipLayer.clearLayers();
  TOWNSHIPS.forEach((tw) => {
    const marker = L.circleMarker([tw.lat, tw.lon], {
      radius: 4,
      color: '#334155',
      weight: 1.5,
      fillColor: '#ffffff',
      fillOpacity: 0.95
    });
    marker.bindTooltip(escapeHtml(tw.name), {
      permanent: true,
      direction: 'top',
      offset: [0, -4],
      className: 'township-label'
    });
    marker.on('click', () => {
      document.getElementById('office-select').value = tw.office;
      state.selectedOffice = tw.office;
      populateTownshipSelect();
      document.getElementById('township-select').value = tw.name;
      state.selectedTownship = tw.name;
      applyFilters();
      flyToSafe([tw.lat, tw.lon], 13);
    });
    townshipLayer.addLayer(marker);
  });
}

// 6. 篩選與渲染控制點
function applyFilters() {
  const q = state.searchQuery.trim().toLowerCase();
  const radius = state.radiusMeters;
  const center = state.radiusCenter;

  state.filteredPoints = state.points.filter((pt) => {
    if (!state.selectedOrders.has(Number(pt.order))) return false;
    if (state.selectedOffice !== 'all' && pt.office !== state.selectedOffice) return false;
    if (state.selectedTownship !== 'all' && pt.township !== state.selectedTownship) return false;
    if (state.selectedStatus !== 'all' && pt.status !== state.selectedStatus) return false;

    if (q) {
      const hay = `${pt.id} ${pt.name} ${pt.township} ${pt.office} ${pt.section}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (radius > 0 && center) {
      const dist = map.distance([center.lat, center.lon], [pt.lat, pt.lon]);
      if (dist > radius) return false;
    }
    return true;
  });

  renderMapPoints();
  renderPointList();
  renderAccessibleTable();
  renderBufferCircle();
  updateOrderCounts();
  renderStats();
  announce(`已更新篩選結果，共 ${state.filteredPoints.length} 筆控制點。`);
}

function updateOrderCounts() {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  state.filteredPoints.forEach((pt) => {
    const o = Number(pt.order);
    if (counts[o] !== undefined) counts[o]++;
  });
  [1, 2, 3, 4].forEach((o) => {
    document.getElementById(`count-order-${o}`).textContent = String(counts[o]);
  });
  document.getElementById('result-count').textContent = String(state.filteredPoints.length);
}

function renderMapPoints() {
  pointsLayer.clearLayers();
  state.filteredPoints.forEach((pt) => {
    const orderInfo = ORDER_META[pt.order] || ORDER_META[4];
    const marker = L.marker([pt.lat, pt.lon], {
      icon: createOrderIcon(pt.order, pt.status),
      title: `${pt.id} ${pt.name}（${orderInfo.label}）`,
      alt: `${pt.id} ${pt.name}，${orderInfo.label}，位於${pt.township}`
    });

    if (state.showLabels) {
      marker.bindTooltip(escapeHtml(pt.id), {
        permanent: false,
        direction: 'right',
        offset: [10, 0],
        className: 'cp-label'
      });
    }

    marker.on('click', () => openPointDetail(pt));
    pointsLayer.addLayer(marker);
  });
}

// 無障礙：使用原生 <button> 卡片，確保鍵盤 Tab / Enter / Space 完整操作
function renderPointList() {
  const container = document.getElementById('point-list');
  if (state.filteredPoints.length === 0) {
    container.innerHTML = '<div class="notice-box notice-spaced" role="status">查無符合條件的控制點，請放寬篩選條件或調整環域半徑。</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.filteredPoints.slice(0, 200).forEach((pt) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `point-card order-${pt.order}`;
    const orderInfo = ORDER_META[pt.order] || ORDER_META[4];
    card.setAttribute('aria-label', `${pt.id} ${pt.name}，${orderInfo.label}，${pt.township}${pt.section}，狀態${pt.status}，檢視點之記`);

    card.innerHTML = `
      <div class="point-card-top">
        <span class="point-title">${escapeHtml(orderInfo.symbol)} ${escapeHtml(pt.id)} · ${escapeHtml(pt.name)}</span>
        <span class="order-badge order-${pt.order}">${escapeHtml(orderInfo.label)}</span>
      </div>
      <div class="point-meta">
        <span>${escapeHtml(pt.township)}（${escapeHtml(pt.section)}）</span>
        <span>高程 ${Number(pt.h).toFixed(2)} m · ${escapeHtml(pt.status)}</span>
      </div>
      <div class="point-coords mono">${escapeHtml(formatCoordPair(pt.lon, pt.lat))}</div>
    `;

    card.addEventListener('click', () => {
      if (!state.tableMode) {
        flyToSafe([pt.lat, pt.lon], Math.max(map.getZoom(), 15));
      }
      openPointDetail(pt, card);
    });
    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
}

// 無障礙：標準語意化資料表替代檢視
function renderAccessibleTable() {
  const tbody = document.getElementById('a11y-table-body');
  const thCoords = document.getElementById('th-coords');
  if (thCoords) thCoords.textContent = `座標 (${state.currentCrs})`;
  if (!tbody) return;

  if (state.filteredPoints.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9">查無符合條件的控制點資料。</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.filteredPoints.slice(0, 500).forEach((pt) => {
    const orderInfo = ORDER_META[pt.order] || ORDER_META[4];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <th scope="row" class="mono">${escapeHtml(pt.id)}</th>
      <td>${escapeHtml(pt.name)}</td>
      <td><span class="order-badge order-${pt.order}">${escapeHtml(orderInfo.symbol)} ${escapeHtml(orderInfo.label)}</span></td>
      <td>${escapeHtml(pt.township)}・${escapeHtml(pt.section)}</td>
      <td>${escapeHtml(pt.office)}</td>
      <td class="mono">${escapeHtml(formatCoordPair(pt.lon, pt.lat))}</td>
      <td class="mono">${Number(pt.h).toFixed(2)}</td>
      <td>${escapeHtml(pt.status)}</td>
      <td><button type="button" class="btn-table-action">檢視點之記</button></td>
    `;
    const btn = tr.querySelector('.btn-table-action');
    btn.setAttribute('aria-label', `檢視 ${pt.id} ${pt.name} 之點之記詳細資訊`);
    btn.addEventListener('click', () => openPointDetail(pt, btn));
    fragment.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

function renderBufferCircle() {
  bufferLayer.clearLayers();
  if (state.radiusMeters > 0 && state.radiusCenter) {
    L.circle([state.radiusCenter.lat, state.radiusCenter.lon], {
      radius: state.radiusMeters,
      color: '#0f766e',
      weight: 2,
      dashArray: '6 4',
      fillColor: '#14b8a6',
      fillOpacity: 0.12
    }).addTo(bufferLayer);

    L.circleMarker([state.radiusCenter.lat, state.radiusCenter.lon], {
      radius: 5,
      color: '#0f766e',
      fillColor: '#ffffff',
      fillOpacity: 1
    }).addTo(bufferLayer);
  }
}

function renderStats() {
  const total = state.points.length;
  const normalCount = state.points.filter((p) => p.status === '正常').length;
  const byOrder = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const byOffice = {};
  Object.keys(PINGTUNG_OFFICES).forEach((o) => { byOffice[o] = 0; });

  state.points.forEach((p) => {
    if (byOrder[p.order] !== undefined) byOrder[p.order]++;
    byOffice[p.office] = (byOffice[p.office] || 0) + 1;
  });

  document.getElementById('stats-cards').innerHTML = `
    <div class="stat-box"><strong>${total}</strong><span>全縣控制點總數</span></div>
    <div class="stat-box"><strong>${normalCount}</strong><span>正常可用點位</span></div>
    <div class="stat-box"><strong class="text-order-1">${byOrder[1]}</strong><span>一等控制點</span></div>
    <div class="stat-box"><strong class="text-order-2">${byOrder[2]}</strong><span>二等控制點</span></div>
    <div class="stat-box"><strong class="text-order-3">${byOrder[3]}</strong><span>三等控制點</span></div>
    <div class="stat-box"><strong class="text-order-4">${byOrder[4]}</strong><span>四等／圖根點</span></div>
  `;

  const maxOffice = Math.max(1, ...Object.values(byOffice));
  document.getElementById('office-stats').innerHTML = Object.entries(byOffice)
    .map(([office, count]) => `
      <div class="office-bar-row">
        <div class="office-bar-label"><span>${escapeHtml(office)}</span><strong class="mono">${count}</strong></div>
        <div class="office-bar-track" role="progressbar" aria-label="${escapeHtml(office)}控制點數" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${maxOffice}">
          <div class="office-bar-fill" style="width:${(count / maxOffice) * 100}%"></div>
        </div>
      </div>
    `)
    .join('');
}

// 7. 彈出視窗開啟／關閉與無障礙焦點還原
function openDialog(dialogId, triggerEl) {
  state.lastFocusedElement = triggerEl || document.activeElement;
  const dialog = document.getElementById(dialogId);
  if (dialog && !dialog.open) {
    dialog.showModal();
  }
}

function closeDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (dialog && dialog.open) {
    dialog.close();
  }
}

function openPointDetail(pt, triggerEl) {
  state.activePoint = pt;
  const orderInfo = ORDER_META[pt.order] || ORDER_META[4];
  const twd97 = convertFromWgs84(pt.lon, pt.lat, 'EPSG:3824');
  const tm2 = convertFromWgs84(pt.lon, pt.lat, 'EPSG:3826');

  const badge = document.getElementById('detail-order-badge');
  badge.className = `order-badge order-${pt.order}`;
  badge.textContent = `${orderInfo.symbol} ${orderInfo.label}`;

  document.getElementById('detail-title').textContent = `${pt.id} — ${pt.name}`;
  document.getElementById('detail-body').innerHTML = `
    <table class="detail-table">
      <tbody>
        <tr><th scope="row">行政轄區</th><td>${escapeHtml(pt.township)}・${escapeHtml(pt.section)}</td></tr>
        <tr><th scope="row">地政事務所</th><td>${escapeHtml(pt.office)}</td></tr>
        <tr><th scope="row">管理機關</th><td>${escapeHtml(pt.authority)}</td></tr>
        <tr><th scope="row">點位狀態</th><td><strong>${escapeHtml(pt.status)}</strong>（標石類型：${escapeHtml(pt.monument)}）</td></tr>
        <tr><th scope="row">TWD97 (EPSG:3824)</th><td class="mono">${twd97.y.toFixed(6)}°, ${twd97.x.toFixed(6)}°<br><small>${toDMS(twd97.y, true)} / ${toDMS(twd97.x, false)}</small></td></tr>
        <tr><th scope="row">WGS84 (EPSG:4326)</th><td class="mono">${pt.lat.toFixed(6)}°, ${pt.lon.toFixed(6)}°<br><small>${toDMS(pt.lat, true)} / ${toDMS(pt.lon, false)}</small></td></tr>
        <tr><th scope="row">TWD97 TM2 (3826)</th><td class="mono">E: ${tm2.x.toFixed(3)} m, N: ${tm2.y.toFixed(3)} m</td></tr>
        <tr><th scope="row">正高 (H)</th><td class="mono">${Number(pt.h).toFixed(3)} m (TWVD2001)</td></tr>
        <tr><th scope="row">埋設／檢測日期</th><td>${escapeHtml(pt.installDate)}</td></tr>
        <tr><th scope="row">點之記備註</th><td>${escapeHtml(pt.note)}</td></tr>
      </tbody>
    </table>
  `;

  addAuditLog('VIEW_POINT', `檢視控制點 ${pt.id} (${pt.township})`);
  openDialog('dialog-detail', triggerEl);
}

// 8. 測距工具
function startMeasureMode() {
  state.measureMode = true;
  state.measurePoints = [];
  measureLayer.clearLayers();
  const btn = document.getElementById('btn-measure');
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');
  document.getElementById('tool-banner').classList.remove('hidden');
  document.getElementById('tool-banner-text').textContent = '測距模式：請在地圖上依序點擊兩點以上量測距離';
  announce('已進入地圖測距模式');
}

function stopMeasureMode() {
  state.measureMode = false;
  state.measurePoints = [];
  measureLayer.clearLayers();
  const btn = document.getElementById('btn-measure');
  btn.classList.remove('active');
  btn.setAttribute('aria-pressed', 'false');
  document.getElementById('tool-banner').classList.add('hidden');
  announce('已結束地圖測距模式');
}

function handleMeasureClick(latlng) {
  state.measurePoints.push(latlng);
  measureLayer.clearLayers();

  state.measurePoints.forEach((p) => {
    L.circleMarker(p, { radius: 5, color: '#0f766e', fillColor: '#ffffff', fillOpacity: 1 }).addTo(measureLayer);
  });

  if (state.measurePoints.length >= 2) {
    L.polyline(state.measurePoints, { color: '#0f766e', weight: 3, dashArray: '6 4' }).addTo(measureLayer);
    let total = 0;
    for (let i = 1; i < state.measurePoints.length; i++) {
      total += map.distance(state.measurePoints[i - 1], state.measurePoints[i]);
    }
    const text = total >= 1000 ? `${(total / 1000).toFixed(3)} 公里` : `${total.toFixed(1)} 公尺`;
    document.getElementById('tool-banner-text').textContent = `累計距離：${text}（共 ${state.measurePoints.length} 點，繼續點擊或按結束）`;
  }
}

// 9. CSV / GeoJSON 安全匯入與防注入匯出
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function handleImportFile(file) {
  const statusEl = document.getElementById('import-status');
  const sourceCrs = document.getElementById('import-crs').value;
  const mode = document.getElementById('import-mode').value;

  // ISO 27001 輸入安全檢查：副檔名白名單與檔案大小上限
  const lowerName = file.name.toLowerCase();
  const hasAllowedExt = SECURITY_LIMITS.ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!hasAllowedExt) {
    statusEl.textContent = '安全阻擋：僅允許匯入 .csv、.geojson 或 .json 格式檔案。';
    addAuditLog('IMPORT_REJECTED', `不允許的檔案格式：${file.name}`);
    return;
  }
  if (file.size > SECURITY_LIMITS.MAX_FILE_BYTES) {
    statusEl.textContent = '安全阻擋：檔案大小超過 5 MB 上限，請分批匯入。';
    addAuditLog('IMPORT_REJECTED', `檔案過大 (${file.size} bytes)`);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = String(e.target.result).replace(/^\uFEFF/, '');
      const imported = [];

      if (lowerName.endsWith('.json') || lowerName.endsWith('.geojson')) {
        const gj = JSON.parse(raw);
        const features = Array.isArray(gj.features) ? gj.features.slice(0, SECURITY_LIMITS.MAX_IMPORT_ROWS) : [];
        features.forEach((f, idx) => {
          if (!f || !f.geometry || f.geometry.type !== 'Point' || !Array.isArray(f.geometry.coordinates)) return;
          const [rawX, rawY] = f.geometry.coordinates;
          const { lon, lat } = convertToWgs84(Number(rawX), Number(rawY), sourceCrs);
          if (!isValidWgs84(lon, lat)) return;
          const p = f.properties || {};
          imported.push({
            id: String(p.id || p['點號'] || `IMP-${idx + 1}`).slice(0, 40),
            name: String(p.name || p['點名'] || `匯入點位-${idx + 1}`).slice(0, 80),
            order: Math.min(4, Math.max(1, Number(p.order || p['等級'] || 4) || 4)),
            township: String(p.township || p['鄉鎮市'] || '屏東縣').slice(0, 30),
            office: String(p.office || p['地政事務所'] || '屏東地政事務所').slice(0, 30),
            authority: String(p.authority || '使用者本機匯入圖資').slice(0, 60),
            section: String(p.section || p['地段'] || '-').slice(0, 40),
            lat,
            lon,
            h: Number.isFinite(Number(p.h || p['高程'])) ? Number(p.h || p['高程']) : 0,
            monument: String(p.monument || '控制點').slice(0, 40),
            status: String(p.status || p['狀態'] || '正常').slice(0, 20),
            installDate: String(p.installDate || '-').slice(0, 20),
            note: String(p.note || '由本機 GeoJSON 匯入').slice(0, 200)
          });
        });
      } else {
        const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error('CSV 至少需包含標題列與一筆資料');
        const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
        const findCol = (keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));

        const iId = findCol(['點號', 'id', 'no']);
        const iName = findCol(['點名', 'name']);
        const iOrder = findCol(['等級', 'order', 'level']);
        const iX = findCol(['x', '經度', 'lon', 'lng', 'e']);
        const iY = findCol(['y', '緯度', 'lat', 'n']);
        const iH = findCol(['高程', 'h', 'elev']);
        const iTown = findCol(['鄉鎮', 'town']);
        const iOffice = findCol(['事務所', 'office']);
        const iStatus = findCol(['狀態', 'status']);

        if (iX === -1 || iY === -1) throw new Error('找不到 X/經度 或 Y/緯度 欄位');

        const maxRows = Math.min(lines.length, SECURITY_LIMITS.MAX_IMPORT_ROWS + 1);
        for (let r = 1; r < maxRows; r++) {
          const cols = parseCsvLine(lines[r]);
          const xVal = parseFloat(cols[iX]);
          const yVal = parseFloat(cols[iY]);
          if (Number.isNaN(xVal) || Number.isNaN(yVal)) continue;

          const { lon, lat } = convertToWgs84(xVal, yVal, sourceCrs);
          if (!isValidWgs84(lon, lat)) continue;

          imported.push({
            id: (iId >= 0 ? cols[iId] : `CSV-${r}`).slice(0, 40),
            name: (iName >= 0 ? cols[iName] : `匯入點-${r}`).slice(0, 80),
            order: iOrder >= 0 ? Math.min(4, Math.max(1, parseInt(cols[iOrder], 10) || 4)) : 4,
            township: (iTown >= 0 ? cols[iTown] : '屏東縣').slice(0, 30),
            office: (iOffice >= 0 ? cols[iOffice] : '屏東地政事務所').slice(0, 30),
            authority: '使用者本機匯入圖資',
            section: '-',
            lat,
            lon,
            h: iH >= 0 ? parseFloat(cols[iH]) || 0 : 0,
            monument: '控制點',
            status: (iStatus >= 0 ? cols[iStatus] || '正常' : '正常').slice(0, 20),
            installDate: '-',
            note: '由本機 CSV 匯入'
          });
        }
      }

      if (imported.length === 0) throw new Error('未解析到有效且合法範圍內之控制點座標');
      state.points = mode === 'replace' ? imported : [...state.points, ...imported];
      document.getElementById('data-source-badge').textContent = `已載入本機圖資（共 ${state.points.length} 點）`;
      statusEl.textContent = `安全驗證通過，成功於本機匯入 ${imported.length} 筆控制點！`;
      addAuditLog('IMPORT_OK', `本機匯入 ${imported.length} 筆 (${sourceCrs}, 模式: ${mode})`);
      applyFilters();
      flyToSafe([imported[0].lat, imported[0].lon], 13);
    } catch (err) {
      statusEl.textContent = `匯入失敗：${err.message}`;
      addAuditLog('IMPORT_ERROR', err.message);
    }
  };
  reader.readAsText(file, 'utf-8');
}

function exportFilteredCsv() {
  const crs = state.currentCrs;
  const header = ['點號', '點名', '等級', '鄉鎮市', '地政事務所', '地段', `X(${crs})`, `Y(${crs})`, '高程(m)', '狀態'];
  const rows = state.filteredPoints.map((pt) => {
    const { x, y } = convertFromWgs84(pt.lon, pt.lat, crs);
    const xStr = crs === 'EPSG:3826' ? x.toFixed(3) : x.toFixed(6);
    const yStr = crs === 'EPSG:3826' ? y.toFixed(3) : y.toFixed(6);
    return [pt.id, pt.name, pt.order, pt.township, pt.office, pt.section, xStr, yStr, pt.h, pt.status]
      .map(sanitizeCsvCell)
      .join(',');
  });

  const csvContent = '\uFEFF' + [header.map(sanitizeCsvCell).join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pingtung_control_points_${crs.replace(':', '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  addAuditLog('EXPORT_CSV', `匯出 ${state.filteredPoints.length} 筆控制點 (${crs})`);
  announce(`已匯出 ${state.filteredPoints.length} 筆控制點 CSV 檔案`);
}

function exportAuditLogFile() {
  const content = state.auditLogs.join('\n') + '\n';
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pingtung_gis_audit_log_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// 10. UI 綁定與無障礙互動初始化
function populateTownshipSelect() {
  const sel = document.getElementById('township-select');
  const list = state.selectedOffice === 'all'
    ? TOWNSHIPS.map((t) => t.name)
    : (PINGTUNG_OFFICES[state.selectedOffice] || []);
  sel.innerHTML = '<option value="all">全部鄉鎮市</option>' +
    list.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
}

function updateLocateLabels() {
  const crs = document.getElementById('locate-crs').value;
  const xLabel = document.getElementById('locate-x-label');
  const yLabel = document.getElementById('locate-y-label');
  const xInput = document.getElementById('locate-x');
  const yInput = document.getElementById('locate-y');

  if (crs === 'EPSG:3826') {
    xLabel.textContent = '橫坐標 E (East, m)';
    yLabel.textContent = '縱坐標 N (North, m)';
    if (parseFloat(xInput.value) < 1000) {
      const converted = convertFromWgs84(parseFloat(xInput.value) || 120.4879, parseFloat(yInput.value) || 22.6761, 'EPSG:3826');
      xInput.value = converted.x.toFixed(3);
      yInput.value = converted.y.toFixed(3);
    }
  } else {
    xLabel.textContent = '經度 (Longitude, °)';
    yLabel.textContent = '緯度 (Latitude, °)';
    if (parseFloat(xInput.value) > 1000) {
      const converted = convertToWgs84(parseFloat(xInput.value), parseFloat(yInput.value), 'EPSG:3826');
      xInput.value = converted.lon.toFixed(6);
      yInput.value = converted.lat.toFixed(6);
    }
  }
  updateLocatePreview();
}

function updateLocatePreview() {
  const crs = document.getElementById('locate-crs').value;
  const x = parseFloat(document.getElementById('locate-x').value);
  const y = parseFloat(document.getElementById('locate-y').value);
  const preview = document.getElementById('locate-converted');
  if (Number.isNaN(x) || Number.isNaN(y)) {
    preview.textContent = '請輸入有效數值';
    return;
  }
  try {
    const { lon, lat } = convertToWgs84(x, y, crs);
    if (!isValidWgs84(lon, lat)) {
      preview.textContent = '座標數值超出有效經緯度範圍，請重新確認';
      return;
    }
    const c3824 = convertFromWgs84(lon, lat, 'EPSG:3824');
    const c3826 = convertFromWgs84(lon, lat, 'EPSG:3826');
    preview.innerHTML = `
      TWD97 (EPSG:3824): ${c3824.y.toFixed(6)}°, ${c3824.x.toFixed(6)}°<br>
      WGS84 (EPSG:4326): ${lat.toFixed(6)}°, ${lon.toFixed(6)}°<br>
      TWD97 TM2 (3826): E ${c3826.x.toFixed(3)} m, N ${c3826.y.toFixed(3)} m
    `;
  } catch {
    preview.textContent = '座標轉換失敗，請確認數值範圍';
  }
}

function toggleTableView(enable) {
  state.tableMode = enable;
  const mapWrapper = document.getElementById('map-wrapper');
  const tableView = document.getElementById('table-view');
  const btnView = document.getElementById('btn-view-mode');

  mapWrapper.classList.toggle('hidden', enable);
  tableView.classList.toggle('hidden', !enable);
  btnView.setAttribute('aria-pressed', String(enable));
  btnView.textContent = enable ? '地圖檢視' : '表格檢視';

  if (!enable) {
    window.setTimeout(() => map.invalidateSize(), 100);
  }
  addAuditLog('VIEW_MODE', enable ? '切換至無障礙資料表檢視' : '切換至互動電子地圖');
  announce(enable ? '已切換為無障礙控制點資料表檢視' : '已切換為互動電子地圖檢視');
}

function initAccessibilityControls() {
  // 字級切換
  document.querySelectorAll('[data-font-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.fontSize;
      document.documentElement.classList.remove('font-sm', 'font-md', 'font-lg');
      document.documentElement.classList.add(`font-${size}`);
      document.querySelectorAll('[data-font-size]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      window.setTimeout(() => map.invalidateSize(), 150);
      announce(`字體大小已切換為${size === 'sm' ? '小' : size === 'lg' ? '大' : '標準'}`);
    });
  });

  // 高對比模式
  const hcBtn = document.getElementById('btn-high-contrast');
  hcBtn.addEventListener('click', () => {
    const isHC = document.documentElement.classList.toggle('high-contrast');
    hcBtn.setAttribute('aria-pressed', String(isHC));
    announce(isHC ? '已啟用高對比模式' : '已關閉高對比模式');
  });

  // 地圖 / 無障礙資料表切換
  document.getElementById('btn-view-mode').addEventListener('click', () => {
    toggleTableView(!state.tableMode);
  });
  document.getElementById('btn-back-map').addEventListener('click', () => {
    toggleTableView(false);
  });

  // Dialog 關閉時自動還原焦點
  document.querySelectorAll('dialog.gis-dialog').forEach((dlg) => {
    dlg.addEventListener('close', () => {
      if (state.lastFocusedElement && typeof state.lastFocusedElement.focus === 'function') {
        state.lastFocusedElement.focus();
      }
    });
  });
}

function initEventListeners() {
  initAccessibilityControls();

  // Sidebar toggle
  const sidebarToggle = document.getElementById('btn-toggle-sidebar');
  sidebarToggle.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = sidebar.classList.toggle('collapsed');
    sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
    window.setTimeout(() => map.invalidateSize(), 220);
  });

  // Accessible Tabs (含鍵盤左右方向鍵導覽)
  const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
  function activateTab(btn) {
    tabBtns.forEach((b) => {
      const selected = b === btn;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-selected', String(selected));
      b.setAttribute('tabindex', selected ? '0' : '-1');
    });
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    btn.focus();
  }

  tabBtns.forEach((btn, idx) => {
    btn.addEventListener('click', () => activateTab(btn));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        activateTab(tabBtns[(idx + 1) % tabBtns.length]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        activateTab(tabBtns[(idx - 1 + tabBtns.length) % tabBtns.length]);
      }
    });
  });

  // CRS Switcher
  document.getElementById('crs-select').addEventListener('change', (e) => {
    state.currentCrs = e.target.value;
    document.getElementById('status-crs-badge').textContent = state.currentCrs;
    renderPointList();
    renderAccessibleTable();
    addAuditLog('CRS_CHANGE', `切換座標系統至 ${state.currentCrs}`);
    announce(`座標系統已切換為 ${state.currentCrs}`);
  });

  // Filters
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    applyFilters();
  });

  document.querySelectorAll('#order-filters input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const val = Number(cb.value);
      if (cb.checked) state.selectedOrders.add(val);
      else state.selectedOrders.delete(val);
      applyFilters();
    });
  });

  document.getElementById('office-select').addEventListener('change', (e) => {
    state.selectedOffice = e.target.value;
    state.selectedTownship = 'all';
    populateTownshipSelect();
    applyFilters();
  });

  document.getElementById('township-select').addEventListener('change', (e) => {
    state.selectedTownship = e.target.value;
    const tw = TOWNSHIPS.find((t) => t.name === state.selectedTownship);
    if (tw && !state.tableMode) flyToSafe([tw.lat, tw.lon], 13);
    applyFilters();
  });

  document.getElementById('status-select').addEventListener('change', (e) => {
    state.selectedStatus = e.target.value;
    applyFilters();
  });

  document.getElementById('radius-select').addEventListener('change', (e) => {
    state.radiusMeters = Number(e.target.value);
    if (state.radiusMeters > 0 && !state.radiusCenter) {
      const c = map.getCenter();
      state.radiusCenter = { lat: c.lat, lon: c.lng };
      document.getElementById('radius-status').textContent = '已以地圖中心為圓心，點擊地圖可重設圓心';
    } else if (state.radiusMeters === 0) {
      state.radiusCenter = null;
      document.getElementById('radius-status').textContent = '點擊地圖可設定環域中心';
    }
    applyFilters();
  });

  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    state.searchQuery = '';
    state.selectedOrders = new Set([1, 2, 3, 4]);
    state.selectedOffice = 'all';
    state.selectedTownship = 'all';
    state.selectedStatus = 'all';
    state.radiusMeters = 0;
    state.radiusCenter = null;
    document.getElementById('search-input').value = '';
    document.querySelectorAll('#order-filters input').forEach((cb) => { cb.checked = true; });
    document.getElementById('office-select').value = 'all';
    populateTownshipSelect();
    document.getElementById('status-select').value = 'all';
    document.getElementById('radius-select').value = '0';
    document.getElementById('radius-status').textContent = '點擊地圖可設定環域中心';
    flyToSafe([22.48, 120.58], 10);
    applyFilters();
  });

  // Basemaps & Overlays
  document.querySelectorAll('input[name="basemap"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      map.removeLayer(currentBasemapLayer);
      currentBasemapLayer = basemaps[e.target.value].addTo(map);
      currentBasemapLayer.bringToBack();
      addAuditLog('BASEMAP_CHANGE', `切換底圖至 ${e.target.value}`);
    });
  });

  document.getElementById('overlay-emap2').addEventListener('change', (e) => {
    if (e.target.checked) overlayEmap2.addTo(map);
    else map.removeLayer(overlayEmap2);
  });

  document.getElementById('overlay-townships').addEventListener('change', (e) => {
    if (e.target.checked) townshipLayer.addTo(map);
    else map.removeLayer(townshipLayer);
  });

  document.getElementById('overlay-labels').addEventListener('change', (e) => {
    state.showLabels = e.target.checked;
    renderMapPoints();
  });

  // Map Events
  map.on('mousemove', (e) => {
    const { lat, lng } = e.latlng;
    document.getElementById('cursor-coords').textContent = formatCoordPair(lng, lat);
  });

  map.on('zoomend', () => {
    document.getElementById('zoom-level').textContent = `Z: ${map.getZoom()}`;
  });

  map.on('click', (e) => {
    if (state.measureMode) {
      handleMeasureClick(e.latlng);
      return;
    }
    if (state.radiusMeters > 0) {
      state.radiusCenter = { lat: e.latlng.lat, lon: e.latlng.lng };
      document.getElementById('radius-status').textContent = `圓心已更新 (${formatCoordPair(e.latlng.lng, e.latlng.lat)})`;
      applyFilters();
    }
  });

  // Toolbar Actions & Dialogs
  document.getElementById('btn-measure').addEventListener('click', () => {
    if (state.measureMode) stopMeasureMode();
    else startMeasureMode();
  });
  document.getElementById('btn-cancel-tool').addEventListener('click', stopMeasureMode);

  document.getElementById('btn-coord-locate').addEventListener('click', (e) => {
    updateLocatePreview();
    openDialog('dialog-locate', e.currentTarget);
  });

  document.getElementById('locate-crs').addEventListener('change', updateLocateLabels);
  document.getElementById('locate-x').addEventListener('input', updateLocatePreview);
  document.getElementById('locate-y').addEventListener('input', updateLocatePreview);

  document.getElementById('btn-do-locate').addEventListener('click', () => {
    const crs = document.getElementById('locate-crs').value;
    const x = parseFloat(document.getElementById('locate-x').value);
    const y = parseFloat(document.getElementById('locate-y').value);
    const radius = Number(document.getElementById('locate-radius').value);
    if (Number.isNaN(x) || Number.isNaN(y)) return;

    const { lon, lat } = convertToWgs84(x, y, crs);
    if (!isValidWgs84(lon, lat)) return;
    state.radiusMeters = radius;
    state.radiusCenter = radius > 0 ? { lat, lon } : null;
    document.getElementById('radius-select').value = String(radius);
    closeDialog('dialog-locate');
    if (state.tableMode) toggleTableView(false);
    flyToSafe([lat, lon], 14);
    addAuditLog('COORD_LOCATE', `定位查詢 (${crs}: ${x}, ${y})`);
    applyFilters();
  });

  document.getElementById('btn-import').addEventListener('click', (e) => {
    document.getElementById('import-status').textContent = '';
    openDialog('dialog-import', e.currentTarget);
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImportFile(file);
  });

  document.getElementById('btn-reset-demo').addEventListener('click', () => {
    state.points = [...INITIAL_CONTROL_POINTS];
    document.getElementById('data-source-badge').textContent = '示範資料＋支援官方匯入';
    document.getElementById('import-status').textContent = '已還原屏東縣全縣內建控制點資料。';
    addAuditLog('RESET_DATA', '還原內建全縣控制點參考資料');
    applyFilters();
  });

  document.getElementById('btn-export').addEventListener('click', exportFilteredCsv);
  document.getElementById('btn-sources').addEventListener('click', (e) => openDialog('dialog-sources', e.currentTarget));
  document.getElementById('btn-a11y-help').addEventListener('click', (e) => openDialog('dialog-a11y', e.currentTarget));
  document.getElementById('btn-security').addEventListener('click', (e) => {
    document.getElementById('audit-log-list').textContent = state.auditLogs.join('\n');
    openDialog('dialog-security', e.currentTarget);
  });
  document.getElementById('btn-export-audit').addEventListener('click', exportAuditLogFile);

  document.getElementById('btn-copy-coord').addEventListener('click', () => {
    if (!state.activePoint) return;
    const txt = `${state.activePoint.id} (${state.currentCrs}): ${formatCoordPair(state.activePoint.lon, state.activePoint.lat)}`;
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    const btn = document.getElementById('btn-copy-coord');
    btn.textContent = '已複製！';
    announce(`已複製 ${state.activePoint.id} 座標`);
    window.setTimeout(() => { btn.textContent = '複製目前座標'; }, 1400);
  });

  document.getElementById('btn-zoom-point').addEventListener('click', () => {
    if (!state.activePoint) return;
    if (state.tableMode) toggleTableView(false);
    flyToSafe([state.activePoint.lat, state.activePoint.lon], 17);
    closeDialog('dialog-detail');
  });

  document.querySelectorAll('[data-close-dialog]').forEach((btn) => {
    btn.addEventListener('click', () => closeDialog(btn.dataset.closeDialog));
  });
}

// 11. 啟動初始化
addAuditLog('SYSTEM_INIT', '屏東縣政府地政處控制點 GIS 系統啟動（無障礙 AA + ISO 27001 防護模式）');
populateTownshipSelect();
renderTownshipMarkers();
initEventListeners();
applyFilters();
