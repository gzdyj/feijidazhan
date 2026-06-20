
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
      if(e.boss){
        e.shootTimer=(e.shootTimer||0)+1;
        if(e.shootTimer%30===0){
          enemyFire(e);
        }
      }
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
          eb.y+=eb.vy||3;
          if(eb.y>H||eb.y<-10||eb.x<-10||eb.x>W+10){ e.bullets.splice(k,1); continue; }
          if(player && player.hp>0){
            var ddx=eb.x-player.x, ddy=eb.y-player.y;
            if(Math.sqrt(ddx*ddx+ddy*ddy)<22){
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
    var bossHp = 30 + wave*5;
    enemies.push({
      x:W/2, y:-60, r:40, hp:bossHp, maxHp:bossHp,
      speed:0.8, color:'#ff4757', score:2000,
      boss:true, bullets:[], shootTimer:0
    });
  }

  function enemyFire(e){
    if(!player) return;
    var angle = Math.atan2(player.y-e.y, player.x-e.x);
    if(!e.bullets) e.bullets=[];
    e.bullets.push({x:e.x,y:e.y+20,vy:4,vx:Math.cos(angle)*1.5});
    if(wave>10){
      e.bullets.push({x:e.x-15,y:e.y+20,vy:4.5,vx:Math.cos(angle)*1.5-1.5});
      e.bullets.push({x:e.x+15,y:e.y+20,vy:4.5,vx:Math.cos(angle)*1.5+1.5});
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
          ctx.shadowColor='#ff4757';
          ctx.shadowBlur=6;
          ctx.fillStyle='#ff4757';
          ctx.beginPath();
          ctx.arc(eb.x,eb.y,4,0,Math.PI*2);
          ctx.fill();
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
