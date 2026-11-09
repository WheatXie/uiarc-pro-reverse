"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MotionValue, TargetAndTransition, Transition } from "motion/react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./voice-orb.module.css";

export type VoiceOrbState = "idle" | "listening" | "thinking" | "speaking";

/** The nine shape parameters every state animates: each one springs toward its target every frame. */
interface OrbShape {
  breath: number;
  wobble: number;
  flow: number;
  swirl: number;
  gain: number;
  ring: number;
  shimmer: number;
  halo: number;
  grow: number;
  mute: number;
}

const shapes: Record<VoiceOrbState, OrbShape> = {
  idle: { breath: 0.028, wobble: 0.014, flow: 0.32, swirl: 0.1, gain: 0, ring: 0, shimmer: 0, halo: 0.55, grow: 0, mute: 0 },
  listening: { breath: 0.01, wobble: 0.022, flow: 0.7, swirl: 0.22, gain: 0.15, ring: 1, shimmer: 0, halo: 0.75, grow: 0.03, mute: 0 },
  thinking: { breath: 0.012, wobble: 0.03, flow: 0.55, swirl: 1.25, gain: 0, ring: 0, shimmer: 1, halo: 0.6, grow: -0.08, mute: 0 },
  speaking: { breath: 0.006, wobble: 0.026, flow: 0.95, swirl: 0.3, gain: 0.19, ring: 0, shimmer: 0, halo: 0.9, grow: 0.02, mute: 0 },
};

/** Muted is listening with the lights down: no ring, no gain, a slower drift and desaturated colour. */
const mutedShape: OrbShape = { ...shapes.listening, gain: 0, ring: 0, flow: 0.25, wobble: 0.01, halo: 0.3, grow: -0.02, mute: 1 };

const shapeKeys = Object.keys(shapes.idle) as (keyof OrbShape)[];

const stateLabels: Record<VoiceOrbState, string> = {
  idle: "Voice assistant is idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const mix = (a: readonly number[], b: readonly number[], t: number): number[] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const rgba = (color: readonly number[], alpha: number) => `rgba(${0 | color[0]},${0 | color[1]},${0 | color[2]},${clamp(alpha).toFixed(3)})`;

interface Palette {
  c1: number[];
  c2: number[];
  c3: number[];
  dark: boolean;
}

/** Re-reads the theme colours: the background decides dark mode, --voice-orb-tint (or --accent) the light,
 *  and --voice-orb-tint-2 the second light. With only a tint set, the second light is a hue-shifted cousin of it. */
function readPalette(element: HTMLElement): Palette {
  const computed = getComputedStyle(element);
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const context = probe.getContext("2d", { willReadFrequently: true });

  const read = (properties: string[], fallback: number[]): number[] => {
    const value = properties.map((property) => computed.getPropertyValue(property).trim()).find(Boolean);
    if (!context || !value) return fallback;
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#000";
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2]];
  };

  const background = read(["--background"], [255, 255, 255]);
  const dark = 0.299 * background[0] + 0.587 * background[1] + 0.114 * background[2] < 128;
  const tint = read(["--voice-orb-tint", "--accent"], [90, 90, 90]);
  const explicit = computed.getPropertyValue("--voice-orb-tint-2").trim();
  const second = explicit ? read(["--voice-orb-tint-2"], tint) : shiftHue(tint, dark ? 0.08 : 0.14);

  return { c1: tint, c2: second, c3: mix(tint, [255, 255, 255], dark ? 0.78 : 0.72), dark };
}

/** Rotates the tint's hue by a fixed amount and lifts its saturation: the second light stays in the same family. */
function shiftHue([r, g, b]: number[], lift: number): number[] {
  const red = r / 255, green = g / 255, blue = b / 255;
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta < 1e-4) return mix([r, g, b], [255, 255, 255], lift);
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  const degrees = (((60 * hue + 26) % 360) + 360) % 360;
  const nextLightness = clamp(lightness + lift * (1 - lightness));
  const chroma = (1 - Math.abs(2 * nextLightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((degrees / 60) % 2) - 1));
  const base = nextLightness - chroma / 2;
  const [nr, ng, nb] = degrees < 60 ? [chroma, second, 0]
    : degrees < 120 ? [second, chroma, 0]
      : degrees < 180 ? [0, chroma, second]
        : degrees < 240 ? [0, second, chroma]
          : degrees < 300 ? [second, 0, chroma]
            : [chroma, 0, second];
  return [(nr + base) * 255, (ng + base) * 255, (nb + base) * 255];
}

/** Deterministic speech envelope: a fast syllable wave under a slow breath, used when no level is supplied. */
function simulatedWave(time: number, drift = 0): number {
  const t = time + 7.3 * drift;
  const syllable = Math.pow(Math.max(0, 0.5 * Math.sin(7.2 * t) + 0.5 * Math.sin(11.3 * t + 1.2)), 1.4);
  const breath = clamp(0.7 * Math.sin(1.15 * t) + 0.55);
  return clamp(syllable * breath * 1.1);
}

const noopSubscribe = () => () => {};

/** True once hydrated, so the first server render never commits a reduced-motion still frame. */
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function usePrefersStill() {
  return (useReducedMotion() ?? false) && useMounted();
}

const FRAGMENT_SHADER = `precision highp float;
uniform vec2 uRes;
uniform float uTime, uSwirl, uScale, uWobble, uVoice, uRing, uRingPhase, uShimmer, uShimmerAngle, uHalo, uMute, uBright, uDark;
uniform vec3 uC1, uC2, uC3;
vec3 permute(vec3 x){return mod(((x*34.)+1.)*x,289.);}
float snoise(vec2 v){
  const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.);
  vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
  vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
  vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;
  m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.*dot(m,g);
}
void main(){
  vec2 p=(gl_FragCoord.xy/uRes-.5)*2./0.60;
  float r=length(p), ang=atan(p.y,p.x), t=uTime;
  float edge=uScale*(1.+uWobble*(.55*sin(2.*ang+t*.9)+.3*sin(3.*ang-t*1.3)+.15*sin(5.*ang+t*2.1))
    +uVoice*(.05*sin(4.*ang+t*3.1)+.035*sin(7.*ang-t*2.4)));
  float px=2./(0.60*uRes.x);
  float inside=1.-smoothstep(edge-px,edge+px,r);
  vec2 q=p/edge; float rr=min(length(q),1.); float z=sqrt(1.-rr*rr);
  float sw=uSwirl*(1.-rr*.55); vec2 f=mat2(cos(sw),-sin(sw),sin(sw),cos(sw))*q;
  f/=(.55+.45*z);
  vec2 w=vec2(snoise(f*.55+vec2(0.,t*.3)),snoise(f*.55+vec2(5.2,-t*.27)));
  float n1=snoise(f*.62+w*.5+vec2(t*.16,1.7));
  float n2=snoise(f*.9-w*.4+vec2(-t*.2,3.1));
  vec3 col=mix(uC1,uC2,smoothstep(-.9,.9,n1));
  col=mix(col,uC3,smoothstep(0.,1.,n2)*.42);
  float light=dot(normalize(vec3(q*.9,z)),normalize(vec3(-.45,.55,.75)));
  col*=.8+.28*light;
  col=mix(col,uC3,pow(1.-z,2.6)*.5);
  col=mix(col,uC3,clamp(uBright,0.,1.)*(.35+.65*z));
  float da=atan(sin(ang-uShimmerAngle),cos(ang-uShimmerAngle));
  float db=atan(sin(ang-uShimmerAngle+3.14159),cos(ang-uShimmerAngle+3.14159));
  float band=(exp(-da*da*1.8)+.5*exp(-db*db*3.))*smoothstep(.1,.95,rr);
  col=mix(col,mix(uC3,vec3(1.),.7),band*uShimmer*.85);
  vec2 h=q-vec2(-.36,.42); col+=vec3(1.)*exp(-dot(h,h)*8.)*.2;
  col=mix(col,vec3(dot(col,vec3(.299,.587,.114))),uMute*.7);
  col=clamp(col,0.,1.);
  float d=max(r-edge,0.);
  float fade=1.-smoothstep(1.2,1.62,r);
  float halo=exp(-d*(uDark>.5?3.2:4.2))*uHalo*fade;
  float ring=0.;
  for(int i=0;i<3;i++){
    float ph=fract(uRingPhase+float(i)/3.);float rad=edge+.06+ph*.5;float wd=.018+ph*.03;
    float k=(r-rad)/wd; ring+=exp(-k*k)*(1.-ph)*(1.-ph)*smoothstep(0.,.12,ph);
  }
  ring*=uRing*fade;
  float oa=clamp(halo+ring*.5,0.,1.)*(1.-inside);
  vec3 glow=uDark>.5?mix(uC1,uC3,.35):uC1;
  vec3 outc=col*inside+glow*oa;
  gl_FragColor=vec4(outc,inside+oa);
}`;

interface OrbFrame {
  p: OrbShape;
  time: number;
  swirl: number;
  ringPhase: number;
  shimmerAngle: number;
  level: number;
  clock: number;
}

interface OrbRenderer {
  setPalette(palette: Palette): void;
  draw(frame: OrbFrame): void;
  dispose(): void;
}

function createWebGlRenderer(canvas: HTMLCanvasElement, palette: Palette): OrbRenderer | null {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}");
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const attribute = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(attribute);
  gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);

  const names = ["uRes", "uTime", "uSwirl", "uScale", "uWobble", "uVoice", "uRing", "uRingPhase", "uShimmer", "uShimmerAngle", "uHalo", "uMute", "uBright", "uDark", "uC1", "uC2", "uC3"];
  const uniforms = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])) as Record<string, WebGLUniformLocation | null>;

  const setPalette = (next: Palette) => {
    gl.uniform3f(uniforms.uC1, next.c1[0] / 255, next.c1[1] / 255, next.c1[2] / 255);
    gl.uniform3f(uniforms.uC2, next.c2[0] / 255, next.c2[1] / 255, next.c2[2] / 255);
    gl.uniform3f(uniforms.uC3, next.c3[0] / 255, next.c3[1] / 255, next.c3[2] / 255);
    gl.uniform1f(uniforms.uDark, +!!next.dark);
  };
  setPalette(palette);

  return {
    setPalette,
    draw({ p, time, swirl, ringPhase, shimmerAngle, level, clock }) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
      const voice = level * p.gain;
      gl.uniform1f(uniforms.uTime, time);
      gl.uniform1f(uniforms.uSwirl, swirl);
      gl.uniform1f(uniforms.uScale, 1 + p.grow + p.breath * Math.sin(1.25 * clock) + 0.9 * voice);
      gl.uniform1f(uniforms.uWobble, p.wobble);
      gl.uniform1f(uniforms.uVoice, 2.6 * voice);
      gl.uniform1f(uniforms.uRing, p.ring * (0.35 + 0.9 * level));
      gl.uniform1f(uniforms.uRingPhase, ringPhase);
      gl.uniform1f(uniforms.uShimmer, p.shimmer);
      gl.uniform1f(uniforms.uShimmerAngle, shimmerAngle);
      gl.uniform1f(uniforms.uHalo, p.halo * (0.2 + 1.6 * voice) + 0.08 * p.shimmer);
      gl.uniform1f(uniforms.uMute, p.mute);
      gl.uniform1f(uniforms.uBright, 2.2 * voice);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    },
  };
}

/** Canvas 2D stand-in for machines without WebGL: the same gradients, ripples and highlight, drawn flat. */
function createCanvasRenderer(canvas: HTMLCanvasElement, initial: Palette): OrbRenderer | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  let palette = initial;
  return {
    setPalette(next) {
      palette = next;
    },
    draw({ p, time, ringPhase, level, clock }) {
      const size = canvas.width;
      const center = size / 2;
      const voice = level * p.gain;
      const radius = 0.6 * center * (1 + p.grow + p.breath * Math.sin(1.25 * clock) + 0.9 * voice);
      context.clearRect(0, 0, size, size);

      const halo = context.createRadialGradient(center, center, radius, center, center, center);
      halo.addColorStop(0, rgba(palette.c1, p.halo * (0.2 + 2.2 * voice) * 0.6));
      halo.addColorStop(1, rgba(palette.c1, 0));
      context.fillStyle = halo;
      context.fillRect(0, 0, size, size);

      for (let ring = 0; ring < 3 && p.ring > 0.01; ring++) {
        const phase = (ringPhase + ring / 3) % 1;
        context.beginPath();
        context.arc(center, center, radius * (1.06 + 0.5 * phase), 0, 2 * Math.PI);
        context.strokeStyle = rgba(palette.c1, p.ring * (0.35 + 0.9 * level) * (1 - phase) * (1 - phase) * 0.4);
        context.lineWidth = 0.008 * size;
        context.stroke();
      }

      const body = context.createRadialGradient(center - 0.36 * radius, center - 0.42 * radius, 0.05 * radius, center, center, radius);
      body.addColorStop(0, rgba(palette.c3, 1));
      body.addColorStop(0.45, rgba(mix(palette.c2, palette.c3, 2 * voice), 1));
      body.addColorStop(1, rgba(palette.c1, 1));
      context.beginPath();
      context.arc(center + Math.sin(time) * radius * p.wobble, center, radius, 0, 2 * Math.PI);
      context.fillStyle = body;
      context.fill();
    },
    dispose() {},
  };
}

export interface VoiceOrbProps {
  /** Current voice state. Every shape parameter springs toward the new state, so changes blend mid-motion. */
  state: VoiceOrbState;
  /** Microphone level from 0 to 1, read every frame while listening, such as useMicLevel().level. Simulated when omitted. */
  inputLevel?: MotionValue<number>;
  /** Voice level from 0 to 1 while speaking. A deterministic speech envelope is used when omitted. */
  outputLevel?: MotionValue<number>;
  /** Calms and desaturates the orb while listening and ignores the input level. */
  muted?: boolean;
  /** Rendered width and height in px. The sphere fills about 60% of it; the rest holds its light and ripples. */
  size?: number;
  /** Accessible description. Defaults to a sentence about the state, or "Muted" while listening muted. */
  label?: string;
  /** Extra class on the canvas. */
  className?: string;
}

/** A luminous fluid sphere drawn with WebGL: idle breathes, listening ripples with the microphone,
 *  thinking orbits a band of light, and speaking brightens with the voice. Falls back to a canvas
 *  gradient without WebGL and draws one still frame under reduced motion. */
export function VoiceOrb({ state, inputLevel, outputLevel, muted = false, size = 208, label, className }: VoiceOrbProps) {
  const still = usePrefersStill();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ state, muted, inputLevel, outputLevel });
  useLayoutEffect(() => {
    props.current = { state, muted, inputLevel, outputLevel };
  });
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.height = Math.round(size * Math.min(2, window.devicePixelRatio || 1));
    let palette = readPalette(canvas);
    const renderer = createWebGlRenderer(canvas, palette) ?? createCanvasRenderer(canvas, palette);
    if (!renderer) return;

    // Muted listening swaps in its own calmed target set; every other state reads its table row.
    const target = () => (props.current.state === "listening" && props.current.muted ? mutedShape : shapes[props.current.state]);
    const values: OrbShape = { ...target() };
    const velocity: Record<string, number> = Object.fromEntries(shapeKeys.map((key) => [key, 0]));
    const frame: OrbFrame = { p: values, time: 0, swirl: 0, ringPhase: 0, shimmerAngle: 0, level: 0, clock: 0 };
    let previous = performance.now();
    let raf = 0;
    let visible = true;

    const stillFrame = () => {
      renderer.draw({ p: target(), time: 1.2, swirl: 0.6, ringPhase: 0.35, shimmerAngle: 2.2, level: props.current.state === "speaking" ? 0.4 : 0.3 * +(props.current.state === "listening" && !props.current.muted), clock: 0 });
    };

    const tick = (now: number) => {
      const delta = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      frame.clock += delta;
      const next = target();
      for (const key of shapeKeys) {
        velocity[key] += (40 * (next[key] - values[key]) - 12.6 * velocity[key]) * delta;
        values[key] += velocity[key] * delta;
      }
      const { state: current, muted: isMuted, inputLevel: input, outputLevel: output } = props.current;
      const level = current !== "listening" || isMuted
        ? current === "speaking" ? output?.get() ?? simulatedWave(frame.clock) : 0
        : input?.get() ?? 0.7 * simulatedWave(frame.clock, 3);
      frame.level += (clamp(level) - frame.level) * (1 - Math.exp(-delta * (level > frame.level ? 18 : 5)));
      frame.time += delta * (values.flow + frame.level * values.gain * 3);
      frame.swirl += delta * values.swirl;
      frame.ringPhase = (frame.ringPhase + delta * (0.42 + 0.5 * frame.level)) % 1;
      frame.shimmerAngle -= 2.3 * delta;
      renderer.draw(frame);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (still || raf || !visible || document.hidden) return;
      previous = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    redraw.current = () => {
      if (still) stillFrame();
    };

    // Theme colours are CSS variables, so a theme or accent flip means repainting the palette.
    const rereadPalette = () => {
      palette = readPalette(canvas);
      renderer.setPalette(palette);
      if (still) stillFrame();
    };
    const themeObserver = new MutationObserver(rereadPalette);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-accent"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", rereadPalette);

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    intersection.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (still) stillFrame();
    else start();

    return () => {
      stop();
      themeObserver.disconnect();
      intersection.disconnect();
      scheme.removeEventListener("change", rereadPalette);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
    };
  }, [size, still]);

  useEffect(() => {
    redraw.current();
  }, [state, muted]);

  return (
    <canvas
      key={still ? "still" : "live"}
      ref={canvasRef}
      className={[styles.orb, className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
      data-state={state}
      data-reduced={still ? "" : undefined}
      role="img"
      aria-label={label ?? (state === "listening" && muted ? "Muted" : stateLabels[state])}
    />
  );
}

export type MicSource = "off" | "requesting" | "simulated" | "microphone";

/** Reads the microphone as a motion value while enabled and never records: an RMS level from a 1024-sample
 *  analyser, or a simulated voice when the microphone is denied or missing. */
export function useMicLevel(enabled: boolean): { level: MotionValue<number>; source: MicSource } {
  const level = useMotionValue(0);
  const [source, setSource] = useState<MicSource>("off");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let audio: AudioContext | null = null;

    const fallback = () => {
      setSource("simulated");
      const started = performance.now();
      const loop = (now: number) => {
        level.set(0.8 * simulatedWave((now - started) / 1000, 3));
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
        fallback();
        return;
      }
      setSource("requesting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        audio = new AudioContext();
        const analyser = audio.createAnalyser();
        analyser.fftSize = 1024;
        audio.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        setSource("microphone");
        const loop = () => {
          analyser.getFloatTimeDomainData(samples);
          let sum = 0;
          for (let index = 0; index < samples.length; index++) sum += samples[index] * samples[index];
          const decibels = 20 * Math.log10(Math.sqrt(sum / samples.length) + 1e-6);
          level.set(clamp((decibels + 58) / 38));
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        if (!cancelled) fallback();
      }
    };
    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      void audio?.close();
      level.set(0);
    };
  }, [enabled, level]);

  return { level, source: enabled ? source : "off" };
}

export interface VoiceTranscriptProps {
  /** Transcript text so far. Words are split on whitespace. */
  text: string;
  /** Change it when a new turn begins so the old line crossfades out. */
  turn?: string | number;
  /** Assistant reads in the foreground color, the person in secondary, system smaller and muted. */
  speaker?: "user" | "assistant" | "system";
  /** Set when the turn is finished to announce it to screen readers. */
  complete?: boolean;
  /** Extra class on the wrapper. */
  className?: string;
}

/** One line of live transcript: words settle in from a soft blur, and a new turn crossfades in. */
export function VoiceTranscript({ text, turn = 0, speaker = "assistant", complete = false, className }: VoiceTranscriptProps) {
  const still = usePrefersStill();
  const words = text ? text.split(/\s+/) : [];
  const { spring, duration, ease, blur } = motionTokens;

  return (
    <div className={[styles.transcript, className].filter(Boolean).join(" ")}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={turn}
          className={styles.line}
          data-speaker={speaker}
          aria-hidden="true"
          layout={still ? false : "position"}
          initial={still ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={still ? { opacity: 0 } : { opacity: 0, y: -10, filter: `blur(${blur.soft}px)`, transition: { duration: duration.exit, ease: [...ease.standard] } }}
          transition={still ? { duration: duration.instant } : spring.smooth}
        >
          {words.map((word, index) => (
            <Fragment key={index}>
              <motion.span
                className={styles.word}
                initial={still ? { opacity: 0 } : { opacity: 0, filter: `blur(${blur.soft}px)`, y: 3 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={{ duration: still ? duration.instant : 0.34, ease: [...ease.enter] }}
              >
                {word}
              </motion.span>
              {index < words.length - 1 ? " " : null}
            </Fragment>
          ))}
        </motion.p>
      </AnimatePresence>
      <p className={styles.srOnly} aria-live="polite">
        {complete ? text : ""}
      </p>
    </div>
  );
}

export interface VoiceControlsProps {
  /** Whether a session is live. */
  active: boolean;
  /** Pressed state of the mute button. */
  muted?: boolean;
  /** Seconds since the session began, shown as m:ss with tabular numerals. */
  elapsed?: number;
  /** Called by the start button. */
  onStart?: () => void;
  /** Called with the next muted value. */
  onMuteChange?: (muted: boolean) => void;
  /** Called by the end button. */
  onEnd?: () => void;
  /** Content of the start button. */
  startLabel?: React.ReactNode;
  /** Extra class on the pill. */
  className?: string;
}

/** Call controls in one pill: a start button at rest, and mute, a running clock, and end once live.
 *  The pill springs to the width of whichever set is showing. */
export function VoiceControls({ active, muted = false, elapsed = 0, onStart, onMuteChange, onEnd, startLabel = "Start voice chat", className }: VoiceControlsProps) {
  const still = usePrefersStill();
  const { spring, duration, blur } = motionTokens;
  const content = useRef<HTMLDivElement>(null);
  const muteButton = useRef<HTMLButtonElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [width, setWidth] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const node = content.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => setWidth(parseFloat(getComputedStyle(node).width) || node.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  // Focus follows the session: mute when it starts, start when it ends, so keyboard users never lose their place.
  useEffect(() => {
    if (!restoreFocus.current) return;
    restoreFocus.current = false;
    (active ? muteButton.current : startButton.current)?.focus();
  }, [active]);

  const widthTransition: Transition = still ? { duration: 0 } : spring.morph;
  const hidden: TargetAndTransition = still ? { opacity: 0 } : { opacity: 0, scale: 0.92, filter: `blur(${blur.soft}px)` };
  const exit: TargetAndTransition = { ...hidden, transition: { duration: duration.instant } };
  const enter: Transition = still ? { duration: duration.instant } : { ...spring.snappy, opacity: { duration: duration.fast }, filter: { duration: duration.fast } };

  return (
    <motion.div
      className={[styles.controls, className].filter(Boolean).join(" ")}
      data-active={active ? "" : undefined}
      initial={false}
      animate={{ width }}
      transition={widthTransition}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {active ? (
          <motion.div
            key="live"
            ref={content}
            className={styles.live}
            initial={hidden}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={exit}
            transition={enter}
          >
            <button
              ref={muteButton}
              type="button"
              className={styles.round}
              aria-pressed={muted}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              onClick={() => onMuteChange?.(!muted)}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={muted ? "off" : "on"}
                  className={styles.glyph}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.6, transition: { duration: duration.instant } }}
                  transition={still ? { duration: duration.instant } : spring.snappy}
                >
                  {muted ? <MicOff size={18} strokeWidth={1.75} aria-hidden="true" /> : <Mic size={18} strokeWidth={1.75} aria-hidden="true" />}
                </motion.span>
              </AnimatePresence>
            </button>
            <span className={styles.clock} role="timer" aria-label={`${Math.floor(elapsed / 60)} minutes ${Math.floor(elapsed % 60)} seconds`}>
              {`${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}`}
            </span>
            <button
              type="button"
              className={styles.end}
              aria-label="End voice chat"
              onClick={() => {
                restoreFocus.current = true;
                onEnd?.();
              }}
            >
              <PhoneOff size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="start"
            ref={content}
            className={styles.idle}
            initial={hidden}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={exit}
            transition={enter}
          >
            <button
              ref={startButton}
              type="button"
              className={styles.start}
              onClick={() => {
                restoreFocus.current = true;
                onStart?.();
              }}
            >
              <Mic size={18} strokeWidth={1.75} aria-hidden="true" />
              {startLabel}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default VoiceOrb;
