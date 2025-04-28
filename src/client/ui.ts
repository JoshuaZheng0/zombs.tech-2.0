/**
 * Placeholder function for setting up UI elements (e.g., HUD, health bars).
 * Currently unused but ready for future expansion.
 */
export function createUI() {
  // Placeholder for UI creation logic
}

/**
 * Shows the death screen overlay.
 * - Displays a semi-transparent black background
 * - Creates a "Respawn" button if it doesn't already exist
 */
export function showDeathScreen() {
  const deathScreen = document.getElementById('death-screen');
  if (deathScreen) {
    deathScreen.style.display = 'flex'; // Flex layout centers content

    // Create a "Respawn" button dynamically if it doesn't exist yet
    if (!document.getElementById('respawn-btn')) {
      const btn = document.createElement('button');
      btn.id = 'respawn-btn';
      btn.textContent = 'Respawn';
      btn.style.marginTop = '2em';
      btn.style.fontSize = '1em';

      btn.onclick = () => {
        // ⚡ NOTE: Setting respawnRequested to true should happen in main logic, not here
        deathScreen.style.display = 'none'; // Hide the death screen immediately after clicking
      };

      deathScreen.appendChild(btn);
    }
  }
}

/**
 * Hides the death screen overlay.
 * - Sets display to 'none' to remove it visually from the screen
 */
export function hideDeathScreen() {
  const deathScreen = document.getElementById('death-screen');
  if (deathScreen) deathScreen.style.display = 'none';
}
