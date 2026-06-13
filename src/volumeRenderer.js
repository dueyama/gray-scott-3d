import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

const SURFACE_MAX_POLY_COUNT = 180000;
const SURFACE_UPDATE_INTERVAL_MS = 240;
const SURFACE_THRESHOLD_SCALE = 0.5;

const vertexShader = /* glsl */ `
  out vec3 vPosition;

  void main() {
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform sampler3D volumeMap;
  uniform float threshold;
  uniform float opacity;
  uniform int steps;
  uniform vec3 lowColor;
  uniform vec3 highColor;
  uniform vec3 cameraObjectPosition;

  in vec3 vPosition;
  out vec4 outColor;

  vec2 hitBox(vec3 orig, vec3 dir) {
    const vec3 boxMin = vec3(-0.5);
    const vec3 boxMax = vec3(0.5);
    vec3 invDir = 1.0 / dir;
    vec3 tMinTemp = (boxMin - orig) * invDir;
    vec3 tMaxTemp = (boxMax - orig) * invDir;
    vec3 tMin = min(tMinTemp, tMaxTemp);
    vec3 tMax = max(tMinTemp, tMaxTemp);
    float t0 = max(max(tMin.x, tMin.y), tMin.z);
    float t1 = min(min(tMax.x, tMax.y), tMax.z);
    return vec2(t0, t1);
  }

  void main() {
    vec3 rayDir = normalize(vPosition - cameraObjectPosition);
    vec2 bounds = hitBox(cameraObjectPosition, rayDir);
    if (bounds.x > bounds.y) {
      discard;
    }

    bounds.x = max(bounds.x, 0.0);
    vec3 p = cameraObjectPosition + bounds.x * rayDir;
    float rayLength = bounds.y - bounds.x;
    float delta = rayLength / float(steps);
    vec3 stepVec = rayDir * delta;

    vec3 color = vec3(0.0);
    float alpha = 0.0;

    for (int i = 0; i < 192; i++) {
      if (i >= steps) {
        break;
      }
      vec3 texCoord = p + vec3(0.5);
      float value = texture(volumeMap, texCoord).r;
      float halo = smoothstep(threshold * 0.18, threshold, value) * 0.24;
      float core = smoothstep(threshold, threshold + 0.07, value);
      float density = clamp(halo + core, 0.0, 1.0);
      vec3 sampleColor = mix(lowColor, highColor, clamp(value * 2.4, 0.0, 1.0));
      float sampleAlpha = density * opacity;
      color += (1.0 - alpha) * sampleAlpha * sampleColor;
      alpha += (1.0 - alpha) * sampleAlpha;
      if (alpha > 0.96) {
        break;
      }
      p += stepVec;
    }

    if (alpha < 0.004) {
      discard;
    }
    outColor = vec4(color, alpha);
  }
`;

export class VolumeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const context = canvas.getContext("webgl2", { antialias: true, alpha: true });
    if (!context) {
      throw new Error("WebGL2 is required for 3D volume textures.");
    }

    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x101719, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.05, 10);
    this.camera.position.set(1.55, 1.25, 1.8);
    this.mode = "volume";
    this.latestVolume = null;
    this.latestSize = 64;
    this.latestSurfaceUpdate = 0;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.25;
    this.controls.maxDistance = 4;

    this.texture = this.createTexture(new Uint8Array(64 * 64 * 64), 64);
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        volumeMap: { value: this.texture },
        threshold: { value: 0.025 },
        opacity: { value: 0.26 },
        steps: { value: 144 },
        lowColor: { value: new THREE.Color(0x39d7c3) },
        highColor: { value: new THREE.Color(0xffc15f) },
        cameraObjectPosition: { value: new THREE.Vector3() }
      },
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });

    this.volumeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.material);
    this.scene.add(this.volumeMesh);

    this.surfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0x4dd7c8,
      emissive: 0x102a2a,
      metalness: 0.02,
      roughness: 0.58,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide
    });
    this.surfaceMesh = this.createSurfaceMesh(64);
    this.surfaceMesh.visible = false;
    this.scene.add(this.surfaceMesh);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.52);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(1.8, 2.4, 2.0);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x88fff4, 0.85);
    fillLight.position.set(-2.0, -0.6, -1.4);
    this.scene.add(fillLight);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01));
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xd8f3ed,
      transparent: true,
      opacity: 0.34
    });
    this.scene.add(new THREE.LineSegments(edges, edgeMaterial));

    const grid = new THREE.GridHelper(1.15, 8, 0x2d4d4e, 0x1b3032);
    grid.position.y = -0.505;
    this.scene.add(grid);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  createTexture(data, size) {
    const texture = new THREE.Data3DTexture(data, size, size, size);
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
  }

  createSurfaceMesh(size) {
    const mesh = new MarchingCubes(size, this.surfaceMaterial, false, false, SURFACE_MAX_POLY_COUNT);
    mesh.scale.setScalar(0.5);
    mesh.frustumCulled = false;
    mesh.isolation = this.thresholdToIsolation(this.material.uniforms.threshold.value);
    return mesh;
  }

  thresholdToIsolation(value) {
    return Math.max(0, Math.min(255, Number(value) * SURFACE_THRESHOLD_SCALE * 255));
  }

  updateVolume(data, size) {
    this.latestVolume = data;
    this.latestSize = size;

    if (this.texture.image.width !== size) {
      this.texture.dispose();
      this.texture = this.createTexture(data, size);
      this.material.uniforms.volumeMap.value = this.texture;
    } else {
      this.texture.image.data = data;
      this.texture.needsUpdate = true;
    }

    if (this.mode === "surface") {
      this.updateSurface(false);
    }
  }

  setThreshold(value) {
    this.material.uniforms.threshold.value = value;
    this.surfaceMesh.isolation = this.thresholdToIsolation(value);
    if (this.mode === "surface") {
      this.updateSurface(true);
    }
  }

  setMode(mode) {
    this.mode = mode === "surface" ? "surface" : "volume";
    this.volumeMesh.visible = this.mode === "volume";
    this.surfaceMesh.visible = this.mode === "surface";
    if (this.mode === "surface") {
      this.updateSurface(true);
    }
  }

  updateSurface(force) {
    if (!this.latestVolume) return;

    const now = performance.now();
    if (!force && now - this.latestSurfaceUpdate < SURFACE_UPDATE_INTERVAL_MS) {
      return;
    }

    if (this.surfaceMesh.resolution !== this.latestSize) {
      this.scene.remove(this.surfaceMesh);
      this.surfaceMesh.geometry.dispose();
      this.surfaceMesh = this.createSurfaceMesh(this.latestSize);
      this.surfaceMesh.visible = this.mode === "surface";
      this.scene.add(this.surfaceMesh);
    }

    this.surfaceMesh.field.set(this.latestVolume);
    this.surfaceMesh.normal_cache.fill(0);
    this.surfaceMesh.isolation = this.thresholdToIsolation(this.material.uniforms.threshold.value);
    this.surfaceMesh.update();
    this.latestSurfaceUpdate = now;
  }

  resize() {
    const { clientWidth, clientHeight } = this.canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  }

  render() {
    this.controls.update();
    this.material.uniforms.cameraObjectPosition.value.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }

  capturePng() {
    return this.canvas.toDataURL("image/png");
  }
}
