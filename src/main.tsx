try {
  const originalFetch = window.fetch || globalThis.fetch;
  if (originalFetch) {
    let currentFetch = originalFetch;
    let patchSuccess = false;

    try {
      Object.defineProperty(window, 'fetch', {
        get: () => currentFetch,
        set: (val) => { currentFetch = val; },
        configurable: true,
        enumerable: true
      });
      patchSuccess = true;
    } catch (e) {}

    if (!patchSuccess) {
      try {
        Object.defineProperty(Window.prototype, 'fetch', {
          get: () => currentFetch,
          set: (val) => { currentFetch = val; },
          configurable: true,
          enumerable: true
        });
        patchSuccess = true;
      } catch (e) {}
    }

    if (!patchSuccess) {
      try {
        Object.defineProperty(globalThis, 'fetch', {
          get: () => currentFetch,
          set: (val) => { currentFetch = val; },
          configurable: true,
          enumerable: true
        });
      } catch (e) {}
    }
  }
} catch (err) {
  console.warn("Could not redefine window.fetch in main.tsx:", err);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { initWellboreEngine } from './lib/wellboreEngine';
import './index.css';

async function bootstrap() {
  await initWellboreEngine();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

bootstrap();
