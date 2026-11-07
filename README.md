# 同词相遇 · 多人默契挑战

一个支持 **2–5 人远程参与** 的实时同词默契游戏。玩家可以根据提示主题开始，也可以自由说出一个词；之后根据每一轮出现的词继续联想，直到所有人说出同一个词。

## 🎮 在线游玩

### [立即开始游戏 →](https://tongci-moqi-challenge.wttwr.workers.dev)

无需注册。创建房间后，把房间号分享给朋友即可开始。

## 游戏玩法

1. 创建房间，选择 2–5 人、开局方式和每轮时间。
2. 把房间号分享给其他玩家。
3. 所有人同时提交一个词，答案会在全员完成后公开。
4. 如果答案不同，根据上一轮的词继续联想。
5. 所有人都点击“我准备好了”后进入下一轮，直到同词相遇。

## 主要功能

- 2–5 人实时远程房间
- 提示主题或自由开局
- 15、30、45、60 秒及不限时模式
- 跑步倒计时动画
- 全员确认后进入下一轮
- 未作答的轮次不会写入记录
- 新一轮自动清除上一轮输入
- 房间开始后可加入旁观
- 同词相遇后可再来一局或退出房间
- 同一房间的默契值跨局累计
- 手机、平板和桌面端自适应

## 技术栈

- Next.js 16 + React 19
- TypeScript
- Tailwind CSS
- Cloudflare Workers
- Cloudflare D1 + Drizzle ORM
- GitHub 自动部署

## 本地运行

需要 Node.js 22.13+ 和 pnpm。

```bash
git clone https://github.com/wttwr/tongci-moqi-challenge.git
cd tongci-moqi-challenge
pnpm install
pnpm dev
```

多人房间功能依赖名为 `DB` 的 Cloudflare D1 binding。数据库结构位于 [`db/schema.ts`](db/schema.ts)，迁移文件位于 [`drizzle/`](drizzle/)。

## 部署

项目已连接 GitHub 与 Cloudflare Workers。推送到 `main` 分支后，Cloudflare 会自动构建并发布最新版本。

```bash
pnpm run build
pnpm exec wrangler deploy --config dist/server/wrangler.json
```

---

**Live website:** https://tongci-moqi-challenge.wttwr.workers.dev
