/* 拾页日记 · 角色 SVG 库
   阿页：折角书页守书人
   情绪页灵：小橙 / 小米 / 小雨 / 小线 / 小花
   规范：纯色块、无渐变、剪影在 16px 可辨 */
(function () {
  let uid = 0;

  /* ---------- 阿页 ---------- */
  /* 位图版：外部生成的五表情透明图（assets/ayeh-*.webp）。
     生成需求见项目根目录 ayeh-mascot-brief.md；替换图片时保持 640x800、底部对齐即可。 */
  const AYEH_FILES = {
    listen: 'ayeh-listen',
    reply: 'ayeh-reply',
    thinking: 'ayeh-thinking',
    sleepy: 'ayeh-sleepy',
    happy: 'ayeh-happy'
  };
  function ayeh(expr, size, cls) {
    const name = AYEH_FILES[expr] || AYEH_FILES.listen;
    const s = size || 96;
    /* 28px 以下用头像裁切版，脸才看得清；大图用整身 */
    const face = s <= 40;
    const src = 'assets/' + name + (face ? '-face' : '') + '.webp';
    const h = face ? s : Math.round(s * 800 / 640);
    return '<img class="mascot ' + (cls || '') + '" src="' + src + '" width="' + s + '" height="' + h + '" alt="" draggable="false" decoding="async">';
  }

  /* ---------- 情绪页灵 ---------- */
  function emotionFace(emotion, size, mix) {
    const s = size || 24;
    const c = mix && mix.length ? mix : null;
    const mixA = c ? 'var(--' + c[0] + ')' : 'var(--joy)';
    const mixB = c && c[1] ? 'var(--' + c[1] + ')' : 'var(--low)';
    let body = '';
    let face = '';
    let extra = '';

    if (emotion === 'joy') {
      body = '<path d="M50 8q5-4 9 1l32 74q4 8-4 8H13q-8 0-4-8z" fill="var(--joy)"/>';
      face = '<circle cx="39" cy="52" r="4.4" fill="var(--joy-ink)"/><circle cx="61" cy="52" r="4.4" fill="var(--joy-ink)"/>' +
             '<path d="M42 63q8 8 16 0" stroke="var(--joy-ink)" stroke-width="5.2" stroke-linecap="round" fill="none"/>';
      extra = '<path d="M82 16l2.6 6.4 6.4 2.6-6.4 2.6L82 34l-2.6-6.4L73 25l6.4-2.6z" fill="var(--cream)"/>';
    } else if (emotion === 'calm') {
      body = '<rect x="21" y="9" width="66" height="66" rx="20" fill="var(--calm)" opacity=".45"/>' +
             '<rect x="11" y="21" width="66" height="66" rx="20" fill="var(--calm)"/>';
      face = '<path d="M29 48q7 5 14 0M57 48q7 5 14 0" stroke="var(--calm-ink)" stroke-width="5.2" stroke-linecap="round" fill="none"/>' +
             '<path d="M42 62h16" stroke="var(--calm-ink)" stroke-width="5" stroke-linecap="round" fill="none"/>';
    } else if (emotion === 'low') {
      body = '<path d="M50 6s35 37 35 57a35 35 0 0 1-70 0C15 43 50 6 50 6z" fill="var(--low)"/>';
      face = '<path d="M32 52q7 7 14 2M68 52q-7 7-14 2" stroke="var(--low-ink)" stroke-width="5" stroke-linecap="round" fill="none"/>' +
             '<path d="M42 74q8-6 16 0" stroke="var(--low-ink)" stroke-width="5" stroke-linecap="round" fill="none"/>';
      extra = '<path d="M70 54s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" fill="var(--low-soft)"/>';
    } else if (emotion === 'anxious') {
      body = '<path d="M50 8c8-4 16 0 19 8 9-4 19 3 19 13 9 5 10 16 3 23 5 9 0 20-10 22-5 11-17 15-25 8-9 7-21 4-25-6-11 0-17-10-13-19-8-8-4-20 5-24-1-10 8-18 17-16 3-8 6-11 10-9z" fill="var(--anxious)"/>';
      face = '<circle cx="39" cy="45" r="4.2" fill="var(--anxious-ink)"/><circle cx="61" cy="45" r="4.2" fill="var(--anxious-ink)"/>' +
             '<path d="M35 60l6 7 6-7 6 7 6-7" stroke="var(--anxious-ink)" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>';
      extra = '<path d="M80 28s5 6 5 9a5 5 0 0 1-10 0c0-3 5-9 5-9z" fill="var(--anxious-soft)"/>';
    } else {
      const id = 'mixclip' + (++uid);
      body = '<defs><clipPath id="' + id + '"><path d="M50 10c10-8 26-2 28 10 12 0 19 12 14 23 8 10 2 25-10 27-4 14-20 18-28 8-11 8-27 2-28-11-13-3-18-17-10-26-7-11 2-24 14-21 4-10 14-14 20-10z"/></clipPath></defs>' +
             '<g clip-path="url(#' + id + ')">' +
             '<rect x="0" y="0" width="100" height="100" fill="' + mixA + '"/>' +
             '<polygon points="0,100 100,0 100,100" fill="' + mixB + '"/>' +
             '</g>';
      face = '<circle cx="38" cy="47" r="4.2" fill="var(--ink)"/>' +
             '<path d="M57 47q5-5 10 0" stroke="var(--ink)" stroke-width="4.8" stroke-linecap="round" fill="none"/>' +
             '<path d="M37 63q6-6 12 0t12 0" stroke="var(--ink)" stroke-width="4.6" stroke-linecap="round" fill="none"/>';
    }

    return '<svg class="em-face" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" fill="none" aria-hidden="true" focusable="false">' +
      body + extra + face + '</svg>';
  }

  /* ---------- 书堆 ---------- */
  function bookStack(size) {
    const w = size || 210;
    const h = Math.round(w * 120 / 220);
    return '<svg class="book-stack" viewBox="0 0 220 120" width="' + w + '" height="' + h + '" fill="none" aria-hidden="true" focusable="false">' +
      '<ellipse cx="110" cy="112" rx="96" ry="7" fill="var(--leaf-200)" opacity=".8"/>' +
      '<path d="M188 84c2-14 8-22 14-26M188 84c-1-11-6-18-13-21M188 84c7-3 14-3 20 1" stroke="var(--leaf-500)" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M184 88c0-9 5-16 13-20" stroke="var(--leaf-400)" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="18" y="88" width="184" height="24" rx="8" fill="var(--leaf-500)"/>' +
      '<rect x="28" y="94" width="164" height="6" rx="3" fill="var(--cream)"/>' +
      '<rect x="38" y="67" width="144" height="23" rx="8" fill="var(--leaf-300)"/>' +
      '<rect x="48" y="73" width="124" height="5" rx="2.5" fill="var(--white)"/>' +
      '<rect x="58" y="48" width="104" height="21" rx="8" fill="var(--dusk)"/>' +
      '<rect x="68" y="54" width="84" height="5" rx="2.5" fill="var(--cream)"/>' +
      '</svg>';
  }

  /* ---------- 打开的书 ---------- */
  function openBook(size) {
    const w = size || 260;
    const h = Math.round(w * 180 / 260);
    return '<svg class="open-book" viewBox="0 0 260 180" width="' + w + '" height="' + h + '" fill="none" aria-hidden="true" focusable="false">' +
      '<path d="M20 44q60-16 108 4 48-20 112-4v106q-64-14-112 6-48-20-108-6z" fill="var(--leaf-300)"/>' +
      '<path d="M30 52q54-14 96 2v88q-42-16-96-4z" fill="var(--white)"/>' +
      '<path d="M230 52q-54-14-96 2v88q42-16 96-4z" fill="var(--white)"/>' +
      '<path d="M130 52v90" stroke="var(--line-soft)" stroke-width="2"/>' +
      '<path d="M48 74h60M48 86h52M48 98h58M48 110h44" stroke="var(--line-soft)" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M152 74h60M152 86h52M152 98h58M152 110h44" stroke="var(--line-soft)" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M126 138h8v26l-4-4-4 4z" fill="var(--dusk)"/>' +
      '</svg>';
  }


  /* ---------- 树枝 / 叶子（聊天背景与开场） ---------- */
  function leafMark(x, y, rot, scale, color, delay) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + scale + ')">' +
      '<g class="branch-leaf" style="animation-delay:' + (delay || 0) + 's">' +
        '<path d="M0 0C9-12 28-14 38 0 28 12 9 12 0 0Z" fill="' + color + '"/>' +
        '<path d="M4 0C14-4 26-4 34 0" stroke="var(--leaf-600)" stroke-width="1.3" stroke-linecap="round" fill="none"/>' +
      '</g></g>';
  }

  function branchSVG(side) {
    return '<svg class="branch-' + side + '" viewBox="0 0 240 210" fill="none" aria-hidden="true" focusable="false">' +
      '<g class="branch-sway">' +
        '<path d="M-18 92C36 84 68 118 108 116C144 114 166 88 214 104" stroke="var(--bark-500)" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M58 103C76 88 98 84 116 92" stroke="var(--bark-400)" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M130 115C146 130 146 150 132 164" stroke="var(--bark-400)" stroke-width="4" stroke-linecap="round"/>' +
        leafMark(44, 88, -36, .82, 'var(--leaf-400)', -.4) +
        leafMark(80, 104, 20, .96, 'var(--leaf-500)', -1.2) +
        leafMark(108, 116, -18, .72, 'var(--leaf-300)', -2.1) +
        leafMark(148, 108, 34, .9, 'var(--leaf-400)', -3) +
        leafMark(190, 101, -42, .78, 'var(--leaf-500)', -1.7) +
        leafMark(120, 90, -62, .64, 'var(--leaf-300)', -2.8) +
        leafMark(132, 160, 70, .7, 'var(--leaf-400)', -.9) +
      '</g></svg>';
  }

  function sprigSVG(size) {
    var w = size || 140;
    return '<svg viewBox="0 0 130 50" width="' + w + '" height="' + Math.round(w * 50 / 130) + '" fill="none" aria-hidden="true" focusable="false">' +
      '<path d="M4 42C30 40 54 32 80 24C96 19 112 19 126 24" stroke="var(--bark-400)" stroke-width="3" stroke-linecap="round"/>' +
      leafMark(26, 37, -50, .5, 'var(--leaf-400)', -1.1) +
      leafMark(54, 29, 10, .62, 'var(--leaf-500)', -2.5) +
      leafMark(84, 23, -40, .55, 'var(--leaf-300)', -.7) +
      leafMark(108, 20, 30, .45, 'var(--leaf-400)', -3.2) +
    '</svg>';
  }

  window.SyMascot = {
    ayeh: ayeh,
    emotion: emotionFace,
    books: bookStack,
    openBook: openBook,
    branch: branchSVG,
    sprig: sprigSVG
  };
})();
