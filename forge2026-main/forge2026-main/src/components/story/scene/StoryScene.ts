import * as THREE from "three";
import {
  ANVIL,
  HAMMER_HANDLE,
  HAMMER_HEAD,
  HAMMER_PIVOT,
  IRIS,
  LILAC,
  LIME,
  LOGO_HEIGHT,
  LOGO_SHARDS,
  MIST,
  bladeGeometry,
  centroid,
  extrude,
  shapeFromPath,
  unitShardGeometry,
} from "./logo";
import {
  HANDSHAKE,
  N,
  buildFormation,
  forgePlace,
  identityColours,
  rng,
  sampleGlyphs,
  sampleOutline,
  type Formation,
  type FormationName,
  type ForgePlace,
  type Layout,
  type Shared,
} from "./formations";
import type { Quality } from "../perf";

export type { FormationName };

/*
  The one WebGL scene behind every page. It holds the forge (the mark, given
  depth), 500 shards and their glow, and moves them between formations as the
  page asks. It never schedules its own frames: the stage calls `frame` from
  GSAP's ticker, the same loop that drives smooth scrolling, so the page runs
  one animation loop in total.
*/

export type StoryScene = {
  frame(time: number, dt: number, target: number): void;
  setSequence(seq: FormationName[]): void;
  playIntro(): void;
  /** Swing the hammer. `power` grows with strikes in quick succession. */
  strike(power?: number): void;
  /**
   * Called the moment the hammer meets the anvil, with the anvil face on
   * screen (client pixels), the forge's height on screen and the power.
   */
  onImpact(fn: ((x: number, y: number, size: number, power: number) => void) | null): void;
  spin(dx: number): void;
  release(): void;
  /** Pointer in -1..1 across the viewport (y down); `active` while a mouse is over the page. */
  setPointer(x: number, y: number, active?: boolean): void;
  /** A click at a point (same units): shards near it are thrown clear and spring back. */
  burst(x: number, y: number, power?: number): void;
  /** Scroll velocity from the smooth scroller, in pixels per second. */
  setVelocity(v: number): void;
  setBias(b: number): void;
  resize(): void;
  /** Resolution, glow and camera calm for this device (perf.ts). */
  setQuality(q: Quality): void;
  /** Is anything moving that needs every frame (a morph, a strike, a burst, the mouse)? */
  busy(): boolean;
  /** Build a formation ahead of time, so reaching it never stalls a frame. */
  build(name: FormationName): void;
  /**
   * Recolour the shards (lilac, lime, sky, coral, iris, mist, in that order),
   * or back to the signal colours with null. They fade into it.
   */
  setPalette(hexes: readonly string[] | null): void;
  /** Shards pulse on a beat at this tempo (beats per minute), or not at 0. */
  setBeat(bpm: number): void;
  /** Turn the forge once round, and settle where it started. */
  twirl(): void;
  /** The graphics chip, as the driver names it (may be empty). */
  gpu: string;
  dispose(): void;
  /**
   * For the dev tools: where the story is, and `maxStep`, the furthest a
   * visible shard moved in one frame since the last call (development builds
   * only; a jump shows up here).
   */
  debug(): { t: number; seq: FormationName[]; maxStep: number; waves?: object[] };
};

const FOV = 32;
const BASE_Z = 18;
/** Latest a shard may leave for its next place, as a share of the move. */
const DELAY_MAX = 0.38;
const CARRY_DURATION = 1.5;
/** On a traced formation, the share of a carry over which the shards' turns are spread. */
const TRACE = 0.6;
/** From the strike starting to the hammer meeting the anvil, in seconds. */
const CONTACT = 0.27;
/**
 * How far into a move (and how close to its end) the formations' own motion
 * keeps running. Past it, the motion holds still until the shards land.
 */
const HOLD_EDGE = 0.06;
/** Sideways throws are sized for this aspect ratio; narrower screens get smaller ones. */
const WIDE_ASPECT = 16 / 9;
/** Pointer field spring: stiffness, and damping just short of critical, so shards settle without bouncing. */
const SPRING_K = 42;
const SPRING_DAMP = 9.5;
/** Scroll speed (pixels per second) at which the lens and the streaks are at their widest. */
const FAST_SCROLL = 4800;

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const easeOutBack = (x: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smoothstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

function computeLayout(w: number, h: number): Layout {
  const halfH = BASE_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const aspect = w / h;
  return { halfW: halfH * aspect, halfH, mobile: w < 768 || aspect < 0.8 };
}

/**
 * A small studio for the metal to reflect: a dim room lit by a few soft panels,
 * two of them in the brand's purples. Rendered once into an environment map,
 * so there is no HDR file to fetch.
 */
function studio() {
  const room = new THREE.Scene();
  const disposables: { dispose(): void }[] = [];
  const box = new THREE.BoxGeometry(10, 10, 10);
  const walls = new THREE.MeshBasicMaterial({ color: 0x16161f, side: THREE.BackSide });
  room.add(new THREE.Mesh(box, walls));
  disposables.push(box, walls);
  const panel = (
    w: number,
    h: number,
    hex: string,
    power: number,
    pos: [number, number, number],
    rot: [number, number, number],
  ) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    mat.color.set(hex).multiplyScalar(power);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    room.add(mesh);
    disposables.push(geo, mat);
  };
  panel(6, 2.2, "#ffffff", 7, [0, 4.9, 0.5], [Math.PI / 2, 0, 0]);
  panel(3, 4, "#ffffff", 3.2, [-4.9, 1, 1], [0, Math.PI / 2, 0]);
  panel(3, 4, "#c4b8ff", 2.6, [4.9, 0.4, -1], [0, -Math.PI / 2, 0]);
  panel(5, 1.2, "#5a38ff", 5, [0, -1.2, -4.9], [0, 0, 0]);
  panel(2.6, 2.6, "#ffffff", 1.6, [0, 1, 4.9], [0, Math.PI, 0]);
  return { room, dispose: () => disposables.forEach((d) => d.dispose()) };
}

/** A soft round falloff, drawn once, used for every glow. */
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.16, "rgba(255,255,255,0.55)");
    grd.addColorStop(0.42, "rgba(255,255,255,0.12)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A thin bright ring with a soft edge: the shockwave a click sends out. */
function ringTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.6, "rgba(255,255,255,0)");
    grd.addColorStop(0.79, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.86, "rgba(255,255,255,0.3)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Hammer pose over one strike: cock it back high, swing it down hard, bounce
 * off the anvil, spring home. At contact the head sits on the anvil face.
 */
function hammerPose(d: number) {
  if (d < 0 || d > 1.5) return { rot: 0, x: 0, y: 0 };
  const WIND = 0.17;
  if (d < WIND) {
    const e = easeOutCubic(d / WIND);
    return { rot: -0.55 * e, x: 18 * e, y: 34 * e };
  }
  if (d < CONTACT) {
    const e = Math.pow((d - WIND) / (CONTACT - WIND), 2.3);
    return {
      rot: -0.55 + 1.13 * e,
      x: 18 + (-34 - 18) * e,
      y: 34 + (-142 - 34) * e,
    };
  }
  const u = d - CONTACT;
  if (u < 0.09) {
    const e = easeOutCubic(u / 0.09);
    return { rot: 0.58 - 0.14 * e, x: -34 + 5 * e, y: -142 + 20 * e };
  }
  const e = easeOutBack(clamp01((u - 0.09) / 0.95));
  return { rot: 0.44 * (1 - e), x: -29 * (1 - e), y: -122 * (1 - e) };
}

export async function createStoryScene(
  canvas: HTMLCanvasElement,
  quality: Quality,
): Promise<StoryScene> {
  // The year the Idea chapter sets in shards (the "year" formation), and the
  // handshake the partners' hero draws with them.
  const glyphs = await sampleGlyphs("2026", N);
  const hands = sampleOutline(HANDSHAKE, N);

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality.aa,
    alpha: true,
    // Phones: let the browser pick; asking for the fast GPU only heats them up.
    powerPreference: coarse ? "default" : "high-performance",
  });
  const size = () => ({
    w: canvas.clientWidth || window.innerWidth,
    h: canvas.clientHeight || window.innerHeight,
  });
  let { w: vw, h: vh } = size();
  let q = quality;
  renderer.setPixelRatio(q.dpr);
  renderer.setSize(vw, vh, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b0b0f, 22, 50);

  // Studio light for the metal, generated in place: no files to fetch.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = studio();
  const envTex = pmrem.fromScene(room.room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = envTex;

  scene.add(new THREE.AmbientLight(0xffffff, 0.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-5, 8, 10);
  scene.add(key);
  // A cool sky rim, not a purple one: the scene's own colour comes from the shards.
  const rim = new THREE.DirectionalLight(new THREE.Color("#8ed1ff"), 2.6);
  rim.position.set(6, 3, -8);
  scene.add(rim);
  const flash = new THREE.PointLight(new THREE.Color(LIME), 0, 16, 1.4);
  scene.add(flash);
  // A soft light that follows the mouse through the scene, and one that
  // flares where a click lands.
  const cursorLight = new THREE.PointLight(new THREE.Color(LILAC), 0, 9, 1.6);
  scene.add(cursorLight);
  const clickLight = new THREE.PointLight(new THREE.Color("#ffffff"), 0, 12, 1.4);
  scene.add(clickLight);

  const camera = new THREE.PerspectiveCamera(FOV, vw / vh, 0.1, 140);
  camera.position.set(0, 0, BASE_Z);

  let layout = computeLayout(vw, vh);
  let identity = identityColours();
  const shared: Shared = { flowL: 0, flowR: 0 };
  const cache = new Map<FormationName, Formation>();
  const get = (name: FormationName) => {
    let f = cache.get(name);
    if (!f) {
      f = buildFormation(name, { L: layout, identity, glyphs, hands, shared });
      cache.set(name, f);
    }
    return f;
  };

  /* ── shards ────────────────────────────────────────────────────────── */

  const glow = { value: 1.25 };
  const shardMat = new THREE.MeshStandardMaterial({
    metalness: 0.45,
    roughness: 0.3,
    envMapIntensity: 1.1,
  });
  // Per-shard heat: hot shards burn in their own colour.
  shardMat.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glow;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aHeat;\nvarying float vHeat;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHeat = aHeat;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vHeat;\nuniform float uGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vHeat * uGlow;",
      );
  };

  const kinds = [
    bladeGeometry(),
    unitShardGeometry(LOGO_SHARDS[6].d, LOGO_SHARDS[6].angle, 0.1),
    unitShardGeometry(LOGO_SHARDS[0].d, LOGO_SHARDS[0].angle, 0.07),
  ];
  const kindRoll = rng(3);
  const meshOf = new Uint8Array(N);
  const localOf = new Uint16Array(N);
  const counts = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const roll = kindRoll();
    const k = roll < 0.56 ? 0 : roll < 0.86 ? 1 : 2;
    meshOf[i] = k;
    localOf[i] = counts[k]++;
  }
  const meshes = kinds.map((geo, k) => {
    const heat = new THREE.InstancedBufferAttribute(new Float32Array(counts[k]), 1);
    heat.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aHeat", heat);
    const mesh = new THREE.InstancedMesh(geo, shardMat, counts[k]);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(counts[k] * 3), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  });
  const heatArrays = kinds.map(
    (geo) => (geo.getAttribute("aHeat") as THREE.BufferAttribute).array as Float32Array,
  );
  const colourArrays = meshes.map((m) => m.instanceColor!.array as Float32Array);
  const matrixArrays = meshes.map((m) => m.instanceMatrix.array as Float32Array);

  const glowTex = glowTexture();
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const glowMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMat, N);
  glowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  glowMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  glowMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  glowMesh.frustumCulled = false;
  glowMesh.renderOrder = 2;
  scene.add(glowMesh);
  const glowColours = glowMesh.instanceColor.array as Float32Array;
  const glowMatrices = glowMesh.instanceMatrix.array as Float32Array;

  // Lines for the network formation.
  const linePos = new Float32Array(1800 * 3);
  const lineGeo = new THREE.BufferGeometry();
  const lineAttr = new THREE.BufferAttribute(linePos, 3);
  lineAttr.setUsage(THREE.DynamicDrawUsage);
  lineGeo.setAttribute("position", lineAttr);
  const lineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color("#8B73FF"),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);

  /* ── the forge ─────────────────────────────────────────────────────── */

  const forge = new THREE.Group();
  scene.add(forge);
  const metal = new THREE.MeshStandardMaterial({
    color: new THREE.Color(MIST),
    metalness: 0.92,
    roughness: 0.24,
    envMapIntensity: 1.35,
    emissive: new THREE.Color(IRIS),
    emissiveIntensity: 0,
  });
  const anvil = new THREE.Mesh(extrude(shapeFromPath(ANVIL), 36, 4), metal);
  forge.add(anvil);

  const pivot: [number, number] = [HAMMER_PIVOT.x, -HAMMER_PIVOT.y];
  const hammer = new THREE.Group();
  hammer.position.set(pivot[0], pivot[1], 26);
  hammer.add(
    new THREE.Mesh(extrude(shapeFromPath(HAMMER_HEAD, pivot), 22, 3), metal),
    new THREE.Mesh(extrude(shapeFromPath(HAMMER_HANDLE, pivot), 14, 2), metal),
  );
  forge.add(hammer);

  const logoShards = LOGO_SHARDS.map((s) => {
    const [cx, cy] = centroid(s.d);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(s.fill),
      emissive: new THREE.Color(s.fill),
      emissiveIntensity: 0.6,
      metalness: 0.25,
      roughness: 0.32,
    });
    const mesh = new THREE.Mesh(extrude(shapeFromPath(s.d, [cx, cy]), 10, 1.2), mat);
    mesh.position.set(cx, cy, 4);
    forge.add(mesh);
    const a = (s.angle * Math.PI) / 180;
    return { mesh, home: [cx, cy] as const, dir: [Math.sin(a), Math.cos(a)] as const, mat };
  });

  const auraMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: new THREE.Color(IRIS),
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const aura = new THREE.Sprite(auraMat);
  aura.scale.set(560, 560, 1);
  aura.position.set(0, 70, -70);
  forge.add(aura);

  // Shockwaves: rings that race out from wherever a click lands.
  const ringTex = ringTexture();
  const waves = Array.from({ length: 4 }, () => {
    const mat = new THREE.SpriteMaterial({
      map: ringTex,
      color: new THREE.Color(LILAC),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, mat, start: -10, power: 1, life: 0.9 };
  });
  let waveNext = 0;

  /* ── per-shard constants ───────────────────────────────────────────── */

  const r = rng(5);
  const delay = new Float32Array(N);
  const arc = new Float32Array(N * 3);
  const spinAxis = new Float32Array(N * 3);
  const spinAmt = new Float32Array(N);
  const seed = new Float32Array(N);
  const tmpV = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    seed[i] = r();
    delay[i] = r() * DELAY_MAX;
    tmpV
      .set(r() - 0.5, r() * 0.8 + 0.2, r() - 0.5)
      .normalize()
      .multiplyScalar(0.6 + r() * 1.8);
    arc.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
    tmpV.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    spinAxis.set([tmpV.x, tmpV.y, tmpV.z], i * 3);
    spinAmt[i] = 1 + r() * 2.5;
  }

  /* ── state ─────────────────────────────────────────────────────────── */

  const cur = {
    pos: new Float32Array(N * 3),
    rot: new Float32Array(N * 4),
    scl: new Float32Array(N * 3),
    col: new Float32Array(N * 3),
    heat: new Float32Array(N),
  };
  const carry = {
    pos: new Float32Array(N * 3),
    rot: new Float32Array(N * 4),
    scl: new Float32Array(N * 3),
    col: new Float32Array(N * 3),
    heat: new Float32Array(N),
  };
  let hasState = false;
  let carryStart = -1;
  let carryPending = false;
  /** The order the shards land in during this carry (a traced formation), or none. */
  let carryOrder: Float32Array | null = null;
  let carryFresh = false;

  let seq: FormationName[] = ["forge"];
  let t = 0;
  let lastPlace: ForgePlace = forgePlace(layout);

  let introStart = -1;
  let introPending = false;
  let strikeAt = -10;
  /** Power of a strike asked for since the last frame; 0 for none. */
  let strikePending = 0;
  let strikePower = 1;
  let impactFired = true;
  let impactHandler: ((x: number, y: number, size: number, power: number) => void) | null = null;
  /** Heat built up by strikes in quick succession; the metal glows with it. */
  let forgeHeat = 0;
  // Struck metal flashes white-lilac, never orange: the forge has no fire.
  const hotMetal = new THREE.Color("#e6e0ff");
  const coolMetal = new THREE.Color(IRIS);

  let spin = 0;
  let spinVel = 0;
  let dragging = false;
  let beat = 0;
  let twirlPending = false;
  let twirlStart = -1;
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let pointerOn = false;
  let cursorGlow = 0;
  let bias = 0;
  let easedBias = 0;
  let velocity = 0;
  let speed = 0;
  let fovNow = FOV;

  // The pointer field: every shard sits on a spring. The cursor pulls its
  // rest point aside; a click kicks it; it always comes home.
  const off = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const flare = new Float32Array(N);
  const twist = new Float32Array(N);
  let burstPending: { x: number; y: number; power: number } | null = null;
  let lastBurst = -10;

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const ndc2 = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const right = new THREE.Vector3();
  const upv = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const proj = new THREE.Vector3();

  /** Where the pointer's ray meets the plane z = `z`. */
  const worldAt = (nx: number, ny: number, z: number) => {
    ndc2.set(nx, -ny);
    ray.setFromCamera(ndc2, camera);
    plane.constant = -z;
    return ray.ray.intersectPlane(plane, hit);
  };

  const snapshot = () => {
    if (!hasState) return;
    carry.pos.set(cur.pos);
    carry.rot.set(cur.rot);
    carry.scl.set(cur.scl);
    carry.col.set(cur.col);
    carry.heat.set(cur.heat);
    carryPending = true;
  };

  const pa = new Float32Array(3);
  const pb = new Float32Array(3);
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const qs = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const vp = new THREE.Vector3();
  const vs = new THREE.Vector3();
  const look = new THREE.Vector3();

  // The scene keeps its own clock, advanced by capped frame deltas: a tab
  // left in the background resumes where it stopped instead of jumping.
  let clock = 0;
  /**
   * The formations' own clock (sparks drifting, streaks rising, streams
   * flowing). It runs while the shards rest in a formation and holds still
   * while they travel, so a looping motion never wraps mid-flight and throws
   * a shard across the screen.
   */
  let anim = 0;
  /**
   * Until this time on the clock the story follows the scroll exactly rather
   * than easing after it: the scene's first moment on screen (a page reloaded
   * halfway down would otherwise race through every formation on the way)
   * and an arrival from another page (the carry eases instead).
   */
  let settleUntil = 1;
  let busyNow = true;
  /** Development only: the furthest a visible shard moved in one frame (see `debug`). */
  let maxStep = 0;

  function frame(_time: number, rawDt: number, target: number) {
    const dt = Math.min(Math.max(rawDt, 0), 0.05);
    clock += dt;
    const time = clock;
    if (introPending) {
      introStart = time;
      strikeAt = time + 0.38;
      strikePower = 1.3;
      impactFired = false;
      introPending = false;
    }
    if (strikePending) {
      strikeAt = time;
      strikePower = strikePending;
      strikePending = 0;
      impactFired = false;
    }
    forgeHeat *= Math.exp(-dt * 0.65);
    if (carryPending) {
      carryStart = time;
      carryPending = false;
      carryFresh = true;
    }

    // Where in the story we are, eased so a jump never snaps.
    const n = seq.length;
    const goal = Math.min(Math.max(target, 0), n - 1);
    if (time < settleUntil) t = goal;
    else t += (goal - t) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(goal - t) < 0.0005) t = goal;
    const a = Math.min(Math.floor(t), n - 1);
    const b = Math.min(a + 1, n - 1);
    const f = a === b ? 0 : t - a;
    const FA = get(seq[a]);
    const FB = get(seq[b]);
    const eM = easeInOut(f);
    // A carry that starts on a traced formation (the handshake) lands its
    // shards in order, chosen once so scrolling mid-carry can't change it.
    if (carryFresh) {
      carryOrder = (f < 0.5 ? FA : FB).order ?? null;
      carryFresh = false;
    }
    // The formations' motion eases to a stop as a move begins and back up as
    // it ends (HOLD_EDGE), so a pause mid-move leaves the shards still.
    const hold = 1 - smoothstep(0, HOLD_EDGE, Math.min(f, 1 - f));
    anim += dt * hold;
    // Sideways throws scale with the screen's width, so a narrow window
    // keeps its shards on screen and a wide one looks the same as before.
    const across = Math.min(1, layout.halfW / layout.halfH / WIDE_ASPECT);

    easedBias += (bias - easedBias) * (1 - Math.exp(-dt * 4));
    shared.flowL += dt * hold * (1 + Math.max(0, -easedBias) * 2.4);
    shared.flowR += dt * hold * (1 + Math.max(0, easedBias) * 2.4);

    // The forge: present where the formation keeps it, gone deep otherwise.
    const wA = FA.forge ? 1 : 0;
    const wB = FB.forge ? 1 : 0;
    const w = wA + (wB - wA) * eM;
    let place: ForgePlace = lastPlace;
    if (FA.forge && FB.forge) {
      place = {
        x: FA.forge.x + (FB.forge.x - FA.forge.x) * eM,
        y: FA.forge.y + (FB.forge.y - FA.forge.y) * eM,
        h: FA.forge.h + (FB.forge.h - FA.forge.h) * eM,
      };
    } else if (FA.forge || FB.forge) {
      place = (FA.forge ?? FB.forge) as ForgePlace;
    }
    lastPlace = place;

    const sinceContact = time - (strikeAt + CONTACT);
    let kick = 0;
    if (sinceContact >= 0 && sinceContact < 3) {
      kick = sinceContact < 0.05 ? sinceContact / 0.05 : Math.exp(-(sinceContact - 0.05) * 2.6);
    }
    // How hard this blow lands: harder in a quick run of strikes.
    const kp = kick * strikePower;
    const introT = introStart >= 0 ? time - introStart : 99;
    const introOn = introT < 3.4;

    eased.x += (pointer.x - eased.x) * (1 - Math.exp(-dt * 3.5));
    eased.y += (pointer.y - eased.y) * (1 - Math.exp(-dt * 3.5));

    if (!dragging) {
      spin += spinVel;
      spinVel *= Math.exp(-dt * 3.5);
      spin *= Math.exp(-dt * 0.55);
    }

    // Scroll speed: fast scrolling widens the lens and streaks the shards.
    // Measured per second (the same on a 60 Hz and a 120 Hz screen) and eased
    // slowly, so the notches of a scroll wheel don't pump the lens.
    speed +=
      (Math.min(Math.abs(velocity), FAST_SCROLL) / FAST_SCROLL - speed) * (1 - Math.exp(-dt * 2.5));

    // Camera: each formation has its own view; the pointer leans it; each
    // kind of transition moves it in its own way while the shards travel.
    const transit = f > 0 ? FB.transit : null;
    const liftG = f > 0 ? Math.sin(Math.PI * f) : 0;
    const cA = FA.camera;
    const cB = FB.camera;
    let cx = cA.p[0] + (cB.p[0] - cA.p[0]) * eM + eased.x * 0.6;
    let cy = cA.p[1] + (cB.p[1] - cA.p[1]) * eM - eased.y * 0.32;
    let cz = cA.p[2] + (cB.p[2] - cA.p[2]) * eM;
    let lx = cA.t[0] + (cB.t[0] - cA.t[0]) * eM;
    let ly = cA.t[1] + (cB.t[1] - cA.t[1]) * eM;
    const lz = cA.t[2] + (cB.t[2] - cA.t[2]) * eM;
    let fov = FOV + speed * 4 * q.motion;
    let roll = 0;
    // Calmer on phones: the same moves, smaller (perf.ts). Every move is a
    // smooth function of the scroll, never of chance, so a pause holds still.
    const lg = liftG * q.motion;
    switch (transit) {
      case "warp":
        fov += lg * 14;
        cz -= lg * 2;
        break;
      case "blast":
        fov += lg * 5;
        break;
      case "drop":
        cy += lg * 2;
        ly -= lg * 1;
        break;
      case "rise":
        ly += lg * 2.2;
        cy -= lg * 0.6;
        break;
      case "vortex":
        roll = lg * 0.3;
        break;
      case "depth":
        cz += lg * 4;
        fov -= lg * 2.5;
        break;
      case "orbit":
        cx += Math.sin(lg * Math.PI * 0.5) * 3.5 * across;
        lx += Math.sin(lg * Math.PI * 0.5) * across;
        break;
      case "split":
        cz += lg * 3;
        break;
    }
    if (introOn) cz += (1 - easeOutCubic(clamp01(introT / 2.8))) * 7;
    // The blow: the camera lurches toward the anvil, the lens punches in, and
    // everything shakes, then settles.
    const jolt = kp * w * q.motion;
    cz -= jolt * 0.9;
    fov -= jolt * 4.5;
    roll += (Math.random() - 0.5) * jolt * 0.05;
    const shake = jolt * 0.26 + Math.max(0, 1 - (time - lastBurst) * 3) * 0.05 * q.motion;
    cx += (Math.random() - 0.5) * shake;
    cy += (Math.random() - 0.5) * shake;
    camera.position.set(cx, cy, cz);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    look.set(lx, ly, lz);
    camera.lookAt(look);
    if (Math.abs(fov - fovNow) > 0.01) {
      fovNow = fov;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();

    // Camera axes, for turning screen-space pushes into world-space ones.
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    upv.set(0, 1, 0).applyQuaternion(camera.quaternion);
    fwd.set(0, 0, 1).applyQuaternion(camera.quaternion);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(fovNow / 2));
    const aspect = camera.aspect;
    const pnx = pointer.x;
    const pny = -pointer.y;
    cursorGlow += ((pointerOn ? 1 : 0) - cursorGlow) * (1 - Math.exp(-dt * 4));
    if (cursorGlow > 0.01 && worldAt(pointer.x, pointer.y, 2.5)) {
      cursorLight.position.copy(hit);
      cursorLight.intensity = cursorGlow * 16;
    } else cursorLight.intensity = 0;

    // A click: its shockwave and flash, and the push the loop below applies.
    const burst = burstPending;
    burstPending = null;
    if (burst) {
      lastBurst = time;
      if (worldAt(burst.x, burst.y, 1)) {
        const wv = waves[waveNext];
        waveNext = (waveNext + 1) % waves.length;
        wv.start = time;
        wv.power = Math.min(burst.power, 1.6);
        wv.life = 0.9;
        wv.sprite.position.copy(hit);
        wv.sprite.visible = true;
        clickLight.position.copy(hit).setZ(hit.z + 1.2);
      }
    }
    for (const wv of waves) {
      const u = (time - wv.start) / wv.life;
      if (u >= 1 || u < 0) {
        wv.sprite.visible = false;
        continue;
      }
      wv.sprite.visible = true;
      const e = easeOutCubic(u);
      wv.sprite.scale.setScalar((0.3 + e * 6.5) * wv.power);
      wv.mat.opacity = (1 - u) * (1 - u) * 0.95;
    }
    const sinceBurst = time - lastBurst;
    clickLight.intensity = sinceBurst < 0.9 ? Math.pow(1 - sinceBurst / 0.9, 3) * 90 : 0;

    // Forge transform.
    const k = place.h / LOGO_HEIGHT;
    const introForge = introOn ? easeOutExpo(clamp01(introT / 0.55)) : 1;
    forge.visible = w > 0.01;
    forge.position.set(place.x, place.y + (1 - w) * 2.5, -(1 - w) * 10);
    forge.scale.setScalar(k * (0.55 + 0.45 * w) * (0.85 + 0.15 * introForge));
    // A twirl adds one whole turn, eased; a full turn ends where it began.
    if (twirlPending) {
      twirlPending = false;
      twirlStart = time;
    }
    let twirlTurn = 0;
    if (twirlStart >= 0) {
      const u = clamp01((time - twirlStart) / 1.5);
      twirlTurn = easeInOut(u) * Math.PI * 2;
      if (u >= 1) twirlStart = -1;
    }
    forge.rotation.set(eased.y * 0.12, spin + twirlTurn + (1 - w) * 1.2 + eased.x * 0.28, 0);

    const pose = hammerPose(time - strikeAt);
    hammer.position.set(pivot[0] + pose.x, pivot[1] + pose.y + Math.sin(time * 1.4) * 3, 26);
    hammer.rotation.z = pose.rot + Math.sin(time * 1.1) * 0.03;
    const squash = Math.min(kp, 2.2);
    anvil.scale.set(1 + squash * 0.035, 1 - squash * 0.07, 1);
    // Struck metal flashes white and cools back to iris; a run of blows
    // leaves it glowing.
    metal.emissive.copy(coolMetal).lerp(hotMetal, Math.min(1, kick * 1.3));
    metal.emissiveIntensity = kick * (1.3 + strikePower * 0.5) + forgeHeat * 0.4;
    auraMat.opacity = Math.min(1.4, 0.32 + kp * 0.9 + forgeHeat * 0.18) * introForge;
    aura.scale.setScalar(560 * (1 + Math.min(kp, 2.5) * 0.5 + forgeHeat * 0.12));

    const shardsOut = introOn ? easeOutBack(clamp01((introT - 0.62) / 0.85)) : 1;
    for (const s of logoShards) {
      const pop = kick * (46 + strikePower * 22);
      s.mesh.position.set(
        (s.home[0] + s.dir[0] * pop) * shardsOut,
        (s.home[1] + s.dir[1] * pop) * shardsOut,
        4 + kick * 16,
      );
      s.mesh.scale.setScalar(Math.max(0.0001, shardsOut));
      s.mesh.rotation.z = kick * 0.6 * (s.dir[0] >= 0 ? -1 : 1);
      s.mat.emissiveIntensity = 0.6 + kick * 1.6 + forgeHeat * 0.3;
    }

    // World position of the anvil face, for the burst and the flash.
    forge.updateMatrixWorld();
    vp.set(0, 0, 0);
    forge.localToWorld(vp);
    const fx = vp.x;
    const fy = vp.y;
    const fz = vp.z;
    flash.position.set(fx, fy + 0.5, fz + 1.5);
    flash.intensity = Math.min(kp, 2.5) * w * 140;

    // The moment of contact: shockwaves off the anvil, every shard on screen
    // thrown clear, and the page told where it happened (sparks and
    // shaking type are drawn over the page by the stage).
    if (!impactFired && time >= strikeAt + CONTACT) {
      impactFired = true;
      forgeHeat = Math.min(3, forgeHeat + 0.5 * strikePower);
      if (w > 0.3) {
        proj.set(fx, fy, fz).project(camera);
        if (proj.z < 1 && Math.abs(proj.x) < 1.25 && Math.abs(proj.y) < 1.25) {
          const pw = strikePower;
          for (let k2 = 0; k2 < 2; k2++) {
            const wv = waves[waveNext];
            waveNext = (waveNext + 1) % waves.length;
            wv.start = time + k2 * 0.08;
            wv.power = (k2 ? 2.8 : 1.7) * Math.min(pw, 2.2);
            wv.life = k2 ? 1.3 : 0.8;
            wv.sprite.position.set(fx, fy + 0.2, fz + 0.5);
          }
          burstPending = { x: proj.x, y: -proj.y, power: 1.9 + Math.min(pw, 2.5) * 0.6 };
          const dist = camera.position.distanceTo(vp.set(fx, fy, fz));
          const pxPerUnit = vh / (2 * dist * tanHalf);
          impactHandler?.(
            ((proj.x + 1) / 2) * vw,
            ((1 - proj.y) / 2) * vh,
            place.h * (0.55 + 0.45 * w) * pxPerUnit,
            pw,
          );
        }
      }
    }

    // How far through a carry (a new page, a resize, a new palette), 0 to 1.
    const carryU = carryStart >= 0 ? clamp01((time - carryStart) / CARRY_DURATION) : 1;
    const carryOn = carryU < 1 && hasState;
    const kickW = kick * w;
    const glowA = FA.glow ?? 1;
    const glowK = glowA + ((FB.glow ?? 1) - glowA) * eM;

    // On a beat, every shard swells as it lands and eases back before the next.
    const beatK = beat > 0 ? 1 + 0.12 * Math.pow(1 - (((time * beat) / 60) % 1), 4) : 1;

    for (let i = 0; i < N; i++) {
      let sA = 1;
      let sB = 1;
      if (FA.animate) sA = FA.animate(i, anim, pa);
      else {
        pa[0] = FA.pos[i * 3];
        pa[1] = FA.pos[i * 3 + 1];
        pa[2] = FA.pos[i * 3 + 2];
      }
      let m = 0;
      if (f > 0) {
        const x = (f - delay[i]) / (1 - DELAY_MAX);
        m = x <= 0 ? 0 : x >= 1 ? 1 : easeInOut(x);
      }
      let x = pa[0];
      let y = pa[1];
      let z = pa[2];
      qa.fromArray(FA.rot, i * 4);
      let sx = FA.scl[i * 3];
      let sy = FA.scl[i * 3 + 1];
      let sz = FA.scl[i * 3 + 2];
      let cr = FA.col[i * 3];
      let cg = FA.col[i * 3 + 1];
      let cb = FA.col[i * 3 + 2];
      let heat = FA.heat[i];
      let lift = 0;
      let stretch = 1;
      if (m > 0) {
        if (FB.animate) sB = FB.animate(i, anim, pb);
        else {
          pb[0] = FB.pos[i * 3];
          pb[1] = FB.pos[i * 3 + 1];
          pb[2] = FB.pos[i * 3 + 2];
        }
        lift = Math.sin(m * Math.PI);
        x += (pb[0] - x) * m + arc[i * 3] * lift * across;
        y += (pb[1] - y) * m + arc[i * 3 + 1] * lift;
        z += (pb[2] - z) * m + arc[i * 3 + 2] * lift;
        // The road each shard takes depends on the chapter it is heading for.
        // Every road is smooth in the scroll: a shard near the centre line
        // drifts, it never flips from one side to the other.
        if (lift > 0.001) {
          const sd = seed[i];
          switch (transit) {
            case "warp":
              z += lift * (3 + sd * 5);
              stretch *= 1 + lift * 1.6;
              break;
            case "blast": {
              // Out from the middle, along the line through where the shard
              // starts and lands, and gently near the centre.
              const mx = (pa[0] + pb[0]) * 0.5;
              const my = (pa[1] + pb[1]) * 0.5;
              const rr = Math.sqrt(mx * mx + my * my + 1);
              const out = lift * (2.4 + sd * 2.6);
              x += (mx / rr) * out * across;
              y += (my / rr) * out;
              break;
            }
            case "drop":
              y += lift * (3.2 + sd * 2.4);
              stretch *= 1 + lift;
              break;
            case "rise":
              y += lift * (2.2 + sd * 2.6);
              stretch *= 1 + lift * 1.5;
              break;
            case "vortex": {
              const ang = lift * (1.8 - Math.min(1.5, Math.hypot(x, y) * 0.14));
              const cs = Math.cos(ang);
              const sn = Math.sin(ang);
              const nx = x * cs - y * sn;
              y = x * sn + y * cs;
              x = nx;
              break;
            }
            case "depth":
              z -= lift * (5 + sd * 7);
              break;
            case "orbit": {
              // Round an upright axis at the depth halfway along the shard's
              // road, so the far ones swing round with the rest instead of
              // sweeping huge arcs off screen.
              const ang = lift * Math.PI * (0.32 + sd * 0.28);
              const cs = Math.cos(ang);
              const sn = Math.sin(ang);
              const oz = (pa[2] + pb[2]) * 0.5;
              const dz = z - oz;
              const nx = x * cs + dz * sn;
              z = oz - x * sn + dz * cs;
              x = nx;
              break;
            }
            case "split":
              // Toward the side the shard is heading for.
              x += Math.tanh(pb[0] * 1.2) * lift * (2 + sd * 2.6) * across;
              break;
          }
          // A slow float, so a move paused halfway stays alive without going anywhere.
          const ph = sd * 40;
          x += Math.sin(time * 0.7 + ph) * 0.06 * lift;
          y += Math.cos(time * 0.55 + ph * 1.3) * 0.06 * lift;
        }
        qb.fromArray(FB.rot, i * 4);
        qa.slerp(qb, m);
        axis.fromArray(spinAxis, i * 3);
        qs.setFromAxisAngle(axis, lift * spinAmt[i]);
        qa.multiply(qs);
        sx += (FB.scl[i * 3] - sx) * m;
        sy += (FB.scl[i * 3 + 1] - sy) * m;
        sz += (FB.scl[i * 3 + 2] - sz) * m;
        cr += (FB.col[i * 3] - cr) * m;
        cg += (FB.col[i * 3 + 1] - cg) * m;
        cb += (FB.col[i * 3 + 2] - cb) * m;
        heat += (FB.heat[i] - heat) * m + lift * 0.35;
      }
      const sk = (sA + (sB - sA) * m) * beatK;
      sx *= sk;
      sy *= sk * stretch * (1 + speed * 0.8);
      sz *= sk;

      // The strike throws everything near the anvil outward.
      if (kickW > 0.002) {
        const dx = x - fx;
        const dy = y - fy;
        const dz = z - fz;
        const d = Math.hypot(dx, dy, dz) || 1;
        const push = kickW * (2 + strikePower) * Math.max(0, 1 - d / (place.h * 3.2));
        x += (dx / d) * push;
        y += (dy / d) * push;
        z += (dz / d) * push;
        heat += kickW * 0.6;
      }

      // The opening: every shard leaves the anvil face at the moment of contact.
      if (introOn) {
        const u = (introT - 0.62 - delay[i] * 0.6) / 1.3;
        const e = u <= 0 ? 0 : easeOutExpo(Math.min(1, u));
        x = fx + (x - fx) * e;
        y = fy + (y - fy) * e;
        z = fz + (z - fz) * e;
        sx *= e;
        sy *= e;
        sz *= e;
        if (u > 0) heat += (1 - e) * 0.9;
      }

      // Arriving from another page: ease out of wherever the shards were. On a
      // traced formation each shard takes its turn, so the drawing is drawn.
      if (carryOn) {
        const c = carryOrder
          ? easeInOut(clamp01((carryU - carryOrder[i] * TRACE) / (1 - TRACE)))
          : easeInOut(carryU);
        x = carry.pos[i * 3] + (x - carry.pos[i * 3]) * c;
        y = carry.pos[i * 3 + 1] + (y - carry.pos[i * 3 + 1]) * c;
        z = carry.pos[i * 3 + 2] + (z - carry.pos[i * 3 + 2]) * c;
        qb.fromArray(carry.rot, i * 4);
        qb.slerp(qa, c);
        qa.copy(qb);
        sx = carry.scl[i * 3] + (sx - carry.scl[i * 3]) * c;
        sy = carry.scl[i * 3 + 1] + (sy - carry.scl[i * 3 + 1]) * c;
        sz = carry.scl[i * 3 + 2] + (sz - carry.scl[i * 3 + 2]) * c;
        cr = carry.col[i * 3] + (cr - carry.col[i * 3]) * c;
        cg = carry.col[i * 3 + 1] + (cg - carry.col[i * 3 + 1]) * c;
        cb = carry.col[i * 3 + 2] + (cb - carry.col[i * 3 + 2]) * c;
        heat = carry.heat[i] + (heat - carry.heat[i]) * c;
      }

      // The pointer field. Measured in screen space, applied in world space
      // along the camera's own axes, so it feels the same at any depth.
      const ix = i * 3;
      let tx = 0;
      let ty = 0;
      // Only project to the screen when something is there to meet (a mouse
      // over the page, or a click this frame): phones skip this entirely.
      let wpn = 0;
      if (pointerOn || burst) {
        proj.set(x, y, z).project(camera);
        wpn = Math.hypot(x - cx, y - cy, z - cz) * tanHalf;
      }
      if (pointerOn && proj.z < 1) {
        const sdx = (proj.x - pnx) * aspect;
        const sdy = proj.y - pny;
        const d = Math.hypot(sdx, sdy);
        if (d < 0.3) {
          const k = 1 - d / 0.3;
          const f2 = k * k;
          // Softer while the shards travel, so the ones flying past the
          // cursor aren't knocked about.
          const amt = (f2 * wpn * 0.24 * (1 - 0.7 * liftG)) / (d || 1e-3);
          tx = sdx * amt;
          ty = sdy * amt;
          heat += f2 * 1.2;
          twist[i] += f2 * dt * 5;
        }
      }
      if (burst && proj.z < 1) {
        const sdx = (proj.x - burst.x) * aspect;
        const sdy = proj.y + burst.y;
        const d = Math.hypot(sdx, sdy);
        const reach = 0.55 * burst.power;
        if (d < reach) {
          const k = 1 - d / reach;
          const imp = k * k * burst.power * wpn * 3.4;
          const nx = sdx / (d || 1e-3);
          const ny = sdy / (d || 1e-3);
          vel[ix] += (right.x * nx + upv.x * ny + fwd.x * 0.5) * imp;
          vel[ix + 1] += (right.y * nx + upv.y * ny + fwd.y * 0.5) * imp;
          vel[ix + 2] += (right.z * nx + upv.z * ny + fwd.z * 0.5) * imp;
          flare[i] = Math.min(1.6, flare[i] + k * 1.4 * burst.power);
          twist[i] += (seed[i] - 0.5) * 9 * k;
        }
      }
      // Spring toward the pulled-aside rest point; always comes home.
      const twx = right.x * tx + upv.x * ty;
      const twy = right.y * tx + upv.y * ty;
      const twz = right.z * tx + upv.z * ty;
      vel[ix] += ((twx - off[ix]) * SPRING_K - vel[ix] * SPRING_DAMP) * dt;
      vel[ix + 1] += ((twy - off[ix + 1]) * SPRING_K - vel[ix + 1] * SPRING_DAMP) * dt;
      vel[ix + 2] += ((twz - off[ix + 2]) * SPRING_K - vel[ix + 2] * SPRING_DAMP) * dt;
      off[ix] += vel[ix] * dt;
      off[ix + 1] += vel[ix + 1] * dt;
      off[ix + 2] += vel[ix + 2] * dt;
      x += off[ix];
      y += off[ix + 1];
      z += off[ix + 2];
      flare[i] *= Math.exp(-dt * 2.2);
      heat += flare[i];
      twist[i] *= Math.exp(-dt * 1.6);
      if (twist[i] > 0.002 || twist[i] < -0.002) {
        axis.fromArray(spinAxis, ix);
        qs.setFromAxisAngle(axis, twist[i]);
        qa.multiply(qs);
      }

      // Development only (compiled out of production): how far a visible shard
      // moved this frame, so a jump can be caught from the console.
      if (import.meta.env.DEV && hasState && Math.cbrt(Math.abs(sx * sy * sz)) > 0.03) {
        const d = Math.hypot(x - cur.pos[i * 3], y - cur.pos[i * 3 + 1], z - cur.pos[i * 3 + 2]);
        if (d > maxStep) maxStep = d;
      }
      cur.pos[i * 3] = x;
      cur.pos[i * 3 + 1] = y;
      cur.pos[i * 3 + 2] = z;
      qa.toArray(cur.rot, i * 4);
      cur.scl[i * 3] = sx;
      cur.scl[i * 3 + 1] = sy;
      cur.scl[i * 3 + 2] = sz;
      cur.col[i * 3] = cr;
      cur.col[i * 3 + 1] = cg;
      cur.col[i * 3 + 2] = cb;
      cur.heat[i] = heat;

      const mi = meshOf[i];
      const li = localOf[i];
      vp.set(x, y, z);
      vs.set(sx, sy, sz);
      m4.compose(vp, qa, vs);
      m4.toArray(matrixArrays[mi], li * 16);
      colourArrays[mi][li * 3] = cr;
      colourArrays[mi][li * 3 + 1] = cg;
      colourArrays[mi][li * 3 + 2] = cb;
      heatArrays[mi][li] = Math.min(heat, 2);

      // Sized by the shard's girth, not its length, and capped: long crystals
      // and streaks would otherwise stack into a white-out. On phones only
      // hot shards glow: additive sprites are what fill-limited GPUs pay for.
      if (q.glow) {
        let g = Math.min(Math.sqrt(sx * sy) * (1 + heat * 2.2), 1.1) * (0.6 + glowK * 0.4);
        if (q.glow === 1) g *= Math.min(1, heat * 1.3);
        vs.set(g, g, g);
        m4.compose(vp, camera.quaternion, vs);
        m4.toArray(glowMatrices, i * 16);
        const gk = (0.16 + heat * 0.34) * glowK;
        glowColours[i * 3] = cr * gk;
        glowColours[i * 3 + 1] = cg * gk;
        glowColours[i * 3 + 2] = cb * gk;
      }
    }
    hasState = true;
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    }
    for (const geo of kinds)
      (geo.getAttribute("aHeat") as THREE.BufferAttribute).needsUpdate = true;
    if (q.glow) {
      glowMesh.instanceMatrix.needsUpdate = true;
      glowMesh.instanceColor!.needsUpdate = true;
    }

    // Network lines follow whichever formation carries them.
    const pairs = FA.lines ?? FB.lines;
    const wl = (FA.lines ? 1 - eM : 0) + (FB.lines && a !== b ? eM : 0);
    if (pairs && wl > 0.01) {
      const count = Math.min(pairs.length, linePos.length / 3);
      for (let k2 = 0; k2 < count; k2++) {
        const p = pairs[k2];
        linePos[k2 * 3] = cur.pos[p * 3];
        linePos[k2 * 3 + 1] = cur.pos[p * 3 + 1];
        linePos[k2 * 3 + 2] = cur.pos[p * 3 + 2];
      }
      lineGeo.setDrawRange(0, count);
      lineAttr.needsUpdate = true;
      lineMat.opacity = Math.min(1, wl) * 0.3;
      lines.visible = true;
    } else {
      lines.visible = false;
    }

    busyNow =
      beat > 0 ||
      twirlStart >= 0 ||
      Math.abs(goal - t) > 0.0005 ||
      kick > 0.003 ||
      introOn ||
      carryOn ||
      time - lastBurst < 1.4 ||
      dragging ||
      Math.abs(spinVel) > 0.0005 ||
      pointerOn ||
      speed > 0.02;

    renderer.render(scene, camera);
  }

  function resize() {
    const next = size();
    if (!next.w || !next.h) return;
    // Mobile toolbars change the height by small amounts while scrolling;
    // re-laying out the whole story for that would make everything jump.
    if (next.w === vw && Math.abs(next.h - vh) < 140) return;
    vw = next.w;
    vh = next.h;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    layout = computeLayout(vw, vh);
    cache.clear();
    lastPlace = forgePlace(layout);
    snapshot();
  }

  glowMesh.visible = q.glow > 0;

  // The graphics chip, so perf.ts can spot budget phones.
  let gpuName = "";
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (info) gpuName = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  } catch {
    // Not every browser says.
  }

  // Compile every shader now, while the loading intro still covers the page,
  // so the first real frame doesn't stall.
  renderer.compile(scene, camera);

  return {
    frame,
    setSequence(next) {
      if (!next.length) return;
      if (next.join() === seq.join()) return;
      snapshot();
      seq = next;
      t = 0;
      // Land where the page is (it may open partway down), not on a race
      // through the formations from the top: the carry, if any, eases.
      settleUntil = clock + (hasState ? CARRY_DURATION : 1);
    },
    playIntro() {
      introPending = true;
    },
    strike(power = 1) {
      strikePending = Math.max(0.5, power);
    },
    onImpact(fn) {
      impactHandler = fn;
    },
    spin(dx) {
      dragging = true;
      spin += dx * 0.008;
      spinVel = dx * 0.004;
    },
    release() {
      dragging = false;
    },
    setPalette(hexes) {
      identity = identityColours(hexes ?? undefined);
      cache.clear();
      // Carry the shards from their old colours into the new ones.
      snapshot();
    },
    setBeat(bpm) {
      beat = Math.max(0, bpm);
    },
    twirl() {
      twirlPending = true;
    },
    setPointer(x, y, active = true) {
      pointer.x = x;
      pointer.y = y;
      pointerOn = active;
    },
    burst(x, y, power = 1) {
      burstPending = { x, y, power };
    },
    setVelocity(v) {
      velocity = v;
    },
    setQuality(next) {
      q = next;
      glowMesh.visible = next.glow > 0;
      renderer.setPixelRatio(next.dpr);
      renderer.setSize(vw, vh, false);
    },
    busy: () => busyNow,
    build(name) {
      get(name);
    },
    gpu: gpuName,
    setBias(b) {
      bias = b;
    },
    resize,
    debug: () => {
      const out = {
        t,
        seq,
        maxStep: +maxStep.toFixed(3),
        waves: waves.map((wv) => ({
          on: wv.sprite.visible,
          scale: +wv.sprite.scale.x.toFixed(2),
          opacity: +wv.mat.opacity.toFixed(2),
          at: wv.sprite.position.toArray().map((v) => +v.toFixed(2)),
        })),
      };
      maxStep = 0;
      return out;
    },
    dispose() {
      for (const geo of kinds) geo.dispose();
      shardMat.dispose();
      glowMesh.geometry.dispose();
      glowMat.dispose();
      glowTex.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      forge.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      auraMat.dispose();
      for (const wv of waves) wv.mat.dispose();
      ringTex.dispose();
      envTex.dispose();
      renderer.dispose();
    },
  };
}
