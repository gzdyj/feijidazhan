# 星际猎手 - 飞机大战

一款使用 HTML5 Canvas 开发的经典飞机大战游戏，拥有现代化视觉风格和完整的盈利系统。

## 快速启动

### 方式一：Docker（推荐）

```bash
docker run -d -p 8080:80 --name feijidazhan smithgz/feijidazhan:latest
```

打开浏览器访问 http://localhost:8080 即可游玩。

### 方式二：直接打开

直接双击 index.html 在浏览器中打开即可。

## 游戏玩法

| 操作 | 说明 |
|---|---|
| 鼠标 | 移动鼠标控制战机，自动射击 |
| 键盘 | 方向键 / WASD 移动，Shift 加速 |
| 触屏 | 手指拖拽移动战机 |

- 自动射击，击落敌机获得分数
- 每波敌人清空后进入下一波，每 5 波出现 BOSS
- 击落敌机有概率掉落道具：
  - 双倍火力 - 武器升级
  - 护盾 - 免疫伤害
  - 生命 - 恢复一条命
  - 急速 - 提升移动速度
  - 金币 - 额外金币

## 功能特性

### 游戏系统
- 5 种战机：先锋号 → 掠食者 → 堡垒号 → 暗影 → 凤凰
- 5 种武器：基础 → 双发 → 散射 → 激光 → 弹幕
- BOSS 系统：每 5 波出现强力 BOSS
- 连击系统（Combo）：连续击落敌机获得额外加分
- 8 个成就：解锁条件各异
- 排行榜：本地保存前 10 名

### 视觉设计
- 深空暗色渐变背景 + 动态星群
- 毛玻璃面板（Glassmorphism）
- 粒子爆炸特效 + 舰船辉光
- 霓虹风格 UI 配色

### 盈利系统
- 看广告复活 — 战败后观看激励视频复活
- 看广告双倍金币 — 结算时翻倍收益
- 每日奖励看广告翻倍 — 50 → 100 金币
- VIP 月卡 (¥12/月) — 每日额外金币 + 双倍收益 + 专属战机
- 6480 金币礼包 (¥6) — 快速获取大量金币
- 新手礼包 (¥1) — 解锁基础战机 + 1000 金币

> 以上盈利功能已完整实现模拟逻辑，接入真实广告/支付 SDK 时仅需替换对应函数体。

## 技术栈

- 前端：纯 HTML5 + CSS3 + JavaScript（ES6+）
- 渲染：Canvas 2D
- 音效：Web Audio API（程序化合成）
- 存储：localStorage（进度 / 设置 / 排行榜）
- 部署：Docker + Nginx Alpine

## 项目结构

```
feijidazhan/
├── index.html        # 游戏入口（含 CSS + JS 内嵌）
├── Dockerfile        # Docker 构建文件
├── docker-compose.yml# Docker Compose 配置
├── README.md         # 本文档
├── .dockerignore     # Docker 忽略规则
├── nginx.conf        # Nginx 配置
├── css/
│   └── style.css     # 样式表
├── js/
│   ├── all.js        # 合并脚本
│   ├── audio.js      # 音效引擎
│   ├── game.js       # 核心游戏逻辑
│   ├── ui.js         # 界面管理
│   └── main.js       # 初始化入口
```

## Docker 部署

### 构建镜像

```bash
docker build -t smithgz/feijidazhan:latest .
```

### 运行容器

```bash
docker run -d -p 8080:80 --name feijidazhan smithgz/feijidazhan:latest
```

### Docker Compose

```bash
docker compose up -d
```

## 本地开发

无需构建工具，任何静态文件服务器均可：

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

## 许可

MIT License
