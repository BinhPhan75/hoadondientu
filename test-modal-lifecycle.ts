import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost:3000' });
(globalThis as any).window = window;
(globalThis as any).document = window.document;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).customElements = window.customElements;
(globalThis as any).sessionStorage = window.sessionStorage;
(globalThis as any).localStorage = window.localStorage;
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    writable: true,
    configurable: true
  });
} catch {}

const origFetch = globalThis.fetch;
globalThis.fetch = (input: any, init?: any) => {
  if (typeof input === 'string' && input.startsWith('/')) {
    input = `http://localhost:3000${input}`;
  }
  return origFetch(input, init);
};
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';
import { ErrorBoundary } from './src/components/ErrorBoundary';

async function run() {
  console.log('--- Starting Happy-DOM React Lifecycle Test ---');
  const container = window.document.createElement('div');
  window.document.body.appendChild(container);

  let capturedError: any = null;
  window.addEventListener('error', (event) => {
    console.error('Window error event:', event.error);
    capturedError = event.error;
  });

  const root = createRoot(container);
  
  root.render(
    React.createElement(
      ErrorBoundary,
      null,
      React.createElement(App, null)
    )
  );

  // Wait for initial render
  await new Promise((r) => setTimeout(r, 500));
  console.log('Rendered App. Checking for invoice rows...');

  const rows = window.document.querySelectorAll('tbody tr');
  console.log('Found rows:', rows.length);

  for (let i = 0; i < rows.length; i++) {
    console.log(`\n--- Testing row ${i} ---`);
    const row = window.document.querySelectorAll('tbody tr')[i] as any;
    if (!row) continue;
    row.click();

    // Wait for modal to mount
    await new Promise((r) => setTimeout(r, 400));
    
    // Look for close button
    const closeButtons = window.document.querySelectorAll('button[title="Đóng cửa sổ"]');
    if (closeButtons.length > 0) {
      (closeButtons[0] as any).click();

      // Wait for re-render after close
      await new Promise((r) => setTimeout(r, 600));
      
      const errorHeading = window.document.querySelector('h2');
      if (errorHeading && errorHeading.textContent?.includes('Đã xảy ra lỗi')) {
        console.error(`ERROR BOUNDARY TRIGGERED on row ${i}! Text:`, errorHeading.textContent);
        const pre = window.document.querySelector('pre');
        console.error('Error detail:', pre?.textContent);
      } else {
        console.log(`Row ${i} closed successfully.`);
      }
    } else {
      console.log(`No close button found on row ${i}.`);
    }
  }

  if (capturedError) {
    console.error('Captured window error:', capturedError);
  }
  
  console.log('Test finished.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal in test script:', err);
  process.exit(1);
});
