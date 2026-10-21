(() => {
  const $ = id => document.getElementById(id);

  // 鍵盤（美式配置）：[code, 鍵面, 上排字, 版型]
  const ROWS = [
    [['Digit1','1','!'],['Digit2','2','@'],['Digit3','3','#'],['Digit4','4','$'],['Digit5','5','%'],
     ['Digit6','6','^'],['Digit7','7','&'],['Digit8','8','*'],['Digit9','9','('],['Digit0','0',')'],
     ['Minus','-','_'],['Equal','=','+']],
    'QWERTYUIOP'.split('').map(c => ['Key'+c, c]),
    [['CapsLock','Caps Lock',null,'w']].concat('ASDFGHJKL'.split('').map(c => ['Key'+c, c]),
      [['Semicolon',';',':'],['Enter','Enter',null,'w']]),
    [['ShiftLeft','Shift',null,'w']].concat('ZXCVBNM'.split('').map(c => ['Key'+c, c]),
      [['Comma',',','<'],['Period','.','>'],['Slash','/','?'],['ShiftRight','Shift',null,'w']]),
    [['Space','',null,'sp']],
  ];
  const NAME = {'@':'小老鼠','!':'驚嘆號','#':'井字號','$':'錢字號','%':'百分比','&':'and 符號','*':'星號','(':'左括號',
    ')':'右括號','^':'小帽子','-':'減號（橫線）','_':'底線','?':'問號','/':'斜線',',':'逗號','.':'句點',':':'冒號',
    ';':'分號','+':'加號','=':'等號'};

  // 字元 → 要按哪顆鍵、要不要 Shift。⇪ 是 Caps Lock、↵ 是 Enter（free：不看 Shift）
  const MAP = {}, keyEl = {};
  const LABEL = {'⇪':'Caps Lock', '↵':'↵'};
  const kb = $('kb');
  ROWS.forEach(r => {
    const row = document.createElement('div'); row.className = 'row';
    r.forEach(([code, base, top, cls]) => {
      const k = document.createElement('div'); k.className = 'k' + (cls ? ' ' + cls : '');
      if (top) { const s = document.createElement('small'); s.textContent = top; k.appendChild(s); }
      const sp = document.createElement('span'); sp.textContent = base; k.appendChild(sp);
      keyEl[code] = k; row.appendChild(k);
      if (code.startsWith('Key')) { MAP[base.toLowerCase()] = {code, shift:false, base}; MAP[base] = {code, shift:true, base}; }
      else if (base && !/^(Shift|CapsLock|Enter)/.test(code)) {
        MAP[base] = {code, shift:false, base};
        if (top) MAP[top] = {code, shift:true, base};
      }
    });
    kb.appendChild(row);
  });
  MAP['⇪'] = {code:'CapsLock', free:true, base:'Caps Lock'};
  MAP['↵'] = {code:'Enter', free:true, base:'Enter'};

  // 進度（localStorage 可能被擋，全部包 try）
  const KEY = 'shiftgame.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  let best = load();
  const setKey = (lv, s) => lv.id + '#' + s;

  function buildMenu() {
    const g = $('grid'); g.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const card = document.createElement('div'); card.className = 'lv';
      const mkSpan = (cls, t) => { const s = document.createElement('span'); s.className = cls; s.textContent = t; card.appendChild(s); };
      mkSpan('n', '第 ' + (i + 1) + ' 關');
      mkSpan('t', lv.title);
      mkSpan('d', lv.desc);
      const row = document.createElement('div'); row.className = 'sets';
      const count = lv.sets ? lv.sets.length : 1;
      for (let s = 0; s < count; s++) {
        const n = best[setKey(lv, s)] || 0;
        const b = document.createElement('button');
        b.textContent = (lv.sets ? '第 ' + (s + 1) + ' 組' : '開始') + '　' + '★'.repeat(n) + '☆'.repeat(3 - n);
        b.onclick = () => start(i, s);
        row.appendChild(b);
      }
      card.appendChild(row);
      g.appendChild(card);
    });
  }

  // 遊戲狀態：units[題][字]，'[Caps]' 這種題目只有一個單位 ⇪
  let li = 0, si = 0, words = [], units = [], qi = 0, ci = 0, mistakes = 0, totalChars = 0;
  let locked = false, shiftHeld = false, capsOn = false, playing = false;
  const msg = $('msg');
  const say = (t, c) => { msg.textContent = t; msg.className = 'msg ' + (c || ''); };
  const toUnits = w => w === '[Caps]' ? ['⇪'] : [...w];

  function beep(f, d) {
    if (!$('snd').checked) return;
    try {
      const a = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = f; g.gain.value = .07; o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + d);
    } catch (e) {}
  }

  function start(i, s = 0) {
    li = i; si = s; const lv = LEVELS[i];
    words = lv.make ? lv.make() : lv.sets[s].slice();
    units = words.map(toUnits);
    totalChars = units.reduce((n, u) => n + u.length, 0);
    qi = 0; ci = 0; mistakes = 0; locked = false; playing = true;
    $('menu').hidden = true; $('play').hidden = false; $('ov').classList.remove('show');
    $('ttl').textContent = '第 ' + (i + 1) + ' 關　' + lv.title + (lv.sets ? '　第 ' + (s + 1) + ' 組' : '');
    $('tip').textContent = lv.tip || '';
    say('');
    render();
  }

  function describe(ch) {
    const t = MAP[ch]; if (!t) return '';
    if (ch === '⇪') return '按一下 Caps Lock（在 A 的左邊）→ 燈會亮或熄';
    if (ch === '↵') return 'Enter（右手小指）→ 確定、換行';
    if (/[A-Z]/.test(ch)) return '大寫 ' + ch + '　→　Shift + ' + ch + '，或 Caps Lock 亮著時直接按';
    if (/[a-z]/.test(ch)) return '小寫 ' + ch + '　→　直接按';
    if (/[0-9]/.test(ch)) return '數字 ' + ch + '　→　直接按';
    return (NAME[ch] || '') + ' ' + ch + '　→　' + (t.shift ? 'Shift + ' + t.base : '直接按');
  }

  function render() {
    const u = units[qi];
    const el = $('word'); el.innerHTML = '';
    el.style.fontSize = (u.length === 1 ? (u[0] === '⇪' ? 80 : 150) : u.length <= 6 ? 100 : u.length <= 12 ? 72 : 52) + 'px';
    u.forEach((c, k) => {
      const s = document.createElement('span');
      s.className = 'ch ' + (k < ci ? 'done' : k === ci ? 'cur' : 'todo'); s.textContent = LABEL[c] || c; el.appendChild(s);
    });
    $('count').textContent = '第 ' + (qi + 1) + ' / ' + units.length + ' 題';
    $('desc').textContent = describe(u[ci]);
    paint();
  }

  function paint() {
    Object.values(keyEl).forEach(k => k.classList.remove('target', 'shiftneed'));
    const t = MAP[units[qi][ci]];
    if (t) {
      keyEl[t.code].classList.add('target');
      if (t.shift && !shiftHeld) { keyEl.ShiftLeft.classList.add('shiftneed'); keyEl.ShiftRight.classList.add('shiftneed'); }
    }
    keyEl.ShiftLeft.classList.toggle('shiftdown', shiftHeld);
    keyEl.ShiftRight.classList.toggle('shiftdown', shiftHeld);
    keyEl.CapsLock.classList.toggle('lockon', capsOn);
  }

  function syncCaps(e) {
    if (e.getModifierState) capsOn = e.getModifierState('CapsLock');
    $('caps').hidden = !(playing && capsOn && !LEVELS[li].caps);
    if (playing) keyEl.CapsLock.classList.toggle('lockon', capsOn);
  }

  function finishLevel() {
    playing = false;
    const lv = LEVELS[li];
    const stars = mistakes <= totalChars * .2 ? 3 : mistakes <= totalChars * .6 ? 2 : 1;
    const key = setKey(lv, si);
    if (stars > (best[key] || 0)) { best[key] = stars; save(best); }
    const hasNextSet = !!lv.sets && si < lv.sets.length - 1;
    const hasNextLevel = li < LEVELS.length - 1;
    const c = $('card'); c.innerHTML = '';
    const h = document.createElement('h2'); h.textContent = '這一關過了！';
    const s = document.createElement('div'); s.className = 'st'; s.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const p = document.createElement('p'); p.textContent = '按錯 ' + mistakes + ' 次';
    const bt = document.createElement('div'); bt.className = 'btns';
    const mk = (t, cls, fn) => { const b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.onclick = fn; bt.appendChild(b); return b; };
    mk('回選單', 'alt', toMenu);
    mk(lv.sets ? '再玩這一組' : '再玩一次', 'alt', () => start(li, si));
    if (hasNextSet) mk('下一組', hasNextLevel ? 'alt' : '', () => start(li, si + 1));
    if (hasNextLevel) mk('下一關', '', () => start(li + 1));
    c.append(h, s, p, bt);
    $('ov').classList.add('show');
    bt.lastChild.focus();
  }

  function toMenu() { playing = false; $('caps').hidden = true; $('ov').classList.remove('show'); $('play').hidden = true; $('menu').hidden = false; buildMenu(); }

  // 右邊數字鍵盤：換算成主鍵盤上對應的鍵（* 和 + 在數字鍵盤上不用 Shift）
  const NUMPAD = {NumpadDecimal:['Period',0], NumpadSubtract:['Minus',0], NumpadDivide:['Slash',0],
    NumpadMultiply:['Digit8',1], NumpadAdd:['Equal',1], NumpadEnter:['Enter',0]};
  function norm(e) {
    const m = /^Numpad(\d)$/.exec(e.code);
    if (m) return {code:'Digit' + m[1], shift:!!e.shiftKey};
    const n = NUMPAD[e.code];
    if (n) return {code:n[0], shift:n[1] ? true : !!e.shiftKey};
    return {code:e.code, shift:!!e.shiftKey};
  }

  // 按對鍵之後，判斷大小寫／Shift 對不對；回傳 null 代表正確，否則是提示文字
  function judge(p, t, ch) {
    if (t.free) return null;
    if (/[A-Za-z]/.test(ch)) {
      const upper = p.shift !== capsOn;   // Shift 和 Caps Lock 各自反轉一次大小寫
      const want = /[A-Z]/.test(ch);
      if (upper === want) return null;
      if (want) {
        if (capsOn) return '大寫鎖定亮著，Shift 會變小寫。先按 Caps Lock 把它關掉';
        return LEVELS[li].caps ? '先按 Caps Lock，燈亮了再打（按住 Shift 也可以）' : '要先按住 Shift 不放，再按這顆喔';
      }
      return capsOn ? '大寫鎖定亮著，先按 Caps Lock 把它關掉' : '這個字不用 Shift，直接按就好';
    }
    if (p.shift === t.shift) return null;
    return t.shift ? '要先按住 Shift 不放，再按這顆喔' : '這個字不用 Shift，直接按就好';
  }

  window.addEventListener('keydown', e => {
    syncCaps(e);
    if (e.ctrlKey || e.altKey || e.metaKey || /^F\d+$/.test(e.code)) return;
    if (!playing) {
      if ($('ov').classList.contains('show') && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) {
        e.preventDefault(); document.querySelector('#card .btns button:last-child').click();
      }
      return;
    }
    e.preventDefault();
    if (e.code === 'Escape') { toMenu(); return; }
    const p = norm(e);
    const el = keyEl[p.code]; if (el) el.classList.add('down');
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { shiftHeld = true; paint(); return; }
    if (e.repeat || locked) return;
    const ch = units[qi][ci], t = MAP[ch];
    if (p.code !== t.code) {
      // 不是目標鍵：Enter、Caps Lock、Backspace、Tab、空白按了不算錯
      if (/^(Enter|CapsLock|Backspace|Tab|Space)$/.test(p.code)) return;
      mistakes++; beep(220, .2); say('再找找看，黃色的那一顆', 'hint'); return;
    }
    const bad = judge(p, t, ch);
    if (bad) { mistakes++; beep(220, .2); say(bad, 'hint'); return; }
    say(''); ci++; beep(660, .08);
    if (ci >= units[qi].length) {
      locked = true; say('答對了！', 'good'); beep(880, .15);
      $('word').querySelectorAll('.ch').forEach(s => { s.className = 'ch done'; });
      setTimeout(() => { qi++; ci = 0; locked = false; if (qi >= units.length) finishLevel(); else { say(''); render(); } }, 700);
    } else render();
  });
  window.addEventListener('keyup', e => {
    syncCaps(e);
    const el = keyEl[norm(e).code]; if (el) el.classList.remove('down');
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') { shiftHeld = e.shiftKey; if (playing) paint(); }
  });
  window.addEventListener('blur', () => {
    shiftHeld = false; Object.values(keyEl).forEach(k => k.classList.remove('down')); if (playing) paint();
  });

  $('back').onclick = toMenu;
  $('showhint').onchange = e => $('play').classList.toggle('nohint', !e.target.checked);
  buildMenu();
})();
