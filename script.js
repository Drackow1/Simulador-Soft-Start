const legendBtn = document.getElementById('legendBtn');
const legendBox = document.getElementById('legendBox');

legendBtn.onclick = () => {
  legendBox.classList.toggle('open');
};

legendBtn.onmouseenter = () => {
  legendBox.classList.add('open');
};

legendBtn.onmouseleave = () => {
  setTimeout(()=>legendBox.classList.remove('open'),300);
};

legendBox.onmouseenter = () => {
  legendBox.classList.add('open');
};

legendBox.onmouseleave = () => {
  legendBox.classList.remove('open');
};

/* ====== SIMULADOR ====== */

let freq = 0;
let amp = 0;
let running = false;
let trip = false;
let faultPending = false;

let spin;
let angle = 0;
let faultTimer = null;

let pumpState = 'DESLIGADO';

const statusEl = document.getElementById('statusEl');
const freqEl = document.getElementById('freqEl');
const ampEl = document.getElementById('ampEl');
const errCode = document.getElementById('errCode');
const ledFault = document.getElementById('ledFault');
const lever = document.getElementById('lever');
const spark = document.getElementById('spark');
const imp1 = document.getElementById('imp1');
const imp2 = document.getElementById('imp2');

const faults = new Set();

const energyMap = {
  R:['rInE','rOutE','ledR'],
  S:['sInE','sOutE','ledS'],
  T:['tInE','tOutE','ledT']
};

function updateStatus() {
  statusEl.textContent = pumpState;
}

/* ================= DISJUNTOR ================= */

function breaker(on) {
  lever.setAttribute('y', on ? 170 : 210);
}

/* ================= ENERGIA ================= */

function energize(on) {
  Object.values(energyMap).flat().forEach(id => {
    const el = document.getElementById(id);
    if (el && el.tagName === 'line') {
      el.style.display = on ? 'block' : 'none';
    }
  });
}

/* ================= BOMBA ================= */

function spinPump() {
  clearInterval(spin);
  spin = setInterval(() => {
    if (!running) return;

    const speed = Math.max(4, freq * 0.6);
    angle += speed;

    imp1.setAttribute('transform', `rotate(${angle} 660 200)`);
    imp2.setAttribute('transform', `rotate(${angle} 660 200)`);
  }, 30);
}

/* ================= PARADA SUAVE ================= */

function slowStop(time = 2500, finalState = 'DESLIGADO') {
  const steps = 30;
  const stepFreq = freq / steps;
  const stepAmp = amp / steps;
  const stepTime = time / steps;

  const decel = setInterval(() => {
    freq = Math.max(0, freq - stepFreq);
    amp = Math.max(0, amp - stepAmp);

    freqEl.innerText = freq.toFixed(0);
    ampEl.innerText = amp.toFixed(1);

    if (freq <= 0) {
      clearInterval(decel);
      running = false;
      energize(false);
      breaker(false);

      pumpState = finalState;
      updateStatus();
    }
  }, stepTime);
}

/* ================= FAÍSCA ================= */

function sparkEffect(duration = 800) {
  spark.style.display = 'block';
  setTimeout(() => spark.style.display = 'none', duration);
}

/* ================= START ================= */

function start() {
  if (running || trip) return;

  running = true;
  pumpState = 'RAMP UP';
  updateStatus();

  breaker(true);
  energize(true);
  spinPump();

  const up = setInterval(() => {
    if (!running || trip) {
      clearInterval(up);
      return;
    }

    if (freq < 60) {
      freq += 2;
      amp = freq * 0.35;
    } else {
      pumpState = 'EM REGIME';
      updateStatus();
      clearInterval(up);
    }

    freqEl.innerText = freq.toFixed(0);
    ampEl.innerText = amp.toFixed(1);
  }, 150);
}

/* ================= STOP (AGORA SUAVE) ================= */

function stop() {
  if (!running || trip) return;

  pumpState = 'DESACELERANDO';
  updateStatus();

  slowStop(2500, 'DESLIGADO');
}

/* ================= RESET (AGORA SUAVE) ================= */

function resetAll() {
  clearTimeout(faultTimer);

  if (running) {
    pumpState = 'DESACELERANDO';
    updateStatus();

    slowStop(2000, 'DESLIGADO');

    setTimeout(clearResetState, 2100);
  } else {
    clearResetState();
  }
}

function clearResetState() {
  faults.clear();
  trip = false;
  faultPending = false;

  freq = 0;
  amp = 0;
  angle = 0;

  ['ledR', 'ledS', 'ledT'].forEach(id => {
    document.getElementById(id).style.display = 'block';
  });

  errCode.textContent = '---';
  ledFault.setAttribute('fill', '#3f3f46');

  pumpState = 'DESLIGADO';
  updateStatus();

  freqEl.innerText = 0;
  ampEl.innerText = 0;
}

/* ================= ERRO ================= */

function calcError() {
  const f = [...faults].sort().join('+');

  const map = {
    'OC': 'E101',
    'UV': 'E102',
    'OV': 'E103',

    'FR': 'E201',
    'FS': 'E202',
    'FT': 'E203',

    'FR+FS': 'E204',
    'FR+FT': 'E205',
    'FS+FT': 'E206',
    'FR+FS+FT': 'E207',

    // combinações ORDENADAS corretamente
    'FR+OC': 'E301',
    'FS+OC': 'E302',
    'FT+OC': 'E303'
  };

  return map[f] || 'E999';
}


/* ================= APLICA FALHA ================= */

function applyFaultBehavior() {
  trip = true;
  ledFault.setAttribute('fill', '#dc2626');
  errCode.textContent = calcError();

  if (faults.has('OC')) {
    amp += 15;
    sparkEffect();
    slowStop(1800, 'PARADO POR FALHA');
    return;
  }

  if (faults.has('UV')) {
    slowStop(3200, 'PARADO POR FALHA');
    return;
  }

  if (faults.has('OV')) {
    sparkEffect();
    slowStop(1400, 'PARADO POR FALHA');
    return;
  }

  let phaseFault = false;

if (faults.has('FR')) {
  energyMap.R.forEach(id => document.getElementById(id).style.display = 'none');
  phaseFault = true;
}

if (faults.has('FS')) {
  energyMap.S.forEach(id => document.getElementById(id).style.display = 'none');
  phaseFault = true;
}

if (faults.has('FT')) {
  energyMap.T.forEach(id => document.getElementById(id).style.display = 'none');
  phaseFault = true;
}

if (phaseFault) {
  slowStop(2200);
  return;
}


  if (faults.has('FS')) {
    energyMap.S.forEach(id => document.getElementById(id).style.display = 'none');
    slowStop(2200, 'PARADO POR FALHA');
    return;
  }

  if (faults.has('FT')) {
    energyMap.T.forEach(id => document.getElementById(id).style.display = 'none');
    slowStop(2200, 'PARADO POR FALHA');
    return;
  }

  slowStop(2000, 'PARADO POR FALHA');
}

/* ================= SET FAULT ================= */

function setFault(f) {
  faults.add(f);

  if (faultPending) return;

  faultPending = true;
  pumpState = 'ANALISANDO FALHA...';
  updateStatus();

  faultTimer = setTimeout(() => {
    applyFaultBehavior();
  }, 2000);
}
