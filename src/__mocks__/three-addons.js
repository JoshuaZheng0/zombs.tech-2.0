export const PointerLockControls = jest.fn().mockImplementation(() => ({
  isLocked: false,
  lock: jest.fn(),
  unlock: jest.fn(),
  getDirection: jest.fn(),
  moveRight: jest.fn(),
  moveForward: jest.fn(),
  dispose: jest.fn(),
})); 