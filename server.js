const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MOCK = String(process.env.MOCK || 'false').toLowerCase() === 'true';
const OFFLINE_MS = 10000;

const state = {
  mode: 'auto',        // auto | manual
  manualPump: 'off',   // on | off
  threshold: 1500,
  last: null,          // آخر قراءة
  lastEspAt: 0,        // آخر مرة جت فيها قراءة حقيقية من ESP32
  history: []
};

function pushReading(r, mock) {
  const rec = { ...r, ts: Date.now(), mock: !!mock };
  state.last = rec;
  state.history.push(rec);
  if (state.history.length > 50) state.history.shift();
  return rec;
}

function pumpState() {
  if (state.mode === 'manual') return state.manualPump;
  if (!state.last) return 'off';
  // أوتوماتيك: لو القراءات قديمة (والـ ESP مش متصل) الطلمبة تقفل
  if (!state.last.mock && Date.now() - state.last.ts > OFFLINE_MS) return 'off';
  return state.last.soil < state.threshold ? 'on' : 'off';
}

// ---------- API ----------
app.post('/api/data', (req, res) => {
  const b = req.body || {};
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const prev = state.last || {};
  const r = {
    ldr: num(b.ldr), soil: num(b.soil), tds: num(b.tds),
    temp: num(b.temp) ?? prev.temp ?? 0,
    hum: num(b.hum) ?? prev.hum ?? 0
  };
  if (r.ldr === null || r.soil === null || r.tds === null)
    return res.status(400).json({ error: 'ldr, soil, tds مطلوبين وأرقام' });
  state.lastEspAt = Date.now();
  pushReading(r, false);
  res.json({ ok: true, pump: pumpState() });
});

app.get('/api/data', (req, res) => {
  res.json({
    ...(state.last || {}),
    empty: !state.last,
    mode: state.mode,
    threshold: state.threshold,
    pump: pumpState(),
    serverTime: Date.now()
  });
});

app.get('/api/history', (req, res) => res.json(state.history));

app.post('/api/pump', (req, res) => {
  const s = req.body && req.body.state;
  if (s !== 'on' && s !== 'off') return res.status(400).json({ error: 'state must be on or off' });
  state.manualPump = s;
  res.json({ ok: true, pump: pumpState(), mode: state.mode });
});

app.get('/api/pump', (req, res) => res.json({ pump: pumpState() }));

app.post('/api/mode', (req, res) => {
  const m = req.body && req.body.mode;
  if (m !== 'auto' && m !== 'manual') return res.status(400).json({ error: 'mode must be auto or manual' });
  state.mode = m;
  res.json({ ok: true, mode: state.mode, pump: pumpState() });
});

app.post('/api/threshold', (req, res) => {
  const v = Number(req.body && req.body.value);
  if (!isFinite(v) || v < 0 || v > 4095) return res.status(400).json({ error: 'value لازم يكون بين 0 و 4095' });
  state.threshold = Math.round(v);
  res.json({ ok: true, threshold: state.threshold, pump: pumpState() });
});

// ---------- Mock ----------
let m = { ldr: 2100, soil: 1800, tds: 800, temp: 27, hum: 60 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const jitter = (s) => (Math.random() - 0.5) * s;

if (MOCK) {
  console.log('Mock mode مفعّل: هتتولد قراءات تجريبية لو مفيش بيانات من ESP32 أكتر من 10 ثواني');
  setInterval(() => {
    if (Date.now() - state.lastEspAt <= OFFLINE_MS) return;
    m.ldr = clamp(m.ldr + jitter(200), 0, 4095);
    m.tds = clamp(m.tds + jitter(60), 0, 4095);
    m.temp = clamp(m.temp + jitter(0.6), 15, 45);
    m.hum = clamp(m.hum + jitter(2), 20, 95);
    m.soil = clamp(m.soil + (pumpState() === 'on' ? 90 : -25) + jitter(40), 0, 4095);
    pushReading({
      ldr: Math.round(m.ldr), soil: Math.round(m.soil), tds: Math.round(m.tds),
      temp: +m.temp.toFixed(1), hum: Math.round(m.hum)
    }, true);
  }, 2000);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
