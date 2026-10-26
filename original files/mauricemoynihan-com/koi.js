/* koi.js — ⛳ 14 Oct 2026: ON A PHONE THE TOP OF THE HOMEPAGE IS A POND.
   His idea: "a relaxing top down view of a koi fish swimming around with ripples that you can
   interact with, like one of those old first generation iphone relaxation apps". The page itself
   is the water: it still looks like the paper, a painted koi drifts underneath it, a finger
   makes ripples, and the ripples bend the liquid name as they pass through it. The deep sea at
   the bottom of the page is the same water further down.

   How it is drawn (WebGL2, one canvas behind the page's own text):
   1. the floor — paper, the koi's soft shadow, the koi (hazed toward the paper the deeper it is)
      — into a texture;
   2. the surface — a height field run on the CPU (a plain wave equation, 3px cells), sampled for
      its slope; the floor is looked up through that slope (refraction), shaded, given a glint,
      and the name's ink is laid on top, pushed about by the same slope.
   The DOM name canvas (liquid.js) keeps drawing; it is only hidden and copied in when it changes.
   The menu and the sentence stay real text on top.

   Phones only (touch, ≤768px). ?koi=1 forces it anywhere (mouse drags make ripples), ?koi=0 off.
   Off with reduced motion and without WebGL2 — the page is simply the page then. */
(function(){
  var cv=document.getElementById('pond'); if(!cv)return;
  var q=location.search, force=/[?&]koi=1/.test(q);
  if(/[?&]koi=0/.test(q))return;
  var phone=matchMedia('(max-width:768px)').matches&&!matchMedia('(hover:hover) and (pointer:fine)').matches;
  if(!force&&(!phone||matchMedia('(prefers-reduced-motion:reduce)').matches))return;
  var gl=cv.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:true});
  if(!gl)return;

  var PAPER=[239/255,237/255,230/255], INK=[22/255,21/255,17/255];
  var CELL=3;            // css px per ripple cell
  var DAMP=.978;         // ripple loss per step (60 steps a second)
  var SLOPE=2, REFRACT=9, SHADE=.45, SPEC=.24;   // the look of the surface
  var NAME_SWAY=.9;      // how far the floating ink is pushed by a ripple, against the floor

  /* ---------- gl plumbing ---------- */
  function sh(type,src){ var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)); return s; }
  function prog(vs,fs){ var p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,vs)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
    var u={}, n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS); for(var i=0;i<n;i++){ var a=gl.getActiveUniform(p,i); u[a.name]=gl.getUniformLocation(p,a.name); }
    return {p:p,u:u}; }

  var FISH_VS='#version 300 es\nin vec2 aPos;in vec2 aUv;uniform vec2 uSize;uniform vec2 uOff;out vec2 vUv;'+
    'void main(){vec2 p=(aPos+uOff)/uSize;gl_Position=vec4(p.x*2.-1.,p.y*2.-1.,0.,1.);vUv=aUv;}';
  /* mode 0: the fish, premultiplied, hazed toward the paper and softened with depth.
     mode 1: its shadow on the floor — the alpha read from a blurry mip, in ink. */
  var FISH_FS='#version 300 es\nprecision mediump float;in vec2 vUv;uniform sampler2D uTex;uniform float uMode,uHaze,uAlpha,uBias;'+
    'uniform vec3 uPaper,uInk;out vec4 o;'+
    'void main(){if(uMode>.5){float a=0.;for(int i=0;i<8;i++){float t=float(i)*.785;a+=texture(uTex,vUv+vec2(cos(t)*.05,sin(t)*.02),uBias).a;}'+
    'a=(a*.125*.6+texture(uTex,vUv,uBias).a*.4)*uAlpha;o=vec4(uInk*a,a);return;}'+
    'vec4 c=texture(uTex,vUv,uBias);c.rgb=mix(c.rgb,uPaper*c.a,uHaze);o=c*uAlpha;}';
  var SURF_VS='#version 300 es\nout vec2 vUv;void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));'+
    'gl_Position=vec4(p*2.-1.,0.,1.);vUv=vec2(p.x,1.-p.y);}';
  var SURF_FS='#version 300 es\nprecision highp float;in vec2 vUv;'+
    'uniform sampler2D uScene,uH,uName;uniform vec2 uSize,uHTex;uniform float uCell,uSlope,uRefract,uShade,uSpec,uSway,uNameOn;'+
    'uniform vec4 uNameR;out vec4 o;'+
    'void main(){vec2 p=vUv*uSize;vec2 t=1./uHTex;vec2 h=(p/uCell+.5)*t;'+
    'vec2 t2=t*1.5;float hl=texture(uH,h-vec2(t2.x,0.)).r,hr=texture(uH,h+vec2(t2.x,0.)).r,hu=texture(uH,h-vec2(0.,t2.y)).r,hd=texture(uH,h+vec2(0.,t2.y)).r;'+
    'vec3 n=normalize(vec3(-(hr-hl)*uSlope,-(hd-hu)*uSlope,1.));vec2 off=n.xy*uRefract;'+
    'vec3 col=texture(uScene,clamp((p+off)/uSize,0.,1.)).rgb;'+
    'vec3 L=normalize(vec3(-.45,-.6,.66));col*=1.+(dot(n,L)-L.z)*uShade;'+
    'vec3 H=normalize(L+vec3(0.,0.,1.));col+=max(pow(max(dot(n,H),0.),90.)-pow(H.z,90.),0.)*uSpec;'+
    'if(uNameOn>.5){vec2 nu=(p+off*uSway-uNameR.xy)/uNameR.zw;'+
    'if(nu.x>0.&&nu.y>0.&&nu.x<1.&&nu.y<1.){vec4 k=texture(uName,nu);col=col*(1.-k.a)+k.rgb;}}'+
    'o=vec4(col,1.);}';

  var P_FISH, P_SURF;
  try{ P_FISH=prog(FISH_VS,FISH_FS); P_SURF=prog(SURF_VS,SURF_FS); }catch(e){ return; }
  var vbo=gl.createBuffer(), vao=gl.createVertexArray();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  var aPos=gl.getAttribLocation(P_FISH.p,'aPos'), aUv=gl.getAttribLocation(P_FISH.p,'aUv');
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,16,0);
  gl.enableVertexAttribArray(aUv); gl.vertexAttribPointer(aUv,2,gl.FLOAT,false,16,8);
  var empty=gl.createVertexArray();

  function tex(filter){ var t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter||gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return t; }
  var tScene=tex(), tH=tex(), tName=tex(), fbo=gl.createFramebuffer();

  /* ---------- layout ---------- */
  var W=0,H=0,dpr=1,gw=0,gh=0,A,B,nameR=[0,0,1,1],menuTop=0,egg=document.querySelector('.egg'),menu=document.getElementById('menu');
  var liq=document.querySelector('.hero__liquid');
  function layout(){
    var w=document.documentElement.clientWidth, h=Math.round(egg?egg.getBoundingClientRect().top+scrollY:innerHeight);
    if(w!==W||Math.abs(h-H)>2){
      W=w; H=h;
      dpr=Math.min(window.devicePixelRatio||1,2,Math.sqrt(1.4e6/(W*H)));
      cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr);
      cv.style.width=W+'px'; cv.style.height=H+'px';
      gl.bindTexture(gl.TEXTURE_2D,tScene); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,cv.width,cv.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tScene,0);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gw=Math.ceil(W/CELL)+2; gh=Math.ceil(H/CELL)+2; A=new Float32Array(gw*gh); B=new Float32Array(gw*gh);
      gl.bindTexture(gl.TEXTURE_2D,tH); gl.texImage2D(gl.TEXTURE_2D,0,gl.R16F,gw,gh,0,gl.RED,gl.FLOAT,A);
      fish.forEach(function(f){ f.keepIn(); });
    }
    if(liq){ var r=liq.getBoundingClientRect(); nameR=[r.left,r.top+scrollY,r.width,r.height]; }
    if(menu)menuTop=menu.getBoundingClientRect().top+scrollY;
  }

  /* ---------- the water ---------- */
  function poke(x,y,rad,amp){
    var cx=x/CELL, cy=y/CELL, r=rad/CELL, x0=Math.max(1,Math.floor(cx-r)), x1=Math.min(gw-2,Math.ceil(cx+r)),
        y0=Math.max(1,Math.floor(cy-r)), y1=Math.min(gh-2,Math.ceil(cy+r)), i,j,d;
    for(j=y0;j<=y1;j++)for(i=x0;i<=x1;i++){ d=Math.hypot(i-cx,j-cy)/r; if(d<1)A[j*gw+i]-=amp*(.5+.5*Math.cos(Math.PI*d)); }
  }
  /* a wave equation on two buffers. The last ~40px above the deep sea swallow ripples, so the
     water never reaches the dissolve with a hard edge; the sides absorb a little too. */
  var edge=null;
  function step(){
    var i,j,k,n=gw, a=A, b=B;
    if(!edge||edge.length!==gw*gh){ edge=new Float32Array(gw*gh);
      var band=40/CELL, side=6;
      for(j=0;j<gh;j++)for(i=0;i<gw;i++){ var e=DAMP, fb=(gh-1-j)/band, fs=Math.min(i,gw-1-i)/side;
        if(fb<1)e*=.75+.25*fb; if(fs<1)e*=.9+.1*fs; edge[j*gw+i]=e; } }
    for(j=1;j<gh-1;j++){ k=j*n+1; for(i=1;i<n-1;i++,k++){ var nb=a[k-1]+a[k+1]+a[k-n]+a[k+n]; b[k]=(nb*.5-b[k])*edge[k]; b[k]+=(nb*.25-b[k])*.06; } }
    A=b; B=a;
  }

  /* ---------- the koi ---------- */
  function Fish(o){
    this.img=o.img; this.len=o.len; this.S=24; this.seg=o.len/(this.S-1);
    this.x=o.x; this.y=o.y; this.ang=o.ang; this.v=24; this.vt=24; this.cruise=o.cruise||24;
    this.ph=Math.random()*6; this.depth=.35; this.dt=.35; this.mode='wander'; this.until=0;
    this.px=new Float32Array(this.S); this.py=new Float32Array(this.S);
    for(var i=0;i<this.S;i++){ this.px[i]=this.x-Math.cos(this.ang)*this.seg*i; this.py[i]=this.y-Math.sin(this.ang)*this.seg*i; }
    this.verts=new Float32Array(this.S*2*4); this.gulp=4+Math.random()*6; this.pick();
  }
  Fish.prototype.m=function(){ return this.len*.35; };
  /* a little more often the open water round the name than the menu below it */
  Fish.prototype.pick=function(){ var m=this.m(), me=this, best=-1;
    for(var k=0;k<5;k++){   // a few candidates; keep the one furthest from the other fish
      var top=Math.random()<.45&&menuTop>2*m, x=m+Math.random()*(W-2*m), y=top?m*.6+Math.random()*(menuTop-m*.6):m+Math.random()*(H-2*m-40), far=1e9;
      fish.forEach(function(o){ if(o!==me)far=Math.min(far,Math.hypot(x-o.x,y-o.y),Math.hypot(x-o.tx,y-o.ty)); });
      if(far>best){ best=far; this.tx=x; this.ty=y; } } };
  Fish.prototype.keepIn=function(){ var m=this.m(); this.tx=Math.min(Math.max(this.tx,m),W-m); this.ty=Math.min(Math.max(this.ty,m),H-m-40); };
  Fish.prototype.update=function(dt,now){
    if(this.mode!=='wander'&&now>this.until){ this.mode='wander'; this.vt=this.cruise; this.dt=.2+Math.random()*.5; this.pick(); }
    /* food on the water beats wandering: make for the nearest pellet, come up to the surface, gulp it */
    if(this.mode!=='flee'&&food.length){
      /* his note: they piled on top of each other at the food. Each goes for a different pellet when there is more than one. */
      var best=null, bd=1e9, me=this, taken=fish.filter(function(f){ return f!==me&&f.mode==='feed'; }).map(function(f){ return f.prey; });
      food.forEach(function(p){ if(food.length>1&&taken.indexOf(p)>=0)return; var d=Math.hypot(p.x-me.x,p.y-me.y); if(d<bd){ bd=d; best=p; } });
      if(!best){ best=food[0]; bd=Math.hypot(best.x-me.x,best.y-me.y); } this.prey=best;
      this.mode='feed'; this.until=now+500; this.tx=best.x; this.ty=best.y; this.vt=Math.min(64,bd*.9+12); this.dt=.02;
      if(bd<8+this.len*.03){ food.splice(food.indexOf(best),1); poke(best.x,best.y,6,.6); this.gulp=2+Math.random()*3; ate(); }
    }
    var dx=this.tx-this.x, dy=this.ty-this.y, dist=Math.hypot(dx,dy);
    if(this.mode==='wander'&&dist<this.len*.4){ this.pick(); if(Math.random()<.3)this.dt=Math.random()*.8; }
    var ax=0, ay=0, me2=this; fish.forEach(function(o){ if(o===me2)return;
      for(var i=0;i<o.S;i+=4){ var ox=me2.x-o.px[i], oy=me2.y-o.py[i], od=Math.hypot(ox,oy), r=me2.len*.55;
        if(od<r&&od>0){ ax+=ox/od*(r-od); ay+=oy/od*(r-od); } } });
    if(this.mode!=='flee'){ dx+=ax*2.5; dy+=ay*2.5; }
    var want=Math.atan2(dy,dx), d=want-this.ang; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI;
    var turn=(this.mode==='flee'?3.2:this.mode==='feed'?2.4:1)*dt;
    this.ang+=Math.max(-turn,Math.min(turn,d*Math.min(1,dt*3)));
    this.v+=(this.vt-this.v)*Math.min(1,dt*(this.mode==='flee'?3:1.2));
    this.x+=Math.cos(this.ang)*this.v*dt; this.y+=Math.sin(this.ang)*this.v*dt;
    this.depth+=(this.dt-this.depth)*Math.min(1,dt*.6);
    this.ph+=dt*(2+this.v*.05);
    var px=this.px, py=this.py, s=this.seg; px[0]=this.x; py[0]=this.y;
    /* follow the leader, but no joint bends more than BEND: past that the strip's inside edge
       folds over itself and the picture slices into steps (seen on a fleeing turn) */
    var BEND=.11, qx=-Math.cos(this.ang), qy=-Math.sin(this.ang);
    for(var i=1;i<this.S;i++){ var ex=px[i]-px[i-1], ey=py[i]-py[i-1], el=Math.hypot(ex,ey)||1; ex/=el; ey/=el;
      var cr=qx*ey-qy*ex, dt0=qx*ex+qy*ey, an=Math.atan2(cr,dt0);
      if(an>BEND||an<-BEND){ an=an>0?BEND:-BEND; var c=Math.cos(an), sn=Math.sin(an); ex=qx*c-qy*sn; ey=qx*sn+qy*c; }
      px[i]=px[i-1]+ex*s; py[i]=py[i-1]+ey*s; qx=ex; qy=ey; }
    /* near the top it noses the surface: a gulp every few seconds, and a faint wake while it swims */
    if(this.depth<.18){ this.gulp-=dt; if(this.gulp<0){ this.gulp=3+Math.random()*7;
        poke(this.x+Math.cos(this.ang)*3,this.y+Math.sin(this.ang)*3,6,.6); } }
    /* deeper down it lets go of a few bubbles now and then; they rise and pop on the surface */
    /* his note: "a bit more obvious" — bigger, more of them, more often, from the mouth at any depth */
    this.bub=(this.bub===undefined?2+Math.random()*3:this.bub)-dt; if(this.bub<0){ this.bub=3+Math.random()*4;
        var mx=this.x+Math.cos(this.ang)*4, my=this.y+Math.sin(this.ang)*4;
        for(var b=0,nb=2+Math.floor(Math.random()*3);b<nb;b++) bubbles.push({x:mx+(Math.random()-.5)*8,y:my+(Math.random()-.5)*8,born:now+b*(160+Math.random()*240),life:1300+Math.random()*1300,s:6+Math.random()*5}); }
    if(this.depth<.45&&this.v>12) poke(px[3],py[3],5,this.v*.0016*(1-this.depth*2));
  };
  /* the body as a strip down the spine. The swim is a travelling wave that grows toward the tail. */
  Fish.prototype.mesh=function(){
    var S=this.S, px=this.px, py=this.py, v=this.verts, hw=this.len*this.img.aspect*.5,
        amp=this.len*(.035+.04*Math.min(this.v/90,1)), k=0;
    for(var i=0;i<S;i++){
      var a=Math.max(i-1,0), b=Math.min(i+1,S-1), tx=px[a]-px[b], ty=py[a]-py[b], tl=Math.hypot(tx,ty)||1;
      tx/=tl; ty/=tl; var nx=-ty, ny=tx, f=i/(S-1), lat=amp*Math.sin(this.ph-i*.36)*Math.pow(f,1.6);
      var cx=px[i]+nx*lat, cy=py[i]+ny*lat;
      v[k++]=cx-nx*hw; v[k++]=cy-ny*hw; v[k++]=0; v[k++]=f;
      v[k++]=cx+nx*hw; v[k++]=cy+ny*hw; v[k++]=1; v[k++]=f;
    }
    return v;
  };
  /* is (x,y) on the body? The spine down to the start of the tail, a finger's width either side. */
  Fish.prototype.hit=function(x,y){ var r=this.len*.11+16, n=Math.ceil(this.S*.75);
    for(var i=0;i<n;i++) if(Math.hypot(x-this.px[i],y-this.py[i])<r)return true; return false; };
  Fish.prototype.scare=function(x,y,now){
    var d=Math.hypot(x-this.x,y-this.y);
    if(d<this.len*.9){ this.mode='flee'; this.until=now+1400; this.vt=230; this.dt=.85;
      var a=Math.atan2(this.y-y,this.x-x), m=this.m();
      this.tx=Math.min(Math.max(this.x+Math.cos(a)*W,m),W-m); this.ty=Math.min(Math.max(this.y+Math.sin(a)*H,m),H-m-40);
    }
  };

  /* ---------- touch ---------- */
  /* ⛔ look the tracker up when an event happens, not now: koi.js runs before track.js defines it, so a
     copy taken here was a no-op and no koi event reached GA on the first night (found 15 Oct). */
  var fish=[], taps=0, lastMove=null, T=function(n){ if(window.mmTrack)window.mmTrack(n); };
  /* ⛳ His ask: "is there any way we could let people feed the fish?" A tap on open water drops a
     pinch of food — a few pellets that float — and the koi come up and take them one by one. */
  var food=[], fed=0, bubbles=[];
  function feed(x,y,now){
    var n=3+Math.floor(Math.random()*3);
    for(var i=0;i<n;i++){ var a=Math.random()*6.283, r=4+Math.random()*16;
      food.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r,born:now,s:5.5+Math.random()*2,ph:Math.random()*6.283});
      poke(x+Math.cos(a)*r,y+Math.sin(a)*r,4,.3); }
    while(food.length>18)food.shift();
  }
  function ate(){ fed++; if(fed===1)T('koi_fed'); if(fed===25)T('koi_fed_25'); }
  function local(cx,cy){ return [cx,cy+scrollY]; }
  /* ⛳ His note: a fish under a menu row took you to that page when you tapped it — clunky. A tap that
     lands ON a fish belongs to the fish: it bolts and the click underneath is cancelled. Anywhere else
     the row opens as normal, and the fish has gone by the next tap. */
  var fishTap=null;
  document.addEventListener('click',function(e){
    if(fishTap&&performance.now()-fishTap.t<800&&Math.hypot(e.clientX-fishTap.x,e.clientY-fishTap.y)<40){
      e.preventDefault(); e.stopPropagation(); }
    fishTap=null; },true);
  /* a tap on a fish is a proper splash; food is light, so feeding is about a quarter of that plus faint plinks (his note: halving still looked the same) */
  function down(cx,cy){ var p=local(cx,cy); if(p[1]>H)return; lastMove=p;
    var now=performance.now();
    if(fish.some(function(f){ return f.hit(p[0],p[1]); })){ fishTap={x:cx,y:cy,t:now}; T('koi_touched');
      poke(p[0],p[1],15,2.4); fish.forEach(function(f){ f.scare(p[0],p[1],now); }); }
    else { poke(p[0],p[1],9,.55); feed(p[0],p[1],now); }
    taps++; if(taps===1)T('koi_tap'); if(taps===10)T('koi_tap_10'); if(taps===50)T('koi_tap_50'); }
  function move(cx,cy){ var p=local(cx,cy); if(p[1]>H)return;
    if(lastMove&&Math.hypot(p[0]-lastMove[0],p[1]-lastMove[1])<6)return; poke(p[0],p[1],12,.9); lastMove=p;
    var now=performance.now(); fish.forEach(function(f){ if(Math.hypot(p[0]-f.x,p[1]-f.y)<f.len*.6)f.scare(p[0],p[1],now); }); }
  document.addEventListener('touchstart',function(e){ for(var i=0;i<e.changedTouches.length;i++){ var t=e.changedTouches[i]; down(t.clientX,t.clientY); } },{passive:true});
  document.addEventListener('touchmove',function(e){ var t=e.touches[0]; if(t)move(t.clientX,t.clientY); },{passive:true});
  if(force&&!phone){
    document.addEventListener('mousedown',function(e){ down(e.clientX,e.clientY); });
    document.addEventListener('mousemove',function(e){ if(e.buttons&1)move(e.clientX,e.clientY); });
  }

  /* ---------- frames ---------- */
  var nameFrames=-1, live=false, last=0, acc=0;
  function uploadName(){
    if(!liq||!liq.width)return false;
    var s=window.LiquidName&&LiquidName.stats?LiquidName.stats().frames:-2;
    if(s===nameFrames&&s!==-2)return true; nameFrames=s;
    gl.bindTexture(gl.TEXTURE_2D,tName); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,liq); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    return true;
  }
  function draw(){
    var u=P_FISH.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo); gl.viewport(0,0,cv.width,cv.height);
    gl.clearColor(PAPER[0],PAPER[1],PAPER[2],1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(P_FISH.p); gl.bindVertexArray(vao);
    gl.uniform2f(u.uSize,W,H); gl.uniform3fv(u.uPaper,PAPER); gl.uniform3fv(u.uInk,INK); gl.uniform1i(u.uTex,0);
    gl.activeTexture(gl.TEXTURE0);
    fish.forEach(function(f){
      gl.bindTexture(gl.TEXTURE_2D,f.img.tex);
      gl.bufferData(gl.ARRAY_BUFFER,f.mesh(),gl.DYNAMIC_DRAW);
      var d=f.depth;
      gl.uniform1f(u.uMode,1); gl.uniform2f(u.uOff,7+16*d,11+22*d); gl.uniform1f(u.uAlpha,.12-.05*d); gl.uniform1f(u.uBias,2.2+1.2*d);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,f.S*2);
      gl.uniform1f(u.uMode,0); gl.uniform2f(u.uOff,0,0); gl.uniform1f(u.uAlpha,1); gl.uniform1f(u.uBias,d*1.4);
      gl.uniform1f(u.uHaze,.1+.42*d);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,f.S*2);
    });
    if(food.length&&tFood){
      var fv=new Float32Array(food.length*24), k=0;
      food.forEach(function(p){ var h=p.s/2, x0=p.x-h, x1=p.x+h, y0=p.y-h, y1=p.y+h;
        [x0,y0,0,0, x1,y0,1,0, x0,y1,0,1, x1,y0,1,0, x1,y1,1,1, x0,y1,0,1].forEach(function(v){ fv[k++]=v; }); });
      gl.bindTexture(gl.TEXTURE_2D,tFood); gl.bufferData(gl.ARRAY_BUFFER,fv,gl.DYNAMIC_DRAW);
      gl.uniform1f(u.uMode,1); gl.uniform2f(u.uOff,1.5,2.5); gl.uniform1f(u.uAlpha,.35); gl.uniform1f(u.uBias,1);
      gl.drawArrays(gl.TRIANGLES,0,food.length*6);
      gl.uniform1f(u.uMode,0); gl.uniform2f(u.uOff,0,0); gl.uniform1f(u.uAlpha,1); gl.uniform1f(u.uBias,0); gl.uniform1f(u.uHaze,0);
      gl.drawArrays(gl.TRIANGLES,0,food.length*6);
    }
    var now=performance.now(), live_b=bubbles.filter(function(b){ return now>=b.born; });
    if(live_b.length&&tBub){
      var bv=new Float32Array(live_b.length*24), q=0;
      live_b.forEach(function(b){ var t=(now-b.born)/b.life, h=b.s/2*(.45+.55*Math.min(t*2.5,1)), x0=b.x-h, x1=b.x+h, y0=b.y-h, y1=b.y+h;
        [x0,y0,0,0, x1,y0,1,0, x0,y1,0,1, x1,y0,1,0, x1,y1,1,1, x0,y1,0,1].forEach(function(v){ bv[q++]=v; }); });
      gl.bindTexture(gl.TEXTURE_2D,tBub); gl.bufferData(gl.ARRAY_BUFFER,bv,gl.DYNAMIC_DRAW);
      gl.uniform1f(u.uMode,0); gl.uniform2f(u.uOff,0,0); gl.uniform1f(u.uAlpha,1); gl.uniform1f(u.uBias,0); gl.uniform1f(u.uHaze,0);
      gl.drawArrays(gl.TRIANGLES,0,live_b.length*6);
    }
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,cv.width,cv.height);
    gl.bindTexture(gl.TEXTURE_2D,tH); gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gw,gh,gl.RED,gl.FLOAT,A);
    /* read where the name is every frame: it is laid out after the webfont lands, and a rect taken
       before that squeezed the ink into the wrong box (seen on the first preview) */
    if(liq){ var r=liq.getBoundingClientRect(); nameR[0]=r.left; nameR[1]=r.top+scrollY; nameR[2]=r.width; nameR[3]=r.height; }
    var nameOn=uploadName();
    var s=P_SURF.u; gl.useProgram(P_SURF.p); gl.bindVertexArray(empty);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,tScene); gl.uniform1i(s.uScene,0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,tH); gl.uniform1i(s.uH,1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,tName); gl.uniform1i(s.uName,2);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(s.uSize,W,H); gl.uniform2f(s.uHTex,gw,gh); gl.uniform1f(s.uCell,CELL);
    gl.uniform1f(s.uSlope,SLOPE); gl.uniform1f(s.uRefract,REFRACT); gl.uniform1f(s.uShade,SHADE); gl.uniform1f(s.uSpec,SPEC);
    gl.uniform1f(s.uSway,NAME_SWAY); gl.uniform1f(s.uNameOn,nameOn?1:0); gl.uniform4fv(s.uNameR,nameR);
    gl.drawArrays(gl.TRIANGLES,0,3);
    if(!live&&nameOn){ live=true; document.documentElement.classList.add('koi-live'); }
  }
  function frame(now){
    requestAnimationFrame(frame);
    var dt=Math.min((now-(last||now))/1000,.05); last=now;
    if(document.hidden||scrollY>H+40)return;          // off screen: nothing moves, nothing draws
    for(var i=food.length-1;i>=0;i--){ var p=food[i]; p.x+=Math.sin(now*.0004+p.ph)*2.5*dt; p.y+=Math.cos(now*.0003+p.ph)*2*dt;
      if(now-p.born>45000)food.splice(i,1); }
    fish.forEach(function(f){ f.update(dt,now); });
    for(var j=bubbles.length-1;j>=0;j--){ var bb=bubbles[j], age=now-bb.born; if(age<0)continue;
      bb.x+=Math.sin(now*.003+j)*4*dt; if(age>bb.life){ poke(bb.x,bb.y,5,.45); bubbles.splice(j,1); } }
    acc+=dt; var n=0; while(acc>=1/60&&n<3){ step(); acc-=1/60; n++; } if(n===3)acc=0;
    draw();
  }

  /* ---------- art ---------- */
  /* a bubble: white on the bone page vanishes, so it is drawn like the rest of the art — an ink rim,
     a milky inside, a curl of light on the upper left */
  var tBub=(function(){ var c=document.createElement('canvas'); c.width=c.height=32; var g=c.getContext('2d');
    g.fillStyle='rgba(255,255,255,.55)'; g.beginPath(); g.arc(16,16,12.5,0,7); g.fill();
    g.lineWidth=1.8; g.strokeStyle='rgba(22,21,17,.38)'; g.stroke();
    g.lineWidth=2; g.strokeStyle='#fff'; g.beginPath(); g.arc(16,16,8.5,3.5,4.9); g.stroke();
    g.fillStyle='#fff'; g.beginPath(); g.arc(20.5,20,1.6,0,7); g.fill();
    var t=tex(gl.LINEAR_MIPMAP_LINEAR); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.generateMipmap(gl.TEXTURE_2D); return t; })();
  /* a food pellet, painted here rather than loaded: warm brown, an ink rim, one highlight */
  var tFood=(function(){ var c=document.createElement('canvas'); c.width=c.height=32; var g=c.getContext('2d');
    var gr=g.createRadialGradient(12,11,1,16,16,13); gr.addColorStop(0,'#d99a52'); gr.addColorStop(1,'#7c4219');
    g.fillStyle=gr; g.beginPath(); g.arc(16,16,12,0,7); g.fill(); g.lineWidth=2.5; g.strokeStyle='#161511'; g.stroke();
    g.fillStyle='rgba(255,246,230,.75)'; g.beginPath(); g.arc(12,11,2.8,0,7); g.fill();
    var t=tex(gl.LINEAR_MIPMAP_LINEAR); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.generateMipmap(gl.TEXTURE_2D); return t; })();
  function load(src,cb){ var im=new Image(); im.onload=function(){
      var t=tex(gl.LINEAR_MIPMAP_LINEAR); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
      gl.generateMipmap(gl.TEXTURE_2D); cb({tex:t,aspect:im.width/im.height}); };
    im.onerror=function(){ cb(null); }; im.src=src; }
  var srcs=[cv.getAttribute('data-src'),cv.getAttribute('data-src2')].filter(Boolean), got=[];
  srcs.forEach(function(s,i){ load(s,function(img){ got[i]=img||0; if(got.filter(function(x){return x!==undefined;}).length<srcs.length)return;
    layout();
    var a=got[0]||got[1]; if(!a)return;
    /* koi_a: the yellow and black (Ki Utsuri; the Showa's pinched tail looked wrong to him). koi_b: the butterfly, longer for its fins */
    fish.push(new Fish({img:a,len:Math.min(165,W*.42),x:W*.3,y:H*.55,ang:-1.2,cruise:26}));
    if(got[1])fish.push(new Fish({img:got[1],len:Math.min(185,W*.47),x:W*.75,y:H*.25,ang:2.4,cruise:20}));
    window.__koi={fish:fish,poke:poke,layout:layout,food:food,feed:feed};
    requestAnimationFrame(frame);
  }); });
  addEventListener('resize',function(){ if(W)layout(); });
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){ if(W)layout(); });
})();
