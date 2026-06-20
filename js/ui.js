
var UI = (function(){
  function showMenu(){
    hideAll();
    document.getElementById('menuScreen').classList.add('active');
    updateCoins();
  }
  function showGameOver(){
    hideAll();
    document.getElementById('goScreen').classList.add('active');
  }
  function showHud(){
    hideAll();
    document.getElementById('gameHud').style.display = 'block';
    document.getElementById('pauseBtn').style.display = 'flex';
  }
  function showShop(){
    hideAll();
    document.getElementById('shopScreen').classList.add('active');
    document.getElementById('shopCoins').textContent = Game.getCoins();
    renderShop();
  }
  function switchTab(tab, btn){
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    btn.classList.add('active');
    renderShop();
  }
  function renderShop(){
    var container = document.getElementById('shopItems');
    container.innerHTML = '';
    var active = document.querySelector('.tab.active');
    var tab = active?active.textContent.trim():'战机';
    var coins = Game.getCoins();
    var items = [];
    if(tab==='战机'){
      items = Game.getShips().map(function(s,i){
        var owned = Game.getOwnedShips().indexOf(i)>=0;
        var equipped = Game.getCurrentShip()===i;
        return '<div class="item-card">'+
          '<div class="icon" style="color:'+s.color+'">✈️</div>'+
          '<div class="info"><div class="name">'+s.name+'</div><div class="desc">'+s.desc+'</div>'+
          (owned?'<div class="owned">'+(equipped?'✅ 已装备':'已拥有')+'</div>':'')+'</div>'+
          '<button class="buy-btn '+(owned?(equipped?'equipped':'owned'):(coins>=s.price?'buy':'locked'))+'" '+
          'onclick="UI.'+(owned?(equipped?'':'equipShip('+i+')'):'buyShip('+i+')')+'">'+
          (owned?(equipped?'已装备':'装备'):(coins>=s.price?'🪙 '+s.price:'🔒 '+s.price))+'</button></div>';
      });
    }else if(tab==='武器'){
      items = Game.getWeapons().map(function(w,i){
        var owned = Game.getOwnedWeapons().indexOf(i)>=0;
        return '<div class="item-card">'+
          '<div class="icon">🔫</div>'+
          '<div class="info"><div class="name">'+w.name+'</div><div class="desc">'+w.desc+'</div>'+
          (owned?'<div class="owned">已拥有</div>':'')+'</div>'+
          '<button class="buy-btn '+(owned?'owned':(coins>=w.price?'buy':'locked'))+'" '+
          'onclick="UI.'+(owned?'':'buyWeapon('+i+')')+'">'+
          (owned?'已拥有':(coins>=w.price?'🪙 '+w.price:'🔒 '+w.price))+'</button></div>';
      });
    }else if(tab==='道具'){
      items = [
        '<div class="item-card"><div class="icon">❤️</div><div class="info"><div class="name">额外生命</div><div class="desc">开局+2生命</div></div><button class="buy-btn buy" onclick="UI.buyLife()">🪙 200</button></div>',
        '<div class="item-card"><div class="icon">🛡️</div><div class="info"><div class="name">初始护盾</div><div class="desc">开局带护盾</div></div><button class="buy-btn buy" onclick="UI.buyShield()">🪙 150</button></div>',
        '<div class="item-card"><div class="icon">⚡</div><div class="info"><div class="name">开局加速</div><div class="desc">开局速度+50%</div></div><button class="buy-btn buy" onclick="UI.buyBoost()">🪙 100</button></div>'
      ];
    }else if(tab==='VIP'){
      items = [
        '<div class="item-card" style="border-color:rgba(255,215,0,0.3);background:rgba(255,215,0,0.05)">'+
        '<div class="icon">👑</div><div class="info"><div class="name">⚡ VIP 月卡</div><div class="desc">每日+100金币 · 双倍收益 · 专属战机 · 去广告</div></div>'+
        '<button class="buy-btn buy" onclick="UI.buyVIP()">¥12/月</button></div>',
        '<div class="item-card" style="border-color:rgba(255,215,0,0.3);background:rgba(255,215,0,0.05)">'+
        '<div class="icon">💎</div><div class="info"><div class="name">💎 6480 金币礼包</div><div class="desc">大量金币，畅享游戏</div></div>'+
        '<button class="buy-btn buy" onclick="UI.buyCoinsPack()">¥6</button></div>',
        '<div class="item-card" style="border-color:rgba(255,215,0,0.3);background:rgba(255,215,0,0.05)">'+
        '<div class="icon">🔥</div><div class="info"><div class="name">🔥 新手礼包</div><div class="desc">解锁全部基础战机+1000金币</div></div>'+
        '<button class="buy-btn buy" onclick="UI.buyStarter()">¥1</button></div>'
      ];
    }
    container.innerHTML = items.join('');
  }
  function buyShip(i){
    var s = Game.getShips()[i];
    if(Game.getCoins()>=s.price){
      Game.setCoins(Game.getCoins()-s.price);
      Game.getOwnedShips().push(i);
      Game.save();
      updateCoins();
      renderShop();
      Audio.coin();
      showNotif('✅ 购买 '+s.name+' 成功！','');
    }
  }
  function equipShip(i){
    Game.setCurrentShip(i);
    Game.save();
    renderShop();
    Audio.click();
  }
  function buyWeapon(i){
    var w = Game.getWeapons()[i];
    if(Game.getCoins()>=w.price){
      Game.setCoins(Game.getCoins()-w.price);
      Game.getOwnedWeapons().push(i);
      Game.save();
      updateCoins();
      renderShop();
      Audio.coin();
      showNotif('✅ 购买 '+w.name+' 成功！','');
    }
  }
  function buyLife(){
    if(Game.getCoins()>=200){
      Game.setCoins(Game.getCoins()-200);
      Game.save(); updateCoins(); Audio.coin();
      showNotif('❤️ 已购买额外生命','');
    }
  }
  function buyShield(){
    if(Game.getCoins()>=150){
      Game.setCoins(Game.getCoins()-150);
      Game.save(); updateCoins(); Audio.coin();
      showNotif('🛡️ 已购买初始护盾','');
    }
  }
  function buyBoost(){
    if(Game.getCoins()>=100){
      Game.setCoins(Game.getCoins()-100);
      Game.save(); updateCoins(); Audio.coin();
      showNotif('⚡ 已购买开局加速','');
    }
  }
  function buyVIP(){ showNotif('👑 模拟：VIP 订阅成功！（实际需接入支付）',''); }
  function buyCoinsPack(){ showNotif('💎 模拟：6480金币已到账！（实际需接入支付）',''); Game.setCoins(Game.getCoins()+6480); Game.save(); updateCoins(); Audio.coin(); }
  function buyStarter(){ showNotif('🔥 模拟：新手礼包已领取！（实际需接入支付）',''); Game.setCoins(Game.getCoins()+1000); if(Game.getOwnedShips().indexOf(1)<0)Game.getOwnedShips().push(1); if(Game.getOwnedShips().indexOf(2)<0)Game.getOwnedShips().push(2); Game.save(); updateCoins(); Audio.coin(); }
  function revive(){
    if(Game.getLives()>0) return;
    showNotif('👁️ 模拟：看广告复活！（实际将展示激励视频）','');
    Game.fill();
    document.getElementById('goScreen').classList.remove('active');
    document.getElementById('gameHud').style.display = 'block';
    Game.startGame();
  }
  function doubleDown(){
    showNotif('👁️ 模拟：看广告领取双倍金币！（实际将展示激励视频）','');
    var cStr = document.getElementById('fCoins').textContent;
      var coins = parseInt(cStr.replace(/[^0-9]/g,''))||0;
    if(coins){
      Game.setCoins(Game.getCoins()+coins);
      Game.save(); updateCoins();
      document.getElementById('doubleBtn').style.display = 'none';
    }
  }
  function showSettings(){
    document.getElementById('settingsScreen').classList.add('active');
    document.getElementById('musicK').parentElement.classList.toggle('on',S.music);
    document.getElementById('sfxK').parentElement.classList.toggle('on',S.sfx);
    document.getElementById('vibK').parentElement.classList.toggle('on',S.vibration);
  }
  function hideSettings(){ document.getElementById('settingsScreen').classList.remove('active'); }
  function showAchv(){ hideAll(); document.getElementById('achvScreen').classList.add('active'); renderAchievements(); }
  function hideAchv(){ document.getElementById('achvScreen').classList.remove('active'); showMenu(); }
  function showLb(){ hideAll(); document.getElementById('lbScreen').classList.add('active'); renderLeaderboard(); }
  function hideLb(){ document.getElementById('lbScreen').classList.remove('active'); showMenu(); }
  function hideShop(){ document.getElementById('shopScreen').classList.remove('active'); showMenu(); }
  function hideGameOver(){ document.getElementById('goScreen').classList.remove('active'); showMenu(); }

  function renderAchievements(){
    var container = document.getElementById('achvList');
    var list = Game.getAchievements().map(function(a){
      var done = a.check();
      return '<div class="achv-item '+(done?'done':'')+'">'+
        '<div class="a-icon">'+(done?'✅':a.icon)+'</div>'+
        '<div class="a-info"><div class="a-name">'+a.name+'</div><div class="a-desc">'+a.desc+'</div></div>'+
        '<div class="a-check">'+(done?'🏆':'🔒')+'</div></div>';
    }).join('');
    container.innerHTML = list||'<p style="color:rgba(255,255,255,0.3);padding:20px;">暂无成就</p>';
  }
  function renderLeaderboard(){
    var container = document.getElementById('lbList');
    var lb = Game.leaderboard;
    if(lb.length===0){
      container.innerHTML = '<p style="color:rgba(255,255,255,0.3);padding:20px;">暂无记录\n快去挑战高分吧！</p>'; return;
    }
    var medals = ['gold','silver','bronze'];
    container.innerHTML = lb.slice(0,10).map(function(e,i){
      return '<div class="lb-item"><div class="rank '+(medals[i]||'')+'">'+(i<3?['🥇','🥈','🥉'][i]:'#'+(i+1))+'</div>'+
        '<div class="lb-name">'+e.name+'</div><div class="lb-score">'+e.score+'</div></div>';
    }).join('');
  }
  function showNotif(msg, type){
    var el = document.getElementById('puNotif');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(function(){el.style.display='none';},2000);
  }
  function updateCoins(){
    ['menuCoins','shopCoins','hudCoins'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.textContent = Game.getCoins();
    });
  }
  function hideAll(){
    document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
    document.getElementById('gameHud').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('bossBar').style.display = 'none';
  }
  function showDaily(){
    if(!Game.getDailyCollected()){
      document.getElementById('dailyScreen').classList.add('active');
    }
  }
  function hideDaily(){ document.getElementById('dailyScreen').classList.remove('active'); }
  function collectDaily(){
    Game.collectDaily();
    hideDaily();
  }
  function watchDaily(){
    showNotif('👁️ 模拟：看广告双倍每日奖励！','');
    if(!Game.getDailyCollected()){
      Game.setCoins(Game.getCoins()+100);
      Game.save(); updateCoins();
      Game.setDailyCollected(true);
      hideDaily();
      Audio.coin();
      showNotif('🎁 +100 🪙 双倍奖励！','');
    }
  }

    function redeem(){
    var inp = document.getElementById('redeemInput');
    if(!inp) return;
    var code = inp.value.trim().toUpperCase();
    var result = document.getElementById('redeemResult');
    if(!result) return;
    if(code==='GOLD999'){
      Game.setCoins(Game.getCoins()+99999);
      Game.save();
      UI.updateCoins();
      result.innerHTML='<span style="color:#ffd700;">✅ 兑换成功！+99999 🪙</span>';
      Audio.coin();
      UI.showNotif('🎉 兑换成功！获得 99999 金币！','');
    }else if(code==='SKIPWAVE'){
      if(Game.getWave) wave = Game.getWave();
      result.innerHTML='<span style="color:#00d4ff;">✅ 兑换成功！跳波功能已激活</span>';
    }else{
      result.innerHTML='<span style="color:#ff4757;">❌ 无效兑换码</span>';
    }
    inp.value='';
    setTimeout(function(){if(result)result.innerHTML='';},3000);
  }
  return {
    redeem:redeem,
    showMenu:showMenu, showGameOver:showGameOver, showHud:showHud,
    showShop:showShop, hideShop:hideShop, switchTab:switchTab,
    renderShop:renderShop, buyShip:buyShip, equipShip:equipShip,
    buyWeapon:buyWeapon, buyLife:buyLife, buyShield:buyShield,
    buyBoost:buyBoost, buyVIP:buyVIP, buyCoinsPack:buyCoinsPack,
    buyStarter:buyStarter,
    revive:revive, doubleDown:doubleDown,
    showSettings:showSettings, hideSettings:hideSettings,
    showAchv:showAchv, hideAchv:hideAchv,
    showLb:showLb, hideLb:hideLb,
    renderAchievements:renderAchievements, renderLeaderboard:renderLeaderboard,
    showNotif:showNotif, updateCoins:updateCoins,
    showDaily:showDaily, hideDaily:hideDaily,
    collectDaily:collectDaily, watchDaily:watchDaily
  };
})();
