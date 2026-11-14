// A spinnable 3D globe for picking a place. Loaded on demand.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import landTopo from 'world-atlas/land-110m.json';
import { CITIES, nearestCity } from './cities.js';
import { subsolarPoint } from './astro.js';

const RAD = Math.PI / 180;

function latLonToVec(lat, lon, r = 1) {
  const phi = (90 - lat) * RAD;
  const theta = (lon + 180) * RAD;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function vecToLatLon(v) {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(n.y) / RAD;
  let lon = Math.atan2(n.z, -n.x) / RAD - 180;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

function earthTexture() {
  const W = 2048;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const ocean = g.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, '#1d4f80');
  ocean.addColorStop(0.5, '#1f6fb2');
  ocean.addColorStop(1, '#1d4f80');
  g.fillStyle = ocean;
  g.fillRect(0, 0, W, H);

  // Land coloured by latitude: ice, forest, desert belts, tropics.
  const land = g.createLinearGradient(0, 0, 0, H);
  [
    [0, '#f4f8fa'],
    [0.12, '#e3ece8'],
    [0.18, '#7aa86c'],
    [0.3, '#6f9d5c'],
    [0.36, '#cdb67a'],
    [0.42, '#b9a46c'],
    [0.47, '#4f8a48'],
    [0.53, '#4a8545'],
    [0.6, '#c6ad74'],
    [0.66, '#8fae6a'],
    [0.8, '#9fbca0'],
    [0.86, '#eef4f6'],
    [1, '#f8fbfc'],
  ].forEach(([o, col]) => land.addColorStop(o, col));

  const geo = feature(landTopo, landTopo.objects.land);
  const X = (lon) => ((lon + 180) / 360) * W;
  const Y = (lat) => ((90 - lat) / 180) * H;
  // Draw one ring with continuous longitudes, so shapes that cross the
  // date line don't smear across the map. Rings that wrap all the way
  // around the planet (Antarctica) are closed through the pole.
  const traceRing = (ring, shift) => {
    let prev = ring[0][0];
    let off = 0;
    const pts = ring.map(([lon, lat]) => {
      const d = lon - prev;
      if (d > 180) off -= 360;
      if (d < -180) off += 360;
      prev = lon;
      return [lon + off + shift, lat];
    });
    pts.forEach(([lon, lat], i) => (i ? g.lineTo(X(lon), Y(lat)) : g.moveTo(X(lon), Y(lat))));
    const span = pts[pts.length - 1][0] - pts[0][0];
    if (Math.abs(span) > 300) {
      const poleLat = pts.reduce((s, p) => s + p[1], 0) / pts.length < 0 ? -90 : 90;
      g.lineTo(X(pts[pts.length - 1][0]), Y(poleLat));
      g.lineTo(X(pts[0][0]), Y(poleLat));
    }
    g.closePath();
  };

  g.fillStyle = land;
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1.5;
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      for (const shift of [-360, 0, 360]) {
        g.beginPath();
        for (const ring of poly) traceRing(ring, shift);
        g.fill('evenodd');
        g.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function cloudTexture() {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const blob = (x, y, r, a) => {
    for (const dx of [-W, 0, W]) {
      const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  };
  // Storm belts near the equator and the mid-latitudes.
  const bands = [0.5, 0.28, 0.72, 0.18, 0.82];
  for (let i = 0; i < 420; i++) {
    const band = bands[i % bands.length];
    const y = (band + (Math.random() - 0.5) * 0.12) * H;
    const x = Math.random() * W;
    const r = 6 + Math.random() ** 2 * 34;
    blob(x, y, r, 0.25 + Math.random() * 0.35);
    // streaky clusters
    for (let k = 0; k < 3; k++) blob(x + (Math.random() - 0.3) * r * 2.5, y + (Math.random() - 0.5) * r * 0.6, r * 0.6, 0.2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Globe {
  constructor(mount, { onSelect, reducedMotion = false }) {
    this.mount = mount;
    this.onSelect = onSelect;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    mount.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(0, 0, 3.4);
    this.camera = camera;

    // Earth
    this.earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 64),
      new THREE.MeshPhongMaterial({ map: earthTexture(), shininess: 14, specular: new THREE.Color(0x223344) })
    );
    scene.add(this.earth);

    // Clouds
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 64, 48),
      new THREE.MeshLambertMaterial({ map: cloudTexture(), transparent: true, depthWrite: false })
    );
    scene.add(this.clouds);

    // Atmosphere glow
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vNormal;
          void main() { vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vNormal;
          void main() { float i = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.35, 0.65, 1.0, 1.0) * i; }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      })
    );
    atmo.scale.setScalar(1.16);
    scene.add(atmo);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 1600; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 30);
      pts.push(v.x, v.y, v.z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, sizeAttenuation: true })));

    // Light from the real sun position: day and night sides!
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
    scene.add(this.sun);

    // City markers (a visible dot plus a bigger invisible hit area)
    this.hitAreas = [];
    const dotGeo = new THREE.SphereGeometry(0.011, 12, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffd36b });
    const hitGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    for (const city of CITIES) {
      const pos = latLonToVec(city.lat, city.lon, 1.003);
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      scene.add(dot);
      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.copy(pos);
      hit.userData.city = city;
      scene.add(hit);
      this.hitAreas.push(hit);
    }

    // "You are here" and "selected" markers
    this.here = this.makePin(0xff5d73);
    this.picked = this.makePin(0x7cf0ff);
    this.picked.visible = false;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.6;
    controls.maxDistance = 6;
    controls.rotateSpeed = 0.55;
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.5;
    controls.addEventListener('start', () => (controls.autoRotate = false));
    this.controls = controls;

    // Tap (not drag) to pick a spot
    const el = renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      this.pick(e.clientX, e.clientY);
    });

    this.raycaster = new THREE.Raycaster();
    new ResizeObserver(() => this.resize()).observe(mount);
    this.resize();
  }

  makePin(color) {
    const group = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color }));
    head.position.z = 0.05;
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    stick.rotation.x = Math.PI / 2;
    stick.position.z = 0.025;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.02, 0.03, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide })
    );
    ring.position.z = 0.002;
    group.add(head, stick, ring);
    group.userData.ring = ring;
    this.scene.add(group);
    return group;
  }

  placePin(pin, lat, lon) {
    const pos = latLonToVec(lat, lon, 1.0);
    pin.position.copy(pos);
    pin.lookAt(pos.clone().multiplyScalar(2));
    pin.visible = true;
  }

  resize() {
    const w = this.mount.clientWidth || 1;
    const h = this.mount.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole globe in view on tall phone screens
    this.camera.fov = w < h ? 42 * Math.min(1.6, h / w / 1.1) : 42;
    this.camera.updateProjectionMatrix();
  }

  pick(x, y) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const earthHit = this.raycaster.intersectObject(this.earth)[0];
    const cityHit = this.raycaster
      .intersectObjects(this.hitAreas)
      .find((h) => !earthHit || h.distance <= earthHit.distance + 0.05);
    let place;
    if (cityHit) {
      const c = cityHit.object.userData.city;
      place = { name: `${c.name}, ${c.country}`, lat: c.lat, lon: c.lon };
    } else if (earthHit) {
      const { lat, lon } = vecToLatLon(earthHit.point);
      const { city, km } = nearestCity(lat, lon);
      const coords = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
      place = { name: km < 400 ? `Near ${city.name}` : coords, lat, lon };
    } else return;
    this.placePin(this.picked, place.lat, place.lon);
    this.onSelect?.(place);
  }

  open(home) {
    if (home) {
      this.placePin(this.here, home.lat, home.lon);
      const dist = this.camera.position.length();
      this.camera.position.copy(latLonToVec(home.lat + 10, home.lon, dist));
      this.controls.update();
    }
    this.picked.visible = false;
    const sp = subsolarPoint(new Date());
    this.sun.position.copy(latLonToVec(sp.lat, sp.lon, 10));
    this.resize();
    const clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      this.clouds.rotation.y += dt * 0.012;
      for (const pin of [this.here, this.picked]) {
        const s = 1 + ((t * 0.8) % 1) * 1.6;
        pin.userData.ring.scale.setScalar(s);
        pin.userData.ring.material.opacity = 1 - ((t * 0.8) % 1);
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  close() {
    this.renderer.setAnimationLoop(null);
  }
}
