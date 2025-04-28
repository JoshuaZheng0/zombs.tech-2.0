import * as THREE from 'three'
import * as RAPIER from '@dimforge/rapier3d-compat'
import { FPS } from 'yy-fps'

import { setupLighting, setupCamera, setupRenderer, createEnvironment, setSceneReferences } from './scene'
import { setupPlayer } from './player'
import { setControlReferences, updateMovement } from './controls'
import { setupWebSocket, sendInput } from './websocket'
import { createUI, showDeathScreen, hideDeathScreen } from './ui'
import { setBulletReferences, spawnBulletFromCamera, animateBullets, BULLET_FIRE_INTERVAL } from './bullets'
import { renderEnemies, setEnemySceneReference } from './helpers'

import { World } from '../shared/world'
import { PhysicsSystem } from '../shared/physics'
import { HealthComponent, AliveComponent, MeshComponent, DeltaTimeComponent, PositionComponent, FiringComponent } from '../shared/components'

// --- Game state variables ---
const fps = new FPS()
let world: World
let scene: THREE.Scene
let renderer: THREE.WebGLRenderer
let camera: THREE.PerspectiveCamera
let physicsSystem: PhysicsSystem
let respawnRequested = false
let isFiring = false
let lastBulletTime = 0
let playerOriginalColor: THREE.Color | null = null
let playerHalfHealthApplied = false

// ------------------------------
// 🏁 Game Initialization
// ------------------------------
window.onload = async () => {
  // Initialize Rapier physics engine
  await RAPIER.init()

  // Create Three.js scene and camera
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87CEEB) // Sky blue background
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  renderer = new THREE.WebGLRenderer({ antialias: true })

  // Set up scene-wide references
  setEnemySceneReference(scene)
  setSceneReferences(scene, camera, renderer)
  setBulletReferences(camera, scene)

  // Create ECS world
  world = new World()

  // Setup environment (lighting, terrain, UI)
  setupLighting()
  setupCamera()
  setupRenderer()
  createUI()
  createEnvironment()

  // Create player entity
  const player = setupPlayer(camera)
  world.addEntity(player)

  // Initialize physics system
  physicsSystem = new PhysicsSystem(world)
  physicsSystem.initPlayer(player)

  // Setup controls (camera movement, physics input)
  setControlReferences(camera, world, physicsSystem)

  // Connect WebSocket to server
  setupWebSocket(world)

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // Handle mouse click to start firing
  document.addEventListener('mousedown', () => {
    const player = world.getEntityById(1)
    if (player) {
      const firing = player.getComponent(FiringComponent)
      if (firing) firing.firing = true
    }
    isFiring = true
  })

  // Handle mouse release to stop firing
  document.addEventListener('mouseup', () => {
    const player = world.getEntityById(1)
    if (player) {
      const firing = player.getComponent(FiringComponent)
      if (firing) firing.firing = false
    }
    isFiring = false
  })

  // Start game loop
  requestAnimationFrame(animate)
}

// ------------------------------
// 🎮 Main Game Loop
// ------------------------------
function animate(currentTime: number) {
  requestAnimationFrame(animate)
  fps.frame()

  // --- Update deltaTime ---
  const player = world.getEntityById(1)
  const time = player?.getComponent(DeltaTimeComponent)
  if (time) time.deltaTime = currentTime

  // --- Death Screen & Respawn Management ---
  const health = player?.getComponent(HealthComponent)?.health
  const alive = player?.getComponent(AliveComponent)?.alive
  const meshComp = player?.getComponent(MeshComponent)

  // Handle player respawn if requested
  if (respawnRequested && player) {
    const spawnPositions = [
      { x: 0, y: 1.6, z: 0 },
      { x: 0, y: 1.6, z: -5 },
      { x: 5, y: 1.6, z: 0 },
      { x: -5, y: 1.6, z: 0 },
      { x: 0, y: 1.6, z: 5 },
      { x: 5, y: 1.6, z: 5 },
      { x: -5, y: 1.6, z: -5 },
      { x: 5, y: 1.6, z: -5 },
      { x: -5, y: 1.6, z: 5 },
    ]
    const spawn = spawnPositions[Math.floor(Math.random() * spawnPositions.length)]
    const pos = player.getComponent(PositionComponent)
    if (pos) {
      pos.x = spawn.x
      pos.y = spawn.y
      pos.z = spawn.z
    }
    const healthComp = player.getComponent(HealthComponent)
    if (healthComp) healthComp.health = 100
    const aliveComp = player.getComponent(AliveComponent)
    if (aliveComp) aliveComp.alive = true

    respawnRequested = false
    hideDeathScreen()
  }

  // Show or hide death screen based on alive/health
  if (alive === false || (typeof health === 'number' && health <= 0)) {
    showDeathScreen()
    world.gameState.gameOver = true
  } else {
    hideDeathScreen()
    world.gameState.gameOver = false
  }

  // --- Change Player Appearance Based on Health ---
  if (meshComp && meshComp.mesh && meshComp.mesh.material) {
    const mat = meshComp.mesh.material as THREE.MeshStandardMaterial

    if (alive === false || (typeof health === 'number' && health <= 0)) {
      mat.color.set('#888888') // Gray for dead
    } else if (typeof health === 'number' && health <= 50 && !playerHalfHealthApplied) {
      if (!playerOriginalColor) playerOriginalColor = mat.color.clone()
      mat.color.set('#b22222') // Firebrick red for low health
      playerHalfHealthApplied = true
    } else if (typeof health === 'number' && health > 50 && playerHalfHealthApplied) {
      if (playerOriginalColor) mat.color.copy(playerOriginalColor)
      playerHalfHealthApplied = false
    } else if (typeof health === 'number' && health > 0 && playerOriginalColor) {
      mat.color.copy(playerOriginalColor)
    }
  }

  // --- Main Gameplay ---
  if (!world.gameState.gameOver && player) {
    physicsSystem.update(time?.deltaTime || 16)
    updateMovement(player, time?.deltaTime || 16)
    renderEnemies(world)
    sendInput(world)
  }

  // --- Handle Bullet Firing ---
  if (isFiring) {
    const now = performance.now()
    if (now - lastBulletTime > BULLET_FIRE_INTERVAL) {
      spawnBulletFromCamera()
      lastBulletTime = now
    }
  }

  // Update bullets and render the scene
  animateBullets()
  renderer.render(scene, camera)
}
