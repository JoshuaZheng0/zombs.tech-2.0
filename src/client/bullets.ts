import * as THREE from 'three';

/**
 * Active bullets currently in the scene.
 * Each bullet has a mesh, velocity vector, and remaining lifetime (in frames).
 */
export const activeBullets: { mesh: THREE.Mesh, velocity: THREE.Vector3, life: number }[] = [];

/**
 * Timestamp of the last bullet fired.
 * Used to control firing rate.
 */
export let lastBulletTime = 0;

/**
 * Bullet firing settings
 */
export const BULLET_FIRE_INTERVAL = 90; // Minimum interval between shots in milliseconds
export const BULLET_SPEED = 2.5;         // Units per frame
export const BULLET_LIFETIME = 20;        // Frames before bullet is removed

// References to the main camera and scene (set externally)
let camera: THREE.PerspectiveCamera;
let scene: THREE.Scene;

/**
 * Sets the references to the camera and scene.
 * Must be called before bullets can be spawned.
 * 
 * @param _camera - The player's camera
 * @param _scene - The Three.js scene
 */
export function setBulletReferences(_camera: THREE.PerspectiveCamera, _scene: THREE.Scene) {
  camera = _camera;
  scene = _scene;
}

/**
 * Spawns a new bullet from the current camera position,
 * moving forward based on the camera's orientation.
 */
export function spawnBulletFromCamera() {
  if (!camera) return;

  // Create a small sphere geometry for the bullet
  const geometry = new THREE.SphereGeometry(0.1, 6, 6);
  const material = new THREE.MeshBasicMaterial({ color: 0xFFEA00 });
  const bullet = new THREE.Mesh(geometry, material);

  // Start bullet at the camera's position
  bullet.position.copy(camera.position);
  scene.add(bullet);

  // Set bullet velocity based on the camera's facing direction
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
  activeBullets.push({ mesh: bullet, velocity: dir.multiplyScalar(BULLET_SPEED), life: BULLET_LIFETIME });
}

/**
 * Updates all active bullets each frame:
 * - Moves bullets based on their velocity
 * - Decreases their lifetime
 * - Removes bullets when their lifetime expires
 */
export function animateBullets() {
  for (let i = activeBullets.length - 1; i >= 0; i--) {
    const bullet = activeBullets[i];
    bullet.mesh.position.add(bullet.velocity);
    bullet.life--;

    // Remove bullet if lifetime has ended
    if (bullet.life <= 0) {
      scene.remove(bullet.mesh);
      activeBullets.splice(i, 1);
    }
  }
}
