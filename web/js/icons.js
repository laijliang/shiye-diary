/* 拾页日记 · 线性图标库
   统一：24 网格 / 1.6px 描边 / 圆头圆角 */
(function () {
  const P = {
    chat: '<path d="M4.5 7A2.5 2.5 0 0 1 7 4.5h10A2.5 2.5 0 0 1 19.5 7v6.5a2.5 2.5 0 0 1-2.5 2.5h-6.6L5 20.5v-3.8a2.6 2.6 0 0 1-.5-1.6z"/>',
    book: '<path d="M12 6.8C10.4 5.4 8.4 4.7 6 4.7H4v14.1h2c2.4 0 4.4.7 6 2 1.6-1.3 3.6-2 6-2h2V4.7h-2c-2.4 0-4.4.7-6 2.1z"/><path d="M12 6.8v14"/>',
    user: '<path d="M12 11.4a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4z"/><path d="M4.9 20.2a7.1 7.1 0 0 1 14.2 0"/>',
    mic: '<path d="M12 3.6a2.4 2.4 0 0 1 2.4 2.4v5a2.4 2.4 0 0 1-4.8 0v-5A2.4 2.4 0 0 1 12 3.6z"/><path d="M6.6 11.4a5.4 5.4 0 0 0 10.8 0M12 16.8v3.6M9.2 20.4h5.6"/>',
    send: '<path d="M12 19V5M6.6 10.4 12 5l5.4 5.4"/>',
    keyboard: '<rect x="3.5" y="6.8" width="17" height="10.6" rx="2.4"/><circle cx="7.2" cy="10.1" r=".65" fill="currentColor" stroke="none"/><circle cx="10.6" cy="10.1" r=".65" fill="currentColor" stroke="none"/><circle cx="14" cy="10.1" r=".65" fill="currentColor" stroke="none"/><circle cx="17.4" cy="10.1" r=".65" fill="currentColor" stroke="none"/><path d="M8 13.8h8"/>',
    back: '<path d="M15 5.2 8.2 12l6.8 6.8"/>',
    'chevron-left': '<path d="M14.6 5.4 8 12l6.6 6.6"/>',
    'chevron-right': '<path d="M9.4 5.4 16 12l-6.6 6.6"/>',
    'chevron-down': '<path d="M6 9.6 12 15.6 18 9.6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    bookmark: '<path d="M6.6 4.6h10.8v15.8l-5.4-3.9-5.4 3.9z"/>',
    'bookmark-fill': '<path d="M6.6 4.6h10.8v15.8l-5.4-3.9-5.4 3.9z" fill="currentColor"/>',
    share: '<circle cx="6.2" cy="12" r="2.2"/><circle cx="17.8" cy="7" r="2.2"/><circle cx="17.8" cy="17" r="2.2"/><path d="M8.1 11 15.9 8M8.1 13l7.8 3"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.6V12l3 1.9"/>',
    lock: '<rect x="5" y="10.4" width="14" height="9.6" rx="2.5"/><path d="M8.6 10.4V8a3.4 3.4 0 0 1 6.8 0v2.4"/>',
    moon: '<path d="M20 14.4A8 8 0 1 1 9.6 4a6.5 6.5 0 0 0 10.4 10.4z"/>',
    trash: '<path d="M4.6 7.2h14.8M9.6 7.2V5.6A1.6 1.6 0 0 1 11.2 4h1.6a1.6 1.6 0 0 1 1.6 1.6v1.6M6.7 7.2l.8 11.1A2 2 0 0 0 9.5 20h5a2 2 0 0 0 2-1.7l.8-11.1M10 11v5.2M14 11v5.2"/>',
    download: '<path d="M12 4v10M8 10.4l4 4 4-4M5 19.6h14"/>',
    check: '<path d="M5 12.6 9.4 17 19 6.8"/>',
    dots: '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    filter: '<path d="M4.6 7.2h14.8M7.2 12h9.6M10 16.8h4"/>',
    leaf: '<path d="M19.2 4.8c-8.2 0-13.2 4-13.2 10a4.2 4.2 0 0 0 4.2 4.2c6 0 9-5 9-14.2z"/><path d="M6 19c2.1-4.1 5.1-7 9.2-9.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bell: '<path d="M6.6 10a5.4 5.4 0 0 1 10.8 0c0 4 1.4 5 2 5.5H4.6c.6-.5 2-1.5 2-5.5z"/><path d="M9.6 18.8a2.5 2.5 0 0 0 4.8 0"/>',
    'arrow-up': '<path d="M12 19V5M6.6 10.4 12 5l5.4 5.4"/>',
    sparkle: '<path d="M12 3.4l1.9 5.2 5.2 1.9-5.2 1.9L12 17.6l-1.9-5.2L4.9 10.5l5.2-1.9z" fill="currentColor" stroke="none"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4"/>',
    edit: '<path d="M4.5 19.5h4L19 9a2.1 2.1 0 0 0-3-3L5.5 16.5z"/><path d="M14.5 7.5 17.5 10.5"/>',
    copy: '<rect x="8.6" y="8.6" width="11" height="11" rx="2.4"/><path d="M15.4 8.6V6.4a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2.2"/>'
  };

  function icon(name, size, cls) {
    const d = P[name] || P.dots;
    const s = size || 20;
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>';
  }

  window.SyIcon = icon;
})();
