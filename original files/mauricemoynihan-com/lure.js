/* lure.js — a $100 note on a hook, just above the fold of the homepage.
   ⛳ 18 Oct 2026, his idea (his sister "didn't really realise you could scroll down"): something down there is fishing for
   visitors. The line comes UP from below the fold; the note sways on the hook like it's underwater (the glove pushes it about);
   as you scroll it's tugged down ahead of you; in the deep sea
   the line runs to the anglerfish's mouth and the note sways above it like bait. The anglerfish's mouth comes from fish.js
   (window.mmAngler, viewport px). Art: designs/lure-mj/make_hundred.py → site/assets/deep/lure_note.webp (a $100; the $50 "doesn't really look like a $50").
   Desktop only (phones have the koi pond). Reduced motion: it hangs still. ?lure=0 off, ?lure=1 forces it (headless). */
(function(){
  "use strict";
  var q=location.search;
  if(/[?&]lure=0/.test(q))return;
  var force=/[?&]lure=1/.test(q);
  if(!force&&!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  var still=matchMedia('(prefers-reduced-motion:reduce)').matches;

  var cv=document.createElement('canvas'); cv.className='lure'; cv.setAttribute('aria-hidden','true');
  var host=document.getElementById('menu')||document.body;   /* same layer as the bubbles: behind the menu's type */
  cv.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:'+(host===document.body?32:1);
  host.appendChild(cv);
  var g=cv.getContext('2d'), W=0, H=0, dpr=1;
  var wipe=window.mmPerf&&mmPerf.dirty?mmPerf.dirty(g):function(){ g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,cv.width,cv.height); };   /* 20 Oct: clears only what was drawn (perf.js) */
  function PL(){ return (window.mmPerf&&window.mmPerf.level)||0; }   /* perf.js: 1+ no sunlight ripples + lower res, 2+ fewer strips */
  addEventListener('mmperf',function(){ size(); });
  function size(){ dpr=Math.min(devicePixelRatio||1,PL()>=1?1:2); W=innerWidth; H=innerHeight; cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  size(); addEventListener('resize',size);

  var DEEPV='010b081f';   /* sync_deploy.py writes a hash of site/assets/deep here, so a new note never sits in a cache */
  var dir=(document.getElementById('deep')||{dataset:{}}).dataset.dir||'assets/deep/';
  var pic=new Image(), ok=false; pic.onload=function(){ ok=true; }; pic.src=dir+'lure_note.webp?v='+DEEPV;
  /* ⛳ 18 Oct 5:13pm, his ask: "a subtle sunlight ripple effect" (a photo of light netting over sand underwater). A tileable caustic
     (designs/lure-mj/make_caustic.py) drifts across the note in two layers, laid on with 'lighter' and cut to the note's shape.
     ⛳ 5:44pm "we seem to have lost the sunlight effect" (it had been toned down to nothing) and "should the effect go away the deeper
     we get?" — yes: full sun at the top of the page, gone by the time the dissolve has turned to ink, none in the deep sea. */
  var caus=new Image(), causOk=false; caus.onload=function(){ causOk=true; }; caus.src=dir+'caustic.webp?v='+DEEPV;
  var NL=document.createElement('canvas'), nl=NL.getContext('2d'), CL=document.createElement('canvas'), cl=CL.getContext('2d'), causPat=null;
  /* ⛳ 5:13pm, his ask: "the note should give off tiny bubbles when you try and grab it" */
  var bubs=[];
  function bub(x,y,vx,vy,r,now,life){ bubs.push({x:x,y:y,vx:vx,vy:vy,r:r,t:now,life:life,ph:Math.random()*6}); }
  var HOOK={x:.424,y:.963};   /* where the hook goes through the paper's bottom edge (make_hundred.py prints it) */

  var fadeEl=document.querySelector('.egg__fade'), deepEl=document.getElementById('deep');
  function clamp(v,a,b){ return v<a?a:v>b?b:v; }
  function smooth(v){ v=clamp(v,0,1); return v*v*(3-2*v); }
  /* 0 on the bone page, 1 once the dissolve has turned to ink around the note */
  function sunk(){ if(!fadeEl)return 0; var r=fadeEl.getBoundingClientRect(); return clamp((H*.8-r.top)/Math.max(1,r.height*.7),0,1); }

  /* ⛳ 18 Oct 5:10pm, his notes: "smaller and more centred", "the hook still looks the wrong way around", "polish the physics ...
     react more to the screen being pulled down and feel like it's actually underwater", "if the hand tries to grab it it should
     swish out of the way". ⛳ 5:42pm: "in the CENTRE of the page in line with the bubbles", "sway left to right a bit MORE GENTLY",
     "the cursor should be almost ON it before it reacts".
     So, the model (5:50pm pass): a buoyant note on a LINE. The line from the deep has a rest length; while it's slack the note is
     just a body in water — a slow current drifts it about and a soft spring eases it home; the moment it's pulled past the line's
     length (scroll carries it up, a swipe sends it darting, the hand drags it off) the line goes taut and hauls it back hard,
     then it's slack again and the note settles in the water. Scrolling moves the WATER (the page) and the note is carried in it,
     lagging, until the line stops it. The hand only counts when it's on the paper. The hook is drawn here, the right way up:
     eye at the bottom on the line, the point poking out through the front of the paper. */
  var n={x:0,y:0,vx:0,vy:0,rot:0,vr:0}, stir=0, sv=0, lastY=scrollY, last=0, startle=0, eaten=0, freed=0, rig=null, taut=0, swing=0, swPh=Math.random()*6, yaw=0, surge={x:0,v:0,next:performance.now()+2500};
  var m={x:-1e4,y:-1e4,px:-1e4,py:-1e4,vx:0,vy:0,t:0};
  addEventListener('mousemove',function(e){ var now=performance.now(), dt=Math.max(8,now-m.t);
    if(m.t){ m.vx=m.vx*.5+(e.clientX-m.x)/dt*1000*.5; m.vy=m.vy*.5+(e.clientY-m.y)/dt*1000*.5; }
    m.x=e.clientX; m.y=e.clientY; m.t=now; },{passive:true});
  var T=function(k){ if(window.mmTrack)window.mmTrack(k); }, touched=false;
  /* ⛳ 5:24pm, his ask: "click and drag to pull and tug at the note". Grab it and it comes with the hand, paying out the line; let go
     and the line snaps it back and it bobs. Grabbing beats dodging: if you get a hold of it, it can't swish away. */
  var drag={on:false,ox:0,oy:0,last:0}, NOTE={w:0,h:0};
  /* the hand in the paper's own frame: 0 at the middle, 1 at the edge of the paper (+ a finger's width) */
  function onPaper(px,py){ var dx=px-n.x, dy=py-n.y, c=Math.cos(-n.rot), s=Math.sin(-n.rot), lx=dx*c-dy*s, ly=dx*s+dy*c;
    return Math.max(Math.abs(lx)/(NOTE.w*.5+10), Math.abs(ly)/(NOTE.h*.5+10)); }
  addEventListener('mousedown',function(e){
    if(e.button!==0||!NOTE.w||eaten) return;
    if(onPaper(e.clientX,e.clientY)<1.15){ drag.on=true; drag.ox=(e.clientX-n.x)*.6; drag.oy=(e.clientY-n.y)*.6; e.preventDefault(); document.documentElement.style.userSelect='none'; if(window.mmGloveGrip) mmGloveGrip(true); touched=true; T('lure_grabbed'); }
  });
  function letGo(){ if(drag.on){ drag.on=false; drag.last=performance.now(); stir=1; n.vx*=.3; n.vy*=.3;   /* the hand's speed doesn't fling it: water takes most of it */ document.documentElement.style.userSelect=''; if(window.mmGloveGrip) mmGloveGrip(false); } }
  addEventListener('mouseup',letGo); addEventListener('blur',letGo); document.addEventListener('mouseleave',letGo);   /* (the window losing the mouse can't leave it stuck in the hand) */
  /* ⛔ 5:33pm "if you grab the note over the ASCII area the cursor just selects all the text" */
  document.addEventListener('selectstart',function(e){ if(drag.on) e.preventDefault(); });

  function noteSize(){ var w=clamp(W*.072,96,128); return {w:w,h:w*(pic.naturalHeight/pic.naturalWidth||.47)}; }
  /* dead centre: the hook (not the paper's middle) sits over the vent the bubbles come up from (bubbles.js, x=W/2) */
  /* ⛳ 18 Oct 7:58pm, his question "has the $100 note cheapened my website?" — at rest it sat dead centre under his name, reading as the
     third line of his introduction. Now the landing page loads as clean as it used to: the note waits below the fold and only comes up,
     on its line, if you hesitate — 2s on the first screen without scrolling ("not too delayed") — or as soon as you do scroll (the
     water carries it into view). The rise is just the line's spring: it floats up, overshoots a touch and settles. */
  var RISE_AT=performance.now()+2000, risen=still;
  function home(sz){ var y=H-sz.h*.5-92; if(!risen) y=H+sz.h*1.2+70; return {x:W*.5+(.5-HOOK.x)*sz.w, y:y}; }

  /* the paper's wave at a point along it (also moves the hook with the paper) */
  var wv={amp:0,ph:0,bend:0};
  function paperY(u,h){ return Math.sin(u*Math.PI*1.7-wv.ph)*wv.amp*(.3+.7*Math.abs(u-HOOK.x)*2)+wv.bend*h*Math.pow(2*(u-HOOK.x),2); }

  /* the painted hook (designs/lure-mj/make_hook.py), upside down: eye at the bottom on the line, the bend hidden behind the paper,
     the barbed point drawn again on top so it comes out through the front */
  var hk=new Image(), hkOk=false; hk.onload=function(){ hkOk=true; }; hk.src=dir+'lure_hook.webp?v='+DEEPV;
  var HK={eye:{x:.144,y:.925}, entry:{x:.15,y:.47}, point:[.66,.14,1,.4]};
  function hookBox(ex,ey,w){ var hw=w*.19, hh=hw*(hk.naturalHeight/hk.naturalWidth||2.26); return {x:ex-HK.entry.x*hw, y:ey-HK.entry.y*hh, w:hw, h:hh}; }
  function hook(x,ex,ey,w,back){
    if(!hkOk) return; var b=hookBox(ex,ey,w), iw=hk.naturalWidth, ih=hk.naturalHeight;
    if(back) x.drawImage(hk,b.x,b.y,b.w,b.h);
    else { var P=HK.point; x.drawImage(hk,P[0]*iw,P[1]*ih,(P[2]-P[0])*iw,(P[3]-P[1])*ih,b.x+P[0]*b.w,b.y+P[1]*b.h,(P[2]-P[0])*b.w,(P[3]-P[1])*b.h); }
  }
  /* the line: clear monofilament — a soft dark edge and a pale core; it tightens (and catches more light) when it's taut */
  function mono(x,dark,tt){
    x.lineWidth=1.7; x.strokeStyle=dark>.5?'rgba(0,0,0,'+(.22+.1*tt)+')':'rgba(36,44,48,'+(.2+.12*tt)+')'; x.stroke();
    x.lineWidth=.8; x.strokeStyle=dark>.5?'rgba(190,225,240,'+(.36+.25*tt)+')':'rgba(255,255,255,'+(.7+.3*tt)+')'; x.stroke();
  }
  function glint(x,bx,by,dark){ var gg=x.createRadialGradient(bx,by,0,bx,by,7); gg.addColorStop(0,'rgba(255,255,255,'+(.8-.4*dark)+')'); gg.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=gg; x.fillRect(bx-7,by-7,14,14); }
  /* the slack rope, drawn in deep-canvas px shifted by (ox,oy): by fish.js on its own canvas (0,0), or here on this one (the deep's
     viewport offset) for the frame it's born and if fish.js ever stops */
  function drawRope(x,ox,oy){
    var R=rig, X=R.x, Y=R.y, nn=R.n, Hd=R.Hd, i;
    x.save(); x.translate(ox,oy);
    var mEnd=nn; for(i=1;i<nn;i++){ if(Y[i]>Hd+30&&Y[i-1]>Hd+30){ mEnd=i; break; } }   /* stop drawing once it's well under the bottom */
    x.beginPath(); x.moveTo(X[0],Y[0]);
    for(i=1;i<mEnd-1;i++) x.quadraticCurveTo(X[i],Y[i],(X[i]+X[i+1])*.5,(Y[i]+Y[i+1])*.5);
    x.lineTo(X[mEnd-1],Y[mEnd-1]); mono(x,1,R.tt);
    if(R.gp<1&&!still){ var gi=R.gp*R.nV, g0=Math.floor(gi), gf=gi-g0; if(g0<nn-1) glint(x,X[g0]+(X[g0+1]-X[g0])*gf,Y[g0]+(Y[g0+1]-Y[g0])*gf,1); }   /* the glint carries on down the loose line */
    if(hkOk){ var HB=R.hb, P=HK.point, iw=hk.naturalWidth, ih=hk.naturalHeight;
      x.globalAlpha=.58; x.translate(X[0],Y[0]); x.rotate(R.ang); x.translate(-R.lx*R.yk,-R.ly); x.scale(R.yk,1);   /* (.58: the note's own alpha in the deep, 1-.42) */
      x.drawImage(hk,HB.x,HB.y,HB.w,HB.h);
      x.drawImage(hk,P[0]*iw,P[1]*ih,(P[2]-P[0])*iw,(P[3]-P[1])*ih,HB.x+P[0]*HB.w,HB.y+P[1]*HB.h,(P[2]-P[0])*HB.w,(P[3]-P[1])*HB.h); }   /* (the barb drawn twice, as it was through the paper) */
    x.restore();
  }
  /* fish.js calls this each frame just before its foreground rocks and weed, with its rAF time: both loops get the same stamp inside
     one animation frame, so the frame this canvas drew the rope on, fish.js skips — and claims the next, so there's never two or none */
  window.mmRigDraw=function(x,now){ var R=rig; if(!freed||!R||!R.n||R.gone) return; R.fishDrewAt=now; if(R.lureDrewAt===now) return; drawRope(x,0,0); };
  if(force) window.mmLureDebug={n:n,m:m,drag:drag,get rig(){return rig;},get freed(){return freed;},get eaten(){return eaten;}};   /* (the test rig reads positions out; only with ?lure=1) */

  var done=false;
  function frame(now){
    requestAnimationFrame(frame);
    var dt=Math.min((now-(last||now))/1000,.05); last=now;
    if(document.hidden||!ok)return;
    if(eaten&&now-eaten>320&&(!rig||rig.gone)){ if(!done){ done=true; wipe(); cv.style.visibility='hidden'; } return; }   /* gone for this visit (once the empty hook has left); 20 Oct: and its layer taken off the screen */
    var dy=scrollY-lastY; lastY=scrollY; sv+=((dt?clamp(dy/dt,-3000,3000):0)-sv)*Math.min(1,dt*12);
    if(now-m.t>60){ var mk=Math.pow(.01,dt); m.vx*=mk; m.vy*=mk; }   /* a hand that has stopped isn't still "coming at it" */
    if(!risen&&(now>RISE_AT||scrollY>40)){ risen=true; T('lure_rose'); }
    var sz=noteSize(), h0=home(sz), s=sunk(), t=still?0:now/1000; NOTE.w=sz.w; NOTE.h=sz.h;
    var A=window.mmAngler, dr=deepEl?deepEl.getBoundingClientRect():null;
    var inDeep=A&&A.ok&&dr&&dr.top<H*.45&&dr.bottom>H*.4;
    /* ⛳ 18 Oct 5:26pm, his note: "the anglerfish takes ages to eat it ... the note and hook and line kinda just get stuck to the
       anglerfish ... a bit mean if the anglerfish eats the hook. maybe the hook disconnects and the anglerfish just eats the free
       note floating in the water". So once the deep sea fills the lower half of the screen (the note is well inside its water) the
       note slips off the hook, the empty hook sinks and is reeled away down out of sight, and the note drifts free; fish.js sends the
       anglerfish straight for it (window.mmFreeNote). (It used to wait for the deep to reach the top quarter — stop scrolling a little
       short of that and the note hung dark over the deep for good, the fish nosing at bait it could never eat.) */
    if(!freed&&!eaten&&A&&A.ok&&dr&&dr.top<H*.5&&!drag.on){
      var sd=Math.random()<.5?-1:1;
      freed=now+1; rig={x:0,y:0,sd:sd}; n.vy-=95; n.vx+=sd*22; n.vr+=sd*1.4; stir=1; T('lure_freed');
      for(var bq=0;bq<8;bq++) bub(n.x+(Math.random()-.5)*sz.w*.4, n.y+sz.h*.4, (Math.random()-.5)*40, -40-Math.random()*50, .8+Math.random()*2, now, 700+Math.random()*800);
    }
    if(freed&&!eaten){
      if(now>freed) n.y-=dy;   /* free, it's in the water: it scrolls with the page */
      if(dr){ var top=dr.top+dr.height*.18, bot=dr.top+dr.height*.62; if(n.y<top){ n.y=top; n.vy=Math.abs(n.vy)*.3; } if(n.y>bot){ n.y=bot; n.vy=-Math.abs(n.vy)*.3; } }   /* stays in open water */
    }
    var tx,ty,ax,ay;
    /* a slow current, so it's never quite at rest (5:42pm "more gently": smaller and slower than it was) */
    /* 6:14pm his note: "it would be nice if the note swayed around more to the left and right ... also when it gets pulled down. It's
       quite stiffly in the middle". A wider, slow drift side to side (a current, ~9s, two waves so it never repeats exactly), and a
       pendulum swing on the line that's woken up whenever it's pulled or carried up and down, then dies away slowly. */
    swing=Math.min(46,swing+Math.abs(n.vy)*dt*.09)*Math.pow(.55,dt);
    /* 6:14pm "think about how bait drifts around underwater": bait on a line doesn't slide, it swings in slow ARCS round the line's
       anchor (out to the side it also drops), it's nudged by little surges of current every few seconds, and it slowly turns
       edge-on and back as the water spins it (yaw, drawn as a horizontal squash). */
    if(now>surge.next){ surge.v=(Math.random()<.5?-1:1)*(10+Math.random()*16); surge.next=now+3500+Math.random()*4500; }
    surge.x+=surge.v*dt; surge.v*=Math.pow(.35,dt); surge.x*=Math.pow(.7,dt);
    var cx=Math.sin(t*.7)*16+Math.sin(t*.29+2)*9+Math.sin(t*1.25+swPh)*swing+surge.x;
    var cy=Math.sin(t*1.1+1)*2+Math.sin(t*.5)*1.5+cx*cx*.012;   /* the arc: further out to the side = a little lower on the line */
    yaw+=((Math.sin(t*.31+swPh)*.5+Math.sin(t*.13)*.25+clamp(n.vx*.0015,-.4,.4))-yaw)*Math.min(1,dt*1.5);
    ax=W*.5+Math.sin(t*.25)*4; ay=risen?H+40:h0.y+sz.h+120;   /* (unrisen, the line's end is further down, so it doesn't haul the note up early) */   /* where the line comes up from (the rope is born along the line to here on the release frame) */
    if(freed){ tx=n.x; ty=n.y+12; }   /* no target: it just drifts and sinks, very slowly */
    else { tx=h0.x+cx; ty=h0.y+cy; }
    if(!n.x){ n.x=tx; n.y=ty; }
    if(freed&&!eaten){ var FN=window.mmFreeNote||(window.mmFreeNote={}); FN.live=true; FN.sx=n.x; FN.sy=n.y; FN.w=sz.w;
      if(FN.dead){ eaten=now; n.vr+=(A&&A.dir||1)*4; T('lure_eaten'); letGo(); } }
    if(still){ n.x=tx; n.y=ty; n.vx=n.vy=0; }

    /* the hand: only when it's on the paper (5:42pm "it reacts to the cursor from too far away"). A swipe across it makes it dart
       away and flutter; a hand resting on it just nudges it aside, and it stirs. Not while held, not for a moment after letting go,
       and not in the deep (down there it's bait). The swipe is checked along the hand's path this frame, so a fast hand can't skip it. */
    var dx=n.x-m.x, dyh=n.y-m.y, d=Math.hypot(dx,dyh)||1, canR=!(freed||eaten||drag.on||now-drag.last<900||still);
    var near=canR?onPaper(m.x,m.y):9, sweep=near;
    if(canR&&near>1&&m.px>-1e3){ for(var sk=1;sk<4;sk++){ var f=sk/4; sweep=Math.min(sweep,onPaper(m.px+(m.x-m.px)*f,m.py+(m.y-m.py)*f)); } }
    var toward=(m.vx*dx+m.vy*dyh)/d;                         /* how fast the hand is closing in */
    /* ⛳ 6:50pm his call: no more evading the hand. A cursor passing over it swirls the water, and the note goes with the water: it's
       pushed ALONG the hand's path (not away from it), with a little curl round the hand's side and a twist, the paper ripples, and it
       drifts back. Strength falls off from the paper's edge; only a moving hand stirs anything. */
    var hs=Math.hypot(m.vx,m.vy);
    if(canR&&hs>40){
      var reach=clamp(1-(sweep-.6)/1.6,0,1);                  /* 1 on the paper, fading out ~1.5 note-sizes from it */
      if(reach>0){
        var flow=reach*reach*Math.min(1,hs/900), side=(m.vx*dyh-m.vy*dx)>0?1:-1;
        n.vx+=(m.vx*.55+(-m.vy/hs)*side*hs*.18)*flow*dt*6; n.vy+=(m.vy*.55+(m.vx/hs)*side*hs*.18)*flow*dt*6*.8;
        n.vr+=side*flow*hs*.004*dt*6; stir=Math.min(1,stir+flow*dt*5);
        if(Math.random()<flow*dt*6) bub(n.x+(Math.random()-.5)*sz.w*.7, n.y+(Math.random()-.5)*sz.h*.5, m.vx*.08, -25-Math.random()*35, .7+Math.random()*1.6, now, 600+Math.random()*600);
        if(!touched){ touched=true; T('lure_touched'); }
      }
    }
    stir=Math.max(0,stir-dt*.45);
    if(stir>.25&&!still&&Math.random()<stir*dt*14) bub(n.x+(Math.random()-.5)*sz.w*.8, n.y+(Math.random()-.5)*sz.h*.5, (Math.random()-.5)*20, -25-Math.random()*40, .8+Math.random()*1.8, now, 600+Math.random()*700);

    /* the note's box (bubbles.js keeps its seep beside it) */
    window.mmLureRect=freed||eaten?null:{x:n.x,y:n.y,w:sz.w,h:sz.h};
    var sp=Math.hypot(n.vx,n.vy), hxw, hyw;
    if(drag.on){
      /* held: it IS in the hand (⛔ 5:33pm "a big gap between the hand and the note when you grab it") — it follows with only the
         slightest lag, the grab point eases into the middle of the paper, and the line just pays out behind it */
      drag.ox*=Math.pow(.05,dt); drag.oy*=Math.pow(.05,dt);
      var gx=m.x-drag.ox, gy=m.y-drag.oy, fl=1-Math.exp(-dt/.014), nx=n.x+(gx-n.x)*fl, ny=n.y+(gy-n.y)*fl;
      var gd=Math.hypot(gx-nx,gy-ny); if(gd>7){ nx=gx+(nx-gx)*7/gd; ny=gy+(ny-gy)*7/gd; }
      if(dt){ n.vx=n.vx*.4+(nx-n.x)/dt*.6; n.vy=n.vy*.4+(ny-n.y)/dt*.6; }
      n.x=nx; n.y=ny; sp=Math.hypot(n.vx,n.vy);
      stir=Math.min(1,stir+sp*dt*.004);
      if(Math.random()<Math.min(.6,sp*dt*.04)) bub(n.x+(Math.random()-.5)*sz.w*.7, n.y+(Math.random()-.5)*sz.h*.5, -n.vx*.15, -30-Math.random()*40, .8+Math.random()*2, now, 600+Math.random()*700);
    } else {
      /* water: a soft spring home that overshoots and settles slowly, heavy drag on fast moves. The WATER moves with the page
         (5:24pm his call: scrolling down bounces it UP into the screen; 5:33pm "further up the screen like a lag?") — the note is
         carried along in it, a beat behind, until the line stops it. 5:37pm: after a long pull it should "snap back a bit more
         quickly, like the line has more tension" — for a second after letting go the line is stiffer still. */
      var K=freed?.6:7, C=freed?1.6:3, snap=drag.last&&!freed?Math.max(0,1-(now-drag.last)/1000):0;
      var wdrag=C+sp*.004+snap*1.5, vw=freed||still?0:-sv*.85;
      var eH=drag.last?Math.min(1,.35+.65*Math.pow(Math.max(0,now-drag.last)/260,1.4)):1;
      n.vx+=(clamp(tx-n.x,-140,140)*K*eH-n.vx*wdrag)*dt; n.vy+=(clamp(ty-n.y,-140,140)*K*eH+vw*5.5-n.vy*wdrag)*dt;   /* (light paper: the water carries it easily) */
    }
    /* the line: slack, it does nothing; past its length it hauls the hook back toward where it comes from, and kills any speed
       away from it (so it stops the note dead rather than twanging) — not while it's being paid out by the hand */
    hxw=n.x+(HOOK.x-.5)*sz.w; hyw=n.y+sz.h*(HOOK.y-.5);
    if(!freed&&!still){
      var ux=ax-hxw, uy=ay-hyw, Ld=Math.hypot(ux,uy)||1, L0=ay-(h0.y+sz.h*(HOOK.y-.5))+6, ext=Ld-L0;
      ux/=Ld; uy/=Ld;
      taut+=(clamp(ext/40,0,1)-taut)*Math.min(1,dt*18);
      if(ext>0&&!drag.on){ var vrad=n.vx*ux+n.vy*uy, KT=16, ease=drag.last?Math.min(1,.35+.65*Math.pow(Math.max(0,now-drag.last)/260,1.4)):1, ex2=Math.min(ext,420), F=ex2*KT*(1+ex2/170)*ease-Math.min(0,vrad)*5*ease;   /* 6:47pm "a bit more tension the further you've pulled it": the pull grows faster than the stretch (ext²), and comes on in ~0.25s */   /* 6:27pm "still pretty intense, particularly when you first let go": the pull comes on gradually over ~0.6s and is capped, so it's drawn home through the water */   /* 6:13pm "the snap back is too dramatic, it should still feel like it's in water" */
        n.vx+=ux*F*dt; n.vy+=uy*F*dt; }
    } else if(!freed) taut=0;   /* (freed: the rope lets the tension out itself, so the line's look doesn't pop on the release frame) */
    n.x+=n.vx*dt; n.y+=n.vy*dt;
    if(n.x!==n.x||n.y!==n.y||n.vx!==n.vx||n.vy!==n.vy){ n.x=tx; n.y=ty; n.vx=n.vy=0; n.rot=n.vr=0; }   /* belt and braces: never lose the note */
    /* ⛔ 6:43pm "it randomly disappears entirely": the release time comes from mouseup (performance.now) and can be a few ms LATER than
       this frame's rAF time, so (now-drag.last) was negative and a negative number to the power 1.6 is NaN — the note's position went
       NaN and it vanished. Clamped at 0 above.
       ⛔ 6:33pm "the note release is broken, it jumps dramatic frames instantly": this stop teleported it after a long pull; never right after a release now */
    if(!freed&&!drag.on&&!still&&(!drag.last||now-drag.last>3000)){ var ox=n.x-h0.x, oy=n.y-h0.y, od=Math.hypot(ox,oy), lim=sz.w*3.2; if(od>lim){ n.x=h0.x+ox/od*lim; n.y=h0.y+oy/od*lim; } }   /* (a safety stop, well past where the line has it) */

    /* it turns to hang along the line, leans into its own motion, and is twisted by the hand; free, it tumbles slowly */
    hxw=n.x+(HOOK.x-.5)*sz.w; hyw=n.y+sz.h*(HOOK.y-.5);
    var lineAng=Math.atan2(ax-hxw,ay-hyw);                     /* 0 when the line runs straight down */
    var targetRot=(freed?Math.sin(t/1.9)*.16:-lineAng*(.45+.3*taut))+clamp(-n.vx*.0009,-.4,.4)+Math.sin(t*.8)*.03;
    n.vr+=((targetRot-n.rot)*14-n.vr*3.4)*dt; n.rot+=n.vr*dt; n.rot=clamp(n.rot,-.85,.85);

    /* the paper: a slow wave always; faster and bigger when it's moving or stirred; its ends trail behind a fast move */
    wv.amp=sz.h*(.04+.06*stir+Math.min(.07,sp*.00012)); wv.ph+=dt*(1.4+stir*3+Math.min(4,sp*.006));
    /* 5:34pm his call: scrolling down curls the edges UP (it was the other way round) — the scroll gets its own term, opposite to the note's own motion */
    wv.bend+=((clamp(-n.vy*.00045-(drag.on?0:sv*.0011),-.26,.26))-wv.bend)*Math.min(1,dt*8);

    wipe(); g.setTransform(dpr,0,0,dpr,0,0);
    var dark=inDeep||freed?1:s, a=1-.42*dark;
    var c=Math.cos(n.rot), si=Math.sin(n.rot), yk=still?1:Math.max(.5,Math.cos(yaw));   /* yk: turning edge-on in the water (the hook is squashed with the paper) */
    var ex=(HOOK.x-.5)*sz.w, ey=(HOOK.y-.5)*sz.h+paperY(HOOK.x,sz.h), hb=hookBox(ex,ey,sz.w);
    var lx=hb.x+HK.eye.x*hb.w, ly=hb.y+HK.eye.y*hb.h+hb.w*.08;
    var eyeX=n.x+(lx*yk*c-ly*si), eyeY=n.y+(lx*yk*si+ly*c);   /* (lx*yk: the line ties on where the eye is DRAWN) */
    /* the line's bow: it sways and trails behind the note when slack, and pulls straight as it goes taut */
    var bow=1-taut, midx=(eyeX+ax)/2+(Math.sin(t*.6)*5-n.vx*.035)*bow, midy=(eyeY+ay)/2, gp=((t*.3)%3.4);
    if(freed){
      /* ⛳ 5:40pm, his note: the hook and line "should drift off a bit more elegantly ... feels a bit cheap and janky" (it faded away where
         it hung). 6:37pm: reeling it down was "still a bit janky"; sinking with a drawn wavy line and a 4.5s fade (6:45pm) was "still a bit
         janky ... does the line just go slack and it sinks out of the screen?" — yes. 7:04pm: "the fade out ... feels cheap and like
         cheating. what if it just animated out of screen behind the seaweed at the bottom to mask its departure".
         ⛳ 7:10pm: the line is now a real slack rope (a verlet chain, 8px links, four passes, a little bending stiffness so it bends in
         curves, not kinks). It's born lying exactly along the line as it was drawn the frame before, with the note's momentum at the hook
         end, and nothing holds it any more: the hook is the heavy bit, so it sinks first and drags the line down after it; the line is
         near-neutral, so it drapes and folds behind the hook; a faint current sways it; the hook turns to hang off its link. It lives in
         the deep-sea canvas's own coordinates (so it scrolls with the page for free) and from its second frame it is DRAWN BY fish.js
         (window.mmRigDraw, called just before the foreground rocks and weed), so it sinks behind the weed at the bottom of the deep and
         out under the page. No fade, ever. The tail of the line goes on below the bottom and more pays out if a scroll ever lifts it. */
      var R=rig, age=(now-freed)/1000, born=!R.n, Hd=dr?dr.height:H, oxv=dr?dr.left:0, oyv=dr?dr.top:0;   /* oxv/oyv: deep px → viewport px */
      if(born){
        /* lay the rope along the attached line: the same quadratic, sampled at equal arc length, then a tail straight on below */
        var S=40, L=0, px=eyeX, py=eyeY, sx=[eyeX], sy=[eyeY], sl=[0];
        for(var i=1;i<=S;i++){ var u=i/S, qq=1-u, bx=qq*qq*eyeX+2*qq*u*midx+u*u*ax, by=qq*qq*eyeY+2*qq*u*midy+u*u*ay; L+=Math.hypot(bx-px,by-py); px=bx; py=by; sx.push(bx); sy.push(by); sl.push(L); }
        var nV=Math.max(6,Math.round(L/8)), seg=L/nV, TAIL=Math.round(280/seg), N=nV+1+TAIL, MAXN=240;
        R.x=new Float32Array(MAXN); R.y=new Float32Array(MAXN); R.vx=new Float32Array(MAXN); R.vy=new Float32Array(MAXN); R.ox=new Float32Array(MAXN); R.oy=new Float32Array(MAXN);
        var k=1; for(var i=0;i<=nV;i++){ var dA=i*seg; while(k<S&&sl[k]<dA)k++; var fA=sl[k]===sl[k-1]?0:(dA-sl[k-1])/(sl[k]-sl[k-1]); R.x[i]=sx[k-1]+(sx[k]-sx[k-1])*fA-oxv; R.y[i]=sy[k-1]+(sy[k]-sy[k-1])*fA-oyv; }
        var tx1=ax-midx, ty1=ay-midy, tl=Math.hypot(tx1,ty1)||1; tx1/=tl; ty1/=tl;
        for(var i=nV+1;i<N;i++){ R.x[i]=R.x[nV]+tx1*seg*(i-nV); R.y[i]=R.y[nV]+ty1*seg*(i-nV); }
        /* what it was doing when it was let go: the hook takes a little of the note's drift and the slip's reaction, the line below
           carries less and less of it; a taut line also recoils a touch down toward where it was pulling from */
        var hvx=n.vx*.25-R.sd*10, hvy=10+taut*30;
        for(var i=0;i<N;i++){ var w=Math.max(0,1-i/nV); R.vx[i]=hvx*w*(i?.5:1); R.vy[i]=hvy*w*(i?.5:1); }
        R.n=N; R.nV=nV; R.seg=seg; R.ang=n.rot; R.va=-R.sd*.9; R.yk=yk; R.ph=Math.random()*6; R.gone=false; R.Hd=Hd;
        R.hb={x:hb.x,y:hb.y,w:hb.w,h:hb.h}; R.lx=lx; R.ly=ly;   /* the hook art, pinned by its eye, as it was on the paper */
        for(var hb2=0;hb2<6;hb2++) bub(eyeX+(Math.random()-.5)*8, eyeY-10, (Math.random()-.5)*20, -30-Math.random()*30, .7+Math.random()*1.6, now, 700+Math.random()*700);
      }
      var X=R.x, Y=R.y, VX=R.vx, VY=R.vy, OX=R.ox, OY=R.oy, nn=R.n, sg=R.seg, i;
      while(Y[nn-1]<Hd+40&&nn<X.length){ var ex2=X[nn-1]-X[nn-2], ey2=Y[nn-1]-Y[nn-2], el=Math.hypot(ex2,ey2)||1;   /* the line pays out from below */
        X[nn]=X[nn-1]+ex2/el*sg; Y[nn]=Y[nn-1]+ey2/el*sg; VX[nn]=VX[nn-1]; VY[nn]=VY[nn-1]; nn++; }
      R.n=nn;
      taut*=Math.pow(.02,dt);   /* the tension goes out of it in about a third of a second */
      if(!still&&dt>0){   /* (reduced motion: the slack line just hangs where it was let go) */
        R.simT=(R.simT||0)+dt;
        /* water: gravity against heavy drag, so everything has a slow terminal speed — the hook ~80px/s, the line ~22px/s — and a faint
           current, slower and turning with depth, that nudges the loose line sideways */
        /* 7:41pm his note: "can the line go even more limp at the end ... it kinda just bends over in half". A single clean hairpin
           read as stiff wire. Now: almost no bending stiffness, each link sinks at its own slightly different rate, and the current
           has small eddies along the line as well as the slow sway — so it crumples into loose, uneven S-curves as it settles. */
        if(!R.kv){ R.kv=[]; for(i=0;i<X.length;i++) R.kv.push(.8+Math.random()*.45); }
        for(i=0;i<nn;i++){ var hk0=i===0, kv=R.kv[i]||1, gv=hk0?96:68*kv, kd=hk0?1.2:3.1/kv;
          var sw=Math.sin(t*.5+Y[i]*.011+R.ph)*9+Math.sin(t*.21+R.ph*2+Y[i]*.004)*5+(hk0?0:Math.sin(t*1.3+i*.9+R.ph)*14+Math.sin(t*.7-i*.37)*8);
          VX[i]+=(sw-VX[i]*kd)*dt; VY[i]+=(gv-VY[i]*kd)*dt; OX[i]=X[i]; OY[i]=Y[i]; X[i]+=VX[i]*dt; Y[i]+=VY[i]*dt; }
        for(var it=0;it<4;it++){
          for(i=0;i<nn-1;i++){ var ddx=X[i+1]-X[i], ddy=Y[i+1]-Y[i], dd=Math.hypot(ddx,ddy)||1e-4, ff=(dd-sg)/dd*(dd<sg?.15:1), w0=i?.5:.18;   /* the hook is five times the weight of a link; a link resists being stretched, hardly at all being bunched (a line goes slack, it doesn't push) */
            X[i]+=ddx*ff*w0; Y[i]+=ddy*ff*w0; X[i+1]-=ddx*ff*(1-w0); Y[i+1]-=ddy*ff*(1-w0); }
          for(i=1;i<nn-1;i++){ var mx2=(X[i-1]+X[i+1])*.5, my2=(Y[i-1]+Y[i+1])*.5; X[i]+=(mx2-X[i])*.012; Y[i]+=(my2-Y[i])*.012; }   /* a whisper of stiffness (was .06): curves, not kinks, but limp */
        }
        for(i=0;i<nn;i++){ VX[i]=(X[i]-OX[i])/dt; VY[i]=(Y[i]-OY[i])/dt; }
        /* the hook swings to hang along its link (a pendulum in water), and un-squashes as it turns off the paper's edge-on angle */
        var s1x=X[1]-X[0], s1y=Y[1]-Y[0], tg=Math.atan2(-s1x,s1y), df=tg-R.ang; df=Math.atan2(Math.sin(df),Math.cos(df));
        R.va+=(df*9-R.va*3)*dt; R.ang+=R.va*dt; R.yk+=(1-R.yk)*Math.min(1,dt*1.2);
      }
      var minY=1e9; for(i=0;i<nn;i++) if(Y[i]<minY) minY=Y[i];
      if(minY>Hd+60) R.gone=true;   /* under the bottom of the deep (and its weed): gone for good */
      R.tt=taut; R.gp=gp;
      /* who draws it this frame: fish.js (under its weed) once it has started calling mmRigDraw — until then, or if it stops, this canvas */
      if(!R.gone&&(!R.fishDrewAt||now-R.fishDrewAt>120)){ drawRope(g,oxv,oyv); R.lureDrewAt=now; }
      eyeX=-1e4; ax=-1e4;
    }
    if(!freed){
      g.beginPath(); g.moveTo(eyeX,eyeY); g.quadraticCurveTo(midx,midy,ax,ay); mono(g,dark,taut);
      /* a glint runs down it now and then */
      if(gp<1&&!still){ var qg=1-gp; glint(g,qg*qg*eyeX+2*qg*gp*midx+gp*gp*ax, qg*qg*eyeY+2*qg*gp*midy+gp*gp*ay,dark); }
    }

    function drawBubs(){
    for(var b2=bubs.length-1;b2>=0;b2--){ var B=bubs[b2], age=(now-B.t)/B.life; if(age>=1){ bubs.splice(b2,1); continue; }
      B.vx*=Math.pow(.2,dt); B.vy+=(-55-B.vy)*Math.min(1,dt*2); B.x+=(B.vx+Math.sin(t*7+B.ph)*10)*dt; B.y+=B.vy*dt;
      var al=(1-age)*(age<.1?age*10:1);
      g.beginPath(); g.arc(B.x,B.y,B.r,0,Math.PI*2); g.lineWidth=.8; g.strokeStyle=dark>.5?'rgba(190,225,240,'+(.55*al)+')':'rgba(70,90,100,'+(.5*al)+')'; g.stroke();
      g.fillStyle='rgba(255,255,255,'+(.7*al)+')'; g.beginPath(); g.arc(B.x-B.r*.35,B.y-B.r*.35,Math.max(.4,B.r*.3),0,Math.PI*2); g.fill(); }
    if(bubs.length>80) bubs.splice(0,bubs.length-80);
    }
    /* eaten: it's drawn into the mouth and shrinks away (ease-in, so it's gone with a gulp, not a dwindle) */
    var ep=eaten?clamp((now-eaten)/320,0,1):0, sc=1-ep*ep*.96;
    if(eaten){ if(A){ var e=Math.min(1,dt*(6+ep*30)); n.x+=(A.x-n.x)*e; n.y+=(A.y-n.y)*e; } if(ep>=1){ drawBubs(); return; } }
    g.save(); g.translate(n.x,n.y); g.rotate(n.rot); g.scale(sc*yk,sc); g.globalAlpha=a;
    if(!freed) hook(g,ex,ey,sz.w,true);
    var N=still?1:PL()>=2?16:56, iw=pic.naturalWidth, ih=pic.naturalHeight, pad=Math.ceil(sz.h*.3), LW=Math.ceil(sz.w*dpr), LH=Math.ceil((sz.h+pad*2)*dpr);
    if(NL.width!==LW||NL.height!==LH){ NL.width=CL.width=LW; NL.height=CL.height=LH; }
    nl.setTransform(1,0,0,1,0,0); nl.clearRect(0,0,LW,LH); nl.setTransform(dpr,0,0,dpr,0,0);
    for(var i=0;i<N;i++){ var u0=i/N, u1=(i+1)/N, u=(u0+u1)/2;
      nl.drawImage(pic,u0*iw,0,(u1-u0)*iw,ih,u0*sz.w,pad+paperY(u,sz.h),(u1-u0)*sz.w+.4,sz.h); }
    /* 7:36pm, his question: in front of the ASCII dissolve or behind? It was drawn in front, but it went see-through as the page
       darkened (alpha .58 by the deep), so the characters showed through and it read as BEHIND. In front, solid: it darkens instead. */
    if(dark>0){ nl.setTransform(1,0,0,1,0,0); nl.globalCompositeOperation='source-atop'; nl.fillStyle='rgba(3,10,16,'+(.42*dark).toFixed(3)+')'; nl.fillRect(0,0,LW,LH); nl.globalCompositeOperation='source-over'; }
    var ga=g.globalAlpha; g.globalAlpha=1; g.drawImage(NL,-sz.w/2,-sz.h/2-pad,sz.w,sz.h+pad*2); g.globalAlpha=ga;
    /* the sunlight: full on the bone page, gone as the page turns to ink, none in the deep */
    var sun=inDeep||freed?0:1-smooth(s*1.25);
    if(causOk&&!still&&PL()<1&&sun>.02){
      cl.setTransform(1,0,0,1,0,0); cl.globalCompositeOperation='source-over'; cl.clearRect(0,0,LW,LH);
      if(!causPat) causPat=cl.createPattern(caus,'repeat');
      var k1=sz.w/95;   /* 5:33pm "too small and condensed": cells about half the note wide */
      [[k1,t*9,t*5,0,.75],[k1*1.6,-t*6,t*8,.7,.55]].forEach(function(L){
        var mtx=new DOMMatrix().translateSelf(L[1]*dpr,L[2]*dpr).rotateSelf(L[3]*57.3).scaleSelf(L[0]*dpr,L[0]*dpr);
        causPat.setTransform(mtx); cl.globalAlpha=L[4]; cl.globalCompositeOperation='lighter'; cl.fillStyle=causPat; cl.fillRect(0,0,LW,LH); });
      cl.globalAlpha=1; cl.globalCompositeOperation='destination-in'; cl.drawImage(NL,0,0);
      g.globalCompositeOperation='lighter'; g.globalAlpha=a*.45*sun; g.drawImage(CL,-sz.w/2,-sz.h/2-pad,sz.w,sz.h+pad*2);
      g.globalCompositeOperation='source-over'; g.globalAlpha=a;
    }
    if(!freed) hook(g,ex,ey,sz.w,false);
    g.restore(); g.globalAlpha=1;
    /* just freed: the barb was through the paper, so for the half second the paper is still sliding off it, it's drawn over the paper
       (fading), not suddenly behind it */
    if(freed&&hkOk&&rig.n&&!rig.gone&&now-freed<500){ var B3=rig.hb, P3=HK.point, iw3=hk.naturalWidth, ih3=hk.naturalHeight;
      g.save(); g.globalAlpha=a*(1-(now-freed)/500); g.translate(rig.x[0]+(dr?dr.left:0),rig.y[0]+(dr?dr.top:0)); g.rotate(rig.ang); g.translate(-rig.lx*rig.yk,-rig.ly); g.scale(rig.yk,1);
      g.drawImage(hk,P3[0]*iw3,P3[1]*ih3,(P3[2]-P3[0])*iw3,(P3[3]-P3[1])*ih3,B3.x+P3[0]*B3.w,B3.y+P3[1]*B3.h,(P3[2]-P3[0])*B3.w,(P3[3]-P3[1])*B3.h); g.restore(); }
    drawBubs();
    m.px=m.x; m.py=m.y;
  }
  requestAnimationFrame(frame);
})();
