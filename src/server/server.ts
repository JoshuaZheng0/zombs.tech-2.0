import { WebSocketServer, WebSocket } from 'ws';
import { JumpComponent, PositionComponent, FiringComponent, WASDComponent, DeltaTimeComponent, QuantizedAngleComponent, WebSocketComponent, AliveComponent, HitDetectionComponent, HealthComponent, KillsComponent, HealthChangedComponent, PositionChangedComponent, AngleChangedComponent, KillsChangedComponent } from '../shared/interface';
import { Entity } from '../shared/entity';
import { World } from '../shared/world';

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
  const currentAngle = player.getComponent(QuantizedAngleComponent);
  if (
    !currentAngle ||
    currentAngle.qpitch !== quantizedAngle.qpitch ||
    currentAngle.qyaw !== quantizedAngle.qyaw
  ) {
    player.addComponent(new AngleChangedComponent(true)); 
  }
  //TODO: add health changed component if hit by bullet

  // Update the entity with decoded components
  player.addComponent(wasd);
  player.addComponent(jump);
  player.addComponent(firing);
  player.addComponent(quantizedAngle);
  player.addComponent(position);
  player.addComponent(delta);
}


//____________ SERVER -> CLIENT ____________

// Set an interval updates to clients every 60ms
setInterval(() => {
  // Iterate over each connected client and send updated zombie positions
  for (const entity of world.getEntitiesWithComponent(WebSocketComponent)) {
  
    const buffer = encodeWorldData(world, entity.id);
    entity.getComponent(WebSocketComponent)?.socket.send(buffer);
  }
  
}, 60); // Update every 60ms

function encodeWorldData(world: World, currentClientId: number): ArrayBuffer {
  // Calculate how much space we need
  const buffer = new ArrayBuffer(84); // Max size: 84 bytes
  const view = new DataView(buffer);

  // 1 byte for the bitmask (8 enemies)
  // bitmask (1 byte): indicates which enemy slots are active (bit 0-7 = ID 1-8)

  let bitmask = 0;
  // Iterate over all entities and collect data for enemies (ID 1-9)
  let offset = 1;  // Start right after the bitmask byte
  let bitIndex = 0;
  for (let id = 1; id <= 9; id++) {
    if (id === currentClientId) continue;  // Skip current client

    const enemy = world.getEntityById(id);
    if (!enemy) continue;  // Skip if no entity found for the given ID

    // Read the components for the enemy
    const alive = enemy.getComponent(AliveComponent);
    const hitDetection = enemy.getComponent(HitDetectionComponent);
    const firing = enemy.getComponent(FiringComponent);
    const positionChanged = enemy.getComponent(PositionChangedComponent);
    const rotationChanged = enemy.getComponent(AngleChangedComponent);
    const healthChanged = enemy.getComponent(HealthChangedComponent);

    // Set the appropriate bitmask for the enemy
    const enemyBitmask = (alive ? 1 : 0) << 0 |
                         (hitDetection ? 1 : 0) << 1 |
                         (firing ? 1 : 0) << 2 |
                         (positionChanged ? 1 : 0) << 3 |
                         (rotationChanged ? 1 : 0) << 4 |
                         (healthChanged ? 1 : 0) << 5;

    // Set the bitmask for the enemy (1 byte for each enemy, 8 enemies in total)
    bitmask |= (1 << bitIndex); // Mark this enemy as active
    bitIndex++;

    // Write the enemy's bitmask
    view.setUint8(offset, enemyBitmask);
    offset += 1;

    // Encode enemy's position (3× int16_t) in fixed-point format (scaled by 100)
    const position = enemy.getComponent(PositionComponent);
    if (position && positionChanged) {
      view.setInt16(offset, Math.floor(position.x * 100), true);
      view.setInt16(offset + 2, Math.floor(position.y * 100), true);
      view.setInt16(offset + 4, Math.floor(position.z * 100), true);
      offset += 6;
    }


    // Encode enemy's rotation (pitch and yaw)
    const angle = enemy.getComponent(QuantizedAngleComponent);
    if (angle && rotationChanged) {
      view.setUint8(offset, angle.qpitch);
      view.setUint8(offset + 1, Math.floor((angle.qyaw + 32768)/65536 *255));
      offset += 2;
    }

    // Encode enemy's health (0-100)
    const health = enemy.getComponent(HealthComponent)?.health;
    if (health !== undefined && healthChanged) {
      view.setUint8(offset, health);
      offset += 1;
    }
  }

  // Encode player data (health and kills)
  const player = world.getEntityById(currentClientId);
  if (player) {
    const health = player.getComponent(HealthComponent)?.health;
    const healthChanged = player.getComponent(HealthChangedComponent)?.healthChanged;
    const kills = player.getComponent(KillsComponent)?.kills;
    const killsChanged = player.getComponent(KillsChangedComponent)?.killsChanged;

    // Encode player health (0-100)
    if (health !== undefined && healthChanged) {
      view.setUint8(offset, health);
      offset += 1;
    }

    // Encode player kills (unsigned short)
    if (kills !== undefined && killsChanged) {
      view.setUint16(offset, kills, true); // little-endian format
      offset += 2;
    }
  }
  view.setUint8(0, bitmask);
  return buffer.slice(0, offset);
}

console.log('WebSocket server is running on ws://localhost:3000');

//____________CALCULATIONS____________