/* 拾页日记 · 数据层（MVP 演示数据 + 模拟 AI） */
(function () {
  const EMOTIONS = {
    joy: { key: 'joy', label: '开心', adj: '亮起来', face: 'joy' },
    calm: { key: 'calm', label: '平静', adj: '安静', face: 'calm' },
    low: { key: 'low', label: '低落', adj: '慢一点', face: 'low' },
    anxious: { key: 'anxious', label: '焦虑', adj: '打结', face: 'anxious' },
    mixed: { key: 'mixed', label: '复杂', adj: '两种颜色', face: 'mixed' }
  };

  const ORDER = ['joy', 'calm', 'low', 'anxious', 'mixed'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function weekdayCN(d) { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]; }
  function monthDayCN(d) { return (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
  function shortCN(d) { return pad(d.getMonth() + 1) + '.' + pad(d.getDate()); }
  function monthLabel(d) { return d.getFullYear() + '.' + pad(d.getMonth() + 1); }
  function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
  function nowHM() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  /* ---------------- 种子日记 ---------------- */
  const SEEDS = [
    {
      offset: 0, emotion: 'calm',
      summary: '傍晚的风把窗吹开了一条缝，我什么也没做。',
      body: '今天没有发生什么特别的事。\n\n下午把桌子收拾了一遍，顺手给窗台的绿萝换了水。风从窗缝里进来，翻动了几页摊开的书，我没有去按住它。\n\n晚上煮了一碗面，热气把眼镜蒙住了一小会儿。这样安静的一天，也值得被记下来。',
      fragments: [
        { text: '今天好像什么都没干。', time: '18:20', important: false },
        { text: '风把书吹翻了，懒得去管。', time: '19:05', important: true },
        { text: '煮了一碗面，还挺好吃的。', time: '21:10', important: false }
      ]
    },
    {
      offset: -1, emotion: 'joy',
      summary: '那件拖了很久的事，今天终于做完了。',
      body: '拖了半个月的东西，今天一口气做完了。\n\n发出消息的那一刻，手心还是有点汗。过了几分钟，对面回了一个“好”，我盯着那个字看了很久，才慢慢笑出来。\n\n晚上奖励自己买了一块小蛋糕。奶油有点甜，但今天可以原谅。',
      fragments: [
        { text: '终于把那个东西交出去了。', time: '16:40', important: true },
        { text: '手心全是汗，等回复等了好久。', time: '17:02', important: false },
        { text: '买了块小蛋糕，奶油有点甜。', time: '20:30', important: false }
      ]
    },
    {
      offset: -2, emotion: 'low',
      summary: '有些委屈说不清楚，就先放在这里。',
      body: '今天有一阵子，很想找一个没有人的地方待着。\n\n其实也没有发生什么大事。只是别人随口的一句话，我在心里来回想了很多遍。越想越觉得自己没有被看见，又觉得为这点事难过，好像有点小题大做。\n\n回来的路上走得很慢。风有点凉，我把外套的拉链拉到了最上面。先这样吧，明天再说。',
      fragments: [
        { text: '今天有句话让我挺难受的。', time: '18:55', important: false },
        { text: '也说不清到底哪里委屈。', time: '19:20', important: true },
        { text: '走在路上，风有点凉。', time: '21:02', important: false }
      ]
    },
    {
      offset: -4, emotion: 'anxious',
      summary: '脑子里有很多声音，谁都不肯先停下来。',
      body: '明天的汇报还差最后一段，我盯着屏幕坐了很久，一个字也没写出来。\n\n脑子里有很多声音。有一个说“你根本讲不好”，有一个说“随便讲完就行了”，还有一个一直在数时间。它们挤在一起，谁都不肯先停。\n\n后来我关掉电脑，去阳台站了一会儿。楼下有人在遛狗，绳子在路灯下晃。我决定今晚先不写了，明早再说。',
      fragments: [
        { text: '明天要汇报，稿子还差一段。', time: '20:15', important: true },
        { text: '坐着半天，一个字没写。', time: '21:10', important: false },
        { text: '脑子里的声音太多了。', time: '21:40', important: false }
      ]
    },
    {
      offset: -6, emotion: 'mixed', mix: ['joy', 'low'],
      summary: '开心和难过挤在同一天，像两页贴在一起。',
      body: '上午收到一个好消息，下午又听到一件不太好的事。\n\n开心的时候，我甚至想给谁打个电话。可到了傍晚，那点高兴就像被谁悄悄抽走了。两件事明明是分开的，却在心里挤在同一页上。\n\n我没有强迫自己选一个心情。今天就是有点复杂，这样也可以。',
      fragments: [
        { text: '上午收到一个挺好的消息。', time: '11:20', important: false },
        { text: '下午又听说了一件不太好的事。', time: '16:40', important: true },
        { text: '说不上来今天到底算开心还是难过。', time: '21:05', important: false }
      ]
    },
    {
      offset: -9, emotion: 'calm',
      summary: '把旧衣服叠好，房间忽然大了一点。',
      body: '周末没有出门，把衣柜里的旧衣服翻出来重新叠了一遍。\n\n有几件很久没穿了，拿在手里还是会想起买它的时候。最后留下了一半，另一半装进袋子里，准备捐掉。房间没有变，但看起来忽然大了一点。\n\n晚上坐在空出来的那格柜子前，喝了杯温水。好像有些事情，也是可以这样慢慢腾出位置的。',
      fragments: [
        { text: '今天在家收拾衣柜。', time: '15:30', important: false },
        { text: '有几件旧衣服，一直没舍得扔。', time: '16:10', important: false },
        { text: '房间看起来大了一点。', time: '18:00', important: true }
      ]
    },
    {
      offset: -13, emotion: 'joy',
      summary: '路边那只橘猫今天让我摸了。',
      body: '下班回来的时候，那只橘猫又蹲在楼下的台阶上。\n\n我蹲下来，它看了我一眼，没有走。我伸手过去，它把脑袋往我手心里蹭了一下，毛有点粗糙，身体是暖的。我们就那样待了几分钟。\n\n上楼的时候，我一直在笑。今天也没有什么特别的，只是被一只猫允许靠近了一下。',
      fragments: [
        { text: '楼下那只橘猫今天没跑。', time: '18:40', important: true },
        { text: '它让我摸了，还蹭了我一下。', time: '18:45', important: false },
        { text: '上楼的时候一直在笑。', time: '18:50', important: false }
      ]
    },
    {
      offset: -17, emotion: 'low',
      summary: '一整天都在等一个不会来的消息。',
      body: '手机响了很多次，都是群消息。我把提示音调大，又调小，最后干脆把手机倒扣在桌上。\n\n到晚上，我终于确认那个消息不会来了。没有很生气，只是有点空。像是一直举着的手，突然不知道往哪里放。\n\n今天不想分析原因，也不想给自己打气。就当是下雨的一天吧。',
      fragments: [
        { text: '今天一直在看手机。', time: '17:30', important: false },
        { text: '其实在等一个人的消息。', time: '20:10', important: true },
        { text: '最后也没等到。', time: '22:00', important: false }
      ]
    },
    {
      offset: -21, emotion: 'anxious',
      summary: '明天要交的东西，还差最后一段。',
      body: '截止时间就在明天下午，我还差最后一段没有写完。\n\n越是到这个时候，越容易去做别的事。洗杯子、整理桌面、看一眼前几天没看完的视频。好像只要不坐到电脑前，那个“还没写完”就暂时不存在。\n\n十一点的时候，我还是坐下来了。写得不算好，但至少开始了。先交出去，再慢慢改吧。',
      fragments: [
        { text: '明天下午就截止了。', time: '19:20', important: false },
        { text: '我一直在拖，越拖越慌。', time: '21:15', important: true },
        { text: '十一点终于坐下写了。', time: '23:05', important: false }
      ]
    },
    {
      offset: -26, emotion: 'calm',
      summary: '雨下了一下午，我在窗边听完了一整张专辑。',
      body: '雨从中午开始下，一直到傍晚都没有停。\n\n我把椅子搬到窗边，戴上耳机，从头听一张很久没听的专辑。雨声在耳机外面，音乐在耳机里面，两种声音叠在一起，反而很安静。\n\n没有做什么正事。可是这样的下午，好像也不算浪费。',
      fragments: [
        { text: '今天下了一下午的雨。', time: '14:20', important: false },
        { text: '把一张旧专辑从头听了一遍。', time: '16:40', important: true },
        { text: '什么正事也没干。', time: '18:10', important: false }
      ]
    },
    {
      offset: -33, emotion: 'joy',
      summary: '第一次做的菜，居然没有翻车。',
      body: '照着视频做了一道菜，切菜的时候还很心虚。\n\n油下锅的时候溅了一下，我往后退了半步。最后端出来，颜色居然还不错，味道也说得过去。我拍了张照片，犹豫了很久，还是发给了家里。\n\n妈妈回了一句“看着挺香”。我盯着那四个字，觉得今天这顿饭做得挺值。',
      fragments: [
        { text: '今天第一次自己做了那道菜。', time: '19:10', important: false },
        { text: '油溅出来的时候吓我一跳。', time: '19:25', important: false },
        { text: '我妈说看着挺香。', time: '20:15', important: true }
      ]
    },
    {
      offset: -40, emotion: 'mixed', mix: ['calm', 'low'],
      summary: '见了很久没见的人，回来时心里空空的。',
      body: '和很久没见的朋友吃了顿饭，坐下的时候还有点拘谨。\n\n聊起以前的事，我们笑了好几次。可回来的地铁上，我忽然觉得有点空。好像见一面，反而更清楚地看见了这些年各自走远的部分。\n\n不知道下次见面是什么时候。今天先不想了。',
      fragments: [
        { text: '今天见了很久没见的朋友。', time: '18:30', important: false },
        { text: '聊天的时候还是挺开心的。', time: '20:10', important: false },
        { text: '回来的路上有点空。', time: '21:30', important: true }
      ]
    }
  ];

  function seedEntries() {
    const out = {};
    const today = new Date();
    SEEDS.forEach(function (s) {
      const d = addDays(today, s.offset);
      const key = dateKey(d);
      out[key] = {
        date: key,
        emotion: s.emotion,
        mix: s.mix || null,
        summary: s.summary,
        body: s.body,
        fragments: s.fragments,
        generatedAt: '22:30',
        favorite: false,
        seeded: true
      };
    });
    return out;
  }

  /* ---------------- 模拟 AI ---------------- */
  const AI_REPLIES = {
    joy: [
      '听起来，今天有一小块地方是亮的。',
      '那就把这件事夹在这一页里吧。',
      '我替你记着。开心的时候，不用急着说别的。',
      '嗯。这样的时刻，值得多停一会儿。'
    ],
    calm: [
      '嗯，我在听。',
      '这样普通的一天，也值得留下一页。',
      '风从门口进来的时候，我也听见了。',
      '不急。你想说多少，就留多少。'
    ],
    low: [
      '嗯。先不用把话说完整。',
      '这段话有点重，我接着。',
      '难过不用解释。放在这里就好。',
      '我不劝你快点好起来。今天可以先慢一点。'
    ],
    anxious: [
      '先坐一会儿。书店里现在很安静。',
      '这么多声音挤在一起，是会累的。',
      '不用马上想明白。我们可以一句一句来。',
      '我听见了。先把最响的那一个说出来，剩下的先放着。'
    ],
    mixed: [
      '同一天里装着两件事，不奇怪。',
      '开心和难过可以挨着放，书页也是这样。',
      '我先把它们都收下，晚点再慢慢理。',
      '不用急着选一个心情。今天就到这里也可以。'
    ]
  };

  const SUGGESTIONS = ['今天有点累', '有件小事想记下来', '帮我整理今天的日记'];

  const VOICE_SINGLE = [
    '今天下班的时候，天已经黑了，路边的桂花有点香。',
    '其实也没什么大事，就是突然觉得有点累。',
    '中午和同事吃饭，聊到一个很好笑的事，我笑了一路。',
    '明天有个汇报，我到现在还没想好第一句话怎么说。',
    '晚上回来的时候，看到楼下那只橘猫又蹲在台阶上。',
    '我好像把一件很小的事，在心里放了很久。',
    '今天有一件小事挺开心的，路过花店的时候，老板送了我一枝花。',
    '晚饭随便吃了点，现在坐在窗边，不太想动。'
  ];

  const VOICE_PAIRS = [
    ['今天开完会出来，天已经黑了。', '我在楼下站了一会儿，不想马上回家。'],
    ['有件事我想了很久，还是没想明白。', '不过说出来之后，好像轻了一点。'],
    ['今天有一件小事挺开心的。', '路过花店的时候，老板送了我一枝花。'],
    ['明天要交的东西还差一点。', '我坐了很久，一直在做别的事。'],
    ['今天在地铁上看到一个小孩在笑。', '莫名其妙地，我也跟着心情好了一点。']
  ];

  const VOICE_PARTIALS = [
    '今天下班的时候，天已经黑了……',
    '其实也没什么大事，就是……',
    '我好像把一件很小的事……',
    '今天有一件小事，想说一下……'
  ];

  function detectEmotion(text) {
    const t = text || '';
    if (/汇报|考试|截止|deadline|压力|焦虑|烦|担心|怕|慌|睡不着|生气|急死|来不及/.test(t)) return 'anxious';
    if (/难过|委屈|哭|累|失落|失败|孤独|想哭|没意思|空落落|不开心/.test(t)) return 'low';
    if (/开心|高兴|好事|喜欢|笑|顺利|完成|做完|奖励|好吃|可爱|轻松|升职|过了/.test(t)) return 'joy';
    if (/又.*又|一半|说不清|复杂|矛盾/.test(t)) return 'mixed';
    return 'calm';
  }

  function dominantEmotion(msgs) {
    if (!msgs || !msgs.length) return 'calm';
    const tally = { joy: 0, calm: 0, low: 0, anxious: 0, mixed: 0 };
    msgs.forEach(function (m) {
      if (m.role === 'user') tally[detectEmotion(m.text)] += 1;
    });
    let best = 'calm';
    let max = -1;
    ORDER.forEach(function (k) {
      if (tally[k] > max) { max = tally[k]; best = k; }
    });
    if (tally.joy > 0 && (tally.low + tally.anxious) > 0) return 'mixed';
    return best;
  }

  const GEN = {
    joy: {
      intro: '今天，有一件小事让我亮了很久。',
      close: '回房间的路上，我还在想它。原来开心不需要多大的理由，一小块就够了。'
    },
    calm: {
      intro: '今天没有发生什么大事。',
      close: '窗外的风还在，书也摊在原处。这样的一天，也值得被记下来。'
    },
    low: {
      intro: '今天有些话，说得很慢。',
      close: '我没有急着让自己好起来。难过的时候，先难过一会儿，也是可以的。'
    },
    anxious: {
      intro: '今天脑子里有很多声音。',
      close: '我试着把能说的先说出来，剩下的，明天再理。晚一点，灯会关掉，声音也会小下去。'
    },
    mixed: {
      intro: '今天装着两件不一样的事。',
      close: '开心和难过挨在一起，像两页贴得很紧的纸。我没有把它们分开，先这样收着吧。'
    }
  };

  const GEN_SUMMARY = {
    joy: '今天有一小块地方，是亮的。',
    calm: '平常的一天，也被好好收下了。',
    low: '有些话说不完整，就先放在这里。',
    anxious: '声音很多，但我一句一句说完了。',
    mixed: '两种心情挤在同一页里。'
  };

  function buildEntryFromMessages(msgs, prev) {
    const userMsgs = (msgs || []).filter(function (m) { return m.role === 'user' && m.text; });
    if (!userMsgs.length) return prev;
    const emo = dominantEmotion(userMsgs);
    const pieces = userMsgs.slice(-3).map(function (m) {
      return String(m.text).replace(/\s+/g, ' ').replace(/[。！？!?，,、；;：:]+$/, '');
    });
    const joined = pieces.join('。') + '。';
    const g = GEN[emo];
    const now = new Date();
    return {
      date: dateKey(now),
      emotion: emo,
      mix: emo === 'mixed' ? ['joy', 'low'] : null,
      summary: GEN_SUMMARY[emo],
      body: g.intro + '\n\n' + joined + '\n\n' + g.close,
      fragments: userMsgs.map(function (m) {
        return { text: m.text, time: m.time || nowHM(), important: !!m.important };
      }),
      generatedAt: nowHM(),
      favorite: false,
      generated: true
    };
  }

  window.SyData = {
    EMOTIONS: EMOTIONS,
    ORDER: ORDER,
    SEEDS: SEEDS,
    seedEntries: seedEntries,
    AI_REPLIES: AI_REPLIES,
    SUGGESTIONS: SUGGESTIONS,
    VOICE_SINGLE: VOICE_SINGLE,
    VOICE_PAIRS: VOICE_PAIRS,
    VOICE_PARTIALS: VOICE_PARTIALS,
    detectEmotion: detectEmotion,
    dominantEmotion: dominantEmotion,
    buildEntryFromMessages: buildEntryFromMessages,
    dateKey: dateKey,
    parseKey: parseKey,
    addDays: addDays,
    weekdayCN: weekdayCN,
    monthDayCN: monthDayCN,
    shortCN: shortCN,
    monthLabel: monthLabel,
    daysInMonth: daysInMonth,
    nowHM: nowHM,
    pad: pad
  };
})();
