import * as THREE from './vendor/three/three.module.min.js';

const skin = new THREE.MeshStandardMaterial({color:0xb88668,roughness:.9});
const satin = new THREE.MeshStandardMaterial({color:0xd4b5a8,roughness:.55,side:THREE.DoubleSide});
const tulle = new THREE.MeshStandardMaterial({color:0xe1cabb,roughness:.94,side:THREE.DoubleSide,transparent:true,opacity:.87,depthWrite:false});
const hair = new THREE.MeshStandardMaterial({color:0x28232a,roughness:.92});
const slipper = new THREE.MeshStandardMaterial({color:0xc9a6a2,roughness:.65});
const detail = new THREE.MeshStandardMaterial({color:0x4b3536,roughness:1});

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

function pleatedSkirt(parent, material, top, bottom, radius, phase=0) {
  const segments=96, rings=12, vertices=[], indices=[];
  for(let ring=0;ring<=rings;ring++){
    const t=ring/rings, y=top+(bottom-top)*t;
    const base=.19+(radius-.19)*Math.pow(t,.72);
    for(let i=0;i<=segments;i++){
      const a=i/segments*Math.PI*2;
      const ripple=Math.sin(12*a+phase)*(.005+.032*t*t);
      const r=base+ripple;
      vertices.push(Math.cos(a)*r,y+Math.sin(12*a+phase)*.013*t,Math.sin(a)*r);
      if(ring<rings&&i<segments){const n=ring*(segments+1)+i;indices.push(n,n+segments+1,n+1,n+1,n+segments+1,n+segments+2)}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  parent.add(new THREE.Mesh(geometry,material));
}

function makeFigurine() {
  const figure=new THREE.Group();
  // A warm-toned miniature with a real front, profile, and back.
  ellipsoid(figure,skin,[0,2.045,.02],[.151,.205,.145],28);
  ellipsoid(figure,hair,[0,2.17,-.025],[.157,.09,.145],28);
  ellipsoid(figure,hair,[0,2.16,-.175],[.1,.098,.092],20);
  ellipsoid(figure,hair,[0,2.22,-.13],[.075,.078,.085],20);
  for(const x of [-.056,.056]){
    ellipsoid(figure,detail,[x,2.05,.158],[.016,.007,.005],14);
    ellipsoid(figure,hair,[x,2.092,.155],[.027,.006,.005],12);
  }
  ellipsoid(figure,skin,[0,2.018,.168],[.018,.033,.025],12);
  ellipsoid(figure,detail,[0,1.973,.156],[.027,.006,.005],12);
  limb(figure,skin,[0,1.72,0],[0,1.87,0],.058,.063);
  ellipsoid(figure,satin,[0,1.48,0],[.215,.32,.155],28);
  ellipsoid(figure,satin,[0,1.205,0],[.178,.12,.15],24);

  const waist=new THREE.Mesh(new THREE.CylinderGeometry(.17,.21,.12,32),satin);
  waist.position.y=1.21;figure.add(waist);
  pleatedSkirt(figure,satin,1.18,.90,.49);
  pleatedSkirt(figure,tulle,1.19,.845,.61,.2);
  pleatedSkirt(figure,tulle,1.16,.825,.64,1.3);

  // One leg supports the figure en pointe; the other reaches back in depth.
  limb(figure,skin,[.055,.95,.015],[.04,.53,.05],.063,.047);
  limb(figure,skin,[.04,.53,.05],[.02,.145,.075],.046,.031);
  ellipsoid(figure,slipper,[.023,.085,.085],[.064,.095,.073]);
  limb(figure,skin,[-.06,.97,-.06],[-.14,.92,-.52],.062,.048);
  limb(figure,skin,[-.14,.92,-.52],[-.2,.99,-.99],.048,.031);
  ellipsoid(figure,slipper,[-.21,1,-1.06],[.05,.038,.115]);

  // Arms have bent joints and small palms, avoiding the flat cutout silhouette.
  limb(figure,skin,[-.17,1.69,0],[-.43,1.77,.12],.052,.036);
  limb(figure,skin,[-.43,1.77,.12],[-.73,1.88,.22],.036,.02);
  ellipsoid(figure,skin,[-.76,1.89,.22],[.065,.022,.027]);
  limb(figure,skin,[.17,1.69,0],[.43,1.88,.1],.052,.036);
  limb(figure,skin,[.43,1.88,.1],[.59,2.15,.18],.036,.02);
  ellipsoid(figure,skin,[.6,2.18,.18],[.056,.023,.028]);

  // A few stitched ribbon details survive the small display size.
  for (const x of [-.09,.09]) {
    const ribbon=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.24,6),slipper);
    ribbon.position.set(x/3,.27,.095);ribbon.rotation.z=x>0?-.32:.32;figure.add(ribbon);
  }
  figure.rotation.y=-.42;
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
      figure.rotation.y=-.42+(now-started)*(hover?.0012:.00068);
    }
    try {
      renderer.render(scene,camera);
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
