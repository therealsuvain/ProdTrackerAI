/**
 * Minimal 2D rigid-body engine for the Copy Machine pile.
 *
 * Oriented boxes only. Box-box contacts come from a SAT test plus edge
 * clipping, which yields up to two contact points per pair. Contacts are
 * solved with warm-started, accumulated sequential impulses and friction
 * (the well-known Box2D-Lite scheme). Unlike an axis-aligned approximation,
 * a tilted card rests on its real corners, so nothing floats or fidgets.
 *
 * Units: dp, seconds, radians. +y points down, positive angle is clockwise,
 * which matches React Native's coordinate system and `rotate`.
 *
 * Pure TypeScript with no React Native imports, so it can run headless.
 */

export const PHYSICS_TUNING = {
  gravity: 2450,
  fixedStep: 1 / 60,
  maxStepsPerFrame: 3,
  iterations: 20, // 10 left a tall stack creeping/rocking for several seconds.

  friction: 0.6,
  // Soft position correction
  biasFactor: 0.2,
  allowedPenetration: 0.5,
  maxBiasVelocity: 400,

  // Per-second damping, applied as v *= 1 / (1 + dt * damping)
  linearDamping: 0.12,
  angularDamping: 0.5,
  maxAngularVelocity: 14,

  // The whole world sleeps once every dynamic body stays below both
  // thresholds for `sleepDelay` seconds.
  sleepLinearSpeed: 8,
  sleepAngularSpeed: 0.05,
  sleepDelay: 0.4,

  // mass = area / massAreaDivisor
  massAreaDivisor: 9000,
};

export type PhysicsBody = {
  id: number;
  x: number;
  y: number;
  angle: number;
  cos: number;
  sin: number;
  vx: number;
  vy: number;
  w: number;
  hw: number; // half width
  hh: number; // half height
  mass: number;
  invMass: number;
  invI: number;
  friction: number;
  isStatic: boolean;
};

export function createBody(options: {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isStatic?: boolean;
  angle?: number;
  vx?: number;
  vy?: number;
  w?: number;
  friction?: number;
}): PhysicsBody {
  const isStatic = options.isStatic ?? false;
  const angle = options.angle ?? 0;
  const mass = isStatic
    ? 0
    : Math.max(
        1,
        (options.width * options.height) / PHYSICS_TUNING.massAreaDivisor,
      );
  const inertia = isStatic
    ? 0
    : (mass * (options.width ** 2 + options.height ** 2)) / 12;
  return {
    id: options.id,
    x: options.x,
    y: options.y,
    angle,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    vx: options.vx ?? 0,
    vy: options.vy ?? 0,
    w: options.w ?? 0,
    hw: options.width / 2,
    hh: options.height / 2,
    mass,
    invMass: isStatic ? 0 : 1 / mass,
    invI: isStatic ? 0 : 1 / inertia,
    friction: options.friction ?? PHYSICS_TUNING.friction,
    isStatic,
  };
}

export function getBodyExtents(body: PhysicsBody) {
  const c = Math.abs(body.cos);
  const s = Math.abs(body.sin);
  return { x: c * body.hw + s * body.hh, y: s * body.hw + c * body.hh };
}

// ---------------------------------------------------------------------------
// Collision (box vs box)
// ---------------------------------------------------------------------------

type Contact = {
  px: number;
  py: number;
  nx: number;
  ny: number;
  separation: number;
  feature: number;
  // Accumulated impulses (kept between frames for warm starting)
  pn: number;
  pt: number;
  // Solver cache
  r1x: number;
  r1y: number;
  r2x: number;
  r2y: number;
  massNormal: number;
  massTangent: number;
  bias: number;
};

type ClipVertex = {
  x: number;
  y: number;
  in1: number;
  out1: number;
  in2: number;
  out2: number;
};

const NO_CONTACTS: Contact[] = [];
const REL_TOL = 0.95;
const ABS_TOL = 0.01;

function featureKey(v: ClipVertex, flip: boolean) {
  return flip
    ? v.in2 + v.out2 * 8 + v.in1 * 64 + v.out1 * 512
    : v.in1 + v.out1 * 8 + v.in2 * 64 + v.out2 * 512;
}

function incidentEdge(
  hx: number,
  hy: number,
  body: PhysicsBody,
  normalX: number,
  normalY: number,
): [ClipVertex, ClipVertex] {
  // n = -(Rot^T * normal): the reference normal in the incident body's frame
  const nx = -(body.cos * normalX + body.sin * normalY);
  const ny = -(-body.sin * normalX + body.cos * normalY);
  const v = (
    lx: number,
    ly: number,
    in2: number,
    out2: number,
  ): ClipVertex => ({
    x: body.x + body.cos * lx - body.sin * ly,
    y: body.y + body.sin * lx + body.cos * ly,
    in1: 0,
    out1: 0,
    in2,
    out2,
  });

  if (Math.abs(nx) > Math.abs(ny)) {
    if (nx > 0) return [v(hx, -hy, 3, 4), v(hx, hy, 4, 1)];
    return [v(-hx, hy, 1, 2), v(-hx, -hy, 2, 3)];
  }
  if (ny > 0) return [v(hx, hy, 4, 1), v(-hx, hy, 1, 2)];
  return [v(-hx, -hy, 2, 3), v(hx, -hy, 3, 4)];
}

function clipSegment(
  input: ClipVertex[],
  nx: number,
  ny: number,
  offset: number,
  clipEdge: number,
): ClipVertex[] {
  const out: ClipVertex[] = [];
  const d0 = nx * input[0].x + ny * input[0].y - offset;
  const d1 = nx * input[1].x + ny * input[1].y - offset;
  if (d0 <= 0) out.push(input[0]);
  if (d1 <= 0) out.push(input[1]);
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1);
    const a = input[0];
    const b = input[1];
    const v: ClipVertex = {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      in1: 0,
      out1: 0,
      in2: 0,
      out2: 0,
    };
    if (d0 > 0) {
      v.in1 = clipEdge;
      v.out1 = a.out1;
      v.in2 = 0;
      v.out2 = a.out2;
    } else {
      v.in1 = b.in1;
      v.out1 = clipEdge;
      v.in2 = b.in2;
      v.out2 = 0;
    }
    out.push(v);
  }
  return out;
}

function collide(a: PhysicsBody, b: PhysicsBody): Contact[] {
  const dpx = b.x - a.x;
  const dpy = b.y - a.y;
  const dAx = a.cos * dpx + a.sin * dpy;
  const dAy = -a.sin * dpx + a.cos * dpy;
  const dBx = b.cos * dpx + b.sin * dpy;
  const dBy = -b.sin * dpx + b.cos * dpy;

  const rel = b.angle - a.angle;
  const ac = Math.abs(Math.cos(rel));
  const as = Math.abs(Math.sin(rel));

  const faceAx = Math.abs(dAx) - a.hw - (ac * b.hw + as * b.hh);
  const faceAy = Math.abs(dAy) - a.hh - (as * b.hw + ac * b.hh);
  if (faceAx > 0 || faceAy > 0) return NO_CONTACTS;

  const faceBx = Math.abs(dBx) - (ac * a.hw + as * a.hh) - b.hw;
  const faceBy = Math.abs(dBy) - (as * a.hw + ac * a.hh) - b.hh;
  if (faceBx > 0 || faceBy > 0) return NO_CONTACTS;

  // Best separating axis: 0 = A.x, 1 = A.y, 2 = B.x, 3 = B.y
  let axis = 0;
  let separation = faceAx;
  let nx = dAx > 0 ? a.cos : -a.cos;
  let ny = dAx > 0 ? a.sin : -a.sin;

  if (faceAy > REL_TOL * separation + ABS_TOL * a.hh) {
    axis = 1;
    separation = faceAy;
    nx = dAy > 0 ? -a.sin : a.sin;
    ny = dAy > 0 ? a.cos : -a.cos;
  }
  if (faceBx > REL_TOL * separation + ABS_TOL * b.hw) {
    axis = 2;
    separation = faceBx;
    nx = dBx > 0 ? b.cos : -b.cos;
    ny = dBx > 0 ? b.sin : -b.sin;
  }
  if (faceBy > REL_TOL * separation + ABS_TOL * b.hh) {
    axis = 3;
    separation = faceBy;
    nx = dBy > 0 ? -b.sin : b.sin;
    ny = dBy > 0 ? b.cos : -b.cos;
  }

  let frontNx: number;
  let frontNy: number;
  let front: number;
  let sideNx: number;
  let sideNy: number;
  let negSide: number;
  let posSide: number;
  let negEdge: number;
  let posEdge: number;
  let incident: [ClipVertex, ClipVertex];

  switch (axis) {
    case 0: {
      frontNx = nx;
      frontNy = ny;
      front = a.x * frontNx + a.y * frontNy + a.hw;
      sideNx = -a.sin;
      sideNy = a.cos;
      const side = a.x * sideNx + a.y * sideNy;
      negSide = -side + a.hh;
      posSide = side + a.hh;
      negEdge = 3;
      posEdge = 1;
      incident = incidentEdge(b.hw, b.hh, b, frontNx, frontNy);
      break;
    }
    case 1: {
      frontNx = nx;
      frontNy = ny;
      front = a.x * frontNx + a.y * frontNy + a.hh;
      sideNx = a.cos;
      sideNy = a.sin;
      const side = a.x * sideNx + a.y * sideNy;
      negSide = -side + a.hw;
      posSide = side + a.hw;
      negEdge = 4;
      posEdge = 2;
      incident = incidentEdge(b.hw, b.hh, b, frontNx, frontNy);
      break;
    }
    case 2: {
      frontNx = -nx;
      frontNy = -ny;
      front = b.x * frontNx + b.y * frontNy + b.hw;
      sideNx = -b.sin;
      sideNy = b.cos;
      const side = b.x * sideNx + b.y * sideNy;
      negSide = -side + b.hh;
      posSide = side + b.hh;
      negEdge = 3;
      posEdge = 1;
      incident = incidentEdge(a.hw, a.hh, a, frontNx, frontNy);
      break;
    }
    default: {
      frontNx = -nx;
      frontNy = -ny;
      front = b.x * frontNx + b.y * frontNy + b.hh;
      sideNx = b.cos;
      sideNy = b.sin;
      const side = b.x * sideNx + b.y * sideNy;
      negSide = -side + b.hw;
      posSide = side + b.hw;
      negEdge = 4;
      posEdge = 2;
      incident = incidentEdge(a.hw, a.hh, a, frontNx, frontNy);
      break;
    }
  }

  const clip1 = clipSegment(incident, -sideNx, -sideNy, negSide, negEdge);
  if (clip1.length < 2) return NO_CONTACTS;
  const clip2 = clipSegment(clip1, sideNx, sideNy, posSide, posEdge);
  if (clip2.length < 2) return NO_CONTACTS;

  const flip = axis >= 2;
  const contacts: Contact[] = [];
  for (let i = 0; i < 2; i += 1) {
    const v = clip2[i];
    const sep = frontNx * v.x + frontNy * v.y - front;
    if (sep <= 0) {
      contacts.push({
        px: v.x - sep * frontNx,
        py: v.y - sep * frontNy,
        nx,
        ny,
        separation: sep,
        feature: featureKey(v, flip),
        pn: 0,
        pt: 0,
        r1x: 0,
        r1y: 0,
        r2x: 0,
        r2y: 0,
        massNormal: 0,
        massTangent: 0,
        bias: 0,
      });
    }
  }
  return contacts;
}

// ---------------------------------------------------------------------------
// Arbiter (per-pair contact constraint)
// ---------------------------------------------------------------------------

class Arbiter {
  contacts: Contact[];
  readonly friction: number;

  constructor(
    readonly a: PhysicsBody,
    readonly b: PhysicsBody,
    contacts: Contact[],
  ) {
    this.contacts = contacts;
    this.friction = Math.sqrt(a.friction * b.friction);
  }

  update(fresh: Contact[]) {
    for (const contact of fresh) {
      const old = this.contacts.find((c) => c.feature === contact.feature);
      if (old) {
        contact.pn = old.pn;
        contact.pt = old.pt;
      }
    }
    this.contacts = fresh;
  }

  private applyImpulse(
    c: Contact,
    px: number,
    py: number,
  ) {
    const { a, b } = this;
    a.vx -= a.invMass * px;
    a.vy -= a.invMass * py;
    a.w -= a.invI * (c.r1x * py - c.r1y * px);
    b.vx += b.invMass * px;
    b.vy += b.invMass * py;
    b.w += b.invI * (c.r2x * py - c.r2y * px);
  }

  preStep(invDt: number) {
    const { a, b } = this;
    const t = PHYSICS_TUNING;
    for (const c of this.contacts) {
      c.r1x = c.px - a.x;
      c.r1y = c.py - a.y;
      c.r2x = c.px - b.x;
      c.r2y = c.py - b.y;

      const rn1 = c.r1x * c.nx + c.r1y * c.ny;
      const rn2 = c.r2x * c.nx + c.r2y * c.ny;
      const kNormal =
        a.invMass +
        b.invMass +
        a.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rn1 * rn1) +
        b.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rn2 * rn2);
      c.massNormal = 1 / kNormal;

      const tx = c.ny;
      const ty = -c.nx;
      const rt1 = c.r1x * tx + c.r1y * ty;
      const rt2 = c.r2x * tx + c.r2y * ty;
      const kTangent =
        a.invMass +
        b.invMass +
        a.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rt1 * rt1) +
        b.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rt2 * rt2);
      c.massTangent = 1 / kTangent;

      c.bias = Math.min(
        t.maxBiasVelocity,
        -t.biasFactor *
          invDt *
          Math.min(0, c.separation + t.allowedPenetration),
      );

      // Warm start
      this.applyImpulse(c, c.pn * c.nx + c.pt * tx, c.pn * c.ny + c.pt * ty);
    }
  }

  solve() {
    const { a, b } = this;
    for (const c of this.contacts) {
      // Normal
      let dvx = b.vx - b.w * c.r2y - a.vx + a.w * c.r1y;
      let dvy = b.vy + b.w * c.r2x - a.vy - a.w * c.r1x;
      const vn = dvx * c.nx + dvy * c.ny;
      let dPn = c.massNormal * (-vn + c.bias);
      const pn0 = c.pn;
      c.pn = Math.max(pn0 + dPn, 0);
      dPn = c.pn - pn0;
      this.applyImpulse(c, dPn * c.nx, dPn * c.ny);

      // Friction
      dvx = b.vx - b.w * c.r2y - a.vx + a.w * c.r1y;
      dvy = b.vy + b.w * c.r2x - a.vy - a.w * c.r1x;
      const tx = c.ny;
      const ty = -c.nx;
      const vt = dvx * tx + dvy * ty;
      let dPt = c.massTangent * -vt;
      const maxPt = this.friction * c.pn;
      const pt0 = c.pt;
      c.pt = Math.max(-maxPt, Math.min(maxPt, pt0 + dPt));
      dPt = c.pt - pt0;
      this.applyImpulse(c, dPt * tx, dPt * ty);
    }
  }
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export class PhysicsWorld {
  /** Ordered by id ascending so pair keys and normals stay stable. */
  readonly bodies: PhysicsBody[] = [];
  asleep = false;
  private sleepTimer = 0;
  private arbiters = new Map<number, Arbiter>();

  add(body: PhysicsBody) {
    this.bodies.push(body);
    this.bodies.sort((p, q) => p.id - q.id);
    this.wake();
  }

  wake() {
    this.asleep = false;
    this.sleepTimer = 0;
  }

  /** First body whose bounding box overlaps the given box, if any. */
  firstOverlap(cx: number, cy: number, hw: number, hh: number) {
    for (const body of this.bodies) {
      const e = getBodyExtents(body);
      if (
        Math.abs(body.x - cx) < e.x + hw - 1 &&
        Math.abs(body.y - cy) < e.y + hh - 1
      ) {
        return body;
      }
    }
    return null;
  }

  step(dt: number) {
    const t = PHYSICS_TUNING;
    const bodies = this.bodies;

    // Forces and damping
    const linear = 1 / (1 + dt * t.linearDamping);
    const angular = 1 / (1 + dt * t.angularDamping);
    for (const body of bodies) {
      if (body.isStatic) continue;
      body.vy += t.gravity * dt;
      body.vx *= linear;
      body.vy *= linear;
      body.w *= angular;
    }

    // Broad + narrow phase
    for (let i = 0; i < bodies.length; i += 1) {
      for (let j = i + 1; j < bodies.length; j += 1) {
        const a = bodies[i];
        const b = bodies[j];
        if (a.isStatic && b.isStatic) continue;
        const key = (a.id + 1) * 100000 + (b.id + 1);
        const contacts = collide(a, b);
        if (contacts.length > 0) {
          const existing = this.arbiters.get(key);
          if (existing) existing.update(contacts);
          else this.arbiters.set(key, new Arbiter(a, b, contacts));
        } else {
          this.arbiters.delete(key);
        }
      }
    }

    const invDt = 1 / dt;
    for (const arbiter of this.arbiters.values()) arbiter.preStep(invDt);
    for (let k = 0; k < t.iterations; k += 1) {
      for (const arbiter of this.arbiters.values()) arbiter.solve();
    }

    // Integrate
    let quiet = true;
    for (const body of bodies) {
      if (body.isStatic) continue;
      body.w = Math.max(
        -t.maxAngularVelocity,
        Math.min(t.maxAngularVelocity, body.w),
      );
      body.x += body.vx * dt;
      body.y += body.vy * dt;
      body.angle += body.w * dt;
      body.cos = Math.cos(body.angle);
      body.sin = Math.sin(body.angle);
      if (
        Math.hypot(body.vx, body.vy) > t.sleepLinearSpeed ||
        Math.abs(body.w) > t.sleepAngularSpeed
      ) {
        quiet = false;
      }
    }

    if (quiet) {
      this.sleepTimer += dt;
      if (this.sleepTimer >= t.sleepDelay) {
        for (const body of bodies) {
          body.vx = 0;
          body.vy = 0;
          body.w = 0;
        }
        this.asleep = true;
      }
    } else {
      this.sleepTimer = 0;
    }
  }
}
