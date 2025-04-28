import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/Addons.js';
import { wallMap } from '../shared/wall_map';

// Global scene references
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;

/**
 * Sets up global references to scene, camera, and renderer.
 * These must be set before calling other functions like lighting or terrain creation.
 */
export function setSceneReferences(_scene: THREE.Scene, _camera: THREE.PerspectiveCamera, _renderer: THREE.WebGLRenderer) {
  scene = _scene;
  camera = _camera;
  renderer = _renderer;
}

/**
 * Adds ambient and directional lighting to the scene.
 * - Ambient light: softens shadows
 * - Directional light: acts like a "sun"
 */
export function setupLighting() {
  const ambientLight = new THREE.AmbientLight(0x404040, 2.5); // Soft light everywhere
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); // Sunlight
  directionalLight.position.set(5, 10, 7);
  scene.add(directionalLight);
}

/**
 * Configures the main camera parameters:
 * FOV, aspect ratio, near/far planes, initial position and look direction.
 */
export function setupCamera() {
  camera.fov = 75;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.near = 0.1;
  camera.far = 1000;
  camera.position.set(0, 1.6, 0); // Player eye-level height
  camera.lookAt(0, 1.6, -1);      // Looking slightly forward
}

/**
 * Configures and attaches the WebGL renderer.
 * - Sets pixel ratio for high-DPI screens.
 * - Sets size to full window.
 */
export function setupRenderer() {
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement); // Add canvas to the DOM
}

/**
 * Creates the environment based on a predefined wall map.
 * Includes ground, walls, trees, rocks.
 */
export function createEnvironment() {
  createTerrain(wallMap);
}

/**
 * Generates the terrain based on the wall map:
 * - Blocked cells become tall walls
 * - Empty cells become ground tiles
 * - Some cells spawn trees or rocks
 *
 * @param wallMap - 2D grid representing world layout
 */
export function createTerrain(wallMap: number[][]) {
  const wallGeometries: THREE.BufferGeometry[] = [];
  const groundGeometries: THREE.BufferGeometry[] = [];
  const treeGeometries: THREE.BufferGeometry[] = [];
  const rockGeometries: THREE.BufferGeometry[] = [];

  const width = wallMap.length;
  const height = wallMap[0].length;

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < height; z++) {
      const isBlocked = wallMap[x][z] === 1;
      const isTreeSpot = wallMap[x][z] === 2;
      const isRockSpot = wallMap[x][z] === 3;

      const worldX = x - 50; // Center the map
      const worldZ = z - 50;

      let height = 0;
      let geometry: THREE.BufferGeometry;

      if (isBlocked) {
        // Generate a tall wall
        height = Math.random() * 1.5 + 4.5; // Randomize height slightly
        geometry = new THREE.BoxGeometry(1, height, 1);
        geometry.translate(worldX, height / 2, worldZ); // Center it
        wallGeometries.push(geometry);
      } else {
        // Generate ground tile
        height = Math.random() * 0.2 + 0.05;
        geometry = new THREE.BoxGeometry(1, height, 1);
        geometry.translate(worldX, height / 2, worldZ);
        groundGeometries.push(geometry);
      }

      if (isTreeSpot) {
        // Create a tree (cylinder trunk + sphere crown)
        const treeTrunkHeight = Math.random() * 2 + 3;
        const treeTrunkGeo = new THREE.CylinderGeometry(0.1, 0.1, treeTrunkHeight, 6, 1);
        treeTrunkGeo.translate(worldX, treeTrunkHeight / 2, worldZ);
        treeGeometries.push(treeTrunkGeo);

        const treeCrownGeo = new THREE.SphereGeometry(1, 6, 6);
        treeCrownGeo.translate(worldX, treeTrunkHeight + 1, worldZ);
        treeGeometries.push(treeCrownGeo);
      }

      if (isRockSpot) {
        // Create a rock (small sphere)
        const rockGeo = new THREE.SphereGeometry(0.5, 8, 8);
        rockGeo.translate(worldX, 0.25, worldZ);
        rockGeometries.push(rockGeo);
      }
    }
  }

  // --- Merge geometries and add to scene ---
  const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown for walls
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 }); // Green for ground
  const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Forest green for trees
  const rockMaterial = new THREE.MeshLambertMaterial({ color: 0xA9A9A9 }); // Gray for rocks

  if (wallGeometries.length > 0) {
    const mergedWallGeometry = BufferGeometryUtils.mergeGeometries(wallGeometries);
    const wallMesh = new THREE.Mesh(mergedWallGeometry, wallMaterial);
    scene.add(wallMesh);
  }

  if (groundGeometries.length > 0) {
    const mergedGroundGeometry = BufferGeometryUtils.mergeGeometries(groundGeometries);
    const groundMesh = new THREE.Mesh(mergedGroundGeometry, groundMaterial);
    scene.add(groundMesh);
  }

  if (treeGeometries.length > 0) {
    const mergedTreeGeometry = BufferGeometryUtils.mergeGeometries(treeGeometries);
    const treeMesh = new THREE.Mesh(mergedTreeGeometry, treeMaterial);
    scene.add(treeMesh);
  }

  if (rockGeometries.length > 0) {
    const mergedRockGeometry = BufferGeometryUtils.mergeGeometries(rockGeometries);
    const rockMesh = new THREE.Mesh(mergedRockGeometry, rockMaterial);
    scene.add(rockMesh);
  }
}
