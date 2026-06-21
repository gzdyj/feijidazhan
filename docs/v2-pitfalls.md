# 第二版踩坑日志

> 记录开发中遇到的异常、BUG、踩坑经验，避免重复踩坑。

---

## 第一版遗留 BUG（步骤2 将修复）

### BUG-001：`useAbility` 未导出，必杀技按钮报错
- **位置**：`index.html` 第1172-1212行 `Game` 模块 return 对象
- **现象**：HTML 第152行 `onclick="Game.useAbility()"` 调用，但 `Game` return 中未导出 `useAbility`，点击必杀技按钮或按空格会报 `Game.useAbility is not a function`
- **原因**：return 对象遗漏导出
- **修复方案**：在 return 中添加 `useAbility: useAbility,`
- **经验**：模块化 IIFE 的 return 必须完整导出所有外部调用的方法，HTML onclick 绑定的方法尤其要检查

### BUG-002：商店道具购买后无实际效果
- **位置**：`index.html` 第1321-1341行 `buyLife/buyShield/buyBoost`
- **现象**：购买"额外生命""初始护盾""开局加速"只扣金币，开局不会生效
- **原因**：没有存储购买标记，`startGame` 也没有读取这些标记
- **修复方案**：
  - 在 save/load 中增加 `boughtLife/boughtShield/boughtBoost` 标记
  - 购买时设置标记
  - `startGame` 中根据标记应用开局效果
- **经验**：商店购买类道具必须有持久化标记，且开局逻辑要读取标记

### BUG-003：speed 道具恢复未乘 levelBonuses
- **位置**：`index.html` 第887行 `collectPowerup`
- **现象**：拾取急速道具后，3秒恢复速度时用 `ships[currentShip].speed`，未乘 `levelBonuses.speed`，导致升级后的速度加成丢失
- **修复方案**：恢复时用 `ships[currentShip].speed * (levelBonuses.speed||1)`
- **经验**：临时增益效果恢复原值时，必须考虑所有永久加成系数

---

## 开发中踩坑（持续记录）

### 踩坑-001：内嵌 CSS 缺失样式导致元素不显示
- **现象**：`.ab-btn`、`.hud-xp`、`.xp-fill`、`.xp-text` 在 HTML 中使用但 `<style>` 中无定义，导致必杀技按钮和经验条不显示
- **原因**：第一版 CSS 不完整
- **修复**：在步骤7 补全所有缺失样式
- **经验**：检查 HTML 中所有 class 是否有对应 CSS 定义

### 踩坑-002：startGame 中 shieldActive 被覆盖
- **位置**：startGame 函数
- **现象**：第428行 `shieldActive=levelBonuses.startShield||false` 设置后，第432行 `shieldActive=false` 又覆盖，导致开局护盾无效
- **修复**：合并为 `var initShield = (levelBonuses.startShield||false)||boughtShield; ... shieldActive=initShield;`
- **经验**：同函数内对同一变量的多次赋值要检查是否有覆盖

### 踩坑-003：setTimeout 与暂停不兼容
- **现象**：第一版 weapon/shield/speed 用 setTimeout 控制持续时间，游戏暂停时 setTimeout 仍在执行，导致暂停期间效果过期
- **修复**：第二版改用 activeEffects 帧驱动，update 中递减，暂停时 update 不执行则效果不衰减
- **经验**：游戏内持续效果应用帧驱动而非 setTimeout，保证暂停一致性

### 踩坑-004：道具掉落概率均分导致主动技能过多
- **现象**：13种道具均分概率，active 道具占 5/13≈38%，太频繁
- **修复**：按 category 加权（instant50%/buff35%/active15%）
- **经验**：道具掉落要按稀有度加权，不能均分

### 踩坑-005：playwright-cli eval 不支持分号
- **现象**：`playwright-cli eval "Game.startGame(); 'ok'"` 报 SyntaxError: Unexpected token ';'
- **原因**：playwright-cli eval 把参数当作单个表达式，分号会破坏表达式语法
- **解决**：每个语句单独执行 eval，或用 IIFE `(function(){...})()` 包裹
- **经验**：命令行 eval 工具的表达式语法限制，复杂逻辑用 IIFE 或 run-code

### 踩坑-006：测试核弹时需确保场上有敌机
- **现象**：第一次测试核弹时击杀数无变化，因为 EMP 冻结期间无新敌机被击杀，核弹使用时场上无活敌机
- **解决**：等待几秒让敌机生成后再使用核弹，击杀数 5→16 验证通过
- **经验**：测试范围伤害类道具时，要确保测试环境中有足够目标

