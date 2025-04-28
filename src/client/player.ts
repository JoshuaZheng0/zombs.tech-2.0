import { Entity } from '../shared/entity';
import { PositionComponent, WASDComponent, JumpComponent, FiringComponent, AngleComponent, DeltaTimeComponent, QuantizedAngleComponent, MeshComponent, HealthComponent, AliveComponent, HitDetectionComponent } from '../shared/components';
import { PointerLockControls } from 'three/examples/jsm/Addons.js';
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/Addons.js';

let controls: PointerLockControls;

/**
 * Sets up the main player entity:
 * - Adds position, movement, angle, health components
 * - Hooks mouse movement to update player's look direction
 * - Hooks keyboard input for WASD and jump
 * - Handles pointer lock (mouse control) on click
 *
 * @param camera - The player's camera (used for PointerLockControls)
 * @returns Initialized player Entity
 */
export function setupPlayer(camera: THREE.Camera): Entity {
  const player = new Entity(1);

  // Attach essential gameplay components
  player.addComponent(new PositionComponent(0, 1.6, 0)); // Start at ground height
  player.addComponent(new WASDComponent(false, false, false, false));
  player.addComponent(new JumpComponent(false));
  player.addComponent(new FiringComponent(false));
  player.addComponent(new AngleComponent(0, 0));
  player.addComponent(new DeltaTimeComponent(0));
  player.addComponent(new QuantizedAngleComponent(127, 0)); // Neutral angles
  player.addComponent(createCharacterMesh()); // Visual appearance

  // Set up mouse control
  controls = new PointerLockControls(camera, document.body);

  // Mouse movement: Update player's pitch and yaw
  document.addEventListener('mousemove', (event) => {
    if (!controls.isLocked) return;

    const angle = player.getComponent(AngleComponent);
    const quantizedAngle = player.getComponent(QuantizedAngleComponent);
    if (!angle || !quantizedAngle) return;

    // Adjust angles based on mouse movement
    angle.yaw -= event.movementX * 0.002;
    angle.pitch -= event.movementY * 0.002;

    // Clamp pitch to avoid flipping
    angle.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, angle.pitch));

    // Wrap yaw around [-π, π]
    if (angle.yaw > Math.PI) {
      angle.yaw -= 2 * Math.PI;
    } else if (angle.yaw < -Math.PI) {
      angle.yaw += 2 * Math.PI;
    }

    // Update quantized versions (compressed for network sending)
    quantizedAngle.qyaw = Math.floor((angle.yaw / Math.PI) * 32768);
    quantizedAngle.qpitch = Math.floor(((angle.pitch + Math.PI / 2) / Math.PI) * 255);
  });

  // Keyboard input: Set WASD and Jump flags
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    const wasd = player.getComponent(WASDComponent);
    const jump = player.getComponent(JumpComponent);
    if (!wasd || !jump) return;

    switch (event.code) {
      case 'KeyW': wasd.forward = true; break;
      case 'KeyS': wasd.backward = true; break;
      case 'KeyA': wasd.left = true; break;
      case 'KeyD': wasd.right = true; break;
      case 'Space': if (!jump.jump) { jump.jump = true; } break;
      case 'Tab':
      case 'Escape': event.preventDefault(); break; // Prevent exiting pointer lock unintentionally
    }
  });

  // Keyboard input: Unset WASD flags when key is released
  document.addEventListener('keyup', (event: KeyboardEvent) => {
    const wasd = player.getComponent(WASDComponent);
    if (!wasd) return;

    switch (event.code) {
      case 'KeyW': wasd.forward = false; break;
      case 'KeyS': wasd.backward = false; break;
      case 'KeyA': wasd.left = false; break;
      case 'KeyD': wasd.right = false; break;
    }
  });

  // Click anywhere to lock the pointer (capture mouse)
  document.addEventListener('click', () => {
    if (!controls.isLocked) controls.lock();
  });

  return player;
}

/**
 * Creates the player's character mesh:
 * - Cylinder body + two small spheres as eyes
 * - Merges all geometries for better performance
 *
 * @returns MeshComponent wrapping the Three.js Mesh
 */
export function createCharacterMesh(): MeshComponent {
  const geometries: THREE.BufferGeometry[] = [];

  // Create a body (cylinder)
  const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, false);
  bodyGeometry.translate(0, 0, 0);
  geometries.push(bodyGeometry);

  // Create two eyes (small spheres)
  const eyeGeometry = new THREE.SphereGeometry(0.05, 4, 4);
  const eye1 = eyeGeometry.clone();
  eye1.translate(-0.15, 0.25, 0.48);
  geometries.push(eye1);

  const eye2 = eyeGeometry.clone();
  eye2.translate(0.15, 0.25, 0.48);
  geometries.push(eye2);

  // Merge geometries into a single mesh
  const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);

  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(mergedGeometry, material);
  mesh.scale.set(1.6, 1.6, 1.6); // Slightly larger for visibility

  return new MeshComponent(mesh);
}

/**
 * Sets up an enemy entity:
 * - Position, health, firing, alive status
 * - Mesh creation
 *
 * @param id - Unique entity ID
 * @param position - Starting position {x, y, z}
 * @param quantizedAngle - Starting angles {qpitch, qyaw}
 * @returns Initialized enemy entity
 */
export function setupEnemy(id: number, position: { x: number, y: number, z: number }, quantizedAngle: { qpitch: number, qyaw: number }): Entity | undefined {
  const enemy = new Entity(id);

  enemy.addComponent(new PositionComponent(position.x, position.y, position.z));
  enemy.addComponent(new FiringComponent(false));
  enemy.addComponent(new QuantizedAngleComponent(quantizedAngle.qpitch, quantizedAngle.qyaw));
  enemy.addComponent(new HealthComponent(100));
  enemy.addComponent(new AliveComponent(true));
  enemy.addComponent(new HitDetectionComponent(false));
  enemy.addComponent(createCharacterMesh());

  // (Note: actual adding to Three.js scene is handled during rendering, not here.)

  return enemy;
}
