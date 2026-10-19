/* 中文 for TT Mini Golf: the words on the page, the toasts, the scorecard and the ? panel (Kit.lang, from kit/lang.js).
   The kids' names and the game's name stay in English on purpose. There is no canvas text to translate: the flags
   only show the hole's number. */
(function () {
  const L = Kit.lang;
  L.keep(['TT Mini Golf', 'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'Claude Code', 'P · Esc', 'Esc']);

  const HOLES = {
    'Hello Green': '你好草坪', 'Dog Leg': '狗腿弯道', 'Up the Ramp': '爬上坡道', 'Bumper Garden': '蘑菇弹弹园', 'Sandy Snake': '沙坑蛇形道',
    'Windmill': '大风车', 'Bridge': '移动小桥', 'Tunnel Hill': '山洞小山', 'Loop-the-Loop': '大回环',
  };
  L.add(HOLES);
  L.add({
    // title screen
    'Drag back from the ball and let go to putt! Call your brother for a tip.': '从球往后拉，松手就推杆！还可以叫兄弟来出主意。',
    'How many players': '几个人玩', 'YOUR GOLFER': '你的球手', 'Previous': '上一个', 'Next': '下一个', 'How hard': '难度',
    '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通', 'Course': '球场', '🌻 SUNNY GARDEN': '🌻 阳光花园', 'ZOMBIE': '僵尸',
    '🖱️ drag back from the ball, let go to putt': '🖱️ 从球往后拉，松手推杆',
    'aim, hold': '瞄准，按住', 'for power': '蓄力', 'call your brother': '叫兄弟来帮忙', 'whole hole': '看整个球洞',
    '👆 drag back from the ball and let go, or tap where to go and hold': '👆 从球往后拉再松手；或者点一下要去的地方，再按住',
    'LOADING…': '加载中…',
    // HUD
    'See the whole hole (C)': '看整个球洞 (C)', 'Restart the hole (R)': '重打这个球洞 (R)', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'POWER': '力量', 'Call your brother (T)': '叫兄弟来帮忙 (T)',
    // toasts
    'HOLE IN ONE!': '一杆进洞！', 'IN THE HOLE!': '进洞啦！', 'SUPER SHOT!': '超级好球！', 'EAGLE!': '老鹰球！', 'BIRDIE!': '小鸟球！', 'PAR!': '标准杆！',
    'GOOD TRY! IN IT GOES!': '打得好努力！帮你放进去啦！', 'TEN STROKES: IN IT GOES!': '已经 10 杆：帮你放进去啦！',
    'SPLASH! +1': '扑通！罚 1 杆', 'AROUND THE LOOP!': '转了一大圈！', 'MORE POWER!': '再用力一点！', 'START THE HOLE AGAIN': '重新打这个球洞',
    // pause and the scorecard
    '🏠 MENU': '🏠 菜单', 'HOLE': '球洞', 'PAR': '标准杆', 'TOTAL': '总杆数', '▶ NEXT HOLE': '▶ 下一个球洞', '🏆 SEE THE SCORES': '🏆 看成绩',
    'GREAT ROUND!': '打得真棒！', "IT'S A TIE!": '平手！', '↻ PLAY AGAIN': '↻ 再玩一次',
    // the ? panel (js/keys.js)
    'aim': '瞄准', 'aim a tiny bit': '微微调整瞄准', 'putt: hold for power, let go': '推杆：按住蓄力，松开就打',
    'call your brother for a tip': '叫兄弟来出主意', 'see the whole hole': '看整个球洞', 'start the hole again': '重打这个球洞',
    'start · next hole': '开始 · 下一个球洞',
    'Mouse: drag back from the ball like a slingshot and let go. 2 players take turns on the same keys.': '鼠标：像弹弓一样从球往后拉，再松开。两个人轮流用同一套按键。',
    "Drag back from the ball and let go to putt: further back is harder. Or tap where to go, then hold and let go. Tap your brother's face (bottom right) for a tip.":
      '从球往后拉，松手就推杆：拉得越远打得越用力。也可以点一下要去的地方，再按住、松开。点右下角兄弟的头像，让他来出主意。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const POWER = { SOFT: '轻轻的', MEDIUM: '中等力气', HARD: '用力', 'SUPER HARD': '超级用力' };
  L.rule(/^HOLE (\d+)$/, '第 $1 洞');
  L.rule(/^HOLE (\d+) DONE!$/, '第 $1 洞完成！');
  L.rule(/^PAR (\d+)$/, '标准杆 $1');
  L.rule(/^\/ (\d+)$/, '/ $1');
  L.rule(/^PLAYER (\d)$/, '玩家 $1');
  L.rule(/^(.+)'S BEST$/, (m, who) => `${L.t(who)} 的最好成绩`);
  L.rule(/^(.+)'S TURN!$/, '轮到 $1 啦！');
  L.rule(/^(.+) WINS!$/, '$1 赢啦！');
  L.rule(/^(.+) IS HERE!$/, '$1 来啦！');
  L.rule(/^⭐ (\d+) × HOLE IN ONE!$/, '⭐ $1 次一杆进洞！');
  L.rule(/^Call (.+) for a tip \(T\)$/, '叫 $1 来出主意 (T)');
  L.rule(/^(.+) SAYS: AIM HERE, (SOFT|MEDIUM|HARD|SUPER HARD)!$/, (m, who, pw) => `${who} 说：往这里打，${POWER[pw]}！`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, emoji, item, who) => `${emoji} ${who} 送来的${TREAT[item]}！`);
})();
