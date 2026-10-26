/* ---- Bubbles: something is breathing under the page ----
   ⛳ 15 Oct: almost everything on the desktop homepage happens when you scroll, and the first screen
   gave no hint of it (the one desktop stranger we'd tracked never scrolled). His call: "some subtle
   bubble bubbling up from the middle bottom", then "keep bubbling through the menu section to get
   people to scroll all the way down to the deep sea ... a strong tease to get people to scroll, then
   more subtle once we have them". Then: "the bubbles go up too high, they should bubble around down
   the bottom", "cheap and cartooney" (so they are painted now, see the art below), "less blue and more
   white", and "ramp the polish right up: react when you scroll, react to the cursor, more variation in
   size so they feel like ocean bubbles".

   What that came to:
   - They come up from the bottom-middle of the screen all the way down the page. First screen: the
     tease, more of them, popping within ~60-240px of the bottom so the eye is pulled down there.
     Scrolling: the odd small one. Over the black at the bottom: the pale deep-sea set, plainly coming
     up out of it (fish.js).
   - Ocean sizes: mostly specks, some middling, the odd big one. Small bubbles are round and rise
     straight; big ones are squashed, wobble, and zig-zag (that is how real ones behave). Bigger rise
     faster. Each has a depth: far ones are smaller, fainter, slightly soft, and move less.
   - Scroll: the water moves with the page — bubbles are carried up (or down) with it, near ones more
     than far ones, stretch along a fast scroll, and a scroll stirs up a few more.
   - Cursor: moving the glove pushes a wake through them; the fingertip touching one pops it — a ring
     and a spray of specks that then rise on their own.
   - ⛔ Plain source-over with real alpha in the art. Multiply (the first painted cut) let the hero's
     bottom rule show through every bubble, so the rule looked like it ran in front of them.
   Desktop only (phones have the pond). Off with reduced motion. ?bubbles=0 off, ?bubbles=1 forces it
   (headless Chromium fails the hover/pointer query). */
(function(){
  "use strict";
  var q=location.search;
  if(/[?&]bubbles=0/.test(q))return;
  var force=/[?&]bubbles=1/.test(q);
  if(!force&&!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
  if(!force&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;

  var cv=document.createElement('canvas');
  cv.className='bubbles'; cv.setAttribute('aria-hidden','true');
  /* ⛳ 15 Oct 8:26pm, his ask: behind the menu's type. So the canvas lives INSIDE .menu (z 31, its own
     stacking context): fixed to the viewport, but painted at z 1 there — over the menu's bone ground, the
     row rules and the hover cards, under the row text (.item__no/__title/__meta are z 2). The menu as a
     whole sits over the hero, so the bubbles still pass IN FRONT of the hero's bottom rule. */
  var host=document.getElementById('menu')||document.body;
  cv.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:'+(host===document.body?32:1);
  host.appendChild(cv);
  var g=cv.getContext('2d'), W=0, H=0, dpr=1;
  var wipe=window.mmPerf&&mmPerf.dirty?mmPerf.dirty(g):function(){ g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,cv.width,cv.height); };   /* 20 Oct: clears only what was drawn (perf.js) */
  function PL(){ return (window.mmPerf&&window.mmPerf.level)||0; }   /* perf.js: 1+ lower res, 2+ fewer bubbles */
  addEventListener('mmperf',function(){ size(); });
  function size(){ dpr=Math.min(devicePixelRatio||1,PL()>=1?1:2); W=innerWidth; H=innerHeight;
    cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); }
  size(); addEventListener('resize',size);
  var voidEl=document.querySelector('.egg__void'), subEl=document.querySelector('.hero__sub');

  /* the art: strips of 96px cells, painted in Midjourney (designs/bubbles-mj/make_bubbles.py) */
  var dir=(document.getElementById('deep')||{dataset:{}}).dataset.dir||'assets/deep/';
  function sheet(name){ var im=new Image(); im.onload=function(){
      im.n=Math.round(im.naturalWidth/im.naturalHeight);
      /* a softened copy for the far ones, made once */
      var c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
      var x=c.getContext('2d'); if('filter' in x){ x.filter='blur(2.5px)'; x.drawImage(im,0,0); im.soft=c; } else im.soft=im;
    }; im.src=dir+name+'?v='+ART; return im; }
  var ART='5';   /* bump when make_bubbles.py is re-run: the art sits at a fixed URL and caches */
  var LIGHT=sheet('bubbles_light.webp'), DARK=sheet('bubbles_dark.webp');

  function rnd(a,b){ return a+Math.random()*(b-a); }
  /* ocean sizes: specks are common, big ones rare. diameter in css px */
  function oceanSize(lo,hi,k){ return lo+(hi-lo)*Math.pow(Math.random(),k); }

  /* how hard to tease, by where you are */
  var MODES={
    tease:{gap:[900,2000], n:[3,8], lo:3, hi:34, k:2.4, rise:[60,240], a:1},
    trail:{gap:[3500,7000], n:[1,4], lo:2.5, hi:16, k:3, rise:[50,170], a:.8},
    deep: {gap:[1100,2300], n:[4,9], lo:2.5, hi:16, k:2.6, rise:[150,480], a:.6},   /* 10:16pm "smaller and a bit more subtle": hi 30→16, a .95→.6 */   /* 10:12pm "dial the bubbles up a little ... in the deep sea": ~40% more, rise a touch higher */
    /* ⛳ 15 Oct, his ask: "get a little bit more intense and fill up more of the screen/take up a bit more width
       as you scroll down the transition area". Through the dissolve they build from the trail to this: more
       often, more at a time, and rising further up the screen. Then they ease back to the deep set over a screen
       of the black. */
    sink: {gap:[650,1300], n:[4,9], lo:3, hi:32, k:2.3, rise:[170,560], a:.95}
  };
  var fadeEl=document.querySelector('.egg__fade');
  function mix(a,b,t){ var o={}; for(var k in a) o[k]=typeof a[k]==='number'?a[k]+(b[k]-a[k])*t:[a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t]; return o; }
  /* how far down the dissolve you are: 0 as its top comes up the screen, 1 when its bottom reaches the bottom edge */
  function sunk(){ if(!fadeEl)return 0; var r=fadeEl.getBoundingClientRect(); return Math.max(0,Math.min(1,(H-r.top)/Math.max(1,r.height))); }
  function dissolving(){ if(!fadeEl||!voidEl)return false; return fadeEl.getBoundingClientRect().top<H&&voidEl.getBoundingClientRect().top>=H; }
  function mode(){
    var vt=voidEl?voidEl.getBoundingClientRect().top:1e9;
    /* ⛳ 17 Oct 11:40am, his call: "no bubbles during the middle of the gradient transition, just what we have at the top
       white kinda bit to lure people down". The dissolve is quiet now (see dissolving()); they come back with the black. */
    if(vt<H)return MODES.deep;
    var q=sunk();
    /* ⛳ 9:51pm, he changed his mind: "not sure about the bubbles on top of the ascii transition anymore. maybe just
       a little bit. they clash a bit". Only a quarter of the way to the sink set, and late. */
    if(q>0&&scrollY>=H*.35)return mix(MODES.trail,MODES.sink,.25*Math.pow(q,1.6));
    return scrollY<H*.35?MODES.tease:MODES.trail;
  }

  /* ⛳ 18 Oct 6:34pm, his note: the bubbles and the $100 on its line (lure.js) were "too busy together in the middle". The note keeps
     the centre; the seep rises just to its left, side by side. (A first try parted the bubbles round the note — they shot off
     sideways, "weird"; removed.) Without the note (phones-off, ?lure=0) it's the middle as before. */
  /* ⛔ 6:38pm: moving the seep left was "a cheap bandaid". The real fix: the $100 on its line now does the bubbles' old job (leading
     people down), so the bubbles become part of it — they rise straight up the line, past the note, but as a thin trickle, not the
     landing-page gush. LURE: is the note there (lure.js canvas). */
  function SEEP(){ return W/2; }
  function LURE(){ return !!document.querySelector('canvas.lure'); }
  var vent={t0:0,acc:0,gushUntil:0,nextGush:0,leadSurge:0,nextLead:0}, lead_acc=0;
  /* one bubble out of the vent: mostly small, now and then a big one, thrown up hard from a point that wanders a
     few px, so the chain wobbles instead of standing up like a ruler */
  function ventBubble(now,md){
    var lu=LURE(), d=lu?(Math.random()<.12?rnd(11,17):oceanSize(3,9,2)):(Math.random()<.09?rnd(15,26):oceanSize(2.5,12,2.1));   /* with the note: small ones only */
    var x=SEEP()+(lu?rnd(-6,6):0)+Math.sin(now/1700)*7+Math.sin(now/430)*3+rnd(-2.5,2.5);
    var b=add(x, H+d*.55, d, md, {z:rnd(.45,1), plume:true});
    b.vy=-rnd(150,250)*(now<vent.gushUntil?1.25:1); b.vx=rnd(-22,22);
    b.left=rnd(H*.3,H*.48)*(.85+.25*d/26); b.a=md.a*(.75+.25*b.z);
  }
  var bubs=[], rings=[], nextBurst=performance.now()+1e9, first=true, nextStray=performance.now()+2500, last=0, popped=0;
  var m={x:-1e4,y:-1e4,vx:0,vy:0,t:0}, lastScroll=scrollY, sv=0, stir=0, idle=false;
  var T=function(n){ if(window.mmTrack)window.mmTrack(n); };   /* looked up at event time — see koi.js */
  addEventListener('mousemove',function(e){ var now=performance.now(), dt=Math.max(8,now-m.t);
    if(m.t){ m.vx=m.vx*.5+(e.clientX-m.x)/dt*1000*.5; m.vy=m.vy*.5+(e.clientY-m.y)/dt*1000*.5; }
    m.x=e.clientX; m.y=e.clientY; m.t=now; },{passive:true});

  function add(x,y,d,md,extra){
    var z=Math.random();                                   /* depth: 0 far, 1 near */
    var size=d*(.6+.4*z);
    var b={x:x,y:y,d:size,z:z,vx:0,vy:0,ph:Math.random()*6.3,
      rise:(18+size*2.6)*rnd(.8,1.2),                      /* bigger rise faster; no two quite alike, or same-sized ones travel as pairs */
      wob:size>6?Math.min(1,(size-6)/22):0,               /* specks rise straight; from middling up they wobble and zig-zag, more the bigger */
      kick:0,                                              /* a jolt of wobble, from a merge */
      left:rnd(md.rise[0],md.rise[1])*(.7+.6*z),           /* how far it rises before it goes */
      a:md.a*(.55+.45*z), born:performance.now(), cell:null};
    if(extra)for(var k in extra)b[k]=extra[k];
    if(PL()>=2&&bubs.length>45) bubs.shift();   /* (perf level 2: fewer at once) */
    bubs.push(b); return b;
  }
  /* ⛳ 8:37pm, his idea: "wider ... maybe it gets wider the more you scroll down". A stream in the
     middle on the first screen, opening out the further down the page you are, to most of the screen
     over the deep sea: a trickle that turns into open water. */
  function spread(){ var p=Math.max(0,Math.min(1,scrollY/Math.max(1,document.documentElement.scrollHeight-H)));
    /* ⛳ 15 Oct: and across the dissolve they open out to nearly the full width */
    return Math.max(110+(W*.42-110)*Math.pow(p,.8), 110+(W*.5-110)*Math.pow(sunk(),1.4)); }
  function burst(now,md,n,gulp){
    var sp=spread(), x=SEEP()+rnd(-1,1)*sp*.75;                /* where this cluster comes up */
    if(gulp){
      /* ⛳ "make sure people notice them when they first land — eyes go to the top nav": the first one is a
         gulp, rising about a third of the way up (after that they keep low — "they go up too high").
         ⛳ 8:43pm "the initial gulp burst comes out in an ugly formation": it had appeared all at once as a
         clump. A real gulp is a PLUME — let go one after another from one point just under the edge, the
         big ones first and fastest, the small ones trailing — so it strings itself out as it rises. */
      /* ⛳ 8:51pm "the plume is still ugly — the bubbles are all huge and the same size": in a real browser
         the small ones drafted into the big ones' wake and merged until everything was one middling size.
         So: two or three big ones lead, then a long tail of specks, and plume bubbles never merge. */
      /* ⛳ 16 Oct 7:31pm, his note: "they should be more like an energetic burst/gulp ... a little bit too subtle ...
         like a clam has opened up ... go a tiny bit higher ... nothing too crazy". So the opening is now ONE burst: a
         clam snapping open. Everything is let go inside a quarter of a second, fanned out (up to ±32° off vertical,
         the big ones nearer the middle), punched up hard, and it climbs about 45% of the screen instead of 30%. Sizes
         stay mixed (3-4 big ones, a spray of specks) so it is never the uniform clump that was rejected at 8:43pm. */
      x=W/2+rnd(-30,30);
      var ds=[rnd(32,42),rnd(24,32),rnd(18,24)]; if(Math.random()<.7)ds.push(rnd(14,20));
      n=Math.max(n,30);
      for(var k=ds.length;k<n;k++)ds.push(oceanSize(2.5,12,2.2)); ds.sort(function(p,q){ return q-p; });
      for(var i=0;i<ds.length;i++){ var d=ds[i], big=i<ds.length*.15;
        var ang=rnd(-1,1)*(big?.22:.56), sp=(big?1:1.25)*rnd(.8,1.2);
        var g1=add(x+rnd(-1,1)*(6+d*.3), H+d*.55, d, md, {z:big?rnd(.7,1):rnd(.3,1),plume:true});
        g1.born=now+rnd(0,big?80:240);
        g1.left=rnd(H*.36,H*.52)*(.8+.3*d/42);
        var V=rnd(230,330)*(big?1.1:1);                        /* a throw in px/s, not scaled by size, or the specks dribble */
        g1.vy=-V*Math.cos(ang); g1.vx=V*Math.sin(ang);
        g1.kick=big?.6:0; g1.a=md.a*(.78+.22*g1.z); }
      return;
    }
    for(var j=0;j<n;j++){ var dd=oceanSize(md.lo,md.hi,md.k);
      add(x+rnd(-1,1)*(6+dd*.3+sp*.12), H+dd+j*rnd(6,22), dd, md); }
  }
  function pop(b){
    rings.push({x:b.x,y:b.y,d:b.d,t:performance.now(),dark:b.dark,z:b.z,cell:b.cell,a:b.a*(b.cf==null?1:b.cf)});
    if(b.d>7){ var md=mode(), n=Math.min(6,2+Math.floor(b.d/7));
      for(var i=0;i<n;i++){ var an=rnd(0,6.28), sp=rnd(60,160);
        add(b.x+Math.cos(an)*b.d*.3, b.y+Math.sin(an)*b.d*.3, rnd(2,4), md,
            {vx:Math.cos(an)*sp, vy:Math.sin(an)*sp-40, left:rnd(30,90), z:b.z}); } }
  }

  function frame(now){
    requestAnimationFrame(frame);
    var dt=Math.min((now-(last||now))/1000,.05); last=now;
    if(document.hidden)return;
    var md=mode();

    /* the scroll: how far the page moved this frame, and a smoothed speed for the stretch */
    var dy=scrollY-lastScroll; lastScroll=scrollY;
    sv+=((dt?dy/dt:0)-sv)*Math.min(1,dt*10);
    stir+=Math.abs(dy);
    /* ⛳ "visible almost as soon as you land": the first cluster starts already partway up the bottom
       edge, a third of a second in, rather than rising into view from below it */
    /* ⛳ 16 Oct 7:41pm, his note on a one-off burst: "like a really lame party popper went off and then nothing ... it
       should be an almost constant spurt ... when air is released from a crevice at the bottom of the ocean". So at
       the top of the page the source is a VENT: a gas seep in the middle of the bottom edge that never stops — a
       strong gush as the page lands, then a steady wobbling chain of bubbles, surging every couple of seconds. Once
       you scroll past the first screen the old scattered clusters take over (trail / sink / deep, unchanged). */
    var atTop=scrollY<H*.35;
    var hush=dissolving();
    if(atTop&&LIGHT.n){
      if(!vent.t0){ vent.t0=now; vent.nextGush=now+rnd(2200,3000); }
      if(now>vent.nextGush){ vent.gushUntil=now+rnd(350,750); vent.nextGush=now+rnd(1500,3200); }
      var age=now-vent.t0, rate=now<vent.gushUntil?34:(age<1600?40:age<2600?40-29*(age-1600)/1000:11);
      if(LURE()) rate=now<vent.gushUntil?15:(age<1600?18:6.8);   /* a trickle up the line, past the note (6:48pm "a little bit too subtle now": 3.2 → 5.5/s) */
      vent.acc+=rate*dt;
      while(vent.acc>=1){ vent.acc-=1; ventBubble(now,md); }
      first=false; nextBurst=now+rnd(md.gap[0],md.gap[1]);
    }
    else if(hush) nextBurst=Math.max(nextBurst,now+rnd(md.gap[0],md.gap[1]));
    else if(now>nextBurst){ burst(now,md,Math.round(rnd(md.n[0],md.n[1]))); nextBurst=now+rnd(md.gap[0],md.gap[1]); }
    /* ⛳ 17 Oct, his ask: "subtle bubbles when the viewer is around the ABOUT button / start of the gradient transition
       just to lead the viewer down a tiny bit more". As the top of the dissolve comes up the screen, a thin seep starts
       again in the bottom middle — small ones, a few a second, popping low — swelling while the dissolve's edge is mid
       screen, gone again once you're into it. A breadcrumb, not the landing gush. */
    if(!atTop&&fadeEl){ var ft=fadeEl.getBoundingClientRect().top, lx=(H*1.25-ft)/(H*1.25);
      var lead=lx>0&&lx<1?Math.min(1,lx/.12,(1-lx)/.25):0;   /* 12:20pm "more obvious" (his mum missed them): full strength almost as soon as ABOUT is up, not a slow swell */
      if(lead>.02){ if(now>vent.nextLead){ vent.leadSurge=now; vent.nextLead=now+rnd(1400,2600); } var surge=now-vent.leadSurge<450;
        lead_acc+=lead*(surge?22:9)*dt*(LURE()?.35:1);   /* with the note on its line there, just a trickle up the line */
        while(lead_acc>=1){ lead_acc-=1;
          var ld=LURE()?oceanSize(2.5,8,2):(Math.random()<.16?rnd(16,26):oceanSize(4,15,1.8));
          var lb=add(SEEP()+Math.sin(now/1900)*14+rnd(-6,6), H+ld*.55, ld, md, {z:rnd(.4,1), plume:true});
          lb.vy=-rnd(130,200); lb.vx=rnd(-16,16); lb.left=rnd(H*.26,H*.46); lb.a=.85+.15*lb.z; } } }
    if(stir>260){ stir=0; if(!hush) burst(now,md,Math.round(rnd(1,3))); }   /* scrolling stirs a few more up */
    /* ⛳ his question, 8:22pm: the whole bottom, or just the middle? The middle — one source reads as
       something down there, a whole row reads as fizzy drink. But the odd far speck rises somewhere
       else along the bottom, so it feels like open water rather than a pipe. */
    if(now>nextStray){ var sx=rnd(.08,.92)*W; if(Math.abs(sx-W/2)>120&&!hush)add(sx,H+6,rnd(2.5,6),md,{z:rnd(0,.3)});
      nextStray=now+rnd(1800,4200)*(1-.25*sunk()); }
    m.vx*=Math.pow(.02,dt); m.vy*=Math.pow(.02,dt);                 /* the glove's push dies when it stops */

    if(!bubs.length&&!rings.length){ if(!idle){ wipe(); idle=true; cv.style.visibility='hidden'; }   /* 20 Oct: an empty layer off the screen */ return; }
    if(idle) cv.style.visibility=''; idle=false;
    /* ⛔ 15 Oct, "the bubbles are too white down here": the pale set (an opaque disc, made for the bone page) was
       used until well into the black, because the switch waited for the void. The dissolve is already ink by
       about two thirds of the way down. Now each bubble cross-fades between the sets by how dark the page is
       behind it: bone to ink between 50% and 72% of the dissolve. */
    var fr=fadeEl?fadeEl.getBoundingClientRect():null;
    /* ⛳ 17 Oct 9:25pm, his note: "the bubbles look super intense on the ABOUT button hover". A hovered row turns ink, and
       the pale set over ink is bright white. Over a hovered row they switch to the dark set, the one made for the deep. */
    var hot=document.querySelector('.item--cards:hover'), hr=hot?hot.getBoundingClientRect():null;
    function darkAt(y){ if(hr&&y>=hr.top&&y<=hr.bottom)return 1; if(!fr)return 0; var t=Math.max(0,Math.min(1,((y-fr.top)/Math.max(1,fr.height)-.5)/.22)); return t*t*(3-2*t); }
    wipe(); g.setTransform(dpr,0,0,dpr,0,0);
    var ms=Math.hypot(m.vx,m.vy);
    touch(dt);
    /* ⛳ 8:45pm, his question: "the bubbles probably shouldn't touch the subheading?" No — they keep ~40px
       clear of it, thinning out on the way and popping before they get there. Gone once it has faded. */
    var ceil=-1e9;
    if(subEl&&scrollY<H){ var sr=subEl.getBoundingClientRect(), so=+getComputedStyle(subEl).opacity;
      if(so>.05&&sr.bottom>0&&sr.top<H)ceil=sr.bottom+40; }

    for(var i=bubs.length-1;i>=0;i--){ var b=bubs[i], t=(now-b.born)/1000;
      if(t<0)continue;                                     /* not let go yet (the gulp releases one by one) */
      /* carried with the page: near ones nearly all the way, far ones less */
      b.y-=dy*(.35+.5*b.z);
      /* buoyancy: velocity relaxes toward a steady rise; the big ones zig-zag */
      var tvx=Math.sin(t*(3.2-b.wob*1.4)+b.ph)*(6+b.wob*38), tvy=-b.rise*(.6+.4*b.z);
      /* the opening burst keeps its throw for longer (it was gone in half a second and read as a trickle) */
      var kx=b.plume?.8:2.2, ky=b.plume?.55:1.6;
      b.vx+=(tvx-b.vx)*Math.min(1,dt*kx); b.vy+=(tvy-b.vy)*Math.min(1,dt*ky);
      /* the glove: a moving hand pushes a wake through them */
      var ddx=b.x-m.x, ddy=b.y-m.y, dist=Math.hypot(ddx,ddy), R=70+b.d*1.5;
      if(dist<R&&ms>60){ var f=(1-dist/R)*Math.min(1,ms/900)*dt*(1.1-.4*b.z);
        b.vx+=m.vx*f*1.6+ddx/(dist||1)*ms*f*.6; b.vy+=m.vy*f*1.6+ddy/(dist||1)*ms*f*.6; }
      var oy=b.y; b.x+=b.vx*dt; b.y+=b.vy*dt;
      b.left-=Math.max(0,oy-b.y);                           /* only its own rise counts, not the scroll */
      b.dk=darkAt(b.y); b.dark=b.dk>.5;
      /* the fingertip touching it */
      if(dist<b.d*.55+2&&b.d>4){ pop(b); bubs.splice(i,1); if(!popped++)T('bubble_pop'); continue; }
      var cf=Math.min(1,Math.max(0,(b.y-b.d/2-ceil)/50));
      if(cf<.5){ b.left=0; b.cf=cf; }                       /* half-faded on the way to the subhead: it goes */
      if(b.left<=0||b.y<-60||b.y>H+160||b.x<-60||b.x>W+60){
        if(b.left<=0&&b.d>9&&b.y>0&&b.y<H&&!b.dark)pop(b);   /* big ones pop; specks just thin away. 10:16pm: in the deep sea none pop, they thin away */
        bubs.splice(i,1); continue; }
      draw(b, Math.min(1,b.left/30)*Math.min(1,t*4)*cf, now);
    }
    /* a pop: ⛳ 8:44pm "the pop circles are a little bit harsh" (it was a dark ring). Now the bubble itself
       swells a touch and fades out, leaving only a ghost of a ring */
    for(var j=rings.length-1;j>=0;j--){ var r=rings[j], u=Math.max(0,(now-r.t)/200); if(u>1){ rings.splice(j,1); continue; }
      var im=r.dark?DARK:LIGHT, cs=im.naturalHeight, e=(1-u)*(1-u), k=1+.3*u;
      if(im.n&&r.cell!=null){ g.globalAlpha=(r.a||1)*e*.8; g.drawImage(im,(r.cell%im.n)*cs,0,cs,cs,r.x-r.d*k/2,r.y-r.d*k/2,r.d*k,r.d*k); }
      g.globalAlpha=e*.12;
      g.strokeStyle=r.dark?'rgba(205,225,245,1)':'rgba(90,95,100,1)'; g.lineWidth=.7;
      g.beginPath(); g.arc(r.x,r.y,Math.max(.5,r.d/2*(1+u*.6)),0,7); g.stroke(); }
    g.globalAlpha=1;
  }

  /* ⛳ 8:44pm, his ask: "anything else to make them behave more realistic? still SoR4 to look at".
     How real bubbles treat each other: two that touch gently MERGE into one bigger bubble (volume kept,
     so the new diameter is the cube root of the sum of cubes) and it wobbles from the jolt; big ones that
     meet at speed SHOVE apart instead of overlapping; and a small bubble caught in a big one's wake is
     pulled up faster behind it (it drafts). Only between bubbles at roughly the same depth. */
  function touch(dt){
    for(var i=0;i<bubs.length;i++){ var a=bubs[i]; if(a.dead||a.born>last)continue;
      for(var j=i+1;j<bubs.length;j++){ var b=bubs[j]; if(b.dead||b.born>last||Math.abs(a.z-b.z)>.35)continue;
        var dx=b.x-a.x, dy=b.y-a.y, dist=Math.hypot(dx,dy)||.01, rs=(a.d+b.d)/2;
        if(dist<rs){
          var rel=Math.hypot(b.vx-a.vx,b.vy-a.vy);
          if(!a.plume&&!b.plume&&a.d<14&&b.d<14&&rel<90&&Math.random()<.5){   /* small ones only, and only sometimes */
            var va=a.d*a.d*a.d, vb=b.d*b.d*b.d, nd=Math.cbrt(va+vb), wa=va/(va+vb);
            a.x=a.x*wa+b.x*(1-wa); a.y=a.y*wa+b.y*(1-wa); a.vx=a.vx*wa+b.vx*(1-wa); a.vy=a.vy*wa+b.vy*(1-wa);
            a.d=nd; a.rise=(18+nd*2.6)*rnd(.9,1.1); a.wob=nd>6?Math.min(1,(nd-6)/22):0; a.kick=1;
            a.left=Math.max(a.left,b.left); a.a=Math.max(a.a,b.a); b.dead=true;
          } else { var o=(rs-dist)/dist, wb=a.d/(a.d+b.d);
            a.x-=dx*o*(1-wb); a.y-=dy*o*(1-wb); b.x+=dx*o*wb; b.y+=dy*o*wb; }
        } else {
          var big=a.d>b.d?a:b, sm=big===a?b:a;
          if(sm.d<big.d*.5&&sm.y>big.y&&sm.y-big.y<big.d*4&&Math.abs(sm.x-big.x)<big.d*.6){
            sm.vy-=45*dt; }                                  /* a lift only — pulling them in sideways made them all collide */
        }
      } }
    for(var k=bubs.length-1;k>=0;k--)if(bubs[k].dead)bubs.splice(k,1);
  }

  function draw(b, fade, now){
    b.kick*=Math.pow(.04,1/60);
    var dk=b.dk==null?(b.dark?1:0):b.dk;
    if(dk>0&&dk<1){ b.dark=false; drawOne(b,fade*(1-dk),now); b.dark=true; drawOne(b,fade*dk,now); b.dark=dk>.5; return; }
    drawOne(b,fade,now);
  }
  function drawOne(b, fade, now){
    var im=b.dark?DARK:LIGHT; if(!im.n)return;
    if(b.cell==null)b.cell=Math.floor(Math.random()*im.n);
    var cs=im.naturalHeight, src=b.z<.3&&im.soft?im.soft:im;
    /* round when small; squashed and wobbling when big; stretched along a fast scroll */
    var w=Math.sin(now*.011+b.ph*3)*.07*b.wob+Math.sin(now*.03+b.ph)*.14*b.kick, squash=1+.12*b.wob;
    var st=Math.min(.22,Math.abs(sv)/4000)*(.4+.6*b.z);
    var sx=squash*(1+w)*(1-st*.5), sy=(1/squash)*(1-w)*(1+st);
    var d=b.d;
    g.globalAlpha=b.a*fade;
    g.save(); g.translate(b.x,b.y); if(b.wob)g.rotate(Math.max(-.25,Math.min(.25,b.vx/400)));
    /* ⛔ 15 Oct, his note over the deep sea: "the bubbles are too white down here. they should look more like
       transparent bubbles". Shrunk to a few pixels the painted rim and glint average out into a solid pale
       dot. So over the dark, the small ones are drawn as what a bubble is: a thin rim with a clear middle and
       one glint; only the big ones use the painting, and fainter. */
    if(b.dark&&d<18){
      var rr=d/2;
      g.scale(sx,sy);
      g.globalAlpha=b.a*fade*(.28+.012*d)*(.5+.5*b.z);
      g.strokeStyle='rgba(170,205,235,1)'; g.lineWidth=Math.max(.55,d*.07);
      g.beginPath(); g.arc(0,0,Math.max(.6,rr-g.lineWidth/2),0,7); g.stroke();
      if(d>4){ g.globalAlpha=b.a*fade*.7*(.5+.5*b.z); g.fillStyle='rgba(225,240,250,1)';
        g.beginPath(); g.arc(rr*.38,-rr*.4,Math.max(.45,d*.08),0,7); g.fill(); }
    } else {
      if(b.dark){ g.globalAlpha=b.a*fade*.62; if(src===im.soft)src=im; }
      g.drawImage(src,(b.cell%im.n)*cs,0,cs,cs,-d*sx/2,-d*sy/2,d*sx,d*sy);
    }
    g.restore();
  }
  requestAnimationFrame(frame);
})();
