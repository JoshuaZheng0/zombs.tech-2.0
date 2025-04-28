import { World } from '../shared/world';
import { Entity } from '../shared/entity';
import { WASDComponent, JumpComponent, FiringComponent, QuantizedAngleComponent, DeltaTimeComponent, PositionComponent, HealthComponent, AliveComponent, HitDetectionComponent, KillsComponent } from '../shared/components';
import { setupEnemy } from './player';

let socket: WebSocket;
let isSocketOpen = false;
let debugBitmask = false;

/**
 * Initializes and configures the WebSocket connection:
 * - Handles connect, disconnect, error, and incoming messages
 *
 * @param world - The ECS world to update when receiving new data
 */
export function setupWebSocket(world: World) {
  // Connect to local WebSocket server
  socket = new WebSocket(`ws://localhost:3000`);
  // socket = new WebSocket(`wss://your-ngrok-url`); // Uncomment for public server

  socket.binaryType = 'arraybuffer';

  socket.onopen = () => {
    console.log('Connected to WebSocket server');
    isSocketOpen = true;
  };

  socket.onclose = () => {
    console.log('Disconnected from WebSocket server');
    isSocketOpen = false;
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onmessage = (event) => {
    decodeWorldData(event.data, world);
  };
}

/**
 * Sends the player's input state to the server if the WebSocket is open.
 *
 * @param world - The ECS world containing the player entity
 */
export function sendInput(world: World) {
  if (isSocketOpen) {
    const player = world.getEntityById(1);
    if (!player) return;
    const buffer = encodeInputFromEntity(player);
    socket.send(buffer);
  } else {
    console.log('WebSocket is not open yet');
  }
}

let debugInput = false;

/**
 * Encodes the current player input into a compact binary format:
 * - WASD movement, jump, firing, quantized rotation, position, deltaTime
 *
 * @param player - The player entity to read input from
 * @returns ArrayBuffer representing the encoded input
 */
export function encodeInputFromEntity(player: Entity): ArrayBuffer {
  const wasd = player.getComponent(WASDComponent);
  const jump = player.getComponent(JumpComponent);
  const firing = player.getComponent(FiringComponent);
  const quantizedAngle = player.getComponent(QuantizedAngleComponent);
  const delta = player.getComponent(DeltaTimeComponent);
  const position = player.getComponent(PositionComponent);

  const buffer = new ArrayBuffer(12);
  const view = new DataView(buffer);

  let flags = 0;
  flags |= wasd?.forward ? 1 << 0 : 0;
  flags |= wasd?.backward ? 1 << 1 : 0;
  flags |= wasd?.left ? 1 << 2 : 0;
  flags |= wasd?.right ? 1 << 3 : 0;
  flags |= jump?.jump ? 1 << 4 : 0;
  flags |= firing?.firing ? 1 << 5 : 0;

  view.setUint8(0, flags);
  view.setUint8(1, quantizedAngle?.qpitch ?? 0);
  view.setInt16(2, quantizedAngle?.qyaw ?? 0, true);
  view.setInt16(4, Math.floor((position?.x ?? 0) * 100), true);
  view.setInt16(6, Math.floor((position?.y ?? 0) * 100), true);
  view.setInt16(8, Math.floor((position?.z ?? 0) * 100), true);
  view.setUint8(10, delta?.deltaTime ?? 0);

  if (debugInput) {
    console.log(`[DEBUG] Sending input, position: ${position?.x},${position?.y},${position?.z}, quantizedAngle: ${quantizedAngle?.qpitch},${quantizedAngle?.qyaw}, wasd: ${wasd?.forward},${wasd?.backward},${wasd?.left},${wasd?.right}, jump: ${jump?.jump}, firing: ${firing?.firing}, deltaTime: ${delta?.deltaTime}`);
  }

  return buffer;
}

/**
 * Decodes the world state from the server and updates entities:
 * - Enemies: alive state, firing, position, rotation, health
 * - Player: health and kills
 *
 * @param buffer - ArrayBuffer received from the server
 * @param world - The ECS world to update
 */
export function decodeWorldData(buffer: ArrayBuffer, world: World): void {
  const view = new DataView(buffer);
  let bitmask = view.getUint8(0);
  let offset = 1;

  // Loop through each enemy slot (index 0-8 -> IDs 2-10)
  for (let index = 0; index <= 8; index++) {
    if (bitmask & (1 << index)) {
      let enemy = world.getEntityById(index + 2);
      if (!enemy) {
        // If enemy doesn't exist, create a placeholder
        enemy = setupEnemy(index + 2, { x: 0, y: 1.6, z: 0 }, { qpitch: 0, qyaw: 0 });
        if (enemy) {
          world.addEntity(enemy);
        }
      }

      const enemyBitmask = view.getUint8(offset);
      offset += 1;

      // Decode the enemy state
      const alive = (enemyBitmask & (1 << 0)) !== 0;
      const hitDetection = (enemyBitmask & (1 << 1)) !== 0;
      const firing = (enemyBitmask & (1 << 2)) !== 0;
      const positionChanged = (enemyBitmask & (1 << 3)) !== 0;
      const rotationChanged = (enemyBitmask & (1 << 4)) !== 0;
      const healthChanged = (enemyBitmask & (1 << 5)) !== 0;

      if (debugBitmask) {
        console.log(`[DEBUG] Enemy ${enemy?.id}, alive: ${alive}, hitDetection: ${hitDetection}, firing: ${firing}, positionChanged: ${positionChanged}, rotationChanged: ${rotationChanged}, healthChanged: ${healthChanged}`);
      }

      enemy?.addComponent(new AliveComponent(alive));
      enemy?.addComponent(new HitDetectionComponent(hitDetection));
      enemy?.addComponent(new FiringComponent(firing));

      // Decode position if changed
      const position = enemy?.getComponent(PositionComponent);
      if (position && positionChanged) {
        position.x = view.getInt16(offset, true) / 100;
        position.y = view.getInt16(offset + 2, true) / 100;
        position.z = view.getInt16(offset + 4, true) / 100;
        offset += 6;
      }

      // Decode rotation if changed
      const angle = enemy?.getComponent(QuantizedAngleComponent);
      if (angle && rotationChanged) {
        angle.qpitch = view.getUint8(offset);
        angle.qyaw = view.getUint8(offset + 1);
        offset += 2;
      }

      // Decode health if changed
      const healthComponent = enemy?.getComponent(HealthComponent);
      if (healthComponent && healthChanged) {
        healthComponent.health = view.getUint8(offset);
        offset += 1;
      }
    }
  }

  // --- Decode player-specific data (health, kills) ---
  const player = world.getEntityById(1);
  if (player) {
    const remaining = buffer.byteLength - offset;
    let healthComponent = player.getComponent(HealthComponent);

    if (remaining === 1) {
      if (healthComponent) {
        healthComponent.health = view.getUint8(offset);
        offset += 1;
      }
    } else if (remaining === 2) {
      const killsComponent = player.getComponent(KillsComponent);
      if (killsComponent) {
        killsComponent.kills = view.getUint16(offset, true);
        offset += 2;
      }
    } else if (remaining === 3) {
      if (healthComponent) {
        healthComponent.health = view.getUint8(offset);
        offset += 1;
      }
      const killsComponent = player.getComponent(KillsComponent);
      if (killsComponent) {
        killsComponent.kills = view.getUint16(offset, true);
        offset += 2;
      }
    }

    // Update alive status based on health
    healthComponent = player.getComponent(HealthComponent);
    const aliveComponent = player.getComponent(AliveComponent);
    if (aliveComponent && healthComponent && typeof healthComponent.health === 'number') {
      aliveComponent.alive = healthComponent.health > 0;
    }
  }
}

// Export socket to allow manual debug if needed
export { socket };
