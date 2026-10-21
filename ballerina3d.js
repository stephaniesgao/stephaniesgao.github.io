import * as THREE from './vendor/three/three.module.min.js';

const skin = new THREE.MeshStandardMaterial({color:0xbdb4aa,roughness:.86});
const satin = new THREE.MeshStandardMaterial({color:0xe7dfd0,roughness:.7,side:THREE.DoubleSide});
const tulle = new THREE.MeshStandardMaterial({color:0xdcd3c4,roughness:.95,side:THREE.DoubleSide,transparent:true,opacity:.9});
const hair = new THREE.MeshStandardMaterial({color:0x514d49,roughness:.96});
const slipper = new THREE.MeshStandardMaterial({color:0xa6a09a,roughness:.83});

function ellipsoid(parent, material, position, size, segments=20) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1,segments,14),material);
  mesh.position.set(...position);
  mesh.scale.set(...size);
  parent.add(mesh);
  return mesh;
}

function limb(parent, material, start, end, radiusTop, radiusBottom=radiusTop) {
  const a=new THREE.Vector3(...start), b=new THREE.Vector3(...end);
  const direction=new THREE.Vector3().subVectors(b,a);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radiusTop,radiusBottom,direction.length(),12),material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  parent.add(mesh);
  ellipsoid(parent,material,start,[radiusTop,radiusTop,radiusTop]);
  return mesh;
}

function makeFigurine() {
  const figure=new THREE.Group();
  // A turned porcelain miniature, held in an arabesque rather than a T-pose.
  ellipsoid(figure,skin,[0,2.07,.015],[.185,.235,.17]);
  ellipsoid(figure,hair,[0,2.19,-.025],[.187,.117,.169]);
  ellipsoid(figure,hair,[0,2.16,-.19],[.12,.12,.12]);
  const face=new THREE.MeshStandardMaterial({color:0x5a524b,roughness:1});
  for (const x of [-.068,.068]) ellipsoid(figure,face,[x,2.07,.178],[.012,.014,.007],10);
  ellipsoid(figure,skin,[0,2.01,.193],[.022,.04,.025],10);
  limb(figure,skin,[0,1.75,0],[0,1.91,0],.068,.074);
  ellipsoid(figure,satin,[0,1.49,0],[.235,.37,.17]);
  ellipsoid(figure,satin,[0,1.18,0],[.20,.16,.18]);

  const waist=new THREE.Mesh(new THREE.CylinderGeometry(.17,.21,.12,32),satin);
  waist.position.y=1.21;figure.add(waist);
  const skirt=new THREE.Mesh(new THREE.CylinderGeometry(.2,.56,.31,48,1,true),tulle);
  skirt.position.y=1.06;figure.add(skirt);
  const underskirt=new THREE.Mesh(new THREE.CylinderGeometry(.23,.64,.11,48,1,true),satin);
  underskirt.position.y=.89;figure.add(underskirt);
  const hem=new THREE.Mesh(new THREE.TorusGeometry(.615,.014,8,48),satin);
  hem.rotation.x=Math.PI/2;hem.position.y=.84;figure.add(hem);

  // One leg supports the figure en pointe; the other reaches back in depth.
  limb(figure,skin,[.07,.97,.02],[.045,.53,.05],.068,.056);
  limb(figure,skin,[.045,.53,.05],[.025,.15,.07],.052,.034);
  ellipsoid(figure,slipper,[.03,.105,.11],[.07,.15,.095]);
  limb(figure,skin,[-.09,.98,-.07],[-.17,.91,-.53],.067,.054);
  limb(figure,skin,[-.17,.91,-.53],[-.24,.94,-1.04],.052,.035);
  ellipsoid(figure,slipper,[-.25,.94,-1.12],[.055,.045,.15]);

  // Arms have bent joints and small palms, avoiding the flat cutout silhouette.
  limb(figure,skin,[-.21,1.7,0],[-.48,1.82,.13],.061,.044);
  limb(figure,skin,[-.48,1.82,.13],[-.78,1.91,.24],.043,.024);
  ellipsoid(figure,skin,[-.8,1.92,.25],[.07,.025,.035]);
  limb(figure,skin,[.21,1.7,0],[.47,1.92,.13],.061,.044);
  limb(figure,skin,[.47,1.92,.13],[.67,2.15,.24],.043,.024);
  ellipsoid(figure,skin,[.68,2.17,.25],[.06,.028,.035]);

  // A few stitched ribbon details survive the small display size.
  for (const x of [-.09,.09]) {
    const ribbon=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.24,6),slipper);
    ribbon.position.set(x/3,.27,.095);ribbon.rotation.z=x>0?-.32:.32;figure.add(ribbon);
  }
  figure.rotation.y=-.55;
  return figure;
}

const mounted=new WeakSet();
export function mountBallerina(canvas) {
  if (!canvas || mounted.has(canvas)) return;
  mounted.add(canvas);
  let renderer;
  try { renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'}); }
  catch { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const view=1.38;
  const camera=new THREE.OrthographicCamera(-view,view,view,-view,.1,20);
  camera.position.set(3.1,2.25,4.6);
  camera.lookAt(0,1.18,0);
  scene.add(new THREE.AmbientLight(0xffffff,1.15));
  const key=new THREE.DirectionalLight(0xffffff,1.65);key.position.set(-2,5,5);scene.add(key);
  const rim=new THREE.DirectionalLight(0xd5cfc3,.75);rim.position.set(3,3,-4);scene.add(rim);
  const figure=makeFigurine();scene.add(figure);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const started=performance.now();
  let lastWidth=0,lastHeight=0;
  function resize() {
    const width=canvas.clientWidth||150, height=canvas.clientHeight||170;
    if(width===lastWidth&&height===lastHeight)return;
    lastWidth=width;lastHeight=height;
    renderer.setSize(width,height,false);
    camera.top=view*height/width;
    camera.bottom=-camera.top;
    camera.updateProjectionMatrix();
  }
  function draw(now) {
    if (!canvas.isConnected) { renderer.dispose(); return; }
    if(canvas.closest('[hidden]')||document.visibilityState==='hidden'){requestAnimationFrame(draw);return;}
    resize();
    if (!reduced.matches) {
      const hover=canvas.closest('.dance-open')?.matches(':hover');
      figure.rotation.y=-.55+(now-started)*(hover?.0012:.00055);
    }
    renderer.render(scene,camera);
    requestAnimationFrame(draw);
  }
  canvas.classList.add('is-rendered');
  requestAnimationFrame(draw);
}
