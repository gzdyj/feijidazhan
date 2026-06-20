
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
