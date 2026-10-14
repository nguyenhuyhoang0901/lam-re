/* js/sound.js — Âm thanh tổng hợp bằng WebAudio (không cần file âm thanh). Thêm hiệu ứng mới vào object `sfx`. */
(function(){
'use strict';
const LR = window.LR;
const Sound = (function(){
  let actx = null, master = null, noiseBuf = null, buzz = null, muted = false;
  function init(){
    try{
      if(!actx){
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return;
        actx = new AC();
        master = actx.createGain(); master.gain.value = muted ? 0 : .8; master.connect(actx.destination);
        noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i] = Math.random()*2 - 1;
        startBuzz();
      }
      if(actx.state === 'suspended') actx.resume();
    }catch(e){}
  }
  function tone(type, f0, f1, dur, vol, delay){
    if(!actx || muted) return;
    try{
      const t = actx.currentTime + (delay||0);
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t+dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t+.01); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t+dur+.03);
    }catch(e){}
  }
  function noise(dur, vol, ftype, f0, f1, delay, q){
    if(!actx || muted || !noiseBuf) return;
    try{
      const t = actx.currentTime + (delay||0);
      const s = actx.createBufferSource(); s.buffer = noiseBuf;
      const f = actx.createBiquadFilter(); f.type = ftype; f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20,f1), t+dur);
      const g = actx.createGain();
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t+.012); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()*.5); s.stop(t+dur+.05);
    }catch(e){}
  }
  function startBuzz(){
    const o1 = actx.createOscillator(), o2 = actx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth'; o1.frequency.value = 118; o2.frequency.value = 125;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    const am = actx.createGain(); am.gain.value = .55;
    const lfo = actx.createOscillator(); lfo.frequency.value = 27;
    const ld = actx.createGain(); ld.gain.value = .45;
    lfo.connect(ld); ld.connect(am.gain);
    const out = actx.createGain(); out.gain.value = 0;
    o1.connect(lp); o2.connect(lp); lp.connect(am); am.connect(out); out.connect(master);
    o1.start(); o2.start(); lfo.start();
    buzz = {o1, o2, out};
  }
  function buzzSet(n, fast, on){
    if(!actx || !buzz) return;
    const t = actx.currentTime;
    buzz.out.gain.setTargetAtTime(on ? Math.min(.05, n*.01) : 0, t, .15);
    buzz.o1.frequency.setTargetAtTime(115 + n*5 + fast*25, t, .2);
    buzz.o2.frequency.setTargetAtTime(122 + n*5 + fast*28, t, .2);
  }
  // Tiếng ồn có lọc với tuỳ chọn đầy đủ (atk = thời gian lên âm, delay...): nền tảng của tiếng bếp, dao thớt, lửa…
  function burst(o){
    if(!actx || muted || !noiseBuf) return;
    try{
      const t = actx.currentTime + (o.delay || 0), s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      s.buffer = noiseBuf; s.loop = true;
      f.type = o.type; f.frequency.setValueAtTime(o.f0, t);
      if(o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
      f.Q.value = o.q || 1;
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(o.g, t + (o.atk || .004)); g.gain.exponentialRampToValueAtTime(.0001, t + o.dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()*.5); s.stop(t + o.dur + .05);
    }catch(e){}
  }
  // Một nốt: {type, f, f1, dur, g, delay}
  function note(o){
    if(!actx || muted) return;
    try{
      const t = actx.currentTime + (o.delay || 0), os = actx.createOscillator(), g = actx.createGain();
      os.type = o.type || 'sine'; os.frequency.setValueAtTime(o.f, t);
      if(o.f1) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(o.g, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + o.dur);
      os.connect(g); g.connect(master); os.start(t); os.stop(t + o.dur + .03);
    }catch(e){}
  }
  // Cho ải tự dựng âm thanh liên tục (vd. tiếng lửa): trả về {ctx, out, nb} sau khi Sound.init() đã chạy, ngược lại null.
  // `out` là cổng master nên nút tắt tiếng vẫn có tác dụng.
  function audio(){ return (actx && master && noiseBuf) ? {ctx: actx, out: master, nb: noiseBuf} : null; }
  function setMuted(m){
    muted = !!m;
    if(master) master.gain.setTargetAtTime(muted ? 0 : .8, actx.currentTime, .05);
    document.querySelectorAll('.soundBtn').forEach(b=> b.textContent = 'Âm thanh: ' + (muted ? 'Tắt' : 'Bật'));
  }
  const sfx = {
    click(){ tone('square', 700, 520, .04, .05); },
    swing(){ noise(.14, .22, 'bandpass', 2400, 500, 0, .8); },
    tick(){ tone('square', 900, 700, .03, .06); },
    splat(){ noise(.1, .5, 'lowpass', 2600, 300); tone('sine', 200, 50, .13, .6); },
    hurtBig(){ tone('square', 420, 180, .1, .16); noise(.12, .5, 'lowpass', 3200, 500); tone('sine', 150, 45, .2, .7); },
    killBig(){ noise(.16, .6, 'lowpass', 2800, 250); tone('sine', 170, 40, .22, .8); tone('triangle', 300, 120, .15, .2, .03); },
    miss(){ tone('triangle', 200, 120, .16, .22); },
    bad(){ tone('sawtooth', 170, 70, .35, .26); tone('square', 120, 60, .3, .14); },
    bite(){ noise(.06, .4, 'bandpass', 1800, 900, 0, 2); noise(.06, .4, 'bandpass', 1800, 900, .09, 2); tone('sine', 300, 140, .3, .22, .16); },
    combo(m){ tone('triangle', 440*(1+.14*m), 700*(1+.14*m), .13, .18); },
    zip(){ tone('sine', 1400, 2600, .07, .05); },
    dive(){ noise(.2, .3, 'bandpass', 600, 1800, 0, .7); },
    thud(){ noise(.14, .5, 'lowpass', 900, 150); tone('sine', 120, 45, .22, .7); },
    cluck(){ tone('triangle', 700, 440, .08, .14); tone('triangle', 640, 400, .09, .12, .1); },
    catchOk(){ noise(.08, .3, 'lowpass', 2000, 400); [523,659,784].forEach((f,i)=> tone('triangle', f, f, .14, .2, .05+i*.08)); },
    win(){ [523,659,784,1047].forEach((f,i)=> tone('triangle', f, f, .22, .22, i*.11)); },
    lose(){ [330,262,208,165].forEach((f,i)=> tone('sawtooth', f, f*.97, .26, .12, i*.15)); }
  };
  return {init, setMuted, isMuted:()=>muted, sfx, buzzSet, tone, noise, burst, note, audio};
})();
LR.Sound = Sound;
})();
