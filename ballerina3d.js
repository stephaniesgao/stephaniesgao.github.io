import * as THREE from './vendor/three/three.module.min.js';
import { makePorcelainBallerina } from './ballerina-figure.js';

function makeFigure() {
  const model = makePorcelainBallerina();
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(2.04 / size.y, 2.08 / Math.max(size.x, size.z));
  const pivot = new THREE.Group();
  model.scale.setScalar(scale);
  model.position.set(0, -bounds.min.y * scale, 0);
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
export function mountBallerina(canvas) {
  if (!canvas || mounted.has(canvas)) return;
  mounted.add(canvas);
  if (!canvas.isConnected) return;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const view = 1.28;
  const camera = new THREE.OrthographicCamera(-view, view, view, -view, .1, 20);
  camera.position.set(2.7, 2.25, 5.7);
  camera.lookAt(0, 1.13, 0);
  scene.add(new THREE.AmbientLight(0xffffff, .95));
  const key = new THREE.DirectionalLight(0xfff7ed, 1.25);
  key.position.set(-2, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe6e0d6, .65);
  rim.position.set(3, 3, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, .6);
  fill.position.copy(camera.position);
  scene.add(fill);
  const figure = makeFigure();
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
