import * as THREE from './vendor/three/three.module.min.js';

let modelData;
function getModelData() {
  if (!modelData) {
    modelData = fetch('./objects/ballerina-model.json?v=1').then(response => {
      if (!response.ok) throw new Error(`Ballerina model: ${response.status}`);
      return response.json();
    });
  }
  return modelData;
}

function makeModel(data) {
  const figure = new THREE.Group();
  for (const part of data.meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
    geometry.setIndex(part.indices);
    const material = new THREE.MeshStandardMaterial({
      color: part.color,
      metalness: part.metallic,
      roughness: part.roughness,
      transparent: part.alpha < 1,
      opacity: part.alpha,
      depthWrite: part.alpha >= 1,
      side: THREE.DoubleSide,
    });
    figure.add(new THREE.Mesh(geometry, material));
  }
  return figure;
}

const mounted = new WeakSet();
export async function mountBallerina(canvas) {
  if (!canvas || mounted.has(canvas)) return;
  mounted.add(canvas);
  let data;
  try { data = await getModelData(); } catch { return; }
  if (!canvas.isConnected) return;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'}); }
  catch { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const view = 1.36;
  const camera = new THREE.OrthographicCamera(-view, view, view, -view, .1, 20);
  camera.position.set(2.8, 2.15, 5.4);
  camera.lookAt(.12, 1.18, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 1.45);
  key.position.set(-2, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe9cfb6, .7);
  rim.position.set(3, 3, -4);
  scene.add(rim);
  const figure = makeModel(data);
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
      figure.rotation.y = -.35 + (now - started) * (hover ? .00115 : .00062);
    }
    try {
      renderer.render(scene, camera);
      if (!canvas.classList.contains('is-rendered')) {
        canvas.classList.add('is-rendered');
        canvas.parentElement?.classList.add('has-rendered');
      }
    } catch {
      canvas.classList.remove('is-rendered');
      canvas.parentElement?.classList.remove('has-rendered');
      renderer.dispose();
      return;
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}
