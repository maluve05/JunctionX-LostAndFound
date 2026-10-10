import * as THREE from "three";

/*
  Geometry from the FORGe mark (see mark.ts for the paths themselves). Seen
  straight on, the extruded forge has exactly the logo's silhouette.
*/

export {
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
  type LogoShard,
} from "./mark";

type Pt = [number, number];

/** Parse an M/L/Z polyline path into its subpaths, y flipped to point up. */
export function parsePolylines(d: string): Pt[][] {
  const out: Pt[][] = [];
  for (const chunk of d
    .split("M")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const nums = chunk
      .replace(/[LZ]/g, " ")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], -nums[i + 1]]);
    out.push(pts);
  }
  return out;
}

const area = (pts: Pt[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
};

/**
 * One shape from a path: the first subpath is the outline, the rest are holes
 * (the mark is drawn even-odd). Outline counter-clockwise, holes clockwise, so
 * the extrusion always faces the right way.
 */
export function shapeFromPath(d: string, offset: Pt = [0, 0]): THREE.Shape {
  const [outline, ...holes] = parsePolylines(d).map((pts) =>
    pts.map(([x, y]) => [x - offset[0], y - offset[1]] as Pt),
  );
  const ccw = (pts: Pt[]) => (area(pts) < 0 ? [...pts].reverse() : pts);
  const cw = (pts: Pt[]) => (area(pts) > 0 ? [...pts].reverse() : pts);
  const shape = new THREE.Shape(ccw(outline).map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) {
    shape.holes.push(new THREE.Path(cw(h).map(([x, y]) => new THREE.Vector2(x, y))));
  }
  return shape;
}

/** Extrude a shape along z, centred on z = 0. */
export function extrude(shape: THREE.Shape | THREE.Shape[], depth: number, bevel: number) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.6,
    bevelSegments: 2,
    curveSegments: 1,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Centroid of a path's outline, in the flipped (y-up) space. */
export function centroid(d: string): Pt {
  const [outline] = parsePolylines(d);
  let x = 0;
  let y = 0;
  for (const [px, py] of outline) {
    x += px;
    y += py;
  }
  return [x / outline.length, y / outline.length];
}

/**
 * A particle geometry from one of the mark's own sparks, scaled so its longest
 * side is 1 and centred, turned so the spark points along +y.
 */
export function unitShardGeometry(d: string, angle: number, depth = 0.05): THREE.BufferGeometry {
  const [outline] = parsePolylines(d);
  const [cx, cy] = centroid(d);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const pts = outline.map(([x, y]) => [(x - cx) / size, (y - cy) / size] as Pt);
  const shape = new THREE.Shape(
    (area(pts) < 0 ? [...pts].reverse() : pts).map(([x, y]) => new THREE.Vector2(x, y)),
  );
  const geo = extrude(shape, depth, 0);
  // A spark leaning `angle` degrees from vertical is turned upright.
  geo.rotateZ((angle * Math.PI) / 180);
  return geo;
}

/** The tapered blade: the spark language's basic fragment, length 1 along +y. */
export function bladeGeometry(depth = 0.045): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0.1, -0.5);
  shape.lineTo(0.072, 0.05);
  shape.lineTo(0, 0.5);
  shape.lineTo(-0.034, 0.05);
  shape.lineTo(-0.1, -0.5);
  shape.closePath();
  return extrude(shape, depth, 0);
}
