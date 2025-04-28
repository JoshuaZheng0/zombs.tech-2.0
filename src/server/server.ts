import { WebSocketServer, WebSocket } from 'ws';
import { JumpComponent, PositionComponent, FiringComponent, WASDComponent, DeltaTimeComponent, QuantizedAngleComponent, WebSocketComponent, AliveComponent, HitDetectionComponent, HealthComponent, KillsComponent, HealthChangedComponent, PositionChangedComponent, AngleChangedComponent, KillsChangedComponent } from '../shared/interface';
import { Entity } from '../shared/entity';
import { World } from '../shared/world';
import * as THREE from 'three'; // Add at the top for vector math

//__________________INITIALIZE GAME__________________
const world = new World();

//__________________WEBSOCKET SERVER__________________
// Create a WebSocket server that listens on port 3000
const wss = new WebSocketServer({ port: 3000 });

//____________ CLIENT -> SERVER ____________
// When a new client connects to the server
wss.on('connection', (ws: WebSocket) => {

  const id = world.getAvailableEntityId();
  if (id === null) return; // max 9 players reached
  const player = new Entity(id);
  player.addComponent(new PositionComponent(0, 1.6, 0));
  player.addComponent(new WASDComponent(false, false, false, false));
  player.addComponent(new JumpComponent(false));
  player.addComponent(new FiringComponent(false));
  player.addComponent(new DeltaTimeComponent(0));
  player.addComponent(new QuantizedAngleComponent(127, 0));
  player.addComponent(new WebSocketComponent(ws));
  player.addComponent(new AliveComponent(true));
  player.addComponent(new HitDetectionComponent(false));
  player.addComponent(new HealthComponent(100));
  player.addComponent(new KillsComponent(0));
  player.addComponent(new PositionChangedComponent(false));
  player.addComponent(new AngleChangedComponent(false));
  player.addComponent(new HealthChangedComponent(false));
  player.addComponent(new KillsChangedComponent(false));
  world.addEntity(player);

  console.log(`Client ${id} connected`);  // Log the new connection

  // Handle incoming messages from the client
  ws.on('message', (message: Buffer) => {

    //decode input from client
    decodeInputToEntity(message, player);

  });

  // Handle the client disconnecting
  ws.on('close', () => {
    world.removeEntity(player);
    console.log(`Client ${id} disconnected`);  // Log the disconnection
  });

  // Handle errors related to the client's WebSocket connection
  ws.on('error', (err: Error) => {
    console.error(`Error with client ${id}:`, err);  // Log any error
  });
});

function decodeInputToEntity(buffer: Buffer, player: Entity) {
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const view = new DataView(arrayBuffer);

  // Read flags
  const flags = view.getUint8(0);

  // Extract WASD + Jump + Firing from flags
  const wasd = new WASDComponent(
    !!(flags & (1 << 0)), // forward
    !!(flags & (1 << 1)), // backward
    !!(flags & (1 << 2)), // left
    !!(flags & (1 << 3))  // right
  );
  const jump = new JumpComponent(!!(flags & (1 << 4)));
  const firing = new FiringComponent(!!(flags & (1 << 5)));

  // Read quantized pitch and yaw
  const qpitch = view.getUint8(1);
  const qyaw = view.getInt16(2, true); // little-endian

  const quantizedAngle = new QuantizedAngleComponent(qpitch, qyaw);

  // Read position (scaled down by dividing by 100)
  const x = view.getInt16(4, true) / 100;
  const y = view.getInt16(6, true) / 100;
  const z = view.getInt16(8, true) / 100;
  const position = new PositionComponent(x, y, z);

  // Read deltaTime
  const deltaTime = view.getUint8(10);
  const delta = new DeltaTimeComponent(deltaTime);
  const currentPosition = player.getComponent(PositionComponent);
  if (
    !currentPosition ||
    currentPosition.x !== position.x ||
    currentPosition.y !== position.y ||
    currentPosition.z !== position.z
  ) {
    player.addComponent(new PositionChangedComponent(true));
  }
  else {
    player.addComponent(new PositionChangedComponent(false));
  }
  const currentAngle = player.getComponent(QuantizedAngleComponent);
  if (
    !currentAngle ||
    currentAngle.qpitch !== quantizedAngle.qpitch ||
    currentAngle.qyaw !== quantizedAngle.qyaw
  ) {
    player.addComponent(new AngleChangedComponent(true));
  }
  else {
    player.addComponent(new AngleChangedComponent(false));
  }
  // Update the entity with decoded components
  player.addComponent(wasd);
  player.addComponent(jump);
  player.addComponent(firing);
  player.addComponent(quantizedAngle);
  player.addComponent(position);
  player.addComponent(delta);
}

// Helper: Convert QuantizedAngleComponent to direction vector
function getDirectionFromQuantizedAngle(qangle: QuantizedAngleComponent): THREE.Vector3 {
  // qpitch: 0-255 maps to -90 to +90 degrees (vertical)
  // qyaw: -32768 to +32767 maps to -180 to +180 degrees (horizontal)
  const pitch = (qangle.qpitch / 255) * Math.PI - Math.PI / 2;
  const yaw = (qangle.qyaw / 32767) * Math.PI;
  // FLIP the direction: negate x and z
  const x = -Math.cos(pitch) * Math.sin(yaw);
  const y = Math.sin(pitch);
  const z = -Math.cos(pitch) * Math.cos(yaw);
  return new THREE.Vector3(x, y, z).normalize();
}

// Helper: Ray-sphere intersection (for hit detection)
function rayIntersectsEntity(rayOrigin: THREE.Vector3, rayDir: THREE.Vector3, entity: Entity, radius = 0.5): boolean {
  const pos = entity.getComponent(PositionComponent);
  if (!pos) return false;
  const center = new THREE.Vector3(pos.x, pos.y, pos.z);
  const toCenter = center.clone().sub(rayOrigin);
  const t = toCenter.dot(rayDir);
  if (t < 0) return false; // Behind shooter
  const closest = rayOrigin.clone().add(rayDir.clone().multiplyScalar(t));
  const distSq = center.distanceToSquared(closest);
  return distSq <= radius * radius;
}

//____________ SERVER -> CLIENT ____________
let debugRaytracing = false;
// Set an interval updates to clients every 60ms
setInterval(() => {
  // --- HIT DETECTION & RAYTRACING ---
  for (const shooter of world.getEntitiesWithComponent(FiringComponent)) {
    const firing = shooter.getComponent(FiringComponent);
    const alive = shooter.getComponent(AliveComponent);
    if (!firing?.firing || !alive?.alive) continue;
    const shooterPos = shooter.getComponent(PositionComponent);
    const shooterAngle = shooter.getComponent(QuantizedAngleComponent);
    if (!shooterPos || !shooterAngle) continue;
    const rayOrigin = new THREE.Vector3(shooterPos.x, shooterPos.y, shooterPos.z);
    const rayDir = getDirectionFromQuantizedAngle(shooterAngle);
    if (debugRaytracing) {
      console.log(`[DEBUG] Shooter ${shooter.id} firing from (${shooterPos.x},${shooterPos.y},${shooterPos.z}) dir (${rayDir.x.toFixed(2)},${rayDir.y.toFixed(2)},${rayDir.z.toFixed(2)})`);
    }
    let hitAny = false;
    for (const target of world.getEntitiesWithComponent(AliveComponent)) {
      if (target === shooter) continue;
      const targetAlive = target.getComponent(AliveComponent);
      if (!targetAlive?.alive) continue;
      if (rayIntersectsEntity(rayOrigin, rayDir, target)) {
        hitAny = true;
        if (debugRaytracing) {
          console.log(`[DEBUG] Shooter ${shooter.id} HIT target ${target.id}`);
        }
        target.addComponent(new HitDetectionComponent(true));
        const health = target.getComponent(HealthComponent);
        if (health && health.health > 0) {
          health.health -= 10;
          if (debugRaytracing) {
            console.log(`[DEBUG] Target ${target.id} health now ${health.health}`);
          }
          target.addComponent(new HealthChangedComponent(true));
          if (health.health <= 0) {
            target.addComponent(new AliveComponent(false));
            if (debugRaytracing) {
              console.log(`[DEBUG] Target ${target.id} DIED`);
            }
            const kills = shooter.getComponent(KillsComponent);
            if (kills) {
              kills.kills += 1;
              shooter.addComponent(new KillsChangedComponent(true));
              if (debugRaytracing) {
                console.log(`[DEBUG] Shooter ${shooter.id} kills now ${kills.kills}`);
              }
            }
          }
        }
      }
    }
    if (!hitAny) {
      if (debugRaytracing) {
        console.log(`[DEBUG] Shooter ${shooter.id} did not hit any target`);
      }
    }
  }
  // Iterate over each connected client and send updated zombie positions
  for (const entity of world.getEntitiesWithComponent(WebSocketComponent)) {
    const buffer = encodeWorldData(world, entity.id);
    entity.getComponent(WebSocketComponent)?.socket.send(buffer);
  }
}, 60); // Update every 60ms

//remove this later
let debugBitmask = false;
const previousEnemyBitmasks: Map<number, number> = new Map();

function encodeWorldData(world: World, currentClientId: number): ArrayBuffer {
  const buffer = new ArrayBuffer(84);
  const view = new DataView(buffer);

  let bitmask = 0;
  let offset = 1;
  let bitIndex = 0;

  for (let id = 1; id <= 9; id++) {
    if (id === currentClientId) continue;

    const enemy = world.getEntityById(id);
    if (!enemy) continue;

    const aliveComp = enemy.getComponent(AliveComponent);
    const hitDetectionComp = enemy.getComponent(HitDetectionComponent);
    const firingComp = enemy.getComponent(FiringComponent);
    const positionChangedComp = enemy.getComponent(PositionChangedComponent);
    const rotationChangedComp = enemy.getComponent(AngleChangedComponent);
    const healthChangedComp = enemy.getComponent(HealthChangedComponent);

    const alive = aliveComp?.alive;
    const hitDetection = hitDetectionComp?.hitDetection;
    const firing = firingComp?.firing;
    const positionChanged = positionChangedComp?.positionChanged;
    const rotationChanged = rotationChangedComp?.angleChanged;
    const healthChanged = healthChangedComp?.healthChanged;

    const enemyBitmask = (alive ? 1 : 0) << 0 |
                         (hitDetection ? 1 : 0) << 1 |
                         (firing ? 1 : 0) << 2 |
                         (positionChanged ? 1 : 0) << 3 |
                         (rotationChanged ? 1 : 0) << 4 |
                         (healthChanged ? 1 : 0) << 5;

    bitmask |= (1 << bitIndex);
    bitIndex++;

    // 🛠️ Compare to previous bitmask
    const previous = previousEnemyBitmasks.get(enemy.id);
    if (debugBitmask && previous !== enemyBitmask) {
      console.log(`[DEBUG] Enemy ${enemy.id} bitmask changed: ${previous?.toString(2).padStart(8, '0') || '00000000'} -> ${enemyBitmask.toString(2).padStart(8, '0')}`);
      console.log(`[DETAIL] alive: ${alive}, hitDetection: ${hitDetection}, firing: ${firing}, positionChanged: ${positionChanged}, rotationChanged: ${rotationChanged}, healthChanged: ${healthChanged}, kills: ${enemy.getComponent(KillsComponent)?.kills}`);
      previousEnemyBitmasks.set(enemy.id, enemyBitmask); // Update cache
    }

    view.setUint8(offset, enemyBitmask);
    offset += 1;

    const position = enemy.getComponent(PositionComponent);
    if (position && positionChanged) { // 🛠️ fix to use boolean
      view.setInt16(offset, Math.floor(position.x * 100), true);
      view.setInt16(offset + 2, Math.floor(position.y * 100), true);
      view.setInt16(offset + 4, Math.floor(position.z * 100), true);
      offset += 6;
    }

    const angle = enemy.getComponent(QuantizedAngleComponent);
    if (angle && rotationChanged) { // 🛠️ fix to use boolean
      view.setUint8(offset, angle.qpitch);
      view.setUint8(offset + 1, Math.floor((angle.qyaw + 32768) / 65536 * 255));
      offset += 2;
    }

    const health = enemy.getComponent(HealthComponent)?.health;
    if (health !== undefined && healthChanged) { // 🛠️ fix to use boolean
      view.setUint8(offset, health);
      offset += 1;
    }

    if(hitDetection){
      enemy.addComponent(new HitDetectionComponent(false));
    }
    if(healthChanged){
      enemy.addComponent(new HealthChangedComponent(false));
    }
  }

  // Encode player data
  const player = world.getEntityById(currentClientId);
  if (player) {
    const health = player.getComponent(HealthComponent)?.health;
    const healthChanged = player.getComponent(HealthChangedComponent)?.healthChanged;
    const kills = player.getComponent(KillsComponent)?.kills;
    const killsChanged = player.getComponent(KillsChangedComponent)?.killsChanged;

    if (health !== undefined && healthChanged) {
      view.setUint8(offset, health);
      offset += 1;
    }

    if (kills !== undefined && killsChanged) {
      view.setUint16(offset, kills, true);
      offset += 2;
    }
  }

  view.setUint8(0, bitmask);
  return buffer.slice(0, offset);
}


console.log('WebSocket server is running on ws://localhost:3000');

//____________CALCULATIONS____________