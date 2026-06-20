
var S = (function(){
  var s = {music:false,sfx:true,vibration:false,control:"mouse"};
  function l(){ try{ var d = JSON.parse(localStorage.getItem("starbattle_settings")); if(d) Object.assign(s,d); }catch(e){} }
  function sv(){ try{ localStorage.setItem("starbattle_settings",JSON.stringify(s)); }catch(e){} }
  l();
  return {
    get music(){return s.music;},
    get sfx(){return s.sfx;},
    get vibration(){return s.vibration;},
    get control(){return s.control;},
    toggleMusic: function(){ s.music=!s.music; var el=document.getElementById("musicK"); if(el)el.parentElement.classList.toggle("on",s.music); sv(); },
    toggleSfx: function(){ s.sfx=!s.sfx; var el=document.getElementById("sfxK"); if(el)el.parentElement.classList.toggle("on",s.sfx); sv(); },
    toggleVib: function(){ s.vibration=!s.vibration; var el=document.getElementById("vibK"); if(el)el.parentElement.classList.toggle("on",s.vibration); sv(); },
    setCtrl: function(v){ s.control=v; sv(); }
  };
})();


var Audio = (function(){
  var ctx = null;
  function getCtx(){ if(!ctx) try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} return ctx; }
  function playTone(f,d,t,v){
    var c = getCtx(); if(!c || !S.sfx) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = t||"square";
    o.frequency.value = f;
    g.gain.setValueAtTime((v||0.15)*0.5, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + d);
  }
  function noise(d,v){
    var c = getCtx(); if(!c || !S.sfx) return;
    var b = c.createBuffer(1, c.sampleRate*d, c.sampleRate);
    var ch = b.getChannelData(0);
    for(var i=0;i<ch.length;i++) ch[i]=Math.random()*2-1;
    var s = c.createBufferSource();
    s.buffer = b;
    var g = c.createGain();
    g.gain.setValueAtTime((v||0.08), c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+d);
    s.connect(g); g.connect(c.destination);
    s.start();
  }
  return {
    shoot: function(){ playTone(800,0.08,"square",0.1); },
    explosion: function(){ noise(0.3,0.12); playTone(100,0.2,"sawtooth",0.15); },
    powerup: function(){ playTone(600,0.1,"sine",0.12); setTimeout(function(){playTone(900,0.15,"sine",0.12);},100); },
    hit: function(){ playTone(300,0.06,"square",0.08); },
    bossWarning: function(){ playTone(200,0.3,"square",0.1); setTimeout(function(){playTone(250,0.3,"square",0.1);},400); },
    gameOver: function(){ playTone(400,0.15,"sawtooth",0.1); setTimeout(function(){playTone(300,0.15,"sawtooth",0.1);},200); setTimeout(function(){playTone(200,0.3,"sawtooth",0.1);},400); },
    click: function(){ playTone(1000,0.04,"sine",0.06); },
    coin: function(){ playTone(1200,0.06,"sine",0.1); setTimeout(function(){playTone(1500,0.08,"sine",0.1);},80); }
  };
})();

var Game = (function(){
  var canvas, ctx, W, H;
  var player, bullets=[], enemies=[], particles=[], stars=[], powerups=[];
  var score=0, kills=0, wave=1, coins=0, lives=3, maxLives=5;
  var running=false, paused=false, gameOver=false;
  var frameId=null, spawnTimer=0, waveEnemiesLeft=0, bossActive=false;
  var mouseX=0, mouseY=0, keys={}, weaponLevel=0, shieldActive=false;
  var weaponNames=['基础','双发','散射','激光','弹幕'];
  var weaponTypes=['single','dual','spread','laser','barrage'];
  var currentShip=0, ownedShips=[0], ownedWeapons=[0];
  var combo=0, comboTimer=0, reviveCount=0;

  var ships = [
    {name:'先锋号',desc:'均衡型战机',color:'#00d4ff',speed:5,hp:3,price:0},
    {name:'掠食者',desc:'高速型战机',color:'#ff6b81',speed:7,hp:2,price:500},
    {name:'堡垒号',desc:'重型战机',color:'#ffd700',speed:3.5,hp:5,price:1000},
    {name:'暗影',desc:'隐形战机',color:'#a855f7',speed:6,hp:3,price:2000},
    {name:'凤凰',desc:'传说战机',color:'#ff4757',speed:8,hp:4,price:5000}
  ];
  var weapons = [
    {name:'基础',desc:'单发子弹',price:0,dmg:1,rate:12,type:'single'},
    {name:'双发',desc:'双发并行',price:300,dmg:1,rate:10,type:'dual'},
    {name:'散射',desc:'三发散弹',price:800,dmg:1.2,rate:14,type:'spread'},
    {name:'激光',desc:'穿透激光',price:1500,dmg:2,rate:8,type:'laser'},
    {name:'弹幕',desc:'全屏弹幕',price:3000,dmg:1.5,rate:6,type:'barrage'}
  ];
  var powerupTypes = [
    {name:'双倍火力',icon:'🔥',effect:'weapon',dur:5000},
    {name:'护盾',icon:'🛡️',effect:'shield',dur:5000},
    {name:'生命',icon:'❤️',effect:'life',dur:0},
    {name:'急速',icon:'⚡',effect:'speed',dur:3000},
    {name:'金币',icon:'🪙',effect:'coin',dur:0}
  ];
  var achievements = [
    {id:'first',name:'初次飞行',desc:'完成第一局游戏',icon:'🚀',check:function(){return true;}},
    {id:'killer',name:'小试牛刀',desc:'击落100架敌机',icon:'💀',check:function(){return ks100>=100;}},
    {id:'wave10',name:'太空老兵',desc:'到达第10波',icon:'⭐',check:function(){return maxWave>=10;}},
    {id:'wave20',name:'星际战神',desc:'到达第20波',icon:'🌟',check:function(){return maxWave>=20;}},
    {id:'score5k',name:'高分猎手',desc:'单局得分5000',icon:'🎯',check:function(){return highScore>=5000;}},
    {id:'score10k',name:'传奇机长',desc:'单局得分10000',icon:'🏅',check:function(){return highScore>=10000;}},
    {id:'collector',name:'收藏家',desc:'购买3架战机',icon:'🛒',check:function(){return ownedShips.length>=3;}},
    {id:'rich',name:'百万富翁',desc:'累计获得5000金币',icon:'💰',check:function(){return totalCoins>=5000;}}
  ];
  var highScore=0, maxWave=0, ks100=0, totalCoins=0;
  var dailyCollected=false;

  function init(){
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    load();
    initStars();
    initInput();
    UI.updateCoins();
    UI.renderShop();
    UI.renderAchievements();
    UI.renderLeaderboard();
    checkDaily();
    loop();
  }
  function resize(){
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  function initStars(){
    stars = [];
    for(var i=0;i<120;i++){
      stars.push({
        x:Math.random()*W, y:Math.random()*H,
        r:Math.random()*2+0.5, s:Math.random()*2+0.5,
        b:Math.random()*0.6+0.4
      });
    }
  }
  function initInput(){
    canvas.addEventListener('mousemove',function(e){
      mouseX=e.clientX; mouseY=e.clientY;
    });
    canvas.addEventListener('touchmove',function(e){
      e.preventDefault();
      var t=e.touches[0];
      mouseX=t.clientX; mouseY=t.clientY;
    },{passive:false});
    canvas.addEventListener('touchstart',function(e){
      e.preventDefault();
      var t=e.touches[0];
      mouseX=t.clientX; mouseY=t.clientY;
    },{passive:false});
    document.addEventListener('keydown',function(e){
      keys[e.key]=true;
      if(e.key===' '||e.key==='Escape') e.preventDefault();
    });
    document.addEventListener('keyup',function(e){ keys[e.key]=false; });
  }

  function startGame(){
    document.getElementById('goScreen')&&document.getElementById('goScreen').classList.remove('active');
    document.getElementById('achvScreen')&&document.getElementById('achvScreen').classList.remove('active');
    document.getElementById('lbScreen')&&document.getElementById('lbScreen').classList.remove('active');
    document.getElementById('dailyScreen')&&document.getElementById('dailyScreen').classList.remove('active');
    document.getElementById('shopScreen')&&document.getElementById('shopScreen').classList.remove('active');
    document.getElementById('settingsScreen')&&document.getElementById('settingsScreen').classList.remove('active');
    player = {x:W/2,y:H-80,w:30,h:36,hp:ships[currentShip].hp,maxHp:ships[currentShip].hp,speed:ships[currentShip].speed,invuln:0};
    bullets = []; enemies = []; particles = []; powerups = [];
    score = 0; kills = 0; wave = 1; lives = 3; combo = 0; comboTimer = 0;
    waveEnemiesLeft = 5; bossActive = false; spawnTimer = 0; weaponLevel = 0;
    shieldActive = false; gameOver = false; running = true; paused = false;
    UI.showHud();
    Audio.click();
  }

  function loop(){
    if(!running && !gameOver) { frameId = requestAnimationFrame(loop); return; }
    if(!paused && running) update();
    draw();
    frameId = requestAnimationFrame(loop);
  }

  function getWeapon(){ return weapons[weaponLevel]||weapons[0]; }

  function update(){
    // boss warning flash
    for(var i=0;i<enemies.length;i++){
      var e=enemies[i];
      if(e.boss && e.warning>0 && e.warning%4<2){
        ctx.fillStyle='rgba(255,0,50,0.08)';
        ctx.fillRect(0,0,W,H);
      }
    }
    // player movement
    if(player){
      var spd = player.speed * (keys['Shift']?1.6:1);
      if(keys['ArrowLeft']||keys['a']) player.x -= spd;
      if(keys['ArrowRight']||keys['d']) player.x += spd;
      if(keys['ArrowUp']||keys['w']) player.y -= spd;
      if(keys['ArrowDown']||keys['s']) player.y += spd;
      // mouse follow in mouse mode
      if(S.control==='mouse'){
        var dx = mouseX - player.x, dy = mouseY - player.y;
        var dist = Math.sqrt(dx*dx+dy*dy);
        if(dist>2){
          player.x += (dx/dist)*Math.min(spd*1.5,dist);
          player.y += (dy/dist)*Math.min(spd*1.5,dist);
        }
      }
      player.x = Math.max(20,Math.min(W-20,player.x));
      player.y = Math.max(40,Math.min(H-40,player.y));
      if(player.invuln>0) player.invuln--;
    }
    // auto fire
    if(player && running){
      timer++;
      if(timer%(getWeapon().rate||12)===0){
        fire();
      }
    }
    // update bullets
    for(var i=bullets.length-1;i>=0;i--){
      var b2=bullets[i];
      b2.y-=b2.speed||8;
      b2.x+=b2.vx||0;
      if(b2.life) b2.life--;
      if(b2.y<-20||b2.y>H+20||b2.x<-20||b2.x>W+20||(b2.life!==undefined&&b2.life<=0)){
        bullets.splice(i,1); continue;
      }
      // enemy collision
      for(var j=enemies.length-1;j>=0;j--){
        var e=enemies[j];
        if(e.hp<=0) continue;
        var dx=b2.x-e.x, dy=b2.y-e.y;
        if(Math.sqrt(dx*dx+dy*dy)<(e.r||18)+6){
          e.hp-=b2.dmg||1;
          spawnParticles(e.x,e.y,3,e.color||'#ff4757',2);
          Audio.hit();
          if(e.hp<=0){
            killEnemy(e,i);
          }
          bullets.splice(i,1);
          break;
        }
      }
    }
    // update enemies
    for(var i=enemies.length-1;i>=0;i--){
      var e=enemies[i];
      if(e.hp<=0){ enemies.splice(i,1); continue; }
      if(e.boss){ enemyFire(e); }
      // move towards player
      var angle = Math.atan2(player.y-e.y, player.x-e.x);
      if(e.boss){
        e.x+=Math.cos(angle)*0.8;
        e.y+=Math.sin(angle)*0.3;
        e.x=Math.max(80,Math.min(W-80,e.x));
      }else{
        e.x+=Math.cos(angle)*(e.speed||1.5);
        e.y+=Math.sin(angle)*(e.speed||1.5);
      }
      // enemy bullet collision with player
      if(e.bullets){
        for(var k=e.bullets.length-1;k>=0;k--){
          var eb=e.bullets[k];
          eb.x+=eb.vx||0; eb.y+=eb.vy||0;
          if(eb.y>H||eb.y<-20||eb.x<-20||eb.x>W+20){ e.bullets.splice(k,1); continue; }
          if(player && player.hp>0){
            var ddx=eb.x-player.x, ddy=eb.y-player.y;
            var r=(eb.sz||3)+16;
            if(Math.sqrt(ddx*ddx+ddy*ddy)<r){
              hitPlayer();
              e.bullets.splice(k,1);
            }
          }
        }
      }
      // player collision
      if(player && player.hp>0){
        var dx=player.x-e.x, dy=player.y-e.y;
        if(Math.sqrt(dx*dx+dy*dy)<(e.r||18)+18){
          if(!e.boss || true){
            if(e.hp>0){
              e.hp=0;
              killEnemy(e);
              hitPlayer();
            }
          }
        }
      }
      // off-screen cleanup
      if(e.y>H+50 || e.x<-50 || e.x>W+50){
        if(!e.boss) enemies.splice(i,1);
      }
    }
    // powerups
    for(var i=powerups.length-1;i>=0;i--){
      var p=powerups[i];
      p.y+=1.5;
      if(p.y>H+20){ powerups.splice(i,1); continue; }
      if(player && player.hp>0){
        var dx = p.x-player.x, dy = p.y-player.y;
        if(Math.sqrt(dx*dx+dy*dy)<24){
          collectPowerup(p);
          powerups.splice(i,1);
        }
      }
    }
    // particles
    for(var i=particles.length-1;i>=0;i--){
      var p=particles[i];
      p.x+=p.vx; p.y+=p.vy;
      p.vy+=0.05;
      p.life--;
      if(p.life<=0) particles.splice(i,1);
    }
    // combo timer
    if(comboTimer>0) comboTimer--;
    else combo=0;
    // spawning
    if(!bossActive){
      spawnTimer++;
      var spawnRate = Math.max(15,60-wave*2);
      if(spawnTimer>=spawnRate && waveEnemiesLeft>0){
        spawnEnemy();
        spawnTimer=0;
      }
    }
    // wave progression
    if(!bossActive && waveEnemiesLeft<=0 && enemies.length===0){
      if(wave%5===0){
        bossActive = true;
        spawnBoss();
        Audio.bossWarning();
        document.getElementById('bossBar').style.display = 'block';
        UI.showNotif('⚠️ BOSS 来袭！','danger');
      }else{
        wave++;
        waveEnemiesLeft = 5+wave*2;
        UI.showNotif('⚔️ 第 '+wave+' 波','');
        Audio.click();
      }
    }
    // boss check
    if(bossActive){
      var hasBoss = false;
      for(var i=0;i<enemies.length;i++){
        if(enemies[i].boss){ hasBoss=true;
          document.getElementById('bossFill').style.width = Math.max(0,enemies[i].hp/enemies[i].maxHp*100)+'%'; break; }
      }
      if(!hasBoss){ bossActive=false;
        document.getElementById('bossBar').style.display = 'none';
        wave++;
        waveEnemiesLeft = 5+wave*2;
        Audio.coin();
        coins+=50;
        UI.updateCoins();
        UI.showNotif('🎉 BOSS 击败！+50 🪙','');
      }
    }
    // update HUD
    document.getElementById('scoreDisp').textContent = score;
    document.getElementById('hudCoins').textContent = coins;
    document.getElementById('waveDisp').textContent = wave;
    var h = '';
    for(var i=0;i<lives;i++) h+='❤️';
    document.getElementById('livesDisp').textContent = h||'💀';
    document.getElementById('weaponDisp').textContent = '🔫 '+weaponNames[weaponLevel];
  }
  var timer=0;

  function fire(){
    if(!player || player.hp<=0) return;
    var w = getWeapon();
    if(w.type==='single'){
      bullets.push({x:player.x,y:player.y-18,speed:10,dmg:w.dmg,vx:0});
    }else if(w.type==='dual'){
      bullets.push({x:player.x-10,y:player.y-16,speed:10,dmg:w.dmg,vx:0});
      bullets.push({x:player.x+10,y:player.y-16,speed:10,dmg:w.dmg,vx:0});
    }else if(w.type==='spread'){
      for(var a=-0.3;a<=0.3;a+=0.3)
        bullets.push({x:player.x,y:player.y-16,speed:9,dmg:w.dmg,vx:a});
    }else if(w.type==='laser'){
      bullets.push({x:player.x,y:player.y-18,speed:14,dmg:w.dmg,vx:0,life:40});
    }else if(w.type==='barrage'){
      for(var a=-0.6;a<=0.6;a+=0.2)
        bullets.push({x:player.x,y:player.y-16,speed:8,dmg:w.dmg,vx:a});
    }
    Audio.shoot();
  }

  function spawnEnemy(){
    var types = [
      {r:16,hp:1,speed:1.2,color:'#ff6b81',score:100},
      {r:20,hp:2,speed:0.8,color:'#ffa502',score:200},
      {r:14,hp:1,speed:2,color:'#ff4757',score:150}
    ];
    var t = types[Math.floor(Math.random()*types.length)];
    if(wave>5 && Math.random()<0.3) t = types[1];
    if(wave>10 && Math.random()<0.2) t = types[2];
    enemies.push({
      x:Math.random()*(W-60)+30, y:-30,
      r:t.r, hp:t.hp+(Math.floor(wave/5)), maxHp:t.hp+(Math.floor(wave/5)),
      speed:t.speed+Math.random()*0.5, color:t.color, score:t.score,
      boss:false, bullets:[]
    });
    waveEnemiesLeft--;
  }

  
  function spawnBoss(){
    var bossHp = 30 + wave * 5;
    enemies.push({
      x:W/2, y:-60, r:45, hp:bossHp, maxHp:bossHp,
      speed:0.8, color:'#ff4757', score:2000,
      boss:true, bullets:[],
      state:'enter', stateTimer:0, attackCount:0,
      dir:1, phase:0, warning:0, vx:0, vy:0
    });
  }

  
  function enemyFire(e){
    if(!player || !e.boss) return;
    e.stateTimer = (e.stateTimer||0) + 1;
    e.warning = Math.max(0, (e.warning||0) - 1);
    e.x += (e.vx||0); e.y += (e.vy||0);
    e.x = Math.max(60, Math.min(W-60, e.x));

    if(e.state === 'enter'){
      e.y += 0.8;
      if(e.y >= 90){ e.state='pause'; e.stateTimer=0; }
      return;
    }
    if(e.state === 'pause'){
      e.x += Math.cos(e.stateTimer*0.025)*1.2;
      if(e.stateTimer > 50){
        e.phase = (e.phase+1)%4;
        if(e.phase===0) e.state='aim';
        else if(e.phase===1) e.state='spread';
        else if(e.phase===2) e.state='cross';
        else e.state='charge';
        e.stateTimer=0; e.attackCount=0; e.warning=25;
      }
      return;
    }
    if(e.state === 'aim'){
      e.x += Math.cos(e.stateTimer*0.03)*0.5;
      if(e.stateTimer%10===0 && e.attackCount<5){
        bossAimed(e);
        e.attackCount++;
      }
      if(e.attackCount>=5 && e.stateTimer>60){
        e.state='pause'; e.stateTimer=0;
      }
    }else if(e.state === 'spread'){
      if(e.stateTimer%12===0 && e.attackCount<3){
        bossSpread(e);
        e.attackCount++;
      }
      if(e.attackCount>=3 && e.stateTimer>50){
        e.state='pause'; e.stateTimer=0;
      }
    }else if(e.state === 'cross'){
      if(e.stateTimer%15===0 && e.attackCount<2){
        bossCross(e);
        e.attackCount++;
      }
      if(e.attackCount>=2 && e.stateTimer>40){
        e.state='pause'; e.stateTimer=0;
      }
    }else if(e.state === 'charge'){
      if(e.attackCount===0){
        var a=Math.atan2(player.y-e.y, player.x-e.x);
        e.vx=Math.cos(a)*6; e.vy=Math.sin(a)*6;
        e.attackCount=1;
      }
      if(e.stateTimer>25){
        e.vx=0; e.vy=0;
        if(e.y>90) e.vy=-3;
        else{ e.state='pause'; e.stateTimer=0; e.attackCount=0; }
      }
    }
  }

  function bossAimed(e){
    var a = Math.atan2(player.y-e.y, player.x-e.x);
    e.bullets.push({x:e.x, y:e.y+25, vx:Math.cos(a)*4.5, vy:Math.sin(a)*4.5, sz:4, col:'#ff4757', glow:'#ff6b81'});
    e.bullets.push({x:e.x-12, y:e.y+20, vx:Math.cos(a-0.15)*4, vy:Math.sin(a-0.15)*4, sz:3, col:'#ffa502', glow:'#ffbe76'});
    e.bullets.push({x:e.x+12, y:e.y+20, vx:Math.cos(a+0.15)*4, vy:Math.sin(a+0.15)*4, sz:3, col:'#ffa502', glow:'#ffbe76'});
  }

  function bossSpread(e){
    for(var i=0;i<12;i++){
      var a = i*Math.PI/6 + e.stateTimer*0.05;
      e.bullets.push({x:e.x, y:e.y, vx:Math.cos(a)*3.5, vy:Math.sin(a)*3.5, sz:3, col:'#a855f7', glow:'#c084fc'});
    }
  }

  function bossCross(e){
    var dirs = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
    for(var i=0;i<dirs.length;i++){
      e.bullets.push({x:e.x+Math.cos(dirs[i])*20, y:e.y+Math.sin(dirs[i])*20, vx:Math.cos(dirs[i])*3, vy:Math.sin(dirs[i])*3, sz:4, col:'#00d4ff', glow:'#00ff88'});
    }
  }

  function killEnemy(e, bulletIdx){
    score += e.score||100;
    kills++;
    combo++;
    comboTimer = 120;
    var bonus = combo>5?Math.floor(combo/5)*0.5:0;
    score += Math.floor(e.score*bonus);
    spawnParticles(e.x,e.y,10,e.color||'#ff4757',4);
    if(Math.random()<0.15) spawnPowerup(e.x,e.y);
    if(Math.random()<0.05){
      coins += 5;
      Audio.coin();
    }
    UI.updateCoins();
    Audio.explosion();
    if(e.boss){
      coins += 50 + Math.floor(wave/2)*5;
      Audio.coin();
    }
  }

  function hitPlayer(){
    if(!player || player.invuln>0 || shieldActive) return;
    player.hp--;
    player.invuln = 30;
    if(shieldActive) shieldActive = false;
    if(player.hp<=0){
      lives--;
      if(lives<=0){
        gameOver = true;
        endGame();
        return;
      }
      revivePlayer();
    }
  }

  function revivePlayer(){
    player.hp = ships[currentShip].hp;
    player.invuln = 60;
    shieldActive = true;
    setTimeout(function(){shieldActive=false;},2000);
    spawnParticles(player.x,player.y,20,'#00d4ff',5);
  }

  function spawnPowerup(x,y){
    var t = powerupTypes[Math.floor(Math.random()*powerupTypes.length)];
    powerups.push({x:x,y:y,type:t,icon:t.icon,effect:t.effect,dur:t.dur,name:t.name});
  }

  function collectPowerup(p){
    Audio.powerup();
    UI.showNotif('✨ '+p.name+'！','');
    if(p.effect==='weapon'){
      weaponLevel = Math.min(weapons.length-1, weaponLevel+1);
      setTimeout(function(){
        weaponLevel = Math.max(0,weaponLevel-1);
        UI.showNotif('💫 火力恢复','');
      },5000);
    }else if(p.effect==='shield'){
      shieldActive = true;
      setTimeout(function(){shieldActive=false;},5000);
    }else if(p.effect==='life'){
      lives = Math.min(maxLives, lives+1);
    }else if(p.effect==='speed'){
      if(player) player.speed *= 1.5;
      setTimeout(function(){if(player) player.speed = ships[currentShip].speed;},3000);
    }else if(p.effect==='coin'){
      coins += 10;
      UI.updateCoins();
      Audio.coin();
    }
  }

  function spawnParticles(x,y,n,color,speed){
    for(var i=0;i<n;i++){
      var a = Math.random()*Math.PI*2;
      var sp = Math.random()*speed+1;
      particles.push({
        x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
        life:20+Math.random()*20,color:color,size:2+Math.random()*3
      });
    }
  }

  function endGame(){
    running = false;
    Game.addToLeaderboard&&Game.addToLeaderboard('玩家',score,wave);
    var coinReward = Math.floor(score/100) + kills + wave*2;
    coins += coinReward;
    totalCoins += coinReward;
    if(score>highScore) highScore=score;
    if(wave>maxWave) maxWave=wave;
    save();
    document.getElementById('fScore').textContent = score;
    document.getElementById('fKills').textContent = kills;
    document.getElementById('fWave').textContent = wave;
    document.getElementById('fCoins').textContent = '+'+coinReward+' 🪙';
    document.getElementById('reviveBtn').style.display = lives<=0?'block':'none';
    document.getElementById('doubleBtn').style.display = 'block';
    Audio.gameOver();
    UI.showGameOver();
  }

  function togglePause(){
    paused = !paused;
    document.getElementById('pauseScreen').classList.toggle('active',paused);
    document.getElementById('pauseBtn').textContent = paused?'▶':'⏸';
  }

  function quit(){
    running = false; gameOver = false;
    document.getElementById('pauseScreen').classList.remove('active');
    document.getElementById('gameHud').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('bossBar').style.display = 'none';
    UI.showMenu();
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // background gradient
    var g = ctx.createRadialGradient(W/2,H/2,W*0.5,W/2,H/2,W);
    g.addColorStop(0,'#0a0a2e');
    g.addColorStop(1,'#050518');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
    // stars
    for(var i=0;i<stars.length;i++){
      var s=stars[i];
      ctx.fillStyle='rgba(255,255,255,'+s.b+')';
      ctx.beginPath();
      ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fill();
      s.y+=s.s*(S.control==='mouse'?0.3:0.5);
      if(s.y>H){ s.y=0; s.x=Math.random()*W; }
    }
    // powerups
    for(var i=0;i<powerups.length;i++){
      var p=powerups[i];
      ctx.fillStyle='rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(p.x,p.y,14,0,Math.PI*2);
      ctx.fill();
      ctx.font='16px sans-serif';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.fillStyle='#fff';
      ctx.fillText(p.icon,p.x,p.y+1);
    }
    // enemies
    for(var i=0;i<enemies.length;i++){
      var e=enemies[i];
      if(e.hp<=0) continue;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = e.boss?20:8;
      ctx.fillStyle = e.color;
      if(e.boss){
        // boss ship
        ctx.beginPath();
        ctx.moveTo(e.x,e.y-30);
        ctx.lineTo(e.x-30,e.y+10);
        ctx.lineTo(e.x-20,e.y+35);
        ctx.lineTo(e.x,e.y+25);
        ctx.lineTo(e.x+20,e.y+35);
        ctx.lineTo(e.x+30,e.y+10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(e.x,e.y+5,12,0,Math.PI*2);
        ctx.fill();
      }else{
        // small enemy
        ctx.beginPath();
        ctx.moveTo(e.x,e.y+15);
        ctx.lineTo(e.x-12,e.y-8);
        ctx.lineTo(e.x-6,e.y-15);
        ctx.lineTo(e.x,e.y-8);
        ctx.lineTo(e.x+6,e.y-15);
        ctx.lineTo(e.x+12,e.y-8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(e.x,e.y,4,0,Math.PI*2);
        ctx.fill();
      }
      // enemy bullets
      if(e.bullets){
        for(var k=0;k<e.bullets.length;k++){
          var eb=e.bullets[k];
          ctx.shadowColor=eb.col||'#ff4757';
          ctx.shadowBlur=eb.glow?15:6;
          ctx.fillStyle=eb.col||'#ff4757';
          ctx.beginPath();
          ctx.arc(eb.x,eb.y,eb.sz||4,0,Math.PI*2);
          ctx.fill();
          if(eb.glow){
            ctx.shadowBlur=25;
            ctx.globalAlpha=0.25;
            ctx.beginPath();
            ctx.arc(eb.x,eb.y,(eb.sz||4)*2,0,Math.PI*2);
            ctx.fill();
            ctx.globalAlpha=1;
          }
        }
      }
      ctx.shadowBlur = 0;
    }
    // bullets
    for(var i=0;i<bullets.length;i++){
      var b2=bullets[i];
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 12;
      var grad = ctx.createLinearGradient(b2.x-3,b2.y-8,b2.x+3,b2.y+8);
      grad.addColorStop(0,'#00d4ff');
      grad.addColorStop(1,'#7b2ff7');
      ctx.fillStyle = grad;
      ctx.fillRect(b2.x-3,b2.y-8,6,14);
      ctx.shadowBlur = 0;
    }
    // particles
    for(var i=0;i<particles.length;i++){
      var p=particles[i];
      var alpha = p.life/40;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color||'#ff4757';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size*alpha,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // player
    if(player && player.hp>0){
      ctx.shadowColor = shieldActive?'#00ff88':'#00d4ff';
      ctx.shadowBlur = shieldActive?25:15;
      var px = player.x, py = player.y;
      var col = ships[currentShip].color;
      // ship body
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(px,py-22);
      ctx.lineTo(px-16,py+10);
      ctx.lineTo(px-10,py+18);
      ctx.lineTo(px,py+12);
      ctx.lineTo(px+10,py+18);
      ctx.lineTo(px+16,py+10);
      ctx.closePath();
      ctx.fill();
      // cockpit
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(px,py-6,6,0,Math.PI*2);
      ctx.fill();
      // engine glow
      ctx.shadowBlur = 0;
      var glw = ctx.createRadialGradient(px,py+16,2,px,py+16,10);
      glw.addColorStop(0,'rgba(0,212,255,0.6)');
      glw.addColorStop(1,'rgba(0,212,255,0)');
      ctx.fillStyle = glw;
      ctx.beginPath();
      ctx.arc(px,py+16,10,0,Math.PI*2);
      ctx.fill();
      // shield
      if(shieldActive){
        ctx.strokeStyle='rgba(0,255,136,0.3)';
        ctx.lineWidth=2;
        ctx.shadowBlur=15;
        ctx.shadowColor='#00ff88';
        ctx.beginPath();
        ctx.arc(px,py,28,0,Math.PI*2);
        ctx.stroke();
      }
      // invuln flash
      if(player.invuln>0 && player.invuln%4<2){
        ctx.globalAlpha = 0.5;
      }
      ctx.shadowBlur = 0;
    }
    // combo display
    if(combo>5){
      ctx.fillStyle='rgba(255,215,0,0.8)';
      ctx.font='bold 20px sans-serif';
      ctx.textAlign='center';
      ctx.fillText('🔥 '+combo+' 连击!',W/2,60);
    }
  }

  // storage
  function save(){
    try{
      var d = {
        coins:coins, highScore:highScore, maxWave:maxWave,
        totalCoins:totalCoins, ks100:kills,
        ownedShips:ownedShips, ownedWeapons:ownedWeapons,
        dailyCollected:dailyCollected
      };
      localStorage.setItem('starbattle',JSON.stringify(d));
    }catch(e){}
  }
  function load(){
    try{
      var d = JSON.parse(localStorage.getItem('starbattle'));
      if(d){
        coins = d.coins||0; highScore = d.highScore||0;
        maxWave = d.maxWave||0; totalCoins = d.totalCoins||0;
        ks100 = d.ks100||0; ownedShips = d.ownedShips||[0];
        ownedWeapons = d.ownedWeapons||[0];
        dailyCollected = d.dailyCollected||false;
      }
    }catch(e){}
    // moved to init()
  }
  function checkDaily(){
    try{
      var last = localStorage.getItem('starbattle_daily');
      if(last){
        var today = new Date().toDateString();
        if(last===today){ dailyCollected=true; return; }
      }
      dailyCollected=false;
      setTimeout(function(){UI.showDaily();},500);
    }catch(e){}
  }
  function collectDaily(){
    dailyCollected=true;
    var amt = 50;
    coins+=amt; totalCoins+=amt;
    try{ localStorage.setItem('starbattle_daily',new Date().toDateString()); }catch(e){}
    save();
    UI.updateCoins();
    UI.hideDaily();
    Audio.coin();
    UI.showNotif('🎁 +50 🪙 每日奖励','');
  }

  return {
    init: init, startGame: startGame, togglePause: togglePause, quit: quit,
    getWave: function(){return wave;},
    getScore: function(){return score;},
    getKills: function(){return kills;},
    getLives: function(){return lives;},
    getCombo: function(){return combo;},
    getCoins: function(){return coins;},
    setCoins: function(v){coins=v;},
    getHighScore: function(){return highScore;},
    getMaxWave: function(){return maxWave;},
    getTotalCoins: function(){return totalCoins;},
    getShips: function(){return ships;},
    getWeapons: function(){return weapons;},
    getCurrentShip: function(){return currentShip;},
    setCurrentShip: function(v){currentShip=v;},
    getOwnedShips: function(){return ownedShips;},
    getOwnedWeapons: function(){return ownedWeapons;},
    getAchievements: function(){return achievements;},
    getDailyCollected: function(){return dailyCollected;},
    setDailyCollected: function(v){dailyCollected=v;},
    collectDaily: collectDaily,
    save: save,
    // for leaderboard
    leaderboard: [],
    addToLeaderboard: function(name,score,wave){
      this.leaderboard.push({name:name||'玩家',score:score,wave:wave});
      this.leaderboard.sort(function(a,b){return b.score-a.score;});
      if(this.leaderboard.length>10) this.leaderboard.length=10;
      try{ localStorage.setItem('starbattle_lb',JSON.stringify(this.leaderboard)); }catch(e){}
    },
    loadLeaderboard: function(){
      try{
        var d = JSON.parse(localStorage.getItem('starbattle_lb'));
        if(d) this.leaderboard = d;
      }catch(e){}
    },
    fill: function(){},
    coins: function(){return coins;}
  };
})();

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

    redeem: function(){
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
  },
  return {
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


var S = (function(){
  var settings = {music:false,sfx:true,vibration:false,control:'mouse'};
  function load(){
    try{ var d = JSON.parse(localStorage.getItem('starbattle_settings')); if(d) Object.assign(settings,d); }catch(e){}
  }
  function save(){ try{ localStorage.setItem('starbattle_settings',JSON.stringify(settings)); }catch(e){} }
  load();
  return {
    get music(){return settings.music;},
    get sfx(){return settings.sfx;},
    get vibration(){return settings.vibration;},
    get control(){return settings.control;},
    toggleMusic: function(){
      settings.music=!settings.music;
      document.getElementById('musicK').parentElement.classList.toggle('on',settings.music);
      save();
    },
    toggleSfx: function(){
      settings.sfx=!settings.sfx;
      document.getElementById('sfxK').parentElement.classList.toggle('on',settings.sfx);
      save();
    },
    toggleVib: function(){
      settings.vibration=!settings.vibration;
      document.getElementById('vibK').parentElement.classList.toggle('on',settings.vibration);
      save();
    },
    setCtrl: function(v){
      settings.control=v; save();
    }
  };
})();

window.addEventListener('DOMContentLoaded', function(){
  Game.leaderboard = [];
  Game.loadLeaderboard();
  if(Game.leaderboard.length===0){
    Game.leaderboard = [
      {name:'传奇机长',score:12800,wave:28},
      {name:'星际猎人',score:9500,wave:22},
      {name:'太空王牌',score:7300,wave:18}
    ];
    // keep original addToLeaderboard
  }
  Game.init();
  UI.showMenu();
});
