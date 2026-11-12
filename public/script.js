const $ = (id) => document.getElementById(id);
const API = ''; // نفس الدومين. لو الواجهة مستضافة بعيد حط رابط السيرفر هنا
const OFFLINE_MS = 10000;
let busy = false;

async function api(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

// ---------- الرسم البياني ----------
const chart = new Chart($('chart'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      { label: 'التربة', data: [], borderColor: '#c08457', yAxisID: 'y' },
      { label: 'الإضاءة', data: [], borderColor: '#facc15', yAxisID: 'y' },
      { label: 'TDS', data: [], borderColor: '#a78bfa', yAxisID: 'y' },
      { label: 'الحرارة °C', data: [], borderColor: '#fb923c', yAxisID: 'y1' },
      { label: 'رطوبة الجو %', data: [], borderColor: '#38bdf8', yAxisID: 'y1' }
    ].map(d => ({ ...d, borderWidth: 2, pointRadius: 0, tension: 0.3 }))
  },
  options: {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { color: '#e6f1f0', font: { family: 'Tajawal' } } } },
    scales: {
      x: { ticks: { color: '#8aa5a6', maxTicksLimit: 6 }, grid: { color: '#22363c' } },
      y: { min: 0, max: 4095, position: 'left', ticks: { color: '#8aa5a6' }, grid: { color: '#22363c' } },
      y1: { min: 0, max: 100, position: 'right', ticks: { color: '#8aa5a6' }, grid: { drawOnChartArea: false } }
    }
  }
});

function updateChart(h) {
  chart.data.labels = h.map(r => new Date(r.ts).toLocaleTimeString('ar-EG', { hour12: false }));
  ['soil', 'ldr', 'tds', 'temp', 'hum'].forEach((k, i) => chart.data.datasets[i].data = h.map(r => r[k]));
  chart.update();
}

// ---------- الواجهة ----------
function setBar(id, v, max) { $('b-' + id).style.width = Math.max(0, Math.min(100, (v / max) * 100)) + '%'; }

function render(d) {
  if (!d.empty) {
    $('v-soil').textContent = d.soil; setBar('soil', d.soil, 4095);
    $('v-ldr').textContent = d.ldr;   setBar('ldr', d.ldr, 4095);
    $('v-tds').textContent = d.tds;   setBar('tds', d.tds, 4095);
    $('v-temp').textContent = d.temp; setBar('temp', d.temp, 50);
    $('v-hum').textContent = d.hum;   setBar('hum', d.hum, 100);
  }
  // متصل / غير متصل (بتوقيت السيرفر)
  const online = !d.empty && (d.serverTime - d.ts) <= OFFLINE_MS;
  $('conn').className = 'conn ' + (online ? 'on' : 'off');
  $('connText').textContent = online ? (d.mock ? 'متصل (بيانات تجريبية)' : 'متصل') : 'غير متصل';

  const on = d.pump === 'on';
  $('pumpBox').className = 'pump ' + (on ? 'on' : 'off');
  $('pumpText').textContent = on ? 'شغالة' : 'واقفة';

  const manual = d.mode === 'manual';
  $('btnAuto').classList.toggle('active', !manual);
  $('btnManual').classList.toggle('active', manual);
  $('manualBtns').classList.toggle('hidden', !manual);
  if (document.activeElement !== $('thr')) $('thr').value = d.threshold;
}

async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const [d, h] = await Promise.all([api('/api/data'), api('/api/history')]);
    render(d); updateChart(h);
  } catch (e) {
    $('conn').className = 'conn off';
    $('connText').textContent = 'غير متصل';
  } finally { busy = false; }
}

async function act(fn) { try { await fn(); } catch (e) { alert('حصل خطأ في الاتصال بالسيرفر'); } refresh(); }

$('btnAuto').onclick = () => act(() => api('/api/mode', 'POST', { mode: 'auto' }));
$('btnManual').onclick = () => act(() => api('/api/mode', 'POST', { mode: 'manual' }));
$('btnOn').onclick = () => act(() => api('/api/pump', 'POST', { state: 'on' }));
$('btnOff').onclick = () => act(() => api('/api/pump', 'POST', { state: 'off' }));
$('btnThr').onclick = () => act(() => api('/api/threshold', 'POST', { value: Number($('thr').value) }));

refresh();
setInterval(refresh, 2000);
