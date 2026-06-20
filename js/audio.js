var Audio = (function(){
  var ctx = null;
  function getCtx(){
    if(!ctx) try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
    return ctx;
  }
  function playTone(freq, dur, type, vol){
    var c = getCtx(); if(!c || !S.sfx) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type||'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime((vol||0.15)*0.5, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, vol){
    var c = getCtx(); if(!c || !S.sfx) return;
    var buf = c.createBuffer(1, c.sampleRate*dur, c.sampleRate);
    var d = buf.getChannelData(0);
    for(var i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    var s = c.createBufferSource();
    s.buffer = buf;
    var g = c.createGain();
    g.gain.setValueAtTime((vol||0.08), c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+dur);
    s.connect(g); g.connect(c.destination);
    s.start();
  }
  return {
    shoot: function(){ playTone(800,0.08,'square',0.1); },
    explosion: function(){ noise(0.3,0.12); playTone(100,0.2,'sawtooth',0.15); },
    powerup: function(){ playTone(600,0.1,'sine',0.12); setTimeout(function(){playTone(900,0.15,'sine',0.12)},100); },
    hit: function(){ playTone(300,0.06,'square',0.08); },
    bossWarning: function(){ playTone(200,0.3,'square',0.1); setTimeout(function(){playTone(250,0.3,'square',0.1)},400); },
    gameOver: function(){ playTone(400,0.15,'sawtooth',0.1); setTimeout(function(){playTone(300,0.15,'sawtooth',0.1)},200); setTimeout(function(){playTone(200,0.3,'sawtooth',0.1)},400); },
    click: function(){ playTone(1000,0.04,'sine',0.06); },
    coin: function(){ playTone(1200,0.06,'sine',0.1); setTimeout(function(){playTone(1500,0.08,'sine',0.1)},80); }
  };
})();