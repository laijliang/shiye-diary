# 阿页角色形象生成需求 / Ayeh Mascot Art Brief

> 用途：拾页日记 App 内置角色。会出现在 **头像（28px）**、**聊天空态（108px）**、**个人页（62px）** 三处；需要 5 种表情。背景透明。请把这份文件直接发给画师 / 生图工具。
>
> **状态（2026-11-21）**：已按本需求生成并接入。实际交付中 listen / reply / thinking 为透明 PNG，sleepy / happy 为黑底图，已统一抠图、裁到 640×800 并底部对齐。若重新生成，请尽量一次出五张同批次，保证身体比例完全一致。

---

## 一、角色设定（一定要讲清楚的部分）

**阿页**：黄昏旧书店的年轻守书人，本体是一页奶油色纸张变成的小精灵。性格温柔、安静、有点困但可靠。

固定不变的元素（每个表情都必须有）：

1. **折角**：右上角折下来一个纸角（dog-ear fold）。
2. **书签腰带**：腰间一条焦糖色（dusk orange）书签带，带子左端垂下一截燕尾书签（下端有 V 形缺口）。
3. **嫩芽**：头顶冒出一株小小的绿叶芽。
4. **脸颊红晕**：两侧各一点淡淡的晚霞色。
5. **纸页的厚度**：身体像一页纸，右侧有一层很浅的阴影，底部有一点内阴影，看起来有正反两层纸的厚度，不是一块平板。

## 二、画风（风格关键词）

- **扁平插画 + 2~3 层柔和阴影**：不要厚涂、不要 3D 渲染、不要黑色描边、不要拟真照片。
- 圆润、安静、温暖；线条是深棕墨色细线（不是黑粗线）。
- **必须能缩到 28px 还认得出**：折角、腰带、脸的轮廓要清楚（做头像时先缩一下看）。
- 参考色板（尽量贴近）：
  - 纸面 #FFFDF6 → #F3E8D2（身体渐变）
  - 纸背 / 折角 #E9DCC1
  - 墨色线条 #211C15
  - 书签腰带 #CF9653 → #A66F2E，燕尾 #B37E3C
  - 嫩芽 #5E8F71 / #93C2A7
  - 红晕 #C08A4E（约 30% 透明度）
  - 树皮棕（如需重色）#3A2A1C

## 三、5 种表情（身体完全一致，只改五官）

| 表情 | 文件名 | 五官 |
|---|---|---|
| 听 listen | `ayeh-listen.png` | 闭眼（两条向下的弧线）+ 温和微笑 + 红晕 |
| 应答 reply | `ayeh-reply.png` | 睁眼（两个墨色圆点）+ 微笑 + 红晕 |
| 思考 thinking | `ayeh-thinking.png` | 左眼睁、右眉挑起 + 嘴抿成一条直线 |
| 困 sleepy | `ayeh-sleepy.png` | 闭眼 + 小口 + 头顶右上方一个手写体「Z」 |
| 高兴 happy | `ayeh-happy.png` | 弯弯的笑眼（向上拱）+ 大笑 + 一个小闪光点 |

表情之外的所有部分（折角、腰带、燕尾、嫩芽、厚度、红晕、身体轮廓）**五张必须一模一样**。

## 四、交付格式

- 5 张**透明背景 PNG**，每张 **1024 × 1280**，角色完整居中，四周留 40px 安全边距，燕尾书签不能被裁掉。
- 或者一张横排 sprite：**5120 × 1280**（五帧，顺序按上表），并附每帧宽 1024 的说明。
- 不要背景、不要文字、不要 logo、不要水印。
- 若用 AI 生图：先生成一张主形象（listen），确认后**以同一张图为底**做 5 个表情（局部重绘 / 表情编辑），保证身体一致。

## 五、可直接使用的英文 Prompt

> A cute minimal flat-illustration mascot for a diary app: a small paper-page spirit with a folded dog-ear corner at the top right, a caramel-orange bookmark-ribbon sash around its waist with a swallow-tail bookmark hanging down on the left, and a tiny green sprout on top of its head. Cream paper body with a soft vertical gradient (#FFFDF6 to #F3E8D2), thin dark-brown ink facial lines (#211C15), dusk-orange sash (#CF9653 to #A66F2E), sage green sprout (#5E8F71), light dusk-orange blush on both cheeks. Flat vector illustration with 2-3 soft shading tones, no black outlines, no background, full body, centered, transparent background. Gentle closed eyes with a soft smile and light blush. Character sheet with 5 expressions of the SAME body: listening (closed eyes, soft smile), replying (open dot eyes, smile), thinking (one open eye, one raised brow, flat mouth), sleepy (closed eyes, small mouth, a handwritten "Z" floating at the upper right), happy (upward arched eyes, big smile, a tiny sparkle). Clean readable silhouette even at 28px.

## 六、给我的时候先自查（Quality checklist）

1. 五张表情的身体轮廓叠起来完全重合（可以用图层叠看）。
2. 透明背景没有白边、没有半透明杂色。
3. 缩到 28×35px 后，还能认出「折角 + 腰带 + 脸」。
4. 燕尾书签完整，没有被画布裁掉。
5. 颜色贴上面的色板（或至少明度、色相接近），不要荧光色。

> 拿到图后我可以直接接进代码（替换掉现在的矢量版 `js/mascots.js` 里的 `ayeh()`），大概半小时就能换好并适配三种尺寸。
