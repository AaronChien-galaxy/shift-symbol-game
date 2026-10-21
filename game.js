(() => {
  const $ = id => document.getElementById(id);

  // 鍵盤（美式配置）：[code, 鍵面, 上排字, 版型]
  const ROWS = [
    [['Digit1','1','!'],['Digit2','2','@'],['Digit3','3','#'],['Digit4','4','$'],['Digit5','5','%'],
     ['Digit6','6','^'],['Digit7','7','&'],['Digit8','8','*'],['Digit9','9','('],['Digit0','0',')'],
     ['Minus','-','_'],['Equal','=','+']],
    'QWERTYUIOP'.split('').map(c => ['Key'+c, c]),
    'ASDFGHJKL'.split('').map(c => ['Key'+c, c]).concat([['Semicolon',';',':']]),
    [['ShiftLeft','Shift',null,'w']].concat('ZXCVBNM'.split('').map(c => ['Key'+c, c]),
      [['Comma',',','<'],['Period','.','>'],['Slash','/','?'],['ShiftRight','Shift',null,'w']]),
    [['Space','',null,'sp']],
  ];
  const NAME = {'@':'小老鼠','!':'驚嘆號','#':'井字號','$':'錢字號','%':'百分比','&':'and 符號','*':'星號','(':'左括號',
    ')':'右括號','^':'小帽子','-':'減號（橫線）','_':'底線','?':'問號','/':'斜線',',':'逗號','.':'句點',':':'冒號',
    ';':'分號','+':'加號','=':'等號'};

  // 字元 → 要按哪顆鍵、要不要 Shift
  const MAP = {}, keyEl = {};
  const kb = $('kb');
  ROWS.forEach(r => {
    const row = document.createElement('div'); row.className = 'row';
    r.forEach(([code, base, top, cls]) => {
      const k = document.createElement('div'); k.className = 'k' + (cls ? ' ' + cls : '');
      if (top) { const s = document.createElement('small'); s.textContent = top; k.appendChild(s); }
      const sp = document.createElement('span'); sp.textContent = base; k.appendChild(sp);
      keyEl[code] = k; row.appendChild(k);
      if (code.startsWith('Key')) { MAP[base.toLowerCase()] = {code, shift:false, base}; MAP[base] = {code, shift:true, base}; }
      else if (base && !code.startsWith('Shift')) {
        MAP[base] = {code, shift:false, base};
        if (top) MAP[top] = {code, shift:true, base};
      }
    });
    kb.appendChild(row);
  });

  // 進度（localStorage 可能被擋，全部包 try）
  const KEY = 'shiftgame.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  let best = load();

  function buildMenu() {
    const g = $('grid'); g.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button'); b.className = 'lv';
      const n = best[lv.id] || 0;
      b.innerHTML = '<span class="n"></span><span class="t"></span><span class="d"></span><span class="s"></span>';
      b.children[0].textContent = '第 ' + (i + 1) + ' 關';
      b.children[1].textContent = lv.title;
      b.children[2].textContent = lv.desc;
      b.children[3].textContent = '★'.repeat(n) + '☆'.repeat(3 - n);
      b.onclick = () => start(i);
      g.appendChild(b);
    });
  }

  // 遊戲狀態
  let li = 0, words = [], qi = 0, ci = 0, mistakes = 0, totalChars = 0, locked = false, shiftHeld = false, playing = false;
  const msg = $('msg');
  const say = (t, c) => { msg.textContent = t; msg.className = 'msg ' + (c || ''); };

  function beep(f, d) {
    if (!$('snd').checked) return;
    try {
      const a = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = f; g.gain.value = .07; o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + d);
    } catch (e) {}
  }

  function start(i) {
    li = i; const lv = LEVELS[i];
    words = lv.make ? lv.make() : lv.items.slice();
    totalChars = words.reduce((s, w) => s + w.length, 0);
    qi = 0; ci = 0; mistakes = 0; locked = false; playing = true;
    $('menu').hidden = true; $('play').hidden = false; $('ov').classList.remove('show');
    $('ttl').textContent = '第 ' + (i + 1) + ' 關　' + lv.title;
    $('tip').textContent = lv.tip || '';
    say('');
    render();
  }

  function describe(ch) {
    const t = MAP[ch]; if (!t) return '';
    if (/[A-Z]/.test(ch)) return '大寫 ' + ch + '　→　Shift + ' + ch;
    if (/[a-z]/.test(ch)) return '小寫 ' + ch + '　→　直接按';
    if (/[0-9]/.test(ch)) return '數字 ' + ch + '　→　直接按';
    return (NAME[ch] || '') + ' ' + ch + '　→　' + (t.shift ? 'Shift + ' + t.base : '直接按');
  }

  function render() {
    const w = words[qi];
    const el = $('word'); el.innerHTML = '';
    el.style.fontSize = (w.length === 1 ? 150 : w.length <= 6 ? 100 : w.length <= 12 ? 72 : 52) + 'px';
    [...w].forEach((c, k) => {
      const s = document.createElement('span');
      s.className = 'ch ' + (k < ci ? 'done' : k === ci ? 'cur' : 'todo'); s.textContent = c; el.appendChild(s);
    });
    $('count').textContent = '第 ' + (qi + 1) + ' / ' + words.length + ' 題';
    $('desc').textContent = describe(w[ci]);
    paint();
  }

  function paint() {
    Object.values(keyEl).forEach(k => k.classList.remove('target', 'shiftneed'));
    const t = MAP[words[qi][ci]];
    if (t) {
      keyEl[t.code].classList.add('target');
      if (t.shift && !shiftHeld) { keyEl.ShiftLeft.classList.add('shiftneed'); keyEl.ShiftRight.classList.add('shiftneed'); }
    }
    keyEl.ShiftLeft.classList.toggle('shiftdown', shiftHeld);
    keyEl.ShiftRight.classList.toggle('shiftdown', shiftHeld);
  }

  function finishLevel() {
    playing = false;
    const lv = LEVELS[li];
    const stars = mistakes <= totalChars * .2 ? 3 : mistakes <= totalChars * .6 ? 2 : 1;
    if (stars > (best[lv.id] || 0)) { best[lv.id] = stars; save(best); }
    const last = li >= LEVELS.length - 1;
    const c = $('card'); c.innerHTML = '';
    const h = document.createElement('h2'); h.textContent = '這一關過了！';
    const s = document.createElement('div'); s.className = 'st'; s.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const p = document.createElement('p'); p.textContent = '按錯 ' + mistakes + ' 次';
    const bt = document.createElement('div'); bt.className = 'btns';
    const mk = (t, cls, fn) => { const b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.onclick = fn; bt.appendChild(b); return b; };
    mk('回選單', 'alt', toMenu);
    mk('再玩一次', 'alt', () => start(li));
    if (!last) mk('下一關', '', () => start(li + 1));
    c.append(h, s, p, bt);
    $('ov').classList.add('show');
    bt.lastChild.focus();
  }

  function toMenu() { playing = false; $('ov').classList.remove('show'); $('play').hidden = true; $('menu').hidden = false; buildMenu(); }

  window.addEventListener('keydown', e => {
    if (e.getModifierState) $('caps').hidden = !(playing && e.getModifierState('CapsLock'));
    if (e.ctrlKey || e.altKey || e.metaKey || /^F\d+$/.test(e.code)) return;
    if (!playing) {
      if ($('ov').classList.contains('show') && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault(); document.querySelector('#card .btns button:last-child').click();
      }
      return;
    }
    e.preventDefault();
    if (e.code === 'Escape') { toMenu(); return; }
    const el = keyEl[e.code]; if (el) el.classList.add('down');
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { shiftHeld = true; paint(); return; }
    if (e.repeat || locked) return;
    if (e.code === 'Enter' || e.code === 'Backspace' || e.code === 'Tab' || e.code === 'Space') return;
    const t = MAP[words[qi][ci]];
    if (e.code === t.code) {
      if (!!e.shiftKey === t.shift) {
        say(''); ci++; beep(660, .08);
        if (ci >= words[qi].length) {
          locked = true; say('答對了！', 'good'); beep(880, .15);
          $('word').querySelectorAll('.ch').forEach(s => { s.className = 'ch done'; });
          setTimeout(() => { qi++; ci = 0; locked = false; if (qi >= words.length) finishLevel(); else { say(''); render(); } }, 700);
        } else render();
      } else {
        mistakes++; beep(220, .2);
        say(t.shift ? '要先按住 Shift 不放，再按這顆喔' : '這個字不用 Shift，直接按就好', 'hint');
      }
    } else { mistakes++; beep(220, .2); say('再找找看，黃色的那一顆', 'hint'); }
  });
  window.addEventListener('keyup', e => {
    const el = keyEl[e.code]; if (el) el.classList.remove('down');
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { shiftHeld = e.shiftKey; if (playing) paint(); }
  });
  window.addEventListener('blur', () => {
    shiftHeld = false; Object.values(keyEl).forEach(k => k.classList.remove('down')); if (playing) paint();
  });

  $('back').onclick = toMenu;
  $('showhint').onchange = e => $('play').classList.toggle('nohint', !e.target.checked);
  buildMenu();
})();
