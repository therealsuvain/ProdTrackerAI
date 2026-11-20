/**
 * Copy Machine — Box2D-Lite-inspired 2D rigid-body solver for Reanimated UI worklets.
 *
 * It preserves the useful collision architecture from copy-machine-physics-v2:
 * oriented boxes, SAT + clipped face contacts (up to two points), accumulated
 * sequential impulses, warm starting, Coulomb friction, angular inertia and
 * a soft drag joint. The state is plain data (no classes or Maps) so the same
 * solver can run inside a Reanimated UI-runtime worklet.
 *
 * Units: dp, seconds and radians. +Y points down.
 */

export type CopyBody = {
  id: number;
  x: number;
  y: number;
  angle: number;
  cos: number;
  sin: number;
  vx: number;
  vy: number;
  omega: number;
  halfW: number;
  halfH: number;
  mass: number;
  invMass: number;
  invI: number;
  friction: number;
  isStatic: boolean;
  asleep: boolean;
};

type Contact = {
  px: number;
  py: number;
  nx: number;
  ny: number;
  separation: number;
  feature: number;
  pn: number;
  pt: number;
  r1x: number;
  r1y: number;
  r2x: number;
  r2y: number;
  massNormal: number;
  massTangent: number;
  bias: number;
};

type ContactArbiter = {
  aId: number;
  bId: number;
  /** Direct body-array indices avoid repeated linear ID lookups in solver iterations. */
  aIsStatic: boolean;
  aIndex: number;
  bIsStatic: boolean;
  bIndex: number;
  contacts: Contact[];
  friction: number;
};

export type CopyWorld = {
  active: boolean;
  clearing: boolean;
  canvasWidth: number;
  canvasHeight: number;
  floorY: number;
  copyWidth: number;
  copyHeight: number;
  spawnX: number;
  spawnY: number;
  bodies: CopyBody[];
  staticBodies: CopyBody[];
  arbiters: ContactArbiter[];
  accumulator: number;
  dragBodyId: number;
  dragLocalX: number;
  dragLocalY: number;
  dragTargetX: number;
  dragTargetY: number;
  asleep: boolean;
  sleepTimer: number;
  capacityReached: boolean;
};

export const WORKLET_PHYSICS = {
  gravity: 2050,
  fixedStep: 1 / 60,
  maxSubsteps: 2,
  maxFrameDeltaMs: 42,
  solverIterations: 20,
  friction: 0.72,
  biasFactor: 0.18,
  allowedPenetration: 0.65,
  maxBiasVelocity: 360,
  linearDamping: 0.28,
  angularDamping: 2.0,
  maxAngularVelocity: 4.0,
  sleepLinearSpeed: 9,
  sleepAngularSpeed: 0.075,
  sleepDelay: 0.48,
  // A restrained one-time floor rebound; copy-to-copy contacts remain inelastic
  // so a dense pile settles promptly instead of chattering.
  floorRestitution: 0.045,
  floorRestitutionThreshold: 250,
  massAreaDivisor: 10500,
  dragFrequencyHz: 7,
  dragDampingRatio: 0.92,
  dragMaxForceMultiplier: 24,
  throwMaxSpeed: 4200,
  maxCopies: 32,
  spawnGap: 4,
  spawnJitterAngle: 0.035,
  floorInset: 7,
  worldSideMarginRatio: 0.62,
  floorThickness: 400,
  wallThickness: 400,
  ceilingMargin: 300,
} as const;

const NO_CONTACTS: Contact[] = [];
const REL_TOL = 0.95;
const ABS_TOL = 0.01;

export function createCopyBody(
  id: number,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  vx: number,
  vy: number,
  omega: number,
): CopyBody {
  'worklet';
  const mass = Math.max(1, (width * height) / WORKLET_PHYSICS.massAreaDivisor);
  const inertia = (mass * (width * width + height * height)) / 12;
  return {
    id,
    x,
    y,
    angle,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    vx,
    vy,
    omega,
    halfW: width / 2,
    halfH: height / 2,
    mass,
    invMass: 1 / mass,
    invI: 1 / inertia,
    friction: WORKLET_PHYSICS.friction,
    isStatic: false,
    asleep: false,
  };
}

function createStaticBody(
  id: number,
  x: number,
  y: number,
  width: number,
  height: number,
  friction: number,
): CopyBody {
  'worklet';
  return {
    id,
    x,
    y,
    angle: 0,
    cos: 1,
    sin: 0,
    vx: 0,
    vy: 0,
    omega: 0,
    halfW: width / 2,
    halfH: height / 2,
    mass: 0,
    invMass: 0,
    invI: 0,
    friction,
    isStatic: true,
    asleep: true,
  };
}

export function makeCopyWorld(
  canvasWidth: number,
  canvasHeight: number,
  rowX: number,
  rowY: number,
  rowWidth: number,
  rowHeight: number,
  copyScale: number,
): CopyWorld {
  const copyWidth = rowWidth * copyScale;
  const copyHeight = rowHeight * copyScale;
  const floorY = canvasHeight - WORKLET_PHYSICS.floorInset;
  const sideMargin = canvasWidth * WORKLET_PHYSICS.worldSideMarginRatio;
  const slab = WORKLET_PHYSICS.floorThickness;
  const top = -WORKLET_PHYSICS.ceilingMargin;
  const bottom = floorY + slab;
  const wall = WORKLET_PHYSICS.wallThickness;
  const staticBodies = [
    createStaticBody(-1, canvasWidth / 2, floorY + slab / 2, canvasWidth * 6, slab, 0.78),
    createStaticBody(-2, -sideMargin - wall / 2, (top + bottom) / 2, wall, bottom - top, 0.38),
    createStaticBody(-3, canvasWidth + sideMargin + wall / 2, (top + bottom) / 2, wall, bottom - top, 0.38),
    createStaticBody(-4, canvasWidth / 2, top - wall / 2, canvasWidth + 2 * sideMargin + 2 * wall, wall, 0.38),
  ];

  return {
    active: true,
    clearing: false,
    canvasWidth,
    canvasHeight,
    floorY,
    copyWidth,
    copyHeight,
    spawnX: rowX + rowWidth / 2,
    spawnY: rowY + rowHeight + WORKLET_PHYSICS.spawnGap + copyHeight / 2,
    bodies: [],
    staticBodies,
    arbiters: [],
    accumulator: 0,
    dragBodyId: -1,
    dragLocalX: 0,
    dragLocalY: 0,
    dragTargetX: 0,
    dragTargetY: 0,
    asleep: false,
    sleepTimer: 0,
    capacityReached: false,
  };
}

function updateAxes(body: CopyBody) {
  'worklet';
  body.cos = Math.cos(body.angle);
  body.sin = Math.sin(body.angle);
}

function extents(body: CopyBody) {
  'worklet';
  const c = Math.abs(body.cos);
  const s = Math.abs(body.sin);
  return {
    x: c * body.halfW + s * body.halfH,
    y: s * body.halfW + c * body.halfH,
  };
}

function featureKey(v: { in1: number; out1: number; in2: number; out2: number }, flip: boolean) {
  'worklet';
  return flip
    ? v.in2 + v.out2 * 8 + v.in1 * 64 + v.out1 * 512
    : v.in1 + v.out1 * 8 + v.in2 * 64 + v.out2 * 512;
}

type ClipVertex = {
  x: number;
  y: number;
  in1: number;
  out1: number;
  in2: number;
  out2: number;
};

function incidentEdge(
  hx: number,
  hy: number,
  body: CopyBody,
  normalX: number,
  normalY: number,
): [ClipVertex, ClipVertex] {
  'worklet';
  const nx = -(body.cos * normalX + body.sin * normalY);
  const ny = -(-body.sin * normalX + body.cos * normalY);
  const vertex = (lx: number, ly: number, in2: number, out2: number): ClipVertex => ({
    x: body.x + body.cos * lx - body.sin * ly,
    y: body.y + body.sin * lx + body.cos * ly,
    in1: 0,
    out1: 0,
    in2,
    out2,
  });
  if (Math.abs(nx) > Math.abs(ny)) {
    if (nx > 0) return [vertex(hx, -hy, 3, 4), vertex(hx, hy, 4, 1)];
    return [vertex(-hx, hy, 1, 2), vertex(-hx, -hy, 2, 3)];
  }
  if (ny > 0) return [vertex(hx, hy, 4, 1), vertex(-hx, hy, 1, 2)];
  return [vertex(-hx, -hy, 2, 3), vertex(hx, -hy, 3, 4)];
}

function clipSegment(
  input: ClipVertex[],
  nx: number,
  ny: number,
  offset: number,
  clipEdge: number,
): ClipVertex[] {
  'worklet';
  const output: ClipVertex[] = [];
  const d0 = nx * input[0].x + ny * input[0].y - offset;
  const d1 = nx * input[1].x + ny * input[1].y - offset;
  if (d0 <= 0) output.push(input[0]);
  if (d1 <= 0) output.push(input[1]);
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1);
    const a = input[0];
    const b = input[1];
    const vertex: ClipVertex = {
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      in1: 0,
      out1: 0,
      in2: 0,
      out2: 0,
    };
    if (d0 > 0) {
      vertex.in1 = clipEdge;
      vertex.out1 = a.out1;
      vertex.in2 = 0;
      vertex.out2 = a.out2;
    } else {
      vertex.in1 = b.in1;
      vertex.out1 = clipEdge;
      vertex.in2 = b.in2;
      vertex.out2 = 0;
    }
    output.push(vertex);
  }
  return output;
}

function collide(a: CopyBody, b: CopyBody): Contact[] {
  'worklet';
  const dpx = b.x - a.x;
  const dpy = b.y - a.y;
  const dAx = a.cos * dpx + a.sin * dpy;
  const dAy = -a.sin * dpx + a.cos * dpy;
  const dBx = b.cos * dpx + b.sin * dpy;
  const dBy = -b.sin * dpx + b.cos * dpy;
  const rel = b.angle - a.angle;
  const ac = Math.abs(Math.cos(rel));
  const as = Math.abs(Math.sin(rel));
  const faceAx = Math.abs(dAx) - a.halfW - (ac * b.halfW + as * b.halfH);
  const faceAy = Math.abs(dAy) - a.halfH - (as * b.halfW + ac * b.halfH);
  if (faceAx > 0 || faceAy > 0) return NO_CONTACTS;
  const faceBx = Math.abs(dBx) - (ac * a.halfW + as * a.halfH) - b.halfW;
  const faceBy = Math.abs(dBy) - (as * a.halfW + ac * a.halfH) - b.halfH;
  if (faceBx > 0 || faceBy > 0) return NO_CONTACTS;

  let axis = 0;
  let separation = faceAx;
  let nx = dAx > 0 ? a.cos : -a.cos;
  let ny = dAx > 0 ? a.sin : -a.sin;
  if (faceAy > REL_TOL * separation + ABS_TOL * a.halfH) {
    axis = 1;
    separation = faceAy;
    nx = dAy > 0 ? -a.sin : a.sin;
    ny = dAy > 0 ? a.cos : -a.cos;
  }
  if (faceBx > REL_TOL * separation + ABS_TOL * b.halfW) {
    axis = 2;
    separation = faceBx;
    nx = dBx > 0 ? b.cos : -b.cos;
    ny = dBx > 0 ? b.sin : -b.sin;
  }
  if (faceBy > REL_TOL * separation + ABS_TOL * b.halfH) {
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
      frontNx = nx; frontNy = ny;
      front = a.x * frontNx + a.y * frontNy + a.halfW;
      sideNx = -a.sin; sideNy = a.cos;
      const side = a.x * sideNx + a.y * sideNy;
      negSide = -side + a.halfH; posSide = side + a.halfH;
      negEdge = 3; posEdge = 1;
      incident = incidentEdge(b.halfW, b.halfH, b, frontNx, frontNy);
      break;
    }
    case 1: {
      frontNx = nx; frontNy = ny;
      front = a.x * frontNx + a.y * frontNy + a.halfH;
      sideNx = a.cos; sideNy = a.sin;
      const side = a.x * sideNx + a.y * sideNy;
      negSide = -side + a.halfW; posSide = side + a.halfW;
      negEdge = 4; posEdge = 2;
      incident = incidentEdge(b.halfW, b.halfH, b, frontNx, frontNy);
      break;
    }
    case 2: {
      frontNx = -nx; frontNy = -ny;
      front = b.x * frontNx + b.y * frontNy + b.halfW;
      sideNx = -b.sin; sideNy = b.cos;
      const side = b.x * sideNx + b.y * sideNy;
      negSide = -side + b.halfH; posSide = side + b.halfH;
      negEdge = 3; posEdge = 1;
      incident = incidentEdge(a.halfW, a.halfH, a, frontNx, frontNy);
      break;
    }
    default: {
      frontNx = -nx; frontNy = -ny;
      front = b.x * frontNx + b.y * frontNy + b.halfH;
      sideNx = b.cos; sideNy = b.sin;
      const side = b.x * sideNx + b.y * sideNy;
      negSide = -side + b.halfW; posSide = side + b.halfW;
      negEdge = 4; posEdge = 2;
      incident = incidentEdge(a.halfW, a.halfH, a, frontNx, frontNy);
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
    const vertex = clip2[i];
    const sep = frontNx * vertex.x + frontNy * vertex.y - front;
    if (sep <= 0) {
      contacts.push({
        px: vertex.x - sep * frontNx,
        py: vertex.y - sep * frontNy,
        nx,
        ny,
        separation: sep,
        feature: featureKey(vertex, flip),
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


function applyImpulse(a: CopyBody, b: CopyBody, c: Contact, px: number, py: number) {
  'worklet';
  a.vx -= a.invMass * px;
  a.vy -= a.invMass * py;
  a.omega -= a.invI * (c.r1x * py - c.r1y * px);
  b.vx += b.invMass * px;
  b.vy += b.invMass * py;
  b.omega += b.invI * (c.r2x * py - c.r2y * px);
}

function prepareArbiter(arbiter: ContactArbiter, a: CopyBody, b: CopyBody, invDt: number) {
  'worklet';
  const t = WORKLET_PHYSICS;
  for (let i = 0; i < arbiter.contacts.length; i += 1) {
    const c = arbiter.contacts[i];
    c.r1x = c.px - a.x;
    c.r1y = c.py - a.y;
    c.r2x = c.px - b.x;
    c.r2y = c.py - b.y;
    const rn1 = c.r1x * c.nx + c.r1y * c.ny;
    const rn2 = c.r2x * c.nx + c.r2y * c.ny;
    const kNormal =
      a.invMass + b.invMass +
      a.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rn1 * rn1) +
      b.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rn2 * rn2);
    c.massNormal = kNormal > 0 ? 1 / kNormal : 0;
    const tx = c.ny;
    const ty = -c.nx;
    const rt1 = c.r1x * tx + c.r1y * ty;
    const rt2 = c.r2x * tx + c.r2y * ty;
    const kTangent =
      a.invMass + b.invMass +
      a.invI * (c.r1x * c.r1x + c.r1y * c.r1y - rt1 * rt1) +
      b.invI * (c.r2x * c.r2x + c.r2y * c.r2y - rt2 * rt2);
    c.massTangent = kTangent > 0 ? 1 / kTangent : 0;
    const positionalBias = Math.min(
      t.maxBiasVelocity,
      -t.biasFactor * invDt * Math.min(0, c.separation + t.allowedPenetration),
    );
    const isFloorContact =
      (a.isStatic && a.id === -1) || (b.isStatic && b.id === -1);
    let reboundBias = 0;
    // Only the first strong impact creates rebound. Once a contact has a
    // cached normal impulse, keep it inelastic so resting rows cannot pump
    // energy back into the pile on subsequent frames.
    if (isFloorContact && c.pn < 0.01) {
      const relativeVX = b.vx - b.omega * c.r2y - a.vx + a.omega * c.r1y;
      const relativeVY = b.vy + b.omega * c.r2x - a.vy - a.omega * c.r1x;
      const normalSpeed = relativeVX * c.nx + relativeVY * c.ny;
      if (normalSpeed < -t.floorRestitutionThreshold) {
        reboundBias = -t.floorRestitution * normalSpeed;
      }
    }
    c.bias = positionalBias + reboundBias;
    applyImpulse(a, b, c, c.pn * c.nx + c.pt * tx, c.pn * c.ny + c.pt * ty);
  }
}

function solveArbiter(arbiter: ContactArbiter, a: CopyBody, b: CopyBody) {
  'worklet';
  for (let i = 0; i < arbiter.contacts.length; i += 1) {
    const c = arbiter.contacts[i];
    let dvx = b.vx - b.omega * c.r2y - a.vx + a.omega * c.r1y;
    let dvy = b.vy + b.omega * c.r2x - a.vy - a.omega * c.r1x;
    const vn = dvx * c.nx + dvy * c.ny;
    let dPn = c.massNormal * (-vn + c.bias);
    const pn0 = c.pn;
    c.pn = Math.max(pn0 + dPn, 0);
    dPn = c.pn - pn0;
    applyImpulse(a, b, c, dPn * c.nx, dPn * c.ny);

    dvx = b.vx - b.omega * c.r2y - a.vx + a.omega * c.r1y;
    dvy = b.vy + b.omega * c.r2x - a.vy - a.omega * c.r1x;
    const tx = c.ny;
    const ty = -c.nx;
    const vt = dvx * tx + dvy * ty;
    let dPt = c.massTangent * -vt;
    const maxPt = arbiter.friction * c.pn;
    const pt0 = c.pt;
    c.pt = Math.max(-maxPt, Math.min(maxPt, pt0 + dPt));
    dPt = c.pt - pt0;
    applyImpulse(a, b, c, dPt * tx, dPt * ty);
  }
}

function getOldContactImpulse(contacts: Contact[], feature: number) {
  'worklet';
  for (let i = 0; i < contacts.length; i += 1) {
    if (contacts[i].feature === feature) {
      return { pn: contacts[i].pn, pt: contacts[i].pt };
    }
  }
  return { pn: 0, pt: 0 };
}

function addPairArbiter(
  current: ContactArbiter[],
  next: ContactArbiter[],
  a: CopyBody,
  b: CopyBody,
  aIsStatic: boolean,
  aIndex: number,
  bIsStatic: boolean,
  bIndex: number,
) {
  'worklet';
  const contacts = collide(a, b);
  if (contacts.length === 0) return;
  let old: ContactArbiter | null = null;
  for (let i = 0; i < current.length; i += 1) {
    if (current[i].aId === a.id && current[i].bId === b.id) {
      old = current[i];
      break;
    }
  }
  if (old) {
    for (let i = 0; i < contacts.length; i += 1) {
      const impulse = getOldContactImpulse(old.contacts, contacts[i].feature);
      contacts[i].pn = impulse.pn;
      contacts[i].pt = impulse.pt;
    }
  }
  if (a.asleep && !b.asleep) {
    a.asleep = false;
  }
  if (b.asleep && !a.asleep) {
    b.asleep = false;
  }
  next.push({
    aId: a.id,
    bId: b.id,
    aIsStatic,
    aIndex,
    bIsStatic,
    bIndex,
    contacts,
    friction: Math.sqrt(a.friction * b.friction),
  });
}

function applyDragSpring(body: CopyBody, world: CopyWorld, dt: number) {
  'worklet';
  if (body.id !== world.dragBodyId) return;
  const rx = body.cos * world.dragLocalX - body.sin * world.dragLocalY;
  const ry = body.sin * world.dragLocalX + body.cos * world.dragLocalY;
  const pointX = body.x + rx;
  const pointY = body.y + ry;
  const pointVX = body.vx - body.omega * ry;
  const pointVY = body.vy + body.omega * rx;
  const omega = 2 * Math.PI * WORKLET_PHYSICS.dragFrequencyHz;
  const stiffness = body.mass * omega * omega;
  const damping = 2 * body.mass * WORKLET_PHYSICS.dragDampingRatio * omega;
  let forceX = (world.dragTargetX - pointX) * stiffness - pointVX * damping;
  let forceY = (world.dragTargetY - pointY) * stiffness - pointVY * damping;
  const maxForce = body.mass * WORKLET_PHYSICS.gravity * WORKLET_PHYSICS.dragMaxForceMultiplier;
  const forceLength = Math.hypot(forceX, forceY);
  if (forceLength > maxForce) {
    const scale = maxForce / forceLength;
    forceX *= scale;
    forceY *= scale;
  }
  body.vx += forceX * body.invMass * dt;
  body.vy += forceY * body.invMass * dt;
  body.omega += (rx * forceY - ry * forceX) * body.invI * dt;
}

export function stepCopyWorld(world: CopyWorld, dt: number) {
  'worklet';
  const bodies = world.bodies;
  if (world.asleep && world.dragBodyId < 0) return false;

  const linearDamping = 1 / (1 + dt * WORKLET_PHYSICS.linearDamping);
  const angularDamping = 1 / (1 + dt * WORKLET_PHYSICS.angularDamping);
  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i];
    body.vy += WORKLET_PHYSICS.gravity * dt;
    body.vx *= linearDamping;
    body.vy *= linearDamping;
    body.omega *= angularDamping;
    applyDragSpring(body, world, dt);
  }

  // Rebuild contact arbiters, preserving accumulated impulses by contact feature.
  // Precompute each oriented AABB once. This avoids allocating an extents
  // object for every candidate pair on every frame.
  const bodyExtentsX = new Array<number>(bodies.length);
  const bodyExtentsY = new Array<number>(bodies.length);
  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i];
    const c = Math.abs(body.cos);
    const s = Math.abs(body.sin);
    bodyExtentsX[i] = c * body.halfW + s * body.halfH;
    bodyExtentsY[i] = s * body.halfW + c * body.halfH;
  }
  const staticExtentsX = new Array<number>(world.staticBodies.length);
  const staticExtentsY = new Array<number>(world.staticBodies.length);
  for (let i = 0; i < world.staticBodies.length; i += 1) {
    const body = world.staticBodies[i];
    const c = Math.abs(body.cos);
    const s = Math.abs(body.sin);
    staticExtentsX[i] = c * body.halfW + s * body.halfH;
    staticExtentsY[i] = s * body.halfW + c * body.halfH;
  }

  const oldArbiters = world.arbiters;
  const nextArbiters: ContactArbiter[] = [];
  for (let i = 0; i < bodies.length; i += 1) {
    const a = bodies[i];
    const aExtentX = bodyExtentsX[i];
    const aExtentY = bodyExtentsY[i];
    for (let j = i + 1; j < bodies.length; j += 1) {
      const b = bodies[j];
      if (
        Math.abs(a.x - b.x) > aExtentX + bodyExtentsX[j] ||
        Math.abs(a.y - b.y) > aExtentY + bodyExtentsY[j]
      ) continue;
      addPairArbiter(oldArbiters, nextArbiters, a, b, false, i, false, j);
    }
    for (let j = 0; j < world.staticBodies.length; j += 1) {
      const b = world.staticBodies[j];
      if (
        Math.abs(a.x - b.x) > aExtentX + staticExtentsX[j] ||
        Math.abs(a.y - b.y) > aExtentY + staticExtentsY[j]
      ) continue;
      // Keep the same stable body ordering as the reference engine: static
      // boundary bodies (negative ids) precede dynamic copies. SAT clipping
      // uses this ordering when selecting the reference and incident faces.
      addPairArbiter(oldArbiters, nextArbiters, b, a, true, j, false, i);
    }
  }
  world.arbiters = nextArbiters;

  const invDt = 1 / dt;
  for (let i = 0; i < nextArbiters.length; i += 1) {
    const arbiter = nextArbiters[i];
    const a = arbiter.aIsStatic
      ? world.staticBodies[arbiter.aIndex]
      : world.bodies[arbiter.aIndex];
    const b = arbiter.bIsStatic
      ? world.staticBodies[arbiter.bIndex]
      : world.bodies[arbiter.bIndex];
    if (a && b) prepareArbiter(arbiter, a, b, invDt);
  }
  for (let iteration = 0; iteration < WORKLET_PHYSICS.solverIterations; iteration += 1) {
    for (let i = 0; i < nextArbiters.length; i += 1) {
      const arbiter = nextArbiters[i];
      const a = arbiter.aIsStatic
        ? world.staticBodies[arbiter.aIndex]
        : world.bodies[arbiter.aIndex];
      const b = arbiter.bIsStatic
        ? world.staticBodies[arbiter.bIndex]
        : world.bodies[arbiter.bIndex];
      if (a && b) solveArbiter(arbiter, a, b);
    }
  }

  let allQuiet = world.dragBodyId < 0;
  for (let i = 0; i < bodies.length; i += 1) {
    const body = bodies[i];
    body.omega = Math.max(
      -WORKLET_PHYSICS.maxAngularVelocity,
      Math.min(WORKLET_PHYSICS.maxAngularVelocity, body.omega),
    );
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    body.angle += body.omega * dt;
    updateAxes(body);
    if (
      Math.hypot(body.vx, body.vy) > WORKLET_PHYSICS.sleepLinearSpeed ||
      Math.abs(body.omega) > WORKLET_PHYSICS.sleepAngularSpeed
    ) {
      allQuiet = false;
    }
  }

  // Sleep the pile as a group. This avoids neighbouring rows repeatedly
  // waking one another because their individual sleep timers crossed the
  // threshold on slightly different frames.
  if (allQuiet) {
    world.sleepTimer += dt;
    if (world.sleepTimer >= WORKLET_PHYSICS.sleepDelay) {
      world.asleep = true;
      for (let i = 0; i < bodies.length; i += 1) {
        const body = bodies[i];
        body.asleep = true;
        body.vx = 0;
        body.vy = 0;
        body.omega = 0;
      }
    }
  } else {
    world.sleepTimer = 0;
    world.asleep = false;
    for (let i = 0; i < bodies.length; i += 1) bodies[i].asleep = false;
  }

  return !world.asleep;
}

export function bodyOverlapsSpawn(body: CopyBody, x: number, y: number, halfW: number, halfH: number) {
  'worklet';
  const e = extents(body);
  return Math.abs(body.x - x) < e.x + halfW - 1 && Math.abs(body.y - y) < e.y + halfH - 1;
}

/* export function findSpawnPosition(world: CopyWorld) {
  'worklet';
  const offsets = [0, -0.035, 0.035, -0.07, 0.07, -0.105, 0.105];
  let foundX = world.spawnX;
  let found = false;
  let movingBlocker = false;
  for (let slot = 0; slot < offsets.length; slot += 1) {
    const candidateX = Math.max(
      world.copyWidth / 2 + 2,
      Math.min(world.canvasWidth - world.copyWidth / 2 - 2, world.spawnX + offsets[slot] * world.canvasWidth),
    );
    let occupied = false;
    for (let i = 0; i < world.bodies.length; i += 1) {
      const body = world.bodies[i];
      if (bodyOverlapsSpawn(body, candidateX, world.spawnY, world.copyWidth / 2, world.copyHeight / 2)) {
        occupied = true;
        if (!body.asleep || Math.hypot(body.vx, body.vy) > WORKLET_PHYSICS.sleepLinearSpeed) {
          movingBlocker = true;
        }
        break;
      }
    }
    if (!occupied) {
      foundX = candidateX;
      found = true;
      break;
    }
  }
  return { found, movingBlocker, x: foundX };
} */

function findTopSpawnPosition(
  world: CopyWorld,
  preferredX: number,
) {
  "worklet";

  // Start completely above the visible canvas.
  const topY =
    -world.copyHeight / 2 - WORKLET_PHYSICS.spawnGap;

  // Search several horizontal positions across the viewport.
  const offsets = [
    0,
    -0.08, 0.08,
    -0.16, 0.16,
    -0.28, 0.28,
    -0.42, 0.42,
  ];

  const minX = world.copyWidth / 2 + 2;
  const maxX = world.canvasWidth - world.copyWidth / 2 - 2;

  let foundX = Math.max(minX, Math.min(maxX, preferredX));
  let movingBlocker = false;
  let previousX = Number.NaN;

  for (let slot = 0; slot < offsets.length; slot += 1) {
    const candidateX = Math.max(
      minX,
      Math.min(
        maxX,
        world.spawnX + offsets[slot] * world.canvasWidth,
      ),
    );

    // Several offsets may clamp to the same position on narrow screens.
    if (Math.abs(candidateX - previousX) < 1) continue;
    previousX = candidateX;

    let occupied = false;

    for (let i = 0; i < world.bodies.length; i += 1) {
      const body = world.bodies[i];

      if (
        bodyOverlapsSpawn(
          body,
          candidateX,
          topY,
          world.copyWidth / 2,
          world.copyHeight / 2,
        )
      ) {
        occupied = true;

        if (
          !body.asleep ||
          Math.hypot(body.vx, body.vy) >
          WORKLET_PHYSICS.sleepLinearSpeed
        ) {
          movingBlocker = true;
        }

        break;
      }
    }

    if (!occupied) {
      foundX = candidateX;

      return {
        found: true,
        movingBlocker: false,
        x: foundX,
        y: topY,
      };
    }
  }

  return {
    found: false,
    movingBlocker,
    x: foundX,
    y: topY,
  };
}


export function findSpawnPosition(
  world: CopyWorld,
  preferredX = world.spawnX,
) {
  "worklet";

  const offsets = [0, -0.035, 0.035, -0.07, 0.07, -0.105, 0.105];

  const minX = world.copyWidth / 2 + 2;
  const maxX = world.canvasWidth - world.copyWidth / 2 - 2;

  let foundX = Math.max(minX, Math.min(maxX, preferredX));
  let found = false;
  let movingBlocker = false;

  for (let slot = 0; slot < offsets.length; slot += 1) {
    const candidateX = Math.max(
      minX,
      Math.min(
        maxX,
        preferredX + offsets[slot] * world.canvasWidth,
      ),
    );

    let occupied = false;

    for (let i = 0; i < world.bodies.length; i += 1) {
      const body = world.bodies[i];

      if (
        bodyOverlapsSpawn(
          body,
          candidateX,
          world.spawnY,
          world.copyWidth / 2,
          world.copyHeight / 2,
        )
      ) {
        occupied = true;

        if (
          !body.asleep ||
          Math.hypot(body.vx, body.vy) >
          WORKLET_PHYSICS.sleepLinearSpeed
        ) {
          movingBlocker = true;
        }

        break;
      }
    }

    if (!occupied) {
      foundX = candidateX;
      found = true;
      break;
    }
  }

  return {
    found,
    movingBlocker,
    x: foundX,
    y: world.spawnY,
  };
}

export function hitTestCopy(world: CopyWorld, x: number, y: number) {
  'worklet';
  for (let i = world.bodies.length - 1; i >= 0; i -= 1) {
    const body = world.bodies[i];
    const dx = x - body.x;
    const dy = y - body.y;
    const localX = body.cos * dx + body.sin * dy;
    const localY = -body.sin * dx + body.cos * dy;
    if (Math.abs(localX) <= body.halfW && Math.abs(localY) <= body.halfH) return body.id;
  }
  return -1;
}

export function getCopyPileBounds(world: CopyWorld, padding: number) {
  'worklet';
  if (world.bodies.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < world.bodies.length; i += 1) {
    const body = world.bodies[i];
    const e = extents(body);
    minX = Math.min(minX, body.x - e.x);
    minY = Math.min(minY, body.y - e.y);
    maxX = Math.max(maxX, body.x + e.x);
    maxY = Math.max(maxY, body.y + e.y);
  }
  minX = Math.max(0, minX - padding);
  minY = Math.max(world.spawnY - world.copyHeight / 2, minY - padding);
  maxX = Math.min(world.canvasWidth, maxX + padding);
  maxY = Math.min(world.canvasHeight, maxY + padding);
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function packCopyPoses(world: CopyWorld) {
  'worklet';
  const result = new Array<number>(world.bodies.length * 3);
  for (let i = 0; i < world.bodies.length; i += 1) {
    const body = world.bodies[i];
    result[i * 3] = body.x;
    result[i * 3 + 1] = body.y;
    result[i * 3 + 2] = body.angle;
  }
  return result;
}

export function releaseDraggedCopy(world: CopyWorld, velocityX: number, velocityY: number) {
  'worklet';
  const id = world.dragBodyId;
  let body: CopyBody | null = null;
  for (let i = 0; i < world.bodies.length; i += 1) {
    if (world.bodies[i].id === id) {
      body = world.bodies[i];
      break;
    }
  }
  if (!body) {
    world.dragBodyId = -1;
    return;
  }
  const rx = body.cos * world.dragLocalX - body.sin * world.dragLocalY;
  const ry = body.sin * world.dragLocalX + body.cos * world.dragLocalY;
  const pointVX = body.vx - body.omega * ry;
  const pointVY = body.vy + body.omega * rx;
  const speed = Math.hypot(velocityX, velocityY);
  if (speed > WORKLET_PHYSICS.throwMaxSpeed) {
    const scale = WORKLET_PHYSICS.throwMaxSpeed / speed;
    velocityX *= scale;
    velocityY *= scale;
  }
  const dx = velocityX - pointVX;
  const dy = velocityY - pointVY;
  const k11 = body.invMass + body.invI * ry * ry;
  const k12 = -body.invI * rx * ry;
  const k22 = body.invMass + body.invI * rx * rx;
  const determinant = k11 * k22 - k12 * k12;
  if (determinant !== 0) {
    const impulseX = (k22 * dx - k12 * dy) / determinant;
    const impulseY = (-k12 * dx + k11 * dy) / determinant;
    body.vx += body.invMass * impulseX;
    body.vy += body.invMass * impulseY;
    body.omega += body.invI * (rx * impulseY - ry * impulseX);
  }
  world.dragBodyId = -1;
  body.asleep = false;
  world.sleepTimer = 0;
  world.asleep = false;
}

export function wakeAllCopies(world: CopyWorld) {
  'worklet';
  world.asleep = false;
  world.sleepTimer = 0;
  for (let i = 0; i < world.bodies.length; i += 1) {
    world.bodies[i].asleep = false;
  }
}
