/* The hero name as liquid ink: MAURICE MOYNIHAN drawn with the MM's pen.
   Same technique as mark.js — circles unioned along each letter's skeleton,
   blurred and thresholded so nothing is ever sharp, oozing on the same
   18-second loop and shoved about by the cursor on the same wave equation.
   The <h1> keeps the words; this only carries the pixels (html.liquid-live
   makes the type transparent, and only once a canvas has actually painted).
   ⛔ CFG and PHY are COPIES of mark.js's — it keeps them private. Change one
   there and change it here, or the name and the mark stop being one hand.
   Letterforms are authored and proved in _liquidname.html (the scratch rig,
   never deployed), which draws with THIS file through window.LiquidCore —
   stills at a chosen phase, counters and letter gaps measured over the
   cycle, the real mark.js MM alongside at the same size.
   ⛳ 5 Oct: the pen's swell, wobble, terminals and pinch now run on arc
   length in letter heights, calibrated to the M, instead of on the fraction
   of the stroke — see shape(). Before that every stroke shorter than the M
   beaded ("balls stitched together"); the M itself is bit-identical.
   ⛳ COST. Drawing the circles is ~1ms. Everything else is the blur and the
   read-back of the whole canvas through getImageData, and that scales with
   the canvas AREA, not with the text: measured 4 Oct at 50ms per megapixel in
   Maurice's own Chrome. So the buffer is capped by area (BUDGET), exactly as
   mark.js caps its own, and the resolution follows from that — not from
   devicePixelRatio. See size(). */
(function () {
  "use strict";
  var CFG = {
    r: 34,
    bulge: 0.32,
    f1: 1.4,
    f2: 2.3,
    term: 0.34,
    wob: 9,
    apex: 0.62,
    mw: 0.46,
    pinch: 0.12,
    goo: 7,
  };
  var PHY = {
    reach: 55,
    push: 8,
    carry: 0.16,
    dip: 0.3,
    still: 0.2,
    slow: 0.05,
    max: 0.85,
    flat: 0.006,
    couple: 0.28,
    sub: 4,
    damp: 0.9845,
  };
  var INK = "#161511",
    PERIOD = 18000,
    FPS = 24,
    FPS_LIVE = 60,
    PI = Math.PI;

  /* The MM's letter box, derived from mark.js's numbers so it cannot go
     stale: one M is 1.247 times wider than tall, drawn with a pen whose
     radius is .1885 of the letter height. Those two ratios are the hand. */
  var _h = 300 + 68 * PHY.max,
    _pad = CFG.r * ((1 + CFG.bulge + CFG.term) * 1.06 + PHY.max);
  var REF_H = _h - 2 * _pad,
    REF_W = ((_h * 298) / 160 - 2 * _pad) * CFG.mw,
    MW = REF_W / REF_H;
  var UNIT = {
    r: CFG.r / REF_H,
    wob: CFG.wob / REF_H,
    goo: (CFG.goo * _h) / 300 / REF_H,
  };
  /* ⛔ NOT the MM's pen, on purpose. At the mark's own weight the A is a
     solid triangle, the R loses its counter, the I is a bean and MAURICE
     stops reading from across the room. Two Ms get away with it because an M
     has no counter to lose. A sixth lighter is as heavy as the name can go
     and still read — same ink, same melt, pressed lighter. */
  /* ⛳ 4 Oct: TRACK .3 -> .18 and SPACE .6 -> .45. His note: the letters need to
   be closer together. ⛔ TIGHTENING DOES NOT MAKE THE NAME SMALLER — the line
   is fitted to the width, so closing the gaps scales the letters UP to fill
   the same measure. That is the point: same width, fatter letters, less air.
   ⛔ .14 IS THE FLOOR AND IT WAS MEASURED. Below that the swell (which adds up
   to +40% of the pen radius) closes the gaps completely and neighbouring
   letters fuse into one blob. .18 leaves it a margin.
   ⛳ 5 Oct, MEASURED (the rig's ?gaps=1 counts blobs of ink per phase): at
   .18 and hero size the letters still TOUCH at the feet for most of the
   cycle — 7 to 9 separate blobs out of 15 letters at the worst phase, one
   line or two, and the same before the arc-length pen as after it. The
   feet are where the terminal bulb and the swell stack up. That is the
   tight lockup he asked for, not a bug; but it is the number to re-measure
   if TRACK ever moves. */
  var NAME_R = 0.16,
    NAME_BULGE = 0.28,
    TRACK = 0.18,
    SPACE = 0.45,
    LEAD = 0.4;
  /* how far apart in the ooze cycle two neighbouring letters sit (radians
     of seed; the first letter of a word — the M — keeps its old seed). ⛳ 5
     Oct, MEASURED and left at 2.7: on two bare stems a step near 5 opens
     the worst-phase gap by .05H (the wobble stops swaying neighbours
     towards each other), but in the real line (?pairs=1 at 1.3, 4, 4.5, 5,
     5.5) no step is better overall — each one just moves the touching to
     different pairs, and the A's feet are under water at every step. The
     knob stays because it is honest to the measurement; ?seedstep= on the
     rig tries another. */
  var SEEDSTEP = 2.7;

  function skel(x0, W, H, apex) {
    var A = H * apex;
    return [
      [x0, H],
      [x0, H * 0.16],
      [x0 + W * 0.11, 0],
      [x0 + W * 0.31, A * 0.55],
      [x0 + W * 0.5, A],
      [x0 + W * 0.69, A * 0.55],
      [x0 + W * 0.89, 0],
      [x0 + W, H * 0.16],
      [x0 + W, H],
    ];
  }
  function polylen(pts) {
    var t = 0;
    for (var i = 0; i < pts.length - 1; i++)
      t += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    return t;
  }
  function sample(pts, n) {
    var out = [],
      segs = [],
      tot = 0,
      i,
      d;
    for (i = 0; i < pts.length - 1; i++) {
      d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      segs.push(d);
      tot += d;
    }
    for (var k = 0; k <= n; k++) {
      var t = (k / n) * tot;
      i = 0;
      while (i < segs.length && t > segs[i]) {
        t -= segs[i];
        i++;
      }
      if (i >= segs.length) {
        out.push(pts[pts.length - 1].slice());
        continue;
      }
      var f = segs[i] ? t / segs[i] : 0;
      out.push([
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f,
      ]);
    }
    return out;
  }
  /* mark.js puts 160 samples on one M; the same density along every stroke */
  var DENS = 160 / polylen(skel(0, MW, 1, CFG.apex));

  /* ---- the letters ----
     A letter is an ARRAY of strokes: E, H, Y and A cannot be drawn without
     lifting the pen. Each stroke is a skeleton polyline in a unit box, x from
     0 to w, y from 0 (top) to 1 (baseline); the pen adds its radius outside
     the box, so the skeleton is the midline, never the outline.
       k      pen radius multiplier. Horizontals run lighter — two full-weight
              bars half a letter apart leave a slot .12 high and the letter
              becomes a brick. Every fat-face does this.
       ends   whether each end gets the terminal swell; 0 where an end dies
              inside another stroke, or a lump grows at the join.
       closed a loop (the O): no terminals, and whole-number swell and wobble
              frequencies so the seam is invisible.
       lsb/rsb side bearings in letter heights for sloped and round sides. */
  function S(pts, o) {
    o = o || {};
    return {
      pts: pts,
      k: o.k || 1,
      closed: !!o.closed,
      ends: o.ends || [1, 1],
      pin: o.pin || null,
      pd: o.pd || 1,
    };
  }
  function arc(cx, cy, rx, ry, a0, a1, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var a = a0 + ((a1 - a0) * i) / n;
      out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return out;
  }
  var GL = {
    /* ⛔ the M is skel() untouched. Any change to the M belongs in mark.js. */
    M: { w: MW, strokes: [S(skel(0, MW, 1, CFG.apex))] },
    /* ⛳ 5 Oct, MEASURED (the rig's ?holes=1, counter area over the cycle):
       at w 1.15, bar .68 the counter above the bar shut completely for a
       fifth of every cycle — both legs at full swell near the apex leave no
       room. Four things each open it a little and together keep it open at
       the worst phase (.029H², against the R's .094 and the O's .30): wider
       (1.22), the bar low like every fat-face (.76), the bar pressed lighter
       (.58), and a waist at the apex (pin .5, 2.5x the M's shoulder pinch)
       — the legs thin towards the point the way the M's thin at its
       shoulders. Moving the bar alone did nothing at the worst phase.
       ⛔ THE EXTRA WIDTH COMES OUT OF THE BEARINGS (-.095, was -.06 at
       1.15): the A's advance is unchanged, so the line fits the measure at
       the same letter height and the M stays pixel-identical. Let the
       advance grow and every letter, M included, shrinks by a hair. */
    /* ⛳ 5 Oct, THE FEET (ends .5 below, here and on I, R, N, H, Y, U, E):
       measured with the rig's ?pairs=1, the letters were overlapping at the
       baseline before the blur even touched them — HA by .117H, AN .083,
       RI .072, MA .056, IH .056 — and the I fused into N, H and C along its
       height at some phases ("NIH" read as a lump). The cause is the
       terminal bulb (x1.34) on top of the swell (x1.43) where two ends meet
       .40-.50H apart. Every end that faces a neighbour's stem is pressed
       to HALF a bulb (x1.17); free ends (C, O, U's left, E's arms) keep the
       full one and the M is untouched. After: HA -.061, AN -.028, MA -.011,
       and RI, IC, NI, IH all positive. ⛔ NOT 15 OF 15, AND IT CANNOT BE
       AT TRACK .18: with the bulbs REMOVED from every baseline end (tried)
       the worst phase is still 10 of 15 blobs, because the A's feet sit
       .405H from the H and N stems and two circles of this pen at peak
       swell span .46H before any bulb — only the track or a lighter pen
       separates them, and both are his call, not a letterform's. */
    A: {
      w: 1.22,
      lsb: -0.095,
      rsb: -0.095,
      strokes: [
        S(
          [
            [0, 1],
            [0.61, 0],
            [1.22, 1],
          ],
          { pin: [0.5], pd: 2.5, ends: [0.5, 0.5] },
        ),
        S(
          [
            [0.23, 0.76],
            [0.99, 0.76],
          ],
          { k: 0.58, ends: [0, 0] },
        ),
      ],
    },
    /* ⛳ arc() segment counts are FREE. The circles go down by arc length
       (DENS per letter height), not one per vertex, so a 64-point circle
       costs the same frame as a 12-point one — and a 12-point half circle
       put a visible corner in the U's bottom and the R's bowl. */
    U: {
      w: 0.78,
      strokes: [
        S(
          [
            [0, 0],
            [0, 0.5],
          ]
            .concat(arc(0.39, 0.5, 0.39, 0.5, PI, 0, 32))
            .concat([[0.78, 0]]),
          { ends: [1, 0.5] },
        ),
      ],
    },
    /* ⛳ 5 Oct, REDRAWN. The old R (bowl 0-.6 on a half-ellipse, leg from
       .48,.6) was the weakest letter: the bowl squat, the leg lost in the
       bowl's bottom at half the phases. Now a fat-face R: the bowl's right
       side runs down to .63, its underside CLIMBS back to the stem (.56) —
       that climb is what keeps the notch under the bowl open — and the leg
       leaves from the bowl's lower-right corner with a waist there (pin 0)
       so the three directions of circles do not lump. MEASURED (?holes=1,
       in the line): counter min .112H² (was .093), notch under the bowl
       min .20H wide on the .92 row (was .16). Same box, same advance. */
    R: {
      w: 0.82,
      strokes: [
        S(
          [
            [0, 0],
            [0, 1],
          ],
          { ends: [0.4, 1] },
        ) /* .4 at the top: a corner, the bowl starts there too */,
        S(
          [[0, 0]]
            .concat(arc(0.4, 0.34, 0.42, 0.34, -PI / 2, PI / 3, 32))
            .concat([[0, 0.56]]),
          { k: 0.86, ends: [0, 0] },
        ),
        S(
          [
            [0.61, 0.63],
            [0.82, 1],
          ],
          { ends: [0, 0.5], pin: [0], pd: 1 },
        ),
      ],
    },
    I: {
      w: 0,
      strokes: [
        S(
          [
            [0, 0],
            [0, 1],
          ],
          { ends: [0.5, 0.5] },
        ),
      ],
    },
    C: {
      w: 0.82,
      lsb: -0.03,
      rsb: -0.04,
      strokes: [S(arc(0.41, 0.5, 0.41, 0.5, -0.3 * PI, -1.7 * PI, 48))],
    },
    E: {
      w: 0.66,
      strokes: [
        S(
          [
            [0, 0],
            [0, 1],
          ],
          { ends: [0.4, 0.4] },
        ) /* both ends are corners the arms grow from */,
        S(
          [
            [0, 0],
            [0.66, 0],
          ],
          { k: 0.78, ends: [0, 0.5] },
        ),
        S(
          [
            [0, 0.5],
            [0.52, 0.5],
          ],
          { k: 0.78, ends: [0, 0.5] },
        ),
        S(
          [
            [0, 1],
            [0.66, 1],
          ],
          { k: 0.78, ends: [0, 0.5] },
        ),
      ],
    },
    O: {
      w: 0.9,
      lsb: -0.03,
      rsb: -0.03,
      strokes: [
        S(arc(0.45, 0.5, 0.45, 0.5, -PI / 2, 1.5 * PI, 64), { closed: true }),
      ],
    },
    Y: {
      w: 0.95,
      lsb: -0.08,
      rsb: -0.08,
      strokes: [
        S(
          [
            [0, 0],
            [0.475, 0.52],
            [0.95, 0],
          ],
          { ends: [0.5, 0.5] },
        ),
        S(
          [
            [0.475, 0.52],
            [0.475, 1],
          ],
          { ends: [0, 1] },
        ),
      ],
    },
    N: {
      w: 0.85,
      strokes: [
        S(
          [
            [0, 1],
            [0, 0],
            [0.85, 1],
            [0.85, 0],
          ],
          { ends: [0.5, 0.5] },
        ),
      ],
    },
    H: {
      w: 0.82,
      strokes: [
        S(
          [
            [0, 0],
            [0, 1],
          ],
          { ends: [0.5, 0.5] },
        ),
        S(
          [
            [0.82, 0],
            [0.82, 1],
          ],
          { ends: [0.5, 0.5] },
        ),
        S(
          [
            [0, 0.5],
            [0.82, 0.5],
          ],
          { k: 0.85, ends: [0, 0] },
        ),
      ],
    },
  };

  /* ---- layout ----
     Every line is fitted to the full width on its own, the way the phone CSS
     sets MAURICE larger than MOYNIHAN so the two lines are the same width.
     Everything is in letter heights until the last line so the fit is one
     division per line. The canvas height is whatever that comes to; the
     caller sizes the element from it. Returns buffer-pixel strokes. */
  function layout(text, Wc, o) {
    var r = o.r,
      lines = text.split("|"),
      L = [],
      i,
      j,
      ch,
      g,
      pen;
    var pad = r * ((1 + o.bulge + CFG.term) * 1.06 + PHY.max) - r + UNIT.wob;
    for (i = 0; i < lines.length; i++) {
      var row = [],
        wi = -1,
        ws = 0;
      pen = 0;
      for (j = 0; j < lines[i].length; j++) {
        ch = lines[i].charAt(j);
        if (ch === " ") {
          pen += o.space;
          wi = -1;
          continue;
        }
        g = GL[ch];
        if (!g) continue;
        pen += g.lsb || 0;
        /* the first letter of a word keeps the seed it always had — that is
           the M, and the M's seed is part of what proveM.js holds fixed. The
           letters after it step by SEEDSTEP from it (2.7 was the old step for
           every letter, so at 2.7 nothing here changes) — see SEEDSTEP. */
        if (wi < 0) wi = row.length;
        row.push({
          g: g,
          x: pen + r,
          seed:
            row.length === wi
              ? (L.length * 9 + row.length) * 2.7
              : ws + (o.seedstep || SEEDSTEP) * (row.length - wi),
          ch: ch,
        });
        if (row.length - 1 === wi) ws = row[wi].seed;
        pen += g.w + 2 * r + (g.rsb || 0) + o.track;
      }
      pen -= o.track;
      L.push({ row: row, w: pen, H: Wc / (pen + 2 * pad) });
    }
    var strokes = [],
      base = 0,
      y = 0,
      Hsum = 0,
      cap = -1,
      bl = 0;
    for (i = 0; i < L.length; i++) Hsum += L[i].H;
    var Hm = Hsum / L.length,
      lead = o.lead * Hm,
      head = (o.head || 0) * Hm;
    for (i = 0; i < L.length; i++) {
      /* head is the empty run above the first line that the scroll smear
         streaks into — see SMEAR */
      var H = L[i].H,
        x0 = pad * H,
        top = (i ? y : pad * H + head) + r * H,
        by = top + H;
      for (j = 0; j < L[i].row.length; j++) {
        var it = L[i].row[j],
          gx = x0 + H * it.x,
          gy = by - H;
        for (var s = 0; s < it.g.strokes.length; s++) {
          var st = it.g.strokes[s],
            pts = [],
            p;
          for (p = 0; p < st.pts.length; p++)
            pts.push([gx + st.pts[p][0] * H, gy + st.pts[p][1] * H]);
          /* len is the stroke's length in letter heights — shape() runs on it.
             (⛔ not "L": that is the lines array above, and var hoists.) */
          var len = polylen(pts) / H,
            cnt = Math.max(6, Math.round(len * DENS));
          var sp = sample(pts, cnt);
          strokes.push({
            k: st.k,
            closed: st.closed,
            ends: st.ends,
            spts: sp,
            n: sp.length,
            b: base,
            seed: it.seed + s * 1.1,
            H: H,
            L: len,
            pin: st.pin || PIN,
            pinch: st.pin ? st.pd : Math.max(0, Math.min(1, len - 2)),
            ch: it.ch,
            si: s,
            gx: gx,
            gy: gy,
          }); /* which letter, for the rig's counter probe */
          base += sp.length;
        }
      }
      if (cap < 0) cap = by - H;
      bl = by;
      y = by + r * H + (i < L.length - 1 ? lead : pad * H);
    }
    /* cap is the first line's cap height — the smear rises from it (see SMEAR) */
    /* bl is the last line's baseline — the letters stretch up from it (STRETCH) */
    return {
      strokes: strokes,
      N: base,
      height: y,
      H: Hm,
      pad: pad,
      head: head,
      cap: cap,
      bl: bl,
    };
  }
  /* the pen, per stroke: mark.js's shape() with k, ends and closed.
     ⛔⛔ THE MODULATION RUNS ON ARC LENGTH, NOT ON t. mark.js drives its
     swell, wobble, terminals and pinch by t = i/(n-1), the fraction of the
     stroke, and that is right for mark.js because it only ever draws one
     stroke: the M. Here t is poison. The M's stroke is 3.68 letter heights
     long (LM below), so 1.4 swell cycles across it is one slow undulation
     every 2.6 letter heights. A stem is 1.0 letter heights, A's crossbar is
     .71, Y's tail is .48. Run the same 1.4+2.3 cycles across those and they
     complete 4 to 8 times faster — the stem gets a waist, the bar bulges
     twice, every short stroke beads up. 5 Oct, his words: "balls stitched
     together". So every term below is in LETTER HEIGHTS along the stroke
     (s), scaled by LM so that on the M itself s/LM == t exactly and the M
     comes out bit-identical to mark.js — proved in node, every sample,
     several phases, before this shipped. One physical wavelength is now the
     same size on every stroke of every letter, which is what "the same pen"
     means. Do not "simplify" this back to t. */
  var LM = polylen(skel(0, MW, 1, CFG.apex)); /* 3.679 letter heights */
  var TERM_W = 0.1 * LM,
    PINCH_W = 0.13 * LM,
    PIN = [0.3, 0.7]; /* .37H bulb, .48H waist, mark.js's waist positions */
  var SH = [0, 0, 0, 0];
  function shape(st, i, c, ph) {
    var pt = st.spts[i],
      t = i / (st.n - 1),
      L = st.L,
      s = t * L,
      u = s / LM,
      seed = st.seed,
      term = 1,
      swell,
      wobp;
    var r = c.r * st.H,
      wob = c.wob * st.H;
    if (st.closed) {
      /* a loop has a seam to hide, so its cycles are whole numbers of the
         loop and stay on t: the O is 2.98H round, so its wavelength is
         within 15% of the M's anyway */
      swell =
        1 +
        c.bulge * Math.sin(t * PI * 2 + ph + seed) +
        c.bulge * 0.55 * Math.sin(t * 2 * PI * 2 + ph * 2 + seed * 1.9);
      wobp = t * 2 * PI * 2 + ph + seed;
    } else {
      /* terminal bulbs: the M's are .37H long measured from each end, so
         every end gets a bulb that size, not a tenth of whatever stroke it
         happens to sit on */
      term =
        1 +
        c.term * st.ends[0] * Math.exp(-Math.pow(s / TERM_W, 2)) +
        c.term * st.ends[1] * Math.exp(-Math.pow((L - s) / TERM_W, 2));
      swell =
        1 +
        c.bulge * Math.sin(u * c.f1 * PI * 2 + ph + seed) +
        c.bulge * 0.55 * Math.sin(u * c.f2 * PI * 2 + ph * 2 + seed * 1.9);
      wobp = u * 1.8 * PI * 2 + ph + seed;
    }
    /* pinch: waists along the stroke, each the M's .48H wide. mark.js puts
       two at .30 and .70 and on the M (measured) those land on the two outer
       shoulders — so it is really a corner de-lumper, where two directions
       of circles pile up. By default it is a feature of a stroke long enough
       to have shoulders: full strength on the M and N (3.3H+), fading out
       below 3H, gone by 2H; a stem or a bar does not get two dents in it. A
       stroke can instead say where ITS lump is (pin, pd) — the A's legs pile
       up at the apex and shut the counter, so its waist sits there. */
    var pa = st.pinch,
      pinch = 1,
      pin = st.pin,
      j;
    if (pa > 0) {
      var g = 0;
      for (j = 0; j < pin.length; j++)
        g += Math.exp(-Math.pow(((t - pin[j]) * L) / PINCH_W, 2));
      pinch = 1 - c.pinch * pa * g;
    }
    SH[2] = Math.max(0, r * st.k * swell * term * pinch);
    SH[0] = pt[0] + Math.sin(wobp) * wob;
    SH[1] = pt[1] + Math.cos(wobp) * wob;
    SH[3] =
      r; /* the bare pen, no k/swell/term/pinch — the honey thread is cut from it (thin) */
    return SH;
  }
  /* the ripple, per stroke: a dent travels along a stroke and stops at its
     ends, it does not jump to the next letter. Otherwise mark.js's water(). */
  function water(fx, b, n, lim) {
    var s, i, j, pm, pp;
    for (s = 0; s < PHY.sub; s++) {
      for (i = 0; i < n; i++) {
        j = b + i;
        pm = i > 0 ? fx.ox[j - 1] : fx.ox[j];
        pp = i < n - 1 ? fx.ox[j + 1] : fx.ox[j];
        fx.ax[j] = PHY.couple * (pm + pp - 2 * fx.ox[j]) - PHY.flat * fx.ox[j];
        pm = i > 0 ? fx.oy[j - 1] : fx.oy[j];
        pp = i < n - 1 ? fx.oy[j + 1] : fx.oy[j];
        fx.ay[j] = PHY.couple * (pm + pp - 2 * fx.oy[j]) - PHY.flat * fx.oy[j];
      }
      for (i = 0; i < n; i++) {
        j = b + i;
        fx.vx[j] = (fx.vx[j] + fx.ax[j]) * PHY.damp;
        fx.vy[j] = (fx.vy[j] + fx.ay[j]) * PHY.damp;
        fx.ox[j] += fx.vx[j]; // Move this point horizontally by its current velocity.
        fx.oy[j] += fx.vy[j];
        var m2 = fx.ox[j] * fx.ox[j] + fx.oy[j] * fx.oy[j];
        if (m2 > lim * lim) {
          var sc = lim / Math.sqrt(m2);
          fx.ox[j] *= sc;
          fx.oy[j] *= sc;
          fx.vx[j] *= sc;
          fx.vy[j] *= sc;
        }
        if (m2 > fx.mo) fx.mo = m2;
        var s2 = fx.vx[j] * fx.vx[j] + fx.vy[j] * fx.vy[j];
        if (s2 > fx.mv) fx.mv = s2;
      }
    }
  }
  /* ⛳ 5 Oct 3:40pm: THE LETTERS GIVE UP INK. His pick: as the streaks
     grow the letters thin, as if the paint is being pulled out of them —
     most at the top where the streaks leave, a little at the feet. thinNow
     is THIN x the smear, set by buildMask each frame; only the first line
     thins, because only the first line has streaks coming off it. At rest
     it is 0 and every circle is exactly what it was (the M lockup holds). */
  /* .2 -> .35, 5 Oct 7:40pm: "should the ink drain be more pronounced" — yes,
     once the streaks stopped thinning with it (probeRuns) */
  /* ⛳ 8:20pm: .35 -> .7, and the feet now thin nearly as much as the tops
     (THIN_FEET .35 -> .7). "it doesn't feel obvious enough that the ink is
     being sucked out" — at .35 with feet at 35% the bottom half of every
     letter barely changed, and that is where the eye judges a letter's
     weight. Measured at his 1728@2x: legible at full scroll, no stroke breaks. */
  var THIN = 0.7,
    THIN_FEET = 0.7,
    thinNow = 0,
    thinCap = -1;
  /* ⛳ 6 Oct: THE LETTERS DRAIN COMPLETELY — HONEY SNAPPING. His brief: by
     the end of the scroll the letters are gone and only the streaks are left,
     and it has to read as ink, physically ("ink doesn't fade"). The drain
     above (which he likes) simply keeps going: every stroke thins past 30%
     to a THREAD, the way honey pulled off a spoon goes to a filament; then,
     letter by letter, the thread lets go at the feet and the broken end
     springs UP the thread into the streak, carrying a bead of ink ahead of it
     (surface tension pulls a snapped filament back into a ball). Nothing
     slides sideways and nothing is wiped: what moves is a bead on a hair,
     and it moves up, into the streak, where the ink is seen to go.
     Three stages, all on the smear (sm, 0..1):
       drain   0 .. THREAD_AT   the 8:20pm thinning, 1.3x faster so it has
                                room, tops first and the feet catching up
                                (THIN_FEET eases to 1 from EVEN_FROM) so by
                                THREAD_AT every circle is the same thread.
                                The pen's swell, bulbs and waists are eased
                                out over the same run (a stretched filament
                                has no swell) — ⛔ this is what stops it
                                beading: see failure 1 below.
       thread  THREAD_AT        one bare pen radius x THREAD, the SAME for
                                bars (k<1) as for stems — at their own k the
                                E's arms and the A's bar fall under the
                                blur's threshold and vanish on their own.
       snap    SNAP_AT .. 1     per letter, starting at SNAP_AT + hash x
                                SNAP_SPREAD of the rest and all done by 1:
                                a front rises from under the feet to over
                                the top; circles below it are gone, circles
                                just above it are the bead (BEAD x thread,
                                BEAD_W letter heights long), on climbing
                                threads only — a flat run (bar, the bottom
                                of a bowl) lets go without one. The front
                                eases out (fast off the mark, settling into
                                the streak) — a recoil, not a wipe.
     ⛔ RENDERING LIMIT, MEASURED: the blur is .046H and the cut is at 50%,
     so a drawn radius under .031H shows NOTHING, and the visible width of a
     thread near that floor swings wildly with the radius. THREAD .25 (.04H
     drawn, about .06H = 5px seen at his 1728) is a hair that still holds.
     ⛔ ALREADY TRIED AND REJECTED (today, before this): 1. scaling every
     circle to zero in proportion — the waists go under the threshold before
     the bulbs and the name crumbled into static loose beads and shards.
     2. a smoothstep radius kill below a rising line, feet upward, on the
     full-weight letters — clean, but "ink doesn't fade": it read as a wipe.
     3. dragging each stroke bodily up into its nearest streak (x to the
     streak's centre, y up .6H, streaks grown) — the letters visibly slid
     and climbed: "ridiculous". The recoil here moves a bead, not a letter,
     and moves it up only.
     HONEY=0 restores the 8:20pm drain exactly (letters keep 30% at full
     scroll). probeRuns measures the streaks' drained widths with HONEY off
     on purpose: measured off fully drained letters they would all be at
     the width floor — the needle look. */
  /* ⛳ 6 Oct 9:15pm: THE SNAP IS OFF. His verdict on the full version: "the
     fable version is great but it's just weird when the words are totally
     gone and the streaks are there". So the drain ends at the thread — the
     name stays, written in a fine line under the streaks — and reaches it
     at full scroll (THREAD_AT 1), which also puts the pace back to the 8:20pm
     drain he approved. SNAP_AT .82 + THREAD_AT .82 brings the snap back. */
  /* ⛳ 7 Oct: UP AND OUT — THE SNAP IS BACK, AND THEN THE STREAKS LEAVE.
     His problem with the live version: "the MAURICE MOYNIHAN animation
     doesn't really have a finish or a resolve. it just kinda gets to the
     skinny part and ends." And with yesterday's snap-on version: "it's just
     weird when the words are totally gone and the streaks are there" — it
     ended on a held pose of streaks. No fade ("i don't like that and dont
     want to do it"; "ink doesn't fade"). Everything in this animation moves
     UP, so it resolves by leaving upward, in two more beats on top of the
     drain he likes:
       snap    SNAP_AT .. 1 of the smear (scroll .82 x 45vh .. 45vh): the
               6 Oct snap, unchanged — the threads let go at the feet and the
               beads recoil up into the streaks. By smear 1 the letters are
               gone and only the streaks stand. Over the same run the FOOT of
               every streak rounds off (a half-disc hung from the streak's
               base, FOOT_ROUND) — a flat bottom was hidden under the letters
               and would be a flat cut once they are gone; a broken filament
               rounds its end.
       exit    scroll EXIT_FROM x 45vh .. +EXIT_VH: the whole column is
               pulled straight up the canvas and off its top — the honey
               slurped away. Each streak starts at its own moment, in the
               ORDER ITS LETTER SNAPPED (the same hash of the letter's seed
               that orders the snap, spread over EXIT_STAG of the run — see
               probeRuns [3]): a letter lets go, its bead recoils into the
               streak, and that streak lifts off behind it. The exit starts
               at .9 of the smear's scroll, under the last letters' snap,
               because the ease-in's first beat is still — with it starting
               at 1 there was a stall of ~45px of scroll where nothing moved.
               The foot accelerates from rest (ease-in, EXIT_POW) as if pulled
               from above, with the tip and the edge waver riding along with
               it — the streak is STILL relative to itself, it just travels.
               Width, round ends, nothing else changes. It is gone when its
               foot is above the canvas top, and the canvas top is above the
               screen at every scroll position (measured: -79px at rest at
               1728x1000, climbing), so no edge is ever seen cutting it. The
               end state is an empty hero because the ink LEFT.
     MEASURED at 1728x1000 (scroll px): drain 0..369, snap 369..450 (letters
     gone at 450, streak feet at y~190 on screen with every tip already above
     the screen), exit 405..555 — the first feet visibly lift at ~440, the
     last streak is off the screen by ~540, and the empty hero is still on
     screen until ~650 when the name's old place reaches the top. Scrolling back down runs
     it all in reverse: every stage is a pure function of the scroll.
     ⛔ The exit runs on the SCROLL, not on the smear: the smear is capped at
     1 (the canvas has no room above it) and the kick can throw it to 1 early,
     while the exit must wait for the letters to be gone. exitNow is set in
     onScroll from how far past headCss the page is. index.html's nav fade
     reads smear() and is untouched; exit() is exposed beside it.
     RESOLVE=0 restores the 6 Oct 9:15pm live behaviour exactly: snap off,
     the name ends as a thread under the streaks, flat feet, no exit. */
  /* ⛳ 7 Oct 12:25pm: "MAURICE MOYNIHAN disappears too quickly at the end.
     the smear lines should get thinner at the end too before they
     disappear". Two beats per streak now: it THINS in place first (EXIT_THIN
     of its width over the first EXIT_THIN_BY of its own exit), and only
     after EXIT_HOLD does it start to lift — so it is seen getting thinner,
     then pulled away. The lift is what used to happen over the whole exit,
     squeezed into the rest of it.
     ⛔ The width floor comes down with the thinning but never under
     EXIT_FLOOR x the letter height: at .023H (floor x .35) the thinnest
     streaks fell under the blur's threshold and went GREY — a fade by
     another name. Tip and foot stay round: a column, not a needle.
     ⛔ The visible exit is bounded by the page, not by EXIT_VH: the feet are
     ~190px down the screen at 450 scroll and the name's place reaches the
     top at ~650, so a longer EXIT_VH only finishes off screen.
     EXIT_THIN 0, EXIT_HOLD 0, EXIT_VH .2, EXIT_STAG .3, EXIT_POW 2.2 is the
     12:05pm version. */
  /* and the whole ending starts earlier — thread and snap at .74 (was .82),
     exit from .8 (was .9) over .28 of the screen — because that is the only
     way to give it more time on screen: measured at 1728x1000, the ending
     now plays from ~340 to ~520px of scroll (was ~440 to ~540). */
  var EXIT_FLOOR = 0.042;
  var LIFT_AT = 0.55,
    LIFT_V = 0.9,
    LIFT_A = 7,
    liftP = 0;
  /* ⛳ 7 Oct 12:55pm: "should the lines themselves shrink a bit at the very
     end as if they are being drained?" As a streak is pulled away its
     trailing end necks down — the last of a drink going up a straw — so the
     foot narrows to a thin round tail while the top stays as it was. NECK of
     the width at the very foot, fading out NECK_LEN up the streak (in
     letter heights), growing with how far the streak has been pulled (rise
     over NECK_BY of the way out). Never under EXIT_FLOOR: no grey, no needle. */
  var NECK = 0.7,
    NECK_LEN = 2.2,
    NECK_BY = 0.45;
  var RESOLVE = 1,
    EXIT_FROM = 0.88,
    EXIT_VH = 0.22,
    EXIT_STAG = 0.3,
    EXIT_POW = 1.5,
    FOOT_ROUND = 1,
    EXIT_THIN = 0.6,
    EXIT_THIN_FROM = 0.05,
    EXIT_HOLD = 0;
  var HONEY = 1,
    THREAD = 0.25,
    THREAD_AT = RESOLVE ? 0.74 : 1,
    EVEN_FROM = 0.5,
    SNAP_AT = RESOLVE ? 0.74 : 2,
    SNAP_SPREAD = 0.4,
    BEAD = 1.1,
    BEAD_W = 0.11,
    SNAP_EASE = 1.7,
    FRONT_LO = 1.3,
    FRONT_HI = -0.35;
  var drainNow = 0,
    honeyNow = false;
  /* per circle, the deepest point (largest letter-box y) on the stroke
     between it and the nearest of the stroke's highest points, going either
     way (a loop goes both ways round). Off the skeleton, not the wobbled
     circles, so it is fixed per layout; built once, on first use. */
  function cutOf(st) {
    var n = st.n,
      y = new Float32Array(n),
      cut = new Float32Array(n),
      i,
      j,
      k,
      lo = 1e9;
    for (i = 0; i < n; i++) {
      y[i] = (st.spts[i][1] - st.gy) / st.H;
      if (y[i] < lo) lo = y[i];
      cut[i] = 1e9;
    }
    for (i = 0; i < n; i++) {
      if (y[i] > lo + 0.02) continue; /* a top: walk out from it both ways */
      for (k = -1; k <= 1; k += 2) {
        var m = y[i];
        j = i;
        for (var c = 0; c < n; c++) {
          j += k;
          if (j < 0 || j >= n) {
            if (!st.closed) break;
            j = (j + n) % n;
          }
          if (j === i) break;
          if (y[j] > m) m = y[j];
          if (m < cut[j]) cut[j] = m;
        }
      }
      if (cut[i] > y[i]) cut[i] = y[i];
    }
    return cut;
  }
  function sstep(a, b, x) {
    x = (x - a) / (b - a);
    x = x < 0 ? 0 : x > 1 ? 1 : x;
    return x * x * (3 - 2 * x);
  }
  function thin(st, sh, i) {
    if (!thinNow || Math.abs(st.gy - thinCap) > 1) return;
    var up = (st.gy + st.H - sh[1]) / st.H;
    up = up < 0 ? 0 : up > 1 ? 1 : up;
    if (!honeyNow) {
      sh[2] *= 1 - thinNow * (THIN_FEET + (1 - THIN_FEET) * up);
      return;
    }
    var sm = drainNow,
      d = Math.min(1, sm / THREAD_AT);
    /* drain: the old curve, reaching the thread at THREAD_AT; feet catch up */
    var feet = THIN_FEET + (1 - THIN_FEET) * sstep(EVEN_FROM, THREAD_AT, sm);
    var f = 1 - (1 - THREAD) * d * (feet + (1 - feet) * up);
    /* the swell goes out of the stroke as it stretches to a filament */
    var mix = sstep(EVEN_FROM, THREAD_AT, sm),
      rt = sh[3] * THREAD;
    var r = sh[2] * f,
      rf = sh[3] * f;
    r += (rf - r) * mix;
    if (r < rt * mix) r = rt * mix;
    if (sm > SNAP_AT) {
      /* snap: this letter's front, in letter-box y (0 cap .. 1 baseline) */
      var s0 =
          SNAP_AT + (1 - SNAP_AT) * SNAP_SPREAD * hash1(st.seed - st.si * 1.1),
        u = (sm - s0) / ((1 - SNAP_AT) * (1 - SNAP_SPREAD));
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      u = 1 - Math.pow(1 - u, SNAP_EASE);
      var front = FRONT_LO + (FRONT_HI - FRONT_LO) * u,
        yb = (sh[1] - st.gy) / st.H;
      /* ⛔ cut by CONNECTION, not by height alone: the C's lower terminal
         curls back up, so a plain y-front killed the bottom of the arc and
         left the tip above it as a loose dot (failure 1 again, in small).
         cutOf() holds, per circle, the lowest point on its way along the
         stroke to the stroke's top; once the front has passed THAT, the
         circle has nothing to hang from and goes with it. */
      if (!st.cut) st.cut = cutOf(st);
      if (st.cut[i] > front) r = 0;
      else if (u > 0) {
        /* the bead rides only a CLIMBING thread: on a flat run (a bar, the
           bottom of the C, O, U) every circle sits in the bead's band at
           once and it smeared into a slug. Flat runs just let go. */
        var p0 = st.spts[i > 0 ? i - 1 : i],
          p1 = st.spts[i < st.n - 1 ? i + 1 : i],
          dx = p1[0] - p0[0],
          dy = p1[1] - p0[1];
        var vert = (dy * dy) / (dx * dx + dy * dy + 1e-9),
          dz = (front - yb) / BEAD_W;
        r += rt * BEAD * vert * Math.min(1, u * 6) * Math.exp(-dz * dz);
      }
    }
    sh[2] = r;
  }
  function blobStroke(g, st, c, ph, fx) {
    var n = st.n,
      i,
      sh;
    if (!(fx && fx.on)) {
      for (i = 0; i < n; i++) {
        sh = shape(st, i, c, ph);
        thin(st, sh, i);
        g.moveTo(sh[0] + sh[2], sh[1]);
        g.arc(sh[0], sh[1], sh[2], 0, PI * 2);
      }
      return;
    }
    var b = st.b;
    for (i = 0; i < n; i++) {
      var j = b + i;
      sh = shape(st, i, c, ph);
      thin(st, sh, i);
      fx.bx[j] = sh[0];
      fx.by[j] = sh[1];
      fx.br[j] = sh[2];
      var dx = sh[0] + fx.ox[j] - fx.cx,
        dy = sh[1] + fx.oy[j] - fx.cy,
        d2 = dx * dx + dy * dy;
      var near = Math.exp(-d2 / (fx.reach * fx.reach));
      fx.nr[j] = near;
      if (near > 0.002) {
        var inv = 1 / Math.max(Math.sqrt(d2), 0.001);
        fx.vx[j] += (dx * inv * fx.push + fx.dx * PHY.carry) * near;
        fx.vy[j] += (dy * inv * fx.push + fx.dy * PHY.carry) * near;
      }
    }
    water(fx, b, n, c.r * st.H * PHY.max);
    for (i = 0; i < n; i++) {
      var k = b + i,
        px = fx.bx[k] + fx.ox[k],
        py = fx.by[k] + fx.oy[k];
      var rr = fx.br[k] * (1 - PHY.dip * fx.nr[k]);
      g.moveTo(px + rr, py);
      g.arc(px, py, rr, 0, PI * 2);
    }
  }
  /* ---- the smear ----
     His note, 4 Oct: the name "smudged vertically up the screen as you scroll
     down". 5 Oct: it does NOT fade, it "stays there", and the sentence goes
     almost at once — and the smear goes UP. (A version that hung drips DOWN
     from the feet shipped for twenty minutes: wrong way up, and the thin
     pointed icicles read as horror-film blood. "Keep it in the fun world.")
     So: the tops of the letters are pulled up into a few fat, round-ended
     streaks — toffee, chewing gum — and the letters stay whole underneath.
     How: the top band of the ink (from the top of the pen down to SMEAR_BAND
     letter heights under the cap line) is copied out and extruded straight UP
     by repeated doubling — 1px, 2px, 4px … — so it is one continuous
     curtain, never stacked copies. Each column is cut to a length off a SLOW
     noise (smearLen) — about one swell per letter, never jagged — and the
     union goes through the same blur and threshold as the letters, which
     rounds every end. Same pen, same melt.
     ⛔ FUN, NOT HORROR: fat, few, round, gently uneven. Short noise
     wavelengths and deep dips make thin spikes; that is the look he rejected.
     ⛳ COST. Only rows with ink are blurred and read back: at rest that is
     the letters alone; the band grows upward with the smear (BAND..BEND).
     The mask resolution steps down as it grows (q in fit(), floored at
     Q_MIN) so the frame cost stays near what it was. */
  /* STRETCH .1 -> .3, 5 Oct 2:57pm: at .1 the letters grew ~9px and the
     streaks hid it; "yeah push the bigger stretch live" */
  var SMEAR_BAND = 0.16,
    TAPER = 0.5,
    STRETCH = 0.3,
    Q_MIN = 0.7,
    BAND = 0,
    BEND = 0;
  /* the last mask's alpha, read by inkAt() — see buildMask */
  var INKMAP = { d: null, w: 0, h: 0, band: 0, bh: 0 };
  /* a column's share of the full smear length: value noise on letter-height
     units, so it is the same at any mask resolution. Slow and shallow on
     purpose — see FUN, NOT HORROR above. */
  function hash1(i) {
    var v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return v - Math.floor(v);
  }
  function vnoise(u) {
    var i = Math.floor(u),
      f = u - i;
    f = f * f * (3 - 2 * f);
    var a = hash1(i);
    return a + (hash1(i + 1) - a) * f;
  }
  function smearLen(u) {
    return 0.55 + 0.45 * vnoise(u / 1.15);
  }
  /* ---- the paint ----
     His ask: "a hint of texture … so it feels a bit like black paint". A
     dry-brush grain: fine, lighter bristle lines running up the streaks,
     broken into lengths, faint where the streak leaves the letter and
     strongest towards the tip — where a dragged brush runs out of paint.
     Built ONCE per size into its own canvas (it costs a pass over every
     pixel, so never per frame) and laid onto the ink with source-atop in
     paint(), only while there is a smear. The letters stay clean: it stops
     above the cap line. GRAIN is how strong the lightest bristle is. */
  /* ⛳ 5 Oct 2:35pm: OFF. His call: "remove the streak texture". The streaks
     are plain ink now. .3 puts it back exactly as it was. */
  var GRAIN = 0; /* .17 -> .3, his call: "a bit stronger"; then 0 */
  function makeGrain(Wc, capC, unit) {
    var t = document.createElement("canvas");
    t.width = Wc;
    t.height = Math.max(1, Math.ceil(capC));
    var g = t.getContext("2d"),
      im = g.createImageData(t.width, t.height),
      d = im.data,
      x,
      y;
    var col = new Float32Array(Wc),
      bw = Math.max(1, Math.round(unit * 0.012));
    for (x = 0; x < Wc; x += bw) {
      var r = hash1(x * 0.731 + 3.3),
        v = r > 0.5 ? (r - 0.5) / 0.5 : 0;
      for (var j = 0; j < bw && x + j < Wc; j++) col[x + j] = v;
    }
    for (y = 0; y < t.height; y++) {
      var fade = Math.min(
        1,
        Math.max(0, (capC - unit * 0.36 - y) / (unit * 0.6)),
      );
      if (!fade) continue;
      for (x = 0; x < Wc; x++) {
        var b = col[x];
        if (!b) continue;
        if (vnoise(y / (unit * 0.4) + Math.floor(x / bw) * 1.37) < 0.42)
          continue;
        var i = (y * Wc + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = Math.round(b * fade * GRAIN * 255);
      }
    }
    g.putImageData(im, 0, 0);
    return t;
  }
  /* the melt: fill every circle, blur, threshold at 128 — mark.js verbatim,
     plus the smear taps and the band */
  /* ⛳ 5 Oct 7:40pm: THE STREAKS ARE MEASURED ONCE, OFF STILL LETTERS.
     His note: "the streaks currently also kinda flicker and break at times".
     Measured with the scroll held dead still: the streak count changed up to
     13 times in 4s and edges jumped 20px. They were re-read from the letter
     tops EVERY FRAME, and the letters never stop wobbling — so a run would
     split in two, merge with its neighbour, or drop under minw and vanish.
     Now the band at the top of the pen (top of the pen down to SMEAR_BAND
     under the cap) is read once per layout, at phase 0, no hover, no
     thinning, no stretch, squashed into one row. Each run of inked columns is
     one streak, for good. Off unthinned letters on purpose: the letters give
     up ink (THIN) but the streaks stay fat — ink leaving the letter INTO the
     streak, and narrow streaks were the needle/horror look. */
  function probeRuns(w, h, lay, c, scratch) {
    var cv = scratch.r || (scratch.r = document.createElement("canvas")),
      g,
      i;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    g = cv.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    var keep = thinNow;
    thinNow = 0;
    g.fillStyle = "#000";
    g.beginPath();
    for (i = 0; i < lay.strokes.length; i++)
      blobStroke(g, lay.strokes[i], c, 0, null);
    g.fill("nonzero");
    thinNow = keep;
    var pr = scratch.p || (scratch.p = document.createElement("canvas")),
      pg;
    if (pr.width !== w || pr.height !== 1) {
      pr.width = w;
      pr.height = 1;
    }
    pg = pr.getContext("2d");
    pg.clearRect(0, 0, w, 1);
    var bt = Math.max(0, lay.cap - c.r * lay.H * 1.6),
      bb = Math.min(h, lay.cap + SMEAR_BAND * lay.H);
    if (bb > bt) pg.drawImage(cv, 0, bt, w, bb - bt, 0, 0, w, 1);
    var row = pg.getImageData(0, 0, w, 1).data,
      all = [],
      runs = [],
      x,
      x0 = -1,
      gap = 0,
      minw = lay.H * 0.08;
    for (x = 0; x <= w; x++) {
      var on = x < w && row[x * 4 + 3] > 24;
      if (on) {
        if (x0 < 0) x0 = x;
        gap = 0;
      } else if (x0 >= 0) {
        if (++gap > 2 || x === w) {
          all.push([x0, x - gap]);
          x0 = -1;
          gap = 0;
        }
      }
    }
    /* ⛳ 5 Oct 8pm: "the 'A' on MAURICE doesn't have a streak". Its apex is a
       point: at 1x it grazed this band at 1px, and on his 2x screen it does
       not reach the band at all. (A first fix that kept lone narrow runs
       worked only where it grazed — wrong fix.) Now EVERY letter on the first
       line is guaranteed a streak: if no run overlaps a letter, one is added
       at the letter's highest point. Same pen, phase 0, so it never moves.
       Width comes from the drawing's floor (mh), so it is a streak, not a
       needle. */
    for (i = 0; i < all.length; i++)
      if (all[i][1] - all[i][0] >= minw) runs.push(all[i]);
    var lt = {},
      keys = [],
      st,
      k,
      sh,
      Lr;
    for (i = 0; i < lay.strokes.length; i++) {
      st = lay.strokes[i];
      if (Math.abs(st.gy - lay.cap) > 1) continue;
      Lr = lt[st.gx];
      if (!Lr) {
        Lr = lt[st.gx] = {
          x0: 1e9,
          x1: -1e9,
          ty: 1e9,
          tx: 0,
          seed: st.seed - st.si * 1.1,
        };
        keys.push(st.gx);
      }
      for (k = 0; k < st.n; k++) {
        sh = shape(st, k, c, 0);
        if (sh[0] - sh[2] < Lr.x0) Lr.x0 = sh[0] - sh[2];
        if (sh[0] + sh[2] > Lr.x1) Lr.x1 = sh[0] + sh[2];
        if (sh[1] - sh[2] < Lr.ty) {
          Lr.ty = sh[1] - sh[2];
          Lr.tx = sh[0];
        }
      }
    }
    for (i = 0; i < keys.length; i++) {
      Lr = lt[keys[i]];
      var hit = false;
      /* near the letter's top, not anywhere over it: the A's wide feet reach
         under the M's last streak, which counted as the A's own */
      for (k = 0; k < runs.length; k++)
        if (
          runs[k][0] - lay.H * 0.2 < Lr.tx &&
          Lr.tx < runs[k][1] + lay.H * 0.2
        ) {
          hit = true;
          break;
        }
      if (!hit) runs.push([Lr.tx - minw / 2, Lr.tx + minw / 2]);
    }
    /* ⛳ 5 Oct 9:15pm: "should the smears get smaller to match the width of
       the ink-drained text?" — his "do what you think is best". Since THIN
       went to .7 a streak measured off the full letter sat on a stem a third
       its width: a bulb on a stick. So each run is measured a second time,
       off the letters FULLY drained (THIN at smear 1), same still pose, and
       buildMask slides between the two widths with the smear. The POSITIONS
       still come from the full letters — probing drained letters to FIND
       runs is what split them into needles before. Where the drained letter
       has no ink in a run (the A's point) the width floor takes over. */
    g.clearRect(0, 0, w, h);
    var keepCap = thinCap,
      keepHoney = honeyNow;
    thinNow = THIN;
    thinCap = lay.cap;
    honeyNow = false;
    g.fillStyle = "#000";
    g.beginPath();
    for (i = 0; i < lay.strokes.length; i++)
      blobStroke(g, lay.strokes[i], c, 0, null);
    g.fill("nonzero");
    thinNow = keep;
    thinCap = keepCap;
    honeyNow = keepHoney;
    /* every row of the band, not the band squashed to one: a drained bar
       (the E's top) is a few rows of a tall band, and averaged into one row
       it fell under the cut and the E's streak went to a hairline */
    var bh2 = Math.max(1, Math.round(bb - bt)),
      band = bb > bt ? g.getImageData(0, Math.round(bt), w, bh2).data : null,
      col = new Uint8Array(w),
      y;
    if (band)
      for (y = 0; y < bh2; y++)
        for (x = 0; x < w; x++) if (band[(y * w + x) * 4 + 3] > 128) col[x] = 1;
    for (i = 0; i < runs.length; i++) {
      var a0 = Math.max(0, Math.floor(runs[i][0])),
        a1 = Math.min(w - 1, Math.ceil(runs[i][1])),
        t0 = -1,
        t1 = -1;
      for (x = a0; x <= a1; x++)
        if (col[x]) {
          if (t0 < 0) t0 = x;
          t1 = x;
        }
      runs[i] = [runs[i][0], runs[i][1], t0 < 0 ? 0 : (t1 - t0 + 1) / 2];
      /* [3]: the seed of the letter under this streak — the snap is ordered
         on it (thin), and so is the exit (UP AND OUT), so a letter's streak
         leaves after THAT letter has let go, not after a random one */
      var mid = (runs[i][0] + runs[i][1]) / 2,
        own = mid;
      for (k = 0; k < keys.length; k++) {
        Lr = lt[keys[k]];
        if (Lr.x0 <= mid && mid <= Lr.x1) {
          own = Lr.seed;
          break;
        }
      }
      runs[i].push(own);
    }
    return runs;
  }
  function buildMask(w, h, lay, c, p, scratch, fx, sm, ex) {
    var cv = scratch.a,
      g = cv.getContext("2d"),
      ph = p * PI * 2,
      i;
    ex = RESOLVE ? ex || 0 : 0;
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    } else g.clearRect(0, 0, w, h);
    /* ⛳ THE LETTERS STRETCH WITH THE SMEAR. His note: "should the actual
       text stretch a tiny bit too so it feels connected?" — up to STRETCH of
       their height, pulled up from the baseline, so the streaks read as
       coming OUT of the letters rather than stuck on top. Everything the
       smear measures from (capS) moves with it. */
    var sy = 1 + STRETCH * sm,
      capS = lay.bl + (lay.cap - lay.bl) * sy;
    thinNow = THIN * sm;
    thinCap = lay.cap;
    drainNow = sm;
    honeyNow = !!HONEY;
    g.fillStyle = "#000";
    g.beginPath();
    if (sy !== 1) g.setTransform(1, 0, 0, sy, 0, lay.bl * (1 - sy));
    for (i = 0; i < lay.strokes.length; i++)
      blobStroke(g, lay.strokes[i], c, ph, fx);
    g.fill("nonzero");
    g.setTransform(1, 0, 0, 1, 0, 0);
    var blur = c.goo * lay.H,
      dist = sm * (lay.drip || 0),
      src = cv;
    BAND = Math.max(
      0,
      Math.floor(
        capS - dist - c.r * lay.H * sy - (lay.cap - lay.head) - 3 * blur,
      ),
    );
    BEND = h;
    if (sm > 0 && dist > 0.5) {
      var sc = scratch.c,
        sg = sc.getContext("2d");
      if (sc.width !== w || sc.height !== h) {
        sc.width = w;
        sc.height = h;
      } else sg.clearRect(0, 0, w, h);
      /* 1. which columns carry ink at the top of the letters — measured ONCE
         per layout, off a still copy of the letters (see probeRuns). */
      if (scratch.runsLay !== lay) {
        scratch.runs = probeRuns(w, h, lay, c, scratch);
        scratch.runsLay = lay;
      }
      var runs = scratch.runs;
      /* 2. every run is one streak, drawn as a shape: full width where it
         leaves the letter, narrowing by TAPER towards a round end, with a
         slow waver down both edges so it reads as paint dragged by hand and
         not as a ruled column. Its length is the slow noise (smearLen). */
      sg.fillStyle = "#000";
      sg.beginPath();
      var base = capS + SMEAR_BAND * lay.H * 0.5,
        N = 14,
        k,
        t,
        yy,
        hw,
        cx,
        L,
        top,
        half,
        wv;
      /* the foot rounds off while the letters snap away (see UP AND OUT) */
      var round = RESOLVE && FOOT_ROUND ? sstep(SNAP_AT, 1, sm) : 0,
        xl = 0,
        xr = 0,
        rise;
      for (var ri = 0; ri < runs.length; ri++) {
        cx = (runs[ri][0] + runs[ri][1]) / 2;
        hw = (runs[ri][1] - runs[ri][0]) / 2;
        /* the drained width, as far as the letters have drained (sm) */
        var hw0 = hw;
        hw = hw + (Math.min(hw, runs[ri][2]) - hw) * sm;
        L = dist * smearLen(cx / lay.H);
        top = capS - L;
        if (top >= base - 1) continue;
        /* exit: this streak's own share of the run, then its foot's climb
           from base to just above the canvas top (plus its round end), on an
           ease-in — still at the start, pulling away hardest at the end */
        /* ⛳ 7 Oct 12:45pm: EACH STREAK FOLLOWS ITS OWN LETTER. His note,
           twice: "there's still an awkward gap/pause where the text is gone
           but the lines are still stationary. it needs to feel seamless and
           connected." Every streak used to run on one shared exit clock, so
           a streak whose letter had already snapped sat still waiting for
           the rest, and the lift began from rest (ease-in). Now each streak
           reads its OWN letter's snap window (runs[ri][3] is that letter's
           seed — the same hash1 the snap uses, so the timing is exact):
             - it thins across that window, as the letter goes into it;
             - its foot rounds over the same window;
             - it starts to lift at LIFT_AT of the window, while the last of
               its letter is still climbing, ALREADY MOVING (LIFT_V) and
               accelerating (LIFT_A) — the recoil carries straight on into
               the pull, no stop.
           It runs on liftP (scroll past the smear, unclamped, plus the kick),
           not the smear, which is capped at 1. */
        rise = 0;
        var slim = 1,
          rnd = round;
        if (RESOLVE) {
          var sS = SNAP_AT + (1 - SNAP_AT) * SNAP_SPREAD * hash1(runs[ri][3]),
            sD = (1 - SNAP_AT) * (1 - SNAP_SPREAD),
            lA = sS + sD * LIFT_AT,
            dd = liftP - lA;
          if (EXIT_THIN)
            slim = 1 - EXIT_THIN * sstep(sS, sS + sD * (LIFT_AT + 0.4), liftP);
          rnd = FOOT_ROUND ? sstep(sS, lA, liftP) : 0;
          if (dd > 0)
            rise = Math.min(
              base + hw0 + L + 4,
              (lay.drip || 0) * (LIFT_V * dd + LIFT_A * dd * dd),
            );
        }
        var nk =
            RESOLVE && NECK && rise > 0
              ? NECK * sstep(0, NECK_BY, rise / (base + hw0 + 2))
              : 0,
          nL = NECK_LEN * lay.H;
        /* the waver's phase off the letter height, not raw pixels: cx*0.37
           swung .37rad per pixel, so a run edge moving one pixel visibly
           re-drew both edges of its streak */
        var sp = (cx / lay.H) * 7,
          mh = lay.H * 0.065;
        hw = Math.max(hw, mh) * slim;
        mh = Math.max(mh * slim, lay.H * EXIT_FLOOR);
        hw = Math.max(hw, mh);
        /* a thinned streak tapers less, so it rises as a column with a round
           end instead of closing to a point — the needle look stays out */
        var tp = TAPER * Math.min(1, hw / hw0);
        /* ⛔ 5 Oct 8:15pm: NO STREAK ANIMATION. A sway/ripple/breathe on the
           clock shipped for 15 min: "the streaks should just go straight up,
           not a fake wiggle animation". Like the lean before it — rejected.
           They are still: straight up, edges wavering only in space. */
        /* ⛔ a floor on the width: a narrow run (the A's point) tapered by the
           same share went to a hairline needle — the horror look again */
        /* ⛔ the waver is phased on the streak's OWN y (yy), and the column
           is then drawn at yy-rise: the edges travel with the streak, so a
           leaving streak is the same shape it was, higher up. Phasing on the
           drawn y would make the edges crawl as it moved — a wiggle. */
        for (k = 0; k <= N; k++) {
          t = k / N;
          yy = base + (top - base) * t;
          wv =
            1 +
            0.07 * Math.sin((yy / lay.H) * 5.1 + sp) +
            0.04 * Math.sin((yy / lay.H) * 11.3 + sp * 1.7);
          half = Math.max(mh, hw * (1 - tp * Math.pow(t, 1.15)) * wv);
          if (nk) {
            var q0 = 1 - Math.min(1, (yy < base ? base - yy : 0) / nL);
            half = Math.max(lay.H * EXIT_FLOOR, half * (1 - nk * q0 * q0));
          }
          if (k === 0) {
            xl = cx - half;
            sg.moveTo(cx - half, yy - rise);
          } else sg.lineTo(cx - half, yy - rise);
        }
        var rt = Math.max(mh, hw * (1 - tp));
        sg.arc(cx, top - rise, rt, Math.PI, Math.PI * 2, false);
        for (k = N; k >= 0; k--) {
          t = k / N;
          yy = base + (top - base) * t;
          wv =
            1 +
            0.07 * Math.sin((yy / lay.H) * 5.3 + sp * 1.3) +
            0.04 * Math.sin((yy / lay.H) * 10.7 + sp * 0.6);
          half = Math.max(mh, hw * (1 - tp * Math.pow(t, 1.15)) * wv);
          if (nk) {
            var q1 = 1 - Math.min(1, (yy < base ? base - yy : 0) / nL);
            half = Math.max(lay.H * EXIT_FLOOR, half * (1 - nk * q1 * q1));
          }
          sg.lineTo(cx + half, yy - rise);
        }
        xr = cx + half;
        /* the foot: flat (and hidden under the letters) until the snap, a
           half-disc hung from the base by the time they are gone. Spanned
           from the actual left and right edge at the base so it joins both
           without a step; its depth grows with round so nothing pops. */
        if (rnd > 0)
          sg.ellipse(
            (xl + xr) / 2,
            base - rise,
            (xr - xl) / 2,
            ((xr - xl) / 2) * rnd,
            0,
            0,
            Math.PI,
            false,
          );
        sg.closePath();
      }
      sg.fill("nonzero");
      /* 3. the letters over the top, whole */
      sg.drawImage(cv, 0, 0);
      src = sc;
    }
    var goo = scratch.b,
      gg = goo.getContext("2d"),
      bh = BEND - BAND;
    if (goo.width !== w || goo.height !== h) {
      goo.width = w;
      goo.height = h;
    } else gg.clearRect(0, 0, w, h);
    gg.filter = "blur(" + blur.toFixed(2) + "px)";
    gg.drawImage(src, 0, BAND, w, bh, 0, BAND, w, bh);
    gg.filter = "none";
    var im = gg.getImageData(0, BAND, w, bh),
      d = im.data;
    /* ⛳ THE THRESHOLD HAS A ONE-PIXEL RAMP, NOT A HARD STEP. mark.js cuts at
       128 dead, which is why its edge "has no anti-aliasing of its own" and
       came out chewed whenever the mask was stretched. The mask here is
       built at the area budget — about 1x — and shown on a 2x screen, so a
       hard step would be a 2-device-pixel staircase along every letter. A
       ramp a mask pixel wide (alpha 112..144 → 0..255) IS the anti-aliasing,
       and the upscale in paint() smooths it. Same melt, same silhouette:
       the 50% contour is in exactly the same place. */
    for (i = 3; i < d.length; i += 4) {
      var a = (d[i] - 112) * 8;
      d[i] = a < 0 ? 0 : a > 255 ? 255 : a;
    }
    gg.putImageData(im, 0, BAND);
    /* kept for LiquidName.inkAt (ink.js): the finished mask, no copy */
    INKMAP.d = d;
    INKMAP.w = w;
    INKMAP.h = h;
    INKMAP.band = BAND;
    INKMAP.bh = bh;
    return goo;
  }

  function init(cv) {
    var h1 = cv.parentNode,
      block = h1.parentNode;
    var scratch = {
      a: document.createElement("canvas"),
      b: document.createElement("canvas"),
      c: document.createElement("canvas"),
    };
    var still = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    var phone = window.matchMedia("(max-width:768px)");
    var o = {
      r: NAME_R,
      bulge: NAME_BULGE,
      track: TRACK,
      space: SPACE,
      lead: LEAD,
    };
    var c = {
      r: o.r,
      wob: UNIT.wob,
      goo: UNIT.goo,
      bulge: o.bulge,
      f1: CFG.f1,
      f2: CFG.f2,
      term: CFG.term,
      pinch: CFG.pinch,
    };
    /* ⛳ THE CAP IS ON THE BUFFER AREA. 50ms per megapixel, measured, and the
       whole page has to fit in 41ms at 24fps with the mark and the trail
       also drawing. 300k pixels is ~15ms: at 1440 wide the one-line name is
       about 1440x120, so the buffer runs at 1.3x — and the threshold edge,
       which has no anti-aliasing of its own, shows a faint stair-step on a
       retina screen. Raising this to 600k makes the edge clean at 2x and
       costs ~30ms a frame, which stutters once the trail is dealing cards.
       ?liquidbudget=N to try another number on the live page. */
    var BUDGET =
      parseFloat(
        (location.search.match(/[?&]liquidbudget=([0-9]+)/) || [])[1],
      ) || 300000;
    var w = 0,
      h = 0,
      lay = null,
      fx = null,
      visible = true,
      last = 0,
      dpr = 1,
      sdpr = 1;
    var stat = { n: 0, ms: 0, peak: 0 };
    /* ---- the smear's clock ----
       SMEAR_VH is the longest streak, as a share of the screen's height; it
       grows at SMEAR_RATE of the scroll. The name scrolls with the page, so
       the streaks lead it up and off the top of the screen.
       ?liquidsmear=N holds it (0..1). */
    var grain = null,
      SMEAR_VH = 0.45,
      SMEAR_RATE = 1,
      smear = 0,
      dirty = false,
      q = 1,
      text = "",
      Wcss = 0,
      Hcss = 0,
      headCss = 0,
      inkCss = 0;
    var forcedSmear = (location.search.match(/[?&]liquidsmear=([0-9.]+)/) ||
      [])[1];
    /* ⛳ 8 Oct: NO SCROLL SMEAR ON A PHONE. His note: "the smear on mobile is pretty janky and gets cut off".
       Measured at 393x659: the whole page scrolls only ~105px, so the smear ran almost entirely on the
       flick kick, and MAURICE is the only line with streaks and it sits at the top of the screen, so its
       streaks went straight up off the glass and were never seen whole. On a touch phone the name holds
       still on scroll and answers the finger instead (see the touch handler below). ?liquidsmear=N still
       forces it, for stills. */
    var touchPhone =
      phone.matches &&
      !window.matchMedia("(hover:hover) and (pointer:fine)").matches;
    if (touchPhone && forcedSmear === undefined) forcedSmear = "0";
    if (forcedSmear !== undefined)
      smear = Math.max(0, Math.min(1, parseFloat(forcedSmear)));
    /* the exit (see UP AND OUT): 0 until the scroll passes headCss (where the
       smear reaches 1 on distance alone), 1 at EXIT_VH of the screen beyond
       it. ?liquidexit=N holds it (0..1) for stills. */
    var exitNow = 0,
      forcedExit = (location.search.match(/[?&]liquidexit=([0-9.]+)/) || [])[1];
    if (forcedExit !== undefined)
      exitNow = Math.max(0, Math.min(1, parseFloat(forcedExit)));
    /* stills: ?liquidsmear holds the lift at the smear, ?liquidexit=N past it */
    if (forcedSmear !== undefined) liftP = smear;
    if (forcedExit !== undefined) liftP = 1 + exitNow * 0.4;
    /* ⛳ 5 Oct 3pm: THE SMEAR ANSWERS SPEED, NOT JUST DISTANCE. His pick of
       three: "a fast flick drags the streaks out further and they settle
       back". base is the old smear (how far down the page). extra is paint
       thrown past it by the scroll's speed: it grabs fast (KICK_UP) and lets
       go slowly (KICK_DOWN), so the streaks overshoot and ooze back to base.
       Total is capped at 1 — the canvas has no room above that, and the
       name is near the top of the screen by then anyway. */
    var base = 0,
      extra = 0,
      vel = 0,
      prevY = null,
      prevT = 0,
      KICK_MAX = 0.4,
      KICK_V = 1.6,
      KICK_UP = 60,
      KICK_DOWN = 420;
    function onScroll() {
      if (forcedSmear !== undefined) return;
      var y = window.scrollY || 0,
        pf = headCss ? (y * SMEAR_RATE) / headCss : 0;
      pf = Math.max(0, Math.min(1, pf));
      if (pf !== base) {
        base = pf;
        dirty = true;
      }
      /* how far down the page, NOT capped at 1 — the streaks' lift runs on it */
      if (forcedExit === undefined) {
        var lp = (headCss ? (y * SMEAR_RATE) / headCss : 0) + extra;
        if (lp !== liftP) {
          if (lp > SNAP_AT || liftP > SNAP_AT) dirty = true;
          liftP = lp;
        }
      }
      if (forcedExit !== undefined || !RESOLVE) return;
      var ef = headCss
        ? (y - headCss * EXIT_FROM) / (window.innerHeight * EXIT_VH)
        : 0;
      ef = Math.max(0, Math.min(1, ef));
      if (ef !== exitNow) {
        exitNow = ef;
        dirty = true;
      }
    }
    /* once per painted frame: speed in px/ms, smoothed; extra eases towards
       what that speed asks for. Returns true while it is still moving. */
    function kick(t) {
      if (forcedSmear !== undefined) return false;
      var y = window.scrollY || 0,
        dt = prevY === null ? 0 : t - prevT,
        v = 0;
      /* a gap (tab hidden, hero off screen) is not a flick */
      if (dt > 0 && dt < 200) v = Math.abs(y - prevY) / dt;
      prevY = y;
      prevT = t;
      if (!dt || dt >= 200) dt = 16;
      vel += (v - vel) * (1 - Math.exp(-dt / 40));
      var want = KICK_MAX * (1 - Math.exp(-vel / KICK_V));
      extra +=
        (want - extra) *
        (1 - Math.exp(-dt / (want > extra ? KICK_UP : KICK_DOWN)));
      if (extra < 0.002 && want < 0.002) extra = 0;
      var s = Math.min(1, base + extra),
        moved = s !== smear;
      smear = s;
      if (forcedExit === undefined) {
        var lp = (headCss ? (y * SMEAR_RATE) / headCss : 0) + extra;
        if (lp !== liftP) {
          liftP = lp;
          moved = true;
        }
      }
      if (moved && extra) window.dispatchEvent(new Event("liquidsmear"));
      return extra > 0 || vel > 0.01;
    }
    function size() {
      /* ⛔⛔ offsetWidth, NEVER getBoundingClientRect, FOR THE SIZE. The block
         this rides in is scaled towards a point as the page scrolls (the
         hero's fall), and a bounding rect reports the SCALED box. The first
         live build measured it that way, a late re-measure landed mid-scroll,
         and the name was rebuilt 220px wide and jammed into the left edge —
         on the live site, in front of him. offsetWidth is layout, not
         transform, so it is the same number at any scroll position.
         Width is the h1's box capped to the screen less a gutter: the h1 is
         centred on the screen in every layout here (the pinned block is
         fixed left:0 right:0; on a phone it is in flow), so the CSS centres
         the canvas inside the h1 and nothing here needs the h1's left. */
      var vw = document.documentElement.clientWidth,
        W = Math.min(h1.offsetWidth, vw * 0.96);
      if (!W) {
        w = h = 0;
        return;
      }
      text = phone.matches ? "MAURICE|MOYNIHAN" : "MAURICE MOYNIHAN";
      /* the canvas carries the smear's room ABOVE the ink. head is in letter
         heights, and the letter height depends only on the width, so one
         probe at head 0 gives the number to convert with. */
      o.head = 0;
      headCss = Math.round(window.innerHeight * SMEAR_VH);
      o.head = headCss / layout(text, W, o).H;
      var probe = layout(text, W, o);
      Wcss = W;
      Hcss = probe.height;
      inkCss = Hcss - headCss;
      /* the MASK is built at the budget — on the ink's area, the headroom is
         free until the smear reaches into it; the canvas it is drawn onto is
         at the screen's own ratio (capped at 2), so the ramped edge above
         lands on real device pixels instead of being stretched */
      dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(BUDGET / (W * inkCss)),
      );
      sdpr = Math.min(window.devicePixelRatio || 1, 2);
      q = 0;
      fit();
      cv.width = Math.round(W * sdpr);
      cv.height = Math.round(Hcss * sdpr);
      cv.style.width = W + "px";
      cv.style.height = Hcss + "px";
      /* the canvas is centred on the h1; the ink sits below the smear's room,
         so the canvas is lifted by half that room to put the INK on centre */
      cv.style.top = "calc(50% - " + (headCss / 2).toFixed(1) + "px)";
      /* where the ink starts, as a share of the canvas — the trail's no-deal
         band in index.html reads it (liquidBand) */
      cv.dataset.inkTop = (headCss / Hcss).toFixed(4);
      grain =
        still || !GRAIN
          ? null
          : makeGrain(cv.width, probe.cap * sdpr, probe.H * sdpr);
    }
    /* the mask's resolution for the current smear: full at rest, dropping as
       the streak lengthens so the blurred band stays about the same area */
    function fit() {
      /* the band is the ink plus the smear's reach; q shrinks the mask so
         band area ≈ ink area at rest. Stepped in twentieths so a scroll does
         not rebuild the layout every frame. */
      /* ⛳ 5 Oct: ONE STEP, NOT SIX. It used to fall from 1 to Q_MIN in
         twentieths as the smear grew, and every step re-rasterised the whole
         name at a new size — six visible jolts in the first 120px of scroll,
         the bulk of the flicker. Now it drops once, on the first pixel. */
      var nq = smear > 0 ? Q_MIN : 1;
      if (nq === q) return;
      q = nq;
      w = Math.round(Wcss * dpr * q);
      h = Math.round(Hcss * dpr * q);
      lay = layout(text, w, o);
      lay.drip = headCss * dpr * q;
      if (fx) {
        fx = null;
      } /* sample count changed with the size; the next hover rebuilds it */
    }
    function wake() {
      if (fx) return fx;
      var N = lay.N,
        f32 = function () {
          return new Float32Array(N);
        };
      fx = {
        ox: f32(),
        oy: f32(),
        vx: f32(),
        vy: f32(),
        ax: f32(),
        ay: f32(),
        bx: f32(),
        by: f32(),
        br: f32(),
        nr: f32(),
        cx: -1e4,
        cy: -1e4,
        dx: 0,
        dy: 0,
        on: false,
        mo: 0,
        mv: 0,
        seen: 0,
        reach: (PHY.reach * lay.H) / REF_H,
        push: (PHY.push * lay.H) / REF_H,
      };
      return fx;
    }
    function paint(p) {
      if (!w || !h || !lay) return;
      var t0 = performance.now(),
        g = cv.getContext("2d"),
        W = cv.width,
        H = cv.height;
      fit();
      var mask = buildMask(w, h, lay, c, p, scratch, fx, smear, exitNow),
        k = H / h;
      g.clearRect(0, 0, W, H);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(
        mask,
        0,
        BAND,
        w,
        BEND - BAND,
        0,
        BAND * k,
        W,
        (BEND - BAND) * k,
      );
      g.globalCompositeOperation = "source-in";
      g.fillStyle = INK;
      g.fillRect(0, 0, W, H);
      if (grain && smear > 0) {
        g.globalCompositeOperation = "source-atop";
        g.drawImage(grain, 0, 0);
      }
      g.globalCompositeOperation = "source-over";
      var ms = performance.now() - t0;
      stat.n++;
      stat.ms += ms;
      if (ms > stat.peak) stat.peak = ms;
    }
    size();
    if (!w) {
      return false;
    }
    /* the type goes transparent only now, with a frame on the canvas */
    paint(0);
    document.documentElement.classList.add("liquid-live");
    /* ?liquidbench=N paints N frames back to back and reports the cost in a
       tag (and the title, for --dump-dom). It is how the number in the header
       comment was measured ON THIS PAGE, at this page's buffer size — rAF
       cannot be timed in a hidden tab or under headless virtual time, a
       synchronous loop can. ?liquiddebug=1 shows the boxes. Debug only. */
    var bench = parseInt(
      (location.search.match(/[?&]liquidbench=([0-9]+)/) || [])[1] || 0,
      10,
    );
    var dbg = /[?&]liquiddebug=1/.test(location.search);
    if (bench || dbg) {
      var tag = document.createElement("div");
      tag.id = "liquid-debug";
      tag.style.cssText =
        "position:fixed;left:8px;bottom:8px;z-index:9999;font:11px monospace;background:#161511;color:#EFEDE6;padding:4px 7px;white-space:pre";
      var rc = cv.getBoundingClientRect(),
        rh = h1.getBoundingClientRect(),
        txt = "";
      if (bench) {
        var i,
          fr = [];
        for (i = 0; i < 4; i++) paint(i / bench);
        for (i = 0; i < bench; i++) {
          var a = performance.now();
          paint(i / bench);
          fr.push(performance.now() - a);
        }
        fr.sort(function (x, y) {
          return x - y;
        });
        txt =
          "LIQUID " +
          w +
          "x" +
          h +
          " mask, band " +
          (BEND - BAND) +
          " rows (" +
          ((w * (BEND - BAND)) / 1e6).toFixed(2) +
          " Mpx) dpr " +
          dpr.toFixed(2) +
          "x q " +
          q.toFixed(2) +
          " of " +
          (window.devicePixelRatio || 1) +
          " smear " +
          smear.toFixed(2) +
          " exit " +
          exitNow.toFixed(2) +
          " | " +
          lay.N +
          " circles | frame median " +
          fr[bench >> 1].toFixed(1) +
          "ms p90 " +
          fr[Math.floor(bench * 0.9)].toFixed(1) +
          "ms";
      }
      txt +=
        "\ncanvas " +
        [rc.left, rc.top, rc.width, rc.height].map(Math.round).join(",") +
        " h1 " +
        [rh.left, rh.top, rh.width, rh.height].map(Math.round).join(",") +
        " clientWidth " +
        document.documentElement.clientWidth;
      tag.textContent = txt;
      document.body.appendChild(tag);
      document.title = txt;
    }
    /* ?liquidphase=N paints one phase and stops — for stills, as mark.js */
    var forced = (location.search.match(/[?&]liquidphase=([0-9.]+)/) || [])[1];
    if (forced !== undefined) {
      paint(parseFloat(forced));
      return true;
    }
    if (still) return true;

    var io = window.IntersectionObserver
      ? new IntersectionObserver(function (e) {
          visible = e[0].isIntersecting;
        })
      : null;
    if (io) io.observe(cv);
    function poke(x, y) {
      if (!lay) return;
      var r = cv.getBoundingClientRect();
      if (!r.width) return;
      var m = r.height * 0.5;
      if (
        x < r.left - m ||
        x > r.right + m ||
        y < r.top - m ||
        y > r.bottom + m
      ) {
        if (fx) fx.seen = 0;
        return;
      }
      var f = wake(),
        sx = w / r.width,
        sy = h / r.height;
      var nx = (x - r.left) * sx,
        ny = (y - r.top) * sy;
      f.dx = f.seen ? nx - f.cx : 0;
      f.dy = f.seen ? ny - f.cy : 0;
      f.cx = nx;
      f.cy = ny;
      f.on = true;
      f.seen = 1;
    }
    if (window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
      document.addEventListener(
        "pointermove",
        function (e) {
          poke(e.clientX, e.clientY);
        },
        { passive: true },
      );
      document.addEventListener(
        "pointerleave",
        function () {
          if (fx) fx.seen = 0;
        },
        { passive: true },
      );
    }
    /* ⛳ 8 Oct: A FINGER MOVES THE INK TOO. His note: "MAURICE MOYNIHAN doesnt react to being swiped".
       The cursor ripple was mouse-only. Touch events keep arriving while a swipe scrolls the page
       (pointer events are cancelled the moment the browser takes the scroll), so this listens to
       those: drag a finger across the name and it pushes the ink like the cursor does. Passive, so
       the page still scrolls under the finger. */
    if ("ontouchstart" in window) {
      var tp = function (e) {
        var t = e.touches[0];
        if (t) poke(t.clientX, t.clientY);
      };
      document.addEventListener(
        "touchstart",
        function (e) {
          if (fx) fx.seen = 0;
          tp(e);
        },
        { passive: true },
      );
      document.addEventListener("touchmove", tp, { passive: true });
      document.addEventListener(
        "touchend",
        function () {
          if (fx) fx.seen = 0;
        },
        { passive: true },
      );
      document.addEventListener(
        "touchcancel",
        function () {
          if (fx) fx.seen = 0;
        },
        { passive: true },
      );
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) last = 0;
    });
    var rt = 0;
    function resize() {
      clearTimeout(rt);
      rt = setTimeout(function () {
        size();
        paint((performance.now() % PERIOD) / PERIOD);
      }, 80);
    }
    addEventListener("resize", resize);
    /* ⛔ THE H1'S BOX MOVES AFTER FIRST PAINT. Archivo arrives late, the grid
       column it sizes changes width, and the box the canvas was centred
       against shifts — on a phone that put the name 20px off and clipped
       MAURICE on the right. Re-measure when the fonts land and whenever the
       h1's box changes size; neither fires a resize event. */
    if (document.fonts && document.fonts.ready)
      document.fonts.ready.then(resize);
    if (window.ResizeObserver) {
      new ResizeObserver(resize).observe(h1);
    }
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    (function loop(t) {
      requestAnimationFrame(loop);
      if (document.hidden || !visible) return;
      /* a scroll repaints on the next frame, not the next 24fps tick — the
         smear has to answer the wheel */
      var live = !!(fx && fx.on) || dirty || extra > 0;
      if (t - last < 1000 / (live ? FPS_LIVE : FPS)) return;
      last = t;
      dirty = false;
      kick(t);
      var p = (t % PERIOD) / PERIOD;
      if (fx && fx.on) {
        if (!fx.seen) {
          fx.dx *= 0.8;
          fx.dy *= 0.8;
          fx.cx = -1e4;
          fx.cy = -1e4;
        }
        fx.mo = 0;
        fx.mv = 0;
        paint(p);
        if (
          !fx.seen &&
          Math.sqrt(fx.mo) < PHY.still &&
          Math.sqrt(fx.mv) < PHY.slow
        ) {
          fx.on = false;
          fx.ox.fill(0);
          fx.oy.fill(0);
          fx.vx.fill(0);
          fx.vy.fill(0);
          paint(p);
        }
      } else paint(p);
    })(0);
    /* for measuring on the live page: LiquidName.stats() */
    window.LiquidName = {
      stats: function () {
        return {
          frames: stat.n,
          avg: stat.n ? stat.ms / stat.n : 0,
          peak: stat.peak,
          dpr: dpr,
          buffer: w + "x" + h,
          reset: function () {
            stat.n = 0;
            stat.ms = 0;
            stat.peak = 0;
          },
        };
      },
      dpr: function () {
        return dpr;
      },
      /* the smear now (0..1 of the headroom) — index.html fades the nav on its tip */
      smear: function () {
        return smear;
      },
      /* the exit now (0..1, see UP AND OUT) — nothing on the page reads it yet */
      exit: function () {
        return exitNow;
      },
      /* how much ink is under a screen point, 0..1 — ink.js
                          asks this to know when the cursor has touched the name.
                          Reads the mask already built for the last frame. */
      inkAt: function (x, y) {
        var m = INKMAP;
        if (!m.d) return 0;
        var r = cv.getBoundingClientRect();
        if (x < r.left || x >= r.right || y < r.top || y >= r.bottom) return 0;
        var mx = Math.floor(((x - r.left) * m.w) / r.width),
          my = Math.floor(((y - r.top) * m.h) / r.height) - m.band;
        if (my < 0 || my >= m.bh || mx < 0 || mx >= m.w) return 0;
        return m.d[(my * m.w + mx) * 4 + 3] / 255;
      },
    };
    return true;
  }
  function boot() {
    var cv = document.querySelector("canvas.hero__liquid");
    if (cv && cv.getContext) init(cv);
  }
  /* the guts, for the scratch rig (_liquidname.html) and for measuring in
     node. The rig used to carry its own copy of all this and drifted; now it
     draws with THIS file, so what it shows is what ships. Nothing on the page
     reads it. */
  if (typeof window !== "undefined")
    window.LiquidCore = {
      GL: GL,
      MW: MW,
      UNIT: UNIT,
      CFG: CFG,
      PHY: PHY,
      DENS: DENS,
      REF_H: REF_H,
      REF_W: REF_W,
      polylen: polylen,
      layout: layout,
      buildMask: buildMask,
      shape: shape,
      arc: arc,
      S: S,
      name: {
        r: NAME_R,
        bulge: NAME_BULGE,
        track: TRACK,
        space: SPACE,
        lead: LEAD,
        seedstep: SEEDSTEP,
      },
    };
  if (typeof document === "undefined") return;
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
