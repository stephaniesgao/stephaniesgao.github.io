import * as THREE from './vendor/three/three.module.min.js';

// A small music-box figurine built from continuous surfaces. The previous
// photogrammetry mesh had duplicated fingers and texture seams that became
// especially visible during a full turn.
const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xf4e7d5, roughness: .34, metalness: .02, clearcoat: .38, clearcoatRoughness: .22, side: THREE.DoubleSide });
const underskirt = new THREE.MeshPhysicalMaterial({ color: 0xe8dac8, roughness: .52, metalness: 0, side: THREE.DoubleSide });
const silkSeam = new THREE.MeshStandardMaterial({ color: 0xd7c5ae, roughness: .7 });
const skin = new THREE.MeshPhysicalMaterial({ color: 0xe8c6ad, roughness: .46, metalness: 0, clearcoat: .13 });
const hair = new THREE.MeshPhysicalMaterial({ color: 0x35231e, roughness: .45, metalness: 0, clearcoat: .16 });
const hairLight = new THREE.MeshStandardMaterial({ color: 0x604237, roughness: .55 });
const brass = new THREE.MeshStandardMaterial({ color: 0xb58b4d, roughness: .34, metalness: .72 });
const eye = new THREE.MeshStandardMaterial({ color: 0x332923, roughness: .35 });
const lip = new THREE.MeshStandardMaterial({ color: 0x9b655f, roughness: .55 });

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const add = (group, geometry, material, position) => {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};
const orb = (group, position, size, material, segments = 24) => {
  const mesh = add(group, new THREE.SphereGeometry(1, segments, 16), material, position);
  mesh.scale.set(...size);
  return mesh;
};

function curvedTube(group, points, radii, material, segments = 28, sides = 12) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => v(...p)), false, 'centripetal');
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = curve.getPointAt(t);
    const scaled = t * (radii.length - 1);
    const from = Math.min(radii.length - 2, Math.floor(scaled));
    const radius = THREE.MathUtils.lerp(radii[from], radii[from + 1], scaled - from);
    for (let j = 0; j <= sides; j++) {
      const angle = j / sides * Math.PI * 2;
      const normal = frames.normals[i].clone().multiplyScalar(Math.cos(angle))
        .addScaledVector(frames.binormals[i], Math.sin(angle));
      const point = center.clone().addScaledVector(normal, radius);
      positions.push(point.x, point.y, point.z);
      if (i < segments && j < sides) {
        const a = i * (sides + 1) + j, b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return add(group, geometry, material);
}

function ribbon(group, points, radius = .006, material = brass) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => v(...p)));
  return add(group, new THREE.TubeGeometry(curve, 24, radius, 6, false), material);
}

function skirt(group, rings, radiusWave, yWave, material) {
  const slices = 72, positions = [], indices = [];
  rings.forEach(([y, radius], row) => {
    for (let i = 0; i <= slices; i++) {
      const angle = i / slices * Math.PI * 2;
      const flutter = Math.sin(angle * 12 + .45) * radiusWave * row / (rings.length - 1);
      const hem = Math.cos(angle * 12 + .45) * yWave * row / (rings.length - 1);
      positions.push((radius + flutter) * Math.cos(angle), y + hem, (radius + flutter) * Math.sin(angle));
      if (row < rings.length - 1 && i < slices) {
        const a = row * (slices + 1) + i, b = a + slices + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  add(group, geometry, material);
}

function trimCircle(group, radius, height, wave = 0) {
  const points = [];
  for (let i = 0; i < 72; i++) {
    const angle = i / 72 * Math.PI * 2;
    points.push(v(radius * Math.cos(angle), height + wave * Math.cos(angle * 12 + .45), radius * Math.sin(angle)));
  }
  const curve = new THREE.CatmullRomCurve3(points, true);
  add(group, new THREE.TubeGeometry(curve, 96, .0055, 5, true), brass);
}

function fingers(group, palm, forward, across) {
  const p = v(...palm), direction = v(...forward).normalize(), lateral = v(...across).normalize();
  orb(group, p, [.024, .012, .017], skin, 14);
  const lengths = [.044, .053, .058, .053];
  for (let i = 0; i < 4; i++) {
    const base = p.clone().addScaledVector(lateral, (i - 1.5) * .010).addScaledVector(direction, .013);
    const tip = base.clone().addScaledVector(direction, lengths[i]).addScaledVector(lateral, (i - 1.5) * .003);
    curvedTube(group, [base.toArray(), tip.toArray()], [.0046, .0024], skin, 9, 7);
    orb(group, tip, [.0026, .0026, .0026], skin, 8);
  }
  const thumbBase = p.clone().addScaledVector(lateral, -.021);
  const thumbTip = thumbBase.clone().addScaledVector(direction, .027).addScaledVector(lateral, -.017);
  curvedTube(group, [thumbBase.toArray(), thumbTip.toArray()], [.006, .003], skin, 9, 7);
  orb(group, thumbTip, [.003, .003, .003], skin, 8);
}

function faceAndHair(group) {
  const head = new THREE.Group();
  head.position.set(0, 2.015, .045);
  head.rotation.set(-.035, -.15, -.075);
  group.add(head);

  // Smooth, separately sculpted hair rather than a noisy photographic texture.
  orb(head, v(0, .035, -.048), [.135, .166, .112], hair);
  orb(head, v(0, 0, .027), [.119, .145, .097], skin);
  orb(head, v(-.112, -.007, .025), [.021, .034, .016], skin, 14);
  orb(head, v(.112, -.007, .025), [.021, .034, .016], skin, 14);
  orb(head, v(0, .105, -.154), [.078, .073, .064], hair);

  // The cap has a clean, curved hairline and a few carved strands at the bun.
  orb(head, v(0, .148, .016), [.111, .030, .074], hair);
  orb(head, v(-.105, .031, .008), [.022, .077, .034], hair);
  orb(head, v(.105, .031, .008), [.022, .077, .034], hair);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      ribbon(head, [
        [side * (.013 + i * .020), .174, -.006],
        [side * (.047 + i * .014), .136, -.055],
        [side * (.040 + i * .010), .073, -.127],
      ], .002, hairLight);
    }
  }

  // Small, even features remain legible when the figurine turns close to camera.
  for (const side of [-1, 1]) {
    const x = side * .044;
    orb(head, v(x, .014, .119), [.016, .0045, .004], eye, 14);
    curvedTube(head, [[x - .017, .042, .113], [x, .048, .119], [x + .017, .043, .112]], [.0025, .0025, .0025], hairLight, 12, 6);
  }
  orb(head, v(0, -.018, .126), [.011, .020, .012], skin, 14);
  curvedTube(head, [[-.022, -.064, .106], [0, -.069, .113], [.022, -.064, .106]], [.003, .003, .003], lip, 12, 6);
}

export function makePorcelainBallerina() {
  const model = new THREE.Group();

  // One pointe foot is the centre of rotation.
  curvedTube(model, [[0, 1.16, 0], [-.018, .94, .012], [-.028, .67, .012], [-.016, .44, .018], [0, .20, .025], [0, .075, .035]], [.12, .095, .072, .064, .044, .039], skin, 48);
  orb(model, v(0, .06, .072), [.064, .093, .080], brass);
  orb(model, v(0, .012, .08), [.050, .020, .060], brass);
  ribbon(model, [[-.035, .16, .079], [.021, .22, .063], [.041, .32, .029]], .006);
  ribbon(model, [[.035, .16, .079], [-.021, .22, .063], [-.041, .32, .029]], .006);

  // The raised leg recedes behind the skirt, rather than peeking from beneath it.
  curvedTube(model, [[.07, 1.13, -.06], [.10, 1.12, -.30], [.12, 1.11, -.56], [.15, 1.14, -.80], [.16, 1.16, -.96]], [.115, .10, .078, .050, .038], skin, 40);
  curvedTube(model, [[.16, 1.16, -.95], [.16, 1.15, -1.03], [.16, 1.15, -1.12]], [.049, .032, .004], brass, 16);
  ribbon(model, [[.13, 1.19, -.88], [.17, 1.19, -.94], [.16, 1.18, -1.01]], .005);

  // Opaque layered tutu, with restrained ripples and a continuous lower edge.
  skirt(model, [[1.35, .17], [1.27, .30], [1.18, .45], [1.07, .50], [1.00, .47]], .018, .018, underskirt);
  skirt(model, [[1.34, .18], [1.27, .31], [1.19, .47], [1.12, .50]], .020, .012, porcelain);
  skirt(model, [[1.34, .18], [1.28, .29], [1.22, .42], [1.18, .45]], .018, .009, porcelain);
  trimCircle(model, .47, 1.005, .018);
  trimCircle(model, .50, 1.12, .012);
  trimCircle(model, .45, 1.18, .009);
  for (let i = 0; i < 16; i++) {
    const angle = i / 16 * Math.PI * 2;
    ribbon(model, [
      [.19 * Math.cos(angle), 1.33, .19 * Math.sin(angle)],
      [.32 * Math.cos(angle), 1.27, .32 * Math.sin(angle)],
      [.44 * Math.cos(angle), 1.19, .44 * Math.sin(angle)],
    ], .0026, silkSeam);
  }
  const underSkirt = add(model, new THREE.CylinderGeometry(.40, .43, .012, 48), porcelain, v(0, 1.06, 0));
  underSkirt.rotation.y = .1;

  // Fitted bodice, neckline, and gold piping.
  orb(model, v(0, 1.59, .01), [.205, .315, .128], porcelain);
  orb(model, v(0, 1.40, .012), [.164, .152, .117], porcelain);
  ribbon(model, [[-.17, 1.77, .067], [-.11, 1.72, .112], [0, 1.71, .137], [.11, 1.72, .112], [.17, 1.77, .067]], .007);
  ribbon(model, [[-.135, 1.69, .112], [-.07, 1.53, .128], [0, 1.37, .125], [.07, 1.53, .128], [.135, 1.69, .112]], .0055);
  trimCircle(model, .17, 1.36);
  curvedTube(model, [[0, 1.78, .015], [0, 1.87, .018], [0, 1.94, .025]], [.055, .047, .050], skin, 16);

  // Puff sleeves mask the shoulder seams, while the arms form a single arabesque line.
  orb(model, v(-.207, 1.76, .009), [.076, .073, .083], porcelain);
  orb(model, v(.207, 1.76, .009), [.076, .073, .083], porcelain);
  curvedTube(model, [[-.24, 1.77, .016], [-.36, 1.88, .050], [-.52, 2.06, .075], [-.65, 2.19, .083]], [.073, .060, .043, .027], skin, 36);
  curvedTube(model, [[.24, 1.76, .016], [.41, 1.68, .052], [.60, 1.62, .075], [.78, 1.63, .087]], [.073, .055, .039, .027], skin, 36);
  fingers(model, [-.665, 2.203, .084], [-.72, .7, .08], [.45, .45, 0]);
  fingers(model, [.797, 1.63, .089], [1, -.12, .08], [.08, 1, 0]);

  faceAndHair(model);
  return model;
}
