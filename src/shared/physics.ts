import * as RAPIER from '@dimforge/rapier3d-compat';
import { Entity } from './entity';
import { PositionComponent, WASDComponent, JumpComponent, AngleComponent } from './components';
import { World } from './world';
import { wallMap } from './wall_map';


export class PhysicsSystem {
  private world: RAPIER.World;
  private rigidBodies: Map<number, RAPIER.RigidBody> = new Map();
  private colliders: Map<number, RAPIER.Collider> = new Map();
  private playerBody: RAPIER.RigidBody | null = null;
  private playerCollider: RAPIER.Collider | null = null;
  private groundCollider: RAPIER.Collider | null = null;
  private gameWorld: World;
  private wallColliders: RAPIER.Collider[] = [];
  private borderColliders: RAPIER.Collider[] = [];
  private characterController: RAPIER.KinematicCharacterController | null = null;




  constructor(gameWorld: World) {
    this.gameWorld = gameWorld;
   
    // Initialize Rapier physics world with gravity
    this.world = new RAPIER.World({ x: 0.0, y: -80, z: 0.0 });
   
    // Create ground collider
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(50.0, 0.1, 50.0);
    this.groundCollider = this.world.createCollider(groundColliderDesc);
   
    // Create wall colliders
    this.createWallColliders();
   
    // Create border colliders
    this.createBorderColliders();
  }


  // Create wall colliders based on the wall map
  private createWallColliders(): void {
    const width = wallMap.length;
    const height = wallMap[0].length;


    for (let x = 0; x < width; x++) {
      for (let z = 0; z < height; z++) {
        if (wallMap[x][z] === 1) { // Wall tile
          // Calculate world position
          const worldX = x - 50;
          const worldZ = z - 50;
         
          // Create a wall collider
          const wallHeight = Math.random() * 1.5 + 4.5; // Same height as in createTerrain
          const wallColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, wallHeight / 2, 0.5);
          wallColliderDesc.setTranslation(worldX, wallHeight / 2, worldZ);
          wallColliderDesc.setFriction(0.01); // Low friction for easy sliding
         
          const wallCollider = this.world.createCollider(wallColliderDesc);
          this.wallColliders.push(wallCollider);
        }
      }
    }
  }


  // Create invisible border colliders at the edge of the map
  private createBorderColliders(): void {
    const borderHeight = 10.0; // Height of the border walls
    const borderThickness = 1.0; // Thickness of the border walls
   
    // Calculate map boundaries
    const minX = -50;
    const maxX = 50;
    const minZ = -50;
    const maxZ = 50;
   
    // Create north border
    const northBorderDesc = RAPIER.ColliderDesc.cuboid((maxX - minX) / 2, borderHeight / 2, borderThickness / 2);
    northBorderDesc.setTranslation(0, borderHeight / 2, maxZ + borderThickness / 2);
    const northBorder = this.world.createCollider(northBorderDesc);
    this.borderColliders.push(northBorder);
   
    // Create south border
    const southBorderDesc = RAPIER.ColliderDesc.cuboid((maxX - minX) / 2, borderHeight / 2, borderThickness / 2);
    southBorderDesc.setTranslation(0, borderHeight / 2, minZ - borderThickness / 2);
    const southBorder = this.world.createCollider(southBorderDesc);
    this.borderColliders.push(southBorder);
   
    // Create east border
    const eastBorderDesc = RAPIER.ColliderDesc.cuboid(borderThickness / 2, borderHeight / 2, (maxZ - minZ) / 2);
    eastBorderDesc.setTranslation(maxX + borderThickness / 2, borderHeight / 2, 0);
    const eastBorder = this.world.createCollider(eastBorderDesc);
    this.borderColliders.push(eastBorder);
   
    // Create west border
    const westBorderDesc = RAPIER.ColliderDesc.cuboid(borderThickness / 2, borderHeight / 2, (maxZ - minZ) / 2);
    westBorderDesc.setTranslation(minX - borderThickness / 2, borderHeight / 2, 0);
    const westBorder = this.world.createCollider(westBorderDesc);
    this.borderColliders.push(westBorder);
  }


  // Initialize player physics
  initPlayer(player: Entity): void {
    const position = player.getComponent(PositionComponent);
    if (!position) return;


    // Create a dynamic rigid body for the player (better for jumping)
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .lockRotations(); // Lock all rotations to keep the player upright
   
    this.playerBody = this.world.createRigidBody(rigidBodyDesc);
   
    // Create a taller capsule collider for the player (radius, half-height)
    // Total height is 2.0 units, with radius 0.5, so half-height is 1.0
    const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 1.0);
    colliderDesc.setFriction(0.01); // Low friction for player
    this.playerCollider = this.world.createCollider(colliderDesc, this.playerBody);
   
    // Create a character controller for better movement and climbing
    this.characterController = this.world.createCharacterController(0.01);
   
    // Store the rigid body and collider
    this.rigidBodies.set(player.id, this.playerBody);
    this.colliders.set(player.id, this.playerCollider);
  }


  // Update physics for all entities
  update(_deltaTime: number): void {
    // Step the physics world
    this.world.step();
   
    // Update player position from physics
    if (this.playerBody) {
      const player = this.gameWorld.getEntityById(1);
      if (player) {
        const position = player.getComponent(PositionComponent);
        if (position) {
          const translation = this.playerBody.translation();
          position.x = translation.x;
          position.y = translation.y;
          position.z = translation.z;
        }
      }
    }
   
    // Update enemy positions from physics
    for (let i = 2; i <= 10; i++) {
      const enemy = this.gameWorld.getEntityById(i);
      if (enemy) {
        const rigidBody = this.rigidBodies.get(i);
        if (rigidBody) {
          const position = enemy.getComponent(PositionComponent);
          if (position) {
            const translation = rigidBody.translation();
            position.x = translation.x;
            position.y = translation.y;
            position.z = translation.z;
          }
        }
      }
    }
  }


  // Apply movement forces to the player
  applyPlayerMovement(player: Entity, _deltaTime: number): void {
    if (!this.playerBody || !this.playerCollider || !this.characterController) return;
   
    const wasd = player.getComponent(WASDComponent);
    const jump = player.getComponent(JumpComponent);
    const position = player.getComponent(PositionComponent);
    const angle = player.getComponent(AngleComponent);
   
    if (!wasd || !position || !angle) return;
   
    // Calculate movement direction based on player's yaw
    const moveSpeed = this.gameWorld.gameState.moveSpeed; // Scale up for physics
    let moveX = 0;
    let moveZ = 0;
   
    // Calculate forward and right vectors based on player's yaw
    const forwardX = Math.sin(angle.yaw);
    const forwardZ = Math.cos(angle.yaw);
    const rightX = Math.sin(angle.yaw + Math.PI / 2);
    const rightZ = Math.cos(angle.yaw + Math.PI / 2);
   
    if (wasd.forward) {
      moveX -= forwardX * moveSpeed;
      moveZ -= forwardZ * moveSpeed;
    }
    if (wasd.backward) {
      moveX += forwardX * moveSpeed;
      moveZ += forwardZ * moveSpeed;
    }
    if (wasd.left) {
      moveX -= rightX * moveSpeed;
      moveZ -= rightZ * moveSpeed;
    }
    if (wasd.right) {
      moveX += rightX * moveSpeed;
      moveZ += rightZ * moveSpeed;
    }
   
    // Check if player is on the ground
    const isOnGround = this.playerBody.translation().y <= 1.61;
   
    // Apply jump force only if player is on the ground
    if (jump && jump.jump && isOnGround) {
      // Apply a strong upward impulse for jumping
      const jumpForce = this.gameWorld.gameState.jumpForce * 2; // Double the jump force
      this.playerBody.applyImpulse({ x: 0, y: jumpForce, z: 0 }, true);
      jump.jump = false;
    }
   
    // Apply horizontal movement using velocity
    const currentVelocity = this.playerBody.linvel();
    this.playerBody.setLinvel({
      x: moveX,
      y: currentVelocity.y, // Keep the current vertical velocity
      z: moveZ
    }, true);
   
    // Use the character controller to handle collisions
    this.characterController.computeColliderMovement(
      this.playerCollider,
      { x: 0, y: 0, z: 0 } // We're using velocity for movement, so no need for character controller movement
    );
  }


  // Clean up physics resources
  cleanup(): void {
    // Clean up all rigid bodies and colliders
    for (const [_id, rigidBody] of this.rigidBodies) {
      this.world.removeRigidBody(rigidBody);
    }
   
    for (const [_id, collider] of this.colliders) {
      this.world.removeCollider(collider, true);
    }
   
    // Clean up wall colliders
    for (const collider of this.wallColliders) {
      this.world.removeCollider(collider, true);
    }
   
    // Clean up border colliders
    for (const collider of this.borderColliders) {
      this.world.removeCollider(collider, true);
    }
   
    // Clean up the ground collider
    if (this.groundCollider) {
      this.world.removeCollider(this.groundCollider, true);
    }
   
    // Clean up the character controller
    if (this.characterController) {
      this.world.removeCharacterController(this.characterController);
    }
  }
}


