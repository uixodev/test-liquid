/* The mark: two blobby Ms, drawn as a union of circles along each letter's
   skeleton and melted round with a blur-and-threshold pass, so nothing in the
   outline is ever sharp. Solid ink, oozing on a 40-second cycle.
   Every phase term advances a WHOLE number of turns, so the loop closes
   exactly — verify with ?markphase=0 against ?markphase=0.99999.
   Costs nothing when the tab is hidden, the mark is off screen, or the
   visitor has asked for reduced motion. */
(function(){
  "use strict";
  var CFG={r:34,bulge:.32,f1:1.4,f2:2.3,term:.34,wob:9,apex:.62,mw:.46,pinch:.12,floor:0,goo:7};
  var INK='#161511', BONE='#EFEDE6', PERIOD=18000, FPS=24, FPS_LIVE=60;
  /* A finger through a puddle: the cursor shoves nearby points aside, drags
     them along its direction of travel, and thins the ink where it passes.
     Each point is a spring back to where it belongs, so the surface wobbles
     home instead of snapping. Reach and push are in mask pixels at h=300 and
     scale with the mark. */
  /* Water, not jelly. Springing every point back to where it started is an
     elastic solid — it remembers its shape and bounces. A liquid has no
     memory of position: a disturbance spreads to the liquid beside it as a
     travelling ripple and dies away by drag. So the points along each
     letter's skeleton are coupled to their neighbours (a wave equation),
     barely pulled back towards rest at all (flat, standing in for gravity
     levelling a puddle), and heavily damped. Sub-steps carry the ripple
     across the mark fast enough to see; a plain single step is stable only
     up to a crawl.
     max is the ceiling on how far any point may stray, as a multiple of the
     blob radius. Without it the drag accumulates and the letters are pulled
     off downstream — the mark stops being an M by mid-swipe. */
  /* Dialled back a fifth of the way towards a solid: max caps how far any
     point may stray (as a multiple of the blob radius) and is what actually
     sets the amplitude — the shove saturates against it, so pushing harder
     changes nothing. damp is per sub-step, so small moves matter. */
  var PHY={reach:55,push:8,carry:.16,dip:.3,still:.2,slow:.05,max:.85,
           flat:.006,couple:.28,sub:4,damp:.9845};

  function skel(x0,W,H,apex){
    var A=H*apex;
    return [[x0,H],[x0,H*0.16],[x0+W*0.11,0],[x0+W*0.31,A*0.55],[x0+W*0.5,A],
            [x0+W*0.69,A*0.55],[x0+W*0.89,0],[x0+W,H*0.16],[x0+W,H]];
  }
  function sample(pts,n){
    var out=[],segs=[],tot=0,i,d;
    for(i=0;i<pts.length-1;i++){d=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);segs.push(d);tot+=d;}
    for(var k=0;k<=n;k++){
      var t=k/n*tot; i=0;
      while(i<segs.length&&t>segs[i]){t-=segs[i];i++;}
      if(i>=segs.length){out.push(pts[pts.length-1].slice());continue;}
      var f=segs[i]?t/segs[i]:0;
      out.push([pts[i][0]+(pts[i+1][0]-pts[i][0])*f, pts[i][1]+(pts[i+1][1]-pts[i][1])*f]);
    }
    return out;
  }
  var SH=[0,0,0];
  function shape(pts,i,c,ph,seed){
    var pt=pts[i], t=i/(pts.length-1);
    /* Every phase term advances a WHOLE number of turns per cycle, or the
       loop lands out of step. They all advance in the SAME direction too:
       counter-travelling waves make standing points that never move, and a
       drift that reverses halts at each end — both read as stop-start. */
    var swell=1+c.bulge*Math.sin(t*c.f1*Math.PI*2+ph+seed)+c.bulge*0.55*Math.sin(t*c.f2*Math.PI*2+ph*2+seed*1.9);
    var term=1+c.term*Math.exp(-Math.pow(t/0.10,2))+c.term*Math.exp(-Math.pow((1-t)/0.10,2));
    var pinch=1-c.pinch*(Math.exp(-Math.pow((t-0.30)/0.13,2))+Math.exp(-Math.pow((t-0.70)/0.13,2)));
    SH[2]=Math.max(c.r*(c.floor||0), c.r*swell*term*pinch);
    SH[0]=pt[0]+Math.sin(t*1.8*Math.PI*2+ph+seed)*c.wob;
    SH[1]=pt[1]+Math.cos(t*1.8*Math.PI*2+ph+seed)*c.wob;
    return SH;
  }
  /* The ripple: each point is pulled towards the average of the two beside
     it, so a dent spreads outward along the letter instead of staying put. */
  function water(fx,b,n,c){
    var lim=c.r*PHY.max, s,i,j,pm,pp;
    for(s=0;s<PHY.sub;s++){
      for(i=0;i<n;i++){
        j=b+i;
        pm=i>0?fx.ox[j-1]:fx.ox[j]; pp=i<n-1?fx.ox[j+1]:fx.ox[j];
        fx.ax[j]=PHY.couple*(pm+pp-2*fx.ox[j])-PHY.flat*fx.ox[j];
        pm=i>0?fx.oy[j-1]:fx.oy[j]; pp=i<n-1?fx.oy[j+1]:fx.oy[j];
        fx.ay[j]=PHY.couple*(pm+pp-2*fx.oy[j])-PHY.flat*fx.oy[j];
      }
      for(i=0;i<n;i++){
        j=b+i;
        fx.vx[j]=(fx.vx[j]+fx.ax[j])*PHY.damp;
        fx.vy[j]=(fx.vy[j]+fx.ay[j])*PHY.damp;
        fx.ox[j]+=fx.vx[j]; fx.oy[j]+=fx.vy[j];
        var m2=fx.ox[j]*fx.ox[j]+fx.oy[j]*fx.oy[j];
        if(m2>lim*lim){ var sc=lim/Math.sqrt(m2);
          fx.ox[j]*=sc; fx.oy[j]*=sc; fx.vx[j]*=sc; fx.vy[j]*=sc; }
        if(m2>fx.mo)fx.mo=m2;
        var s2=fx.vx[j]*fx.vx[j]+fx.vy[j]*fx.vy[j];
        if(s2>fx.mv)fx.mv=s2;
      }
    }
  }
  function blobM(g,x0,W,H,c,p,seed,fx,li){
    var pts=sample(skel(x0,W,H,c.apex),160), ph=p*Math.PI*2, n=pts.length, i, sh;
    if(!(fx&&fx.on)){
      for(i=0;i<n;i++){
        sh=shape(pts,i,c,ph,seed);
        g.moveTo(sh[0]+sh[2],sh[1]);
        g.arc(sh[0],sh[1],sh[2],0,Math.PI*2);
      }
      return;
    }
    var b=li*n;
    /* where each point would sit untouched, and the shove the cursor gives it */
    for(i=0;i<n;i++){
      var j=b+i;
      sh=shape(pts,i,c,ph,seed);
      fx.bx[j]=sh[0]; fx.by[j]=sh[1]; fx.br[j]=sh[2];
      var dx=sh[0]+fx.ox[j]-fx.lx, dy=sh[1]+fx.oy[j]-fx.ly, d2=dx*dx+dy*dy;
      var near=Math.exp(-d2/(fx.reach*fx.reach));
      fx.nr[j]=near;
      if(near>0.002){
        var inv=1/Math.max(Math.sqrt(d2),.001);
        fx.vx[j]+=(dx*inv*fx.push + fx.dx*PHY.carry)*near;
        fx.vy[j]+=(dy*inv*fx.push + fx.dy*PHY.carry)*near;
      }
    }
    water(fx,b,n,c);
    for(i=0;i<n;i++){
      var k=b+i, px=fx.bx[k]+fx.ox[k], py=fx.by[k]+fx.oy[k];
      var rr=fx.br[k]*(1-PHY.dip*fx.nr[k]);   /* ink thins where the finger passes */
      g.moveTo(px+rr,py);
      g.arc(px,py,rr,0,Math.PI*2);
    }
  }
  function buildMask(w,h,c,p,scratch,fx,one){
    var cv=scratch.a, g=cv.getContext('2d');
    cv.width=w;cv.height=h;
    /* the favicon holds a single M and never meets a cursor, so it needs no
       room for displacement */
    var bleed=one?0:PHY.max;
    /* ⛳ 21 Sep: + c.wob on the favicon path only. blobM displaces every
       circle by up to `wob` on both axes, and with bleed=0 there was no room
       reserved for it, so the M's leg ends were pushed past the canvas and
       came out sliced flat. The wordmark (one=false) already clears it —
       bleed is PHY.max, .85*r ≈ 29 against a wob of 9 — so it is left alone. */
    var pad=c.r*((1+c.bulge+c.term)*1.06+bleed)+(one?c.wob:0), H=h-pad*2, Wm=(w-pad*2)*(one?1:c.mw), gap=(w-pad*2-Wm*2);
    if(fx&&fx.on){ fx.lx=fx.cx-pad; fx.ly=fx.cy-pad; }
    g.save();g.translate(pad,pad);g.fillStyle='#000';g.beginPath();
    blobM(g,0,Wm,H,c,p,0,fx,0);
    if(!one) blobM(g,Wm+gap,Wm,H,c,p,2.7,fx,1);
    g.fill('nonzero');g.restore();
    var goo=scratch.b, gg=goo.getContext('2d');
    goo.width=w;goo.height=h;
    gg.filter='blur('+(c.goo*h/300).toFixed(2)+'px)';
    gg.drawImage(cv,0,0); gg.filter='none';
    var im=gg.getImageData(0,0,w,h), d=im.data;
    for(var i=3;i<d.length;i+=4) d[i]=d[i]>128?255:0;
    gg.putImageData(im,0,0);
    return goo;
  }
  function init(cv){
    var scratch={a:document.createElement('canvas'),b:document.createElement('canvas'),c:document.createElement('canvas')};
    var still=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    /* ⛳ THE CAP IS ON THE BUFFER, NOT ON THE RATIO. It used to be
       min(devicePixelRatio,2), which is the right budget for the 298px
       desktop mark and exactly wrong for a phone: an iPhone is dpr 3, so the
       98px mobile mark was built at 196px and stretched to 294 device pixels,
       and the blur-and-threshold edge — which has no anti-aliasing of its own
       — came out visibly chewed. Capping the AREA instead lets the small
       canvas have all three, because even at 3 it is a quarter of what the
       desktop mark already costs: 294x159 = 47k pixels against 596x320 =
       191k. BUDGET is that desktop figure, so nothing about the big mark
       changes. */
    var BUDGET=200000;
    var dpr=Math.min(window.devicePixelRatio||1,3), w=0,h=0, visible=true, last=0;
    /* ⛳ 15 Oct, his note: "the MM logo flickers on scroll on mobile". iOS fires resize every time the
       address bar slides while you scroll, and setting cv.width — even to the SAME value — wipes the
       canvas, which then sat blank until the next 24fps frame. Only touch the buffer when its size
       really changes, and repaint at once when it does. */
    var lastP=0;
    function size(){
      var r=cv.getBoundingClientRect(), d=dpr;
      while(d>1 && r.width*d*r.height*d>BUDGET) d-=.5;
      var nw=Math.round(r.width*d), nh=Math.round(r.height*d);
      if(nw===w&&nh===h)return;
      w=nw; h=nh; cv.width=w;cv.height=h;
      if(w&&h&&typeof paint==='function')paint(lastP);
    }
    function paint(p){
      if(!w||!h)return;
      var g=cv.getContext('2d');
      /* The canvas carries bleed all round so a shoved point cannot reach the
         edge and get sliced off flat. The letters are sized from the artwork
         box, not the canvas, so adding bleed does not shrink them — see the
         matching negative margin on .mark. */
      var k=h/(300+68*PHY.max), c={};
      for(var key in CFG)c[key]=CFG[key];
      c.r=CFG.r*k; c.wob=CFG.wob*k;
      if(fx){ fx.reach=PHY.reach*k; fx.push=PHY.push*k; }
      g.clearRect(0,0,w,h);
      g.drawImage(buildMask(w,h,c,p,scratch,fx),0,0);
      g.globalCompositeOperation='source-in';
      g.fillStyle=INK; g.fillRect(0,0,w,h);
      g.globalCompositeOperation='source-over';
    }
    /* The cursor is only ever an offset that decays to nothing, so the idle
       animation and its exact loop closure are untouched when nobody is
       hovering. State is per skeleton point and persists between frames. */
    var fx=null;
    function wake(){
      if(fx)return fx;
      var N=161*2;                                     /* 161 samples across 2 letters */
      var f32=function(){return new Float32Array(N);};
      fx={ox:f32(),oy:f32(),vx:f32(),vy:f32(),ax:f32(),ay:f32(),
          bx:f32(),by:f32(),br:f32(),nr:f32(),
          cx:-1e4,cy:-1e4,dx:0,dy:0,lx:0,ly:0,on:false,mo:0,mv:0,
          reach:PHY.reach,push:PHY.push,seen:0};
      return fx;
    }
    size();
    /* ?markphase=N paints one fixed phase and stops — used to prove the wrap */
    var forced=(location.search.match(/[?&]markphase=([0-9.]+)/)||[])[1];
    if(forced!==undefined){ paint(parseFloat(forced)); return; }
    if(still){ paint(0); return; }
    /* ?markdrag=N drags a finger left-to-right across the mark and stops after
       exactly N steps, so a screenshot lands on a known frame — rAF is not
       reliable under headless virtual time, a timer is. ?marktune=push:8,damp:.986
       overrides any PHY value while tuning. Debug only. */
    var drag=(location.search.match(/[?&]markdrag=([0-9.]+)/)||[])[1];
    var settle=parseFloat((location.search.match(/[?&]marksettle=([0-9.]+)/)||[])[1]||0);
    var tune=(location.search.match(/[?&]marktune=([^&]+)/)||[])[1];
    if(tune)tune.split(',').forEach(function(kv){
      var a=kv.split(':'); if(a.length===2&&(a[0] in PHY))PHY[a[0]]=parseFloat(a[1]);
    });
    if(drag!==undefined){
      var f=wake(), steps=parseFloat(drag)||1, i=0, out=null;
      if(settle){
        out=document.createElement('div');
        out.style.cssText='position:fixed;left:8px;bottom:8px;font:11px monospace';
        document.body.appendChild(out);
      }
      (function tick(){
        f.mo=0; f.mv=0;
        if(i<=steps){
          var t=i/24, nx=(-0.25+1.5*t)*w, ny=h*0.55;
          f.dx=i?nx-f.cx:0; f.dy=0; f.cx=nx; f.cy=ny; f.seen=1;
        } else {                       /* finger lifted — let it settle */
          f.dx=0; f.dy=0; f.cx=-1e4; f.cy=-1e4; f.seen=0;
        }
        f.on=true;
        paint(0.25);
        if(out) out.setAttribute('data-settle',
          [i,Math.sqrt(f.mo).toFixed(3),Math.sqrt(f.mv).toFixed(4)].join(','));
        if(++i<=steps+settle) setTimeout(tick,16);
      })();
      return;
    }
    var io=window.IntersectionObserver ? new IntersectionObserver(function(e){visible=e[0].isIntersecting;}) : null;
    if(io)io.observe(cv);

    /* Track the pointer whenever it is over the mark or just outside it, so a
       swipe that crosses the logo is already moving when it arrives. Listening
       on the document means the anchor's own hit box doesn't limit the reach. */
    if(window.matchMedia('(hover:hover) and (pointer:fine)').matches){
      document.addEventListener('pointermove',function(e){
        var r=cv.getBoundingClientRect(); if(!r.width)return;
        var m=r.height*0.9;                            /* a margin of approach */
        if(e.clientX<r.left-m||e.clientX>r.right+m||e.clientY<r.top-m||e.clientY>r.bottom+m){
          if(fx)fx.seen=0;
          return;
        }
        var f=wake(), sx=w/r.width, sy=h/r.height;
        var nx=(e.clientX-r.left)*sx, ny=(e.clientY-r.top)*sy;
        f.dx=f.seen?nx-f.cx:0; f.dy=f.seen?ny-f.cy:0;  /* the swipe, in mask px */
        f.cx=nx; f.cy=ny; f.on=true; f.seen=1;
      },{passive:true});
      document.addEventListener('pointerleave',function(){ if(fx)fx.seen=0; },{passive:true});
    }
    document.addEventListener('visibilitychange',function(){ if(!document.hidden)last=0; });
    addEventListener('resize',function(){size();});
    var dbg=/[?&]markdebug=1/.test(location.search), tag=null;
    if(dbg){
      tag=document.createElement('div');
      tag.style.cssText='position:fixed;left:8px;bottom:8px;z-index:9999;font:11px monospace;'+
        'background:#161511;color:#EFEDE6;padding:4px 7px;letter-spacing:.08em';
      document.body.appendChild(tag);
    }
    var frames=0, peak=0;
    (function loop(t){
      requestAnimationFrame(loop);
      if(document.hidden||!visible)return;
      /* run at 60 while the surface is still moving, back to 24 once it settles */
      var live=!!(fx&&fx.on);
      if(t-last < 1000/(live?FPS_LIVE:FPS))return;
      last=t; frames++;
      var p=(t%PERIOD)/PERIOD; lastP=p;
      if(fx&&fx.on){
        if(!fx.seen){ fx.dx*=0.8; fx.dy*=0.8; fx.cx=-1e4; fx.cy=-1e4; }
        fx.mo=0; fx.mv=0;
        paint(p);
        /* asleep once nothing is more than a fifth of a pixel out of place and
           nothing is still moving — measured, not guessed, so it always stops */
        if(!fx.seen&&Math.sqrt(fx.mo)<PHY.still&&Math.sqrt(fx.mv)<PHY.slow){
          fx.on=false; fx.ox.fill(0); fx.oy.fill(0); fx.vx.fill(0); fx.vy.fill(0);
          paint(p);
        }
      } else paint(p);
      if(tag){
        var mx=0; if(fx){for(var q=0;q<fx.ox.length;q++){var m=Math.abs(fx.ox[q])+Math.abs(fx.oy[q]); if(m>mx)mx=m;}}
        tag.textContent='phase '+p.toFixed(3)+'  frames '+frames+'  fps~'+Math.round(frames/(t/1000))+
          '  push '+mx.toFixed(1)+'px  '+(fx&&fx.on?'live':'idle');
        if(mx>peak)peak=mx;
        tag.setAttribute('data-push',mx.toFixed(2));
        tag.setAttribute('data-peak',peak.toFixed(2));
        tag.setAttribute('data-fx',fx?[(fx.mo?Math.sqrt(fx.mo):0).toFixed(2),
          (fx.mv?Math.sqrt(fx.mv):0).toFixed(3),fx.seen].join(','):'none');
        tag.setAttribute('data-live',fx&&fx.on?'1':'0');
      }
    })(0);
  }
  /* The tab icon is the same blob, one M of it, oozing on its own short loop.
     Frames are drawn once into data URLs and then swapped on a timer — the
     way the icon can be animated at all — rather than repainting live. */
  function favicon(){
    var link=document.querySelector('link[rel="icon"]');
    if(!link||!window.requestAnimationFrame)return;
    var S=64, N=18, PERIOD=5200;
    /* ⛳ 21 Sep: the blob is drawn into SAFE of the canvas and centred, not
       edge-to-edge. Google circle-masks the favicon in its search results and
       was slicing the M's corners off. make_favicon.py pads the static PNGs
       by the same fraction — this has to match it, or the icon visibly jumps
       size the moment this script takes over from the PNG. */
    var SAFE=.84, INNER=Math.round(S*SAFE), OFF=Math.round((S-INNER)/2);
    var scratch={a:document.createElement('canvas'),b:document.createElement('canvas')};
    var out=document.createElement('canvas'); out.width=out.height=S;
    var og=out.getContext('2d');
    var k=INNER/300, c={};
    for(var key in CFG)c[key]=CFG[key];
    /* One M alone has to stay an M at 32px. At the mark's own settings the
       swell closes the notch on part of the cycle and the letter reads as an
       H, which does not matter when there are two of them side by side and
       matters a great deal in a tab. Deeper notch, less swell, slightly
       thinner — the ooze survives, the letter never does. */
    c.apex=.78; c.bulge=.26; c.r=30;
    c.r=c.r*k; c.wob=CFG.wob*k; c.goo=CFG.goo;
    var still=window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var frames=[], i;
    for(i=0;i<(still?1:N);i++){
      og.clearRect(0,0,S,S);
      og.drawImage(buildMask(INNER,INNER,c,i/N,scratch,null,true),OFF,OFF);
      og.globalCompositeOperation='source-in';
      og.fillStyle=INK; og.fillRect(0,0,S,S);
      og.globalCompositeOperation='source-over';
      frames.push(out.toDataURL('image/png'));
    }
    link.type='image/png';
    link.href=frames[0];
    if(frames.length<2)return;
    var f=0;
    setInterval(function(){
      if(document.hidden)return;              /* nothing to see in a hidden tab */
      f=(f+1)%frames.length;
      link.href=frames[f];
    }, Math.round(PERIOD/N));
  }
  function boot(){
    var cv=document.querySelector('canvas.mark');
    if(cv)init(cv);
    favicon();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
