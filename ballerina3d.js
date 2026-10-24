import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

let modelPromise;
function loadModel() {
  modelPromise ||= new GLTFLoader().loadAsync('./objects/ballerina-revised.glb?v=1');
  return modelPromise;
}

const smoothstep = (start, end, value) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

function refinePose(geometry) {
  const positions = geometry.attributes.position;
  const indices = geometry.index;
  const original = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    original[i * 3] = positions.getX(i);
    original[i * 3 + 1] = positions.getY(i);
    original[i * 3 + 2] = positions.getZ(i);
  }
  const sums = new Float32Array(original.length);
  const neighbors = new Uint16Array(positions.count);

  // A light surface pass removes the little lumps around her face without
  // flattening the nose or altering the mapped facial details.
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i), b = indices.getX(i + 1), c = indices.getX(i + 2);
    for (const [from, to] of [[a, b], [a, c], [b, a], [b, c], [c, a], [c, b]]) {
      const offset = from * 3, target = to * 3;
      sums[offset] += original[target];
      sums[offset + 1] += original[target + 1];
      sums[offset + 2] += original[target + 2];
      neighbors[from]++;
    }
  }

  for (let i = 0; i < positions.count; i++) {
    const offset = i * 3;
    let x = original[offset], y = original[offset + 1], z = original[offset + 2];
    const face = smoothstep(-.17, -.145, x) * (1 - smoothstep(-.075, -.05, x))
      * smoothstep(.265, .285, y) * (1 - smoothstep(.34, .36, y))
      * (1 - smoothstep(-.015, .015, z));
    if (face && neighbors[i]) {
      const blend = face * .24;
      x += (sums[offset] / neighbors[i] - x) * blend;
      y += (sums[offset + 1] / neighbors[i] - y) * blend;
      z += (sums[offset + 2] / neighbors[i] - z) * blend;
    }

    // Shorten the horizontal arm from its shoulder, keeping the sleeve fixed.
    const sideArm = smoothstep(.12, .21, x) * smoothstep(.09, .13, y)
      * (1 - smoothstep(.21, .25, y));
    x -= Math.max(0, x - .12) * .065 * sideArm;
    z -= Math.max(0, z - .12) * .065 * sideArm;

    // Keep the raised leg's original silhouette. The former partial z/y
    // offsets pinched its upper edge into a kink. A small, even expansion on
    // the free end gives the reconstructed calf a more natural thickness.
    const backLeg = smoothstep(.23, .31, -z) * smoothstep(.015, .04, y)
      * (1 - smoothstep(.105, .14, y)) * (1 - smoothstep(.045, .10, Math.abs(x + .08)));
    x += (x + .08) * .09 * backLeg;
    y += (y - .065) * .06 * backLeg;

    // Soften the scan's rounded hip artifact and draw it just inside the
    // ruffled fabric instead of leaving a separate pale knob outside it.
    const hip = smoothstep(.09, .13, -z) * (1 - smoothstep(.23, .28, -z))
      * smoothstep(.025, .045, y) * (1 - smoothstep(.09, .115, y))
      * smoothstep(-.14, -.10, x) * (1 - smoothstep(.005, .035, x));
    if (hip && neighbors[i]) {
      const blend = hip * .28;
      x += (sums[offset] / neighbors[i] - original[offset]) * blend;
      y += (sums[offset + 1] / neighbors[i] - original[offset + 1]) * blend;
      z += (sums[offset + 2] / neighbors[i] - original[offset + 2]) * blend;
      z += .012 * hip;
    }

    // Close up the noisy, splayed fingertips of the raised hand. Its palm
    // stays in place, while the tips taper into a smaller porcelain gesture.
    const hand = smoothstep(.414, .455, y) * (1 - smoothstep(-.22, -.19, x));
    x += (-.26 - x) * hand * .97;
    z += (-.125 - z) * hand * .97;
    y -= Math.max(0, y - .44) * hand * .68;
    if (hand > 0 && neighbors[i]) {
      const smooth = hand * .62;
      x += (sums[offset] / neighbors[i] - original[offset]) * smooth;
      y += (sums[offset + 1] / neighbors[i] - original[offset + 1]) * smooth;
      z += (sums[offset + 2] / neighbors[i] - original[offset + 2]) * smooth;
    }
    positions.setXYZ(i, x, y, z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

function makeFigure(source) {
  const model = source.scene.clone(true);
  model.traverse(part => {
    if (!part.isMesh || !part.geometry?.attributes.position) return;
    part.geometry = part.geometry.clone();
    refinePose(part.geometry);
  });
  model.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(2.04 / size.y, 2.08 / Math.max(size.x, size.z));

  // Keep the turn centred on the pointe shoe, rather than the mesh centre.
  const point = new THREE.Vector3();
  let footX = 0, footZ = 0, count = 0;
  model.traverse(part => {
    if (!part.isMesh || !part.geometry?.attributes.position) return;
    const original = part.material;
    part.material = new THREE.MeshPhysicalMaterial({
      map: original.map,
      color: 0xfff2da,
      metalness: 0.08,
      roughness: 0.28,
      clearcoat: 0.58,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide,
    });
    const positions = part.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld);
      if (point.y < bounds.min.y + size.y * 0.025) {
        footX += point.x;
        footZ += point.z;
        count++;
      }
    }
  });
  const pivot = new THREE.Group();
  // A narrow inner petticoat closes the opening beneath the hem. Its straight
  // sides stay inside the outer ruffles, unlike the old sphere that showed as
  // a bright round bump on the hip while the dancer turned.
  const lining = new THREE.Mesh(
    new THREE.CylinderGeometry(.041, .066, .082, 32, 1, false),
    new THREE.MeshPhysicalMaterial({ color: 0xe9dcca, roughness: .72, side: THREE.DoubleSide }),
  );
  lining.position.set(.018, -.044, -.018);
  lining.scale.z = 1.12;
  model.add(lining);
  model.scale.setScalar(scale);
  model.position.set(
    -(count ? footX / count : bounds.getCenter(new THREE.Vector3()).x) * scale,
    -bounds.min.y * scale,
    -(count ? footZ / count : bounds.getCenter(new THREE.Vector3()).z) * scale,
  );
  pivot.add(model);
  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.075, 0.035, 20),
    new THREE.MeshStandardMaterial({ color: 0x9d6d2f, metalness: 0.78, roughness: 0.3 }),
  );
  spindle.position.y = 0.018;
  pivot.add(spindle);
  return pivot;
}

const mounted = new WeakSet();
export async function mountBallerina(canvas) {
  if (!canvas || mounted.has(canvas)) return;
  mounted.add(canvas);
  let asset;
  try { asset = await loadModel(); } catch (error) { console.warn('Ballerina model unavailable', error); return; }
  if (!canvas.isConnected) return;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  const view = 1.28;
  const camera = new THREE.OrthographicCamera(-view, view, view, -view, .1, 20);
  camera.position.set(2.7, 2.25, 5.7);
  camera.lookAt(0, 1.13, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.25));
  const key = new THREE.DirectionalLight(0xfff7ed, 1.25);
  key.position.set(-2, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe6e0d6, .65);
  rim.position.set(3, 3, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, .6);
  fill.position.copy(camera.position);
  scene.add(fill);
  const figure = makeFigure(asset);
  scene.add(figure);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const started = performance.now();
  let lastWidth = 0, lastHeight = 0;
  function resize() {
    const width = canvas.clientWidth || 150, height = canvas.clientHeight || 170;
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    renderer.setSize(width, height, false);
    camera.top = view * height / width;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
  }
  function draw(now) {
    if (!canvas.isConnected) { renderer.dispose(); return; }
    if (canvas.closest('[hidden]') || document.visibilityState === 'hidden') {
      requestAnimationFrame(draw);
      return;
    }
    resize();
    if (!reduced.matches) {
      const hover = canvas.closest('.dance-open')?.matches(':hover');
      figure.rotation.y = Math.PI + (now - started) * (hover ? .00085 : .00055);
    }
    try {
      renderer.render(scene, camera);
      if (!canvas.classList.contains('is-rendered')) {
        canvas.classList.add('is-rendered');
        canvas.parentElement?.classList.add('has-rendered');
      }
    } catch (error) {
      console.warn('Ballerina render failed', error);
      canvas.classList.remove('is-rendered');
      canvas.parentElement?.classList.remove('has-rendered');
      renderer.dispose();
      return;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}
