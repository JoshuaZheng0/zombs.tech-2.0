import { World } from '../shared/world';
import { PositionComponent, QuantizedAngleComponent, MeshComponent, AliveComponent, HealthComponent, HitDetectionComponent } from '../shared/components';
import * as THREE from 'three';

// Global reference to the scene, set externally
let scene: THREE.Scene | null = null;

/**
 * Sets the scene reference used to render enemy meshes.
 * Must be called before rendering.
 * 
 * @param _scene - The active Three.js scene
 */
export function setEnemySceneReference(_scene: THREE.Scene) {
  scene = _scene;
}

/**
 * Renders all enemy entities:
 * - Smoothly updates their position and rotation
 * - Adds their mesh to the scene if missing
 * - Updates material color based on hit detection and health
 * 
 * @param world - The ECS world containing entities
 */
export function renderEnemies(world: World): void {
  // Get all entities with necessary components
  const entities = world.getEntitiesWithAllComponents(PositionComponent, QuantizedAngleComponent, MeshComponent, HealthComponent, HitDetectionComponent);

  for (const entity of entities) {
    if (entity.id === 1) continue; // Skip the current player (ID 1)

    const position = entity.getComponent(PositionComponent);
    const angle = entity.getComponent(QuantizedAngleComponent);
    const mesh = entity.getComponent(MeshComponent);
    const alive = entity.getComponent(AliveComponent)?.alive;
    const health = entity.getComponent(HealthComponent)?.health;
    const hitDetection = entity.getComponent(HitDetectionComponent)?.hitDetection;

    if (position && angle && mesh) {
      // --- Add mesh to scene if not already present ---
      if (scene && mesh.mesh.parent !== scene) {
        scene.add(mesh.mesh);
      }

      // --- Smoothly interpolate position (LERP) ---
      const targetPos = new THREE.Vector3(position.x, position.y, position.z);
      mesh.mesh.position.lerp(targetPos, 0.1); // Lerp factor controls smoothness (0.1 = quite smooth)

      // --- Smoothly interpolate rotation (SLERP) ---
      // Convert quantized angles back to radians
      const yaw = (angle.qyaw / 255) * 2 * Math.PI;
      const pitch = (angle.qpitch / 255) * Math.PI - Math.PI / 2;

      // Create a target quaternion from pitch and yaw
      const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
      mesh.mesh.quaternion.slerp(targetQuat, 0.1); // Slerp factor controls rotation smoothness

      // --- Set enemy material color based on state ---
      if (mesh.mesh.material) {
        const mat = mesh.mesh.material as THREE.MeshStandardMaterial;

        if (hitDetection) {
          // Flash red if recently hit
          mat.color.set('#ff0000');
        } else if (alive === false || (typeof health === 'number' && health <= 0)) {
          // Black color for dead enemies
          mat.color.set('#000000');
        } else if (typeof health === 'number') {
          // Shade gray based on remaining health (lighter = healthier)
          const gray = Math.max(0, Math.min(255, Math.round((health / 100) * 255)));
          mat.color.setRGB(gray / 255, gray / 255, gray / 255);
        }
      }
    }
  }
}
