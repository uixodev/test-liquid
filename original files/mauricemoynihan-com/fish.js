/* ---- The bottom of the homepage: something lives down there ----
   ⛳ 13 Oct: replaces the rat. An anglerfish in the dark at the end of the page. Its light is the only
   bright thing down there, and it brings it to you. Touch it and the light goes out.
   The picture is ONE still (designs/fish-mj/make_fish.py keys the black out); the swimming is the
   still cut into thin upright strips, each pushed up or down on a wave that runs head to tail, the
   tail moving most. That is how a fish actually swims, so it needs no drawn frames.
   The art faces LEFT. Head is the left of the picture.
   ⛳ 13 Oct, his ask: "they shouldn't all be mean and angry". Jellyfish drift behind it (four drawings,
   tinted), then "add some variation and other creatures": glass squid, a school of hatchetfish, and a
   giant squid that surfaces faintly from the dark every half minute or so. Then a crown jelly, a comb
   jelly whose rows of light run through the rainbow, a dumbo octopus, and marine snow ("super subtle"). Their swim is the same trick turned on its side: horizontal strips, the bell
   squeezing on each pulse (which pushes the animal up) and the tentacles swaying and trailing behind.
   A hand nudges them away and they pulse faster and brighten. When the anglerfish's light goes out,
   they go dark too, and come back slowly. */
(function(){
  "use strict";
  var cv=document.getElementById('deep');
  if(!cv||!cv.getContext)return;
  var ctx=cv.getContext('2d');   /* swapped briefly to an off-screen canvas by drawGiant */
  var still=window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* Measured off the source (make_fish.py prints the lure). Fractions of the picture. */
  var LURE={x:.1204,y:.1761}, LURE_R=.09;   /* the glow disc baked into the art */
  var MOUTH={x:.17,y:.58};

  var img=new Image(), ready=false;
  var W=0,H=0,dpr=1, fw=0, fh=0;           /* canvas size, fish draw size (CSS px) */
  /* dir: +1 facing left (as drawn), -1 facing right. A turn runs P from 0 to 1; see cOf. */
  var fish={x:0,y:0,vx:0,vy:0,dir:1,dirFrom:1,P:1,turnDur:1400,lastTurn:-1e4,side:-1,phase:0,beat:.7,tx:0,ty:0,next:0};
  var JAW=[[70,245],[120,249],[170,261],[214,278],[238,300],[244,338],[200,350],[140,336],[96,316],[71,290]];  /* lower jaw, in angler_a.webp px */
  var JAW_FRONT=[[60,240],[120,249],[168,260],[168,332],[140,340],[96,320],[60,292]];
  var HINGE=[216,284], JAW_DEG=22, jawPics=[], jaw=0, jawTo=0, posed=false;
  var light=1, lightTo=1;                  /* 1 = lit, 0 = out */
  var seen=1;                              /* how much of the fish shows: 1 lit, ~0 in the dark */
  var ptr={x:-1e4,y:-1e4,in:false,still:0,lx:0,ly:0,speed:0,t:0};
  var noteP={x:0,y:0,dead:false,landed:false,r:0}, lungeNote=false;   /* the free $100 (see step) */
  var mode='wander', modeT=0, lungeFrom=null, onLure=0, biteAgain=0, stalk=0;
  var running=false, last=0, visible=false;

  var jready=false, jellies=[], jl=1;
  var TINTS=[null,'#8d55ff','#ff5aa8'];    /* as drawn (blue), violet, pink */

  /* ⛳ 18 Oct, his call: "I want everyone to be able to use the website without issue". perf.js watches the frame rate in the deep
     and, on a slow machine, raises window.mmPerf.level: 1 = lower resolution + no glows/smoke, 2 = fewer strips in the moving art,
     3 = lowest resolution. NS(n) is the strip count for a level. */
  function PL(){ return (window.mmPerf&&window.mmPerf.level)||0; }
  function NS(n){ return still?1:PL()>=2?Math.max(6,Math.round(n/3)):n; }
  addEventListener('mmperf',function(){ size(); });
  function size(){
    var r=cv.getBoundingClientRect();
    dpr=Math.min(window.devicePixelRatio||1,[1.5,1,1,.75][PL()]);   /* ⛔ 15 Oct (frame rate): was 2. Painted art in the dark; 1.5 is plenty. 18 Oct: perf.js steps it down on slow machines */
    W=r.width; H=r.height;
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
    fw=Math.max(135,Math.min(W*.2,280));   /* 10:14pm: the hero, a touch bigger (was .18 / 250) */ fh=fw*(img.naturalHeight/img.naturalWidth||.669);   /* 13 Oct: halved, his call */
    if(ready&&!fish.x){ fish.x=W*.72; fish.y=H*.55; pickSpot(); }
    if(jready&&!cast) makeCast();
    if(!running) draw(performance.now());
  }

  function rnd(a,b){ return a+Math.random()*(b-a); }
  function pickSpot(){
    fish.tx=rnd(fw*.6,W-fw*.6); fish.ty=rnd(H*.3,H*.8);
    fish.next=performance.now()+rnd(5000,11000);
  }

  /* ⛳ 13 Oct, "the angler fish turning looks really janky". It used to squeeze flat slowly (1.4s) and
     flip whenever it drifted backwards. Now a turn is a commitment (it finishes, and it will not turn
     again for a few seconds unless frightened), it never swims backwards, and it is quick, dimmed
     edge-on and lifted a little. (A head-first fold was tried: see L in cOf.)
     cOf(u) is the horizontal scale of the strip at u (0 head … 1 tail): +1 as drawn, -1 mirrored. */
  function cOf(u){
    if(fish.P>=1) return fish.dir;
    /* L is the head-first stagger. ⛔ It was .5 and the body folded over itself, but a fold of a flat
       picture always leaves a straight crease that reads as the fish being cropped (he caught it).
       0: the whole fish turns at once, quickly, dimmed edge-on. */
    var L=0, p=Math.max(0,Math.min(1,(fish.P-u*L)/(1-L))), e=p*p*(3-2*p);
    return fish.dirFrom*Math.cos(Math.PI*e);
  }
  function lift(){ return fish.P<1?-Math.sin(Math.PI*fish.P)*fh*.09:0; }
  function turnTo(d,dur,now,cool){   /* cool: ms since the last turn before another is allowed */
    if(d===fish.dir||fish.P<1) return;
    if(now-fish.lastTurn<cool) return;
    fish.dirFrom=fish.dir; fish.dir=d; fish.P=0; fish.turnDur=dur; fish.lastTurn=now; fish.swish=1; fish.beat+=1.2;
  }
  /* Where the lure / mouth are on screen right now, allowing for which way (and how far round) it faces:
     the same end-to-end chain the strips are laid in (see draw), measured to u. */
  function chainAt(u){
    var n=30, a=0, b=0, i, c;
    for(i=0;i<n;i++){ c=cOf((i+.5)/n)*fw/n; if((i+.5)/n<u) a+=c; b+=c; }
    return a-b/2;
  }
  function at(p){
    return {x:fish.x+chainAt(p.x), y:fish.y+(p.y-.5)*fh+lift()};
  }

  /* The bite needs the mouth to shut, and there is only one drawing, so the lower jaw is cut out of it
     and swung up about the corner of the mouth: five frames, made once. */
  function makeJaw(){
    var iw=img.naturalWidth, ih=img.naturalHeight, k=iw/600, body=tinted(img,null,0);   /* graded like the rest (16 Oct) */
    function path(x){ x.beginPath(); JAW.forEach(function(p,i){ x[i?'lineTo':'moveTo'](p[0]*k,p[1]*k); }); x.closePath(); }
    for(var f=0;f<5;f++){
      var o=document.createElement('canvas'); o.width=iw; o.height=ih; var x=o.getContext('2d');
      x.drawImage(body,0,0);
      if(f){
        /* What the jaw uncovers. At the front, nothing: the swung jaw is the new chin. Near the hinge, the
           body behind it, in shadow, and only where there was fish (source-atop keeps the outline). */
        x.save(); path(x); x.clip(); x.globalCompositeOperation='source-atop'; x.fillStyle='#070b1c'; x.fillRect(0,0,iw,ih); x.restore();
        x.save(); x.beginPath(); JAW_FRONT.forEach(function(p,i){ x[i?'lineTo':'moveTo'](p[0]*k,p[1]*k); }); x.closePath(); x.clip(); x.clearRect(0,0,iw,ih); x.restore();
        x.save(); x.translate(HINGE[0]*k,HINGE[1]*k); x.rotate(JAW_DEG*f/4*Math.PI/180); x.translate(-HINGE[0]*k,-HINGE[1]*k);
        path(x); x.clip(); x.drawImage(body,0,0); x.restore();
      }
      jawPics.push(o);
    }
  }
  var layer=null;
  /* ⛔ 15 Oct (frame rate): this was a whole-window layer at retina size, cleared and laid down every frame —
     the most expensive thing on the page. It only ever needs the box round the fish. */
  function fishLayer(){
    if(!layer) layer=document.createElement('canvas').getContext('2d');
    var w=Math.ceil(fw*1.8*dpr), h=Math.ceil(fh*2*dpr);
    if(layer.canvas.width!==w||layer.canvas.height!==h){ layer.canvas.width=w; layer.canvas.height=h; }
    return layer;
  }
  /* ⛔ 16 Oct, his catch: "the cursor didn't reappear after the anglerfish ate it". It is let go by the animation,
     and the animation stops when the deep sea is off screen — scroll away mid-bite and the glove stayed invisible
     across the whole page. Now a timer lets go regardless, and leaving the deep sea lets go at once. */
  var gloveEl=null, gloveTimer=0, bites=0, T=function(n){ if(window.mmTrack)window.mmTrack(n); };   /* GA, once per page (16 Oct) */
  function gloveHidden(h){
    gloveEl=gloveEl||document.getElementById('glove');
    if(gloveEl) gloveEl.style.opacity=h?'0':'';
    clearTimeout(gloveTimer);
    if(h) gloveTimer=setTimeout(letGo,3600);
  }
  function letGo(){
    if(gulp.snack){ jawTo=0; gulp.snack=0; }
    if(jawTo===1) spit(performance.now(),visible);
    gloveHidden(false);
    if(mode==='lunge'||mode==='dark'||mode==='retreat'){ mode='wander'; modeT=performance.now(); }
  }

  function local(e){
    var r=cv.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top,inside:e.clientY>=r.top&&e.clientY<=r.bottom};
  }
  function move(e){
    var p=local(e), now=performance.now(), dt=Math.max(16,now-ptr.t);
    ptr.speed=Math.hypot(p.x-ptr.x,p.y-ptr.y)/dt*1000;
    if(Math.hypot(p.x-ptr.lx,p.y-ptr.ly)>14){ ptr.still=now; ptr.lx=p.x; ptr.ly=p.y; }
    ptr.x=p.x; ptr.y=p.y; ptr.in=p.inside; ptr.t=now;
  }
  /* Mouse/pen through pointer events. ⛳ 13 Oct, phones ("can we make it so people can interact with the fish
     on mobile"): fingers go through TOUCH events instead, because a pointer is cancelled the moment the
     page starts to scroll and touch events keep coming. Nothing here ever blocks the scroll. A finger only
     counts while it is down (plus a moment after, so a strike can land); lifted, the hunt is off. */
  addEventListener('pointermove',function(e){ if(e.pointerType!=='touch') move(e); },{passive:true});
  addEventListener('pointerdown',function(e){ if(e.pointerType!=='touch'){ move(e); poke(); } },{passive:true});
  document.addEventListener('pointerleave',function(){ ptr.in=false; });
  var upTimer=0;
  function touchAt(e,start){
    var t=e.touches[0]; if(!t) return;
    if(start){ var p=local(t); ptr.x=ptr.lx=p.x; ptr.y=ptr.ly=p.y; ptr.t=performance.now(); }   /* no jump from the last touch */
    move(t); clearTimeout(upTimer);
    if(start&&ptr.in){ poke(); ripples.push({x:ptr.x,y:ptr.y,t:performance.now()}); }
  }
  cv.addEventListener('contextmenu',function(e){ e.preventDefault(); });   /* see .egg__deep in style.css */
  addEventListener('touchstart',function(e){ touchAt(e,true); },{passive:true});
  addEventListener('touchmove',function(e){ touchAt(e,false); },{passive:true});
  addEventListener('touchend',function(e){ if(!e.touches.length) upTimer=setTimeout(function(){ ptr.in=false; },600); },{passive:true});

  /* A tap (or a click) right on something. The anglerfish's light: it strikes at once. A drifter: it
     lights up and jets off. The hatchetfish: they scatter. */
  var ripples=[];
  function poke(){
    if(!ptr.in) return;
    var now=performance.now(), hit=false;
    if(ready&&(mode==='wander'||mode==='lure')&&now>biteAgain&&fish.P>=1&&!bites){
      var l=at(LURE);
      if(Math.hypot(ptr.x-l.x,ptr.y-l.y)<Math.max(34,fw*.25)){ onLure=0; stalk=0; sputterUntil=now+700; setMode('dark',now); return; }   /* 17 Oct: sputters, never goes out (the stem's stub showed) */
    }
    if(ready&&Math.abs(ptr.x-fish.x)<fw*.48&&Math.abs(ptr.y-fish.y)<fh*.45){ hit=true; pokeAngler(now); return; }
    jellies.forEach(function(j){
      var cx=j.x, cy=j.y+j.h*.3, d=Math.hypot(cx-ptr.x,cy-ptr.y)||1;
      if(d<Math.max(40,j.w*.9)){ hit=true; puffBubbles(cx,cy,rnd(3,6)|0,(cx-ptr.x)/d*-30,-20); j.boost=1; j.vx+=(cx-ptr.x)/d*j.w*1.6; j.vy+=(cy-ptr.y)/d*j.w*1.2-j.w*.3; j.ph=0; }
    });
    swimmers.forEach(function(m){ if(Math.hypot(m.x-ptr.x,m.y-ptr.y)<Math.max(50,m.w*.6)){ hit=true; spook(m,now); } });
    worms.forEach(function(w){ var r=wormRect(w); if(r&&Math.hypot(ptr.x-(w.flip?2*r.bx-r.mx:r.mx),ptr.y-r.my)<Math.max(60,r.h*.7)){ hit=true; hideWorm(w,now,0); } });
    if(ptr.y>groundY()-30){ hit=true; kickSilt(ptr.x,Math.max(ptr.y,groundY()-10),22,110); }
    if(school) school.fish.forEach(function(f){
      var d=Math.hypot(f.x-ptr.x,f.y-ptr.y)||1;
      if(d<120){ if(d<50) hit=true; if(Math.random()<.5) puffBubbles(f.x,f.y,2,0,-15); f.vx+=(f.x-ptr.x)/d*260; f.vy+=(f.y-ptr.y)/d*200; f.beat=4; }
    });
    /* ⛔ 16 Oct, "the regular food doesn't appear when you click sometimes": a click anywhere near a creature, a worm or
       the seabed counted as touching it and dropped nothing. Now every click above the seabed feeds; creatures still react. */
    if(ptr.y<groundY()-20) dropThing(ptr.x,ptr.y,now);
  }

  function setMode(m,now){ mode=m; modeT=now; }

  function step(now,dt){
    var s=dt/1000, l=at(LURE), d=Math.hypot(ptr.x-l.x,ptr.y-l.y);
    var near=ptr.in&&Math.hypot(ptr.x-fish.x,ptr.y-fish.y)<fw*.7;

    /* ⛳ 16 Oct: food in the water. The anglerfish goes for any morsel near its mouth: a quick dart and a snap. */
    /* ⛔ 16 Oct 9:55pm, "the behaviour of the anglerfish deciding between eating the food and looking at the cursor is
       erratic": after each flake it dropped back to the hand, saw the next flake, flipped again. Now feeding is a
       commitment: it works through the food near it one bite at a time (a short chew between, nearest next, never
       turning for a flake that's only just behind it), and only goes back to the hand 1.2s after the food runs out. */
    function nextFlake(R){
      var fm=at(MOUTH), best=null, bd=R;
      food.forEach(function(f){ if(!f.dead&&!f.landed){ var dd=Math.hypot(f.x-fm.x,f.y-fm.y)+(((f.x-fish.x)*fish.dir>0)?fw*.6:0); if(dd<bd){ bd=dd; best=f; } } });
      return best;
    }
    /* ⛳ 18 Oct 5:26pm: the $100 off the homepage lure (lure.js) slips its hook in the deep and drifts free — the anglerfish goes
       straight for it (fast, snack mode) and eats it. Its screen position comes in as window.mmFreeNote. */
    var FN=window.mmFreeNote;
    if(FN&&FN.live&&!FN.dead&&ready){ var fcr=cv.getBoundingClientRect(); noteP.x=FN.sx-fcr.left; noteP.y=FN.sy-fcr.top; noteP.r=fw*.12;   /* a big target: once it's at the fish's face, it's eaten (it could stall just behind the mouth) */
      if(mode==='wander'||mode==='lure'){ setMode('snack',now); fish.prey=noteP; } }
    /* ⛔ 10:33pm, his call: "the angler fish shouldn't eat the fish food". It's a hunter; the flakes are for the others. */
    if(mode==='snack'){
      var pr=fish.prey, mo=at(MOUTH);
      if(gulp.snack){
        fish.vx*=.9; fish.vy*=.9;
        if(now-gulp.snack>380){ jawTo=0; gulp.snack=0;
          var nx=nextFlake(fw*3); if(nx){ fish.prey=nx; modeT=now; } else { fish.feedUntil=now+1200; setMode('wander',now); pickSpot(); } }
      }
      else if(!pr||pr.dead||pr.landed||now-modeT>4000){
        var nx2=nextFlake(fw*3); if(nx2&&now-modeT<=4000){ fish.prey=nx2; } else { fish.feedUntil=now+1200; setMode('wander',now); pickSpot(); }
      }
      else {
        fish.tx=fish.x+(pr.x-mo.x); fish.ty=fish.y+(pr.y-mo.y);
        /* ⛳ 18 Oct 6:33pm, his ask: "shouldn't the anglerfish do the same pounce when eating the note as it does the hand?" — once it's
           close it stops, the light sputters (the tell), it coils, and strikes */
        if(pr===noteP&&fish.P>=1&&Math.hypot(pr.x-mo.x,pr.y-mo.y)<fw*.85){ lungeNote=true; onLure=0; stalk=0; sputterUntil=now+600; setMode('dark',now); return; }
        if(Math.abs(pr.x-fish.x)>fw*.5) turnTo(pr.x<fish.x?1:-1,150,now,700);
        if(Math.hypot(pr.x-mo.x,pr.y-mo.y)<Math.max(16,fw*.08,pr.r||0)){ pr.dead=true; if(pr===noteP&&FN){ FN.dead=true; gulp.thump=1; for(var nb=0;nb<14;nb++) mouthBubble(nb<3?rnd(5,10):rnd(2,5),1); }   /* and a burst as it gulps the note */ jawTo=1; gulp.snack=now; fedOnce();
          for(var q=0;q<3;q++) mouthBubble(rnd(2,4),.25); }
      }
    }
    if(mode==='wander'||mode==='lure'){
      /* A fast hand nearby frightens it off — only when it isn't hunting (i.e. during the grace after a bite). */
      if(mode==='wander'&&near&&ptr.speed>2600&&now-ptr.t<80){   /* only a violent flick, and never while hunting */
        setMode('flee',now);
        var a=Math.atan2(fish.y-ptr.y,fish.x-ptr.x);
        fish.tx=Math.max(fw*.5,Math.min(W-fw*.5,fish.x+Math.cos(a)*W*.45));
        fish.ty=Math.max(fh*.4,Math.min(H-fh*.4,fish.y+Math.sin(a)*H*.3));
      }
      /* ⛳ 13 Oct, "shouldn't it hunt the cursor a bit more aggressively": it no longer waits for a still hand.
         A hand anywhere in the dark is hunted: it closes in, keeps the light dangling just in front of you,
         swings round when you get behind it, and if you hover at its face without taking the bait it
         strikes anyway (see stalk below). */
      /* ⛳ 16 Oct, his call: once it has caught you and spat you out, it stops hunting until the page is reloaded. The
         joke lands once. ⛔ First cut still bit if the hand met its light ("it ate it twice ... i didnt reload"): now
         nothing makes it bite again — not the light, not hovering, not a tap. */
      else if(ptr.in&&now>biteAgain&&!bites&&now>(fish.feedUntil||0)){
        if(mode!=='lure'){ setMode('lure',now); fish.side=ptr.x<fish.x?-1:1; stalk=0; }
        if(ptr.x<fish.x-fw*.35) fish.side=-1; else if(ptr.x>fish.x+fw*.35) fish.side=1;
        var side=fish.side;
        fish.tx=ptr.x-(LURE.x-.5)*fw*-side-side*fw*.1; fish.ty=ptr.y-(LURE.y-.5)*fh+fh*.1;
      }
      else if(mode==='lure'){ setMode('wander',now); pickSpot(); }
      else if(now>fish.next) pickSpot();

      /* Touch the light and keep your finger on it. */
      /* 13 Oct: easier — "i thought the angler fish was going to bite the cursor?". It was a long hold on a
         small target; now a touch does it. */
      /* ⛔ 16 Oct 9:08pm, "the angler fish pounces from too far away from the hand": it could strike from most of a
         body-length off (stalk counted anywhere within .9 of a fish of the LIGHT), so it crossed the screen in 110ms.
         Now it only strikes when its MOUTH is a short snap from the hand, and it creeps in to get there. */
      var mo=at(MOUTH), dm=Math.hypot(ptr.x-mo.x,ptr.y-mo.y), close=dm<fw*.42;
      if(ptr.in&&d<Math.max(26,fw*.17)){ onLure+=dt; } else onLure=Math.max(0,onLure-dt*2);
      if(mode==='lure'&&close) stalk+=dt; else stalk=Math.max(0,stalk-dt);
      if(fish.P>=1&&now>biteAgain&&!bites&&close&&(onLure>110||stalk>900)){ onLure=0; stalk=0; sputterUntil=now+700; setMode('dark',now); }
    }

    /* The light snaps off — the tell — and it holds still for a beat. ⛔ The fish itself used to fade into the
       dark here too; he called it weird. It stays fully visible now (seen stays 1). */
    if(mode==='dark'){ fish.vx=fish.vy=0;
      /* the coil: it eases back a few px from the hand before it snaps */
      var LT=lungeNote?noteP:ptr, cm=at(MOUTH), cx=cm.x-LT.x, cy=cm.y-LT.y, cd=Math.hypot(cx,cy)||1, ck=Math.min(1,(now-modeT)/320)*dt/1000*30;
      fish.x+=cx/cd*ck; fish.y+=cy/cd*ck; }
    if(mode==='dark'&&now-modeT>320){
      /* Out of the black, at the hand. */
      setMode('lunge',now);
      var m=at(MOUTH);
      lungeFrom={x:fish.x,y:fish.y};
      var LT2=lungeNote?noteP:ptr; fish.tx=fish.x+(LT2.x-m.x); fish.ty=fish.y+(LT2.y-m.y);
    }
    if(mode==='lunge'){
      var k=Math.min(1,(now-modeT)/110), e=1-Math.pow(1-k,3);
      fish.x=lungeFrom.x+(fish.tx-lungeFrom.x)*e; fish.y=lungeFrom.y+(fish.ty-lungeFrom.y)*e;
      fish.vx=fish.vy=0; fish.beat=3; seen=1;
      if(lungeNote){
        if(now-modeT>90&&jawTo!==1){ jawTo=1; noteP.dead=true; var FN2=window.mmFreeNote; if(FN2) FN2.dead=true; gulp.thump=1; gulp.ang=rnd(0,6.28);
          /* 6:33pm "the bubbles when it eats the note feel not energetic enough": a big burst out of the jaws */
          for(var nb2=0;nb2<30;nb2++) mouthBubble(nb2<5?rnd(7,13):rnd(2,6),1.8); }
        if(now-modeT>480&&jawTo===1){ jawTo=0; gulp.recoil=1; for(var nb3=0;nb3<8;nb3++) mouthBubble(rnd(2,5),.8); }   /* a chew, a swallow */
        if(now-modeT>800){ lungeNote=false; setMode('wander',now); pickSpot(); fish.feedUntil=now+2500; }
        return;
      }
      if(now-modeT>90&&jawTo!==1){ jawTo=1; gloveHidden(true); if(!bites++) T('angler_bite');
        /* 18 Oct 5:39pm, his ask: a burst of bubbles as the jaws close on the hand */
        for(var bb=0;bb<16;bb++) mouthBubble(bb<3?rnd(6,11):rnd(2,5),1.1); }   /* shut, with your hand in it */
      if(now-modeT>900){   /* swims off with it, mouth shut: straight ahead, a good way */
        setMode('retreat',now); fish.next=now+8000;
        fish.tx=Math.max(fw*.6,Math.min(W-fw*.6,fish.x-fish.dir*W*.3)); fish.ty=Math.max(H*.25,Math.min(H*.8,fish.y+rnd(-60,60)));
      }
      return;
    }
    if(mode==='dark')return;
    if(fish.P<1&&!posed) fish.P=Math.min(1,fish.P+dt/fish.turnDur);
    if(fish.swish) fish.swish=Math.max(0,fish.swish-dt/520);
    /* 13 Oct, "should it hold onto the cursor in its tummy for longer?": about three seconds, then it
       opens up and lets you go, and only then does the light come back on. */
    if(mode==='retreat'&&jawTo===1&&now-modeT>2600) spit(now,true);   /* a few seconds' grace before it will bite again (in spit) */
    /* ⛳ 16 Oct, his ask: "should it shake a bit while the cursor is inside as if the hand is trying to break free?"
       Irregular thumps while it holds the glove: a jolt, the cheeks bulge, a bubble or two squeezed out. */
    if(jawTo===1&&(mode==='lunge'&&now-modeT>300||mode==='retreat')&&now>gulp.next){
      gulp.next=now+rnd(200,520); gulp.thump=1; gulp.ang=rnd(0,6.28);
      for(var b=0,nb=Math.random()<.6?1:2;b<nb;b++) mouthBubble(rnd(3,6),.3);
    }
    gulp.thump=Math.max(0,gulp.thump-dt/150); gulp.recoil=Math.max(0,gulp.recoil-dt/520);
    /* ⛳ 16 Oct, his ask: "a subtle little trail of bubbles when it swims quickly". From the gills, only when it's
       really moving (hunting, bolting), a few specks a second, more the faster it goes. */
    var fsp=Math.hypot(fish.vx,fish.vy);
    if(!still&&fsp>90&&Math.random()<(fsp-90)/110*dt/1000*7){
      var gl=at({x:.42,y:.42}); mbub.push({x:gl.x+rnd(-4,4), y:gl.y+rnd(-6,6), vx:fish.vx*.15, vy:rnd(-30,-10), r:rnd(1.4,3.2), t:now, life:rnd(900,1500), ph:rnd(0,6)});
    }
    if(mode==='retreat'&&now-modeT>3400) setMode('wander',now);
    if(mode==='flee'&&now-modeT>1800) setMode('wander',now);
    if(mode==='hide'){   /* tucked in at the edge: turn to face back in (the light peeks out), sulk, then come back */
      if(Math.hypot(fish.tx-fish.x,fish.ty-fish.y)<fw*.25){ if(!fish.hidT) fish.hidT=now; if(now-fish.hidT>500) turnTo(fish.hideSide,300,now,0); }
      if(now>fish.hideUntil){ setMode('wander',now); fish.tx=fish.hideSide>0?W-fw*.9:fw*.9; fish.ty=rnd(H*.4,H*.65); fish.next=now+rnd(6000,9000); }
    }

    /* Steer: accelerate toward the target, capped, with drag. Slow and heavy unless frightened. */
    /* 13 Oct: speeds cut with the size (it was twice as big), or it reads as a small fish in a hurry */
    var max=mode==='hide'?(fish.hidT?40:330):mode==='flee'?360:mode==='lure'?175:mode==='snack'?210:mode==='retreat'?115:26;   /* lure 120 → 175, "more aggressive again" */
    var acc=mode==='hide'?900:mode==='flee'?1000:mode==='lure'?340:mode==='snack'?520:mode==='retreat'?200:30;
    var dx=fish.tx-fish.x, dy=fish.ty-fish.y, dist=Math.hypot(dx,dy)||1;
    var brake=Math.min(1,dist/(fw*.35));
    /* Which way to face: the way it is going, or at the hand it is offering the light to. */
    /* ⛳ 16 Oct, "less like a janky 2d paper cutout". Rejected that morning: drawn three-quarter + head-on in-betweens
       ("actually worse": pictures swapping) and a half-loop somersault ("feels silly"). SoR4 itself turns its
       characters INSTANTLY — the flip is never on screen long enough to be inspected. So: a snap (~5 frames), and the
       life goes into the follow-through — the tail swishes hard after the flip and settles (fish.swish). */
    if(mode==='lure') turnTo(-fish.side,110,now,650);   /* hunting: quick to swing round */
    else if(Math.abs(dx)>fw*.5&&!(mode==='hide'&&fish.hidT)) turnTo(dx<0?1:-1,mode==='flee'||mode==='hide'?90:150,now,mode==='flee'||mode==='hide'?0:3200);
    /* Never backwards: sideways push only once it faces the way it is going. */
    var ahead=fish.P>=1&&(dx*fish.dir<0||Math.abs(dx)<fw*.15);
    if(ahead) fish.vx+=dx/dist*acc*s;
    else if(mode==='lure'&&fish.P>=1) fish.vx+=dx/dist*acc*s*.35;   /* settling in front of a hand: a slow back-up on the fins */
    else fish.vx*=Math.pow(.2,s);
    fish.vy+=dy/dist*acc*s*.6;
    var sp=Math.hypot(fish.vx,fish.vy), cap=max*brake+4;
    if(sp>cap){ fish.vx*=cap/sp; fish.vy*=cap/sp; }
    fish.vx*=Math.pow(.6,s); fish.vy*=Math.pow(.5,s);
    fish.x+=fish.vx*s; fish.y+=fish.vy*s;

    sp=Math.hypot(fish.vx,fish.vy);
    var beatTo=.55+sp/max*1.6+(mode==='flee'?1.5:0)+(fish.P<1?1.2:0);   /* turning is work */
    fish.beat+=(beatTo-fish.beat)*Math.min(1,s*3);
  }


  /* ---- the rest of the deep ----
     Every picture is one still from designs/fish-mj/batch_deep.py. Two ways of moving, both the strip trick:
     DRIFTERS pulse (jellyfish, glass squid): horizontal strips, the bell squeezing on each pulse, which pushes
     the animal up, and everything below it swaying and trailing. SWIMMERS (hatchetfish, the giant squid)
     undulate like the anglerfish: upright strips on a wave from head to tail. Pictures face LEFT. */
  var KINDS={
    /* w: [far, near] width in px. 13 Oct 6:45pm, "some of them are too small": the small ones up by half. */
    jelly:  {files:['jelly_a','jelly_b','jelly_c','jelly_d'], bell:.27, w:[56,105], wp:[42,66], tint:true},
    crown:  {files:['crown_a'], bell:.32, w:[62,96], wp:[46,64]},                          /* red, left red */
    comb:   {files:['comb_a'], bell:.62, w:[46,68], wp:[36,50], sq:.03, per:[4,5.5], shimmer:true},
    gsquid: {files:['glasssquid_a','glasssquid_b'], bell:.42, w:[58,86], wp:[44,60], per:[1.6,2.2]},
    dumbo:  {files:['dumbo_a'], bell:.55, w:[62,90], wp:[46,64], sq:.08, per:[1.8,2.4]},   /* the ears flap */
    hatchet:{files:['hatchet_a','hatchet_b','hatchet_c'], w:[44,68], wp:[34,50]},
    giant:  {files:['squid_giant']},
    /* ⛳ 15 Oct, "a cool, beautiful, interactive, super polished deep sea aquarium": the set (designs/sea-mj/make_sea.py)
       and two more swimmers. */
    vamp:   {files:['vamp_a'], w:[70,120], wp:[56,80]},
    gulper: {files:['gulper_a'], w:[130,210], wp:[100,140]},
    siph:   {files:['siph_a'], w:[200,320], wp:[150,210]},
    isopod: {files:['isopod_a']},
    set:    {files:['sea_far','sea_floor','sea_fore_l','sea_fore_r','worm_tube','worm_plume']},
    weed:   {files:['weed_tall','weed_low']},
    bone:   {files:['junk_bone','junk_bone_b']},
    sub:    {files:['sub']},
    sign:   {files:['junk_sign']},
    junk:   {files:['junk_trolley','junk_chest','junk_moai','junk_cone','junk_portaloo','junk_scooter','junk_besser','junk_phone']}
  };
  var DRIFTERS=['jelly','crown','comb','gsquid','dumbo'];
  var CAST_DESK={jelly:3,crown:1,comb:1,gsquid:1,dumbo:1,hatchet:5,vamp:1,gulper:1,siph:1}, CAST_PHONE={jelly:1,crown:1,comb:1,gsquid:0,dumbo:1,hatchet:3,vamp:1,gulper:0,siph:1};
  var snow=[];
  var pics={}, cast=false, school=null, giant={on:false,next:0};

  /* ⛔ 17 Oct 9:55pm: Cloudflare tells browsers to keep images 4 hours, so he kept seeing the OLD sign after a fix. The art
     URLs carry a version: sync_deploy.py writes a hash of the whole site/assets/deep folder here at build time. */
  var DEEPV='010b081f';
  function loadDeep(dir){
    var n=0, want=0;
    Object.keys(KINDS).forEach(function(k){ KINDS[k].files.forEach(function(f){
      want++; var im=new Image();
      im.onload=function(){ pics[f]=im; if(++n===want){ jready=true; size(); start(); } };
      im.onerror=function(){ if(++n===want){ jready=true; size(); start(); } };
      im.src=dir+f+'.webp?v='+DEEPV;
    }); });
  }
  /* A copy of a picture, optionally re-hued, and darkened toward the page's ink by `dark` (0-1) —
     the further back an animal is, the more of the dark is between you and it. */
  function tinted(im,c,dark,grade){
    var o=document.createElement('canvas'); o.width=im.naturalWidth||im.width; o.height=im.naturalHeight||im.height;
    var x=o.getContext('2d'); x.drawImage(im,0,0);
    if(c){ x.globalCompositeOperation='hue'; x.fillStyle=c; x.fillRect(0,0,o.width,o.height);
           x.globalCompositeOperation='destination-in'; x.drawImage(im,0,0); }
    if(grade!==false&&!off('grade')) return stageGrade(o,dark||0);
    if(dark){ x.globalCompositeOperation='source-atop'; x.fillStyle='rgba(22,21,17,'+dark+')'; x.fillRect(0,0,o.width,o.height); }
    return o;
  }
  /* ⛳ 16 Oct 10:05pm, his note: "the fish are all quite stark ... how would Streets of Rage 4 make this look?" SoR4 doesn't
     blur — it LIGHTS. Baked once per picture: (1) the body is graded into the stage's colour, deep indigo-teal, darker
     the further back it is; (2) its own lights (eyes, photophores, glowing edges: the brightest pixels) are left at full
     strength; (3) a hard cyan rim on the upper edge, as if lit from above; the ink stays crisp. */
  var STAGE=[.30,.46,.72];
  function stageGrade(o,dark){
    var w=o.width,h=o.height,x=o.getContext('2d'),d=x.getImageData(0,0,w,h),p=d.data,A=new Uint8Array(w*h);
    for(var i=0;i<w*h;i++) A[i]=p[i*4+3];
    var amt=.62+.35*dark, r=Math.max(2,Math.round(w/110)), dx=Math.round(r*.6);
    for(var y=0;y<h;y++) for(var X=0;X<w;X++){
      var k=y*w+X, q=k*4, a=A[k]; if(!a) continue;
      var R=p[q],G=p[q+1],B=p[q+2], lum=(R*.3+G*.59+B*.11), mx=Math.max(R,G,B), mn=Math.min(R,G,B);
      var lit=Math.min(1,Math.max(0,(lum-125)/80))*Math.min(1,Math.max(0,(mx-mn+40)/120));   /* its own glow */
      var g=amt*(1-lit*(1-.75*dark));   /* far ones: their own lights dim too, so they recede (10:14pm hierarchy) */
      R=R*(1-g)+R*STAGE[0]*(1-dark*.6)*g; G=G*(1-g)+G*STAGE[1]*(1-dark*.6)*g; B=B*(1-g)+Math.max(B,lum*.8)*STAGE[2]*(1-dark*.5)*g;
      var up=y-r>=0?A[(y-r)*w+Math.max(0,X-dx)]:0, rim=(a/255)*(1-up/255)*(1-dark*.7)*.7;   /* lit from above */
      p[q]=Math.min(255,R+70*rim); p[q+1]=Math.min(255,G+190*rim); p[q+2]=Math.min(255,B+240*rim);
    }
    x.putImageData(d,0,0); return o;
  }
  /* Depth, 0 = far back, 1 = right up close (the anglerfish's distance). Far is smaller, darker, slower. */
  /* ⛳ 17 Oct, his note: "when the blue ones overlap it just turns into a messy jumble ... tint the colours a little so each
     fish feels slightly more distinct and maybe get them to avoid overlapping each other a bit more (but not completely)".
     (1) Each kind gets its own cast over the stage blue, laid on after the grade so it survives it. (2) separate(): creatures
     at a similar depth that get close drift apart gently — a soft push, so they still pass in front of each other. */
  var KIND_TINT={gsquid:'#2bb39c', hatchet:'#9cc4d8', gulper:'#8a52e0', siph:'#d6a648', vamp:'#c0385a', comb:'#4fd0e0'};
  function kindTint(c,kind){
    var col=KIND_TINT[kind]; if(!col||off('kindtint')) return c;
    var x=c.getContext('2d'), keep=document.createElement('canvas'); keep.width=c.width; keep.height=c.height; keep.getContext('2d').drawImage(c,0,0);
    x.save(); x.globalCompositeOperation='color'; x.globalAlpha=.42; x.fillStyle=col; x.fillRect(0,0,c.width,c.height);
    x.globalAlpha=1; x.globalCompositeOperation='destination-in'; x.drawImage(keep,0,0); x.restore();
    return c;
  }
  function separate(s){
    var A=[], i, k;
    for(i=0;i<jellies.length;i++){ var j=jellies[i]; A.push({o:j, x:j.x, y:j.y+j.h*.35, r:j.w*.45, z:j.z, jelly:true}); }
    for(i=0;i<swimmers.length;i++){ var m=swimmers[i]; A.push({o:m, x:m.x, y:m.y, r:m.w*.38, z:m.z}); }
    for(i=0;i<A.length;i++) for(k=i+1;k<A.length;k++){
      var a=A[i], b=A[k]; if(Math.abs(a.z-b.z)>.3) continue;
      var dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1, R=(a.r+b.r)*.9;
      if(d>=R) continue;
      var f=(1-d/R)*26*s, ux=dx/d, uy=dy/d;
      push(a,-ux*f,-uy*f); push(b,ux*f,uy*f);
    }
    function push(p,fx,fy){ if(p.jelly){ p.o.vx+=fx*1.6; p.o.vy+=fy*1.2; } else { p.o.vx+=fx*1.2; p.o.vy+=fy; p.o.ty+=fy*.6; } }
  }
  function depthDark(z){ return .3+.6*(1-z); }   /* 10:19pm "a tiny bit more hierarchy": .2 → .3 */   /* 10:14pm: further back reads further back */   /* 15 Oct: the whole scene a touch darker, his note */
  function depthSpeed(z){ return .5+.5*z; }
  function pick(kind,i){ var f=KINDS[kind].files; return pics[f[i%f.length]]; }

  function makeCast(){
    cast=true;
    var small=W<=700, plan=small?CAST_PHONE:CAST_DESK, n=0, total=0;
    DRIFTERS.forEach(function(k){ total+=plan[k]; });
    DRIFTERS.forEach(function(kind){
      var K=KINDS[kind];
      for(var i=0;i<plan[kind];i++,n++){
        var im=pick(kind,i); if(!im) continue;
        /* 10:14pm, "the fish are all kinda competing for attention ... make the anglerfish more of the hero": the supporting
           cast lives further back now (z 0-.6, was 0-1), so it's smaller, darker and slower; only the anglerfish is up front */
        var r=small?K.wp:K.w, z=Math.random()*.5, w=r[0]+(r[1]-r[0])*(.2+z), dk=depthDark(z);
        var pic=kindTint(tinted(im,K.tint?TINTS[(i+1)%TINTS.length]:null,dk),kind);
        /* the comb jelly's rows of light run through the rainbow: six copies, cross-faded */
        var rainbow=K.shimmer?['#ff4040','#ffc040','#60ff80','#40c0ff','#8060ff','#ff50c0'].map(function(c){ return tinted(im,c,dk); }):null;
        jellies.push({kind:kind, bell:K.bell, sq:K.sq||.12, pic:pic, rainbow:rainbow, w:w, h:w*im.naturalHeight/im.naturalWidth,
          x:W*(n+.5)/total+rnd(-40,40), y:rnd(H*.15,H*.8), vx:rnd(-6,6), vy:0,
          ph:Math.random(), per:K.per?rnd(K.per[0],K.per[1]):rnd(2.4,3.4), sw:rnd(0,6), boost:0,
          z:z, sp:depthSpeed(z), a:.92, halo:haloOf(pic)});
      }
    });
    jellies.sort(function(a,b){ return a.z-b.z; });   /* far drawn first */
    /* A loose school of hatchetfish: they keep a formation round a point that wanders, and scatter
       from a fast hand, then drift back together. */
    var HK=KINDS.hatchet, hr=small?HK.wp:HK.w, fishes=[], sz=rnd(.15,.4);   /* the school shares a depth, roughly */
    for(var i=0;i<plan.hatchet;i++){
      var im=pick('hatchet',i); if(!im) continue;
      var z=Math.max(0,Math.min(1,sz+rnd(-.12,.12))), w=hr[0]+(hr[1]-hr[0])*z;
      var hp=kindTint(tinted(im,null,depthDark(z)),'hatchet');
      fishes.push({pic:hp, w:w, h:w*im.naturalHeight/im.naturalWidth, ox:rnd(-70,70), oy:rnd(-40,40),
        x:0, y:0, vx:0, vy:0, turn:-1, phase:Math.random()*6, beat:1.2, a:.95, z:z, halo:haloOf(hp), tw:rnd(0,6)});
    }
    fishes.sort(function(a,b){ return a.z-b.z; });
    school={cx:W*.25, cy:H*.4, tx:W*.6, ty:H*.4, next:0, fish:fishes, sp:depthSpeed(sz), z:sz};
    /* ⛳ 15 Oct: two more swimmers, the vampire squid and the gulper eel. */
    ['vamp','gulper','siph'].forEach(function(kind){
      var K=KINDS[kind];
      for(var i=0;i<(plan[kind]||0);i++){
        var im=pick(kind,i); if(!im) continue;
        var r=small?K.wp:K.w, z=kind==='siph'?rnd(.1,.25):rnd(.1,.45), w=r[0]+(r[1]-r[0])*(.2+z), pic=kindTint(tinted(im,null,depthDark(z)),kind);
        swimmers.push({kind:kind, pic:pic, halo:haloOf(pic), w:w, h:w*im.naturalHeight/im.naturalWidth, z:z, sp:depthSpeed(z),
          x:rnd(W*.15,W*.85), y:rnd(H*.2,H*.6), vx:0, vy:0, dir:Math.random()<.5?1:-1, dirFrom:1, P:1, phase:rnd(0,6), beat:.6,
          tx:0, ty:0, next:0, boost:0, flee:0, amp:kind==='gulper'?.16:kind==='siph'?.09:.05, N:kind==='gulper'||kind==='siph'?44:28, wave:-1, waveT:0});
      }
    });
    swimmers.sort(function(a,b){ return a.z-b.z; });
    makeWorms();
    if(pics.isopod_a) isopod={pic:tinted(pics.isopod_a,null,.42), u:.5, v:.775, dir:Math.random()<.5?1:-1, dirFrom:1, P:1, phase:0, hunker:0, run:0, pause:0, lastTurn:0};
    fishes.forEach(function(f){ f.x=school.cx+f.ox; f.y=school.cy+f.oy; });
    /* Marine snow: specks sinking through the dark. Barely there; the ones near the lure catch its light. */
    /* 16 Oct, his ask: "a bit more obvious". Was W*H/9000 specks, r .5-1.3, alpha .06-.2. */
    for(var q=0,nq=Math.round(W*H/(small?5500:6500));q<nq;q++)
      snow.push({x:Math.random()*W, y:Math.random()*H, r:rnd(.6,1.7), v:rnd(3,10), ph:rnd(0,6), a:rnd(.1,.27)});   /* 10:13pm "a tiny bit too bright": .14-.38 → .1-.27 */
    giant.next=performance.now()+(/fishdebug/.test(location.search)?500:rnd(9000,16000));
  }

  /* A swimmer: upright strips, head (left of the picture) stiff, tail loose. Caller has translated
     to the animal's centre and scaled for which way it faces. */
  function swimStrips(pic,w,h,phase,amp,N){
    var iw=pic.naturalWidth||pic.width, ih=pic.naturalHeight||pic.height;
    for(var i=0;i<N;i++){
      var u0=i/N, u1=(i+1)/N, u=(u0+u1)/2, body=Math.max(0,(u-.32)/.68);
      var off=N>1?amp*Math.pow(body,1.5)*Math.sin(u*Math.PI*1.8-phase):0;
      ctx.drawImage(pic, u0*iw,0,(u1-u0)*iw,ih, -w/2+u0*w,-h/2+off,(u1-u0)*w+.35,h);
    }
  }

  function stepJellies(now,dt){
    var s=dt/1000;
    if(!cast) makeCast();
    /* jl: a master dimmer for everything else. ⛔ It used to drop to .12 when the anglerfish's light went out —
       he: "its weird that the screen fades when the angler fish eats the cursor". Only the fish goes dark now. */
    jl=1;
    for(var i=0;i<jellies.length;i++){
      var j=jellies[i], was=j.ph;
      j.ph=(j.ph+s/j.per*(1+j.boost*1.6))%1;
      if(was<.06&&j.ph>=.06) j.vy-=j.w*.22;           /* the push of each pulse */
      j.vy+=j.w*.035*s;                               /* sinking between pulses */
      var cx=j.x, cy=j.y+j.h*.15, dx=cx-ptr.x, dy=cy-ptr.y, d=Math.hypot(dx,dy)||1;
      if(ptr.in&&d<j.w*.8+20){ j.vx+=dx/d*j.w*1.4*s; j.vy+=dy/d*j.w*.8*s; j.boost=Math.min(1,j.boost+s*4); }
      /* ⛳ 15 Oct: the dumbo octopus is curious. A slow hand, and it comes over to have a look (and flaps harder). */
      else if((j.kind==='dumbo'||j.kind==='gsquid')&&(j.prey=nearestFood(cx,cy,j.kind==='dumbo'?460:300))){   /* 10:28pm "more things need to eat": the glass squid too */
        var px=j.prey.x-cx, py=j.prey.y-cy, pd=Math.hypot(px,py)||1;
        j.vx+=px/pd*j.w*.9*s; j.vy+=py/pd*j.w*.6*s; j.boost=Math.min(.6,j.boost+s);
        if(pd<j.w*.45){ j.prey.dead=true; fedOnce(); }
      }
      else if(j.kind==='dumbo'&&ptr.in&&ptr.speed<350&&d<380){ j.vx-=dx/d*j.w*.55*s; j.vy-=dy/d*j.w*.3*s; j.boost=Math.min(.5,j.boost+s*.8); }
      j.boost=Math.max(0,j.boost-s*.5);
      j.vx*=Math.pow(.55,s); j.vy*=Math.pow(.45,s);
      j.x+=j.vx*s*j.sp; j.y+=j.vy*s*j.sp;
      if(j.y<0){ j.y=H+rnd(10,120); j.x=rnd(j.w,W-j.w); }   /* faded out near the top: back in from below */
      if(j.y>H+160) j.y=H+150;
      if(j.x<-j.w) j.x=W+j.w*.5; else if(j.x>W+j.w) j.x=-j.w*.5;
    }
    for(var q=0;q<snow.length;q++){
      var f=snow[q]; f.y+=f.v*s; f.x+=Math.sin(now/3000+f.ph)*4*s;
      var sx=f.x-ptr.x, sy=f.y-ptr.y, sd=Math.hypot(sx,sy)||1;
      if(ptr.in&&sd<60&&ptr.speed>200){ f.x+=sx/sd*40*s; f.y+=sy/sd*40*s; }   /* a hand stirs it */
      if(f.y>H+4){ f.y=-4; f.x=Math.random()*W; }
    }
    if(school) stepSchool(now,s);
    separate(s);
    stepGiant(now,s); stepSub(now,s);
    stepSwimmers(now,s); stepWorms(now,s); stepSmoke(now,s); stepIsopod(now,s); stepFood(now,s); stepBones(s);
    /* a hand dragged fast along the seabed stirs the silt */
    if(ptr.in&&ptr.speed>500&&now-ptr.t<60&&Math.abs(ptr.y-groundY())<40&&Math.random()<.5) kickSilt(ptr.x,ptr.y,2,ptr.speed*.06);
  }

  function stepSchool(now,s){
    var S=school;
    if(now>S.next){ S.tx=rnd(W*.1,W*.9); S.ty=rnd(H*.2,Math.min(H*.85,groundY()-60)); S.next=now+rnd(7000,13000); }
    /* ⛳ 15 Oct: a slow hand, and the school tags along, keeping its distance. */
    if(ptr.in&&ptr.speed<400){ var side=S.cx<ptr.x?-1:1; S.tx=ptr.x+side*170; S.ty=Math.min(groundY()-60,ptr.y-30); S.next=now+4000; }
    var morsel=nearestFood(S.cx,S.cy,520); if(morsel){ S.tx=morsel.x; S.ty=morsel.y; S.next=now+1500; }
    var dx=S.tx-S.cx, dy=S.ty-S.cy, d=Math.hypot(dx,dy)||1, v=Math.min(morsel?90:ptr.in?60:26,d*.6)*S.sp;
    S.cx+=dx/d*v*s; S.cy+=dy/d*v*s*.6;
    for(var i=0;i<S.fish.length;i++){
      var f=S.fish[i], gx=S.cx+f.ox-f.x, gy=S.cy+f.oy-f.y;
      /* ⛔ 10:27pm, "the school of fish aren't eating": they held formation round a centre that crept toward the food, so
         no single fish ever reached a flake. Now each one breaks off and darts for the flake nearest to it, and eats it. */
      var mine=food.length?nearestFood(f.x,f.y,220):null;
      if(mine){ var mx=mine.x-f.x, my=mine.y-f.y, md=Math.hypot(mx,my)||1; f.vx+=mx/md*260*s; f.vy+=my/md*200*s; f.beat=Math.max(f.beat,2.4);
        if(md<Math.max(9,f.w*.35)){ mine.dead=true; fedOnce(); } }
      else { f.vx+=gx*.9*s; f.vy+=gy*.9*s; }
      var hx=f.x-ptr.x, hy=f.y-ptr.y, hd=Math.hypot(hx,hy)||1;
      if(ptr.in&&hd<90&&ptr.speed>300){ f.vx+=hx/hd*900*s; f.vy+=hy/hd*700*s; f.beat=4; }
      f.vx*=Math.pow(.35,s); f.vy*=Math.pow(.3,s);
      f.x+=f.vx*s; f.y+=f.vy*s;
      if(Math.abs(f.vx)>4) f.turn+=((f.vx<0?-1:1)-f.turn)*Math.min(1,s*5);
      f.beat+=(1.1+Math.hypot(f.vx,f.vy)/40-f.beat)*Math.min(1,s*3);
      f.phase+=s*f.beat*Math.PI*2;
    }
  }

  /* ⛳ His idea: a giant squid that fades in from the background, just a hint, every now and then.
     Huge, very faint, slow, never interactive. */

  /* ⛳ 17 Oct, his idea: "a nuclear submarine ... float past in the background as an easter egg like the giant squid does".
     Rare (every 1.5-3 min, never while the squid is passing), deep behind the far rocks, a dark hull sliding slowly across
     with its portholes glowing, a faint sonar ping now and then. Art: designs/junk-mj (MJ), sub.webp. */
  var sub={on:false, next:0, pings:[]};
  /* ⛔ 17 Oct 9:40pm, his call after two art fixes: "the submarine still looks nothing like an actual submarine shape. and
     the sonar is janky". OFF until there is new art with a real sub silhouette (teardrop hull, sail, cruciform tail);
     SUB_ON=true brings it back. The sonar rings are gone for good. */
  var SUB_ON=true;   /* 17 Oct 10:10pm: back on with new art — designs/sub-mj/make_sub.py (MJ d891dbdf/1: a real attack sub, dead side-on) */
  function stepSub(now,s){
    if(!SUB_ON) return;
    var im=pics.sub; if(!im) return;
    if(!sub.next) sub.next=now+(/fishdebug/.test(location.search)?4000:rnd(50000,90000));
    if(!sub.on&&now>sub.next&&!giant.on){
      sub.on=true; sub.t0=now; sub.dur=rnd(42000,52000); sub.dir=Math.random()<.5?-1:1;
      sub.w=Math.min(900,Math.max(380,W*.55)); sub.h=sub.w*im.naturalHeight/im.naturalWidth; sub.y=rnd(H*.3,H*.48); sub.ping=now+rnd(4000,7000);
    }
    if(sub.on){
      var p=(now-sub.t0)/sub.dur; if(p>=1){ sub.on=false; sub.next=now+rnd(90000,180000); return; }
      sub.p=p;
      if(now>sub.ping){ sub.ping=now+rnd(6000,9000); sub.pings.push({t:now}); }
    }
    for(var i=sub.pings.length-1;i>=0;i--) if(now-sub.pings[i].t>2600) sub.pings.splice(i,1);
  }
  function drawSub(now){
    var im=pics.sub; if(!sub.on||!im) return;
    /* 18 Oct 6:57pm, his note: "the propeller doesn't move. would it be easier if we made it blurrier/murkier like the giant squid?"
       Yes: a soft blue-black copy, made once the same way as the squid's — its own shading in deep-sea blue, darkened, blurred by a
       halving — so it's a shape in the murk, too far off to see anything turning. */
    if(!sub.pic){
      /* ⛔ 7:05pm "like jpeg artifacts that have been blurred": the blur was a shrink-and-stretch (blocky). Now a real blur at full
         size, with a margin so the soft edge isn't clipped; older browsers without ctx.filter get the plain tinted copy. */
      var P=12, sw=im.naturalWidth+P*2, sh=im.naturalHeight+P*2, a=document.createElement('canvas'); a.width=sw; a.height=sh;
      var ax=a.getContext('2d'); ax.drawImage(im,P,P);
      ax.globalCompositeOperation='color'; ax.fillStyle='#1d4f8f'; ax.fillRect(0,0,sw,sh);
      ax.globalCompositeOperation='destination-in'; ax.drawImage(im,P,P);
      ax.globalCompositeOperation='source-atop'; ax.fillStyle='rgba(2,6,14,.5)'; ax.fillRect(0,0,sw,sh);
      var b=document.createElement('canvas'); b.width=sw; b.height=sh; var bx=b.getContext('2d');
      if('filter' in bx){ bx.filter='blur(3.5px)'; bx.drawImage(a,0,0); bx.filter='none'; } else bx.drawImage(a,0,0);
      sub.pic=b; sub.pad=P/im.naturalWidth; sub.padY=P/im.naturalHeight;
    }
    var p=sub.p, fade=Math.pow(Math.sin(Math.PI*Math.min(1,Math.max(0,p))),1.2);
    var x=sub.dir<0? W+sub.w*.6-(W+sub.w*1.2)*p : -sub.w*.6+(W+sub.w*1.2)*p, y=sub.y+Math.sin(now/3800)*4;
    ctx.save(); ctx.globalAlpha=.3*fade*jl; ctx.translate(x,y); if(sub.dir>0) ctx.scale(-1,1);
    var pw=sub.w*(1+2*(sub.pad||0)), ph=sub.h*(1+2*(sub.padY||0)); ctx.drawImage(sub.pic,-pw/2,-ph/2,pw,ph);
    /* (18 Oct 7:05pm: a drawn turning propeller was tried here and pulled, "super janky"; the murk hides the painted one) */
    ctx.restore();
  }
  function stepGiant(now,s){
    var G=giant, im=pics.squid_giant; if(!im) return;
    if(!G.on&&now>G.next&&!sub.on){
      G.on=true; G.t0=now; G.dur=rnd(28000,36000);   /* 10:13pm "too quick ... lost its eeriness": was 16-22s */ G.dir=Math.random()<.5?-1:1;
      G.w=Math.min(1700,Math.max(520,W*1.15)); G.h=G.w*im.naturalHeight/im.naturalWidth;
      G.y=rnd(H*.3,H*.6); G.phase=0; G.T=rnd(6500,8500);
    }
    if(G.on){
      var p=(now-G.t0)/G.dur;
      if(p>=1){ G.on=false; G.next=now+rnd(30000,55000); return; }
      G.p=p;
      /* the arms trail and whip harder just after each push, then settle (see drawGiant) */
      var u=((now-G.t0)%G.T)/G.T; G.u=u; G.phase+=s*(.26+.34*Math.exp(-u*3))*Math.PI*2;   /* 9:30pm: about twice the pace — a sway every ~3.5s, quicker after each push */
    }
  }

  function drawGiant(){
    var G=giant, im=pics.squid_giant; if(!G.on||!im) return;
    var p=G.p, fade=Math.pow(Math.sin(Math.PI*Math.min(1,Math.max(0,p))),1.6);
    /* ⛳ 16 Oct 10:09pm, "can the giant squid feel like it has more weight ... its animation feels cheap": it slid across at
       one speed with a constant wiggle. A squid that size moves by jet: the mantle squeezes, the whole bulk surges, then it
       coasts and slows, arms streaming behind, and does it again every 3-4s. Position comes from that rhythm, not from time. */
    var cyc=G.dur/G.T, n=Math.floor(p*cyc), u=p*cyc-n, g=(1-Math.exp(-u*1.6))/(1-Math.exp(-1.6)), q=Math.min(1,(n+g)/cyc);   /* a slow heave, not a dart */
    var x=G.dir<0? W+G.w*.6-(W+G.w*1.2)*q : -G.w*.6+(W+G.w*1.2)*q;
    var sq=u<.3?Math.sin(u/.3*Math.PI):0;   /* the squeeze, slow */
    /* Drawn whole off-screen first, then laid down faint in one go: strips overlapping by a hair are
       invisible at full strength but show as stripes once the whole thing is see-through. */
    /* ⛳ 16 Oct, "the giant squid ... looks a bit janky still ... as smooth and polished as possible". It was the full
       red painting at 8%: a faint red cut-out. Something that big and that far away is a shape in the murk — so it is
       now drawn from a soft, blue-black copy (made once: tinted toward the deep, blurred by shrinking), at half
       resolution, and it drifts with a slow swell instead of a bob. */
    if(!G.src){
      var sw=Math.round(im.naturalWidth*.5), sh=Math.round(im.naturalHeight*.5), a=document.createElement('canvas'); a.width=sw; a.height=sh;
      var ax=a.getContext('2d'); ax.drawImage(im,0,0,sw,sh);
      ax.globalCompositeOperation='color'; ax.fillStyle='#1d4f8f'; ax.fillRect(0,0,sw,sh);          /* its own shading, in deep-sea blue */
      ax.globalCompositeOperation='destination-in'; ax.drawImage(im,0,0,sw,sh);
      ax.globalCompositeOperation='source-atop'; ax.fillStyle='rgba(2,6,14,.35)'; ax.fillRect(0,0,sw,sh);
      var b=document.createElement('canvas'); b.width=Math.round(sw/2); b.height=Math.round(sh/2);   /* soft, not blocky: one halving */
      var bx=b.getContext('2d'); bx.imageSmoothingQuality='high'; bx.drawImage(a,0,0,b.width,b.height);
      ax.globalCompositeOperation='copy'; ax.imageSmoothingQuality='high'; ax.drawImage(b,0,0,sw,sh);
      G.src=a;
    }
    var HS=.5, MG=1.5, o=G.off||(G.off=document.createElement('canvas')), pw=Math.ceil(G.w*HS), ph=Math.ceil(G.h*MG*HS);
    if(o.width!==pw||o.height!==ph){ o.width=pw; o.height=ph; }
    var oc=o.getContext('2d'), keep=ctx; oc.clearRect(0,0,pw,ph);
    ctx=oc; ctx.save(); ctx.translate(pw/2,ph/2); if(G.dir>0) ctx.scale(-1,1);
    giantStrips(G.src,G.w*HS,G.h*HS,G.phase,u,still); ctx.restore(); ctx=keep;
    ctx.globalAlpha=.16*fade*jl;   /* 13 Oct: .2 → .13 → .08 on the red; blue-black copy .2; 10:10pm .16 — the pulses draw the eye, so a touch fainter */
    var sxk=1-.025*sq, syk=1+.02*sq, rise=-Math.sin(u*Math.PI)*G.h*.012;   /* squeezes, and lifts a little as it surges */
    ctx.drawImage(o,x-G.w*sxk/2,G.y+rise+Math.sin(p*Math.PI*2)*G.h*.02-G.h*MG/2*syk,G.w*sxk,G.h*MG*syk);
    ctx.globalAlpha=1;
  }
  /* ⛳ 17 Oct 11:45am, his note: "the giant squid's tentacles feel too static, can we make them subtle swish". The arms
     only moved ±2% of its height. Now, from the eye back (the art has the mantle on the left, arms fanning right): a slow
     travelling wave that grows to ~6% at the tips with a second, quicker ripple on top so it never reads as one rigid sine,
     and the whole fan opens and closes a little about the arm roots. Harder just after each jet push, easing as it coasts. */
  function giantStrips(pic,w,h,phase,u,still){
    /* 9:30pm, "the tentacles are still static": they moved, but ~8s a sway, ±6%, and every arm bent together like one
       sheet. Now the picture is cut into a grid on the arms (one strip each on the mantle): every strip is split into rows
       whose edges are displaced by a field that also varies with height, so the upper and lower arms ripple out of step.
       Rows share their edges (each row is stretched from its displaced top to its displaced bottom), so nothing tears. */
    var iw=pic.naturalWidth||pic.width, ih=pic.naturalHeight||pic.height, N=NS(96), RW=9, ROOT=.6;
    var push=.7+.3*Math.exp(-u*2.5), amp=h*.1*push, spr=.11*push;
    function dy(c,v){ var b=Math.max(0,(c-.36)/.64); if(!b) return 0;
      return amp*Math.pow(b,1.3)*(Math.sin(c*Math.PI*2.4-phase+v*2.4)+.35*Math.sin(c*Math.PI*6-phase*1.8-v*3))
        +(v-ROOT)*h*spr*Math.pow(b,1.2)*Math.sin(phase*.6-c*1.6); }
    for(var i=0;i<N;i++){
      var u0=i/N, u1=(i+1)/N, c=(u0+u1)/2, x=-w/2+u0*w, cw=(u1-u0)*w+.35, rows=N>1&&c>.36?RW:1;
      for(var r=0;r<rows;r++){
        var v0=r/rows, v1=(r+1)/rows, y0=v0*h+(N>1?dy(c,v0):0), y1=v1*h+(N>1?dy(c,v1):0);
        ctx.drawImage(pic, u0*iw,v0*ih,(u1-u0)*iw,(v1-v0)*ih, x,-h/2+y0,cw,y1-y0+(r<rows-1?.35:0));
      }
    }
  }

  /* ---- the set ----
     ⛳ 15 Oct, his brief: "a cool, beautiful, interactive, super polished deep sea aquarium that looks like it was
     drawn in streets of rage 4". It had been animals on black. Now it is a stage, built the way SoR4 builds one: a
     far layer of rock spires in the murk, the seabed (rocks, sponges, a smoking vent, glowing coral), the cast
     between them, and out-of-focus rocks in the corners in front of everything. The layers slide at different
     speeds as the page scrolls in and lean a little against the hand. Art: designs/sea-mj/make_sea.py. */
  var SEABED=.45, OFF=(location.search.match(/fishoff=([a-z,]+)/)||[,''])[1].split(',');   /* ?fishoff=dark,halo,... for timing */
  var OLD={}; (location.search.match(/fishold=([a-z,]+)/)||[,''])[1].split(',').forEach(function(k){ if(k) OLD[k]=1; });   /* ?fishold=dark,... : the pre-20-Oct way, to compare */
  function off(k){ return OFF.indexOf(k)>=0||(PL()>=1&&(k==='halo'||k==='smoke'))||(PL()>=2&&k==='wave'); }   /* (perf.js levels switch extras off) */   /* the cast nearer than this swims in front of the seabed */
  var swimmers=[], worms=[], smoke=[], silt=[], smokeT=0, rt=0, pxs=0, R={};
  function setRects(now){
    var r=cv.getBoundingClientRect(), f=pics.sea_floor;
    rt=Math.max(0,r.top);                            /* how far the canvas still is below the top of the window */
    pxs+=((ptr.in?ptr.x/W-.5:0)-pxs)*.02;   /* 15 Oct: "way more subtle" (was 18/8/44px, now 4/2/10) */
    function par(k){ return -(1-k)*rt; }              /* k<1 moves slower than the page, k>1 faster */
    if(f){ var fw2=Math.max(W*1.06,1100), fh2=fw2*f.naturalHeight/f.naturalWidth;
      R.floor={x:(W-fw2)/2-pxs*4, y:H-fh2+par(.85), w:fw2, h:fh2}; }
    var a=pics.sea_far;
    if(a&&R.floor){ var aw=Math.max(W*1.12,1150), ah=aw*a.naturalHeight/a.naturalWidth;
      R.far={x:(W-aw)/2-pxs*2, y:R.floor.y+R.floor.h*.62-ah+par(.6)-par(.85), w:aw, h:ah}; }
  }
  function groundY(){ return R.floor?R.floor.y+R.floor.h*.68:H; }
  function drawFar(){
    var a=pics.sea_far; if(!a||!R.far) return;
    /* the rocks are solid to whatever is behind them (the giant squid): cut their shape out first, then add their light.
       (20 Oct, smoothing: only when the squid or the sub is actually passing — on an empty canvas the cut does nothing) */
    if(OLD.far||(giant.on&&pics.squid_giant&&!off('giant'))||(sub.on&&pics.sub&&!off('sub'))){
      ctx.globalCompositeOperation='destination-out'; ctx.globalAlpha=.92*jl; ctx.drawImage(a,R.far.x,R.far.y,R.far.w,R.far.h); }
    /* added, not laid over: its dark parts must never be darker than the page behind them, or its top edge shows */
    ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=.26*jl; ctx.drawImage(a,R.far.x,R.far.y,R.far.w,R.far.h);
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  }
  function drawFloor(t){
    var f=pics.sea_floor; if(!f||!R.floor) return;
    ctx.drawImage(f,R.floor.x,R.floor.y,R.floor.w,R.floor.h);
    /* 8:42am "the sign should feel part of the scene - integrated": it's planted IN the seabed now — drawn with the set, so the
       same darkness and light falls on it as on the rocks around it, half hidden behind the worm clumps */
    if(!off('worm')) drawWorms(t);
    if(SIGN_ON) drawSign();   /* 18 Oct: in FRONT of the worm clumps now — at its new spot one sat right across THE FISH */
    if(!off('smoke')) drawSmoke(); if(!off('iso')) drawIsopod();
  }
  /* The foreground: the seabed's own end rocks, near black and soft, big, half out of frame at the corners. */
  function drawFore(){
    var l=pics.sea_fore_l, r=pics.sea_fore_r, k=Math.max(.75,Math.min(1.3,W/1440)), dy=.25*rt;
    if(l){ var lw=l.naturalWidth*.62*k, lh=lw*l.naturalHeight/l.naturalWidth;
      ctx.drawImage(l,-lw*.34-pxs*10,H-lh*.82+dy,lw,lh); }
    if(r&&W>700){ var rw=r.naturalWidth*.62*k, rh=rw*r.naturalHeight/r.naturalWidth;
      ctx.drawImage(r,W-rw*.62-pxs*10,H-rh*.78+dy,rw,rh); }
  }

  /* A soft glow made once per picture: the picture shrunk to a few pixels and drawn back up, which blurs it
     (ctx.filter would be simpler, but older iPhones ignore it). Laid on with 'lighter'. */
  function haloOf(src){
    var iw=src.naturalWidth||src.width, ih=src.naturalHeight||src.height, pad=Math.round(Math.max(iw,ih)*.22), k=1/7;
    var a=document.createElement('canvas'); a.width=Math.max(2,Math.round((iw+pad*2)*k)); a.height=Math.max(2,Math.round((ih+pad*2)*k));
    var x=a.getContext('2d'); x.imageSmoothingQuality='high'; x.drawImage(src,pad*k,pad*k,iw*k,ih*k);
    var b=document.createElement('canvas'); b.width=a.width*2; b.height=a.height*2;
    var y=b.getContext('2d'); y.imageSmoothingQuality='high'; y.drawImage(a,0,0,b.width,b.height);
    return {c:b, px:pad/iw, py:pad/ih};
  }
  function drawHalo(h,x,y,w,hh,a){
    if(a<=.005||off('halo')) return;
    ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=Math.min(1,a);
    ctx.drawImage(h.c,x-w*h.px,y-hh*h.py,w*(1+2*h.px),hh*(1+2*h.py));
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  }

  /* ---- swimmers: the vampire squid and the gulper eel ----
     They cruise slowly from one spot to another, turn with a quick squeeze like the anglerfish, never swim
     backwards. A fast hand or a tap and they bolt, their eyes and tail lights flaring. */
  function stepSwimmers(now,s){
    for(var i=0;i<swimmers.length;i++){
      var m=swimmers[i];
      if(now>m.next){ m.tx=rnd(m.w,W-m.w); m.ty=rnd(H*.15,Math.min(H*.7,groundY()-m.h)); m.next=now+rnd(9000,16000); }
      var hx=m.x-ptr.x, hy=m.y-ptr.y, hd=Math.hypot(hx,hy)||1;
      if(m.kind==='siph'){ if(ptr.in&&hd<m.w*.45&&m.wave<0&&now>m.waveT) spook(m,now); }
      else if(ptr.in&&hd<m.w*.8&&ptr.speed>500&&now-ptr.t<80) spook(m,now);
      if(m.wave>=0){ m.wave+=s; if(m.wave>SIPH_T){ m.wave=-1; m.waveT=now+1500; } }
      m.flee=Math.max(0,m.flee-s); m.boost=Math.max(0,m.boost-s*.6);
      /* 10:25pm, his ask: "the other fish should eat the food too ... just not the jellyfish". The vampire squid and the
         gulper eel drift over to a nearby flake and take it (the siphonophore is a jelly, it doesn't). */
      var eating=false;
      if(m.kind!=='siph'&&m.flee<=0&&food.length){
        var mf=nearestFood(m.x,m.y,m.w*3+120);
        if(mf){ eating=true; m.tx=mf.x; m.ty=mf.y; m.next=now+2500;
          var mo=m.x-m.dir*m.w*.4;   /* its mouth: the front of the picture */
          if(Math.hypot(mf.x-mo,mf.y-m.y)<Math.max(10,m.w*.18)){ mf.dead=true; fedOnce(); m.boost=Math.min(1,m.boost+.3); } }
      }
      var dx=(eating?m.tx+m.dir*m.w*.4:m.tx)-m.x, dy=m.ty-m.y, d=Math.hypot(dx,dy)||1;
      if(m.P<1) m.P=Math.min(1,m.P+s/.45);
      else if(Math.abs(dx)>m.w*.6&&(dx<0?1:-1)!==m.dir&&now-(m.lastTurn||0)>2500){ m.dirFrom=m.dir; m.dir=-m.dir; m.P=0; m.lastTurn=now; }
      var max=(m.flee>0?150:eating?42:m.kind==='gulper'?16:20)*m.sp, acc=m.flee>0?600:eating?70:22;
      if(m.P>=1&&dx*m.dir<0) m.vx+=dx/d*acc*s; else m.vx*=Math.pow(.3,s);
      m.vy+=dy/d*acc*s*.5;
      var sp=Math.hypot(m.vx,m.vy), cap=max*Math.min(1,d/(m.w*.5))+2;
      if(sp>cap){ m.vx*=cap/sp; m.vy*=cap/sp; }
      m.vx*=Math.pow(.7,s); m.vy*=Math.pow(.5,s);
      m.x+=m.vx*s; m.y+=m.vy*s;
      m.beat+=((.45+Math.hypot(m.vx,m.vy)/(20*m.sp)*.5+(m.flee>0?1.8:0))-m.beat)*Math.min(1,s*3);
      m.phase+=s*m.beat*Math.PI*2;
    }
  }
  function spook(m,now){
    /* the siphonophore doesn't bolt: a ripple of light runs down its whole length, head to tail */
    if(m.kind==='siph'){ if(m.wave<0) m.wave=0; m.boost=.6; m.shT=now; return; }   /* 17 Oct, his ask: and a tiny shiver (drawSwimmers) */
    puffBubbles(m.x,m.y,rnd(3,6)|0,0,-20);
    var a=Math.atan2(m.y-ptr.y,m.x-ptr.x);
    m.tx=Math.max(m.w*.5,Math.min(W-m.w*.5,m.x+Math.cos(a)*W*.5)); m.ty=Math.max(H*.1,Math.min(groundY()-m.h,m.y+Math.sin(a)*H*.25));
    m.flee=1.6; m.boost=1; m.next=now+rnd(6000,9000);
    if((m.tx<m.x?1:-1)!==m.dir&&m.P>=1){ m.dirFrom=m.dir; m.dir=-m.dir; m.P=0; m.lastTurn=now; }
  }
  function drawSwimmers(z0,z1){
    for(var i=0;i<swimmers.length;i++){
      var m=swimmers[i]; if(m.z<z0||m.z>=z1) continue;
      var e=m.P*m.P*(3-2*m.P), sx=m.P<1?m.dirFrom*Math.cos(Math.PI*e):m.dir;
      if(Math.abs(sx)<.05) sx=sx<0?-.05:.05;
      var fade=Math.max(0,Math.min(1,m.y/(H*.15)))*jl;
      drawHalo(m.halo,m.x-m.w*Math.abs(sx)/2,m.y-m.h/2,m.w*Math.abs(sx),m.h,(.14+m.boost*.4+(m.kind==='siph'?.1+.06*Math.sin(performance.now()/600):0))*(.5+.5*m.z)*fade);
      var shN=performance.now(), sh=m.shT&&!still?Math.pow(Math.max(0,1-(shN-m.shT)/750),2):0;   /* the shiver: a quick shudder through its length that dies away */
      ctx.save(); ctx.globalAlpha=fade; ctx.translate(m.x+sh*Math.sin(shN/11)*2.2,m.y+sh*Math.sin(shN/15)*1.4); ctx.scale(sx,1+sh*.05*Math.sin(shN/19));
      swimStrips(m.pic,m.w,m.h,m.phase+sh*Math.sin(shN/24)*1.6,m.h*m.amp*(1+sh*1.8),NS(m.N));
      if(m.wave>=0&&!off('wave')) lightWave(m,performance.now()/1000);
      ctx.restore();
    }
  }
  /* The siphonophore's lights: a slow shimmer down its length always, and a bright ripple when touched. Drawn
     as the picture again, added, strip by strip, each strip as bright as the ripple is where it is. */
  /* ⛳ 18 Oct, his note: "should this guy ripple more/longer like a cuttlefish? right now it is just one ripple. it feels weird".
     A touch used to send one pulse down it in ~1.3s. Now it's a cuttlefish's passing cloud: bands of light chase each other head to
     tail, two or three on the body at once, for about 4.5s, swelling in and fading out. */
  var SIPH_T=4.5;
  function siphBands(m,u){
    if(m.wave<0) return 0;
    var k=m.wave, env=Math.min(1,k/.35)*Math.min(1,(SIPH_T-k)/1.4);
    return Math.pow(Math.max(0,Math.sin(Math.PI*2*(k*1.15-u*2.4))),4)*Math.max(0,env);
  }
  function lightWave(m,t){
    /* 18 Oct 3pm, his note: "can it be smoother? it's a bit blocky". It was 24 strips, each one flat brightness, so the bands came
       out as steps. Now the lit copy is drawn whole (same strips as the body, so it lines up) on its own small canvas, then faded by
       one smooth gradient along its length: no steps. */
    var pic=m.pic, iw=pic.width, ih=pic.height, N=NS(m.N), amp=m.h*m.amp, pad=Math.ceil(amp)+2;
    var c=m.lw||(m.lw=document.createElement('canvas')), cw=Math.ceil(m.w*dpr), ch=Math.ceil((m.h+pad*2)*dpr);
    if(c.width!==cw||c.height!==ch){ c.width=cw; c.height=ch; }
    var x=c.getContext('2d'); x.setTransform(1,0,0,1,0,0); x.globalCompositeOperation='source-over'; x.clearRect(0,0,cw,ch);
    x.setTransform(dpr,0,0,dpr,0,0);
    for(var i=0;i<N;i++){
      var u0=i/N, u1=(i+1)/N, u=(u0+u1)/2, body=Math.max(0,(u-.32)/.68);
      var off=N>1?amp*Math.pow(body,1.5)*Math.sin(u*Math.PI*1.8-m.phase):0;
      x.drawImage(pic,u0*iw,0,(u1-u0)*iw,ih,u0*m.w,pad+off,(u1-u0)*m.w+.35,m.h);
    }
    var g=x.createLinearGradient(0,0,m.w,0);
    for(var k=0;k<=48;k++){ var uu=k/48, a=Math.max(0,Math.min(1,.10+.08*Math.sin(t*1.7-uu*9)+siphBands(m,uu)*.9)); g.addColorStop(uu,'rgba(0,0,0,'+a.toFixed(3)+')'); }
    x.globalCompositeOperation='destination-in'; x.fillStyle=g; x.fillRect(0,0,m.w,m.h+pad*2);
    ctx.globalCompositeOperation='lighter'; ctx.drawImage(c,-m.w/2,-m.h/2-pad,m.w,m.h+pad*2);
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  }


  /* ---- the isopod ----
     A giant isopod plods along the front of the seabed, legs rippling. Touch it and it hunkers down flat for a
     moment, then hurries off the other way. */
  var isopod=null;
  function isoRect(){
    var F=R.floor, I=isopod; if(!F||!I) return null;
    var w=Math.max(80,Math.min(170,F.h*.4)), h=w*I.pic.height/I.pic.width;
    return {x:F.x+F.w*I.u, y:F.y+F.h*I.v-h/2, w:w, h:h};
  }
  function stepIsopod(now,s){
    var I=isopod, F=R.floor; if(!I||!F) return;
    var r=isoRect(), u0=Math.max(.06,-F.x/F.w+.06), u1=Math.min(.94,(W-F.x)/F.w-.06);
    var near=ptr.in&&Math.hypot(ptr.x-r.x,ptr.y-r.y)<r.w*.6;
    if(near&&I.hunker<.5&&now>I.pause){ I.hunker=1; I.pause=now+1400; I.run=0; }
    if(now<I.pause){ I.hunker=Math.min(1,I.hunker+s*8); return; }
    if(I.hunker>0){ I.hunker=Math.max(0,I.hunker-s*3); if(I.hunker===0&&!I.run){ I.run=2.5;
      var away=ptr.x<r.x?-1:1; if(away!==I.dir&&I.P>=1){ I.dirFrom=I.dir; I.dir=away; I.P=0; } } return; }
    if(I.P<1){ I.P=Math.min(1,I.P+s/.5); return; }
    I.run=Math.max(0,I.run-s);
    /* 10:28pm: it picks up flakes that have settled on the seabed — plods toward the nearest, stops, eats */
    var seek=null, sd=F.w*.25;
    if(I.run<=0) for(var q=0;q<food.length;q++){ var fq=food[q]; if(fq.landed&&!fq.dead){ var dq=Math.abs(fq.x-r.x); if(dq<sd){ sd=dq; seek=fq; } } }
    if(seek){ var want=seek.x<r.x?1:-1; if(want!==I.dir&&sd>r.w*.3){ I.dirFrom=I.dir; I.dir=want; I.P=0; return; }
      if(sd<r.w*.35){ seek.dead=true; fedOnce(); I.pause=now+500; return; } }
    var v=(I.run>0?60:seek?22:11)/F.w;
    I.u-=I.dir*v*s; I.phase+=s*(I.run>0?3.2:1.1);
    if((I.u<u0&&I.dir>0)||(I.u>u1&&I.dir<0)){ I.dirFrom=I.dir; I.dir=-I.dir; I.P=0; }
  }
  function drawIsopod(){
    var I=isopod, r=isoRect(); if(!r) return;
    var pic=I.pic, iw=pic.width, ih=pic.height;
    var e=I.P*I.P*(3-2*I.P), sx=I.P<1?I.dirFrom*Math.cos(Math.PI*e):I.dir; if(Math.abs(sx)<.05) sx=sx<0?-.05:.05;
    var sq=1-.14*I.hunker, N=NS(22), walking=I.P>=1&&I.hunker===0;
    ctx.save(); ctx.translate(r.x,r.y+r.h/2); ctx.scale(sx,sq);
    for(var i=0;i<N;i++){
      var v0=i/N, v1=(i+1)/N, v=(v0+v1)/2, legs=Math.max(0,(v-.5)/.5);
      var off=walking?r.w*.022*legs*Math.sin(I.phase*Math.PI*2-v*7):0;
      var bob=walking?Math.sin(I.phase*Math.PI*4)*r.h*.01:0;
      ctx.drawImage(pic,0,v0*ih,iw,(v1-v0)*ih,-r.w/2+off,-r.h+v0*r.h+bob,r.w,(v1-v0)*r.h+.35);
    }
    ctx.restore();
  }

  /* ---- tube worms ----
     Two clumps on the seabed. Come near and the plume snaps back into its tube, and the neighbours follow a
     beat later; leave them alone and they creep back out. Placed in the floor picture's own coordinates. */
  var WORM_MOUTH={x:.37,y:.17}, WORM_BASE={x:.42,y:.97};
  function makeWorms(){
    worms=[];
    [[.415,.70,4],[.635,.665,3],[.20,.80,2]].forEach(function(c,ci){
      for(var i=0;i<c[2];i++) worms.push({u:c[0]+rnd(-.022,.022), v:c[1]+rnd(-.008,.025), s:rnd(.5,1), flip:Math.random()<.5,
        out:1, hide:0, trig:0, sw:rnd(0,6), c:ci});
    });
    worms.sort(function(a,b){ return a.v-b.v; });
  }
  function wormRect(w){
    var F=R.floor, tb=pics.worm_tube; if(!F||!tb) return null;
    var hh=F.h*.34*w.s, ww=hh*tb.naturalWidth/tb.naturalHeight, bx=F.x+F.w*w.u, by=F.y+F.h*w.v;
    var x=bx-ww*WORM_BASE.x, y=by-hh*WORM_BASE.y;
    return {x:x,y:y,w:ww,h:hh,mx:x+ww*WORM_MOUTH.x,my:y+hh*WORM_MOUTH.y,bx:bx};
  }
  function stepWorms(now,s){
    for(var i=0;i<worms.length;i++){
      var w=worms[i], r=wormRect(w); if(!r) return;
      var mx=w.flip?2*r.bx-r.mx:r.mx;
      var near=ptr.in&&Math.hypot(ptr.x-mx,ptr.y-(r.my-r.h*.08))<Math.max(46,r.h*.55);
      if(near&&w.out>.3) hideWorm(w,now,0);
      /* 10:28pm: a flake drifting through an open plume gets caught — the plume snaps in with it, then opens again */
      if(w.out>.8&&!w.hide||w.out>.8&&now>w.hide) for(var q=0;q<food.length;q++){ var fq=food[q];
        if(!fq.dead&&!fq.landed&&Math.hypot(fq.x-mx,fq.y-r.my)<Math.max(14,r.h*.22)){ fq.dead=true; fedOnce(); w.hide=now+rnd(500,800); break; } }
      if(w.trig&&now>=w.trig){ w.trig=0; w.hide=now+rnd(1300,2600); }
      if(now<w.hide||near){ w.out=Math.max(0,w.out-s/.11); if(near) w.hide=Math.max(w.hide,now+900); }
      else w.out=Math.min(1,w.out+s/rnd(1.3,1.6));
    }
  }
  function hideWorm(w,now,delay){
    if(delay){ if(!w.trig&&w.out>.3) w.trig=now+delay; return; }
    w.hide=now+rnd(1300,2600);
    /* the rest of the clump flinches a beat later, nearest first */
    worms.forEach(function(o){ if(o!==w&&o.c===w.c) hideWorm(o,now,80+Math.abs(o.u-w.u)*9000); });
  }
  function drawWorms(t){
    var tb=pics.worm_tube, pl=pics.worm_plume; if(!tb||!pl) return;
    for(var i=0;i<worms.length;i++){
      var w=worms[i], r=wormRect(w); if(!r) continue;
      ctx.save();
      if(w.flip){ ctx.translate(2*r.bx,0); ctx.scale(-1,1); }
      if(w.out>.02){
        var e=1-Math.pow(1-w.out,3), k=.12+.88*e, sway=still?0:Math.sin(t*.9+w.sw)*.07*e;
        ctx.save(); ctx.globalAlpha=Math.min(1,w.out*3);
        ctx.translate(r.mx,r.my+(1-e)*r.h*.04); ctx.rotate(sway); ctx.scale(k,k); ctx.translate(-r.mx,-r.my);
        ctx.drawImage(pl,r.x,r.y,r.w,r.h); ctx.restore();
      }
      ctx.drawImage(tb,r.x,r.y,r.w,r.h);
      ctx.restore();
    }
  }

  /* ---- the vent's smoke, and silt ----
     The painting has a plume of smoke baked in; puffs rise over it so it moves. A hand through it pushes it
     about. Tap the seabed (or drag along it) and silt kicks up and settles. */
  var puff=null, dust=null;
  function puffSprite(c0,c1){
    var c=document.createElement('canvas'); c.width=c.height=64; var x=c.getContext('2d');
    var g=x.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba('+c0+',1)'); g.addColorStop(.5,'rgba('+c1+',.45)'); g.addColorStop(1,'rgba('+c1+',0)');
    x.fillStyle=g; x.fillRect(0,0,64,64); return c;
  }
  function stepSmoke(now,s){
    var F=R.floor; if(!F) return;
    if(!still&&now>smokeT){ smokeT=now+rnd(160,280);
      smoke.push({u:.522+rnd(-.006,.006), y:0, dx:0, r:F.h*rnd(.03,.05), v:F.h*rnd(.055,.085), a:rnd(.10,.16), t:now, life:rnd(5500,7500), ph:rnd(0,6)}); }
    for(var i=smoke.length-1;i>=0;i--){
      var p=smoke[i], k=(now-p.t)/p.life;
      if(k>=1){ smoke.splice(i,1); continue; }
      p.y-=p.v*s; p.r+=F.h*.022*s; p.dx+=Math.sin(now/1400+p.ph)*F.h*.012*s;
      var px=F.x+F.w*p.u+p.dx, py=F.y+F.h*.6+p.y, hx=px-ptr.x, hy=py-ptr.y, hd=Math.hypot(hx,hy)||1;
      if(ptr.in&&hd<p.r*1.6&&ptr.speed>150){ p.dx+=hx/hd*ptr.speed*.05*s; p.y+=hy/hd*ptr.speed*.03*s; }
    }
    for(var j=silt.length-1;j>=0;j--){
      var q=silt[j]; q.t+=s;
      if(q.t>q.life){ silt.splice(j,1); continue; }
      q.vy+=14*s; q.vx*=Math.pow(.3,s); q.vy*=Math.pow(.4,s); q.x+=q.vx*s; q.y+=q.vy*s;
    }
  }
  function kickSilt(x,y,n,force){
    for(var i=0;i<n;i++){ var a=-Math.PI*rnd(.08,.92);
      silt.push({x:x+rnd(-10,10), y:y+rnd(-3,3), vx:Math.cos(a)*force*rnd(.3,1), vy:Math.sin(a)*force*rnd(.4,1.1), r:rnd(7,16), t:0, life:rnd(2,3.6), a:rnd(.18,.28)}   /* 17 Oct "a bit too bright": .45-.7 → .18-.28 */); }
    if(silt.length>220) silt.splice(0,silt.length-220);
  }
  function drawSmoke(){
    var F=R.floor; if(!F||!smoke.length) return;
    puff=puff||puffSprite('120,170,235','70,120,200');
    var now=performance.now();
    for(var i=0;i<smoke.length;i++){
      /* ⛔ 16 Oct, "weird lightning flashes": at the end of its life k passes 1, a went a hair below zero, and the
         browser IGNORES a negative globalAlpha — the dying puff was drawn at full strength for a frame. */
      var p=smoke[i], k=(now-p.t)/p.life, a=p.a*Math.sin(Math.PI*Math.min(1,k*1.4))*(1-k)*jl;
      if(!(a>.002)) continue;
      ctx.globalAlpha=a; ctx.drawImage(puff,F.x+F.w*p.u+p.dx-p.r,F.y+F.h*.6+p.y-p.r,p.r*2,p.r*2);
    }
    ctx.globalAlpha=1;
  }
  function drawSilt(){
    if(!silt.length) return;
    dust=dust||puffSprite('95,112,110','60,76,78');   /* murky silt, not white smoke */
    for(var i=0;i<silt.length;i++){
      var q=silt[i], k=q.t/q.life, a=q.a*Math.min(1,k*6)*(1-k);
      if(!(a>.002)) continue;
      ctx.globalAlpha=a; ctx.drawImage(dust,q.x-q.r*(1+k),q.y-q.r*(1+k),q.r*2*(1+k),q.r*2*(1+k));
    }
    ctx.globalAlpha=1;
  }


  /* ---- the dark ----
     ⛳ 15 Oct, his note on the lit seabed: "the overall tone should be mostly dark and mysterious ... i don't mind
     showing hints of an environment". So the set is drawn on its own layer and then cut back by a light map:
     almost nothing everywhere, with pools of light where something is glowing: the coral and the vent, any
     jellyfish drifting low, and above all the anglerfish's lure, which lights up the rocks it swims over.
     The cast is not darkened: they carry their own light. */
  var FINE=matchMedia('(hover:hover) and (pointer:fine)').matches, handGlow=0;
  var DARK_BASE=.21, setLayer   /* 18 Oct 5:35pm "a tiny little bit lighter again" (.16) */=null, lightMap=null, LK=.25;
  /* ⛳ 16 Oct, "why is the middle of the deep sea scene always brighter than everything else?" — the strong pools all
     sat on the painting's brightest things, which are in the middle. Centre cut back, the edges given a little. */
  var POOLS=[[.58,.60,.42,.2],[.44,.50,.34,.12],[.53,.42,.42,.08],[.29,.37,.32,.14],[.83,.30,.36,.14],[.12,.55,.3,.1],[.94,.55,.3,.1]];   /* 9:44pm: a third down again */   /* floor u, v, radius (floor heights), strength */
  /* ⛳ 18 Oct 10:47, his note: "on a laptop on a bright glary sunny day ... I can barely see the ocean environment or seaweed at all.
     Is it too dark? I'm worried about overcompensating". Measured: the whole aquarium averaged 3.6/255 (1.4%). DARK_BASE .07 → .16 and
     the far rocks .13 → .26: the set reads as a place, the pools still lead, the screen average only rises to ~4.1. */
  function pool(m,x,y,r,a){
    if(a<=.005||r<=1) return;
    var g=m.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(0,0,0,'+a+')'); g.addColorStop(.45,'rgba(0,0,0,'+(a*.5)+')'); g.addColorStop(1,'rgba(0,0,0,0)');
    m.fillStyle=g; m.fillRect(x-r,y-r,r*2,r*2);
  }
  function makeLight(t){
    if(!lightMap) lightMap=document.createElement('canvas').getContext('2d');
    var lw=Math.max(2,Math.round(W*LK)), lh=Math.max(2,Math.round(H*LK));
    if(lightMap.canvas.width!==lw||lightMap.canvas.height!==lh){ lightMap.canvas.width=lw; lightMap.canvas.height=lh; }
    var m=lightMap; m.setTransform(1,0,0,1,0,0); m.globalCompositeOperation='source-over'; m.clearRect(0,0,lw,lh);
    m.fillStyle='rgba(0,0,0,'+DARK_BASE+')'; m.fillRect(0,0,lw,lh);
    m.setTransform(LK,0,0,LK,0,0); m.globalCompositeOperation='lighter';
    var F=R.floor;
    if(F) POOLS.forEach(function(p,i){ pool(m,F.x+F.w*p[0],F.y+F.h*p[1],F.h*p[2],p[3]*(still?1:.85+.15*Math.sin(t*(.7+i*.23)+i))); });
    for(var i=0;i<jellies.length;i++){ var j=jellies[i]; pool(m,j.x,j.y+j.h*.3,j.w*1.6,(.22+j.boost*.3)*(.4+.6*j.z)); }
    for(i=0;i<swimmers.length;i++){ var w=swimmers[i]; pool(m,w.x,w.y,w.w*.9,w.kind==='siph'?.2+(w.wave>=0?.35:0):.1+w.boost*.2); }
    var sr=SIGN_ON&&signRect(); if(sr) pool(m,sr.x,sr.y-sr.h*.2,sr.w*.95,.55);   /* 18 Oct: tighter, on the board, so the sponge behind it stays in the dark */   /* just enough light to read it, like the coral */
    for(i=0;i<junk.length;i++) pool(m,junk[i].x,junk[i].y,junk[i].w*1.1,junk[i].name==='junk_phone'?.22+.3*phoneLit(junk[i]):.22);
    /* ⛳ 18 Oct, his idea: "is it weird if the cursor brightens the scene around it a tiny little bit?" — a diver's torch. A soft pool about
       the glove's width at a third of the lure's strength, so the anglerfish stays the light. Desktop only (a phone has no hand on
       screen); it eases in and out instead of switching. Not while the glove is in the fish's mouth. */
    var hg=FINE&&ptr.in&&jawTo!==1?1:0; handGlow+=(hg-handGlow)*.08;
    if(handGlow>.01) pool(m,ptr.x,ptr.y,90,.13*handGlow);
    if(ready&&light>.01&&fish.lx!=null) pool(m,fish.lx,fish.ly,fw*1.4,.38*light*gm);   /* 9:44pm "still a bit too bright ... when the angler fish swims in front": was 1.9fw at .75 */   /* the smoothed light (see drawAngler) */
  }
  /* ⛔ 15 Oct, "a low frame rate janky mess when you scroll down to the deep sea": this was two full-window
     layers at retina resolution, cleared, filled, masked and composited every frame (~4000x2300 px each on his
     screen). Now ONE pass, only the band the seabed occupies, at 1 layer pixel per CSS pixel (it is dark and
     soft, nobody can see the difference); the far rocks are drawn straight on, faint, with no layer at all. */
  var SK=1;
  function inTheDark(fn){
    if(!setLayer) setLayer=document.createElement('canvas').getContext('2d');
    var L=setLayer, y0=Math.max(0,Math.floor(R.floor?R.floor.y:0)), bh=Math.max(1,H-y0);
    var lw=Math.max(1,Math.round(W*SK)), lh=Math.max(1,Math.round(bh*SK));
    if(L.canvas.width!==lw||L.canvas.height!==lh){ L.canvas.width=lw; L.canvas.height=lh; }
    L.setTransform(1,0,0,1,0,0); L.globalCompositeOperation='source-over'; L.globalAlpha=1; L.clearRect(0,0,lw,lh);
    L.setTransform(SK,0,0,SK,0,-y0*SK);
    var keep=ctx; ctx=L; fn(); ctx=keep;
    /* ⛔ 16 Oct, "the giant squid ... seems to be overlapping things in the foreground": the dark was made by making the
       seabed SEE-THROUGH, so whatever swam behind it (the squid, the far jellies) showed through the rocks. Cut the
       seabed's shape out of what's behind it first, so the dark is the page's black, not a window. */
    /* 20 Oct, smoothing: the same picture in one pass over the window instead of two. The seabed layer keeps its own
       shape (solid) and is darkened toward black by the dark map (source-atop), so laying it down covers what's behind. */
    if(!OLD.dark){
      L.setTransform(1,0,0,1,0,0); L.globalAlpha=1; L.globalCompositeOperation='source-atop';
      var dm=darkMap(); L.drawImage(dm,0,y0*LK,dm.width,bh*LK,0,0,lw,lh);
      L.globalCompositeOperation='source-over';
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1; ctx.drawImage(L.canvas,0,y0,W,bh);
      return;
    }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.globalCompositeOperation='destination-out';
    ctx.drawImage(L.canvas,0,y0,W,bh); ctx.globalCompositeOperation='source-over';
    L.setTransform(1,0,0,1,0,0); L.globalAlpha=1; L.globalCompositeOperation='destination-in';
    var m=lightMap.canvas; L.drawImage(m,0,y0*LK,m.width,bh*LK,0,0,lw,lh);
    L.globalCompositeOperation='source-over';
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.drawImage(L.canvas,0,y0,W,bh);
  }
  /* the light map turned inside out: opaque black where it's dark, clear where it's lit (quarter size, like the map) */
  var darkC=null;
  function darkMap(){
    var m=lightMap.canvas; darkC=darkC||document.createElement('canvas');
    if(darkC.width!==m.width||darkC.height!==m.height){ darkC.width=m.width; darkC.height=m.height; }
    var x=darkC.getContext('2d'); x.globalCompositeOperation='copy'; x.fillStyle='#000'; x.fillRect(0,0,m.width,m.height);
    x.globalCompositeOperation='destination-out'; x.drawImage(m,0,0); x.globalCompositeOperation='source-over';
    return darkC;
  }

  /* ---- feeding, and things that sink ----
     ⛳ 16 Oct, his ask. A click in open water (not on a creature — those still react as before) drops a glowing morsel
     that sinks; the hatchetfish, the dumbo octopus and the anglerfish come for it. Every so often a click drops a
     kitsch fish-tank ornament instead — a bubbling diver, a shopping trolley, a treasure chest — which sinks, lands with a
     puff of silt and stays on the seabed until the page is reloaded. Painted, SoR4, like everything else down here. */
  var food=[], junk=[], drops=0, fedT=false, JUNK=['junk_trolley','junk_chest','junk_moai','junk_cone','junk_portaloo','junk_scooter','junk_besser','junk_phone']   /* 9:31pm: e-bike out (same gag as the scooter), portaloo in */   /* diver cut 9:11pm: "looks like a realistic one" */   /* scooter cut 16 Oct: lying flat it read as a stick */, JW={junk_trolley:118,junk_chest:96,junk_moai:130,junk_cone:52,junk_portaloo:155,junk_scooter:88,junk_besser:86,junk_phone:54}   /* besser block, snapped rope: his mafia gag (9:31pm) */   /* 9:11pm: scooter back standing up (it read as a stick lying flat), plus a share e-bike */;
  function fedOnce(){ if(!fedT){ fedT=true; T('fed_fish'); } }
  function nearestFood(x,y,R){
    var b=null, bd=R; for(var i=0;i<food.length;i++){ var f=food[i]; if(f.dead) continue; var d=Math.hypot(f.x-x,f.y-y); if(d<bd){ bd=d; b=f; } }
    return b;
  }
  function dropThing(x,y,now){
    drops++;
    /* 16 Oct, "it takes a bit too long for the novelty items to appear": the 2nd click always sinks one, then 2 in 5 */
    /* 9:38pm, "two just appeared almost on the first click and then two back to back": the first comes on the 4th click
       (or 2s into a hold), then never closer than 6s apart, from any mix of clicks and holds */
    sprinkle.junkAt=now+rnd(1100,1400); sprinkle.held=0;
    /* 9:46pm, "when a novelty item pops out, it should just be the item, not the fish food as well" */
    if((drops===3||(drops>3&&Math.random()<.25))&&dropJunk(x,y,now)) return;   /* 9:49pm "a bit more frequently": 4th→3rd click, .15→.25 */
    /* ⛔ 16 Oct, "the food looks weird ... wtf is the glowing dot? shouldn't more appear if you click and hold / drag?"
       It's fish FLAKES now — little papery scraps in the colours of a tub of tropical flakes, fluttering down. A click
       is a pinch; hold the button (or a finger) down and drag to sprinkle a trail. */
    sprinkle.on=true; sprinkle.next=0;
    for(var i=0,n=rnd(9,13);i<n;i++) flake(x,y,24);   /* a pinch, spread (16 Oct: "spread out more when you click") */
  }
  /* 16 Oct, "a little bit darker / more in the scene": the tub's colours, taken down into the dark */
  var lastJunk=-1e9;
  function dropJunk(x,y,now,gap){
    if(now-lastJunk<(gap||4000)) return false; lastJunk=now;   /* gap 6s → 4s (clicks); holds pass a shorter one */
    var left=JUNK.filter(function(n){ return pics[n]&&!junk.some(function(j){ return j.name===n; }); });
    /* 9:03pm, "still no novelty items on the ... click and hold": once all five were down, nothing more could come.
       Now repeats come too, and the seabed keeps at most ten (the oldest goes). */
    /* 10:31pm: "no more novelty items if they have all already appeared ... at random but never the same two back to back".
       Each one once per visit, in random order; once all seven are down, clicks just feed. */
    if(!left.length) return false;
    var n=left[Math.floor(Math.random()*left.length)], im=pics[n], w=JW[n]*(W<=700?.75:1);
    junk.push({name:n, pic:tinted(im,null,.5),   /* 9:46pm: "not so bright ... fit more naturally" (was .16) */   /* 16 Oct: colour-accurate, "comically jarring" — barely dimmed */ x:x, y:y, w:w, h:w*im.naturalHeight/im.naturalWidth, vy:40, rot:rnd(-.35,.35), vr:rnd(-.35,.35), landed:false, t:now, next:now+rnd(800,1600)});
    if(n==='junk_phone') junk[junk.length-1].h=w*2.05*.42/.84;   /* drawn lying flat, not from the picture */
    T('junk_'+n.slice(5));
    return junk[junk.length-1];
  }
  var sprinkle={on:false,next:0,junkAt:0,held:0}, FLAKE=['#683619','#5c2019','#665222','#37461f','#4f2d16','#655a37'];   /* 8:52pm: "still a bit too bright", another ~25% down */
  function flake(x,y,spread){
    if(food.length>220){ var k=food.findIndex(function(f){ return f.landed||f.dead; }); food.splice(k<0?0:k,1); }   /* full: make room, never refuse */
    var r=rnd(2.2,4.2), n=4+(Math.random()*3|0), pts=[];
    for(var i=0;i<n;i++){ var a=i/n*6.283+rnd(-.4,.4); pts.push([Math.cos(a)*r*rnd(.6,1.2),Math.sin(a)*r*rnd(.5,1)]); }
    food.push({x:x+rnd(-spread,spread), y:y+rnd(-spread*.5,spread*.5), vy:rnd(4,14), vx:rnd(-40,40), ph:rnd(0,6), rot:rnd(0,6.28), vr:rnd(-3,3),
      dx:rnd(-14,14), sw:rnd(8,24), sf:rnd(280,620),   /* its own drift and sway, so a pinch spreads as it falls */
      flip:rnd(0,6), c:FLAKE[Math.random()*FLAKE.length|0], pts:pts, t:performance.now(), landed:0, dead:false});
  }
  addEventListener('pointerup',function(){ sprinkle.on=false; },{passive:true});
  addEventListener('touchend',function(e){ if(!e.touches.length) sprinkle.on=false; },{passive:true});
  function stepFood(now,s){
    var gy=groundY();
    if(sprinkle.on&&ptr.in&&now>sprinkle.next&&ptr.y<gy-20){ sprinkle.next=now+45; flake(ptr.x,ptr.y,6);
      /* 16 Oct, his ask: holding down sprinkles, and now and then something tips out of the tin with the flakes */
      /* 8:57pm, "held for like 5 seconds straight and no novelty item": the first one in a hold is certain (~1.5s), then 60% every 2.5-4s */
      /* 10pm, "should appear more often when you click and hold/drag": first ~1.2s in, then ~every 2s */
      if(now>sprinkle.junkAt){ sprinkle.junkAt=now+rnd(1700,2500); if(!sprinkle.held++||Math.random()<.85) dropJunk(ptr.x,ptr.y,now,1600); } }
    for(var i=food.length-1;i>=0;i--){
      var f=food[i];
      if(f.dead||(f.landed&&now-f.landed>6000)){ food.splice(i,1); continue; }
      if(!f.landed){
        /* a flake falls like paper: slow, swinging side to side, turning over */
        f.vy+=(16-f.vy)*Math.min(1,s*1.5); f.vx*=Math.pow(.35,s);
        f.y+=f.vy*s; f.x+=(f.vx+f.dx+Math.sin(now/f.sf+f.ph)*f.sw)*s; f.rot+=f.vr*s; f.flip+=s*3;
        if(f.y>=gy-2){ f.y=gy-2+rnd(-2,2); f.landed=now; }
      }
    }
    for(var k=0;k<junk.length;k++){
      var j=junk[k];
      if(!j.landed){
        /* sinks like something heavy: quicker than the flakes, rocking a little and righting itself on the way down */
        j.vy+=(150-j.vy)*Math.min(1,s*1.5); j.y+=j.vy*s; j.rot+=j.vr*s; j.vr*=Math.pow(.6,s); j.rot*=Math.pow(.35,s);
        if(j.vx){ j.x+=j.vx*s; j.vx*=Math.pow(.15,s); }   /* coughed out: thrown forward, then sinks */
        if(j.y+j.h*.42>=gy+6){ j.y=gy+6-j.h*.42; j.landed=true; kickSilt(j.x,gy,18,120); j.vy=0; }
      } else {
        j.rot*=Math.pow(.02,s);   /* settles upright */
        if(j.buzz) j.buzz=Math.max(0,j.buzz-s/1.1);
        if(now>j.next){
          if(j.name==='junk_diver'){ j.next=now+rnd(1100,2000); puffBubbles(j.x+j.w*.18,j.y-j.h*.42,rnd(1,3)|0,0,-20);   /* from the helmet */ }
          else if(j.name==='junk_chest'){ j.next=now+rnd(3500,6000); puffBubbles(j.x+j.w*.05,j.y-j.h*.08,rnd(4,7)|0,0,-30);   /* a burp from under the lid */ }
          else if(j.name==='junk_phone'){ j.next=now+rnd(6500,9500); j.calls=(j.calls||87)+1+(Math.random()<.3?1:0); if(j.calls%10===0) j.calls++;   /* never a round number (8am) */ j.buzz=1; j.wake=now; }
          else j.next=now+1e9;
        }
      }
    }
  }
  /* a little puff of bubbles (scares, the diver's helmet, the chest's burp) — the anglerfish's bubble list */
  function puffBubbles(x,y,n,vx,vy){
    for(var i=0;i<n;i++) mbub.push({x:x+rnd(-4,4), y:y+rnd(-4,4), vx:vx+rnd(-25,25), vy:vy+rnd(-30,0), r:rnd(1.5,4), t:performance.now(), life:rnd(900,1600), ph:rnd(0,6)});
    if(mbub.length>90) mbub.splice(0,mbub.length-90);
  }
  function drawFood(t){
    var now=performance.now();
    ctx.lineWidth=.8; ctx.strokeStyle='rgba(8,6,4,.9)';
    for(var i=0;i<food.length;i++){
      var f=food[i]; if(f.dead) continue;
      var a=f.landed?Math.max(0,1-(now-f.landed)/6000):1; if(!(a>.01)) continue;
      ctx.save(); ctx.globalAlpha=a*.8; ctx.translate(f.x,f.y); ctx.rotate(f.rot); ctx.scale(1,f.landed?.45:.35+.65*Math.abs(Math.cos(f.flip)));
      ctx.beginPath(); for(var k=0;k<f.pts.length;k++) ctx[k?'lineTo':'moveTo'](f.pts[k][0],f.pts[k][1]); ctx.closePath();
      ctx.fillStyle=f.c; ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha=1;
  }

  /* ⛳ 16 Oct 9:35pm, his ask: "should a bit of rope be floating up still attached?" The snapped end rises from the knot
     and sways in the current, frayed at the tip. Kept straight-ish, never a loop. Painted like the art: ink outline,
     hemp fill, twist marks. Drawn in the block's own space, so it rides the block down as it sinks. */
  function floatRope(j){
    var t=performance.now()/1000, x0=j.w*.12, y0=j.h*.02, L=j.w*.95, n=16, pts=[];
    for(var i=0;i<=n;i++){ var u=i/n, sway=Math.sin(t*1.3+u*2.6+j.w)*j.w*.09*u*u+Math.sin(t*.7)*j.w*.03*u;
      pts.push([x0+sway+u*j.w*.06, y0-u*L]); }
    function path(){ ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]); for(var i=1;i<pts.length;i++) ctx.lineTo(pts[i][0],pts[i][1]); }
    ctx.lineCap='round'; ctx.lineJoin='round';
    path(); ctx.strokeStyle='#15110d'; ctx.lineWidth=j.w*.075; ctx.stroke();
    path(); ctx.strokeStyle='#8f877b'; ctx.lineWidth=j.w*.045; ctx.stroke();
    ctx.strokeStyle='rgba(30,24,18,.8)'; ctx.lineWidth=1;
    for(var k=1;k<n;k++){ var p=pts[k], q=pts[k+1]||p, dx=q[0]-p[0], dy=q[1]-p[1], d=Math.hypot(dx,dy)||1, nx=-dy/d, ny=dx/d, r=j.w*.022;
      ctx.beginPath(); ctx.moveTo(p[0]+nx*r-dx*.3,p[1]+ny*r-dy*.3); ctx.lineTo(p[0]-nx*r+dx*.3,p[1]-ny*r+dy*.3); ctx.stroke(); }
    var e=pts[n]; ctx.strokeStyle='#8f877b'; ctx.lineWidth=1.3;
    for(var f=-1;f<=1;f++){ ctx.beginPath(); ctx.moveTo(e[0],e[1]); ctx.lineTo(e[0]+f*j.w*.035+Math.sin(t*2+f)*2,e[1]-j.w*.05); ctx.stroke(); }
  }

  /* ⛳ 16 Oct 10:13pm, his idea: foreground seaweed. ⛔ 10:21pm, a code-drawn version: "way worse. it should look nice and
     lush and smooth ... like an old Disney movie or Fantasia would do in the foreground", and "moves way too much, its
     animation should be subtle and understated and fluid". So it's painted now (Midjourney, Fantasia gouache; see
     designs/weed-mj/make_weed.py → weed_tall / weed_low), and it only breathes: each picture is laid down in thin
     horizontal bands, each nudged sideways a little more the higher it is, on a slow 7-9s current. A hand moving
     through gives it a soft push that settles back. Bands are built on their own layer, then laid down once (no seams). */
  var weed=null, wl=null, wpx=null;
  function makeWeed(){
    var T=pics.weed_tall, Lo=pics.weed_low; weed=[]; if(!T||!Lo) return;
    var small=W<=700, th=H*(small?.5:.66), tw=th*T.naturalWidth/T.naturalHeight;
    weed.push({im:T, x:-tw*.18, w:tw, h:th, flip:false, ph:rnd(0,6), b:0, v:0, a:.95});
    if(!small) weed.push({im:T, x:W-tw*.78, w:tw*.85, h:th*.85, flip:true, ph:rnd(0,6), b:0, v:0, a:.92});
    var lh=H*(small?.12:.15), lw=lh*Lo.naturalWidth/Lo.naturalHeight;
    for(var x=-lw*.15,k=0;x<W;x+=lw*.82,k++) weed.push({im:Lo, x:x, w:lw, h:lh, flip:!!(k%2), ph:rnd(0,6), b:0, v:0, a:.97, low:true});
  }
  function drawWeed(t){
    if(!weed||weed.W!==W||weed.H!==H){ makeWeed(); if(!weed) return; weed.W=W; weed.H=H; }
    if(!weed.length) return;
    var dt=Math.min(.05,t-(drawWeed.t||t)); drawWeed.t=t;
    var pvx=0; if(ptr.in&&wpx!=null) pvx=(ptr.x-wpx)/Math.max(.008,dt); wpx=ptr.x;
    if(!wl) wl=document.createElement('canvas').getContext('2d');
    for(var i=0;i<weed.length;i++){
      var s=weed[i], ww=Math.ceil(s.w*dpr), hh=Math.ceil(s.h*dpr), pad=Math.ceil(s.w*.06*dpr);
      /* ⛔ 10:29pm, "the seaweed hover effect is really rigid and janky": the whole clump bent as one block on a stiff
         spring. Now a gentle push on a soft spring, and the bend travels UP the plant: each band uses the push as it
         was a moment ago, longer ago the higher it is, so it ripples up like a frond in water. */
      if(ptr.in&&Math.abs(pvx)>60&&ptr.y>H-s.h&&ptr.x>s.x&&ptr.x<s.x+s.w) s.v+=Math.max(-1.2,Math.min(1.2,pvx/1400))*dt*30*(s.low?.7:1);
      /* 10:32pm "barely noticeable ... swish around elegantly a bit more": bigger push, and a looser spring that swings
         past and back a couple of times before it settles */
      s.v+=(-s.b*2.2-s.v*.75)*dt; s.b+=s.v*dt; s.b=Math.max(-.9,Math.min(.9,s.b));
      if(!s.hist){ s.hist=[]; for(var hh0=0;hh0<48;hh0++) s.hist.push(0); }
      s.hist.unshift(s.b); s.hist.length=48;
      var iw=s.im.naturalWidth, ih=s.im.naturalHeight, N=NS(s.low?8:22), amp=s.w*(s.low?.025:.035)*dpr;
      /* 20 Oct, smoothing: the bands go straight onto the scene, each on whole device pixels (the plant's corner rounded to one),
         instead of onto a layer that was then laid down — same bands, same see-through, no seams (they never overlap), and two
         window-sized passes a frame fewer. ?fishold=weed: the layer. */
      var direct=!OLD.weed, X0=Math.round((s.x-pad/dpr)*dpr), Y0=Math.round((H-s.h+2)*dpr), L=direct?ctx:wl;
      if(direct){ ctx.globalAlpha=s.a*jl; }
      else {
        if(wl.canvas.width<ww+pad*2||wl.canvas.height<hh){ wl.canvas.width=Math.max(wl.canvas.width,ww+pad*2); wl.canvas.height=Math.max(wl.canvas.height,hh); }
        wl.setTransform(1,0,0,1,0,0); wl.clearRect(0,0,ww+pad*2,hh);
      }
      for(var k=0;k<N;k++){
        var y0=Math.round(k/N*hh), y1=Math.round((k+1)/N*hh), up=1-(y0+y1)/2/hh;   /* 0 root, 1 tip */
        var bl=s.hist[Math.min(47,Math.round(up*up*40))];   /* the push, as it was a moment ago */
        var sw=still?0:(Math.sin(t*.8+s.ph-up*1.1)*.75+Math.sin(t*.47+s.ph*1.7)*.25+bl*6)*amp*up*up;
        L.save(); L.setTransform(1,0,0,1,direct?X0:0,direct?Y0:0); L.translate(pad+Math.round(sw),0);
        if(s.flip){ L.translate(ww,0); L.scale(-1,1); }
        L.drawImage(s.im,0,y0/hh*ih,iw,(y1-y0)/hh*ih,0,y0,ww,y1-y0); L.restore();
      }
      if(!direct){ ctx.globalAlpha=s.a*jl; ctx.drawImage(wl.canvas,0,0,ww+pad*2,hh,s.x-pad/dpr,H-s.h+2,s.w+pad*2/dpr,s.h); }
    }
    ctx.globalAlpha=1;
  }

  /* ⛳ 17 Oct, his idea → my pitch, his yes: "clearly an iPhone but not officially" — a dropped phone on the seabed, screen
     still lit, buzzing every 7-9s while the missed calls from Mum climb. 8am, his notes: "should lay more flat ... more
     like an iPhone, the iconic rounded corners and home button at the bottom", "100 is too much of a round number".
     So it's drawn here, not painted: the classic home-button phone, rendered upright once into its own canvas (redrawn only
     when the count changes), then laid down on the seabed in perspective — thin rows, narrower toward the far end. Its
     wallpaper is someone's sunset-beach holiday snap, which is the joke at the bottom of a river. */
  function phoneTime(){ var d=new Date(), h=d.getHours()%12||12, m=d.getMinutes(); return h+':'+(m<10?'0':'')+m; }
  function phoneLit(j){ var k=(performance.now()-(j.wake||j.t))/1000; return k<6?1:Math.max(.35,1-(k-6)/3*.65); }
  function roundRect(x,X,Y,w,h,r){ x.beginPath(); x.moveTo(X+r,Y); x.arcTo(X+w,Y,X+w,Y+h,r); x.arcTo(X+w,Y+h,X,Y+h,r); x.arcTo(X,Y+h,X,Y,r); x.arcTo(X,Y,X+w,Y,r); x.closePath(); }
  function phoneArt(j){
    var S=3, PW=Math.round(j.w*S), PH=Math.round(PW*2.05), c=j.art||(j.art=document.createElement('canvas'));
    if(c.width!==PW){ c.width=PW; c.height=PH; }
    var x=c.getContext('2d'); x.setTransform(1,0,0,1,0,0); x.clearRect(0,0,PW,PH);
    var R=PW*.17, lw=Math.max(2,PW*.025);
    /* body: black glass, a steel rim catching a little light along one side */
    roundRect(x,0,0,PW,PH,R); x.fillStyle='#0c0e12'; x.fill();
    var rim=x.createLinearGradient(0,0,PW,0); rim.addColorStop(0,'#6d7684'); rim.addColorStop(.15,'#2a2f37'); rim.addColorStop(1,'#1a1d22');
    x.lineWidth=lw*1.6; x.strokeStyle=rim; x.stroke();
    x.lineWidth=lw*.6; x.strokeStyle='#050608'; roundRect(x,lw*.5,lw*.5,PW-lw,PH-lw,R*.95); x.stroke();
    /* screen: a sunset-beach holiday wallpaper */
    var sx=PW*.07, sy=PH*.13, sw=PW*.86, sh=PH*.74;
    x.save(); x.beginPath(); x.rect(sx,sy,sw,sh); x.clip();
    var sky=x.createLinearGradient(0,sy,0,sy+sh); sky.addColorStop(0,'#2b3f8f'); sky.addColorStop(.38,'#e2577a'); sky.addColorStop(.58,'#ffb15c'); sky.addColorStop(.62,'#1d6f86'); sky.addColorStop(1,'#0d3b52');
    x.fillStyle=sky; x.fillRect(sx,sy,sw,sh);
    x.fillStyle='rgba(255,236,170,.95)'; x.beginPath(); x.arc(sx+sw*.62,sy+sh*.6,sw*.17,Math.PI,0); x.fill();
    x.fillStyle='rgba(255,220,150,.35)'; for(var k=0;k<5;k++) x.fillRect(sx+sw*(.5+k*.02),sy+sh*(.63+k*.05),sw*(.24-k*.04),sh*.012);
    x.strokeStyle='#120a14'; x.fillStyle='#120a14'; x.lineWidth=sw*.03;   /* a palm, leaning in */
    x.beginPath(); x.moveTo(sx+sw*.05,sy+sh); x.quadraticCurveTo(sx+sw*.12,sy+sh*.6,sx+sw*.24,sy+sh*.42); x.stroke();
    for(var f=0;f<6;f++){ var a=-2.6+f*.55; x.beginPath(); x.moveTo(sx+sw*.24,sy+sh*.42);
      x.quadraticCurveTo(sx+sw*.24+Math.cos(a)*sw*.2,sy+sh*.42+Math.sin(a)*sw*.12-sw*.06,sx+sw*.24+Math.cos(a)*sw*.34,sy+sh*.42+Math.sin(a)*sw*.2+sw*.04); x.lineWidth=sw*.05*(1-f*.06); x.stroke(); }
    /* lock screen */
    x.fillStyle='rgba(0,0,0,.18)'; x.fillRect(sx,sy,sw,sh);
    x.textAlign='center'; x.fillStyle='#fff';
    x.font='300 '+(sw*.34).toFixed(1)+'px -apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif'; x.fillText(phoneTime(),sx+sw/2,sy+sh*.22);   /* 17 Oct, his ask: the visitor's own clock (was 3:47) */
    /* (the date line went: unreadable at this size) */
    var nx=sx+sw*.04, ny=sy+sh*.33, nw=sw*.92, nh=sh*.17;
    roundRect(x,nx,ny,nw,nh,sw*.05); x.fillStyle='rgba(240,242,248,.9)'; x.fill();
    x.fillStyle='#34c759'; roundRect(x,nx+nh*.18,ny+nh*.2,nh*.6,nh*.6,nh*.14); x.fill();
    x.textAlign='left'; x.fillStyle='#111';
    x.font='700 '+(sw*.12).toFixed(1)+'px -apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif'; x.fillText('Mum',nx+nh*.9,ny+nh*.44);
    x.font='500 '+(sw*.092).toFixed(1)+'px -apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif'; x.fillText(j.calls+' Missed Calls',nx+nh*.9,ny+nh*.82);
    x.strokeStyle='#fff'; x.lineWidth=sw*.008; x.strokeRect(sx+sw*.83,sy+sh*.012,sw*.11,sw*.05);
    x.fillStyle='#ff3b30'; x.fillRect(sx+sw*.84,sy+sh*.012+sw*.01,sw*.018,sw*.03);
    /* a crack across one corner */
    x.strokeStyle='rgba(255,255,255,.55)'; x.lineWidth=sw*.008;
    x.beginPath(); x.moveTo(sx+sw,sy+sh*.7); x.lineTo(sx+sw*.78,sy+sh*.78); x.lineTo(sx+sw*.7,sy+sh*.9); x.moveTo(sx+sw*.78,sy+sh*.78); x.lineTo(sx+sw*.9,sy+sh); x.stroke();
    x.restore();
    /* glass glare */
    var gl=x.createLinearGradient(0,0,PW,PH*.5); gl.addColorStop(0,'rgba(255,255,255,.12)'); gl.addColorStop(.4,'rgba(255,255,255,0)');
    x.fillStyle=gl; roundRect(x,0,0,PW,PH,R); x.fill();
    /* earpiece, camera, the home button */
    x.fillStyle='#22262d'; roundRect(x,PW*.38,PH*.06,PW*.24,PW*.035,PW*.017); x.fill();
    x.beginPath(); x.arc(PW*.29,PH*.065,PW*.025,0,7); x.fill();
    x.beginPath(); x.arc(PW/2,PH*.935,PW*.085,0,7); x.fillStyle='#07080a'; x.fill(); x.lineWidth=PW*.012; x.strokeStyle='#4a525e'; x.stroke();
    x.beginPath(); roundRect(x,PW/2-PW*.03,PH*.935-PW*.03,PW*.06,PW*.06,PW*.012); x.lineWidth=PW*.006; x.strokeStyle='#3a414b'; x.stroke();
    j.artCalls=j.calls; j.artTime=phoneTime();
  }
  function drawPhone(j){
    if(!j.calls) j.calls=87;
    if(!j.art||j.artCalls!==j.calls||j.artTime!==phoneTime()) phoneArt(j);
    var c=j.art, PW=c.width, PH=c.height, L=j.w, D=L*2.05*.42, N=NS(30);   /* L: its true width; D: its length, foreshortened lying down */
    /* thickness: the body's edge, a dark slab under the near end */
    ctx.fillStyle='#050608'; ctx.beginPath(); ctx.moveTo(-L*.5,D*.5); ctx.lineTo(L*.5,D*.5); ctx.lineTo(L*.5,D*.5+L*.035); ctx.lineTo(-L*.5,D*.5+L*.035); ctx.fill();
    for(var k=0;k<N;k++){
      var v0=k/N, v1=(k+1)/N, sc=.72+.28*(v0+v1)/2;   /* far end narrower */
      var y0=-D/2+v0*D, y1=-D/2+v1*D;
      ctx.drawImage(c,0,v0*PH,PW,(v1-v0)*PH,-L*sc/2,y0,L*sc,y1-y0+.6);
    }
    var lit=phoneLit(j);
    ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=.18*lit;
    var g=ctx.createRadialGradient(0,0,0,0,0,L*.7); g.addColorStop(0,'rgba(255,170,140,1)'); g.addColorStop(1,'rgba(255,120,120,0)');
    ctx.fillStyle=g; ctx.fillRect(-L*.7,-L*.7,L*1.4,L*1.4);
    ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
  }
  /* ⛳ 17 Oct, his idea: an old wooden sign on the seabed — PLEASE DO NOT FEED THE FISH. Kept straight: who put it there,
     and who's it for, is the joke; and it tells people the water can be clicked. Planted for good, left of centre, in a
     little pool of light so it can be read. Art: designs/junk-mj/make_sign.py. */
  var sign=null;
  function signRect(){
    var F=R.floor, im=pics.junk_sign; if(!F||!im) return null;
    var w=Math.max(84,Math.min(118,W*.076)),   /* 18 Oct 10:45: "the sign size was fine, if anything the tiniest bit bigger" */ h=w*im.naturalHeight/im.naturalWidth;   /* 18 Oct: new art's board fills its width (the old one was ~77%), so ~.87x keeps the board the same size */   /* 8:42am "too big, too obvious" */   /* 8:58am: Copilot (his run) PLEASE DON'T FEED THE FISH, barnacled board. "NO FEEDING" was "too mean"; "FISH ARE FULL" not the line */
    return {x:F.x+F.w*.575, y:groundY()+10-h*.5, w:w, h:h};   /* 18 Oct 11:06 (his: "move a bit to the left so it doesn't have busy visuals behind it ... clean open space"): .575, open sand between the vent (.522) and the white worms (.635). 10:52 (his: "a little to the left ... so it's not in front of that red coral"): .675, between the white worms and the coral. 10:45: .75, past the coral, short of the big pale sponges (.8+). Centre (.485) was "too obvious and too centred";
       .3/.285 sat in front of two pale sponges ("weird shit on it"); .235 under the foreground rock */
  }
  function drawSign(){
    var r=signRect(); if(!r) return;
    if(!sign){ sign=tinted(pics.junk_sign,null,.2);
      /* 8:42am: "needs a gradient at the bottom to blend it into the scene": the post fades into the silt */
      var sx=sign.getContext('2d'), g=sx.createLinearGradient(0,sign.height*.66,0,sign.height);   /* 18 Oct: the new board ends at ~60% of the art; .55 was fading THE FISH */
      g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,1)');
      sx.globalCompositeOperation='destination-out'; sx.fillStyle=g; sx.fillRect(0,0,sign.width,sign.height); }
    ctx.save(); ctx.translate(r.x,r.y);   /* 18 Oct: no extra tilt, the new art is drawn at an angle already */ ctx.drawImage(sign,   /* 8:27am "slightly more of an angle" */-r.w/2,-r.h/2,r.w,r.h); ctx.restore();
  }
  var SIGN_ON=true;   /* 17 Oct: lettering redone by Copilot in SoR4 style (his run); 8:11am the typeset one was "a font" */
  /* ⛳ 18 Oct: NEW SIGN — Midjourney board (sunken, stained, clean outline) + his Copilot lettering; designs/sign-mj/make_sign3.py */
  function drawJunk(){
    for(var i=0;i<junk.length;i++){
      var j=junk[i];
      ctx.save(); ctx.translate(j.x,j.y); ctx.rotate(j.rot);
      if(j.name==='junk_besser') floatRope(j);   /* behind the block, rising from the knot */
      if(j.name==='junk_phone'&&j.buzz>0) ctx.translate(Math.sin(performance.now()*.09)*2*j.buzz,0);   /* vibrating */
      if(j.name==='junk_phone') drawPhone(j); else ctx.drawImage(j.pic,-j.w/2,-j.h/2,j.w,j.h);
      ctx.restore();
    }
  }
  function drawRipples(now){
    for(var i=ripples.length-1;i>=0;i--){
      var r=ripples[i], k=(now-r.t)/700;
      if(k>=1){ ripples.splice(i,1); continue; }
      ctx.globalAlpha=.3*(1-k); ctx.strokeStyle='#cfe3ea'; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(r.x,r.y,6+34*Math.sqrt(k),0,7); ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  var snowB=null;
  function drawSnow(){
    var l=ready?at(LURE):null, R=fw*.9;
    ctx.fillStyle='#cfe3ea';
    /* 20 Oct, smoothing: ~270 specks were ~270 separate fills. Now specks of the same brightness (to 1/200) share one fill. */
    if(OLD.snow){ for(var q=0;q<snow.length;q++){ var f=snow[q], a=f.a*jl;
        if(l){ var d=Math.hypot(f.x-l.x,f.y-l.y); if(d<R) a+=(1-d/R)*.6*light; }
        ctx.globalAlpha=Math.min(1,a); ctx.beginPath(); ctx.arc(f.x,f.y,f.r,0,7); ctx.fill(); }
      ctx.globalAlpha=1; return; }
    var B=snowB||(snowB={}), k, ks=[];
    for(var q=0;q<snow.length;q++){
      var f=snow[q], a=f.a*jl;
      if(l){ var d=Math.hypot(f.x-l.x,f.y-l.y); if(d<R) a+=(1-d/R)*.6*light; }
      k=Math.round(Math.min(1,a)*200); if(!k) continue;
      (B[k]||(B[k]=[])).push(f);
    }
    for(k in B){ var L=B[k]; if(!L.length) continue;
      ctx.globalAlpha=k/200; ctx.beginPath();
      for(q=0;q<L.length;q++){ f=L[q]; ctx.moveTo(f.x+f.r,f.y); ctx.arc(f.x,f.y,f.r,0,7); }
      ctx.fill(); L.length=0; }
    ctx.globalAlpha=1;
  }

  function drawSchool(t){
    if(!school) return;
    for(var i=0;i<school.fish.length;i++){
      var f=school.fish[i], sx=-f.turn; if(Math.abs(sx)<.06) sx=sx<0?-.06:.06;
      /* (their halos went 15 Oct for frame rate; the art's own lights carry it) */
      ctx.save(); ctx.globalAlpha=f.a*jl*Math.max(0,Math.min(1,f.y/(H*.12)));
      ctx.translate(f.x,f.y); ctx.scale(sx,1);
      swimStrips(f.pic,f.w,f.h,f.phase,f.h*.06,still?1:14);
      ctx.restore();
    }
  }

  function drawJellies(t,z0,z1){
    for(var i=0;i<jellies.length;i++){
      var j=jellies[i], p=j.ph, BELLj=j.bell;
      if(j.z<z0||j.z>=z1) continue;
      var c=p<.3?Math.sin(p/.3*Math.PI):0;              /* 0 → 1 → 0 through the squeeze */
      var bx=1-j.sq*c, by=1+j.sq*.5*c;
      /* its own light: a soft glow round the whole animal, brighter on each pulse and when touched */
      if(j.halo) drawHalo(j.halo,j.x-j.w*bx/2,j.y,j.w*bx,j.h,(.09+.12*c+j.boost*.22)*(.45+.55*j.z)*jl*Math.max(0,Math.min(1,j.y/(H*.18))));
      var pic=j.pic, iw=pic.width, ih=pic.height, N=NS(44);
      /* The canvas ends partway up the dark; fade out before its top edge can cut one in half. */
      ctx.globalAlpha=j.a*jl*Math.max(0,Math.min(1,j.y/(H*.18)));
      var y=j.y;
      for(var k=0;k<N;k++){
        var v0=k/N, v1=(k+1)/N, v=(v0+v1)/2;
        var tail=Math.max(0,(v-BELLj)/(1-BELLj));
        var sx=v<BELLj?bx:bx+(1-bx)*Math.min(1,tail/.2);
        var hh=(v1-v0)*j.h*(v<BELLj?by:1);
        var off=still?0:Math.pow(tail,1.3)*(j.w*.06*Math.sin(v*Math.PI*2.2-t*1.1+j.sw)-j.vx*.5*tail);
        var ww=j.w*sx;
        /* Strip edges land on whole device pixels and never overlap: the art is see-through, so an
           overlap doubles up into a bright line and a fractional edge leaves a dark one. */
        var ya=Math.round(y*dpr)/dpr, yb=Math.round((y+hh)*dpr)/dpr;
        if(yb>ya) ctx.drawImage(pic,0,v0*ih,iw,(v1-v0)*ih,j.x-ww/2+off,ya,ww,yb-ya);
        y+=hh;
      }
      if(j.rainbow&&!still){
        var hp=(t*.6+j.sw)%6, h0=Math.floor(hp), fr=hp-h0;
        ctx.globalCompositeOperation='lighter';
        ctx.globalAlpha=.35*(1-fr)*jl; ctx.drawImage(j.rainbow[h0],j.x-j.w*bx/2,j.y,j.w*bx,j.h);
        ctx.globalAlpha=.35*fr*jl; ctx.drawImage(j.rainbow[(h0+1)%6],j.x-j.w*bx/2,j.y,j.w*bx,j.h);
        ctx.globalCompositeOperation='source-over';
      }
      if(j.boost>.01){   /* a touched one lights up */
        /* ⛔ This used to light the bell only and stop dead at its rim: "a harsh horizontal line". The glow
           is now its own copy, faded out down the body (made once, on first touch). */
        if(!j.glow){
          var g=document.createElement('canvas'); g.width=iw; g.height=ih; var gx=g.getContext('2d');
          gx.drawImage(pic,0,0); gx.globalCompositeOperation='destination-in';
          var lg=gx.createLinearGradient(0,0,0,ih);
          lg.addColorStop(0,'#000'); lg.addColorStop(Math.min(.9,BELLj*.8),'#000'); lg.addColorStop(Math.min(1,BELLj*1.9),'rgba(0,0,0,0)'); lg.addColorStop(1,'rgba(0,0,0,0)');
          gx.fillStyle=lg; gx.fillRect(0,0,iw,ih); j.glow=g;
        }
        ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=j.boost*.35*jl;
        ctx.drawImage(j.glow,j.x-j.w*bx/2,j.y,j.w*bx,j.h+j.h*BELLj*(by-1));
        ctx.globalCompositeOperation='source-over';
      }
    }
    ctx.globalAlpha=1;
  }

  /* ?fishprof: main-thread ms per part of the frame, summed (window.__prof() reads and resets them). For the smoothing work. */
  var PROF=/fishprof/.test(location.search)?{}:null, pT=0;
  function mark(k){ if(!PROF) return; var t=performance.now(); PROF[k]=(PROF[k]||0)+t-pT; pT=t; }
  if(PROF) window.__prof=function(){ var o=PROF; PROF={n:0}; return o; };
  function draw(now){
    if(PROF){ pT=performance.now(); PROF.n=(PROF.n||0)+1; }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);
    var t=now/1000;
    if(jready&&cast){
      setRects(now); if(!off('dark')) makeLight(t); mark('light');
      if(!off('sub')) drawSub(now); if(!off('giant')) drawGiant(); mark('giant');
      if(!off('far')) drawFar(); mark('far'); if(!off('snow')) drawSnow(); mark('snow');   /* 10:22pm: the giant squid BEHIND the far rocks (it read as a ghost in front) */
      /* back to front: the far half of the cast goes behind the seabed, the near half in front of it */
      if(!off('jelly')) drawJellies(t,0,SEABED); mark('jelly'); if(!off('swim')) drawSwimmers(0,SEABED); mark('swim'); if(school&&school.z<SEABED&&!off('school')) drawSchool(t); mark('school');
      if(off('dark')) drawFloor(t); else if(!off('set')) inTheDark(function(){ drawFloor(t); }); drawSilt(); mark('set');
      drawJunk(); drawBones(); drawFood(t); mark('junk');
      if(!off('jelly')) drawJellies(t,SEABED,2); mark('jelly'); if(!off('swim')) drawSwimmers(SEABED,2); mark('swim'); if(school&&school.z>=SEABED&&!off('school')) drawSchool(t); mark('school');
    }
    if(ready&&!off('angler')) drawAngler(now,t); mark('angler');
    /* ⛳ 18 Oct 7:10pm: the homepage lure's slack hook and line (lure.js, once the note has slipped off) sink through this water and
       leave BEHIND the foreground rocks and weed — lure.js draws them here, in this canvas's px, with the frame's rAF stamp */
    if(window.mmRigDraw){ ctx.setTransform(dpr,0,0,dpr,0,0); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; window.mmRigDraw(ctx,now); }
    if(jready&&cast&&!off('fore')) drawFore(); mark('fore');
    if(jready&&cast&&!off('weed')) drawWeed(t); mark('weed');
    if(ripples.length) drawRipples(now);
  }


  /* ---- the spit ----
     ⛳ 16 Oct, his ask: "the angler fish should spit the cursor out ... would a burst of bubbles come out of his
     mouth? should it make a face?" When it lets go: the jaw snaps open, a burst of bubbles, the glove shoots out of the
     mouth back to wherever the hand really is (tumbling as it goes), and the fish shakes its head and backs off. */
  var gulp={next:0, thump:0, ang:0, recoil:0, spat:-1e4}, mbub=[];
  function mouthBubble(r,push){
    if(!ready) return;
    var m=at(MOUTH), sp=rnd(40,140)*push*3;
    mbub.push({x:m.x-fish.dir*fw*.04, y:m.y, vx:-fish.dir*sp+rnd(-20,20), vy:rnd(-60,-10)*push*2-20, r:r, t:performance.now(), life:rnd(1200,2200), ph:rnd(0,6)});
    if(mbub.length>60) mbub.splice(0,mbub.length-60);
  }
  function spit(now,show){
    jawTo=0; lightTo=1; biteAgain=now+2200; gulp.spat=now; gulp.recoil=1; gulp.thump=0;
    var m=at(MOUTH);
    for(var i=0;i<24;i++) mouthBubble(i<4?rnd(10,17):rnd(3,8),1.3);
    fish.vx+=fish.dir*90;   /* backs off: away from where its mouth points */
    gloveHidden(false);
    if(show) flyGlove(m.x-ptr.x, m.y-ptr.y);
  }
  /* The glove is a page element that sits on the pointer; a spit offsets it to the mouth and lets it fly home.
     'translate'/'rotate' are separate CSS properties, so they ride on top of glove.js's own transform. */
  /* ⛔ 16 Oct, his note: "the cursor doesn't get spat out from the anglerfish's mouth it just randomly reappears".
     It did fly, but in 320ms on a sharp ease it covered 70% of the way in the first tenth of a second. Now it sits in
     the mouth for a beat, small, then is shot OUT the way the mouth faces and curves round to the hand (a bezier
     through a point in front of the mouth), tumbling and growing back to size. */
  function flyGlove(dx,dy){
    gloveEl=gloveEl||document.getElementById('glove'); if(!gloveEl||still) return;
    var el=gloveEl, t0=performance.now(), HOLD=90, D=620, spin=-fish.dir*(280+Math.random()*140);
    var cx=dx-fish.dir*Math.max(140,fw*.8), cy=dy-60;   /* out in front of the mouth, a little up */
    (function go(){
      var ms=performance.now()-t0, k=Math.max(0,Math.min(1,(ms-HOLD)/D)), t=1-Math.pow(1-k,2.2), o=1-t;
      var x=o*o*dx+2*o*t*cx, y=o*o*dy+2*o*t*cy;
      el.style.translate=x.toFixed(1)+'px '+y.toFixed(1)+'px';
      el.style.rotate=(spin*o).toFixed(1)+'deg';
      el.style.scale=(.45+.55*Math.min(1,k*2.2)).toFixed(3);
      if(k<1) requestAnimationFrame(go); else { el.style.translate=''; el.style.rotate=''; el.style.scale=''; }
    })();
  }
  function drawMouthBubbles(now){
    if(!mbub.length) return;
    var s=Math.min(.05,(now-(drawMouthBubbles.t||now))/1000); drawMouthBubbles.t=now;
    for(var i=mbub.length-1;i>=0;i--){
      var b=mbub[i], k=(now-b.t)/b.life;
      if(k>=1){ mbub.splice(i,1); continue; }
      b.vx*=Math.pow(.15,s); b.vy+=(-(30+b.r*5)-b.vy)*Math.min(1,s*2.5);
      b.x+=(b.vx+Math.sin(now/180+b.ph)*b.r*2)*s; b.y+=b.vy*s;
      var a=(1-k)*Math.min(1,k*8); if(!(a>.01)) continue;
      ctx.globalAlpha=a*.7; ctx.strokeStyle='rgba(175,210,240,1)'; ctx.lineWidth=Math.max(.6,b.r*.14);
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,7); ctx.stroke();
      if(b.r>3){ ctx.globalAlpha=a*.85; ctx.fillStyle='rgba(225,240,250,1)'; ctx.beginPath(); ctx.arc(b.x+b.r*.38,b.y-b.r*.4,Math.max(.5,b.r*.18),0,7); ctx.fill(); }
    }
    ctx.globalAlpha=1;
  }


  /* ⛳ 16 Oct 9:08pm, "it also kind of ruins the feeling your hand has been caught": the glove used to just vanish. Now,
     while it's held, the glove is drawn in the fish's mouth — behind the fish, finger in, so the cuff sticks out between
     the jaws — and it gets jolted about by the struggle. (The page's own glove stays hidden; this one is on the canvas.) */
  var gImg=null;
  function gloveInMouth(now){
    if(jawTo!==1||gulp.snack||mode==='dark'||lungeNote) return;   /* (not when it's the note it's got) */
    gImg=gImg||document.querySelector('#glove img'); if(!gImg||!gImg.naturalWidth) return;
    var M=at(MOUTH), dd=fish.dir, gw=fw*.38, gh=gw*gImg.naturalHeight/gImg.naturalWidth;
    var th=gulp.thump*gulp.thump, wig=Math.sin(now/110)*.08+th*Math.sin(gulp.ang)*.5;
    var tx=M.x+dd*fw*.17+Math.cos(gulp.ang)*5*th, ty=M.y+fh*.02+Math.sin(gulp.ang)*4*th;
    var rot=Math.atan2(.3,dd)+2.356+wig;   /* the art points up-left (-135deg): turn it to point into the fish */
    ctx.save(); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.globalAlpha=seen;
    ctx.translate(tx,ty); ctx.rotate(rot); ctx.drawImage(gImg,-gw*.17,-gh*.15,gw,gh);
    ctx.restore();
  }

  /* ⛳ 16 Oct 10:35pm, his pick: what happens when you click the anglerfish. It does not enjoy it, and it escalates.
     1st poke: it flinches, its eye flares, it turns to glare at you. 2nd: it sulks — the light goes out and it sits in the
     dark with only its eye showing, then the light comes back. 3rd: it gags and coughs up something it swallowed — one of
     the river ornaments, far too big to have fitted, which sinks to the seabed — and swims off in a huff. If every
     ornament is already down, it coughs up a sad little fish skeleton instead. Then it starts again. */
  var sputterUntil=0, gm=1, gmNext=0, gmTo=1;
  function glowMul(now){   /* 1 = steady; while sputtering, it cuts out and catches in irregular little bursts */
    if(now>=sputterUntil){ gm+=(1-gm)*.15; return gm; }
    if(now>gmNext){ gmNext=now+rnd(50,160); gmTo=Math.random()<.22?rnd(.7,1):rnd(.05,.3); }
    gm+=(gmTo-gm)*.5; return gm;
  }
  var EYE={x:.383,y:.399}, coughs=0, pokes=0, lastPoke=0, eyeFlare=0, bones=[];
  function pokeAngler(now){
    if(now-lastPoke<350||mode==='lunge'||mode==='dark'||jawTo===1) return;
    lastPoke=now; pokes++;
    var away=fish.x<ptr.x?-1:1;
    if(pokes===1){
      gulp.thump=1; gulp.ang=away>0?0:Math.PI; eyeFlare=1; fish.vx+=away*70;
      turnTo(ptr.x<fish.x?1:-1,150,now,0); biteAgain=Math.max(biteAgain,now+1500); T('angler_poke_1');
    } else if(pokes===2){
      /* ⛔ 17 Oct 7:40am: the light going OUT looked janky (the bulb is painted in, so the stem's stub was left). Now it
         sputters like a dying torch for a couple of seconds, then steadies. */
      sputterUntil=now+2600; eyeFlare=.6; gulp.thump=.6; fish.vx*=.2; fish.vy*=.2;
      biteAgain=Math.max(biteAgain,now+3500); setMode('wander',now); fish.next=now+3500; fish.tx=fish.x; fish.ty=fish.y;
      T('angler_poke_2');
    } else {
      pokes=0; var m=at(MOUTH);
      gulp.recoil=1; gulp.spat=now; gulp.thump=1; jawTo=0;
      for(var i=0;i<18;i++) mouthBubble(i<3?rnd(8,14):rnd(2.5,6),1.2);
      /* ⛳ 17 Oct 11am, his note: "doesn't seem to be hiding or spitting out alternating fish at the end". The ornaments
         came first (a skeleton only once all eight were down), so you never saw one. Now the 3rd poke ALWAYS coughs up a
         fish skeleton, the two drawings taking turns; the ornaments come from feeding. Then it goes and HIDES: bolts for
         the nearest edge, tucks in behind the rocks and kelp with only its face and light poking out, sulks, comes back. */
      bones.push({x:m.x, y:m.y, vx:-fish.dir*rnd(120,170), vy:-30, rot:0, vr:-fish.dir*rnd(1.5,2.5), landed:false, w:Math.max(46,fw*.3), flip:fish.dir<0, kind:coughs++%2?'junk_bone_b':'junk_bone'});
      if(bones.length>6) bones.splice(bones.findIndex(function(b){ return b.landed; })>>>0,1);
      lightTo=1; biteAgain=Math.max(biteAgain,now+5000);
      var side=fish.x<W/2?-1:1;   /* the nearer edge */
      setMode('hide',now); fish.hideSide=side; fish.hideUntil=now+rnd(9000,12000); fish.hidT=0;
      fish.tx=side>0?W+fw*.05:-fw*.05; fish.ty=Math.max(H*.5,Math.min(H*.66,groundY()-fh*.9));
      T('angler_poke_3');
    }
  }
  function stepBones(s){
    var gy=groundY();
    for(var i=0;i<bones.length;i++){ var b=bones[i]; if(b.landed) continue;
      b.vy+=(70-b.vy)*Math.min(1,s*1.5); b.x+=b.vx*s; b.vx*=Math.pow(.2,s); b.y+=b.vy*s; b.rot+=b.vr*s; b.vr*=Math.pow(.5,s);
      if(b.y>=gy-2){ b.y=gy-2; b.landed=true; b.rot=Math.round(b.rot/Math.PI)*Math.PI*.05; kickSilt(b.x,gy,6,40); } }
  }
  function drawBones(){
    /* 10:39pm: "the fish bone should look like a Streets of Rage 4 style one" — painted (junk_bone), like the ornaments */
    for(var i=0;i<bones.length;i++){ var b=bones[i];
      var im=pics[b.kind||'junk_bone']; if(!im){ continue; }
      if(!b.pic){   /* 10:42pm "too blue?": yes — it blended into the cast. Bone-coloured, dimmed into the scene like the ornaments */
        var c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; var x=c.getContext('2d');
        x.drawImage(im,0,0); x.globalCompositeOperation='color'; x.fillStyle='#d6cdb4'; x.fillRect(0,0,c.width,c.height);
        x.globalCompositeOperation='destination-in'; x.drawImage(im,0,0);
        x.globalCompositeOperation='source-atop'; x.fillStyle='rgba(18,16,12,.32)'; x.fillRect(0,0,c.width,c.height);
        b.pic=c; b.h=b.w*im.naturalHeight/im.naturalWidth; }
      ctx.save(); ctx.translate(b.x,b.y-b.h*.35); ctx.rotate(b.rot); if(b.flip) ctx.scale(-1,1);
      ctx.drawImage(b.pic,-b.w/2,-b.h/2,b.w,b.h); ctx.restore(); }
  }
  function drawEyeFlare(bob){
    if(eyeFlare<.01) return;
    var e=at(EYE), r=fw*.09*(1+eyeFlare*.6); e.y+=bob;
    ctx.globalCompositeOperation='lighter';
    var g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,r*2.2);
    g.addColorStop(0,'rgba(170,250,255,'+(.8*eyeFlare)+')'); g.addColorStop(.35,'rgba(80,200,240,'+(.35*eyeFlare)+')'); g.addColorStop(1,'rgba(20,80,120,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(e.x,e.y,r*2.2,0,7); ctx.fill();
    ctx.globalCompositeOperation='source-over';
  }
  function drawAngler(now,t){
    fish.phase+=(now-(draw.t||now))/1000*fish.beat*Math.PI*2; draw.t=now;

    var bob=still?0:Math.sin(t*.8)*fh*.012;
    var X=fish.x, Y=fish.y+bob+lift(), K=mode==='lunge'?1.06:1;
    if(!jawPics.length) makeJaw();
    jaw+=(jawTo-jaw)*(jawTo>jaw?.55:(now-gulp.spat<400?.5:.08));   /* snaps shut, eases open (snaps open on a spit) */
    var pic=jawPics[Math.round(jaw*4)]||img;
    /* Drawn whole on its own layer, then laid down once: dimming strip by strip would double up where
       neighbouring strips overlap by a hair, and show as stripes. */
    var fc=fishLayer(), out=ctx; ctx=fc; ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,fc.canvas.width,fc.canvas.height);
    var bx0=Math.floor((X-fw*.9)*dpr), by0=Math.floor((Y-fh)*dpr);   /* the box's corner, in device px */

    /* The swim: strips, head stiff, tail loose, each strip with its own share of the turn (cOf). */
    var iw=pic.width||img.naturalWidth, ih=pic.height||img.naturalHeight, N=NS(96);
    var amp=fh*(.022+Math.min(.03,fish.beat*.012))*(1+1.8*(fish.swish||0));   /* the follow-through after a snap turn */
    /* The strips are laid end to end, head first, each as wide as its own share of the turn makes it, so
       mid-turn the body folds over itself instead of coming apart; then the chain is centred. */
    var cs=[], xs=[], acc=0, sw=fw/N, i, mid;
    for(i=0;i<N;i++){ var c=still?fish.dir:cOf((i+.5)/N); cs.push(c); xs.push(acc); acc+=c*sw; }
    mid=acc/2;
    /* Tail first, head last: mid-turn the head swings round IN FRONT of the body. Drawn the other way,
       the tail covered it and the fish looked cropped ("appears to get cropped on the turn"). */
    for(i=N-1;i>=0;i--){
      var u0=i/N, u1=(i+1)/N, u=(u0+u1)/2, body=Math.max(0,(u-.32)/.68);
      var off=still?0:amp*Math.pow(body,1.5)*Math.sin(u*Math.PI*1.8-fish.phase);
      /* E: this strip's head-side edge on screen; it reaches c*sw toward the tail from there */
      var E=X+(xs[i]-mid)*K;
      ctx.setTransform(dpr*K*cs[i],0,0,dpr*K,dpr*(E+cs[i]*K*fw/2)-bx0,dpr*Y-by0);
      /* the strips at the fold are edge-on: let them go, or the fold reads as a straight cut */
      ctx.globalAlpha=fish.P<1?Math.min(1,Math.abs(cs[i])/.45):1;
      ctx.drawImage(pic, u0*iw,0,(u1-u0)*iw,ih, -fw/2,-fh/2+off,sw+.35,fh);
    }
    /* The light going out ERASES the glow baked into the fish's own picture — on the fish's layer only. ⛔ 16 Oct: it
       used to erase a disc of the whole canvas, which punched a black hole through the seabed (and the caught glove). */
    var GM=glowMul(now), eraseA=light<.999?1-light:(1-GM)*.7;
    if(eraseA>.001){
      var el=at(LURE), Rc0=fw*.16; ctx.setTransform(1,0,0,1,0,0);
      ctx.globalAlpha=eraseA; ctx.globalCompositeOperation='destination-out';
      var ex=el.x*dpr-bx0, ey=(el.y+bob)*dpr-by0, er=Rc0*dpr, g0=ctx.createRadialGradient(ex,ey,0,ex,ey,er);
      g0.addColorStop(0,'#000'); g0.addColorStop(.8,'#000'); g0.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g0; ctx.beginPath(); ctx.arc(ex,ey,er,0,7); ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }
    ctx.globalAlpha=1; ctx=out; ctx.setTransform(1,0,0,1,0,0);
    gloveInMouth(now);
    ctx.globalAlpha=seen*(fish.P<1?1-.2*Math.sin(Math.PI*fish.P):1);   /* edge-on, a touch darker (was .6: "the fade ... is weird") */
    if(gulp.thump>.01||gulp.recoil>.01){
      /* the struggle (a jolt and a bulge) and, after the spit, a disgusted shake of the head */
      var cw=fc.canvas.width, ch=fc.canvas.height, th=gulp.thump*gulp.thump, bu=1+.07*th;
      var jx=Math.cos(gulp.ang)*5*dpr*th, jy=Math.sin(gulp.ang)*4*dpr*th, rot=gulp.recoil*.11*Math.sin((now-gulp.spat)*.045);
      ctx.translate(bx0+cw/2+jx,by0+ch/2+jy); ctx.rotate(rot); ctx.drawImage(fc.canvas,-cw*bu/2,-ch*(2-bu)/2,cw*bu,ch*(2-bu));
      ctx.setTransform(1,0,0,1,0,0);
    } else ctx.drawImage(fc.canvas,bx0,by0);
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.globalAlpha=1;

    drawMouthBubbles(now);
    eyeFlare=Math.max(0,eyeFlare-.012); drawEyeFlare(bob);

    /* The light. */
    light+=(lightTo-light)*(lightTo>light?.025:1);
    var l=at(LURE); l.y+=bob;   /* at() already allows for the turn */
    /* ⛔ 16 Oct ("lightning flashes"): a snap turn moves the lure across in a few frames, and its glow and the patch
       of seabed it lights jumped with it. The light now follows the lure a touch behind, so it sweeps instead. */
    if(fish.lx==null||Math.hypot(l.x-fish.lx,l.y-fish.ly)>fw*2){ fish.lx=l.x; fish.ly=l.y; }
    else { fish.lx+=(l.x-fish.lx)*.3; fish.ly+=(l.y-fish.ly)*.3; }
    l={x:fish.lx,y:fish.ly};
    var R=fw*LURE_R*1.25, Rc=fw*.16;      /* Rc: past the edge of the baked glow, or a ring shows */
    if(light*gm>.01){
      var pulse=(still?1:.75+.25*Math.sin(t*2.1)+.08*Math.sin(t*7.3))*gm;
      ctx.globalCompositeOperation='lighter';
      var g=ctx.createRadialGradient(l.x,l.y,0,l.x,l.y,R*2.2);
      g.addColorStop(0,'rgba(140,240,255,'+(.35*pulse*light)+')');
      g.addColorStop(.25,'rgba(60,170,210,'+(.14*pulse*light)+')');
      g.addColorStop(1,'rgba(20,60,90,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(l.x,l.y,R*2.2,0,7); ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }
  }

  function frame(now){
    if(!visible){ running=false; return; }
    requestAnimationFrame(frame);   /* first, so one bad frame can never stop the loop with the glove still hidden */
    var dt=Math.min(50,now-(last||now)); last=now;
    var p0=PROF&&performance.now();
    if(ready) step(now,dt);
    if(jready) stepJellies(now,dt);
    if(PROF) PROF.step=(PROF.step||0)+performance.now()-p0;
    draw(now);
    /* ⛳ 18 Oct: lure.js runs the $100's line down to this fish's mouth (viewport px) */
    if(ready){ var mo=at(MOUTH), cr=cv.getBoundingClientRect(); window.mmAngler={ok:true, x:cr.left+mo.x, y:cr.top+mo.y, dir:fish.dir}; }
  }
  /* ⛳ 18 Oct, his question "should the anglerfish eat the note when it gets to the bottom?" — when the hand goes for the $100 it
     strikes: the usual bite if it hasn't had one this visit (it takes your hand with the money), otherwise a snap and a gulp. */
  window.mmAnglerSnap=function(){
    var now=performance.now(); if(!ready) return false;
    if((mode==='wander'||mode==='lure')&&now>biteAgain&&fish.P>=1&&!bites){ onLure=0; stalk=0; sputterUntil=now+700; setMode('dark',now); return 'bite'; }
    if(jawTo!==1){ jawTo=1; gulp.thump=1; gulp.ang=0; for(var i=0;i<6;i++) mouthBubble(rnd(2,5),.5);
      setTimeout(function(){ if(mode!=='lunge'&&mode!=='retreat') jawTo=0; },420); }
    return 'gulp';
  };
  function start(){ if(running||still||!(ready||jready))return; running=true; last=0; requestAnimationFrame(frame); }

  /* Nothing loads or runs until the bottom of the page is near. */
  var io=new IntersectionObserver(function(es){
    visible=es[0].isIntersecting;
    if(!visible&&jawTo===1) letGo();
    if(visible&&!img.src){
      img.onload=function(){ ready=true; size(); start(); }; img.src=cv.getAttribute('data-src');
      loadDeep(cv.getAttribute('data-dir'));
    }
    if(visible) start();
  },{rootMargin:'400px 0px'});
  io.observe(cv);
  /* ⛳ 20 Oct, smoothing. Chrome only gives so many canvases the graphics card; the rest are drawn by the processor, which for
     the layers redrawn every frame (the seaweed, the seabed's dark) was ~100ms a frame — measured, on some loads and not
     others, depending on which canvases happened to be made first. The per-frame layers are made here, before any of the
     one-off copies of the art, so they're always first in line. */
  layer=document.createElement('canvas').getContext('2d');
  lightMap=document.createElement('canvas').getContext('2d');
  setLayer=document.createElement('canvas').getContext('2d');
  wl=document.createElement('canvas').getContext('2d');
  darkC=document.createElement('canvas');
  addEventListener('resize',function(){ if(ready||jready) size(); },{passive:true});
  /* Test rigs read the light's position from here (?fishdebug only). */
  if(/fishdebug/.test(location.search)){
    window.__fish=function(){ var l=at(LURE),r=cv.getBoundingClientRect(); return {x:l.x+r.left,y:l.y+r.top,mode:mode,light:light,P:fish.P,dir:fish.dir,fx:fish.x+r.left,fy:fish.y+r.top}; };
    window.__drifters=function(){ var r=cv.getBoundingClientRect(); return jellies.map(function(j){ return {kind:j.kind,x:j.x+r.left,y:j.y+j.h*.3+r.top,boost:j.boost,vx:j.vx,vy:j.vy}; }); };
    window.__sea=function(){ return {silt:silt.length,smoke:smoke.length,ground:groundY(),floor:R.floor,worms:worms.map(function(w){ return +w.out.toFixed(2); }),swim:swimmers.map(function(m){ return [m.kind,m.x|0,m.y|0,m.flee]; })}; };
    window.__junk=function(){ JUNK.forEach(function(n,i){ lastJunk=-1e9; dropJunk(W*(.08+.115*i),H*.2,performance.now()); }); return junk.length; };
    window.__sub=function(go){ if(go){ giant.on=false; giant.next=performance.now()+1e9; sub.next=1; } return {on:sub.on,p:sub.p,next:sub.next,w:sub.w,y:sub.y,pic:!!pics.sub}; };
    window.__school=function(){ return school?{x:school.cx,y:school.cy}:null; };
    window.__feed=function(x,y){ for(var i=0;i<6;i++) flake(x,y,10); };
    window.__food=function(){ return {food:food.filter(function(f){return !f.dead;}).length, junk:junk.map(function(j){return [j.name,j.landed,Math.round(j.x),Math.round(j.y)];}), mode:mode}; };
    window.__boostAll=function(){ jellies.forEach(function(j){ j.boost=1; }); };
    window.__jaw=function(){ if(!jawPics.length) makeJaw(); return jawPics.map(function(c){ return c.toDataURL(); }); };
    window.__pose=function(P,d){ fish.dirFrom=d; fish.dir=-d; fish.P=P; posed=true; draw(performance.now()); };
    window.__turn=function(){ fish.lastTurn=-1e9; fish.tx=fish.dir>0?W-fw:fw; fish.ty=fish.y; fish.next=performance.now()+60000; };
  }
})();
