

var S = (function(){
  var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints>0);
  var s = {music:false,sfx:true,vibration:false,control:isTouch?"touch":"mouse"};
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
  var lastShoot = 0;
  return {
    shoot: function(){
      var t = Date.now();
      if(t-lastShoot<50) return;  // 节流：弹幕武器高频射击时减少音频节点
      lastShoot = t;
      playTone(800,0.08,"square",0.1);
    },
    explosion: function(){ noise(0.3,0.12); playTone(100,0.2,"sawtooth",0.15); },
    powerup: function(){ playTone(600,0.1,"sine",0.12); setTimeout(function(){playTone(900,0.15,"sine",0.12);},100); },
    hit: function(){ playTone(300,0.06,"square",0.08); },
    bossWarning: function(){ playTone(200,0.3,"square",0.1); setTimeout(function(){playTone(250,0.3,"square",0.1);},400); },
    gameOver: function(){ playTone(400,0.15,"sawtooth",0.1); setTimeout(function(){playTone(300,0.15,"sawtooth",0.1);},200); setTimeout(function(){playTone(200,0.3,"sawtooth",0.1);},400); },
    click: function(){ playTone(1000,0.04,"sine",0.06); },
    coin: function(){ playTone(1200,0.06,"sine",0.1); setTimeout(function(){playTone(1500,0.08,"sine",0.1);},80); },
    getCtx: getCtx
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
  var currentShip=0, ownedShips=[0], ownedWeapons=[0], currentWeapon=0;
  var combo=0, comboTimer=0, reviveCount=0;
  var xp=0, xpToNext=100, playerLevel=1;
  var floatingTexts=[], shakeIntensity=0, shockwaves=[], flashScreen=0;
  var abilityType="bomb", abilityCooldown=0, abilityMaxCd=900;
  var levelBonuses={fireRate:1,speed:1,damage:1,extraLife:0,startShield:false};
  // ---- 画质自适应系统（手机端防糊/防掉帧） ----
  var QUALITY_LEVELS = [
    {shadows:false, dprCap:1,   maxParticles:120, starCount:70,  label:'低'},
    {shadows:false, dprCap:1,   maxParticles:200, starCount:90,  label:'中低'},
    {shadows:true,  dprCap:1.5, maxParticles:260, starCount:110, label:'中'},
    {shadows:true,  dprCap:2,   maxParticles:300, starCount:120, label:'高'}
  ];
  var q = { level:3, dpr:1, shadows:true, maxParticles:300, starCount:120 };
  var fpsFrames=0, fpsTime=0, fpsAvg=60, lastT=0;
  var hudEls = {};
  // 阴影开关：关闭时一律 0，避免逐实体 shadowBlur 高开销
  function SB(v){ ctx.shadowBlur = q.shadows ? v : 0; }

  var ships = [
    {name:'先锋号',desc:'均衡型战机',color:'#00d4ff',speed:5,hp:3,price:0,shape:'arrow',size:1.0,engine:'single',trail:'#00d4ff'},
    {name:'掠食者',desc:'高速型战机',color:'#ff6b81',speed:7,hp:2,price:500,shape:'spike',size:0.95,engine:'dual',trail:'#ff6b81'},
    {name:'堡垒号',desc:'重型战机',color:'#ffd700',speed:3.5,hp:5,price:1000,shape:'fort',size:1.25,engine:'quad',trail:'#ffd700'},
    {name:'暗影',desc:'隐形战机',color:'#a855f7',speed:6,hp:3,price:2000,shape:'wing',size:1.1,engine:'stealth',trail:'#a855f7'},
    {name:'凤凰',desc:'传说战机',color:'#ff4757',speed:8,hp:4,price:5000,shape:'phoenix',size:1.15,engine:'flame',trail:'#ff8c00'}
  ];
  var weapons = [
    {name:'基础',desc:'单发子弹',price:0,dmg:1,rate:12,type:'single'},
    {name:'双发',desc:'双发并行',price:300,dmg:1,rate:10,type:'dual'},
    {name:'散射',desc:'三发散弹',price:800,dmg:1.2,rate:14,type:'spread'},
    {name:'激光',desc:'穿透激光',price:1500,dmg:2,rate:8,type:'laser'},
    {name:'弹幕',desc:'全屏弹幕',price:3000,dmg:1.5,rate:6,type:'barrage'}
  ];
  var powerupTypes = [
    // 即时道具 instant
    {id:'life',name:'生命',icon:'❤️',category:'instant',effect:'life',dur:0,desc:'生命+1',color:'#ff4757'},
    {id:'coin',name:'金币',icon:'🪙',category:'instant',effect:'coin',dur:0,desc:'+10金币',color:'#ffd700'},
    {id:'recharge',name:'炸弹补给',icon:'💣',category:'instant',effect:'recharge',dur:0,desc:'重置必杀技冷却',color:'#ff6b81'},
    // 持续增益 buff (dur 单位：帧, 60fps)
    {id:'weapon',name:'双倍火力',icon:'🔥',category:'buff',effect:'weapon',dur:300,desc:'武器等级+1',color:'#ff6348'},
    {id:'shield',name:'护盾',icon:'🛡️',category:'buff',effect:'shield',dur:300,desc:'无敌护盾',color:'#00ff88'},
    {id:'speed',name:'急速',icon:'⚡',category:'buff',effect:'speed',dur:180,desc:'移速+50%',color:'#00d4ff'},
    {id:'pierce',name:'穿透弹',icon:'🎯',category:'buff',effect:'pierce',dur:360,desc:'子弹穿透敌机',color:'#a855f7'},
    {id:'double',name:'双倍分数',icon:'✨',category:'buff',effect:'double',dur:480,desc:'得分翻倍',color:'#ffd700'},
    // 主动技能 active (拾取进入槽位)
    {id:'emp',name:'EMP脉冲',icon:'💫',category:'active',effect:'emp',dur:0,desc:'瘫痪全场敌机3秒',color:'#00d4ff'},
    {id:'slowmo',name:'时间减速',icon:'⏱️',category:'active',effect:'slowmo',dur:0,desc:'敌机减速50%持续5秒',color:'#7b2ff7'},
    {id:'magnet',name:'磁铁',icon:'🧲',category:'active',effect:'magnet',dur:0,desc:'吸引掉落物持续8秒',color:'#ff6b81'},
    {id:'nuke',name:'核弹',icon:'☢️',category:'active',effect:'nuke',dur:0,desc:'全场敌机大量伤害',color:'#ff4757'},
    {id:'clone',name:'分身',icon:'👥',category:'active',effect:'clone',dur:0,desc:'生成2分身协助射击8秒',color:'#00ff88'}
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
  var boughtLife=false, boughtShield=false, boughtBoost=false;
  var activeEffects = {};
  var inventory = [null, null, null];
  var clones = [];

  function addFloatingText(x,y,text,col){
    if(floatingTexts.length>50) return;  // 上限
    floatingTexts.push({x:x,y:y,text:text,col:col||"#fff",life:40,vy:-1.5});
  }
  function addXP(amt){
    xp+=amt;
    while(xp>=xpToNext){
      xp-=xpToNext;
      playerLevel++;
      xpToNext=Math.floor(100*Math.pow(1.15,playerLevel-1));
      if(playerLevel>=2) levelBonuses.fireRate=1.1;
      if(playerLevel>=3) levelBonuses.startShield=true;
      if(playerLevel>=4) levelBonuses.speed=1.1;
      if(playerLevel>=5) levelBonuses.extraLife=1;
      UI.showNotif("🎉 升级! 等级 "+playerLevel,"");
    }
  }
  function useAbility(){
    if(abilityCooldown>0||!player||!running) return;
    for(var i=enemies.length-1;i>=0;i--){
      var e2=enemies[i];
      if(e2&&e2.hp>0){
        spawnParticles(e2.x,e2.y,8,e2.color||"#ff4757",4);
        kills++;
      }
    }
    enemies=[];
    spawnParticles(W/2,H/2,50,"#fff",10);
    spawnShockwave(W/2,H/2,"#00d4ff");
    flashScreen=6;
    score+=100;
    Audio.explosion();
    shakeIntensity=18;
    abilityCooldown=abilityMaxCd;
  }
  function init(){
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    applyQuality();  // 初始化 DPR/星数/背景并 resize
    window.addEventListener('resize', resize);
    // 切后台/来电自动暂停，避免手机端白死
    document.addEventListener('visibilitychange', function(){
      if(document.hidden && running && !paused && !gameOver) togglePause();
    });
    // iOS 首次手势解锁 AudioContext
    function unlockAudio(){
      var c = Audio.getCtx && Audio.getCtx();
      if(c && c.state==='suspended') c.resume();
    }
    document.addEventListener('pointerdown', unlockAudio, {once:true});
    document.addEventListener('touchstart', unlockAudio, {once:true});
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
    var dpr = q.dpr;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.max(1, Math.round(W*dpr));
    canvas.height = Math.max(1, Math.round(H*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    buildBg();
    for(var i=0;i<stars.length;i++){
      if(stars[i].x>W) stars[i].x=W;
      if(stars[i].y>H) stars[i].y=H;
    }
  }
  var bgGrad = null;
  function buildBg(){
    try{
      bgGrad = ctx.createRadialGradient(W/2,H/2,Math.max(60,W*0.5),W/2,H/2,Math.max(W,H));
      bgGrad.addColorStop(0,'#0a0a2e');
      bgGrad.addColorStop(1,'#050518');
    }catch(e){ bgGrad = null; }
  }
  // ---- 画质自适应：按实测帧率升降级 ----
  function applyQuality(){
    var lv = QUALITY_LEVELS[q.level];
    q.shadows = lv.shadows;
    q.maxParticles = lv.maxParticles;
    q.dpr = Math.min(window.devicePixelRatio||1, lv.dprCap);
    if(stars.length !== lv.starCount) initStars();
    else q.starCount = lv.starCount;
    resize();
  }
  function adaptQuality(){
    if(fpsAvg < 40 && q.level > 0){
      q.level--;
    }else if(fpsAvg > 55 && q.level < QUALITY_LEVELS.length-1){
      q.level++;
    }
    applyQuality();
  }
  function initStars(){
    stars = [];
    q.starCount = QUALITY_LEVELS[q.level].starCount;
    for(var i=0;i<q.starCount;i++){
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
      if(e.key===' ') useAbility();
      if(e.key==='1') useInventory(0);
      if(e.key==='2') useInventory(1);
      if(e.key==='3') useInventory(2);
      if(e.key==='Escape') e.preventDefault();
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
    var initShield = (levelBonuses.startShield||false) || boughtShield;
    player = {x:W/2,y:H-80,w:30,h:36,hp:ships[currentShip].hp+(levelBonuses.extraLife||0),maxHp:ships[currentShip].hp+(levelBonuses.extraLife||0),speed:ships[currentShip].speed*(levelBonuses.speed||1)*(boughtBoost?1.5:1),invuln:0};
    xp=0; xpToNext=100; abilityCooldown=0;
    bullets = []; enemies = []; particles = []; powerups = [];
    activeEffects = {}; inventory = [null,null,null]; clones = [];
    score = 0; kills = 0; wave = 1; lives = 3+(boughtLife?2:0); combo = 0; comboTimer = 0;
    waveEnemiesLeft = 5; bossActive = false; spawnTimer = 0; weaponLevel = currentWeapon;
    shieldActive = initShield; gameOver = false; running = true; paused = false;
    UI.showHud();
    Audio.click();
  }

  function loop(){
    var now = performance.now();
    if(lastT){
      fpsFrames++;
      fpsTime += now - lastT;
      if(fpsFrames >= 90){
        fpsAvg = fpsTime > 0 ? fpsFrames/(fpsTime/1000) : 60;
        fpsFrames = 0; fpsTime = 0;
        adaptQuality();
      }
    }
    lastT = now;
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
      // pointer follow: mouse 与 touch 模式均跟随指针（触屏事件已写入 mouseX/Y）
      if(S.control!=='keyboard'){
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
          if(activeEffects.pierce>0){
            // 穿透弹：不删除子弹，继续检测下一个敌机
          }else{
            bullets.splice(i,1);
            break;
          }
        }
      }
    }
    // update enemies
    for(var i=enemies.length-1;i>=0;i--){
      var e=enemies[i];
      if(e.hp<=0){ enemies.splice(i,1); continue; }
      if(e.boss && !activeEffects.emp){ enemyFire(e); }
      // move towards player (emp 冻结, slowmo 隔帧减速)
      if(!activeEffects.emp && (!(activeEffects.slowmo>0) || timer%2===0)){
      var angle = Math.atan2(player.y-e.y, player.x-e.x);
      // kamikaze - dive at player
      if(e.type==='k'){
        if(!e.kamiDive){e.kamiDive=0;}
        e.kamiDive++;
        if(e.kamiDive>40){
          var da=Math.atan2(player.y-e.y,player.x-e.x);
          e.x+=Math.cos(da)*6;
          e.y+=Math.sin(da)*6;
        }else{
          e.x+=Math.cos(angle)*(e.speed||1.5);
          e.y+=Math.sin(angle)*(e.speed||1.5);
        }
      }else if(e.type==='s'){
        // sniper - stay at range, fire occasionally
        var dist=Math.sqrt(Math.pow(player.x-e.x,2)+Math.pow(player.y-e.y,2));
        if(dist<200){angle+=Math.PI;}
        e.x+=Math.cos(angle)*(e.speed||0.5);
        e.y+=Math.sin(angle)*(e.speed||0.5);
        e.snipeTimer=(e.snipeTimer||0)+1;
        if(e.snipeTimer%90===0){
          if(!e.bullets)e.bullets=[];
          if(e.bullets.length>=120) e.bullets.splice(0,20);  // 单机子弹上限
          var sa=Math.atan2(player.y-e.y,player.x-e.x);
          e.bullets.push({x:e.x,y:e.y+15,vx:Math.cos(sa)*5,vy:Math.sin(sa)*5,sz:3,col:'#00d4ff',glow:'#00ff88'});
        }
      }else if(e.boss){
        e.x+=Math.cos(angle)*0.8;
        e.y+=Math.sin(angle)*0.3;
        e.x=Math.max(80,Math.min(W-80,e.x));
      }else{
        e.x+=Math.cos(angle)*(e.speed||1.5);
        e.y+=Math.sin(angle)*(e.speed||1.5);
      }
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
      if(activeEffects.magnet>0 && player && player.hp>0){
        var mdx=player.x-p.x, mdy=player.y-p.y;
        var md=Math.sqrt(mdx*mdx+mdy*mdy);
        if(md>1){ p.x+=(mdx/md)*8; p.y+=(mdy/md)*8; }
      }else{
        p.y+=1.5;
      }
      if(p.y>H+20){ powerups.splice(i,1); continue; }
      if(player && player.hp>0){
        var dx = p.x-player.x, dy = p.y-player.y;
        if(Math.sqrt(dx*dx+dy*dy)<24){
          collectPowerup(p);
          powerups.splice(i,1);
        }
      }
    }
    // floating text update
    for(var fti=floatingTexts.length-1;fti>=0;fti--){
      var ft=floatingTexts[fti];
      ft.y+=ft.vy||-1.5;
      ft.life--;
      if(ft.life<=0) floatingTexts.splice(fti,1);
    }
    if(shakeIntensity>0) shakeIntensity*=0.85;
    if(shakeIntensity<0.3) shakeIntensity=0;
    if(abilityCooldown>0) abilityCooldown--;
    // shockwaves 扩散与消亡
    for(var i=shockwaves.length-1;i>=0;i--){
      var sw=shockwaves[i];
      sw.r += (sw.maxR-sw.r)*0.18;
      sw.life--;
      if(sw.life<=0) shockwaves.splice(i,1);
    }
    if(flashScreen>0) flashScreen--;
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
    // activeEffects 递减与过期处理
    for(var ek in activeEffects){
      if(activeEffects[ek]>0){
        activeEffects[ek]--;
        if(activeEffects[ek]<=0){
          delete activeEffects[ek];
          onEffectEnd(ek);
        }
      }
    }
    // clone fire
    if(activeEffects.clone>0 && clones.length>0 && player && player.hp>0){
      for(var ci=0;ci<clones.length;ci++){
        clones[ci].fireTimer++;
        if(clones[ci].fireTimer%10===0){
          bullets.push({x:player.x+clones[ci].offset,y:player.y-10,speed:9,dmg:1,vx:0,wt:'single',col:'#00ff88'});
          Audio.shoot();
        }
      }
    } else if(!activeEffects.clone){ clones=[]; }
    // spawning
    if(!bossActive){
      spawnTimer++;
      var spawnRate = Math.max(12,50-wave*2);
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
    // update HUD（元素引用缓存，避免每帧 getElementById 全文档扫描）
    if(!hudEls.score){
      hudEls = {
        score:document.getElementById('scoreDisp'),
        coins:document.getElementById('hudCoins'),
        wave:document.getElementById('waveDisp'),
        lives:document.getElementById('livesDisp'),
        weapon:document.getElementById('weaponDisp'),
        xpFill:document.getElementById('xpFill'),
        xpText:document.getElementById('xpText'),
        abBtn:document.getElementById('abBtn')
      };
    }
    if(hudEls.score && hudEls.score.textContent!==String(score)) hudEls.score.textContent = score;
    if(hudEls.coins && hudEls.coins.textContent!==String(coins)) hudEls.coins.textContent = coins;
    if(hudEls.wave && hudEls.wave.textContent!==String(wave)) hudEls.wave.textContent = wave;
    var h = '';
    for(var i=0;i<lives;i++) h+='❤️';
    var livesStr = h||'💀';
    if(hudEls.lives && hudEls.lives.textContent!==livesStr) hudEls.lives.textContent = livesStr;
    var wStr = '🔫 '+weaponNames[weaponLevel];
    if(hudEls.weapon && hudEls.weapon.textContent!==wStr) hudEls.weapon.textContent = wStr;
    // XP bar
    var xpPct=Math.min(100,Math.floor(xp/xpToNext*100));
    if(hudEls.xpFill) hudEls.xpFill.style.width=xpPct+'%';
    if(hudEls.xpText) hudEls.xpText.textContent='Lv '+playerLevel+' '+xpPct+'%';
    // ability button
    var abBtn=hudEls.abBtn;
    if(abBtn){
      if(abilityCooldown>0){
        abBtn.textContent='⏳'+Math.ceil(abilityCooldown/60)+'s';
        abBtn.style.background='rgba(255,100,100,0.3)';
      }else{
        abBtn.textContent='💣';
        abBtn.style.background='';
      }
    }
  }
  var timer=0;

  function fire(){
    if(!player || player.hp<=0) return;
    if(bullets.length>160) return;  // 上限，防止后期弹幕堆积
    var w = getWeapon();
    var wt = w.type;
    if(wt==='single'){
      bullets.push({x:player.x,y:player.y-18,speed:10,dmg:w.dmg,vx:0,wt:wt,col:'#00d4ff'});
    }else if(wt==='dual'){
      bullets.push({x:player.x-10,y:player.y-16,speed:10,dmg:w.dmg,vx:0,wt:wt,col:'#00ffd0'});
      bullets.push({x:player.x+10,y:player.y-16,speed:10,dmg:w.dmg,vx:0,wt:wt,col:'#00ffd0'});
    }else if(wt==='spread'){
      for(var a=-0.3;a<=0.3;a+=0.3)
        bullets.push({x:player.x,y:player.y-16,speed:9,dmg:w.dmg,vx:a,wt:wt,col:'#a855f7'});
    }else if(wt==='laser'){
      bullets.push({x:player.x,y:player.y-18,speed:14,dmg:w.dmg,vx:0,life:40,wt:wt,col:'#ff4757'});
    }else if(wt==='barrage'){
      for(var a=-0.6;a<=0.6;a+=0.2)
        bullets.push({x:player.x,y:player.y-16,speed:8,dmg:w.dmg,vx:a,wt:wt,col:'#ffd700'});
    }
    Audio.shoot();
  }

  function spawnEnemy(){
    var types = [
      {type:'n',r:16,hp:1,speed:1.2,color:'#ff6b81',score:100},
      {type:'n',r:20,hp:2,speed:0.8,color:'#ffa502',score:200},
      {type:'n',r:14,hp:1,speed:2.2,color:'#ff4757',score:150},
      {type:'k',r:18,hp:1,speed:0.4,color:'#ff6348',score:200},
      {type:'s',r:22,hp:3,speed:0.2,color:'#00d4ff',score:250}
    ];
    var t = types[Math.floor(Math.random()*types.length)];
    if(wave>3&&Math.random()<0.2) t=types[3];
    if(wave>7&&Math.random()<0.15) t=types[4];
    if(wave>5&&Math.random()<0.25) t=types[1];
    if(enemies.length>32) return;  // 上限，防止后期敌机堆积
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
    if(e.bullets.length>140) e.bullets.splice(0,40);
    var a = Math.atan2(player.y-e.y, player.x-e.x);
    e.bullets.push({x:e.x, y:e.y+25, vx:Math.cos(a)*4.5, vy:Math.sin(a)*4.5, sz:4, col:'#ff4757', glow:'#ff6b81'});
    e.bullets.push({x:e.x-12, y:e.y+20, vx:Math.cos(a-0.15)*4, vy:Math.sin(a-0.15)*4, sz:3, col:'#ffa502', glow:'#ffbe76'});
    e.bullets.push({x:e.x+12, y:e.y+20, vx:Math.cos(a+0.15)*4, vy:Math.sin(a+0.15)*4, sz:3, col:'#ffa502', glow:'#ffbe76'});
  }

  function bossSpread(e){
    if(e.bullets.length>140) e.bullets.splice(0,40);
    for(var i=0;i<12;i++){
      var a = i*Math.PI/6 + e.stateTimer*0.05;
      e.bullets.push({x:e.x, y:e.y, vx:Math.cos(a)*3.5, vy:Math.sin(a)*3.5, sz:3, col:'#a855f7', glow:'#c084fc'});
    }
  }

  function bossCross(e){
    if(e.bullets.length>140) e.bullets.splice(0,40);
    var dirs = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
    for(var i=0;i<dirs.length;i++){
      e.bullets.push({x:e.x+Math.cos(dirs[i])*20, y:e.y+Math.sin(dirs[i])*20, vx:Math.cos(dirs[i])*3, vy:Math.sin(dirs[i])*3, sz:4, col:'#00d4ff', glow:'#00ff88'});
    }
  }

    function killEnemy(e, bulletIdx){
    var baseScore = e.score||100;
    var dbl = activeEffects.double>0 ? 2 : 1;
    score += baseScore * dbl;
    kills++; combo++; comboTimer=120;
    var bonus=combo>5?Math.floor(combo/5)*0.5:0;
    score+=Math.floor(baseScore*bonus*dbl);
    // 粒子随连击递增
    var pn = 16 + (combo>5?Math.min(combo,20):0);
    spawnParticles(e.x,e.y,pn,e.color||"#ff4757",4);
    // 震屏随连击递增
    shakeIntensity = 5 + Math.min(combo*0.3,6);
    var bt=combo>5?" x"+combo:"";
    addFloatingText(e.x,e.y-10,"+"+(baseScore*dbl)+bt,e.color||"#fff");
    // 连击阶段爆发
    if(combo===10||combo===20||combo===50){
      spawnParticles(e.x,e.y,24,'#ffd700',6);
      addFloatingText(W/2,H/2,"🔥 "+combo+" 连击!",'#ffd700');
      shakeIntensity += 4;
    }
    addXP(Math.floor(baseScore/10)+1);
    if(Math.random()<0.15) spawnPowerup(e.x,e.y);
    if(Math.random()<0.08){coins+=5;Audio.coin();}
    UI.updateCoins(); Audio.explosion();
    if(e.boss){
      coins+=50+Math.floor(wave/2)*5; Audio.coin();
      addFloatingText(W/2,H/2-80,"💥 BOSS! +"+(50+Math.floor(wave/2)*5)+"🪙","#ffd700");
      shakeIntensity=20;
      spawnParticles(e.x,e.y,80,e.color||"#ff4757",8);
      spawnShockwave(e.x,e.y,e.color||"#ff4757");
      flashScreen=8;  // 全屏白闪
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
    if(powerups.length>20) return;  // 上限
    var r = Math.random();
    var pool;
    if(r<0.5) pool = powerupTypes.filter(function(t){return t.category==='instant';});
    else if(r<0.85) pool = powerupTypes.filter(function(t){return t.category==='buff';});
    else pool = powerupTypes.filter(function(t){return t.category==='active';});
    var t = pool[Math.floor(Math.random()*pool.length)];
    powerups.push({x:x,y:y,id:t.id,icon:t.icon,category:t.category,effect:t.effect,dur:t.dur,name:t.name,color:t.color});
  }

  function collectPowerup(p){
    Audio.powerup();
    if(p.category==='instant'){
      UI.showNotif('✨ '+p.name+'！','');
      applyInstant(p.effect);
    }else if(p.category==='buff'){
      activeEffects[p.effect] = p.dur;
      if(p.effect==='weapon'){
        weaponLevel = Math.min(weapons.length-1, weaponLevel+1);
      }else if(p.effect==='shield'){
        shieldActive = true;
      }else if(p.effect==='speed'){
        if(player) player.speed = ships[currentShip].speed*(levelBonuses.speed||1)*1.5;
      }
      UI.showNotif('✨ '+p.name+' '+Math.round(p.dur/60)+'秒！','');
    }else if(p.category==='active'){
      addToInventory(p);
    }
  }

  function applyInstant(effect){
    if(effect==='life'){
      lives = Math.min(maxLives, lives+1);
    }else if(effect==='coin'){
      coins += 10;
      UI.updateCoins();
      Audio.coin();
    }else if(effect==='recharge'){
      abilityCooldown = 0;
      UI.showNotif('💣 必杀技冷却重置！','');
    }
  }

  function onEffectEnd(effect){
    if(effect==='weapon'){
      weaponLevel = Math.max(0, weaponLevel-1);
      UI.showNotif('💫 火力恢复','');
    }else if(effect==='shield'){
      shieldActive = false;
    }else if(effect==='speed'){
      if(player) player.speed = ships[currentShip].speed*(levelBonuses.speed||1);
    }
  }

  function addToInventory(item){
    for(var i=0;i<inventory.length;i++){
      if(!inventory[i]){
        inventory[i] = item;
        UI.showNotif('🎒 '+item.name+' 已装入槽位 '+(i+1),'');
        UI.renderInventory();
        return;
      }
    }
    useInventory(0);
    inventory[0] = item;
    UI.showNotif('🎒 槽位满，自动使用旧道具',''+item.name+' 已装入','');
    UI.renderInventory();
  }

  function useInventory(slot){
    if(!inventory[slot]) return;
    var item = inventory[slot];
    inventory[slot] = null;
    applyActive(item.effect, item);
    UI.renderInventory();
  }

  function applyActive(effect, item){
    UI.showNotif('✨ 使用 '+item.name+'！','');
    if(effect==='emp'){
      activeEffects.emp = 180;
    }else if(effect==='slowmo'){
      activeEffects.slowmo = 300;
    }else if(effect==='magnet'){
      activeEffects.magnet = 480;
    }else if(effect==='nuke'){
      doNuke();
    }else if(effect==='clone'){
      activeEffects.clone = 480;
      spawnClones();
    }
  }

  function doNuke(){
    for(var i=enemies.length-1;i>=0;i--){
      var e=enemies[i];
      if(e&&e.hp>0){
        if(e.boss){
          e.hp -= Math.floor(e.maxHp*0.5);
          spawnParticles(e.x,e.y,15,e.color||"#ff4757",5);
          if(e.hp<=0) killEnemy(e);
        }else{
          spawnParticles(e.x,e.y,10,e.color||"#ff4757",4);
          kills++;
          score += e.score||100;
          enemies.splice(i,1);
        }
      }
    }
    spawnParticles(W/2,H/2,50,"#ff4757",10);
    spawnShockwave(W/2,H/2,"#ff4757");
    flashScreen=6;
    Audio.explosion();
    shakeIntensity = 18;
  }

  function spawnClones(){
    clones = [];
    if(!player) return;
    for(var i=0;i<2;i++){
      clones.push({offset:(i===0?-40:40), fireTimer:i*6});
    }
  }

  function spawnParticles(x,y,n,color,speed){
    if(particles.length>q.maxParticles) return;  // 画质自适应上限
    for(var i=0;i<n;i++){
      var a = Math.random()*Math.PI*2;
      var sp = Math.random()*speed+1;
      particles.push({
        x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,
        life:20+Math.random()*20,color:color,size:2+Math.random()*3
      });
    }
  }
  // 冲击波环（BOSS击杀/核弹等大事件）
  function spawnShockwave(x,y,color){
    shockwaves.push({x:x,y:y,r:10,maxR:130,color:color||'#fff',life:25});
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

  // hex 转 rgba
  function hexToRgba(hex, a){
    var h = (hex||'#ffffff').replace('#','');
    if(h.length===3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var r = parseInt(h.substr(0,2),16)||255;
    var g = parseInt(h.substr(2,2),16)||255;
    var b = parseInt(h.substr(4,2),16)||255;
    return 'rgba('+r+','+g+','+b+','+a+')';
  }
  // 战机引擎拖尾
  function drawShipEngine(ctx, px, py, s, pulse){
    ctx.shadowBlur = 0;
    var eng = s.engine || 'single';
    var trail = s.trail || s.color;
    var glow = hexToRgba(trail, 0.65*pulse);
    var fade = hexToRgba(trail, 0);
    if(eng==='single'){
      var glw = ctx.createRadialGradient(px,py+16,2,px,py+16,12);
      glw.addColorStop(0,glow); glw.addColorStop(1,fade);
      ctx.fillStyle = glw;
      ctx.beginPath(); ctx.arc(px,py+16,12,0,Math.PI*2); ctx.fill();
    }else if(eng==='dual'){
      [-9,9].forEach(function(dx){
        var glw = ctx.createRadialGradient(px+dx,py+16,2,px+dx,py+16,9);
        glw.addColorStop(0,glow); glw.addColorStop(1,fade);
        ctx.fillStyle = glw;
        ctx.beginPath(); ctx.arc(px+dx,py+16,9,0,Math.PI*2); ctx.fill();
      });
    }else if(eng==='quad'){
      [-15,-5,5,15].forEach(function(dx){
        var glw = ctx.createRadialGradient(px+dx,py+18,2,px+dx,py+18,7);
        glw.addColorStop(0,glow); glw.addColorStop(1,fade);
        ctx.fillStyle = glw;
        ctx.beginPath(); ctx.arc(px+dx,py+18,7,0,Math.PI*2); ctx.fill();
      });
    }else if(eng==='stealth'){
      var glw = ctx.createLinearGradient(px,py+12,px,py+34);
      glw.addColorStop(0,glow); glw.addColorStop(1,fade);
      ctx.fillStyle = glw;
      ctx.fillRect(px-6,py+12,12,22);
    }else if(eng==='flame'){
      var g1 = hexToRgba('#ff8c00',0.85*pulse);
      var g2 = hexToRgba('#ff4757',0.5*pulse);
      var g3 = hexToRgba('#ff4757',0);
      var glw = ctx.createLinearGradient(px,py+14,px,py+42);
      glw.addColorStop(0,g1); glw.addColorStop(0.5,g2); glw.addColorStop(1,g3);
      ctx.fillStyle = glw;
      ctx.beginPath();
      ctx.moveTo(px-10,py+14);
      ctx.lineTo(px-4,py+38+Math.sin(timer*0.5)*3);
      ctx.lineTo(px,py+30);
      ctx.lineTo(px+4,py+38+Math.cos(timer*0.5)*3);
      ctx.lineTo(px+10,py+14);
      ctx.closePath();
      ctx.fill();
    }
  }
  // 战机主体绘制（按 shape 分支差异化）
  function drawShip(ctx, px, py, idx, invuln){
    var s = ships[idx]||ships[0];
    var col = s.color;
    var sz = s.size || 1.0;
    var pulse = 0.6 + Math.sin(timer*0.3)*0.4;
    var alpha = 1;
    if(invuln>0 && invuln%4<2) alpha = 0.5;
    ctx.globalAlpha = alpha;

    // 引擎拖尾先画（在机身下层）
    drawShipEngine(ctx, px, py, s, pulse);

    // 机身辉光
    ctx.shadowColor = shieldActive?'#00ff88':col;
    SB(shieldActive?20:12);
    ctx.fillStyle = col;

    if(s.shape==='spike'){
      // 掠食者：狭长锐利尖刺
      ctx.beginPath();
      ctx.moveTo(px,py-30*sz);
      ctx.lineTo(px-8*sz,py);
      ctx.lineTo(px-14*sz,py+16*sz);
      ctx.lineTo(px-6*sz,py+20*sz);
      ctx.lineTo(px,py+14*sz);
      ctx.lineTo(px+6*sz,py+20*sz);
      ctx.lineTo(px+14*sz,py+16*sz);
      ctx.lineTo(px+8*sz,py);
      ctx.closePath(); ctx.fill();
    }else if(s.shape==='fort'){
      // 堡垒号：宽厚六边形装甲
      ctx.beginPath();
      ctx.moveTo(px,py-20*sz);
      ctx.lineTo(px-24*sz,py-8*sz);
      ctx.lineTo(px-22*sz,py+12*sz);
      ctx.lineTo(px-12*sz,py+20*sz);
      ctx.lineTo(px+12*sz,py+20*sz);
      ctx.lineTo(px+22*sz,py+12*sz);
      ctx.lineTo(px+24*sz,py-8*sz);
      ctx.closePath(); ctx.fill();
      // 装甲细节条
      ctx.shadowBlur=0;
      ctx.fillStyle='rgba(0,0,0,0.28)';
      ctx.fillRect(px-16*sz,py-2*sz,32*sz,6*sz);
      ctx.fillStyle=col;
    }else if(s.shape==='wing'){
      // 暗影：流线隐形飞翼（半透明）
      ctx.globalAlpha = alpha*0.85;
      ctx.beginPath();
      ctx.moveTo(px,py-18*sz);
      ctx.lineTo(px-22*sz,py+8*sz);
      ctx.lineTo(px-16*sz,py+16*sz);
      ctx.lineTo(px-4*sz,py+12*sz);
      ctx.lineTo(px,py+16*sz);
      ctx.lineTo(px+4*sz,py+12*sz);
      ctx.lineTo(px+16*sz,py+16*sz);
      ctx.lineTo(px+22*sz,py+8*sz);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = alpha;
    }else if(s.shape==='phoenix'){
      // 凤凰：展翅双翼
      ctx.beginPath();
      ctx.moveTo(px,py-24*sz);
      ctx.lineTo(px-8*sz,py-4*sz);
      ctx.lineTo(px-28*sz,py+6*sz);
      ctx.lineTo(px-18*sz,py+14*sz);
      ctx.lineTo(px-8*sz,py+12*sz);
      ctx.lineTo(px,py+20*sz);
      ctx.lineTo(px+8*sz,py+12*sz);
      ctx.lineTo(px+18*sz,py+14*sz);
      ctx.lineTo(px+28*sz,py+6*sz);
      ctx.lineTo(px+8*sz,py-4*sz);
      ctx.closePath(); ctx.fill();
    }else{
      // 先锋号：标准三角箭头
      ctx.beginPath();
      ctx.moveTo(px,py-22*sz);
      ctx.lineTo(px-16*sz,py+10*sz);
      ctx.lineTo(px-10*sz,py+18*sz);
      ctx.lineTo(px,py+12*sz);
      ctx.lineTo(px+10*sz,py+18*sz);
      ctx.lineTo(px+16*sz,py+10*sz);
      ctx.closePath(); ctx.fill();
    }

    // 驾驶舱
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.arc(px,py-6*sz,5*sz,0,Math.PI*2);
    ctx.fill();

    // 护盾（颜色随战机拖尾）
    if(shieldActive){
      ctx.strokeStyle=hexToRgba(s.trail||'#00ff88',0.4);
      ctx.lineWidth=2;
      SB(12);
      ctx.shadowColor=s.trail||'#00ff88';
      ctx.beginPath();
      ctx.arc(px,py,30*sz,0,Math.PI*2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // background gradient（缓存，避免每帧重建）
    ctx.fillStyle = bgGrad || '#0a0a2e';
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
      SB(e.boss?16:6);
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
          SB(eb.glow?12:5);
          ctx.fillStyle=eb.col||'#ff4757';
          ctx.beginPath();
          ctx.arc(eb.x,eb.y,eb.sz||4,0,Math.PI*2);
          ctx.fill();
          if(eb.glow){
            SB(20);
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
      var wt = b2.wt||'single';
      var bc = b2.col||'#00d4ff';
      ctx.shadowColor = bc;
      SB(wt==='laser'?18:9);
      ctx.fillStyle = bc;
      if(wt==='laser'){
        // 激光：红色长条强光
        ctx.fillRect(b2.x-3,b2.y-16,6,32);
        ctx.globalAlpha=0.35;
        ctx.fillRect(b2.x-5,b2.y-16,10,32);
        ctx.globalAlpha=1;
      }else if(wt==='spread'){
        // 散射：紫色小弹
        ctx.beginPath();
        ctx.arc(b2.x,b2.y,4,0,Math.PI*2);
        ctx.fill();
      }else if(wt==='barrage'){
        // 弹幕：金色弹+拖尾
        ctx.beginPath();
        ctx.arc(b2.x,b2.y,5,0,Math.PI*2);
        ctx.fill();
        ctx.globalAlpha=0.4;
        ctx.fillRect(b2.x-2,b2.y,4,10);
        ctx.globalAlpha=1;
      }else{
        // single/dual：渐变光弹
        var grad = ctx.createLinearGradient(b2.x-3,b2.y-8,b2.x+3,b2.y+8);
        grad.addColorStop(0,bc);
        grad.addColorStop(1,hexToRgba(bc,0.4));
        ctx.fillStyle = grad;
        ctx.fillRect(b2.x-3,b2.y-8,6,14);
      }
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
    if(shakeIntensity>0.5){ctx.save();ctx.translate((Math.random()-0.5)*shakeIntensity,(Math.random()-0.5)*shakeIntensity);}
    ctx.globalAlpha = 1;
    // player
    if(player && player.hp>0){
      drawShip(ctx, player.x, player.y, currentShip, player.invuln);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    // draw clones
    if(activeEffects.clone>0 && clones.length>0 && player && player.hp>0){
      ctx.globalAlpha = 0.55;
      for(var ci=0;ci<clones.length;ci++){
        var cx = player.x + clones[ci].offset, cy = player.y;
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        SB(8);
        ctx.beginPath();
        ctx.moveTo(cx,cy-18);
        ctx.lineTo(cx-13,cy+8);
        ctx.lineTo(cx-8,cy+15);
        ctx.lineTo(cx,cy+10);
        ctx.lineTo(cx+8,cy+15);
        ctx.lineTo(cx+13,cy+8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    // floating text draw
    for(var fti=0;fti<floatingTexts.length;fti++){
      var ft=floatingTexts[fti];
      ctx.globalAlpha=ft.life/40;
      ctx.fillStyle=ft.col||"#fff";
      ctx.font="bold 16px sans-serif";
      ctx.textAlign="center";
      ctx.shadowColor=ft.col||"#fff";
      SB(6);
      ctx.fillText(ft.text,ft.x,ft.y);
      ctx.shadowBlur=0;
    }
    ctx.globalAlpha=1;
    // shockwaves 冲击波环
    for(var i=0;i<shockwaves.length;i++){
      var sw=shockwaves[i];
      var a = sw.life/25;
      ctx.globalAlpha = a*0.8;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3*a+1;
      ctx.shadowColor = sw.color;
      SB(12);
      ctx.beginPath();
      ctx.arc(sw.x,sw.y,sw.r,0,Math.PI*2);
      ctx.stroke();
    }
    ctx.globalAlpha=1;
    ctx.shadowBlur=0;
    // combo display 增强（动态缩放）
    if(combo>5){
      var cScale = 1 + Math.min(combo*0.02,0.6);
      ctx.save();
      ctx.translate(W/2,60);
      ctx.scale(cScale,cScale);
      ctx.fillStyle='rgba(255,215,0,0.9)';
      ctx.font='bold 22px sans-serif';
      ctx.textAlign='center';
      ctx.shadowColor='#ffd700';
      SB(10);
      ctx.fillText('🔥 '+combo+' 连击!',0,0);
      ctx.restore();
      ctx.shadowBlur=0;
    }
    // 全屏闪光（BOSS击杀/核弹/必杀技等大事件）
    if(flashScreen>0){
      ctx.fillStyle='rgba(255,255,255,'+(flashScreen/8*0.5)+')';
      ctx.fillRect(0,0,W,H);
    }
  }

  // storage
  function save(){
    try{
      var d = {
        coins:coins, highScore:highScore, maxWave:maxWave,
        totalCoins:totalCoins, ks100:kills,
        ownedShips:ownedShips, ownedWeapons:ownedWeapons, currentWeapon:currentWeapon,
        dailyCollected:dailyCollected,
        boughtLife:boughtLife, boughtShield:boughtShield, boughtBoost:boughtBoost
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
        ownedWeapons = d.ownedWeapons||[0]; currentWeapon = d.currentWeapon||0;
        dailyCollected = d.dailyCollected||false;
        boughtLife = d.boughtLife||false;
        boughtShield = d.boughtShield||false;
        boughtBoost = d.boughtBoost||false;
      }
    }catch(e){}
    UI.updateCoins();
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
    useAbility: useAbility,
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
    getCurrentWeapon: function(){return currentWeapon;},
    setCurrentWeapon: function(v){currentWeapon=v;},
    getOwnedShips: function(){return ownedShips;},
    getOwnedWeapons: function(){return ownedWeapons;},
    getAchievements: function(){return achievements;},
    getDailyCollected: function(){return dailyCollected;},
    setDailyCollected: function(v){dailyCollected=v;},
    collectDaily: collectDaily,
    save: save,
    setBought: function(type,val){
      if(type==='life') boughtLife=val;
      else if(type==='shield') boughtShield=val;
      else if(type==='boost') boughtBoost=val;
    },
    getBought: function(type){
      if(type==='life') return boughtLife;
      if(type==='shield') return boughtShield;
      if(type==='boost') return boughtBoost;
      return false;
    },
    getInventory: function(){return inventory;},
    useInventory: useInventory,
    getActiveEffects: function(){return activeEffects;},
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
    document.getElementById('abBtn').style.display = 'flex';
    renderInventory();
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
        var equipped = Game.getCurrentWeapon()===i;
        var btnCls, btnTxt, btnAct;
        if(owned){
          btnCls = equipped?'equipped':'owned';
          btnTxt = equipped?'已装备':'装备';
          btnAct = equipped?'':'buyWeapon('+i+')';
        }else{
          btnCls = coins>=w.price?'buy':'locked';
          btnTxt = coins>=w.price?'🪙 '+w.price:'🔒 '+w.price;
          btnAct = coins>=w.price?'buyWeapon('+i+')':'';
        }
        return '<div class="item-card">'+
          '<div class="icon">🔫</div>'+
          '<div class="info"><div class="name">'+w.name+'</div><div class="desc">'+w.desc+'</div>'+
          (owned?'<div class="owned">'+(equipped?'✅ 已装备':'已拥有 · 点击装备')+'</div>':'')+'</div>'+
          '<button class="buy-btn '+btnCls+'" '+
          (btnAct?'onclick="UI.'+btnAct+'"':'')+'>'+
          btnTxt+'</button></div>';
      });
    }else if(tab==='道具'){
      var li=Game.getBought('life'), sh=Game.getBought('shield'), bo=Game.getBought('boost');
      items = [
        '<div class="item-card"><div class="icon">❤️</div><div class="info"><div class="name">额外生命</div><div class="desc">开局+2生命</div>'+(li?'<div class="owned">✅ 已拥有</div>':'')+'</div><button class="buy-btn '+(li?'owned':'buy')+'" onclick="UI.buyLife()">'+(li?'已拥有':'🪙 200')+'</button></div>',
        '<div class="item-card"><div class="icon">🛡️</div><div class="info"><div class="name">初始护盾</div><div class="desc">开局带护盾</div>'+(sh?'<div class="owned">✅ 已拥有</div>':'')+'</div><button class="buy-btn '+(sh?'owned':'buy')+'" onclick="UI.buyShield()">'+(sh?'已拥有':'🪙 150')+'</button></div>',
        '<div class="item-card"><div class="icon">⚡</div><div class="info"><div class="name">开局加速</div><div class="desc">开局速度+50%</div>'+(bo?'<div class="owned">✅ 已拥有</div>':'')+'</div><button class="buy-btn '+(bo?'owned':'buy')+'" onclick="UI.buyBoost()">'+(bo?'已拥有':'🪙 100')+'</button></div>'
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
    if(Game.getOwnedWeapons().indexOf(i)>=0){
      // 已拥有：装备
      Game.setCurrentWeapon(i);
      Game.save(); renderShop(); Audio.click();
      showNotif('🔫 已装备 '+w.name+'','');
      return;
    }
    if(Game.getCoins()>=w.price){
      Game.setCoins(Game.getCoins()-w.price);
      Game.getOwnedWeapons().push(i);
      Game.setCurrentWeapon(i);  // 购买后自动装备
      Game.save();
      updateCoins();
      renderShop();
      Audio.coin();
      showNotif('✅ 购买并装备 '+w.name+' 成功！','');
    }
  }
  function buyLife(){
    if(Game.getBought('life')){ showNotif('❤️ 已拥有，无需重复购买',''); return; }
    if(Game.getCoins()>=200){
      Game.setCoins(Game.getCoins()-200);
      Game.setBought('life',true);
      Game.save(); updateCoins(); Audio.coin();
      showNotif('❤️ 已购买额外生命，下局开局+2生命','');
    }
  }
  function buyShield(){
    if(Game.getBought('shield')){ showNotif('🛡️ 已拥有，无需重复购买',''); return; }
    if(Game.getCoins()>=150){
      Game.setCoins(Game.getCoins()-150);
      Game.setBought('shield',true);
      Game.save(); updateCoins(); Audio.coin();
      showNotif('🛡️ 已购买初始护盾，下局开局带护盾','');
    }
  }
  function buyBoost(){
    if(Game.getBought('boost')){ showNotif('⚡ 已拥有，无需重复购买',''); return; }
    if(Game.getCoins()>=100){
      Game.setCoins(Game.getCoins()-100);
      Game.setBought('boost',true);
      Game.save(); updateCoins(); Audio.coin();
      showNotif('⚡ 已购买开局加速，下局开局速度+50%','');
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
  function renderInventory(){
    var bar = document.getElementById('inventoryBar');
    if(!bar) return;
    var inv = Game.getInventory();
    var html = '';
    for(var i=0;i<inv.length;i++){
      if(inv[i]){
        html += '<div class="slot active" onclick="Game.useInventory('+i+')" style="border-color:'+(inv[i].color||'#00d4ff')+'"><span class="slot-key">'+(i+1)+'</span>'+inv[i].icon+'</div>';
      }else{
        html += '<div class="slot empty"><span class="slot-key">'+(i+1)+'</span>·</div>';
      }
    }
    bar.innerHTML = html;
  }
  function hideAll(){
    document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
    document.getElementById('gameHud').style.display = 'none';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('abBtn').style.display = 'none';
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
    showNotif:showNotif, updateCoins:updateCoins, renderInventory:renderInventory,
    showDaily:showDaily, hideDaily:hideDaily,
    collectDaily:collectDaily, watchDaily:watchDaily
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

