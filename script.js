/* ====== LEGENDA ====== */

const legendBtn = document.getElementById('legendBtn');
const legendBox = document.getElementById('legendBox');

legendBtn.onclick = () => legendBox.classList.toggle('open');
legendBtn.onmouseenter = () => legendBox.classList.add('open');
legendBtn.onmouseleave = () => setTimeout(()=>legendBox.classList.remove('open'),300);
legendBox.onmouseenter = () => legendBox.classList.add('open');
legendBox.onmouseleave = () => legendBox.classList.remove('open');

/* ====== VARIÁVEIS GERAIS ====== */

let freq = 0;
let amp  = 0;
let angle = 0;

let running = false;
let trip = false;

let rampUpInterval = null;
let decelInterval  = null;
let spinInterval   = null;

let pumpState = 'DESLIGADO';

/* ====== FALHAS ====== */

const faults = new Set();
let faultConfirmed = false;

/* ====== ELEMENTOS ====== */

const statusEl = document.getElementById('statusEl');
const freqEl   = document.getElementById('freqEl');
const ampEl    = document.getElementById('ampEl');
const errCode  = document.getElementById('errCode');

const lever    = document.getElementById('lever');
const blackout = document.getElementById('blackout');

const imp1 = document.getElementById('imp1');
const imp2 = document.getElementById('imp2');

const faultView = document.getElementById('faultView');

/* ====== UTIL ====== */

function updateStatus(){
  statusEl.textContent = pumpState;
}

function breaker(on){
  lever.setAttribute('y', on ? 170 : 210);
}

function energizeInput(on){
  ['rInE','sInE','tInE'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = on ? 'block' : 'none';
  });
}

function energizeOutput(on){
  ['rOutE','sOutE','tOutE'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = on ? 'block' : 'none';
  });
}

/* ====== MATA QUALQUER MOVIMENTO ====== */

function killMotion(){
  clearInterval(rampUpInterval);
  clearInterval(decelInterval);
  rampUpInterval = null;
  decelInterval  = null;
}

/* ====== MOTOR ====== */

function spinPump(){
  clearInterval(spinInterval);
  spinInterval = setInterval(()=>{
    if(freq <= 0) return;
    angle += Math.max(2, freq * 0.35);
    imp1.setAttribute('transform',`rotate(${angle} 660 200)`);
    imp2.setAttribute('transform',`rotate(${angle} 660 200)`);
  },30);
}

/* ====== EFEITOS ====== */

function sparkEffect(x=440,y=200){
  const svg = document.querySelector('.sim-core');

  for(let i=0;i<12;i++){
    const s = document.createElementNS("http://www.w3.org/2000/svg","line");
    const a = Math.random()*Math.PI*2;
    const l = 10 + Math.random()*14;

    s.setAttribute('x1',x);
    s.setAttribute('y1',y);
    s.setAttribute('x2',x+Math.cos(a)*l);
    s.setAttribute('y2',y+Math.sin(a)*l);

    /* >>> VISUAL CONTROLADO PELO CSS <<< */
    s.classList.add('spark-line');

    svg.appendChild(s);

    setTimeout(()=>s.remove(),180);
  }
}


function smokeEffect(x=440,y=170){
  const svg = document.querySelector('.sim-core');

  for(let i=0;i<4;i++){
    const c = document.createElementNS("http://www.w3.org/2000/svg","circle");

    c.setAttribute('cx',x + Math.random()*14 - 7);
    c.setAttribute('cy',y);
    c.setAttribute('r',10 + Math.random()*8);

    /* >>> VISUAL + ANIMAÇÃO VIA CSS <<< */
    c.classList.add('smoke-puff');

    svg.appendChild(c);

    /* tempo de vida da fumaça */
    setTimeout(()=>c.remove(),3500);
  }
}


function blackoutEffect(){
  blackout.style.opacity = 0.7;
  setTimeout(()=>blackout.style.opacity=0,200);
}

/* ====== RAMPA ====== */

function rampUp(){
  clearInterval(rampUpInterval);
  rampUpInterval=setInterval(()=>{
    if(freq<60){
      freq+=2;
      amp = freq*0.35;
    }else{
      clearInterval(rampUpInterval);
      pumpState='EM REGIME';
      updateStatus();
    }
    freqEl.textContent=freq.toFixed(0);
    ampEl.textContent =amp.toFixed(1);
  },150);
}

function slowStop(time=2000,final='DESLIGADO'){
  clearInterval(decelInterval);

  const steps=30;
  const df=freq/steps;
  const da=amp/steps;

  decelInterval=setInterval(()=>{
    freq=Math.max(0,freq-df);
    amp =Math.max(0,amp -da);

    freqEl.textContent=freq.toFixed(0);
    ampEl.textContent =amp.toFixed(1);

    if(freq<=0){
      clearInterval(decelInterval);
      energizeOutput(false);
      pumpState=final;
      updateStatus();
    }
  },time/steps);
}

/* ====== CONTROLES ====== */

function start(){
  if(running || trip) return;

  running=true;
  pumpState='RAMP UP';
  updateStatus();

  breaker(true);
  energizeInput(true);
  energizeOutput(true);

  spinPump();
  rampUp();
}

function stop(){
  if(!running) return;

  killMotion();
  pumpState='DESACELERANDO';
  updateStatus();

  slowStop(2500,'DESLIGADO');
  running=false;
}

function resetAll(){
  killMotion();
  clearInterval(spinInterval);

  freq=0; amp=0; angle=0;
  freqEl.textContent=0;
  ampEl.textContent =0;

  energizeInput(true);
  energizeOutput(false);
  breaker(true);
  ['ledR','ledS','ledT'].forEach(id=>{
  document.getElementById(id).style.display = 'block';
});


  faults.clear();
  faultConfirmed=false;
  faultView.textContent='Nenhuma';

  errCode.textContent='---';
  trip=false;
  running=false;

  pumpState='DESLIGADO';
  updateStatus();
}

/* ====== FALHAS (SELEÇÃO) ====== */

function setFault(f){
  if(faultConfirmed) return;
  faults.has(f)?faults.delete(f):faults.add(f);
  faultView.textContent = faults.size?[...faults].join(' + '):'Nenhuma';
}

/* ====== CÓDIGO DE ERRO ====== */

function calcError(){
  const f=[...faults].sort().join('+');
  const map={
    'OC':'E101','UV':'E102','OV':'E103',
    'FR':'E201','FS':'E202','FT':'E203',
    'FR+FS':'E204','FR+FT':'E205','FS+FT':'E206',
    'FR+FS+FT':'E207',
    'OC+FR':'E301','OC+FS':'E302','OC+FT':'E303'
  };
  return map[f]||'E999';
}

/* ====== CONFIRMA FALHA ====== */

function confirmFault(){
  if(!faults.size||faultConfirmed) return;

  faultConfirmed=true;
  trip=true;
  killMotion();

  errCode.textContent=calcError();

  /* SUBTENSÃO */
  if(faults.has('UV')){
    freq*=0.5;
    amp *=0.6;
    freqEl.textContent=freq.toFixed(0);
    ampEl.textContent =amp.toFixed(1);
    pumpState='FALHA';
    updateStatus();
    return;
  }

  blackoutEffect();
  setTimeout(()=>sparkEffect(),250);
  setTimeout(()=>smokeEffect(),600);

  /* ===== FALTA DE FASE ===== */
if(faults.has('FR')){
  document.getElementById('rInE').style.display = 'none';
  document.getElementById('rOutE').style.display = 'none';
  document.getElementById('ledR').style.display = 'none';
}

if(faults.has('FS')){
  document.getElementById('sInE').style.display = 'none';
  document.getElementById('sOutE').style.display = 'none';
  document.getElementById('ledS').style.display = 'none';
}

if(faults.has('FT')){
  document.getElementById('tInE').style.display = 'none';
  document.getElementById('tOutE').style.display = 'none';
  document.getElementById('ledT').style.display = 'none';
}


  /* DISJUNTOR */
  if(faults.has('OC')||faults.has('OV')||calcError()==='E999'){
    breaker(false);
    energizeInput(false);
    energizeOutput(false);
  }

  if(calcError()==='E999'){
    amp=0;
    ampEl.textContent='0.0';
    pumpState='FALHA';
    updateStatus();
    slowStop(1200,'PARADO POR FALHA');
    return;
  }

  pumpState='FALHA';
  updateStatus();
  slowStop(1800,'PARADO POR FALHA');
}
