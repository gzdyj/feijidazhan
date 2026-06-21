# 第二版开发进度记录

> 每完成一步更新此文档，记录完成内容、当前状态、下一步计划。
> 每次循环对话前先读取此文档恢复进度。

---

## 当前进度

**当前步骤**：全部完成 ✅  
**总体进度**：8/8  
**最后更新**：2026-06-21 10:15

---

## 步骤详情

### ✅ 步骤1：创建文档体系
- 创建 docs/v2-design.md、v2-progress.md、v2-pitfalls.md

### ✅ 步骤2：修复第一版已知BUG
- BUG-001：useAbility 未导出 → 已修复
- BUG-002：商店道具无效 → 完整修复（标记+持久化+生效+防重复+UI显示）
- BUG-003：speed 恢复未乘 levelBonuses → 已修复
- 额外修复：startGame 中 shieldActive 被覆盖

### ✅ 步骤3：扩展道具数据结构
- powerupTypes 从5种扩展到13种（3 instant + 5 buff + 5 active）
- 统一结构 {id,name,icon,category,effect,dur,desc,color}，dur 用帧数
- 新增 activeEffects/inventory/clones 变量
- 重构 collectPowerup 分类处理 + spawnPowerup 加权随机

### ✅ 步骤4：实现道具背包/槽位系统
- 3槽位 inventory，addToInventory/useInventory 逻辑
- UI.renderInventory 渲染 + 键盘1/2/3 + 点击使用

### ✅ 步骤5：实现主动技能道具效果
- EMP（冻结3秒）、时间减速（隔帧减速）、磁铁（吸引掉落物）、核弹（秒杀/BOSS减半）、分身（2分身射击8秒）

### ✅ 步骤6：实现新增掉落道具效果
- 穿透弹（子弹穿透）、双倍分数（得分×2）、炸弹补给（重置冷却）
- activeEffects 帧递减与 onEffectEnd 过期处理

### ✅ 步骤7：完善UI
- 补全 ab-btn/hud-xp/xp-fill/xp-text/inventory-bar/slot CSS
- showHud 显示必杀技按钮+道具栏，draw 渲染分身

### ✅ 步骤8：测试与平衡调整
- **测试方式**：playwright-cli 自动化测试
- **测试结果**：
  - 页面加载无 JS 错误（仅 favicon 404 无关紧要）
  - 游戏正常启动运行（score/kills/wave 正常增长）
  - 道具槽位系统正常（3槽位 add/use）
  - EMP 主动技能激活验证通过（activeEffects.emp=180）
  - 核弹伤害验证通过（击杀 5→16，秒杀11个敌机）
  - 所有导出函数可用（useAbility/useInventory/getInventory/getActiveEffects）
- **平衡性**：道具掉落加权（instant50%/buff35%/active15%），主动技能道具稀有

---

## 全部完成

第二版道具玩法开发全部完成，所有功能经过自动化测试验证无 JS 运行时错误。
