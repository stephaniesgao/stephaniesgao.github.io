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
  const scale = Math.min(2.15 / size.y, 2.18 / Math.max(size.x, size.z));

  // Keep the turn centred on the pointe shoe, rather than the mesh centre.
  const point = new THREE.Vector3();
  let footX = 0, footZ = 0, count = 0;
  model.traverse(part => {
    if (!part.isMesh || !part.geometry?.attributes.position) return;
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
  model.scale.setScalar(scale);
  model.position.set(
    -(count ? footX / count : bounds.getCenter(new THREE.Vector3()).x) * scale,
    -bounds.min.y * scale,
    -(count ? footZ / count : bounds.getCenter(new THREE.Vector3()).z) * scale,
  );
  pivot.add(model);
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
