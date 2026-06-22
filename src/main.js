import { AppState } from './core/AppState.js';

const canvas = document.getElementById('scene');
const uiRoot = document.getElementById('ui');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');

const app = new AppState(canvas, uiRoot);

function begin() {
  // Unlock audio (must happen inside a user gesture) and start the game.
  app.audio.init();
  startScreen.classList.add('hidden');
  app.start();

  // Show a pinch-to-zoom hint on touch-capable devices, then fade it out.
  if (navigator.maxTouchPoints > 0) {
    const hint = document.getElementById('zoom-hint');
    if (hint) {
      hint.style.display = 'block';
      setTimeout(() => hint.classList.add('hidden'), 3500);
    }
  }
}

startButton.addEventListener('click', begin, { once: true });
