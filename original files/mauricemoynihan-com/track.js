/* track.js — tells Google Analytics what people DO on a page, not just that they opened it.
   13 Oct 2026, his call: "we should be tracking as much as possible".

   ⛔ THE DETAIL IS IN THE EVENT NAME (click_advertising, music_play_04_monty, scroll_75…), not in
   parameters. The analytics login we read with is a read-only Viewer, and GA will not hand back a
   custom parameter until someone registers it in the admin screens. Event names come back free, and
   GA's own pagePath says which page each one happened on.
   Read them: python3 tools/ga.py --by event   (or --by event-page for event × page)

   His own visits: open any page once with ?me and that browser stops reporting at all; ?notme
   undoes it. The switch lives in the inline GA snippet in each page's <head>, not here, because it
   has to run before gtag('config') does. Preview URLs (*.pages.dev) and localhost never report. */
/* ⛳ 17 Oct 2026, his ask: see visitors as they happen ("why can the adnauseum chat get real time data but you can't
   for my site?"). GA lags hours, so every page view and every event below ALSO goes, the moment it happens, to our
   own log: functions/api/hit.js → the Cloudflare D1 database mm-visits. Read it: python3 tools/visits.py
   Same owner switch: a ?me browser sends nothing, and neither do previews — unless ?hittest (marked as a test). */
(function(){
  var me=false; try{ me=!!localStorage.getItem('mm_me'); }catch(_){}
  var test=/[?&]hittest(=|&|$)/.test(location.search);
  if((me||!/(^|\.)mauricemoynihan\.com$/.test(location.hostname))&&!test){ window.mmHit=function(){}; return; }
  function id(store,k){ try{ var v=store.getItem(k); if(!v){ v=Math.random().toString(36).slice(2,12); store.setItem(k,v); } return v; }catch(_){ return null; } }
  var vid=id(localStorage,'mm_vid'), sid=id(sessionStorage,'mm_sid'), n=0, ref='';
  try{ var rh=document.referrer&&new URL(document.referrer).hostname; if(rh&&rh!==location.hostname) ref=rh.replace(/^www\./,''); }catch(_){}
  window.mmHit=function(ev,secs){
    if(++n>300)return;   /* one page can't flood the log */
    var b=JSON.stringify({ev:ev,p:location.pathname,r:ref,vid:vid,sid:sid,w:innerWidth,s:secs,t:test?1:0});
    try{ if(navigator.sendBeacon&&navigator.sendBeacon('/api/hit',b))return; }catch(_){}
    try{ fetch('/api/hit',{method:'POST',body:b,keepalive:true}); }catch(_){}
  };
  mmHit('view');
})();
(function(){
  var gtag=window.gtag||function(){};
  function T(n){
    n=String(n).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
    if(n){ gtag('event',n); if(window.mmHit)mmHit(n); }
  }
  var seen={};
  function T1(n){ if(seen[n])return; seen[n]=1; T(n); }
  window.mmTrack=T;

  /* how far down the page they got */
  function depth(){
    var d=document.documentElement, max=d.scrollHeight-innerHeight;
    if(max<40)return;
    var p=scrollY/max*100;
    [25,50,75,100].forEach(function(m){ if(p>=m-1)T1('scroll_'+m); });
  }
  addEventListener('scroll',depth,{passive:true});

  /* how long they stayed, counting only time the tab was actually in front */
  var shown=0, since=document.hidden?0:Date.now();
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){ if(since)shown+=Date.now()-since; since=0; } else since=Date.now();
  });
  /* our own log: how long the page was actually in front, sent as they leave */
  var left=false;
  addEventListener('pagehide',function(){ if(left||!window.mmHit)return; left=true; mmHit('leave',(shown+(since?Date.now()-since:0))/1000); });
  setInterval(function(){
    var t=(shown+(since?Date.now()-since:0))/1000;
    if(t>=30)T1('stayed_30s'); if(t>=120)T1('stayed_2m'); if(t>=300)T1('stayed_5m'); if(t>=900)T1('stayed_15m');
  },5000);

  /* every link and button. Internal links by page, outbound by site, buttons by label. */
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href],button,[role=button],summary');
    if(!a)return;
    if(a.tagName==='A'){
      var u; try{ u=new URL(a.getAttribute('href'),location.href); }catch(_){ return; }
      if(u.protocol==='mailto:')return T('click_email');
      if(u.protocol==='tel:')return T('click_phone');
      if(u.host!==location.host)return T('out_'+u.hostname.replace(/^www\./,''));
      if(u.pathname===location.pathname&&u.hash)return T('click_jump_'+u.hash.slice(1));
      return T('click_'+(u.pathname.replace(/\.html$/,'').replace(/^\/+|\/+$/g,'')||'home'));
    }
    T('press_'+(a.getAttribute('aria-label')||a.id||a.textContent||'button').trim().slice(0,30));
  },true);

  /* homepage menu rows: a hover that lingers (600ms) deals the cards — that counts as a look */
  var fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  if(fine)[].forEach.call(document.querySelectorAll('.item'),function(row){
    var t, name=(row.querySelector('.item__title')||row).textContent;
    row.addEventListener('pointerenter',function(){ t=setTimeout(function(){ T1('hover_'+name); },600); });
    row.addEventListener('pointerleave',function(){ clearTimeout(t); });
  });

  /* the liquid name: did they put the cursor (or a finger) through the ink. The canvas takes no
     pointer events (liquid.js listens on the document), so test against its box the same way. */
  var ink=document.querySelector('.hero__liquid');
  if(ink){
    var over=function(x,y){
      var r=ink.getBoundingClientRect();
      if(r.width&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)T1('name_stirred');
    };
    document.addEventListener('pointermove',function(e){ if(!seen.name_stirred)over(e.clientX,e.clientY); },{passive:true});
    document.addEventListener('touchmove',function(e){ var t=e.touches[0]; if(t&&!seen.name_stirred)over(t.clientX,t.clientY); },{passive:true});
  }

  /* the bottom of the homepage: the dissolve, and the scene behind it */
  if('IntersectionObserver' in window){
    /* 16 Oct: egg_scene_seen watched the rat (#egg-art), long gone — it never fired. Now the deep sea's canvas. */
    [['egg','egg_reached'],['deep','egg_scene_seen']].forEach(function(p){
      var el=document.getElementById(p[0]); if(!el)return;
      var io=new IntersectionObserver(function(es){
        if(es[0].isIntersecting){ T1(p[1]); io.disconnect(); }
      },{threshold:0});   /* the dissolve is several screens tall: any of it showing counts */
      io.observe(el);
    });
  }

  /* songs and films. Songs by file name; films by their order on the page (the page says which). */
  function media(m){
    if(m.tagName==='AUDIO'){
      var f=(m.currentSrc||m.src||'').split('/').pop().replace(/\.\w+(\?.*)?$/,'');
      return 'music_%_'+f;
    }
    var all=document.querySelectorAll('video'), i=[].indexOf.call(all,m);
    return 'video_%'+(all.length>1?'_'+(i+1):'');
  }
  var half=new WeakMap();
  function onPlay(e){ T(media(e.target).replace('%','play')); }
  function onEnd(e){ T(media(e.target).replace('%','done')); }
  function onTime(e){
    var m=e.target, src=m.currentSrc;
    if(!m.duration||half.get(m)===src||m.currentTime<m.duration/2)return;
    half.set(m,src); T(media(m).replace('%','half'));
  }
  /* films are on the page, so their events reach the document... */
  document.addEventListener('play',function(e){ if(e.target.isConnected)onPlay(e); },true);
  document.addEventListener('ended',function(e){ if(e.target.isConnected)onEnd(e); },true);
  document.addEventListener('timeupdate',function(e){ if(e.target.isConnected)onTime(e); },true);
  /* ...but the music player's audio is never put on the page (new Audio()), so its events never
     reach the document. Catch it the first time anything calls play() on it. */
  var bound=new WeakSet(), play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){
    if(!this.isConnected&&!bound.has(this)){
      bound.add(this);
      this.addEventListener('play',onPlay); this.addEventListener('ended',onEnd); this.addEventListener('timeupdate',onTime);
      if(!this.paused)onPlay({target:this});
    }
    return play.apply(this,arguments);
  };
  document.addEventListener('fullscreenchange',function(){ if(document.fullscreenElement)T('fullscreen'); });
  document.addEventListener('webkitfullscreenchange',function(){ if(document.webkitFullscreenElement)T('fullscreen'); });

  /* the small tells */
  document.addEventListener('copy',function(){ T('copied_text'); });
  document.addEventListener('contextmenu',function(e){ T(e.target.tagName==='IMG'?'right_click_image':'right_click'); });
  addEventListener('beforeprint',function(){ T('printed'); });
})();
