import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

let modelPromise;
function loadModel() {
  modelPromise ||= new GLTFLoader().loadAsync('./objects/ballerina-revised.glb?v=1');
  return modelPromise;
}

function makeFigure(source) {
  const model = source.scene.clone(true);
  model.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(1.75 / size.y, 1.85 / Math.max(size.x, size.z));

  const smoothstep = (a, b, value) => {
    const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Keep the turn centred on the pointe shoe, rather than the mesh centre.
  const point = new THREE.Vector3();
  let footX = 0, footZ = 0, count = 0;
  model.traverse(part => {
    if (!part.isMesh || !part.geometry?.attributes.position) return;
    // Tuck the malformed reconstructed leg under the skirt. A clean leg below
    // takes its place, with no stray shoe poking through the hem.
    part.geometry = part.geometry.clone();
    const positions = part.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const reach = smoothstep(0.2, 0.44, -(x + z) * Math.SQRT1_2);
      const height = smoothstep(-0.1, -0.025, y) * (1 - smoothstep(0.09, 0.15, y));
      const amount = reach * height;
      if (amount > 0) positions.setXYZ(i, x + 0.18 * amount, y - 0.02 * amount, z + 0.15 * amount);
    }
    positions.needsUpdate = true;
    part.geometry.computeBoundingBox();
    part.geometry.computeBoundingSphere();
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
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(part.matrixWorld);
      if (point.y < bounds.min.y + size.y * 0.025) {
        footX += point.x;
        footZ += point.z;
        count++;
      }
    }
  });
  // A smooth porcelain faceplate conceals the reconstructed facial texture.
  const faceplate = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xf2e3c9, roughness: 0.24, clearcoat: 0.55, clearcoatRoughness: 0.18 }),
  );
  faceplate.position.set(-0.045, 0.282, 0.025);
  faceplate.scale.set(0.055, 0.073, 0.061);
  model.add(faceplate);
  const porcelain = new THREE.MeshPhysicalMaterial({ color: 0xe9d8be, roughness: 0.27, clearcoat: 0.48 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xa87739, metalness: 0.78, roughness: 0.28 });
  function limb(start, end, startRadius, endRadius, material) {
    const from = new THREE.Vector3(...start), to = new THREE.Vector3(...end);
    const direction = to.clone().sub(from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(endRadius, startRadius, direction.length(), 16), material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    model.add(mesh);
  }
  limb([-0.16, -0.11, -0.15], [-0.32, -0.095, -0.29], 0.029, 0.02, porcelain);
  limb([-0.32, -0.095, -0.29], [-0.5, -0.075, -0.45], 0.02, 0.012, porcelain);
  limb([-0.5, -0.075, -0.45], [-0.565, -0.065, -0.505], 0.013, 0.006, brass);
  const pivot = new THREE.Group();
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
