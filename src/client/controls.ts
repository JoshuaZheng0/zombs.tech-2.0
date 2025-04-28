import * as THREE from 'three';
import { Entity } from '../shared/entity';
import { AngleComponent, QuantizedAngleComponent, PositionComponent } from '../shared/components';

// References to external systems
let camera: THREE.PerspectiveCamera;
let world: any;
let direction = new THREE.Vector3();
let physicsSystem: any;

// Quaternions used to smoothly rotate the camera
let currentCameraQuaternion = new THREE.Quaternion();
let targetCameraQuaternion = new THREE.Quaternion();

// Speed at which the camera rotation interpolates
let cameraRotationSpeed = 0.1;

/**
 * Set up references for camera, world, and physics system.
 * Should be called once during initialization.
 */
export function setControlReferences(_camera: THREE.PerspectiveCamera, _world: any, _physicsSystem: any) {
  camera = _camera;
  world = _world;
  physicsSystem = _physicsSystem;
}

/**
 * Updates player movement, including camera position and orientation.
 * @param playerEntity - The player's entity
 * @param deltaTime - Time elapsed since last update
 */
export function updateMovement(playerEntity: Entity, deltaTime: number) {
  const angle = playerEntity.getComponent(AngleComponent);
  const quantizedAngle = playerEntity.getComponent(QuantizedAngleComponent);
  const position = playerEntity.getComponent(PositionComponent);

  // If any of the required components are missing, don't continue
  if (!angle || !position || !quantizedAngle) return;

  // Dequantize yaw and pitch from compact representation
  let originalYaw = (quantizedAngle.qyaw / 32768) * Math.PI;
  let originalPitch = ((quantizedAngle.qpitch / 255) * Math.PI) - (Math.PI / 2);

  // Calculate 3D direction vector from yaw and pitch
  direction.x = Math.sin(originalYaw) * Math.cos(originalPitch);
  direction.y = Math.sin(originalPitch);
  direction.z = Math.cos(originalYaw) * Math.cos(originalPitch);
  direction.normalize();

  // Update the camera's rotation based on player's current orientation
  updateCameraRotation(deltaTime, originalPitch, originalYaw);

  // Apply movement logic using the physics system (e.g., velocity, collisions)
  physicsSystem.applyPlayerMovement(playerEntity, deltaTime);

  // Smoothly move the camera position towards the player's position
  const lerpFactor = 0.2;
  camera.position.lerp(
    new THREE.Vector3(position.x, position.y, position.z),
    lerpFactor
  );
}

/**
 * Smoothly updates the camera's rotation to match the player's view direction.
 * @param deltaTime - Time elapsed since last update
 * @param originalPitch - Player's pitch (up/down angle)
 * @param originalYaw - Player's yaw (left/right angle)
 */
export function updateCameraRotation(deltaTime: number, originalPitch: number, originalYaw: number) {
  // Copy the current camera orientation
  currentCameraQuaternion.copy(camera.quaternion);

  // Get the angle component from the main player entity (id = 1)
  const angle = world.getEntityById(1)?.getComponent(AngleComponent);
  if (!angle) return;

  // Create the desired rotation based on pitch and yaw
  const targetRotation = new THREE.Euler();
  targetRotation.x = originalPitch;
  targetRotation.y = originalYaw;
  targetRotation.z = 0;
  targetRotation.order = 'YXZ'; // Yaw first, then pitch

  // Convert the Euler rotation into a Quaternion
  targetCameraQuaternion.setFromEuler(targetRotation);

  // Interpolate between current and target quaternion for smooth rotation
  const slerpFactor = Math.min(1, cameraRotationSpeed * (deltaTime / 16));
  camera.quaternion.slerpQuaternions(currentCameraQuaternion, targetCameraQuaternion, slerpFactor);

  // Ensure that the camera has no unintended roll (rotation around the Z-axis)
  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  euler.z = 0;
  camera.quaternion.setFromEuler(euler);
}
