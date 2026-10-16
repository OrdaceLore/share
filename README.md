# 乐换 · Music Exchange

中文音乐交换应用。React / Vinext 服务端路由，Cloudflare D1 持久化，Sites 身份认证。

## 规则
- 歌曲名称必填；音乐人、音乐链接、曲风/情绪标签、推荐语选填。
- 每推荐一首获得 1 次交换资格；每次消耗 1 次，收到 3 首不同的新歌。
- 对换到的歌评价：厌烦 0、无感 1、喜欢 3；奖励归歌曲推荐者。
- 每人每首只能评价一次，不可自评、重复推荐、重复收到同一歌曲。
- 编辑精选用于冷启动；不冒充用户投稿，不领取奖励，链接为音乐搜索。

## 推荐
评分偏好与交换奖励分开计算：喜欢 +1、厌烦 −1、无感 0；分享歌曲是弱正向信号。候选歌结合标签、音乐人及其他用户在相同歌曲上的评价。同好相似度按候选歌曲标签局部计算，并按共同评价数量收缩。A→B→C 两跳联系仅通过两个正向局部相似度传递，系数为 0.35，且 A 与 C 有直接负向关系时不传递。每组选两首预测较合适且有一定差异的歌曲，第三首从其余可行候选随机探索。过滤本人推荐与已收到歌曲。此版本使用显式标签，不分析音频；每次交换读取最近 20,000 条评分构建同好信号。

## 一致性
余额由推荐数 + 收到评价的奖励总和 - 成功交换数计算。兑换资格检查与写入在同一个 SQL INSERT 中完成；兑换与三条收歌记录使用 D1 原子 batch。唯一索引防止重复领取、重复评价和并发重复收歌。失败批次回滚，不扣资格。

## 开发
Node 22.13+（建议 Node 24 LTS）。

```sh
npm ci
npm run db:generate # 仅在修改 schema 后
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_*.sql
npm run dev
```

执行迁移时将通配符替换为实际文件名，每个迁移仅执行一次。开发服务器提供仅限 loopback 的 Sites 测试登录（Seedy），匿名只能浏览；正式环境身份由 Sites 可信代理注入。不要将服务直接暴露为允许客户端伪造身份头的独立服务。

## 发布
`.openai/hosting.json` 声明 Site ID 和 D1 DB。Sites 构建并应用 `drizzle/` 中的迁移。当前站点访问策略仍为私有，发布权限须由站点拥有者明确授权。代码已支持未来公开浏览音乐；提交、交换和评价始终需要登录。响应用 self/community 标记代替身份标识。平台提供登录和访问控制，不需自行维护 OAuth 密钥。

## 验证
`node --import tsx --test tests/recommendation.test.mjs tests/collaborative.test.mjs` 检查推荐行为；`python3 tests/ledger_test.py` 验证资格账本、幂等及回滚。`npx tsc --noEmit` 检查类型。
