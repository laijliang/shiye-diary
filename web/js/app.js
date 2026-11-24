/* ============================================================
   拾页日记 · App
   MVP：本地存储 + 模拟 AI + 模拟语音转写
   ============================================================ */
(function () {
  'use strict';

  var D = window.SyData;
  var icon = window.SyIcon;
  var M = window.SyMascot;

  var view = document.getElementById('view');
  var layerRoot = document.getElementById('layer-root');
  var STORAGE_KEY = 'shiye.v1';
  var todayDate = new Date();
  var TODAY = D.dateKey(todayDate);
  var DEMO_MODE = new URLSearchParams(location.search).get('demo') === '1';

  var state = loadState();
  var monthCursor = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  var monthDir = 0;
  var replyCursor = {};
  var pendingCount = 0;
  var toastTimer = null;
  var statusTimer = null;
  var activeSheetClose = null;
  var seq = 0;
  var lastRenderedHash = null;
  var newMsgId = null;
  var lastNavPage = null;

  /* ---------------- 基础工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + '-' + (++seq); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  function llmConfig() {
    var cfg = (state.settings && state.settings.llm) || {};
    return { enabled: !!cfg.enabled, endpoint: String(cfg.endpoint || '').trim(), model: String(cfg.model || '').trim(), apiKey: String(cfg.apiKey || '').trim() };
  }

  function hasLlmConfig() {
    var cfg = llmConfig();
    return cfg.enabled && !!cfg.endpoint && !!cfg.model && !!cfg.apiKey;
  }

  function chatHistory() {
    return state.messages.filter(function (m) { return (m.role === 'user' || m.role === 'ai') && m.text; }).slice(-12).map(function (m) {
      return { role: m.role === 'ai' ? 'assistant' : 'user', content: m.text };
    });
  }

  function callLlm(messages, jsonMode) {
    var cfg = llmConfig();
    if (!hasLlmConfig()) return Promise.reject(new Error('未配置模型服务'));
    var payload = { model: cfg.model, messages: messages, temperature: 0.75 };
    if (jsonMode) payload.response_format = { type: 'json_object' };
    return fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body && body.error && body.error.message ? body.error.message : '模型服务请求失败');
        var content = body && body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
        if (!content) throw new Error('模型服务没有返回内容');
        return String(content).trim();
      });
    });
  }

  function parseJsonObject(text) {
    var source = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    var start = source.indexOf('{');
    var end = source.lastIndexOf('}');
    return JSON.parse(start >= 0 && end > start ? source.slice(start, end + 1) : source);
  }

  function defaultSettings() {
    return {
      genTime: '22:30',
      style: 'narrative',
      autoGen: true,
      voice: true,
      dialect: false,
      tts: false,
      remindChat: true,
      remindDiary: true,
      llm: {
        enabled: false,
        endpoint: 'https://api.deepseek.com/chat/completions',
        model: 'deepseek-flash',
        apiKey: ''
      }
    };
  }

  function normalizeMessages(s) {
    var grouped = s.messagesByDate || {};
    if (!s.messagesByDate) {
      var legacyDate = s.lastActiveDate || TODAY;
      grouped[legacyDate] = (s.messages || []).map(function (m) { m.date = m.date || legacyDate; return m; });
    }
    s.messagesByDate = grouped;
    s.lastActiveDate = TODAY;
    s.messages = Array.isArray(grouped[TODAY]) ? grouped[TODAY] : [];
    s.messages.forEach(function (m) { m.date = TODAY; });
    return s;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.entries && s.messages) {
          s = normalizeMessages(s);
          s.settings = Object.assign(defaultSettings(), s.settings || {});
          s.settings.llm = Object.assign(defaultSettings().llm, s.settings.llm || {});
          s.favorites = s.favorites || [];
          s.filter = s.filter || [];
          return s;
        }
      }
    } catch (e) { /* ignore */ }
    var fresh = {
      onboarded: false,
      entries: DEMO_MODE ? D.seedEntries() : {},
      messages: [],
      messagesByDate: {},
      lastActiveDate: TODAY,
      settings: defaultSettings(),
      favorites: [],
      filter: []
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch (e) { /* ignore */ }
    return fresh;
  }

  function save() {
    state.messagesByDate = state.messagesByDate || {};
    state.messagesByDate[TODAY] = state.messages;
    state.lastActiveDate = TODAY;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function emotionMeta(key) { return D.EMOTIONS[key] || D.EMOTIONS.calm; }
  function entryEmotion(e) { return e && D.EMOTIONS[e.emotion] ? e.emotion : 'calm'; }

  function emChip(key, mix, size) {
    var meta = emotionMeta(key);
    return '<span class="chip chip-emotion em-' + key + '">' + M.emotion(key, size || 18, mix) + '<span>' + meta.label + '</span></span>';
  }

  function isGenerationDue() {
    var parts = String(state.settings.genTime || '22:30').split(':');
    var now = new Date();
    return now.getHours() * 60 + now.getMinutes() >= (Number(parts[0]) * 60 + Number(parts[1]));
  }

  function checkDueGeneration() {
    if (!state.settings.autoGen || !isGenerationDue() || state.entries[TODAY]) return;
    var realMsgs = state.messages.filter(function (m) { return m.role === 'user' && m.text && !m.command; });
    if (!realMsgs.length) return;
    var fallback = D.buildEntryFromMessages(realMsgs, null);
    if (!fallback) return;
    fallback.date = TODAY;
    fallback.generatedAt = state.settings.genTime;
    generateEntryWithLlm(fallback).then(function (entry) {
      state.entries[TODAY] = entry;
      save();
      if (parseRoute().page === 'chat') renderChat();
      if (state.settings.remindDiary && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('拾页日记已整理好', { body: '今天的这一页已经写好了。' });
      }
    });
  }

  /* ---------------- Toast / Sheet ---------------- */
  function toast(msg) {
    var t = $('.toast');
    if (!t) {
      t = el('<div class="toast" role="status"></div>');
      layerRoot.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(function () { t.classList.add('is-on'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2200);
  }

  function openSheet(opts) {
    if (activeSheetClose) activeSheetClose();
    var layer = el(
      '<div class="sheet-layer">' +
        '<div class="scrim"></div>' +
        '<div class="sheet" role="dialog" aria-modal="true" tabindex="-1">' +
          '<div class="sheet-handle">' +
            '<div class="sheet-grabber"></div>' +
            '<button class="sheet-close" aria-label="关闭">' + icon('close', 18) + '</button>' +
            (opts.title ? '<h3 class="sheet-title">' + esc(opts.title) + '</h3>' : '') +
            (opts.sub ? '<p class="sheet-sub">' + esc(opts.sub) + '</p>' : '') +
          '</div>' +
          '<div class="sheet-content">' + (opts.body || '') + '</div>' +
        '</div>' +
      '</div>'
    );
    layerRoot.appendChild(layer);
    document.body.classList.add('sheet-open');
    var appShell = document.getElementById('app');
    if (appShell) appShell.inert = true;
    var sheet = $('.sheet', layer);
    var scrim = $('.scrim', layer);
    var handle = $('.sheet-handle', layer);
    requestAnimationFrame(function () { layer.classList.add('is-open'); });

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var closed = false;
    var drag = null;

    function close() {
      if (closed) return;
      closed = true;
      document.body.classList.remove('sheet-open');
      document.removeEventListener('keydown', onKey);
      layer.classList.remove('is-dragging');
      void sheet.offsetHeight; /* 让拖拽位置先成为过渡起点 */
      layer.classList.remove('is-open');
      sheet.style.transform = 'translateY(102%)';
      scrim.style.opacity = '0';
      if (appShell) appShell.inert = false;
      setTimeout(function () { layer.remove(); }, reduced ? 40 : 340);
      if (activeSheetClose === close) activeSheetClose = null;
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    activeSheetClose = close;

    /* 从把手往下拖：1:1 跟随，松手按位移或速度决定去留 */
    handle.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.sheet-close')) return;
      drag = { id: e.pointerId, y: e.clientY, dy: 0, lastY: e.clientY, lastT: performance.now(), v: 0 };
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      layer.classList.add('is-dragging');
    });
    handle.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dy = Math.max(0, e.clientY - drag.y);
      var now = performance.now();
      drag.v = (e.clientY - drag.lastY) / Math.max(1, now - drag.lastT);
      drag.dy = dy;
      drag.lastY = e.clientY;
      drag.lastT = now;
      /* 拖过 60px 后开始阻尼，像真的纸页被拉住 */
      var shown = dy < 60 ? dy : 60 + (dy - 60) * .55;
      sheet.style.transform = 'translateY(' + shown + 'px)';
      scrim.style.opacity = String(Math.max(0, 1 - shown / 340));
    });
    function endDrag() {
      if (!drag) return;
      var d = drag;
      drag = null;
      if (d.dy > (sheet.offsetHeight || 400) * .26 || d.v > .5) {
        close();
        return;
      }
      layer.classList.remove('is-dragging');
      sheet.style.transition = 'transform 220ms var(--ease-out)';
      sheet.style.transform = '';
      scrim.style.opacity = '';
      setTimeout(function () {
        sheet.style.transition = '';
      }, 240);
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('lostpointercapture', endDrag);

    $('.scrim', layer).addEventListener('click', close);
    $('.sheet-close', layer).addEventListener('click', close);
    $$('[data-close]', layer).forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', onKey);
    setTimeout(function () { try { sheet.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
    return { layer: layer, close: close };
  }

  /* ---------------- 路由 ---------------- */
  function parseRoute() {
    var raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { page: state.onboarded ? 'chat' : 'welcome' };
    var parts = raw.split('/');
    if (parts[0] === 'diary' && parts[1] && /^\d{4}-\d{2}-\d{2}$/.test(parts[1])) {
      return { page: 'diary', date: parts[1] };
    }
    if (parts[0] === 'calendar') return { page: 'calendar' };
    if (parts[0] === 'me') return { page: 'me' };
    if (parts[0] === 'welcome') return { page: 'welcome' };
    return { page: 'chat' };
  }

  function navigate(path) {
    var h = '#' + (path.charAt(0) === '/' ? path : '/' + path);
    if (location.hash === h) { render(); return; }
    lastRenderedHash = h;
    location.hash = h;
    render();
  }

  function render() {
    lastRenderedHash = location.hash;
    if (activeSheetClose) activeSheetClose();
    var genLayer = $('.gen-layer');
    if (genLayer) genLayer.remove();
    document.body.style.overflow = '';
    var t = $('.toast');
    if (t) t.classList.remove('is-on');
    clearTimeout(toastTimer);
    document.body.classList.remove('is-listening', 'kb-open');
    var r = parseRoute();
    if (r.page !== 'calendar') {
      monthCursor = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
      state.filter = [];
    }
    if (r.page === 'welcome') {
      history.replaceState(null, '', '#/chat');
      lastRenderedHash = '#/chat';
      r = { page: 'chat' };
    }
    document.body.classList.toggle('route-chat', r.page === 'chat');
    var prevIdx = NAV_ORDER.indexOf(lastNavPage);
    var nextIdx = NAV_ORDER.indexOf(r.page);
    setTabbar(r.page);
    if (r.page === 'calendar') renderCalendar();
    else if (r.page === 'me') renderProfile();
    else if (r.page === 'diary') renderDetail(r.date);
    else renderChat();
    var pageBody = $('.page-body', view);
    if (pageBody && prevIdx >= 0 && nextIdx >= 0 && prevIdx !== nextIdx) {
      pageBody.classList.add(nextIdx > prevIdx ? 'is-nav-right' : 'is-nav-left');
    }
    lastNavPage = r.page;

    if (r.page !== 'chat') window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ============================================================
     CHAT
     ============================================================ */
  /* 导航栏只建一次；切页时只移动指示条，不再整条重建 */
  var tabbarEl = null;
  var tabbarReady = false;
  var NAV_ORDER = ['chat', 'calendar', 'me'];

  function buildTabbar() {
    if (tabbarEl) return;
    tabbarEl = el(
      '<nav class="tabbar" aria-label="主导航">' +
        '<span class="tab-indicator" aria-hidden="true"></span>' +
        '<button class="tab" data-nav="chat">' + icon('chat', 20) + '<span>对话</span></button>' +
        '<button class="tab" data-nav="calendar">' + icon('book', 20) + '<span>日历</span></button>' +
        '<button class="tab" data-nav="me">' + icon('user', 20) + '<span>我的</span></button>' +
      '</nav>'
    );
    document.body.appendChild(tabbarEl);
  }

  function setTabbar(page) {
    if (!tabbarEl) buildTabbar();
    document.body.dataset.route = page;
    var idx = NAV_ORDER.indexOf(page);
    var ind = $('.tab-indicator', tabbarEl);
    var tabs = $$('.tab', tabbarEl);
    tabs.forEach(function (b, i) {
      var on = i === idx;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (!ind) return;
    if (idx < 0) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1';
    if (!tabbarReady) {
      /* 首屏直接落位，不做一次从「对话」滑过去的假动画 */
      tabbarReady = true;
      ind.style.transition = 'none';
      ind.style.transform = 'translateX(' + (idx * 100) + '%)';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { ind.style.transition = ''; });
      });
    } else {
      ind.style.transform = 'translateX(' + (idx * 100) + '%)';
    }
  }

  function renderChat() {
    var userCount = state.messages.filter(function (m) { return m.role === 'user' && !m.command; }).length;
    var todayEntry = state.entries[TODAY];
    var due = isGenerationDue();
    view.innerHTML =
      '<div class="page page-chat">' +
        '<div class="page-body">' +
          '<header class="chat-head">' +
            '<div class="chat-sprig" aria-hidden="true">' + M.sprig(150) + '</div>' +
            '<div class="chat-top">' +
              '<div class="chat-date"><b>' + D.monthDayCN(D.parseKey(TODAY)) + '</b><span>' + D.weekdayCN(D.parseKey(TODAY)) + '</span></div>' +
              '<button class="icon-btn" data-menu aria-label="更多">' + icon('dots', 20) + '</button>' +
            '</div>' +
            '<button type="button" class="chat-id" data-persona aria-label="阿页的人设说明">' +
              '<span class="avatar" id="status-avatar">' + M.ayeh('listen', 28) + '</span>' +
              '<span class="chat-id-copy">' +
                '<span class="chat-id-name">阿页</span>' +
                '<span class="chat-id-text"><span class="status-dot" aria-hidden="true"><i></i></span><span id="status-text">在书店里</span></span>' +
              '</span>' +
            '</button>' +
            '<button type="button" class="day-line" data-today-action>' +
              icon(todayEntry ? 'book' : 'leaf', 14) +
              '<span>今天已收下 <b>' + userCount + ' 段</b></span>' +
              '<span class="day-line-go">' + (todayEntry ? '翻开这一页 →' : due ? '现在整理 →' : '今晚 ' + esc(state.settings.genTime) + ' 成稿') + '</span>' +
            '</button>' +
          '</header>' +
          '<div class="chat-scroll">' +
            '<div id="messages" role="log" aria-live="polite" aria-relevant="additions text"></div>' +
          '</div>' +
        '</div>' +
        '<form class="composer' + (state.settings.voice ? '' : ' no-voice') + '" id="dock" autocomplete="off">' +
          '<div class="composer-main">' +
            '<input class="chat-input" id="chat-input" type="text" maxlength="300" placeholder="想说什么，都可以" aria-label="想说的话" enterkeyhint="send">' +
            '<button type="submit" class="composer-btn composer-send" id="composer-send" aria-label="发送">' + icon('send', 20) + '</button>' +
            '<button type="button" class="composer-btn composer-mic" id="dock-mic" aria-label="按住说话"' + (state.settings.voice ? '' : ' hidden') + '>' + icon('mic', 21) + '</button>' +
          '</div>' +
          '<div class="composer-listen">' +
            '<div class="wave"><i></i><i></i><i></i><i></i><i></i></div>' +
            '<div class="listen-copy"><strong id="listen-title">我在听</strong><span id="listen-hint">松开发送 · 上滑取消</span></div>' +
            '<div class="listen-cancel">' + icon('arrow-up', 16) + '</div>' +
          '</div>' +
        '</form>' +
      '</div>';

    var list = $('#messages');
    renderMessagesInto(list);
    if (pendingCount > 0) showTyping();
    bindChat();
    var todayAction = $('[data-today-action]', view);
    if (todayAction) todayAction.addEventListener('click', function () {
      if (state.entries[TODAY]) navigate('/diary/' + TODAY);
      else if (isGenerationDue() && userCount) runGeneration();
      else navigate('/calendar');
    });
  }

  function emptyChatHtml() {
    return '<div class="chat-empty">' +
      '<div class="empty-mascot">' + M.ayeh('listen', 108) + '</div>' +
      '<p class="empty-line">不用组织语言。<br>想到哪儿，说到哪儿。</p>' +
      '<div class="empty-suggest">' +
        D.SUGGESTIONS.map(function (s) {
          return '<button class="chip chip-suggest" data-suggest="' + esc(s) + '">' + esc(s) + '</button>';
        }).join('') +
      '</div>' +
      '<p class="chat-hint">长按一句话夹书签 · 也可以直接说「整理今天的日记」</p>' +
    '</div>';
  }

  function renderMessagesInto(list) {
    if (!list) return;
    if (!state.messages.length) {
      list.innerHTML = emptyChatHtml();
      return;
    }
    var html = '';
    var lastRole = null;
    state.messages.forEach(function (m) {
      if (m.type === 'diary') {
        var de = state.entries[m.date];
        var dayLabel = de ? '今天的这一页' : '这一页';
        html += '<div class="diary-note' + (m.id === newMsgId ? ' is-new' : '') + '">' +
          '<button type="button" class="diary-note-card" data-diary-open="' + esc(m.date) + '" aria-label="翻开' + esc(D.monthDayCN(D.parseKey(m.date))) + '的日记">' +
            '<span class="diary-note-top"><span class="diary-note-label">' + dayLabel + '</span>' + (de ? emChip(entryEmotion(de), de.mix, 18) : '') + '</span>' +
            '<p class="diary-note-summary">' + (de ? esc(de.summary) : '先跟我说两句今天的事。') + '</p>' +
            (de ? '<span class="diary-note-go">翻开这一页 →</span>' : '') +
          '</button>' +
        '</div>';
        lastRole = null;
        return;
      }
      if (m.type === 'split') {
        html += '<div class="split-note">' + esc(m.text || '换了一段 · 继续') + '</div>';
        lastRole = null;
        return;
      }
      var isAi = m.role === 'ai';
      var ghost = isAi && lastRole === 'ai';
      var isNew = m.id === newMsgId;
      html += '<div class="msg-row ' + (isAi ? 'ai' : 'user') + (m.important ? ' is-important' : '') + (isNew ? ' is-new' : '') + '" data-id="' + esc(m.id) + '">' +
        (isAi ? '<div class="msg-avatar ' + (ghost ? 'is-ghost' : '') + '">' + M.ayeh('listen', 22) + '</div>' : '') +
        '<div class="msg-stack">' +
          '<div class="bubble ' + (isAi ? 'bubble-ai' : 'bubble-user') + (m.important ? ' is-important' : '') + '">' +
            (m.important ? '<span class="ribbon"></span>' : '') +
            esc(m.text) +
          '</div>' +
          '<span class="bubble-time">' + esc(m.time || '') + '</span>' +
        '</div>' +
      '</div>';
      lastRole = m.role;
    });
    newMsgId = null;
    list.innerHTML = html;
    updateSegCount();
  }

  function updateSegCount() {
    var n = state.messages.filter(function (m) { return m.role === 'user' && !m.command; }).length;
    var el = $('#seg-count');
    if (el) el.textContent = n;
  }

  function updateDayLine() {
    var line = $('.day-line', view);
    if (!line) return;
    var count = state.messages.filter(function (m) { return m.role === 'user' && !m.command; }).length;
    var b = $('b', line);
    if (b) b.textContent = count + ' 段';
    var go = $('.day-line-go', line);
    if (go) {
      var e = state.entries[TODAY];
      go.textContent = e ? '翻开这一页 →' : (isGenerationDue() ? '现在整理 →' : '今晚 ' + state.settings.genTime + ' 成稿');
    }
  }

  function refreshMessages() {
    var list = $('#messages');
    if (!list) return;
    renderMessagesInto(list);
    if (pendingCount > 0) showTyping();
    updateDayLine();
    scrollBottom(true);
  }

  function scrollBottom(smooth) {
    setTimeout(function () {
      var h = document.body.scrollHeight;
      window.scrollTo({ top: h, behavior: smooth ? 'smooth' : 'auto' });
    }, 30);
  }

  function addUserMessage(text) {
    var m = {
      id: uid(),
      role: 'user',
      text: String(text).trim(),
      time: D.nowHM(),
      important: false,
      command: !!parseDiaryCommand(text)
    };
    newMsgId = m.id;
    state.messages.push(m);
    save();
    refreshMessages();
    if (isGenerationDue()) checkDueGeneration();
    return m;
  }

  function addSplitNote() {
    state.messages.push({ id: uid(), type: 'split', text: '换了一段 · 继续' });
    save();
    refreshMessages();
  }

  function nextReply(emo) {
    var arr = D.AI_REPLIES[emo] || D.AI_REPLIES.calm;
    replyCursor[emo] = replyCursor[emo] || 0;
    var txt = arr[replyCursor[emo] % arr.length];
    replyCursor[emo] += 1;
    return txt;
  }

  function diaryContext() {
    var e = state.entries[TODAY];
    if (!e) return '今天还没有成稿。';
    return '今天的日记页已存在。情绪：' + emotionMeta(entryEmotion(e)).label +
      '；摘要：' + e.summary +
      '；正文（节选）：' + String(e.body || '').slice(0, 600);
  }

  function chatSystemPrompt() {
    return '你是「阿页」，黄昏旧书店的守书人，也是「拾页日记」里陪用户说话的角色。' +
      '使用简体中文，每次 2 到 4 句，温柔、克制、句子偏短；不说教、不诊断、不主动给建议、不使用网络热梗；可以用书店、书页、黄昏、晚风这类意象。' +
      '你知道自己在这个应用里能做什么：陪用户说话；把今天说过的话整理成一页第一人称日记；按用户的明确要求修改今天这一页的摘要、正文或情绪；到设定时间应用会自动收稿。' +
      '今天是 ' + D.monthDayCN(D.parseKey(TODAY)) + '。' + diaryContext() +
      ' 你必须只返回一个 JSON 对象，不要 Markdown、不要代码块：' +
      '{"reply":"对用户说的 2-4 句话","action":{"type":"none"}}。' +
      '当用户明确要求整理今天这一页时，action 用 {"type":"generate_entry"}。' +
      '当用户明确要求改这一页时，action 用 {"type":"update_entry","summary":"可选","body":"可选","emotion":"joy|calm|low|anxious|mixed","mix":["joy","low"]可选}；只填用户要求改的字段。' +
      '普通倾诉、提问、闲聊一律用 {"type":"none"}，不要擅自生成或改写日记。' +
      'reply 里不要提 JSON、动作、工具这些词，就像阿页平常说话。用户问你能做什么时，用 2-3 句说清楚：陪聊、把今天整理成一页、按意思改这一页。';
  }

  function findEmotionWord(t) {
    if (/开心|高兴|快乐|喜悦|愉快/.test(t)) return 'joy';
    if (/平静|安静|安宁|安稳/.test(t)) return 'calm';
    if (/低落|难过|伤心|失落|委屈|丧/.test(t)) return 'low';
    if (/焦虑|烦躁|压力|紧张|烦死|慌/.test(t)) return 'anxious';
    if (/复杂|混合|说不清|两种心情/.test(t)) return 'mixed';
    return null;
  }

  function parseDiaryCommand(text) {
    var t = String(text || '');
    if (/你能做什么|会做什么|能帮我做什么|有什么功能|你能干嘛|你会干嘛|你的能力/.test(t)) {
      return { type: 'capabilities' };
    }
    var sum = t.match(/(?:摘要|一句话|卡片)[^改换写为]{0,8}(?:改成|换成|写成|改为|换为)[：:，,]?\s*[“"「]?([^”"」]+?)[”"」]?$/);
    if (sum && sum[1].trim()) return { type: 'summary', text: sum[1].trim() };
    var body = t.match(/(?:正文|内容)[^改换写为]{0,8}(?:改成|换成|写成|改为|换为)[：:，,]?\s*[“"「]?([^”"」]+?)[”"」]?$/);
    if (body && body[1].trim()) return { type: 'body', text: body[1].trim() };
    var emo = findEmotionWord(t);
    var change = /(改成|换成|变成|调成|换一种|改一下|换一下)/.test(t);
    var target = /(这一页|日记|情绪|心情|颜色|色调)/.test(t);
    if (emo && change && target) {
      return { type: 'emotion', emotion: emo };
    }
    if (/((重写|改写|润色|换一版|再写一版).{0,8}(日记|这一页|摘要|正文))|((日记|这一页|摘要|正文).{0,8}(重写|改写|润色|改得|写得))/.test(t)) {
      return { type: 'rewrite', text: t };
    }
    if (/(生成|整理|写|收|做|来).{0,8}(日记|一页|这一页|成稿)|成稿|收进书页|写进书里/.test(t)) {
      return { type: 'generate' };
    }
    return null;
  }

  function currentEntry() {
    return state.entries[TODAY] || ensureTodayEntry();
  }

  function handleMockCommand(text) {
    var cmd = parseDiaryCommand(text);
    if (!cmd) return null;
    if (cmd.type === 'capabilities') {
      return { reply: '我可以听你说，也可以陪你待一会儿。想收起来的时候，跟我说「帮我整理今天的日记」；想改这一页，就告诉我改摘要、正文，还是把情绪换成哪一种。到了设定时间，我会自己把当天收好。' };
    }
    if (cmd.type === 'generate') {
      var userMsgs = state.messages.filter(function (m) { return m.role === 'user' && m.text && !m.command; });
      if (userMsgs.length) {
        ensureTodayEntry();
        return { reply: '好，我把今天说过的话收成一页了。', diary: true };
      }
      return state.entries[TODAY]
        ? { reply: '今天这一页已经在书里了。想重新收一版，先跟我说两句今天的事。', diary: true }
        : { reply: '今天还没有攒下片段。先说两句吧，我再替你收。' };
    }
    if (cmd.type === 'emotion') {
      var e = currentEntry();
      e.emotion = cmd.emotion;
      e.mix = cmd.emotion === 'mixed' ? ['joy', 'low'] : null;
      state.entries[TODAY] = e;
      save();
      return { reply: '把这一页的颜色换成「' + D.EMOTIONS[cmd.emotion].label + '」了。', diary: true };
    }
    if (cmd.type === 'summary') {
      var e2 = currentEntry();
      e2.summary = cmd.text.slice(0, 80);
      state.entries[TODAY] = e2;
      save();
      return { reply: '摘要换好了。', diary: true };
    }
    if (cmd.type === 'body') {
      var e3 = currentEntry();
      e3.body = cmd.text;
      state.entries[TODAY] = e3;
      save();
      return { reply: '正文换好了。', diary: true };
    }
    if (cmd.type === 'rewrite') {
      var existing = state.entries[TODAY];
      var msgs = state.messages.filter(function (m) { return m.role === 'user' && m.text && !m.command; });
      var frags = existing ? (existing.fragments || []).map(function (f) {
        if (typeof f === 'string') return { role: 'user', text: f, time: existing.generatedAt, important: false };
        return { role: 'user', text: f.text, time: f.time, important: !!f.important };
      }) : [];
      var source = msgs.length ? msgs : frags;
      if (!source.length) return { reply: '这一页还没有可以重写的片段。先跟我说两句今天的事吧。' };
      var base = existing || ensureTodayEntry();
      var rebuilt = D.buildEntryFromMessages(source, base);
      if (rebuilt) {
        rebuilt.date = TODAY;
        rebuilt.generatedAt = D.nowHM();
        rebuilt.favorite = base.favorite || false;
        state.entries[TODAY] = rebuilt;
        save();
        return { reply: '我用今天原来的片段重新收了一版。', diary: true };
      }
      return { reply: '我试着重新收了一版，但内容还是原来的。想按某种语气重写，可以在「我的 → 模型」里接上模型服务。' };
    }
    return null;
  }

  function pushAi(content, emo) {
    var text = String(content || '').trim();
    if (!text) text = '嗯，我在。';
    var msg = { id: uid(), role: 'ai', text: text, time: D.nowHM(), emotion: emo };
    newMsgId = msg.id;
    state.messages.push(msg);
    pendingCount = Math.max(0, pendingCount - 1);
    save();
    if ($('#messages')) {
      refreshMessages();
      setHeaderStatus(emo);
    }
    if (state.settings.tts && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    }
  }

  function pushDiaryRow() {
    var row = { id: uid(), role: 'system', type: 'diary', date: TODAY, time: D.nowHM() };
    newMsgId = row.id;
    state.messages.push(row);
    save();
    refreshMessages();
  }

  function afterDiaryChange(msg) {
    updateDayLine();
    if ($('.page-chat')) pushDiaryRow();
    if (msg) toast(msg);
  }

  function performDiaryAction(action) {
    if (!action || !action.type || action.type === 'none') return;
    if (action.type === 'generate_entry') {
      var userMsgs = state.messages.filter(function (m) { return m.role === 'user' && m.text && !m.command; });
      var fallback = ensureTodayEntry();
      if (hasLlmConfig() && userMsgs.length) {
        generateEntryWithLlm(fallback).then(function (entry) {
          state.entries[TODAY] = entry;
          save();
          afterDiaryChange('今天的这一页，重新收好了。');
        });
      } else {
        afterDiaryChange('今天的这一页，收好了。');
      }
      return;
    }
    if (action.type === 'update_entry') {
      var e = currentEntry();
      if (typeof action.summary === 'string' && action.summary.trim()) e.summary = action.summary.trim().slice(0, 80);
      if (typeof action.body === 'string' && action.body.trim()) e.body = action.body.trim();
      if (action.emotion && D.EMOTIONS[action.emotion]) {
        e.emotion = action.emotion;
        if (action.emotion === 'mixed') {
          var mix = Array.isArray(action.mix) ? action.mix.filter(function (k) { return !!D.EMOTIONS[k]; }).slice(0, 2) : [];
          e.mix = mix.length === 2 ? mix : ['joy', 'low'];
        } else {
          e.mix = null;
        }
      }
      state.entries[TODAY] = e;
      save();
      afterDiaryChange('这一页改好了。');
    }
  }

  function scheduleReply(text) {
    pendingCount += 1;
    showTyping();
    var emo = D.detectEmotion(text);

    if (hasLlmConfig()) {
      callLlm([{ role: 'system', content: chatSystemPrompt() }].concat(chatHistory()), true).then(function (content) {
        var payload = null;
        try { payload = parseJsonObject(content); } catch (e) { payload = null; }
        var replyText = payload && typeof payload.reply === 'string' && payload.reply.trim()
          ? payload.reply.trim()
          : (content.trim().charAt(0) === '{' ? '好，我记下了。' : content.trim());
        pushAi(replyText, emo);
        if (payload && payload.action && payload.action.type && payload.action.type !== 'none') {
          performDiaryAction(payload.action);
        }
      }).catch(function () {
        toast('模型服务暂不可用，已切回演示回复。');
        var cmd = handleMockCommand(text);
        if (cmd) {
          pushAi(cmd.reply, emo);
          if (cmd.diary) afterDiaryChange(null);
        } else {
          pushAi(nextReply(emo), emo);
        }
      });
      return;
    }

    var mock = handleMockCommand(text);
    if (mock) {
      setTimeout(function () {
        pushAi(mock.reply, emo);
        if (mock.diary) afterDiaryChange(null);
      }, 650 + Math.random() * 450);
      return;
    }
    setTimeout(function () { pushAi(nextReply(emo), emo); }, 950 + Math.random() * 600);
  }

  function showTyping() {
    var list = $('#messages');
    if (!list || $('#typing-row')) return;
    if (!state.messages.length) return;
    var row = el('<div class="msg-row ai typing-row" id="typing-row">' +
      '<div class="msg-avatar">' + M.ayeh('thinking', 22) + '</div>' +
      '<div class="msg-stack"><div class="bubble bubble-ai">' +
        '<span class="typing-dots"><i></i><i></i><i></i></span>' +
        '<em>阿页正在翻书…</em>' +
      '</div></div>' +
    '</div>');
    list.appendChild(row);
    scrollBottom(true);
  }

  function setHeaderStatus(emo) {
    var t = $('#status-text');
    var a = $('#status-avatar');
    if (!t || !a) return;
    t.textContent = '这句话，夹好了。';
    a.innerHTML = M.emotion(emo, 28);
    a.classList.add('is-mirror');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      var t2 = $('#status-text');
      var a2 = $('#status-avatar');
      if (t2) t2.textContent = '在书店里';
      if (a2) {
        a2.innerHTML = M.ayeh('listen', 28);
        a2.classList.remove('is-mirror');
      }
    }, 2600);
  }

  function sendText(text) {
    var t = String(text || '').trim();
    if (!t) return;
    addUserMessage(t);
    scheduleReply(t);
  }

  function sendVoice(chunks) {
    var combined = chunks.join('。');
    chunks.forEach(function (c, i) {
      setTimeout(function () {
        if (i > 0) addSplitNote();
        addUserMessage(c);
        if (i === chunks.length - 1) scheduleReply(combined);
      }, i * 380);
    });
  }

  function bindChat() {
    var form = $('#dock');
    var input = $('#chat-input');
    var mic = $('#dock-mic');
    var list = $('#messages');
    if (!form || !input || !mic || !list) return;

    function syncSend() {
      var has = input.value.trim().length > 0;
      form.classList.toggle('has-text', has);
    }
    input.addEventListener('input', syncSend);
    input.addEventListener('focus', function () { document.body.classList.add('kb-open'); });
    input.addEventListener('blur', function () { document.body.classList.remove('kb-open'); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = input.value.trim();
      if (!t) return;
      input.value = '';
      syncSend();
      sendText(t);
      input.focus();
    });

    list.addEventListener('click', function (e) {
      var s = e.target.closest('[data-suggest]');
      if (s) {
        input.value = s.getAttribute('data-suggest');
        syncSend();
        input.focus();
        return;
      }
      var d = e.target.closest('[data-diary-open]');
      if (d) navigate('/diary/' + d.getAttribute('data-diary-open'));
    });

    var menu = $('[data-menu]');
    if (menu) menu.addEventListener('click', openChatMenu);
    var personaPill = $('[data-persona]');
    if (personaPill) personaPill.addEventListener('click', openPersonaSheet);

    /* ---- 长按气泡 ---- */
    var lp = null;
    function clearLp() {
      if (lp) { clearTimeout(lp.timer); lp = null; }
    }
    list.addEventListener('pointerdown', function (e) {
      var row = e.target.closest('.msg-row');
      if (!row || row.classList.contains('typing-row')) return;
      var id = row.getAttribute('data-id');
      if (!id) return;
      clearLp();
      lp = {
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(function () {
          clearLp();
          if (navigator.vibrate) navigator.vibrate(10);
          openMessageSheet(id);
        }, 500)
      };
    });
    list.addEventListener('pointermove', function (e) {
      if (!lp) return;
      if (Math.abs(e.clientX - lp.x) > 9 || Math.abs(e.clientY - lp.y) > 9) clearLp();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
      list.addEventListener(t, clearLp);
    });
    list.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* ---- 按住说话：浏览器语音识别；不支持的浏览器明确回退演示 ---- */
    var rec = null;
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    function resetListenUI() {
      document.body.classList.remove('is-listening');
      var dock = $('#dock');
      if (dock) dock.classList.remove('is-listening', 'is-cancel');
      var title = $('#listen-title');
      var hint = $('#listen-hint');
      if (title) title.textContent = '我在听';
      if (hint) hint.textContent = '松开发送 · 上滑取消';
    }

    function setHint(text) {
      var hint = $('#listen-hint');
      if (hint && text) hint.textContent = text;
    }

    function finalizeSr(r) {
      if (rec !== r) return;
      clearTimeout(r.kill);
      rec = null;
      resetListenUI();
      var segs = (r.segments || []).filter(function (s) { return s && String(s).trim(); });
      if (segs.length) {
        if (navigator.vibrate) navigator.vibrate(6);
        sendVoice(segs);
        return;
      }
      var err = r.srError;
      if (err === 'not-allowed' || err === 'service-not-allowed') toast('需要麦克风权限才能用语音。');
      else if (err === 'network') toast('语音识别需要联网。');
      else if (err === 'no-speech') toast('没听清，再说一次。');
      else if (err === 'start') toast('语音识别启动失败，先用文字输入吧。');
      else toast('没有听到声音，再试一次。');
    }

    function startRec(e) {
      if (rec) return;
      e.preventDefault();
      try { mic.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      input.blur();
      var base = { y: e.clientY, start: Date.now(), cancelled: false, mode: SR ? 'sr' : 'demo', partial: null };
      rec = base;
      document.body.classList.add('is-listening');
      var dock = $('#dock');
      if (dock) dock.classList.add('is-listening');
      var title = $('#listen-title');
      if (title) title.textContent = '我在听';
      if (navigator.vibrate) navigator.vibrate(8);

      if (!SR) {
        setHint('演示转写 · 松开发送 · 上滑取消');
        base.partial = setTimeout(function () {
          if (rec === base && !base.cancelled) setHint(pick(D.VOICE_PARTIALS));
        }, 760);
        return;
      }

      var r = new SR();
      r.lang = 'zh-CN';
      r.continuous = true;
      r.interimResults = true;
      r.maxAlternatives = 1;
      base.sr = r;
      base.segments = [];
      base.srDone = false;
      base.released = false;
      base.srError = null;
      setHint('说话吧 · 松开发送');

      r.onresult = function (ev) {
        if (rec !== base) return;
        var finalText = '';
        var interim = '';
        for (var i = ev.resultIndex; i < ev.results.length; i++) {
          var res = ev.results[i];
          var txt = res[0] && res[0].transcript ? res[0].transcript : '';
          if (res.isFinal) finalText += txt;
          else interim += txt;
        }
        if (finalText.trim()) base.segments.push(finalText.trim());
        if (base.cancelled) return;
        setHint(interim.trim() || finalText.trim() || (base.segments.length ? '已经收下，继续说…' : '说话吧 · 松开发送'));
      };
      r.onerror = function (ev) {
        if (rec === base) base.srError = ev.error;
      };
      r.onend = function () {
        if (rec !== base) return;
        base.srDone = true;
        if (base.released) finalizeSr(base);
        else if (!base.cancelled) setHint('松开发送');
      };
      try {
        r.start();
      } catch (err) {
        base.srError = 'start';
        setHint('语音识别启动失败，松手后可以改用文字');
      }
    }

    function moveRec(e) {
      if (!rec) return;
      var cancelled = (rec.y - e.clientY) > 56;
      if (cancelled === rec.cancelled) return;
      rec.cancelled = cancelled;
      var dock = $('#dock');
      if (dock) dock.classList.toggle('is-cancel', cancelled);
      var title = $('#listen-title');
      if (title) title.textContent = cancelled ? '松开取消' : '我在听';
      if (cancelled) setHint('这次不记下来');
      else setHint(rec.mode === 'sr' ? '说话吧 · 松开发送' : '演示转写 · 松开发送 · 上滑取消');
    }

    function endRec() {
      if (!rec) return;
      var r = rec;
      if (r.mode === 'sr') {
        if (r.cancelled) {
          rec = null;
          clearTimeout(r.kill);
          if (r.sr) { try { r.sr.abort(); } catch (err) { /* ignore */ } }
          resetListenUI();
          toast('已取消，这次不记下来。');
          return;
        }
        r.released = true;
        if (r.srDone) { finalizeSr(r); return; }
        if (r.srError === 'start') { finalizeSr(r); return; }
        var title = $('#listen-title');
        if (title) title.textContent = '正在转写';
        setHint('松手了，正在把话收下来…');
        if (r.sr) { try { r.sr.stop(); } catch (err) { finalizeSr(r); return; } }
        clearTimeout(r.kill);
        r.kill = setTimeout(function () { finalizeSr(r); }, 4000);
        return;
      }
      rec = null;
      clearTimeout(r.partial);
      resetListenUI();
      if (r.cancelled) { toast('已取消，这次不记下来。'); return; }
      var dur = Date.now() - r.start;
      if (dur < 320) { toast('按住说话，松开就会发送。'); return; }
      if (navigator.vibrate) navigator.vibrate(6);
      var chunks = dur > 4200 ? pick(D.VOICE_PAIRS) : [pick(D.VOICE_SINGLE)];
      setTimeout(function () { sendVoice(chunks); }, 180);
    }

    mic.addEventListener('pointerdown', startRec);
    mic.addEventListener('pointermove', moveRec);
    mic.addEventListener('pointerup', endRec);
    mic.addEventListener('pointercancel', function () {
      if (rec) { rec.cancelled = true; endRec(); }
    });
    mic.addEventListener('lostpointercapture', function () {
      if (rec) endRec();
    });
    mic.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  }

  function openChatMenu() {
    var n = state.messages.filter(function (m) { return m.role === 'user' && !m.command; }).length;
    var s = openSheet({
      title: '阿页的书桌',
      sub: '今天已收下 ' + n + ' 段心事 · ' + state.settings.genTime + ' 成稿',
      body:
        '<div class="action-list">' +
          '<button class="action-btn" data-today>' + icon('book', 18) + '查看今天的这一页</button>' +
          '<button class="action-btn" data-saved>' + icon('bookmark', 18) + '收藏与重要片段</button>' +
          '<button class="action-btn" data-gocal>' + icon('book', 18) + '翻到日记日历</button>' +
        '</div>'
    });
    $('[data-today]', s.layer).addEventListener('click', function () { s.close(); state.entries[TODAY] ? navigate('/diary/' + TODAY) : isGenerationDue() ? runGeneration() : navigate('/calendar'); });
    $('[data-saved]', s.layer).addEventListener('click', function () { s.close(); setTimeout(openSavedSheet, 260); });
    $('[data-gocal]', s.layer).addEventListener('click', function () {
      s.close();
      navigate('/calendar');
    });
  }

  function openSavedSheet() {
    var saved = [];
    Object.keys(state.entries).forEach(function (date) {
      var entry = state.entries[date];
      if (state.favorites.indexOf(date) !== -1) saved.push({ date: date, text: entry.summary, kind: '收藏日记' });
      (entry.fragments || []).forEach(function (f) { if (f && f.important) saved.push({ date: date, text: f.text, kind: '重要片段' }); });
    });
    Object.keys(state.messagesByDate || {}).forEach(function (date) {
      (state.messagesByDate[date] || []).forEach(function (m) { if (m.important) saved.push({ date: date, text: m.text, kind: '重要片段' }); });
    });
    var body = saved.length ? '<div class="saved-list">' + saved.map(function (item) {
      return '<button class="saved-item" data-saved-date="' + esc(item.date) + '"><small>' + esc(item.kind) + ' · ' + esc(item.date) + '</small><span>' + esc(item.text) + '</span></button>';
    }).join('') + '</div>' : '<div class="saved-empty">还没有收藏或重要片段。<br>在聊天里长按一句话，就能把它收好。</div>';
    var sheet = openSheet({ title: '收藏与重要片段', sub: '那些想再翻回来的句子。', body: body });
    $$('[data-saved-date]', sheet.layer).forEach(function (button) {
      button.addEventListener('click', function () { var date = button.getAttribute('data-saved-date'); sheet.close(); if (state.entries[date]) navigate('/diary/' + date); else navigate('/chat'); });
    });
  }

  function openPersonaSheet() {
    openSheet({
      title: '阿页',
      sub: '黄昏旧书店 · 守书人',
      body:
        '<div class="persona-block"><h4>背景</h4><p>旧书店的年轻守书人，常年待在永远停在黄昏时刻的旧书店里。见过很多故事，读过很多书，但从不轻易讲大道理。他习惯把别人的心事夹进书页里，安静保管。</p></div>' +
        '<div class="persona-block"><h4>性格</h4><p>温和、慢热、话少、有边界感。擅长倾听，不擅长说教。对未知的事物会坦诚说“这个我不太懂，但我愿意听你讲”。</p></div>' +
        '<div class="persona-block"><h4>说话风格</h4><p>句子偏短，语气轻柔，常用书店、书页、黄昏、晚风等意象做呼应。不使用网络热梗，不亢奋、不煽情。</p></div>' +
        '<div class="persona-block"><h4>他能做什么</h4><p>陪你说话；把今天说过的话整理成一页日记；按你的意思改这一页的摘要、正文和情绪；到设定时间把当天收好。</p></div>' +
        '<div class="persona-block"><h4>他不会做的事</h4><ul class="persona-list">' +
          '<li>不主动追问你的隐私，你不说的内容不打探。</li>' +
          '<li>不强行给出解决方案，不做人生导师。</li>' +
          '<li>不懂的领域坦诚承认，不强行回答。</li>' +
          '<li>永远站在你这一侧，不评判你的情绪对错。</li>' +
        '</ul></div>' +
        '<p class="lockline" style="margin-top:18px;display:flex">' + icon('lock', 12) + ' 文字只留在这台设备；语音由浏览器识别</p>'
    });
  }

  function openMessageSheet(id) {
    var m = state.messages.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    var s = openSheet({
      title: m.role === 'ai' ? '阿页的这句话' : '这段心事',
      sub: '长按选择的片段',
      body:
        '<div class="action-quote">' + esc(m.text) + '</div>' +
        '<div class="action-list">' +
          '<button class="action-btn is-warm" data-mark>' + icon(m.important ? 'bookmark-fill' : 'bookmark', 18) + (m.important ? '取下书签' : '夹上书签，优先保留') + '</button>' +
          '<button class="action-btn" data-copy>' + icon('copy', 18) + '复制这句话</button>' +
        '</div>'
    });
    $('[data-mark]', s.layer).addEventListener('click', function () {
      m.important = !m.important;
      save();
      refreshMessages();
      s.close();
      toast(m.important ? '已夹上书签，成稿时优先保留。' : '书签取下了。');
    });
    $('[data-copy]', s.layer).addEventListener('click', function () {
      var done = function () { toast('已复制。'); s.close(); };
      var fail = function () { toast('复制失败，可以手动选中文字。'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(m.text).then(done).catch(fail);
      } else { fail(); }
    });
  }

  /* ============================================================
     CALENDAR
     ============================================================ */
  function monthEntriesOf(cursor) {
    var y = cursor.getFullYear();
    var m = cursor.getMonth();
    return Object.keys(state.entries).filter(function (k) {
      var d = D.parseKey(k);
      return d.getFullYear() === y && d.getMonth() === m;
    }).sort().reverse();
  }

  function dominantOf(entries) {
    var tally = { joy: 0, calm: 0, low: 0, anxious: 0, mixed: 0 };
    entries.forEach(function (e) { tally[entryEmotion(e)] = (tally[entryEmotion(e)] || 0) + 1; });
    var best = 'calm', max = -1;
    D.ORDER.forEach(function (k) { if (tally[k] > max) { max = tally[k]; best = k; } });
    return { key: best, count: max };
  }

  function renderCalendar() {
    var y = monthCursor.getFullYear();
    var m = monthCursor.getMonth();
    var keys = monthEntriesOf(monthCursor);
    var entries = keys.map(function (k) { return state.entries[k]; }).filter(Boolean);
    var filterOn = state.filter.length > 0;
    var filtered = filterOn ? entries.filter(function (e) { return state.filter.indexOf(entryEmotion(e)) !== -1; }) : entries;
    var total = entries.length;
    var emoCount = { joy: 0, calm: 0, low: 0, anxious: 0, mixed: 0 };
    filtered.forEach(function (e) { emoCount[entryEmotion(e)] += 1; });

    var first = new Date(y, m, 1);
    var lead = first.getDay();
    var days = D.daysInMonth(first);
    var cells = '';
    for (var b = 0; b < lead; b++) cells += '<div class="day-blank"></div>';

    for (var day = 1; day <= days; day++) {
      var key = y + '-' + D.pad(m + 1) + '-' + D.pad(day);
      var e = state.entries[key];
      var isToday = key === TODAY;
      var isFuture = key > TODAY;
      var emo = e ? entryEmotion(e) : null;
      var dim = filterOn && e && !isToday && state.filter.indexOf(emo) === -1;
      var cls = 'day-cell';
      var style = '';
      if (e) {
        cls += ' has-entry em-' + emo;
        if (emo === 'mixed') {
          var a = 'var(--' + ((e.mix && e.mix[0]) || 'joy') + '-cell)';
          var bb = 'var(--' + ((e.mix && e.mix[1]) || 'low') + '-cell)';
          style = ' style="background:linear-gradient(135deg,' + a + ' 0 50%,' + bb + ' 50% 100%)"';
        } else {
          style = ' style="background:var(--e-cell)"';
        }
      } else if (isFuture) {
        cls += ' is-future';
      } else {
        cls += ' is-empty';
      }
      if (isToday) cls += ' is-today';
      if (dim) cls += ' is-dim';
      var hasImp = e && (e.fragments || []).some(function (f) { return f && f.important; });
      var hasTodayMessages = isToday && !e && state.messages.some(function (msg) { return msg.role === 'user'; });
      var label = D.monthDayCN(new Date(y, m, day)) + (e ? ' · ' + emotionMeta(emo).label : (isFuture ? '' : ' · 还没有记录'));
      cells += '<button type="button" class="' + cls + '"' + style + ' data-date="' + key + '"' + (e ? ' data-entry="1"' : '') + (isFuture ? ' data-future="1"' : '') + (hasTodayMessages ? ' data-today-pending="1"' : '') + ' aria-label="' + esc(label) + '">' +
        '<span class="day-num">' + day + '</span>' +
        (e ? '<span class="day-face">' + M.emotion(emo, 17, e.mix) + '</span>' : '') +
        (hasImp ? '<span class="day-flag"></span>' : '') +
      '</button>';
    }

    var bar = '';
    D.ORDER.forEach(function (k) {
      if (!emoCount[k]) return;
      var pct = filtered.length ? (emoCount[k] / filtered.length) * 100 : 0;
      var bg;
      if (k === 'mixed') {
        bg = 'linear-gradient(135deg,var(--joy) 0 50%,var(--low) 50% 100%)';
      } else {
        bg = 'var(--' + k + ')';
      }
      bar += '<i style="width:' + pct.toFixed(2) + '%;background:' + bg + '"></i>';
    });

    var dom = filtered.length ? dominantOf(filtered).key : null;
    var notes = {
      joy: '这个月，亮起来的日子最多。',
      calm: '这个月，安静的日子最多。',
      low: '这个月，有些页翻得慢一点。',
      anxious: '这个月，心里打结的日子不少。',
      mixed: '这个月，很多页都夹着两种颜色。'
    };
    var note = filtered.length ? notes[dom] : (filterOn ? '没有符合筛选的书页。' : '这个月，书店还空着。');
    var chipLabel = filterOn ? '已筛 ' + state.filter.length + ' 种' : '全部情绪';
    var cards = filtered.map(function (e, i) {
      var d = D.parseKey(e.date);
      var n = (e.fragments || []).length;
      var mixed = entryEmotion(e) === 'mixed';
      var spine = mixed
        ? ' style="background:linear-gradient(135deg,var(--' + ((e.mix && e.mix[0]) || 'joy') + ') 0 50%,var(--' + ((e.mix && e.mix[1]) || 'low') + ') 50% 100%)"'
        : '';
      return '<article class="page-card em-' + entryEmotion(e) + '" data-card="' + e.date + '" role="link" tabindex="0" aria-label="翻开 ' + esc(D.monthDayCN(d)) + ' 的日记">' +
        '<span class="card-spine"' + spine + '></span>' +
        '<div class="card-top"><span class="card-date">' + D.shortCN(d) + ' ' + D.weekdayCN(d) + '</span>' + emChip(entryEmotion(e), e.mix, 18) + '</div>' +
        '<p class="card-summary">' + esc(e.summary) + '</p>' +
        '<div class="card-meta"><span>' + n + ' 段 · ' + esc(e.generatedAt) + ' 成稿</span><span class="card-open">翻开 →</span></div>' +
      '</article>';
    }).join('');

    var dots = filtered.slice(0, 7).map(function (e, i) {
      return '<button class="rail-dot' + (i === 0 ? ' is-on' : '') + '" data-rail-dot="' + i + '" aria-label="第 ' + (i + 1) + ' 页"' + (i === 0 ? ' aria-current="true"' : '') + '></button>';
    }).join('');
    var deck = '<div class="rail-head">' +
        '<h2 class="rail-title">本月书页 <span>' + filtered.length + ' 篇</span></h2>' +
        '<button class="chip filter-chip ' + (filterOn ? 'is-on' : '') + '" data-open-filter>' + icon('filter', 14) + chipLabel + '</button>' +
      '</div>' +
      '<div class="rail" data-rail role="group" aria-roledescription="横向书页" aria-label="本月书页">' + cards + '</div>' +
      '<div class="rail-foot">' +
        (filtered.length <= 7 ? '<div class="rail-dots">' + dots + '</div>' : '<span class="rail-count micro">1 / ' + filtered.length + '</span>') +
        '<span class="rail-hint">' + (filtered.length > 1 ? '左右滑动' : '') + '</span>' +
      '</div>';

    var emptyBlock;
    if (!total) {
      emptyBlock = '<div class="cal-empty">' + M.ayeh('sleepy', 104) +
        '<p>这个月，书店还空着。</p>' +
        '<button class="btn btn-secondary" data-to-chat>去说两句</button></div>';
    } else if (!filtered.length) {
      emptyBlock = '<div class="cal-empty"><p>没有这种情绪的书页。</p><button class="btn btn-quiet" data-open-filter>换个筛选</button></div>';
    } else {
      emptyBlock = deck;
    }

    view.innerHTML =
      '<div class="page page-cal">' +
        '<div class="page-body">' +
          '<header class="cal-head">' +
            '<p class="eyebrow">情绪记忆簿</p>' +
            '<div class="cal-head-row">' +
              '<h1 class="month-big"><b>' + (m + 1) + '</b><span>月</span><em>' + y + '</em></h1>' +
              '<div class="month-nav">' +
                (!isCurrentMonth() ? '<button class="month-btn month-today" data-month-today aria-label="回到本月">今天</button>' : '') +
                '<button class="month-btn" data-month="prev" aria-label="上个月">' + icon('chevron-left', 17) + '</button>' +
                '<button class="month-btn" data-month="next" aria-label="下个月"' + (isCurrentMonth() ? ' disabled' : '') + '>' + icon('chevron-right', 17) + '</button>' +
              '</div>' +
            '</div>' +
            '<p class="cal-sub">这个月，你打开过 <b>' + total + '</b> 次书页</p>' +
          '</header>' +
          '<section class="cal">' +
            '<div class="week-row">' + ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<span class="week-cell">' + w + '</span>'; }).join('') + '</div>' +
            '<div class="days-grid">' + cells + '</div>' +
            (total ? '<div class="cal-summary"><div class="emotion-bar">' + bar + '</div><p class="cal-note">' + note + '</p></div>' : '') +
          '</section>' +
          emptyBlock +
        '</div>' +
      '</div>';

    bindCalendar();
    if (monthDir) {
      var calEl = $('.cal', view);
      if (calEl) {
        calEl.style.setProperty('--shift', (monthDir * 12) + 'px');
        calEl.classList.add('is-shift');
      }
      monthDir = 0;
    }
  }

  function isCurrentMonth() {
    return monthCursor.getFullYear() === todayDate.getFullYear() && monthCursor.getMonth() === todayDate.getMonth();
  }

  function bindCalendar() {
    $$('[data-month]', view).forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = b.getAttribute('data-month');
        monthDir = dir === 'next' ? 1 : -1;
        monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + (dir === 'next' ? 1 : -1), 1);
        state.filter = [];
        renderCalendar();
        window.scrollTo({ top: 0, behavior: 'auto' });
      });
    });
    var todayBtn = $('[data-month-today]', view);
    if (todayBtn) todayBtn.addEventListener('click', function () { monthCursor = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1); state.filter = []; renderCalendar(); });

    $$('.day-cell', view).forEach(function (c) {
      c.addEventListener('click', function () {
        if (c.getAttribute('data-entry')) navigate('/diary/' + c.getAttribute('data-date'));
        else if (c.getAttribute('data-future')) { /* 未来不响应 */ }
        else if (c.getAttribute('data-today-pending')) navigate('/chat');
        else if (c.getAttribute('data-date') === TODAY) navigate('/chat');
        else toast('这一天还没有书页。');
      });
    });

    $$('[data-card]', view).forEach(function (card) {
      var go = function () { navigate('/diary/' + card.getAttribute('data-card')); };
      card.addEventListener('click', go);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });

    $$('[data-open-filter]', view).forEach(function (b) {
      b.addEventListener('click', openFilterSheet);
    });
    $$('[data-to-chat]', view).forEach(function (b) {
      b.addEventListener('click', function () { navigate('/chat'); });
    });

    initRail();
  }

  /* 本月书页：用浏览器的横向滚动与吸附，拖拽天然 1:1 且可中途接住 */
  function initRail() {
    var rail = $('[data-rail]', view);
    if (!rail) return;
    var cards = $$('.page-card', rail);
    var dots = $$('.rail-dot', view);
    var countEl = $('.rail-count', view);
    var n = cards.length;
    if (!n) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function step() {
      return n > 1 ? Math.abs(cards[1].offsetLeft - cards[0].offsetLeft) : 1;
    }
    function sync() {
      var i = Math.max(0, Math.min(n - 1, Math.round(rail.scrollLeft / step())));
      dots.forEach(function (d, k) {
        d.classList.toggle('is-on', k === i);
        if (k === i) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      if (countEl) countEl.textContent = (i + 1) + ' / ' + n;
    }

    rail.addEventListener('scroll', function () {
      window.requestAnimationFrame(sync);
    }, { passive: true });

    rail.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var i = Math.round(rail.scrollLeft / step()) + (e.key === 'ArrowRight' ? 1 : -1);
      i = Math.max(0, Math.min(n - 1, i));
      rail.scrollTo({ left: step() * i, behavior: reduced ? 'auto' : 'smooth' });
      try { cards[i].focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    });

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () {
        rail.scrollTo({ left: step() * i, behavior: reduced ? 'auto' : 'smooth' });
      });
    });

    sync();
  }

  function openFilterSheet() {
    var entries = monthEntriesOf(monthCursor).map(function (k) { return state.entries[k]; }).filter(Boolean);
    var counts = { joy: 0, calm: 0, low: 0, anxious: 0, mixed: 0 };
    entries.forEach(function (e) { counts[entryEmotion(e)] += 1; });
    var selected = state.filter.slice();
    var s = openSheet({
      title: '筛选情绪',
      sub: '只看某几种颜色。',
      body:
        '<div class="filter-list">' +
          D.ORDER.map(function (k) {
            var on = selected.indexOf(k) !== -1;
            return '<button class="filter-item em-' + k + (on ? ' is-on' : '') + '" data-filter="' + k + '">' +
              M.emotion(k, 30) +
              '<span class="filter-name">' + emotionMeta(k).label + '</span>' +
              '<span class="filter-count">' + counts[k] + ' 篇</span>' +
              '<span class="filter-check">' + icon('check', 12) + '</span>' +
            '</button>';
          }).join('') +
        '</div>' +
        '<div class="sheet-actions">' +
          '<button class="btn btn-quiet" data-reset-filter>全部情绪</button>' +
          '<button class="btn btn-primary" data-apply-filter>完成</button>' +
        '</div>'
    });

    $$('[data-filter]', s.layer).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-filter');
        var i = selected.indexOf(k);
        if (i === -1) selected.push(k); else selected.splice(i, 1);
        b.classList.toggle('is-on', selected.indexOf(k) !== -1);
      });
    });
    $('[data-reset-filter]', s.layer).addEventListener('click', function () {
      selected = [];
      $$('[data-filter]', s.layer).forEach(function (b) { b.classList.remove('is-on'); });
    });
    $('[data-apply-filter]', s.layer).addEventListener('click', function () {
      state.filter = selected;
      save();
      s.close();
      renderCalendar();
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  /* ============================================================
     DIARY DETAIL
     ============================================================ */
  function renderDetail(date) {
    var e = state.entries[date];
    if (!e) {
      view.innerHTML =
        '<div class="page page-detail">' +
          '<header class="detail-top">' +
            '<button class="round-btn" data-back aria-label="返回">' + icon('back', 19) + '</button><div></div>' +
          '</header>' +
          '<div class="detail-empty">' + M.ayeh('sleepy', 104) +
            '<p>这一页还没有写。</p>' +
            '<button class="btn btn-secondary" data-back>回到日历</button>' +
          '</div>' +
        '</div>';
      bindDetail(null, date);
      return;
    }

    var emo = entryEmotion(e);
    var d = D.parseKey(date);
    var frags = (e.fragments || []).map(function (f) {
      return typeof f === 'string' ? { text: f, time: e.generatedAt, important: false } : f;
    });
    var impCount = frags.filter(function (f) { return f.important; }).length;
    var fav = state.favorites.indexOf(date) !== -1;
    var diaryDates = Object.keys(state.entries).sort();
    var diaryIndex = diaryDates.indexOf(date);
    var prevDate = diaryIndex > 0 ? diaryDates[diaryIndex - 1] : null;
    var nextDate = diaryIndex >= 0 && diaryIndex < diaryDates.length - 1 ? diaryDates[diaryIndex + 1] : null;
    var paragraphs = String(e.body || '').split(/\n{2,}/).map(function (p) {
      return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');

    var fragHtml = frags.map(function (f) {
      return '<div class="mini-msg' + (f.important ? ' is-imp' : '') + '">' +
        esc(f.text) +
        '<span class="mini-time">' + esc(f.time || '') + '</span>' +
      '</div>';
    }).join('');

    view.innerHTML =
      '<div class="page page-detail em-' + emo + '">' +
        '<header class="detail-top">' +
          '<button class="round-btn" data-back aria-label="返回日历">' + icon('back', 19) + '</button>' +
          '<div class="detail-top-right">' +
            '<button class="round-btn ' + (fav ? 'is-on' : '') + '" data-fav aria-label="收藏这一页">' + icon(fav ? 'bookmark-fill' : 'bookmark', 18) + '</button>' +
            '<button class="round-btn" data-share aria-label="分享这一页">' + icon('share', 17) + '</button>' +
          '</div>' +
        '</header>' +
        '<div class="page-body">' +
          '<div class="detail-head">' +
            '<p class="eyebrow">' + d.getFullYear() + ' 年 · ' + (d.getMonth() + 1) + ' 月</p>' +
            '<h1 class="detail-date">' + D.monthDayCN(d) + '</h1>' +
            '<p class="detail-weekday">' + D.weekdayCN(d) + ' · ' + esc(e.generatedAt) + ' 成稿</p>' +
            '<div class="detail-face">' + M.emotion(emo, 38, e.mix) + '</div>' +
            '<span class="detail-em-label">' + emotionMeta(emo).label + '</span>' +
          '</div>' +
          '<p class="detail-summary">' + esc(e.summary) + '</p>' +
          '<div class="detail-rule" aria-hidden="true">' + icon('leaf', 13) + '</div>' +
          '<div class="diary-body">' + paragraphs + '</div>' +
          (frags.length ?
            '<button class="frag-toggle" data-frag-toggle aria-expanded="false">' +
              icon('book', 16) +
              '<span class="frag-count">原始片段 · <b>' + frags.length + '</b> 段</span>' +
              icon('chevron-down', 16) +
            '</button>' +
            '<div class="frag-wrap"><div class="frag-inner"><div class="frag-list">' + fragHtml + '</div></div></div>'
            : '') +
          '<div class="detail-meta">' +
            '<span>由 ' + frags.length + ' 段对话整理</span>' +
            '<span class="detail-tags">' + (impCount ? '<span class="chip">重要 ' + impCount + '</span>' : '') + '</span>' +
          '</div>' +
          '<nav class="detail-pager" aria-label="切换日记页">' +
            (prevDate ? '<button data-detail-date="' + prevDate + '">← 前一天</button>' : '<span></span>') +
            (nextDate ? '<button data-detail-date="' + nextDate + '">后一天 →</button>' : '<span></span>') +
          '</nav>' +
        '</div>' +
      '</div>';

    bindDetail(e, date);
  }

  function bindDetail(e, date) {
    $$('[data-back]', view).forEach(function (b) {
      b.addEventListener('click', function () { navigate('/calendar'); });
    });
    if (!e) return;

    $$('[data-detail-date]', view).forEach(function (button) {
      button.addEventListener('click', function () { navigate('/diary/' + button.getAttribute('data-detail-date')); });
    });

    var favBtn = $('[data-fav]', view);
    if (favBtn) {
      favBtn.addEventListener('click', function () {
        var i = state.favorites.indexOf(date);
        if (i === -1) state.favorites.push(date); else state.favorites.splice(i, 1);
        save();
        var on = state.favorites.indexOf(date) !== -1;
        favBtn.classList.toggle('is-on', on);
        favBtn.innerHTML = icon(on ? 'bookmark-fill' : 'bookmark', 18);
        toast(on ? '已收藏这一页。' : '已取消收藏。');
      });
    }
    var share = $('[data-share]', view);
    if (share) share.addEventListener('click', function () {
      var d = D.parseKey(date);
      var text = e.summary + '\n\n' + String(e.body || '').replace(/\n{2,}/g, '\n') + '\n\n—— 拾页日记 · ' + D.monthDayCN(d);
      if (navigator.share) {
        navigator.share({ title: '拾页日记 · ' + D.monthDayCN(d), text: text }).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          toast('分享面板暂时打不开，可以复制这一页。');
        });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast('这一页已复制。'); }).catch(function () { toast('复制失败，可以手动选中文字。'); });
      } else {
        toast('这个浏览器暂时不支持分享。');
      }
    });

    var toggle = $('[data-frag-toggle]', view);
    var wrap = $('.frag-wrap', view);
    if (toggle && wrap) {
      toggle.addEventListener('click', function () {
        var open = wrap.classList.toggle('is-open');
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }

  /* ============================================================
     PROFILE
     ============================================================ */
  var STYLE_LABELS = { narrative: '叙事风', concise: '简洁风', mood: '氛围感' };

  function renderProfile() {
    var s = state.settings;
    var hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    function switchRow(key, label, ico, warm) {
      return '<div class="row">' +
        '<div class="row-icon ' + (warm ? 'is-warm' : '') + '">' + icon(ico, 17) + '</div>' +
        '<div class="row-label">' + label + '</div>' +
        '<button class="switch" role="switch" aria-checked="' + (s[key] ? 'true' : 'false') + '" aria-label="' + label + '" data-setting="' + key + '"></button>' +
      '</div>';
    }
    function actionRow(key, label, ico, value, cls, warm, chev) {
      return '<div class="row ' + (cls || '') + '" data-row="' + key + '" role="button" tabindex="0">' +
        '<div class="row-icon ' + (warm ? 'is-warm' : '') + '">' + icon(ico, 17) + '</div>' +
        '<div class="row-label">' + label + '</div>' +
        (value ? '<div class="row-value" ' + (key === 'time' ? 'data-time-value' : '') + '>' + value + '</div>' : '') +
        (chev ? '<div class="row-chev">' + icon('chevron-right', 16) + '</div>' : '') +
      '</div>';
    }

    view.innerHTML =
      '<div class="page page-me">' +
        '<div class="page-body">' +
          '<header class="me-head">' +
            '<h1 class="me-title">我的书桌</h1>' +
            '<p class="me-sub">阿页在黄昏里等你。</p>' +
            '<section class="persona">' +
              '<div class="persona-face">' + M.ayeh('listen', 62) + '</div>' +
              '<div class="persona-body">' +
                '<h2 class="persona-name">阿页</h2>' +
                '<p class="persona-role">黄昏旧书店 · 守书人</p>' +
                '<p class="persona-quote">你把心事夹进书页，我替你收好。</p>' +
                '<button class="persona-link" data-row="persona">人设说明 →</button>' +
              '</div>' +
            '</section>' +
          '</header>' +

          '<div class="me-section">日记</div>' +
          '<div class="group-card">' +
            actionRow('time', '每日成稿时间', 'clock', s.genTime, '', false, true) +
            '<div class="row row-block">' +
              '<div class="row-line"><span class="row-label">日记风格</span><span class="row-hint" data-style-hint>' + STYLE_LABELS[s.style] + '</span></div>' +
              '<div class="segmented">' +
                ['narrative', 'concise', 'mood'].map(function (k) {
                  return '<button data-style="' + k + '" class="' + (s.style === k ? 'is-on' : '') + '">' + STYLE_LABELS[k] + '</button>';
                }).join('') +
              '</div>' +
            '</div>' +
            switchRow('autoGen', '每日自动成稿', 'sparkle') +
          '</div>' +

          '<div class="me-section">记录</div>' +
          '<div class="group-card">' +
            switchRow('voice', '按住说话（' + (hasSR ? '浏览器语音识别' : '演示转写') + '）', 'mic') +
            switchRow('tts', '语音播报', 'bell') +
            switchRow('remindDiary', '成稿提醒', 'clock') +
          '</div>' +

          '<div class="me-section">模型</div>' +
          '<div class="group-card">' +
            actionRow('llm', 'DeepSeek API', 'sparkle', s.llm && s.llm.enabled && s.llm.apiKey ? '已连接' : '演示模式', '', false, true) +
          '</div>' +

          '<div class="me-section">数据</div>' +
          '<div class="group-card">' +
            actionRow('export', '导出数据', 'download', '', '', false, true) +
            actionRow('clear', '清空所有数据', 'trash', '', 'is-danger', false, true) +
          '</div>' +

          (DEMO_MODE ? '<div class="me-section">演示<span class="demo-tag">DEMO</span></div><div class="group-card">' + actionRow('demo', '重演今日成稿', 'sparkle', '', '', false, true) + actionRow('splash', '重看开场', 'sparkle', '', '', false, true) + '</div>' : '') +

          '<p class="privacy-note">' + icon('lock', 12) + ' 所有文字与日记只保存在这台设备；语音识别由浏览器提供</p>' +
          '<p class="about-note">拾页日记 · MVP 0.1.0<br>所有字句，都留在这台设备上。</p>' +
        '</div>' +
      '</div>';

    bindProfile();
  }

  function bindProfile() {
    $$('[data-setting]', view).forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('data-setting');
        if (key === 'remindDiary' && !state.settings.remindDiary && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
        state.settings[key] = !state.settings[key];
        b.setAttribute('aria-checked', state.settings[key] ? 'true' : 'false');
        save();
        if (key === 'autoGen') toast(state.settings.autoGen ? '已开启每日自动成稿。' : '已关闭自动成稿。');
        if (key === 'voice') {
          toast(state.settings.voice ? '演示语音输入已开启。' : '语音输入已关闭。');
          renderProfile();
        }
        if (navigator.vibrate) navigator.vibrate(5);
      });
    });

    $$('[data-style]', view).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-style');
        state.settings.style = k;
        save();
        $$('[data-style]', view).forEach(function (x) { x.classList.toggle('is-on', x.getAttribute('data-style') === k); });
        var hint = $('[data-style-hint]', view);
        if (hint) hint.textContent = STYLE_LABELS[k];
        toast('已换成「' + STYLE_LABELS[k] + '」。');
      });
    });

    $$('[data-row]', view).forEach(function (row) {
      var go = function () {
        var key = row.getAttribute('data-row');
        if (key === 'time') openTimeSheet();
        else if (key === 'persona') openPersonaSheet();
        else if (key === 'export') exportData();
        else if (key === 'clear') openClearSheet();
        else if (key === 'llm') openLlmSheet();
        else if (key === 'demo') runGeneration();
        else if (key === 'splash') showSplash();
      };
      row.addEventListener('click', go);
      if (row.tagName !== 'BUTTON') {
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
        });
      }
    });
  }

  function openTimeSheet() {
    var temp = state.settings.genTime;
    var presets = ['21:00', '22:00', '22:30', '23:00'];
    var s = openSheet({
      title: '每日成稿时间',
      sub: '到点后，我会把今天收进书页。',
      body:
        '<div class="time-display" id="time-display">' + temp + '</div>' +
        '<p class="time-note">默认 22:30，也可以换成你习惯的时间。</p>' +
        '<div class="time-presets">' +
          presets.map(function (p) {
            return '<button class="time-preset ' + (p === temp ? 'is-on' : '') + '" data-time="' + p + '">' + p + '</button>';
          }).join('') +
        '</div>' +
        '<label class="time-native"><span>精确调整</span><input type="time" id="time-native" value="' + temp + '"></label>' +
        '<div class="sheet-actions"><button class="btn btn-primary" data-close>好了</button></div>'
    });

    function commit(val) {
      if (!/^\d{2}:\d{2}$/.test(val)) return;
      temp = val;
      state.settings.genTime = val;
      save();
      var disp = $('#time-display', s.layer);
      if (disp) disp.textContent = val;
      var native = $('#time-native', s.layer);
      if (native) native.value = val;
      $$('[data-time]', s.layer).forEach(function (b) {
        b.classList.toggle('is-on', b.getAttribute('data-time') === val);
      });
      var rowVal = $('[data-time-value]', view);
      if (rowVal) rowVal.textContent = val;
    }

    $$('[data-time]', s.layer).forEach(function (b) {
      b.addEventListener('click', function () { commit(b.getAttribute('data-time')); });
    });
    var native = $('#time-native', s.layer);
    if (native) native.addEventListener('change', function (e) { commit(e.target.value); });
  }

  function openLlmSheet() {
    var cfg = llmConfig();
    var sheet = openSheet({
      title: 'DeepSeek API 配置',
      sub: '填写后，聊天与日记成稿会调用你的模型服务。',
      body:
        '<div class="llm-form">' +
          '<label>接口地址<input id="llm-endpoint" value="' + esc(cfg.endpoint) + '" autocomplete="url" spellcheck="false"></label>' +
          '<label>模型名称<input id="llm-model" value="' + esc(cfg.model) + '" autocomplete="off" spellcheck="false"></label>' +
          '<label>API Key<input id="llm-key" type="password" value="' + esc(cfg.apiKey) + '" autocomplete="off" spellcheck="false" placeholder="sk-..."></label>' +
          '<label class="llm-toggle"><span><b>启用真实模型</b><small>关闭后保留本地演示回复</small></span><button id="llm-enabled" class="switch" type="button" role="switch" aria-checked="' + (cfg.enabled ? 'true' : 'false') + '"></button></label>' +
          '<p class="llm-note">密钥仅保存在当前浏览器。正式上线时，请改由服务端代理请求，避免将密钥暴露给访问者。</p>' +
        '</div>' +
        '<div class="sheet-actions"><button class="btn btn-quiet" data-close>取消</button><button class="btn btn-primary" id="llm-save">保存配置</button></div>'
    });
    var enabled = cfg.enabled;
    $('#llm-enabled', sheet.layer).addEventListener('click', function (e) {
      enabled = !enabled;
      e.currentTarget.setAttribute('aria-checked', enabled ? 'true' : 'false');
    });
    $('#llm-save', sheet.layer).addEventListener('click', function () {
      var endpoint = $('#llm-endpoint', sheet.layer).value.trim();
      var model = $('#llm-model', sheet.layer).value.trim();
      var apiKey = $('#llm-key', sheet.layer).value.trim();
      if (enabled && (!endpoint || !model || !apiKey)) { toast('请填写接口地址、模型名称和 API Key。'); return; }
      state.settings.llm = { enabled: enabled, endpoint: endpoint, model: model, apiKey: apiKey };
      save();
      sheet.close();
      renderProfile();
      toast(enabled ? '模型服务已启用。' : '已切换为演示模式。');
    });
  }

  function exportData() {
    try {
      var payload = {
        app: '拾页日记',
        version: '0.1.0',
        exportedAt: new Date().toISOString(),
        settings: Object.assign({}, state.settings, { llm: Object.assign({}, state.settings.llm || {}, { apiKey: '' }) }),
        entries: state.entries,
        messages: state.messages,
        messagesByDate: state.messagesByDate,
        favorites: state.favorites
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = '拾页日记-数据-' + TODAY + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      toast('数据已经导出。');
    } catch (e) {
      toast('导出失败，请稍后再试。');
    }
  }

  function openClearSheet() {
    var s = openSheet({
      title: '清空所有书页？',
      sub: '包括所有对话、日记和情绪颜色。',
      body:
        '<p class="confirm-copy">这些书页会一起消失，<b>找不回来</b>。<br>如果只是暂时不想看到，可以先关掉这本书。</p>' +
        '<div class="sheet-actions">' +
          '<button class="btn btn-quiet" data-close>先留着</button>' +
          '<button class="btn btn-danger-outline" data-clear-confirm>清空</button>' +
        '</div>'
    });
    $('[data-clear-confirm]', s.layer).addEventListener('click', function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      location.hash = '#/welcome';
      location.reload();
    });
  }

  /* ============================================================
     GENERATION
     ============================================================ */
  function ensureTodayEntry() {
    var realMsgs = state.messages.filter(function (m) { return m.role === 'user' && m.text && !m.command; });
    if (realMsgs.length) {
      var built = D.buildEntryFromMessages(realMsgs, state.entries[TODAY]);
      if (built) {
        built.generatedAt = state.settings.genTime;
        state.entries[TODAY] = built;
        save();
        return built;
      }
    }
    if (state.entries[TODAY]) return state.entries[TODAY];
    var fallback = {
      date: TODAY,
      emotion: 'calm',
      mix: null,
      summary: '今天还没有留下什么，这一页先空着。',
      body: '今天没有留下太多话。\n\n阿页把空白的一页也收好了。等你想说的时候，再来。',
      fragments: [],
      generatedAt: state.settings.genTime,
      favorite: false
    };
    state.entries[TODAY] = fallback;
    save();
    return fallback;
  }

  function generateEntryWithLlm(fallback) {
    var userMsgs = state.messages.filter(function (m) { return m.role === 'user' && m.text && !m.command; });
    if (!userMsgs.length || !hasLlmConfig()) return Promise.resolve(fallback);
    var style = STYLE_LABELS[state.settings.style] || STYLE_LABELS.narrative;
    var fragments = userMsgs.map(function (m) { return { text: m.text, time: m.time || D.nowHM(), important: !!m.important }; });
    var prompt = '请把用户今天的对话整理成一篇私密日记。日记必须使用第一人称、简体中文、克制温柔，不虚构事实，不给出医疗或心理诊断。日记风格：' + style + '。只返回 JSON 对象，不要 Markdown。JSON 格式：{"emotion":"joy|calm|low|anxious|mixed","mix":["joy","low"]或null,"summary":"不超过28字","body":"两到四段正文"}。用户原始片段：' + JSON.stringify(fragments);
    return callLlm([
      { role: 'system', content: '你是私密日记整理助手。严格按照用户指定的 JSON 格式回答。' },
      { role: 'user', content: prompt }
    ], true).then(function (content) {
      var result = parseJsonObject(content);
      var emotion = D.EMOTIONS[result.emotion] ? result.emotion : fallback.emotion;
      if (!result.summary || !result.body) throw new Error('日记内容不完整');
      return {
        date: TODAY,
        emotion: emotion,
        mix: emotion === 'mixed' && Array.isArray(result.mix) ? result.mix.slice(0, 2) : null,
        summary: String(result.summary).slice(0, 80),
        body: String(result.body),
        fragments: fragments,
        generatedAt: state.settings.genTime,
        favorite: fallback.favorite || false,
        generated: true
      };
    }).catch(function () {
      toast('日记生成暂不可用，已使用本地整理。');
      return fallback;
    });
  }

  function runGeneration() {
    var fallback = ensureTodayEntry();
    if (hasLlmConfig() && state.messages.some(function (m) { return m.role === 'user'; })) {
      toast('阿页正在整理今天的片段…');
      generateEntryWithLlm(fallback).then(function (entry) {
        state.entries[TODAY] = entry;
        save();
        presentGeneration(entry);
      });
      return;
    }
    presentGeneration(fallback);
  }

  function presentGeneration(entry) {
    var emo = entryEmotion(entry);
    var n = (entry.fragments || []).length;
    var d = D.parseKey(TODAY);
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var layer = el(
      '<div class="gen-layer em-' + emo + '">' +
        '<div class="gen-inner">' +
          '<button class="gen-skip" data-gen-skip>跳过</button>' +
          '<div class="gen-stage">' +
            '<div class="gen-sheet" data-gen-sheet>' +
              '<span class="gen-sheet-date">' + D.shortCN(d) + ' ' + D.weekdayCN(d) + '</span>' +
              '<i></i><i></i><i></i><i></i>' +
            '</div>' +
            '<div class="gen-preview" data-gen-preview>' +
              '<div class="gp-top"><span class="gp-date">' + D.monthDayCN(d) + ' · ' + D.weekdayCN(d) + '</span>' + emChip(emo, entry.mix, 18) + '</div>' +
              '<p class="gp-summary">' + esc(entry.summary) + '</p>' +
              '<p class="gp-meta">' + n + ' 段心事 · ' + esc(entry.generatedAt) + ' 成稿</p>' +
            '</div>' +
          '</div>' +
          '<h2 class="gen-title" data-gen-title>正在把今天收进书页</h2>' +
          '<p class="gen-sub" data-gen-sub>今天收下了 ' + n + ' 段心事。</p>' +
          '<div class="gen-actions" data-gen-actions>' +
            '<button class="btn btn-primary btn-block" data-gen-open>翻开今天的这一页</button>' +
            '<button class="btn btn-text" data-gen-close>先放在这里</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    layerRoot.appendChild(layer);
    document.body.style.overflow = 'hidden';

    var done = false;
    function closeLayer() {
      document.body.style.overflow = '';
      layer.style.transition = 'opacity 200ms ease';
      layer.style.opacity = '0';
      setTimeout(function () { layer.remove(); }, 220);
    }
    function phaseTwo() {
      if (done) return;
      done = true;
      var sheet = $('[data-gen-sheet]', layer);
      var title = $('[data-gen-title]', layer);
      var sub = $('[data-gen-sub]', layer);
      var preview = $('[data-gen-preview]', layer);
      var actions = $('[data-gen-actions]', layer);
      var skip = $('[data-gen-skip]', layer);
      if (sheet) sheet.classList.add('is-done');
      if (title) title.textContent = '今天的这一页，写好了。';
      if (sub) sub.textContent = D.monthDayCN(d) + ' · ' + D.weekdayCN(d) + ' · ' + entry.generatedAt + ' 成稿';
      if (preview) preview.classList.add('is-on');
      if (actions) actions.classList.add('is-on');
      if (skip) skip.style.display = 'none';
    }

    $('[data-gen-skip]', layer).addEventListener('click', phaseTwo);
    $('[data-gen-close]', layer).addEventListener('click', function () {
      closeLayer();
      toast('收好了，在日历里。');
    });
    $('[data-gen-open]', layer).addEventListener('click', function () {
      closeLayer();
      navigate('/diary/' + TODAY);
    });

    if (reduced) phaseTwo();
    else setTimeout(phaseTwo, 1450);
  }


  /* ============================================================
     OPENING · 推开书封（canvas 纸页卷曲）
     ============================================================ */
  function showSplash() {
    if ($('.cover-wrap')) return;
    var appEl = $('.app');
    var now = new Date();
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var wrap = el(
      '<div class="cover-wrap">' +
        '<div class="cover" role="button" tabindex="0" aria-label="向左推开书封，进入拾页日记">' +
          '<div class="cover-bg" aria-hidden="true"></div>' +
          '<canvas class="cover-canvas" aria-hidden="true"></canvas>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(wrap);
    document.body.classList.add('cover-open');
    if (appEl) appEl.inert = true;

    var cover = $('.cover', wrap);
    var canvas = $('.cover-canvas', wrap);
    var veil = $('.cover-bg', wrap);
    var ctx = canvas.getContext('2d');

    /* 封面皮革：加载完成后重画一次；加载前后都用深棕纸色兜底 */
    var leather = new Image();
    leather.src = 'assets/leather-cover.jpg';
    leather.onload = function () {
      if (removed) return;
      build();
      render(progress);
    };

    var W = 1, H = 1, DPR = 1, SRC = null;
    var safeTop = 0, safeBottom = 0;
    var progress = 0;
    var removed = false;
    var animRaf = null;
    var drag = null;
    var suppressClick = false;
    var lastDragEnd = 0;
    var RAD = Math.PI / 180;
    var SERIF = '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif';
    var SANS = '-apple-system,"PingFang SC","HarmonyOS Sans SC","Noto Sans SC","Microsoft YaHei",sans-serif';

    var LEAF = null, VEIN = null;
    try {
      LEAF = new Path2D('M19.2 4.8c-8.2 0-13.2 4-13.2 10a4.2 4.2 0 0 0 4.2 4.2c6 0 9-5 9-14.2z');
      VEIN = new Path2D('M6 19c2.1-4.1 5.1-7 9.2-9.2');
    } catch (e) { /* ignore */ }

    function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

    function setFont(c, weight, size, family, spacing) {
      c.font = weight + ' ' + size + 'px ' + family;
      try { c.letterSpacing = (spacing || 0) + 'px'; } catch (e) { /* ignore */ }
    }

    function drawLeaf(c, x, y, size, color) {
      if (!LEAF) return;
      c.save();
      c.translate(x, y);
      c.scale(size / 24, size / 24);
      c.strokeStyle = color;
      c.lineWidth = 1.6 * 24 / size;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.stroke(LEAF);
      if (VEIN) c.stroke(VEIN);
      c.restore();
    }

    function measureSafe() {
      var t = document.createElement('div');
      var b = document.createElement('div');
      t.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;';
      b.style.cssText = 'position:absolute;bottom:0;left:0;width:1px;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;';
      cover.appendChild(t);
      cover.appendChild(b);
      safeTop = t.getBoundingClientRect().height || 0;
      safeBottom = b.getBoundingClientRect().height || 0;
      t.remove();
      b.remove();
    }

    function drawCover(c, w, h) {
      if (leather.complete && leather.naturalWidth) {
        var iw = leather.naturalWidth;
        var ih = leather.naturalHeight;
        var s = Math.max(w / iw, h / ih);
        var dw = iw * s;
        var dh = ih * s;
        c.drawImage(leather, (w - dw) / 2, (h - dh) / 2, dw, dh);
        /* 压暗并保留一点皮革暖色，保证奶白字的对比 */
        var dg = c.createRadialGradient(w * .18, 0, 0, w * .18, 0, Math.max(w * 1.2, h * .78));
        dg.addColorStop(0, 'rgba(30,18,10,.46)');
        dg.addColorStop(.52, 'rgba(20,12,7,.62)');
        dg.addColorStop(1, 'rgba(10,6,3,.78)');
        c.fillStyle = dg;
        c.fillRect(0, 0, w, h);
        c.fillStyle = 'rgba(74,36,14,.09)';
        c.fillRect(0, 0, w, h);
      } else {
        var g = c.createRadialGradient(w * .18, 0, 0, w * .18, 0, Math.max(w * 1.2, h * .78));
        g.addColorStop(0, '#4B3625');
        g.addColorStop(.52, '#362619');
        g.addColorStop(1, '#241A11');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      }

      var sp = c.createLinearGradient(0, 0, 18, 0);
      sp.addColorStop(0, 'rgba(0,0,0,.42)');
      sp.addColorStop(.58, 'rgba(0,0,0,.10)');
      sp.addColorStop(1, 'rgba(255,255,255,.03)');
      c.fillStyle = sp;
      c.fillRect(0, 0, 18, h);

      c.strokeStyle = 'rgba(217,201,180,.16)';
      c.lineWidth = 1;
      c.strokeRect(16.5, 16.5, w - 33, h - 33);

      var rowY = safeTop + 24 + 7.5;
      drawLeaf(c, 30, rowY - 7.5, 15, 'rgba(212,231,218,.75)');
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      setFont(c, '400', 12, SANS, 1.9);
      c.fillStyle = 'rgba(244,236,220,.7)';
      c.fillText('拾页日记', 53, rowY);
      c.textAlign = 'right';
      setFont(c, '400', 9.5, SANS, 2.1);
      c.fillStyle = 'rgba(244,236,220,.62)';
      c.fillText('SHIYE', w - 30, rowY);

      var titleSize = Math.min(38, Math.max(30, w * .09));
      var lineH = titleSize * 1.35;
      var y0 = h * .40;
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      setFont(c, '400', 11, SANS, 2.86);
      c.fillStyle = 'rgba(244,236,220,.55)';
      c.fillText('黄昏旧书店', 30, y0);

      setFont(c, '500', titleSize, SERIF, .4);
      c.fillStyle = '#F4ECDC';
      c.fillText('把今天，', 30, y0 + 52);
      c.fillStyle = '#D9C9B4';
      c.fillText('夹进书页里。', 30, y0 + 52 + lineH);

      var ruleY = y0 + 52 + lineH + titleSize * .62 + 18;
      c.fillStyle = 'rgba(192,138,78,.9)';
      c.fillRect(30, ruleY, 44, 2);

      setFont(c, '400', 12, SANS, .96);
      c.fillStyle = 'rgba(244,236,220,.6)';
      c.fillText(now.getFullYear() + ' 年 ' + D.monthDayCN(now) + ' · ' + D.weekdayCN(now), 30, ruleY + 24);

      var stampCX = w - 110;
      var stampCY = h - safeBottom - 134;
      c.strokeStyle = 'rgba(244,236,220,.16)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(stampCX, stampCY, 68, 0, Math.PI * 2);
      c.stroke();
      drawLeaf(c, stampCX - 28, stampCY - 28, 56, 'rgba(244,236,220,.16)');

      var footY = h - safeBottom - 26;
      c.strokeStyle = 'rgba(244,236,220,.62)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(45, footY);
      c.lineTo(30, footY);
      c.moveTo(35, footY - 4);
      c.lineTo(30, footY);
      c.lineTo(35, footY + 4);
      c.stroke();
      c.textBaseline = 'middle';
      setFont(c, '400', 12, SANS, .96);
      c.fillStyle = 'rgba(244,236,220,.62)';
      c.fillText('向左推开', 54, footY);
    }

    function build() {
      var r = cover.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      DPR = Math.min(2, window.devicePixelRatio || 1);
      measureSafe();
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      SRC = document.createElement('canvas');
      SRC.width = canvas.width;
      SRC.height = canvas.height;
      var sc = SRC.getContext('2d');
      sc.setTransform(DPR, 0, 0, DPR, 0, 0);
      drawCover(sc, W, H);
      ctx = canvas.getContext('2d');
    }

    /* 每根 2px 列按柱面卷曲重新投影；cos>0 画封面，cos<0 画米色封内 */
    function render(p) {
      progress = clamp(p, 0, 1);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      veil.style.opacity = String(Math.max(0, 1 - progress * 4));

      var curl = Math.sin(Math.PI * progress);
      var theta = Math.min(0, -180 * progress + 90 * curl);
      var bend = -180 * progress - theta;
      var N = Math.max(80, Math.round(W / 2));
      var d = 2200;
      var cy = H / 2;
      var angs = new Array(N + 1);
      var scales = new Array(N + 1);
      var XS = new Array(N + 1);
      angs[0] = theta * RAD; scales[0] = 1; XS[0] = 0;
      var x = 0, z = 0;
      for (var i = 1; i <= N; i++) {
        var u0 = (i - 1) / N;
        var u1 = i / N;
        var um = (u0 + u1) / 2;
        var am = (theta + bend * um * um) * RAD;
        x += W * Math.cos(am) / N;
        z += -W * Math.sin(am) / N;
        var a = (theta + bend * u1 * u1) * RAD;
        var s = d / (d - z);
        angs[i] = a;
        scales[i] = s;
        XS[i] = x * s;
      }

      var maxX = 0;
      for (i = 0; i <= N; i++) if (XS[i] > maxX) maxX = XS[i];

      var hinge = .34 * (1 - progress);
      if (hinge > .01) {
        var hg = ctx.createLinearGradient(0, 0, 150, 0);
        hg.addColorStop(0, 'rgba(24,16,9,' + hinge.toFixed(3) + ')');
        hg.addColorStop(1, 'rgba(24,16,9,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(0, 0, 150, H);
      }
      var lead = .22 * curl;
      if (lead > .01 && maxX > 0 && maxX < W) {
        var lg = ctx.createLinearGradient(maxX, 0, Math.min(W, maxX + 130), 0);
        lg.addColorStop(0, 'rgba(24,16,9,' + lead.toFixed(3) + ')');
        lg.addColorStop(1, 'rgba(24,16,9,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(maxX, 0, Math.min(W, maxX + 130) - maxX, H);
      }

      var back = ctx.createLinearGradient(0, 0, 0, H);
      back.addColorStop(0, '#F5EDDE');
      back.addColorStop(1, '#E9DDC8');

      var srcStep = (W / N) * DPR;
      var ov = 1 / DPR;
      for (i = 0; i < N; i++) {
        var X0 = XS[i], X1 = XS[i + 1];
        var dw = Math.abs(X1 - X0);
        if (dw < .08) continue;
        var dx = Math.min(X0, X1);
        var ds = (scales[i] + scales[i + 1]) / 2;
        var dy = cy - cy * ds;
        var dh = H * ds;
        var extra = i < N - 1 ? ov : 0;
        var cosA = Math.cos(angs[i]);
        if (cosA > 0.25) {
          var srcX = i * srcStep;
          var srcW = Math.min(srcStep + 1, SRC.width - srcX);
          ctx.drawImage(SRC, srcX, 0, srcW, SRC.height, dx, dy, dw + extra, dh);
          var sh = .55 * (1 - cosA);
          if (sh > .005) {
            ctx.fillStyle = 'rgba(0,0,0,' + sh.toFixed(3) + ')';
            ctx.fillRect(dx, dy, dw + extra, dh);
          }
          /* 卷曲面上的一条暖高光，让弯过去的纸面被看见 */
          var spec = Math.exp(-Math.pow((cosA - .55) / .18, 2)) * .12;
          if (spec > .004) {
            ctx.fillStyle = 'rgba(255,238,210,' + spec.toFixed(3) + ')';
            ctx.fillRect(dx, dy, dw + extra, dh);
          }
        } else {
          ctx.fillStyle = back;
          ctx.fillRect(dx, dy, dw + extra, dh);
          var bs = .08 + .16 * (1 + cosA);
          ctx.fillStyle = 'rgba(0,0,0,' + bs.toFixed(3) + ')';
          ctx.fillRect(dx, dy, dw + extra, dh);
        }
      }

      var fe = XS[N];
      if (fe > -2 && fe < W + 2) {
        var fcos = Math.cos(angs[N]);
        ctx.fillStyle = fcos >= 0 ? 'rgba(246,238,225,.18)' : 'rgba(60,45,30,.14)';
        var fy = cy - cy * scales[N];
        ctx.fillRect(fe - .75, fy, 1.5, H * scales[N]);
      }
    }

    function tearDown() {
      document.body.classList.remove('cover-open');
      if (appEl) appEl.inert = false;
      window.removeEventListener('resize', onResize);
    }
    function finish() {
      if (removed) return;
      removed = true;
      cover.style.pointerEvents = 'none';
      tearDown();
      render(1);
      setTimeout(function () { if (document.contains(wrap)) wrap.remove(); }, 60);
    }
    function cancelAnim() {
      if (animRaf) { cancelAnimationFrame(animRaf); animRaf = null; }
    }
    function animateTo(target) {
      cancelAnim();
      var from = progress;
      if (reduced) {
        if (target === 1) {
          tearDown();
          wrap.style.transition = 'opacity 160ms ease';
          wrap.style.opacity = '0';
          setTimeout(function () { wrap.remove(); }, 190);
        } else {
          render(0);
        }
        return;
      }
      if (target === 1) tearDown();
      var start = performance.now();
      var dur = target === 1 ? 640 : 340;
      function frame(t) {
        var k = clamp((t - start) / dur, 0, 1);
        var e = 1 - Math.pow(1 - k, 3);
        render(from + (target - from) * e);
        if (k < 1) {
          animRaf = requestAnimationFrame(frame);
        } else {
          animRaf = null;
          if (target === 1) finish();
        }
      }
      animRaf = requestAnimationFrame(frame);
    }
    function onResize() {
      if (removed) return;
      build();
      render(progress);
    }

    cover.addEventListener('pointerdown', function (e) {
      if (removed) return;
      if (e.button != null && e.button !== 0) return;
      cancelAnim();
      if (reduced) return;
      try { cover.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      drag = {
        id: e.pointerId, x: e.clientX, startP: progress,
        lastX: e.clientX, lastT: performance.now(), v: 0, moved: false
      };
      cover.classList.add('is-dragging');
    });
    cover.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6) drag.moved = true;
      var raw = drag.startP - dx / W;
      render(raw < 0 ? 0 : raw);
      var now2 = performance.now();
      drag.v = (e.clientX - drag.lastX) / Math.max(1, now2 - drag.lastT);
      drag.lastX = e.clientX;
      drag.lastT = now2;
    });
    function endDrag() {
      if (!drag) return;
      var d = drag;
      drag = null;
      cover.classList.remove('is-dragging');
      if (d.moved) {
        suppressClick = true;
        lastDragEnd = performance.now();
        setTimeout(function () { suppressClick = false; }, 0);
      }
      if (reduced) { render(0); return; }
      animateTo((progress > .35 || d.v < -.55) ? 1 : 0);
    }
    cover.addEventListener('pointerup', endDrag);
    cover.addEventListener('pointercancel', endDrag);
    cover.addEventListener('lostpointercapture', endDrag);
    cover.addEventListener('click', function (e) {
      if (suppressClick || performance.now() - lastDragEnd < 350) { e.stopPropagation(); return; }
      animateTo(1);
    });
    cover.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); animateTo(1); }
    });
    window.addEventListener('resize', onResize);

    build();
    render(0);
    try { cover.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }


  /* ============================================================
     BOOT
     ============================================================ */
  document.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-nav]');
    if (!nav) return;
    e.preventDefault();
    var id = nav.getAttribute('data-nav');
    var current = (location.hash.replace(/^#\/?/, '').split('/')[0] || 'chat');
    if (id === current) {
      /* 再点当前 tab：对话回到最新，其他页回到顶部 */
      if (id === 'chat') {
        scrollBottom(true);
      } else {
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      }
      return;
    }
    navigate('/' + id);
  });

  window.addEventListener('hashchange', function () {
    if (location.hash !== lastRenderedHash) render();
  });
  window.addEventListener('popstate', function () {
    if (location.hash !== lastRenderedHash) render();
  });

  if (!location.hash) history.replaceState(null, '', '#/chat');
  buildTabbar();
  render();
  checkDueGeneration();
  if (!sessionStorage.getItem('shiye.splash.seen')) {
    sessionStorage.setItem('shiye.splash.seen', '1');
    showSplash();
  }
})();
