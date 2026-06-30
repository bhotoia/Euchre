// main.js — bootstrap + menu routing.
import { openModeMenu, bindUI } from './ui.js';

bindUI();

// Mode buttons open that mode's submenu (Resume / New + per-mode settings).
// Tournaments has its own hub and is wired in ui.js.
document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => openModeMenu(btn.dataset.mode));
});
