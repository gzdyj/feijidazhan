# 第三版踩坑日志

> 记录开发中遇到的异常、BUG、踩坑经验，避免重复踩坑。

---

## v2 遗留 BUG（本版已修复）

### BUG-v3-001：购买武器完全不生效 ✅ 已修复
- **位置**：`index.html` `buyWeapon()` + `startGame()`
- **现象**：花金币购买武器后，开始游戏武器仍是基础武器
- **原因**：`buyWeapon` 仅 `ownedWeapons.push(i)`，但 `startGame` 中 `weaponLevel=0` 写死，从未读取已购武器
- **修复方案**：新增 `currentWeapon` 持久化字段，`startGame` 中 `weaponLevel = currentWeapon`，购买后自动装备+增加"装备"按钮
- **经验**：商店购买类装备必须有"当前装备"状态，且开局逻辑要读取该状态

### BUG-v3-002：战机模型无差异 ✅ 已修复
- **位置**：`index.html` `draw()` 玩家绘制部分
- **现象**：5种战机外观完全相同，仅颜色不同
- **原因**：所有战机共用一套三角形绘制代码
- **修复方案**：抽离 `drawShip` 函数，按 shipIndex/shape 分支绘制不同外形
- **经验**：差异化装备必须有独立的渲染逻辑，不能只改颜色

---

## 开发中踩坑（持续记录）

### 踩坑-001：playwright-cli eval 同步读取 HUD 显示旧值
- **现象**：`setCurrentWeapon(3); startGame();` 后立即 eval 读 `weaponDisp` 显示"基础"，疑似武器未生效
- **原因**：startGame 同步设置了 `weaponLevel`，但 HUD 文本在 `update()`（requestAnimationFrame 下一帧）才更新，eval 同步返回时读到旧值
- **解决**：等待游戏运行数秒后再 eval 读取，`cw:3 disp:🔫 激光` 验证通过
- **经验**：测试游戏内 HUD 状态时，eval 同步执行读到的可能是上一帧的值，需等待一帧或多帧后再读取

### 踩坑-002：截图文件无法被读取查看
- **现象**：read_file 读取 .png 截图返回 "model does not support images"
- **原因**：当前模型不支持图片输入
- **解决**：通过逻辑验证（eval 读取状态值）替代视觉验证，截图仅作留存
- **经验**：无法看图时，用 eval 验证数据状态 + 代码审查替代视觉确认；截图留存供用户自行查看

### 踩坑-003：PowerShell 启动后台 HTTP 服务器
- **现象**：直接 `python -m http.server` 会阻塞 shell
- **解决**：用 `Start-Process python -ArgumentList ... -WindowStyle Hidden` 后台启动，非阻塞
- **经验**：Windows PowerShell 中启动长驻服务用 Start-Process 后台方式，避免阻塞工具命令

---

## 经验总结

1. **差异化装备三要素**：外形(绘制) + 数值(属性) + 特效(引擎/子弹) 必须同时差异化，玩家才能感知
2. **装备系统状态机**：购买(owned) → 装备(current) → 生效(startGame读取) 三层缺一不可，且 current 状态必须持久化
3. **爽感增强安全阀**：粒子等特效增加时必须设性能上限（如 particles>300 不再生成），避免低端机卡顿
4. **游戏内状态测试**：HUD/视觉状态受帧驱动，eval 同步测试需等待帧更新后再读取
