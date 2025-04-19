import './style.css'
import * as THREE from 'three'
import { BufferGeometryUtils, PointerLockControls } from 'three/examples/jsm/Addons.js'
import { JumpComponent, PositionComponent, FiringComponent, WASDComponent, DeltaTimeComponent, QuantizedAngleComponent, AngleComponent, MeshComponent, HealthComponent, AliveComponent, HitDetectionComponent, KillsComponent } from './game/interface';
import { Entity } from './game/entity'
import { World } from './game/world'
import { wallMap } from './game/wall_map'
let world: World; // Represents the game world
let controls: PointerLockControls; // Handles mouse pointer lock and camera controls for first-person movement
let scene: THREE.Scene; // The main 3D scene where all objects are added
let renderer: THREE.WebGLRenderer; // Renders the scene using WebGL
let camera: THREE.PerspectiveCamera; // Perspective camera used for 3D rendering
let fpsCounter: HTMLDivElement; // HTML element used to display frames per second
let frameCount = 0; // Counts the number of frames rendered
let lastFpsUpdate = 0; // Timestamp of the last FPS update

// Add variables to track camera rotation
let currentCameraQuaternion = new THREE.Quaternion(); // The current rotation of the camera, used for interpolation
let targetCameraQuaternion = new THREE.Quaternion(); // The desired camera rotation we're interpolating toward
let cameraRotationSpeed = .1; // Adjust this value to control rotation smoothness (lower = smoother)

//variables that don't need to be recreated every frame
let direction = new THREE.Vector3();;

//_____________________GAME INITIALIZATION_____________________
// Ensure the game world is initialized only after the page has fully loaded
window.onload = () => {

  initWorld();

  socket.onmessage = (event) => {
    decodeWorldData(event.data, world);
  };
  
  // Start render loop
  requestAnimationFrame(animate);
};

function initWorld() {
  // 1. Create the world instance
  world = new World();

  // 2. Create entities
  const player = setupPlayer(camera);

  // 3. Add entities to the world
  world.addEntity(player);


  // 4. Set up environment (lighting, camera, etc.)
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87CEEB)

  setupLighting();
  setupCamera();
  setupRenderer();
  createUI();
  createEnvironment();

  // 5.Set up event listeners
  window.addEventListener('resize', onWindowResize);
  document.addEventListener('mousedown', onMouseClick);
  document.addEventListener('mouseup', onMouseUp);
}

//_____________________WEBSOCKET SETUP_____________________
// Create a WebSocket connection to the server
const socket = new WebSocket('ws://localhost:3000');


// Set the WebSocket's binary type to ArrayBuffer to handle binary data
socket.binaryType = 'arraybuffer';

let isSocketOpen = false;  // A flag to track whether the WebSocket connection is open

// Handle the WebSocket connection open event
socket.onopen = () => {
  console.log('Connected to WebSocket server');  // Log a message when the connection is established
  isSocketOpen = true;  // Mark the WebSocket as open, allowing data to be sent
};

// Handle the WebSocket connection close event
socket.onclose = () => {
  console.log('Disconnected from WebSocket server');  // Log a message when the connection is closed
  isSocketOpen = false;  // Mark the WebSocket as closed
};

// Handle WebSocket errors (if any)
socket.onerror = (error) => {
  console.error('WebSocket error:', error);  // Log the error message
};
//_____________________WEBSOCKET SETUP END_____________________
//_____________________MAIN INIT FUNCTIONS_____________________

// player setup
function setupPlayer(camera: THREE.Camera): Entity {
  // Create ECS player entity
  const player = new Entity(1); // You can use a global ID generator if needed

  // Attach components
  player.addComponent(new PositionComponent(0, 1.6, 0));
  player.addComponent(new WASDComponent(false, false, false, false));
  player.addComponent(new JumpComponent(false));
  player.addComponent(new FiringComponent(false));
  player.addComponent(new AngleComponent(0, 0)); // Initialize with pitch=0, yaw=0
  player.addComponent(new DeltaTimeComponent(0));
  player.addComponent(new QuantizedAngleComponent(127, 0));
  player.addComponent(createCharacterMesh());
  // Set up controls
  controls = new PointerLockControls(camera, document.body);

  // Add event listener for mouse movement to update pitch and yaw
  document.addEventListener('mousemove', (event) => {
    if (!controls.isLocked) return;

    const angle = player.getComponent(AngleComponent);
    const quantizedAngle = player.getComponent(QuantizedAngleComponent);
    if (!angle || !quantizedAngle) return;

    // Update pitch and yaw based on mouse movement (radians)
    angle.yaw -= event.movementX * 0.002;
    angle.pitch -= event.movementY * 0.002;

    // Clamp pitch to prevent camera flipping
    angle.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, angle.pitch));

        // Normalize yaw to the range [-π, π]
    if (angle.yaw > Math.PI) {
      angle.yaw -= 2 * Math.PI;  // Wrap around to -π
    } else if (angle.yaw < -Math.PI) {
      angle.yaw += 2 * Math.PI;  // Wrap around to π
    }

    // Convert yaw to 2 bytes (Q1.15)
    quantizedAngle.qyaw = Math.floor((angle.yaw / Math.PI) * 32768);

    // Convert pitch to 1 byte (0–255)
    quantizedAngle.qpitch = Math.floor(((angle.pitch + Math.PI / 2) / Math.PI) * 255);

  });


  // Keyboard listeners
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (world.gameState.gameOver) return;

    const wasd = player.getComponent(WASDComponent);
    const jump = player.getComponent(JumpComponent);
    if (!wasd) return;
    if (!jump) return;

    switch (event.code) {
      case 'KeyW':
        wasd.forward = true;
        break;
      case 'KeyS':
        wasd.backward = true;
        break;
      case 'KeyA':
        wasd.left = true;
        break;
      case 'KeyD':
        wasd.right = true;
        break;
      case 'Space':
        if (!jump.jump) {
          world.gameState.verticalVelocity = world.gameState.jumpForce;
          jump.jump = true;
        }
        break;
      case 'Tab':
      case 'Escape':
        event.preventDefault();
        break;
    }
  });

  document.addEventListener('keyup', (event: KeyboardEvent) => {
    const wasd = player.getComponent(WASDComponent);
    if (!wasd) return;
    switch (event.code) {
      case 'KeyW':
        wasd.forward = false;
        break;
      case 'KeyS':
        wasd.backward = false;
        break;
      case 'KeyA':
        wasd.left = false;
        break;
      case 'KeyD':
        wasd.right = false;
        break;
    }
  });

  document.addEventListener('click', () => {
    if (!controls.isLocked) controls.lock();
  });

  return player;
}

// Set up scene lighting
function setupLighting() {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
  scene.add(ambientLight);

  // Directional light (sun)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
}
// camera setup
function setupCamera() {
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.y = 1.6; // Player eye height
  // Set initial player position at attacker spawn point
  camera.position.set(0, 1.6, 0);
  camera.lookAt(0, 1.6, -1); // Look slightly forward
}
// renderer setup
function setupRenderer() {
  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  document.body.appendChild(renderer.domElement)
}

function createUI() {
  // Create FPS counter
  fpsCounter = document.createElement('div');
  fpsCounter.style.position = 'absolute';
  fpsCounter.style.top = '10px';
  fpsCounter.style.right = '10px';
  fpsCounter.style.color = 'white';
  fpsCounter.style.fontFamily = 'Arial, sans-serif';
  fpsCounter.style.fontSize = '16px';
  fpsCounter.style.fontWeight = 'bold';
  fpsCounter.style.textShadow = '1px 1px 2px black';
  fpsCounter.style.zIndex = '1000';
  fpsCounter.textContent = 'FPS: 0';
  document.body.appendChild(fpsCounter);
}

function createEnvironment() {
  createTerrain(wallMap);
}

// player setup
function setupEnemy(id: number, position: { x: number, y: number, z: number }, quantizedAngle: { qpitch: number, qyaw: number }): Entity | undefined {
  // Create ECS player entity
  const enemy = new Entity(id);
  // Attach components
  enemy.addComponent(new PositionComponent(position.x, position.y, position.z));
  enemy.addComponent(new FiringComponent(false));
  enemy.addComponent(new QuantizedAngleComponent(quantizedAngle.qpitch, quantizedAngle.qyaw));
  enemy.addComponent(new HealthComponent(100));
  enemy.addComponent(new AliveComponent(true));
  enemy.addComponent(new HitDetectionComponent(false));
  enemy.addComponent(createCharacterMesh());
  const meshComponent = enemy.getComponent(MeshComponent);
  if (meshComponent) {
    scene.add(meshComponent.mesh);  // Only add if mesh is defined
  }

  return enemy;
}

//____________________MESH FUNCTIONS____________________
function createTerrain(wallMap: number[][]) {
  // Arrays to hold wall, ground, tree, and rock geometries
  const wallGeometries: THREE.BufferGeometry[] = [];
  const groundGeometries: THREE.BufferGeometry[] = [];
  const treeGeometries: THREE.BufferGeometry[] = [];
  const rockGeometries: THREE.BufferGeometry[] = [];
  
  const width = wallMap.length;  // 100
  const height = wallMap[0].length;  // 100

  // Loop through the grid based on the wallMap dimensions
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < height; z++) {

      const isBlocked = wallMap[x][z] === 1;  // Check if it's a wall tile
      const isTreeSpot = wallMap[x][z] === 2;  // Check if it's a tree tile
      const isRockSpot = wallMap[x][z] === 3;  // Check if it's a rock tile

      // Calculate world position for this tile
      const worldX = x - 50;  // Shifting to -50 to 50 range
      const worldZ = z - 50;  // Shifting to -50 to 50 range

      let height = 0;
      let geometry: THREE.BufferGeometry;

      if (isBlocked) {
        height = Math.random() * 1.5 + 4.5; // Random height variation for walls
        geometry = new THREE.BoxGeometry(1, height, 1);
        geometry.translate(worldX, height / 2, worldZ);  // Position the block
        wallGeometries.push(geometry); // Add to wall geometries
      } else {
        height = Math.random() * 0.2 + 0.05; // Random height variation for terrain
        geometry = new THREE.BoxGeometry(1, height, 1);
        geometry.translate(worldX, height / 2, worldZ);  // Position the terrain cube
        groundGeometries.push(geometry); // Add to ground geometries
      }

      // Add tree geometry if it's a tree spot
      if (isTreeSpot) {
        const treeTrunkHeight = Math.random() * 2 + 3; // Random tree trunk height
        const treeTrunkGeo = new THREE.CylinderGeometry(0.1, 0.1, treeTrunkHeight, 8);
        treeTrunkGeo.translate(worldX, treeTrunkHeight / 2, worldZ); // Position trunk
        treeGeometries.push(treeTrunkGeo);

        const treeCrownGeo = new THREE.SphereGeometry(1, 8, 8); // Simple sphere for tree crown
        treeCrownGeo.translate(worldX, treeTrunkHeight + 1, worldZ); // Position crown
        treeGeometries.push(treeCrownGeo);
      }

      // Add rock geometry if it's a rock spot
      if (isRockSpot) {
        const rockGeo = new THREE.SphereGeometry(0.5, 8, 8); // Simple rock using sphere
        rockGeo.translate(worldX, 0.25, worldZ); // Position rock
        rockGeometries.push(rockGeo);
      }
    }
  }

  if (wallGeometries.length > 0) {
    const mergedWallGeometry = BufferGeometryUtils.mergeGeometries(wallGeometries);
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const wallMesh = new THREE.Mesh(mergedWallGeometry, wallMaterial);
    scene.add(wallMesh);
  }
  
  if (groundGeometries.length > 0) {
    const mergedGroundGeometry = BufferGeometryUtils.mergeGeometries(groundGeometries);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const groundMesh = new THREE.Mesh(mergedGroundGeometry, groundMaterial);
    scene.add(groundMesh);
  }
  
  if (treeGeometries.length > 0) {
    const mergedTreeGeometry = BufferGeometryUtils.mergeGeometries(treeGeometries);
    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const treeMesh = new THREE.Mesh(mergedTreeGeometry, treeMaterial);
    scene.add(treeMesh);
  }
  
  if (rockGeometries.length > 0) {
    const mergedRockGeometry = BufferGeometryUtils.mergeGeometries(rockGeometries);
    const rockMaterial = new THREE.MeshStandardMaterial({ color: 0xA9A9A9 });
    const rockMesh = new THREE.Mesh(mergedRockGeometry, rockMaterial);
    scene.add(rockMesh);
  }
}


function createCharacterMesh(): MeshComponent {
  const geometries: THREE.BufferGeometry[] = [];

  // Body (thicker and taller, with caps)
  const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 16, false); // false = has caps
  bodyGeometry.translate(0, 0, 0);
  geometries.push(bodyGeometry);

  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
  const eye1 = eyeGeometry.clone();
  eye1.translate(-0.15, 0.25, 0.48); // Front-facing
  geometries.push(eye1);

  const eye2 = eyeGeometry.clone();
  eye2.translate(0.15, 0.25, 0.48);
  geometries.push(eye2);

  // Merge geometries
  const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });

  const mesh = new THREE.Mesh(mergedGeometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.scale.set(1.6,1.6,1.6); // x, y, z

  return new MeshComponent(mesh);
}




//_____________________HELPER FUNCTIONS INIT____________________

// Handle mouse click (shooting)
function onMouseClick() {
  if (world.gameState.gameOver) {
    return;
  }

  if (!controls.isLocked) return;

  // Start shooting
  const firingComponent = world.getEntityById(1)?.getComponent(FiringComponent);
  if (firingComponent) {
    firingComponent.firing = true;
  }
}

// Handle mouse up (stop shooting)
function onMouseUp() {

  const firingComponent = world.getEntityById(1)?.getComponent(FiringComponent);
  if (firingComponent) {
    firingComponent.firing = false;
  }
}


function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateMovement(playerEntity: Entity, deltaTime: number) {
  const wasd = playerEntity.getComponent(WASDComponent);
  const angle = playerEntity.getComponent(AngleComponent);
  const jump = playerEntity.getComponent(JumpComponent);
  const position = playerEntity.getComponent(PositionComponent);
  const quantizedAngle = playerEntity.getComponent(QuantizedAngleComponent);

  if (!angle || !position || !quantizedAngle) return;

  // Convert quantized yaw (2 bytes, Q1.15) back to radians
  let originalYaw = (quantizedAngle.qyaw / 32768) * Math.PI; // Reversed scaling for Q1.15

  // Convert quantized pitch (1 byte) back to radians
  let originalPitch = ((quantizedAngle.qpitch / 255) * Math.PI) - (Math.PI / 2); // Reversed scaling for 0–255 range to -π/2 to π/2


  // Calculate direction vector from pitch and yaw
  direction.x = Math.sin(originalYaw) * Math.cos(originalPitch);
  direction.y = Math.sin(originalPitch);
  direction.z = Math.cos(originalYaw) * Math.cos(originalPitch);

  // Normalize the direction vector
  direction.normalize();

  // Create 2D direction for movement (ignoring vertical component)
  const dir2D = new THREE.Vector2(direction.x, direction.z).normalize();

  // Apply smooth camera rotation using slerp
  updateCameraRotation(deltaTime, originalPitch, originalYaw);

  // Calculate the right vector in 2D space
  const right2D = new THREE.Vector2(-dir2D.y, dir2D.x);

  // Movement vector (2D)
  let move2D = new THREE.Vector2();

  if (wasd?.forward) move2D.sub(dir2D);
  if (wasd?.backward) move2D.add(dir2D);
  if (wasd?.left) move2D.add(right2D);
  if (wasd?.right) move2D.sub(right2D);

  if (move2D.lengthSq() > 0) {
    move2D.normalize().multiplyScalar(world.gameState.moveSpeed * (deltaTime / 16));
    position.x += move2D.x;
    position.z += move2D.y;
  }

  // Vertical (Y-axis) movement
  if (jump) {
    world.gameState.verticalVelocity -= world.gameState.gravity;
    position.y += world.gameState.verticalVelocity * (deltaTime / 16);
  }

  // Floor collision
  if (position.y < 1.6) {
    position.y = 1.6;
    world.gameState.verticalVelocity = 0;
    if (jump) jump.jump = false;
  }

  // Clamp to map boundaries
  position.x = Math.max(-50, Math.min(50, position.x));
  position.z = Math.max(-50, Math.min(50, position.z));

  // ✅ LERP the camera position to smooth out movement
  const lerpFactor = 0.2; // Try 0.1–0.2 for subtle smoothing
  camera.position.lerp(
    new THREE.Vector3(position.x, position.y, position.z),
    lerpFactor
  );
}

// Add a new function to handle smooth camera rotation
function updateCameraRotation(deltaTime: number, originalPitch: number, originalYaw: number) {
  // Get the current camera rotation
  currentCameraQuaternion.copy(camera.quaternion);

  // Get the angle component from the player
  const angle = world.getEntityById(1)?.getComponent(AngleComponent);
  if (!angle) return;

  // Create a target rotation based on pitch and yaw
  // Use a different approach to create the Euler rotation
  const targetRotation = new THREE.Euler();
  targetRotation.x = originalPitch;
  targetRotation.y = originalYaw;
  targetRotation.z = 0;
  targetRotation.order = 'YXZ';
  targetCameraQuaternion.setFromEuler(targetRotation);

  // Apply slerp to smoothly interpolate between current and target rotation
  // Adjust the slerp factor based on deltaTime for consistent smoothing regardless of frame rate
  const slerpFactor = Math.min(1, cameraRotationSpeed * (deltaTime / 16));
  camera.quaternion.slerpQuaternions(currentCameraQuaternion, targetCameraQuaternion, slerpFactor);

  // Remove roll
  const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  euler.z = 0;
  camera.quaternion.setFromEuler(euler);
}

function renderEnemies(world: World): void {
  const entities = world.getEntitiesWithAllComponents(PositionComponent, QuantizedAngleComponent, MeshComponent);

  for (const entity of entities) {
    if (entity.id === 1) continue; // skip the current player

    const position = entity.getComponent(PositionComponent);
    const angle = entity.getComponent(QuantizedAngleComponent);
    const mesh = entity.getComponent(MeshComponent);

    if (position && angle && mesh) {
      // Update position
      mesh.mesh.position.set(position.x, position.y, position.z);

      console.log(`Yaw: ${angle.qyaw}, Pitch: ${angle.qpitch}`);
      // Convert quantized angles (0-255) to radians (0 - 2π)
      // Reverse yaw (Q1.15 format)
      const yaw = ((angle.qyaw / 255) * 2 * Math.PI);
      // Reverse pitch (0-255 range)
      const pitch = ((angle.qpitch / 255) * Math.PI) - (Math.PI / 2);

      // Update rotation — adjust axes based on your model orientation
      mesh.mesh.rotation.set(-pitch, yaw, 0, 'YXZ');// or use Euler if needed: new THREE.Euler(pitch, yaw, 0)

    }
  }
}



//_____________________GAME LOOP_____________________

let lastTime = 0;
const interval = 16;

function animate(currentTime: number) {
  requestAnimationFrame(animate); // Schedule the next frame

  try {
    const deltaTime = Math.floor(currentTime - lastTime);

    // Update FPS counter
    frameCount++;
    if (currentTime - lastFpsUpdate >= 1000) {
      const fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
      fpsCounter.textContent = `FPS: ${fps}`;
      frameCount = 0;
      lastFpsUpdate = currentTime;
    }

    // Only update if enough time has passed to maintain 60 FPS
    if (deltaTime >= interval) {
      lastTime = currentTime - (deltaTime % interval); // Adjust for drift

      // Optionally, clamp deltaTime to avoid extreme values
      const MIN_DELTA_TIME = 16; // Minimum deltaTime (about 60 FPS)
      const MAX_DELTA_TIME = 250; // Maximum deltaTime (about 10 FPS)
      const clampedDeltaTime = Math.max(MIN_DELTA_TIME, Math.min(deltaTime, MAX_DELTA_TIME));

      // Update game logic
      const time = world.getEntityById(1)?.getComponent(DeltaTimeComponent);
      if (time) time.deltaTime = clampedDeltaTime;

      if (!world.gameState.gameOver && controls.isLocked) {
        const player = world.getEntityById(1);
        if (!player) return;
        updateMovement(player, clampedDeltaTime);
        logAllEntities(world);
        renderEnemies(world);
        sendInput(); // Uncomment if necessary
      }

      // Render the scene
      renderer.render(scene, camera);
    }
  } catch (error) {
    console.error('Error in animation loop:', error);
  }
}

function logAllEntities(world: World): void {
  const entities = world.getEntitiesWithAllComponents(PositionComponent, QuantizedAngleComponent, MeshComponent);

  if (!entities || entities.length === 0) {
    console.warn("No entities found.");
    return;
  }

  entities.forEach((entity) => {
    let logLine = `🧱 Entity ${entity.id}: `;

    const components = entity.getAllComponents();
    if (components.size === 0) {
      logLine += "no components.";
    } else {
      const parts: string[] = [];

      components.forEach((component) => {
        if (typeof component.toString === 'function') {
          parts.push(component.toString());
        }
      });

      logLine += parts.join(" | ");
    }

    //console.log(logLine);
  });
}




//_____________________GAME LOOP END_____________________

//_____________________CLIENT -> SERVER_____________________
function sendInput() {

  // Only send the buffer if the WebSocket is open
  if (isSocketOpen) {
    const player = world.getEntityById(1);
    if (!player) return;
    const buffer = encodeInputFromEntity(player);
    socket.send(buffer);  // Send the ArrayBuffer containing the float values to the server
  } else {
    console.log('WebSocket is not open yet');  // Log a message if the WebSocket is not open
  }
}

function encodeInputFromEntity(player: Entity): ArrayBuffer {
  const wasd = player.getComponent(WASDComponent);
  const jump = player.getComponent(JumpComponent);
  const firing = player.getComponent(FiringComponent);
  const quantizedAngle = player.getComponent(QuantizedAngleComponent);
  const delta = player.getComponent(DeltaTimeComponent);
  const position = player.getComponent(PositionComponent);

  const buffer = new ArrayBuffer(12); // 1 byte flags + 1 byte pitch + 2 bytes yaw + 3*2 bytes for position + 1 byte deltaTime
  const view = new DataView(buffer);

  let flags = 0;
  flags |= wasd?.forward ? 1 << 0 : 0;
  flags |= wasd?.backward ? 1 << 1 : 0;
  flags |= wasd?.left ? 1 << 2 : 0;
  flags |= wasd?.right ? 1 << 3 : 0;
  flags |= jump?.jump ? 1 << 4 : 0;
  flags |= firing?.firing ? 1 << 5 : 0;

  // 1 byte for flags (WASD, jump, fire, etc.)
  view.setUint8(0, flags);

  // 1 byte for pitch (quantized 0-360° to 0-255)
  view.setUint8(1, quantizedAngle?.qpitch ?? 0);

  // 2 bytes for yaw (Q1.15 format)
  view.setInt16(2, quantizedAngle?.qyaw ?? 0, true); // Store in little-endian format

  // 2 bytes each for position (fixed-point int16 format, *100 for precision)
  view.setInt16(4, Math.floor((position?.x ?? 0) * 100), true);  // Position X
  view.setInt16(6, Math.floor((position?.y ?? 0) * 100), true);  // Position Y
  view.setInt16(8, Math.floor((position?.z ?? 0) * 100), true);  // Position Z

  // 1 byte for deltaTime (milliseconds, 0-255)
  view.setUint8(10, delta?.deltaTime ?? 0);

  return buffer;
}

//_____________________CLIENT -> SERVER END_____________________
//_____________________SERVER -> CLIENT_____________________
// Handle incoming messages from the WebSocket server

function decodeWorldData(buffer: ArrayBuffer, world: World): void {
  const view = new DataView(buffer);

  // Read the bitmask from the first byte
  let bitmask = view.getUint8(0);
  let offset = 1;

  // Iterate over all possible enemy slots (ID 1-9), skipping the current client
  for (let index = 0; index <= 8; index++) {
    // Check if the enemy is active by examining the corresponding bit in the bitmask
    if (bitmask & (1 << index)) {
      let enemy = world.getEntityById(index + 2); // Assuming enemies have IDs starting from 2

      // If the enemy does not exist, create the enemy and add it to the world
      if (!enemy) {
        enemy = setupEnemy(index + 2, { x: 0, y: 1.6, z: 0 }, { qpitch: 0, qyaw: 0 });
        if (enemy) {
          world.addEntity(enemy);
        }
      }

      // Read the enemy's bitmask (1 byte for each enemy)
      const enemyBitmask = view.getUint8(offset);
      offset += 1;

      // Decode the individual flags from the enemy's bitmask
      const alive = (enemyBitmask & (1 << 0)) !== 0;
      const hitDetection = (enemyBitmask & (1 << 1)) !== 0;
      const firing = (enemyBitmask & (1 << 2)) !== 0;
      const positionChanged = (enemyBitmask & (1 << 3)) !== 0;
      const rotationChanged = (enemyBitmask & (1 << 4)) !== 0;
      const healthChanged = (enemyBitmask & (1 << 5)) !== 0;

      enemy?.addComponent(new AliveComponent(alive));
      enemy?.addComponent(new HitDetectionComponent(hitDetection));
      enemy?.addComponent(new FiringComponent(firing));

      // Decode the enemy's position (3× int16_t)
      const position = enemy?.getComponent(PositionComponent);
      if (position && positionChanged) {
        position.x = view.getInt16(offset, true) / 100; // Scale back from fixed-point format
        position.y = view.getInt16(offset + 2, true) / 100;
        position.z = view.getInt16(offset + 4, true) / 100;
        offset += 6;
      }

      // Decode the enemy's rotation (pitch and yaw)
      const angle = enemy?.getComponent(QuantizedAngleComponent);
      if (angle && rotationChanged) {
        angle.qpitch = view.getUint8(offset);
        angle.qyaw = view.getUint8(offset + 1);
        offset += 2;
      }

      // Decode the enemy's health
      const healthComponent = enemy?.getComponent(HealthComponent);
      if (healthComponent && healthChanged) {
        healthComponent.health = view.getUint8(offset);
        offset += 1;
      }
    }
  }


  // Decode player data (health and kills)
  const player = world.getEntityById(1);
  if (player) {
    const remaining = buffer.byteLength - offset;

    if (remaining === 1) {
      const healthComponent = player.getComponent(HealthComponent);
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
      const healthComponent = player.getComponent(HealthComponent);
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
  }

}




//_____________________SERVER -> CLIENT END_____________________


