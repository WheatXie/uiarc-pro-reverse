(self.webpackChunk_N_E = self.webpackChunk_N_E || []).push([
  [20857],
  {
    4596: (e) => {
      e.exports = {
        demo: "black-hole_demo__SONN_",
        panel: "black-hole_panel__WxIxo",
        head: "black-hole_head__yS3u7",
        title: "black-hole_title__op4FB",
        list: "black-hole_list__DMu7s",
        item: "black-hole_item__y_YWP",
        row: "black-hole_row__BeP6i",
        check: "black-hole_check__646fv",
        avatar: "black-hole_avatar__Y4dJd",
        text: "black-hole_text__TQ_j4",
        name: "black-hole_name__hMuAp",
        subject: "black-hole_subject__MyfD7",
        time: "black-hole_time__6ArMD",
        status: "black-hole_status__YjYF4",
        toast: "black-hole_toast__5VlJ4",
      };
    },
    15672: (e) => {
      e.exports = {
        root: "black-hole_root__QRuMU",
        content: "black-hole_content__xsrjE",
        canvas: "black-hole_canvas__2TYxJ",
      };
    },
    20857: (e, t, a) => {
      "use strict";
      (a.r(t), a.d(t, { BlackHoleDemo: () => M, default: () => F }));
      var i = a(95155),
        r = a(12115),
        o = a(18310),
        n = a(80642),
        l = a(25354),
        s = a(25879),
        d = a(64577),
        c = a(51288),
        u = a(7770),
        h = a(15672),
        m = a.n(h);
      let f = (e, t = 0, a = 1) => Math.min(a, Math.max(t, e)),
        p = (e, t, a) => f((e - t) / (a - t)),
        g = () => new Promise((e) => requestAnimationFrame(e));
      function v(e) {
        return (
          !!e &&
          "transparent" !== e &&
          !/rgba?\(.*,\s*0\)$/.test(e) &&
          !/\/\s*0\)$/.test(e)
        );
      }
      async function w(e) {
        let t = new Map();
        return (
          await Promise.all(
            [...e.querySelectorAll("svg")].map(async (e) => {
              let a = e.getBoundingClientRect();
              if (!a.width || !a.height) return;
              let i = e.cloneNode(!0);
              (i.setAttribute("width", String(a.width)),
                i.setAttribute("height", String(a.height)),
                i.setAttribute("xmlns", "http://www.w3.org/2000/svg"));
              let r = new XMLSerializer()
                  .serializeToString(i)
                  .replace(/currentColor/g, getComputedStyle(e).color),
                o = new Image();
              o.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(r)}`;
              try {
                (await o.decode(), t.set(e, o));
              } catch {}
            }),
          ),
          t
        );
      }
      let b = `#version 300 es
in vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`,
        y = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform vec2 uO; uniform float uLens;
out vec4 color;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 d = p - uO; float r = length(d);
  vec2 q = p;
  if (uLens > 0.0) { float beta = r - uLens * uLens / max(r, 0.5); q = uO + d / max(r, 0.001) * beta; }
  vec2 uv = q / uRes;
  color = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture(uTex, uv);
}`,
        x = `#version 300 es
in vec2 aPos;
uniform vec2 uRes; uniform vec2 uO; uniform float uT; uniform float uMaxR; uniform float uSpin;
out vec2 vUv; out float vFade;
void main() {
  vec2 v = aPos - uO; float r0 = length(v); float a0 = atan(v.y, v.x);
  float dn = clamp(r0 / uMaxR, 0.0, 1.0);
  float start = 0.08 + 0.36 * dn;
  float u = clamp((uT - start) / 0.46, 0.0, 1.0);
  float f = u * u * (1.5 - 0.5 * u);
  float r = r0 * (1.0 - f);
  float a = a0 + uSpin * -log(max(1.0 - f, 0.015)) * 0.55;
  vec2 p = uO + vec2(cos(a), sin(a)) * r;
  vUv = aPos / uRes;
  vFade = 1.0 - smoothstep(0.72, 0.98, f);
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`,
        R = `#version 300 es
precision highp float;
uniform sampler2D uTex; in vec2 vUv; in float vFade; out vec4 color;
void main() { color = texture(uTex, vUv) * vFade; }`,
        _ = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec2 uO; uniform float uCore; uniform float uWave; uniform float uWaveAlpha; uniform float uDark; uniform float uPx; uniform vec3 uAccent;
out vec4 color;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float r = length(p - uO);
  float halo = uCore > 0.0 ? exp(-max(r - uCore, 0.0) / (uCore * 1.6)) * 0.22 * (1.0 - uDark * 0.4) : 0.0;
  float ring = uCore > 0.0 ? exp(-pow((r - uCore * 1.18) / (0.8 * uPx), 2.0)) * mix(0.5, 0.65, uDark) : 0.0;
  float core = uCore > 0.0 ? 1.0 - smoothstep(uCore - 1.2 * uPx, uCore + 0.4 * uPx, r) : 0.0;
  float wave = uWaveAlpha * exp(-pow((r - uWave) / (2.5 * uPx), 2.0));
  vec4 c = vec4(0.0);
  c = vec4(0.0, 0.0, 0.0, halo);
  // The photon ring and the closing shockwave wear the accent; the core and its halo stay ink.
  c = vec4(uAccent * ring, ring) + c * (1.0 - ring);
  c = vec4(uAccent * wave * 0.6, wave * 0.6) + c * (1.0 - wave * 0.6);
  c = vec4(vec3(0.0), core) + c * (1.0 - core);
  color = c;
}`;
      function A(e, t, a) {
        let i = (t, a) => {
            let i = e.createShader(t);
            return (e.shaderSource(i, a), e.compileShader(i), i);
          },
          r = e.createProgram();
        if (
          (e.attachShader(r, i(e.VERTEX_SHADER, t)),
          e.attachShader(r, i(e.FRAGMENT_SHADER, a)),
          e.bindAttribLocation(r, 0, "aPos"),
          e.linkProgram(r),
          !e.getProgramParameter(r, e.LINK_STATUS))
        )
          throw Error(e.getProgramInfoLog(r) ?? "link failed");
        let o = new Map();
        return {
          p: r,
          u: (t) => (
            o.has(t) || o.set(t, e.getUniformLocation(r, t)),
            o.get(t)
          ),
        };
      }
      function k(e, t) {
        let a = e.createTexture();
        return (
          e.bindTexture(e.TEXTURE_2D, a),
          e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !0),
          e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, e.RGBA, e.UNSIGNED_BYTE, t),
          e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR),
          e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR),
          e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE),
          e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE),
          a
        );
      }
      let T = (0, r.forwardRef)(function (
        { children: e, className: t, style: a },
        n,
      ) {
        let l = !!(0, o.I)(),
          s = (0, r.useRef)(null),
          d = (0, r.useRef)(null),
          c = (0, r.useRef)(null),
          h = (0, r.useRef)(Promise.resolve()),
          T = (0, r.useRef)(l);
        (0, r.useEffect)(() => {
          T.current = l;
        });
        let E = (0, r.useRef)(void 0),
          j = (0, r.useCallback)(() => {
            if (void 0 !== E.current) return E.current;
            let e = c.current;
            try {
              let t =
                e?.getContext("webgl2", {
                  premultipliedAlpha: !0,
                  antialias: !0,
                }) ?? null;
              if (!t) return ((E.current = null), null);
              let a = t.createBuffer();
              (t.bindBuffer(t.ARRAY_BUFFER, a),
                t.bufferData(
                  t.ARRAY_BUFFER,
                  new Float32Array([-1, -1, 3, -1, -1, 3]),
                  t.STATIC_DRAW,
                ),
                (E.current = {
                  gl: t,
                  lens: A(t, b, y),
                  mesh: A(t, x, R),
                  core: A(t, b, _),
                  quad: a,
                }));
            } catch {
              E.current = null;
            }
            return E.current;
          }, []);
        (0, r.useEffect)(() => {
          if (l) return;
          let e =
              window.requestIdleCallback ?? ((e) => window.setTimeout(e, 200)),
            t = window.cancelIdleCallback ?? window.clearTimeout,
            a = e(() => j());
          return () => t(a);
        }, [j, l]);
        let C = (0, r.useCallback)(
            async (e, t, a = {}) => {
              let i = s.current,
                r = d.current,
                o = c.current,
                n = e.filter((e) => e.isConnected);
              if (!i || !r || !o || !n.length) return;
              if (t < 0) {
                n.forEach((e) => {
                  e.style.visibility = "hidden";
                });
                let e = "",
                  t = 0,
                  a = performance.now(),
                  r = a + 1200;
                for (
                  ;
                  (t < 6 || performance.now() - a < 160) &&
                  performance.now() < r;
                ) {
                  await g();
                  let a = [i, ...n]
                    .map((e) => {
                      let t = e.getBoundingClientRect();
                      return `${t.left.toFixed(1)},${t.top.toFixed(1)},${t.width.toFixed(1)},${t.height.toFixed(1)}`;
                    })
                    .join("|");
                  ((t = a === e ? t + 1 : 0), (e = a));
                }
              }
              let l = (e, t, a) => {
                  let i = t > a ? u.T.ease.exit : u.T.ease.enter,
                    r = T.current
                      ? 0
                      : (t > a ? u.T.duration.exit : u.T.duration.standard) *
                        1e3;
                  return e.animate([{ opacity: t }, { opacity: a }], {
                    duration: r,
                    easing: `cubic-bezier(${i.join(",")})`,
                  }).finished;
                },
                h = T.current ? null : j(),
                m = h?.gl ?? null;
              if (!m)
                return void (t > 0
                  ? (await Promise.all(n.map((e) => l(e, 1, 0))),
                    n.forEach((e) => {
                      e.style.visibility = "hidden";
                    }))
                  : (n.forEach((e) => {
                      e.style.visibility = "";
                    }),
                    await Promise.all(n.map((e) => l(e, 0, 1)))));
              let b = i.getBoundingClientRect(),
                y = Math.min(2, window.devicePixelRatio || 1),
                x = Math.max(1, Math.round(b.width * y)),
                R = Math.max(1, Math.round(b.height * y));
              ((o.width = x), (o.height = R));
              let _ = new Set(n),
                A = await w(r),
                E = (e, t) => {
                  let a = document.createElement("canvas");
                  return (
                    (a.width = x),
                    (a.height = R),
                    !(function e(t, a, i, r, o, n, l, s) {
                      if (o.skip?.has(a)) return;
                      o.only?.has(a) && ((l = !0), (s = !0));
                      let d = getComputedStyle(a);
                      if ("none" === d.display) return;
                      let c = parseFloat(d.opacity);
                      if (!s && 0 === c) return;
                      let u = s || "hidden" !== d.visibility,
                        h = a.getBoundingClientRect(),
                        m = (h.left - i.left) * r,
                        f = (h.top - i.top) * r,
                        p = h.width * r,
                        g = h.height * r;
                      if (
                        (t.save(),
                        l && !s && (t.globalAlpha *= c),
                        l && u && p > 0 && g > 0)
                      ) {
                        let e = [
                          d.borderTopLeftRadius,
                          d.borderTopRightRadius,
                          d.borderBottomRightRadius,
                          d.borderBottomLeftRadius,
                        ].map((e) => (parseFloat(e) || 0) * r);
                        v(d.backgroundColor) &&
                          ((t.fillStyle = d.backgroundColor),
                          t.beginPath(),
                          t.roundRect(m, f, p, g, e),
                          t.fill());
                        let i = [
                            d.borderTopWidth,
                            d.borderRightWidth,
                            d.borderBottomWidth,
                            d.borderLeftWidth,
                          ].map((e) => (parseFloat(e) || 0) * r),
                          o = [
                            d.borderTopColor,
                            d.borderRightColor,
                            d.borderBottomColor,
                            d.borderLeftColor,
                          ];
                        if (
                          (i.every((e) => e > 0 && e === i[0]) &&
                          o.every((e) => e === o[0]) &&
                          v(o[0])
                            ? ((t.strokeStyle = o[0]),
                              (t.lineWidth = i[0]),
                              t.beginPath(),
                              t.roundRect(
                                m + i[0] / 2,
                                f + i[0] / 2,
                                p - i[0],
                                g - i[0],
                                e.map((e) => Math.max(0, e - i[0] / 2)),
                              ),
                              t.stroke())
                            : i.forEach((e, a) => {
                                e &&
                                  v(o[a]) &&
                                  ((t.fillStyle = o[a]),
                                  0 === a && t.fillRect(m, f, p, e),
                                  1 === a && t.fillRect(m + p - e, f, e, g),
                                  2 === a && t.fillRect(m, f + g - e, p, e),
                                  3 === a && t.fillRect(m, f, e, g));
                              }),
                          a instanceof HTMLImageElement &&
                            a.complete &&
                            a.naturalWidth)
                        ) {
                          (t.save(),
                            t.beginPath(),
                            t.roundRect(m, f, p, g, e),
                            t.clip());
                          let i = a.naturalWidth / a.naturalHeight,
                            r = p / g,
                            o = "cover" === d.objectFit,
                            n = p,
                            l = g;
                          o && (i > r ? (n = g * i) : (l = p / i));
                          try {
                            t.drawImage(
                              a,
                              m + (p - n) / 2,
                              f + (g - l) / 2,
                              n,
                              l,
                            );
                          } catch {}
                          t.restore();
                        }
                        let l = n.get(a);
                        (l && t.drawImage(l, m, f, p, g),
                          "visible" !== d.overflow &&
                            "visible" !== d.overflowX &&
                            (t.beginPath(),
                            t.roundRect(m, f, p, g, e),
                            t.clip()));
                      }
                      if (
                        a instanceof SVGElement ||
                        a instanceof HTMLImageElement ||
                        a instanceof HTMLCanvasElement
                      )
                        return void t.restore();
                      for (let c of a.childNodes)
                        if (c.nodeType === Node.TEXT_NODE) {
                          if (!l || !u) continue;
                          let e = c.textContent ?? "";
                          if (!e.trim()) continue;
                          ((t.font = `${d.fontStyle} ${d.fontWeight} ${parseFloat(d.fontSize) * r}px ${d.fontFamily}`),
                            (t.fillStyle = d.color),
                            "letterSpacing" in t &&
                              (t.letterSpacing =
                                "normal" === d.letterSpacing
                                  ? "0px"
                                  : `${parseFloat(d.letterSpacing) * r}px`),
                            (t.textBaseline = "alphabetic"));
                          let a = t.measureText("Hg"),
                            o =
                              a.fontBoundingBoxAscent ??
                              parseFloat(d.fontSize) * r * 0.8,
                            n =
                              a.fontBoundingBoxDescent ??
                              parseFloat(d.fontSize) * r * 0.2,
                            s = document.createRange();
                          for (let a of e.matchAll(/\S+/g)) {
                            (s.setStart(c, a.index ?? 0),
                              s.setEnd(c, (a.index ?? 0) + a[0].length));
                            let e = s.getBoundingClientRect();
                            if (!e.width) continue;
                            let l = (e.left - i.left) * r,
                              d = (e.top - i.top) * r,
                              u = e.height * r;
                            t.fillText(a[0], l, d + (u - o - n) / 2 + o);
                          }
                        } else
                          c instanceof Element && e(t, c, i, r, o, n, l, s);
                      t.restore();
                    })(a.getContext("2d"), r, b, y, e, A, t, !1),
                    a
                  );
                },
                C = E({ skip: _ }, !0),
                S = E({ only: _ }, !1),
                M = n.map((e) => e.getBoundingClientRect()),
                F = Math.min(...M.map((e) => e.left)),
                P = Math.max(...M.map((e) => e.right)),
                B = Math.min(...M.map((e) => e.top)),
                N = Math.max(...M.map((e) => e.bottom)),
                L = ((a.origin?.x ?? (F + P) / 2) - b.left) * y,
                D = ((a.origin?.y ?? (B + N) / 2) - b.top) * y,
                U =
                  Math.max(
                    ...M.flatMap((e) =>
                      [
                        [e.left, e.top],
                        [e.right, e.top],
                        [e.left, e.bottom],
                        [e.right, e.bottom],
                      ].map(([e, t]) =>
                        Math.hypot((e - b.left) * y - L, (t - b.top) * y - D),
                      ),
                    ),
                  ) || 1,
                I =
                  "dark" === document.documentElement.dataset.theme ||
                  (!document.documentElement.dataset.theme &&
                    matchMedia("(prefers-color-scheme: dark)").matches),
                W = (function (e, t) {
                  let a = document
                    .createElement("canvas")
                    .getContext("2d", { willReadFrequently: !0 });
                  if (!a || !e) return t;
                  ((a.fillStyle = "#000"),
                    (a.fillStyle = e),
                    a.fillRect(0, 0, 1, 1));
                  let [i, r, o] = a.getImageData(0, 0, 1, 1).data;
                  return [i / 255, r / 255, o / 255];
                })(
                  getComputedStyle(i).getPropertyValue("--accent").trim(),
                  I ? [1, 1, 1] : [0, 0, 0],
                ),
                O = (function (e, t, a, i) {
                  let r = Math.max(1, Math.ceil(t / i)),
                    o = Math.max(1, Math.ceil(a / i)),
                    n = new Float32Array(r * o * 12),
                    l = 0;
                  for (let e = 0; e < o; e++)
                    for (let i = 0; i < r; i++) {
                      let s = (i * t) / r,
                        d = ((i + 1) * t) / r,
                        c = (e * a) / o,
                        u = ((e + 1) * a) / o;
                      (n.set([s, c, d, c, s, u, d, c, d, u, s, u], l),
                        (l += 12));
                    }
                  let s = e.createBuffer();
                  return (
                    e.bindBuffer(e.ARRAY_BUFFER, s),
                    e.bufferData(e.ARRAY_BUFFER, n, e.STATIC_DRAW),
                    { buffer: s, count: r * o * 6 }
                  );
                })(m, x, R, 5 * y),
                Y = {
                  ...h,
                  grid: O.buffer,
                  gridCount: O.count,
                  rest: k(m, C),
                  sel: k(m, S),
                },
                z = (e) => {
                  var t;
                  let a,
                    i = Y.gl;
                  (i.viewport(0, 0, x, R),
                    i.clearColor(0, 0, 0, 0),
                    i.clear(i.COLOR_BUFFER_BIT),
                    i.enable(i.BLEND),
                    i.blendFunc(i.ONE, i.ONE_MINUS_SRC_ALPHA));
                  let r =
                      1 +
                      2.6 * Math.pow((t = p(e, 0, 0.16)) - 1, 3) +
                      1.6 * Math.pow(t - 1, 2),
                    o = (a = p(e, 0.84, 0.92)) * a * a,
                    n = 6.5 * y * (r + 0.35 * p(e, 0.2, 0.8)) * (1 - o),
                    l = p(e, 0.88, 1);
                  (i.useProgram(Y.lens.p),
                    i.bindBuffer(i.ARRAY_BUFFER, Y.quad),
                    i.enableVertexAttribArray(0),
                    i.vertexAttribPointer(0, 2, i.FLOAT, !1, 0, 0),
                    i.activeTexture(i.TEXTURE0),
                    i.bindTexture(i.TEXTURE_2D, Y.rest),
                    i.uniform1i(Y.lens.u("uTex"), 0),
                    i.uniform2f(Y.lens.u("uRes"), x, R),
                    i.uniform2f(Y.lens.u("uO"), L, D),
                    i.uniform1f(Y.lens.u("uLens"), 3.4 * n),
                    i.drawArrays(i.TRIANGLES, 0, 3),
                    i.useProgram(Y.mesh.p),
                    i.bindBuffer(i.ARRAY_BUFFER, Y.grid),
                    i.vertexAttribPointer(0, 2, i.FLOAT, !1, 0, 0),
                    i.bindTexture(i.TEXTURE_2D, Y.sel),
                    i.uniform1i(Y.mesh.u("uTex"), 0),
                    i.uniform2f(Y.mesh.u("uRes"), x, R),
                    i.uniform2f(Y.mesh.u("uO"), L, D),
                    i.uniform1f(Y.mesh.u("uT"), e),
                    i.uniform1f(Y.mesh.u("uMaxR"), U),
                    i.uniform1f(Y.mesh.u("uSpin"), 1.6),
                    i.drawArrays(i.TRIANGLES, 0, Y.gridCount),
                    i.useProgram(Y.core.p),
                    i.bindBuffer(i.ARRAY_BUFFER, Y.quad),
                    i.vertexAttribPointer(0, 2, i.FLOAT, !1, 0, 0),
                    i.uniform2f(Y.core.u("uRes"), x, R),
                    i.uniform2f(Y.core.u("uO"), L, D),
                    i.uniform1f(Y.core.u("uCore"), n),
                    i.uniform1f(
                      Y.core.u("uWave"),
                      90 * (1 - Math.pow(1 - l, 3)) * y,
                    ),
                    i.uniform1f(
                      Y.core.u("uWaveAlpha"),
                      l > 0 ? (1 - l) * (1 - l) : 0,
                    ),
                    i.uniform1f(Y.core.u("uDark"), +!!I),
                    i.uniform1f(Y.core.u("uPx"), y),
                    i.uniform3f(Y.core.u("uAccent"), ...W),
                    i.drawArrays(i.TRIANGLES, 0, 3));
                },
                X = (a.duration ?? 1.3) * (t < 0 ? 0.92 : 1) * 1e3,
                H = t > 0 ? 0 : 1;
              (z(H),
                (o.style.visibility = "visible"),
                (r.style.visibility = "hidden"));
              let $ = await g();
              for (; t > 0 ? H < 1 : H > 0;) {
                let e = f(((await g()) - $) / X);
                z((H = t > 0 ? e : 1 - e));
              }
              (n.forEach((e) => {
                e.style.visibility = t > 0 ? "hidden" : "";
              }),
                (r.style.visibility = ""),
                (o.style.visibility = "hidden"));
              let G = Y.gl;
              (G.deleteTexture(Y.rest),
                G.deleteTexture(Y.sel),
                G.deleteBuffer(Y.grid),
                G.clearColor(0, 0, 0, 0),
                G.clear(G.COLOR_BUFFER_BIT));
            },
            [j],
          ),
          S = (0, r.useCallback)(
            (e, t, a) => {
              t < 0 &&
                e.forEach((e) => {
                  e.style.visibility = "hidden";
                });
              let i = h.current
                .then(() => C(e, t, a))
                .catch(() => {
                  (e.forEach((e) => {
                    e.style.visibility = t > 0 ? "hidden" : "";
                  }),
                    d.current && (d.current.style.visibility = ""));
                });
              return ((h.current = i), i);
            },
            [C],
          );
        return (
          (0, r.useImperativeHandle)(
            n,
            () => ({
              swallow: (e, t) => S(e, 1, t),
              release: (e, t) => S(e, -1, t),
            }),
            [S],
          ),
          (0, i.jsxs)("div", {
            ref: s,
            className: [m().root, t].filter(Boolean).join(" "),
            style: a,
            children: [
              (0, i.jsx)("div", {
                ref: d,
                className: m().content,
                children: e,
              }),
              (0, i.jsx)("canvas", {
                ref: c,
                className: m().canvas,
                "aria-hidden": !0,
              }),
            ],
          })
        );
      });
      var E = a(67752),
        j = a(4596),
        C = a.n(j);
      let S = [
        {
          id: "a",
          from: E.c0[0],
          subject: "Onboarding copy, second pass",
          time: "9:41",
        },
        {
          id: "b",
          from: E.c0[1],
          subject: "Your weekly usage report",
          time: "9:12",
        },
        {
          id: "c",
          from: E.c0[2],
          subject: "Design review moved to Thursday",
          time: "8:30",
        },
        {
          id: "d",
          from: E.c0[3],
          subject: "Invoice 2381 is ready",
          time: "Yesterday",
        },
        {
          id: "e",
          from: E.c0[4],
          subject: "Quarterly planning notes",
          time: "Yesterday",
        },
      ];
      function M() {
        let e = !!(0, o.I)(),
          t = (0, r.useRef)(null),
          a = (0, r.useRef)(new Map()),
          [h, m] = (0, r.useState)(S),
          [f, p] = (0, r.useState)(["b", "d"]),
          [g, v] = (0, r.useState)([]),
          [w, b] = (0, r.useState)([]),
          [y, x] = (0, r.useState)(!1),
          R = async () => {
            !f.length ||
              y ||
              (x(!0),
              await t.current?.swallow(
                f.map((e) => a.current.get(e)).filter(Boolean),
              ),
              v(S.filter((e) => f.includes(e.id))),
              m((e) => e.filter((e) => !f.includes(e.id))),
              p([]),
              x(!1));
          };
        ((0, r.useLayoutEffect)(() => {
          if (!w.length) return;
          let e = w.map((e) => a.current.get(e)).filter(Boolean);
          t.current?.release(e).then(() => {
            (b([]), x(!1));
          });
        }, [w]),
          (0, r.useEffect)(() => {
            let e = (e) => {
              ("Backspace" === e.key || "Delete" === e.key) &&
                f.length &&
                e.target?.closest?.("[data-inbox]") &&
                (e.preventDefault(), R());
            };
            return (
              window.addEventListener("keydown", e),
              () => window.removeEventListener("keydown", e)
            );
          }));
        let _ = e ? { duration: 0 } : u.T.spring.smooth;
        return (0, i.jsxs)("div", {
          className: C().demo,
          "data-inbox": !0,
          children: [
            (0, i.jsxs)("div", {
              className: C().panel,
              children: [
                (0, i.jsxs)("div", {
                  className: C().head,
                  children: [
                    (0, i.jsx)("span", {
                      className: C().title,
                      children: "Inbox",
                    }),
                    (0, i.jsx)(n.N, {
                      initial: !1,
                      mode: "popLayout",
                      children:
                        f.length > 0 &&
                        (0, i.jsx)(
                          l.PY1.div,
                          {
                            initial: {
                              opacity: 0,
                              scale: 0.96,
                              filter: "blur(4px)",
                            },
                            animate: {
                              opacity: 1,
                              scale: 1,
                              filter: "blur(0px)",
                            },
                            exit: {
                              opacity: 0,
                              scale: 0.96,
                              filter: "blur(4px)",
                            },
                            transition: { duration: u.T.duration.fast },
                            children: (0, i.jsxs)(c.A, {
                              variant: "secondary",
                              size: "sm",
                              onClick: R,
                              disabled: y,
                              children: [
                                (0, i.jsx)(s.A, {
                                  size: 16,
                                  strokeWidth: 1.75,
                                  "aria-hidden": !0,
                                }),
                                "Delete ",
                                f.length,
                              ],
                            }),
                          },
                          "delete",
                        ),
                    }),
                  ],
                }),
                (0, i.jsx)(T, {
                  ref: t,
                  children: (0, i.jsx)("ul", {
                    className: C().list,
                    children: (0, i.jsx)(n.N, {
                      initial: !1,
                      children: h.map((e) => {
                        let t = f.includes(e.id);
                        return (0, i.jsx)(
                          l.PY1.li,
                          {
                            ref: (t) => {
                              t
                                ? a.current.set(e.id, t)
                                : a.current.delete(e.id);
                            },
                            className: C().item,
                            layout: "position",
                            initial: { height: 0 },
                            animate: { height: "auto" },
                            exit: { height: 0 },
                            transition: { height: _, layout: _ },
                            children: (0, i.jsxs)("button", {
                              type: "button",
                              role: "checkbox",
                              "aria-checked": t,
                              className: C().row,
                              "data-on": t || void 0,
                              onClick: () => {
                                let t;
                                return (
                                  (t = e.id),
                                  p((e) =>
                                    e.includes(t)
                                      ? e.filter((e) => e !== t)
                                      : [...e, t],
                                  )
                                );
                              },
                              disabled: y,
                              children: [
                                (0, i.jsx)("span", {
                                  className: C().check,
                                  "aria-hidden": !0,
                                  children:
                                    t &&
                                    (0, i.jsx)(d.A, {
                                      size: 12,
                                      strokeWidth: 2.5,
                                    }),
                                }),
                                (0, i.jsx)("img", {
                                  className: C().avatar,
                                  src: e.from.src,
                                  alt: "",
                                  width: 32,
                                  height: 32,
                                  draggable: !1,
                                }),
                                (0, i.jsxs)("span", {
                                  className: C().text,
                                  children: [
                                    (0, i.jsx)("span", {
                                      className: C().name,
                                      children: e.from.name,
                                    }),
                                    (0, i.jsx)("span", {
                                      className: C().subject,
                                      children: e.subject,
                                    }),
                                  ],
                                }),
                                (0, i.jsx)("span", {
                                  className: C().time,
                                  children: e.time,
                                }),
                              ],
                            }),
                          },
                          e.id,
                        );
                      }),
                    }),
                  }),
                }),
              ],
            }),
            (0, i.jsx)("div", {
              className: C().status,
              children: (0, i.jsx)(n.N, {
                initial: !1,
                children:
                  g.length > 0 &&
                  (0, i.jsxs)(
                    l.PY1.div,
                    {
                      className: C().toast,
                      initial: { opacity: 0, y: 6, filter: "blur(4px)" },
                      animate: { opacity: 1, y: 0, filter: "blur(0px)" },
                      exit: { opacity: 0, y: 4, filter: "blur(4px)" },
                      transition: u.T.spring.smooth,
                      children: [
                        (0, i.jsx)("span", {
                          role: "status",
                          children:
                            1 === g.length
                              ? "1 conversation deleted"
                              : `${g.length} conversations deleted`,
                        }),
                        (0, i.jsx)(c.A, {
                          variant: "ghost",
                          size: "sm",
                          onClick: () => {
                            if (!g.length || y) return;
                            let e = g.map((e) => e.id);
                            (x(!0),
                              m((t) =>
                                S.filter(
                                  (a) =>
                                    e.includes(a.id) ||
                                    t.some((e) => e.id === a.id),
                                ),
                              ),
                              b(e),
                              v([]));
                          },
                          children: "Undo",
                        }),
                      ],
                    },
                    "toast",
                  ),
              }),
            }),
          ],
        });
      }
      let F = M;
    },
    25879: (e, t, a) => {
      "use strict";
      a.d(t, { A: () => o });
      var i = a(51811);
      let r = {
        name: "trash",
        size: 24,
        node: [
          ["path", { d: "M10 11v6", key: "nco0om" }],
          ["path", { d: "M14 11v6", key: "outv1u" }],
          [
            "path",
            { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", key: "miytrc" },
          ],
          ["path", { d: "M3 6h18", key: "d0wm0j" }],
          [
            "path",
            { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", key: "e791ji" },
          ],
        ],
        aliases: ["trash-2"],
      };
      r.node;
      let o = (0, i.A)(r);
    },
    64577: (e, t, a) => {
      "use strict";
      a.d(t, { A: () => o });
      var i = a(51811);
      let r = {
        name: "check",
        size: 24,
        node: [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]],
      };
      r.node;
      let o = (0, i.A)(r);
    },
    67752: (e, t, a) => {
      "use strict";
      a.d(t, {
        KQ: () => r,
        MV: () => o,
        c0: () => i,
        jW: () => n,
        my: () => l,
        o4: () => s,
      });
      let i = [
          {
            id: "emma-collins",
            name: "Emma Collins",
            role: "Product designer",
            src: "/media/people/emma-collins.svg",
          },
          {
            id: "marcus-johnson",
            name: "Marcus Johnson",
            role: "Frontend engineer",
            src: "/media/people/marcus-johnson.svg",
          },
          {
            id: "jasmine-brooks",
            name: "Jasmine Brooks",
            role: "Design lead",
            src: "/media/people/jasmine-brooks.svg",
          },
          {
            id: "olivia-bennett",
            name: "Olivia Bennett",
            role: "Platform engineer",
            src: "/media/people/olivia-bennett.svg",
          },
          {
            id: "sofia-ramirez",
            name: "Sofia Ramirez",
            role: "Operations lead",
            src: "/media/people/sofia-ramirez.svg",
          },
          {
            id: "ryan-sullivan",
            name: "Ryan Sullivan",
            role: "Account executive",
            src: "/media/people/ryan-sullivan.svg",
          },
          {
            id: "hannah-walsh",
            name: "Hannah Walsh",
            role: "Customer success",
            src: "/media/people/hannah-walsh.svg",
          },
          {
            id: "chloe-nguyen",
            name: "Chloe Nguyen",
            role: "Data analyst",
            src: "/media/people/chloe-nguyen.svg",
          },
          {
            id: "ava-mitchell",
            name: "Ava Mitchell",
            role: "Marketing manager",
            src: "/media/people/ava-mitchell.svg",
          },
          {
            id: "daniel-kim",
            name: "Daniel Kim",
            role: "Backend engineer",
            src: "/media/people/daniel-kim.svg",
          },
          {
            id: "jordan-reyes",
            name: "Jordan Reyes",
            role: "Support specialist",
            src: "/media/people/jordan-reyes.svg",
          },
          {
            id: "mateo-alvarez",
            name: "Mateo Alvarez",
            role: "Mobile engineer",
            src: "/media/people/mateo-alvarez.svg",
          },
          {
            id: "tyler-hayes",
            name: "Tyler Hayes",
            role: "Sales lead",
            src: "/media/people/tyler-hayes.svg",
          },
          {
            id: "andre-williams",
            name: "Andre Williams",
            role: "Finance partner",
            src: "/media/people/andre-williams.svg",
          },
          {
            id: "nathan-cole",
            name: "Nathan Cole",
            role: "Engineering manager",
            src: "/media/people/nathan-cole.svg",
          },
          {
            id: "diane-foster",
            name: "Diane Foster",
            role: "Chief operating officer",
            src: "/media/people/diane-foster.svg",
          },
        ],
        r = [
          {
            id: "lounge-chair",
            alt: "A woven oak lounge chair with a sheepskin and linen cushion on a concrete floor",
            src: "/media/photos/lounge-chair.jpg",
            width: 1280,
            height: 1600,
          },
          {
            id: "table-lamp",
            alt: "A white mushroom table lamp glowing beside books and a small vase",
            src: "/media/photos/table-lamp.jpg",
            width: 1600,
            height: 900,
          },
          {
            id: "linen-throw",
            alt: "Folded natural linen throws with fringed edges in soft window light",
            src: "/media/photos/linen-throw.jpg",
            width: 1067,
            height: 1600,
          },
          {
            id: "glass-carafe",
            alt: "A hand pouring water from a ribbed glass carafe into tumblers",
            src: "/media/photos/glass-carafe.jpg",
            width: 1280,
            height: 1600,
          },
          {
            id: "stoneware-cups",
            alt: "Two speckled stoneware cups with a lid on a pale table",
            src: "/media/photos/stoneware-cups.jpg",
            width: 1067,
            height: 1600,
          },
          {
            id: "stacked-bowls",
            alt: "Two stacked speckled ceramic bowls against a dark wall",
            src: "/media/photos/stacked-bowls.jpg",
            width: 1600,
            height: 1067,
          },
          {
            id: "ceramic-lamp",
            alt: "A sculptural ceramic lamp with a linen shade on a walnut sideboard",
            src: "/media/photos/ceramic-lamp.jpg",
            width: 1067,
            height: 1600,
          },
          {
            id: "living-room",
            alt: "A bright living room with timber beams, arched windows, and cream sofas",
            src: "/media/photos/living-room.jpg",
            width: 1200,
            height: 1600,
          },
          {
            id: "sunroom",
            alt: "A sunroom with a round dining table, plants, and windows on three sides",
            src: "/media/photos/sunroom.jpg",
            width: 1600,
            height: 1067,
          },
          {
            id: "home-office",
            alt: "A home office with a wooden desk and deep green walls",
            src: "/media/photos/home-office.jpg",
            width: 1600,
            height: 1200,
          },
          {
            id: "reading-chair",
            alt: "A grey armchair and ottoman with a knit throw in a dark green room",
            src: "/media/photos/reading-chair.jpg",
            width: 1600,
            height: 900,
          },
          {
            id: "bedroom",
            alt: "A made bed with striped linen pillows against an oak headboard",
            src: "/media/photos/bedroom.jpg",
            width: 1067,
            height: 1600,
          },
          {
            id: "restaurant",
            alt: "A warm restaurant dining room with woven pendant lights and a tree",
            src: "/media/photos/restaurant.jpg",
            width: 1067,
            height: 1600,
          },
          {
            id: "wine-bar",
            alt: "A glass carafe of red wine on a bar table in low evening light",
            src: "/media/photos/wine-bar.jpg",
            width: 1600,
            height: 1067,
          },
          {
            id: "concert-hall",
            alt: "Curved stainless steel panels of the Walt Disney Concert Hall against a blue sky",
            src: "/media/photos/concert-hall.jpg",
            width: 1600,
            height: 1143,
          },
          {
            id: "curved-facade",
            alt: "A white tiled building facade with curved balconies",
            src: "/media/photos/curved-facade.jpg",
            width: 1600,
            height: 1067,
          },
          {
            id: "pool-house",
            alt: "A modern glass house beside a long pool under a clear sky",
            src: "/media/photos/pool-house.jpg",
            width: 1600,
            height: 900,
          },
          {
            id: "terracotta-waves",
            alt: "Wavy terracotta walls rising toward a blue sky",
            src: "/media/photos/terracotta-waves.jpg",
            width: 1067,
            height: 1600,
          },
          {
            id: "mountain-ridges",
            alt: "Layered mountain ridges under a warm evening sky",
            src: "/media/photos/mountain-ridges.jpg",
            width: 1600,
            height: 1068,
          },
          {
            id: "alpine-lake",
            alt: "A calm alpine lake reflecting a rocky peak at golden hour",
            src: "/media/photos/alpine-lake.jpg",
            width: 1067,
            height: 1600,
          },
          {
            id: "coastline",
            alt: "A long coastline with waves rolling onto a beach below green cliffs",
            src: "/media/photos/coastline.jpg",
            width: 1200,
            height: 1600,
          },
          {
            id: "sea-at-dusk",
            alt: "A calm sea at dusk with a low island on the horizon",
            src: "/media/photos/sea-at-dusk.jpg",
            width: 1067,
            height: 1600,
          },
          {
            id: "lisbon-tram",
            alt: "A yellow tram on a street lined with historic buildings in Lisbon",
            src: "/media/photos/lisbon-tram.jpg",
            width: 1600,
            height: 1064,
          },
          {
            id: "lisbon-bridge",
            alt: "The 25 de Abril Bridge crossing the Tagus in Lisbon",
            src: "/media/photos/lisbon-bridge.jpg",
            width: 1600,
            height: 1166,
          },
          {
            id: "lisbon-rooftops",
            alt: "Terracotta rooftops of Lisbon running down to the river",
            src: "/media/photos/lisbon-rooftops.jpg",
            width: 1280,
            height: 1600,
          },
          {
            id: "salmon-dinner",
            alt: "Seared salmon with a bright herb salsa and a glass of red wine",
            src: "/media/photos/salmon-dinner.jpg",
            width: 1067,
            height: 1600,
          },
          {
            id: "chef-plating",
            alt: "A chef spooning sauce onto a plated dish in a dark kitchen",
            src: "/media/photos/chef-plating.jpg",
            width: 1600,
            height: 1600,
          },
        ];
      function o(e) {
        return i.find((t) => t.id === e);
      }
      function n(e) {
        return r.find((t) => t.id === e);
      }
      let l = (e) => o(e).src,
        s = (e) => `/media/people/portrait/${e}.svg`;
    },
  },
]);
