import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && (target.isContentEditable || target.closest('[contenteditable="true"], [contenteditable=""]') !== null));
}

document.addEventListener('contextmenu', (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault();
});

document.addEventListener('dragstart', (event) => {
  if (!isEditableTarget(event.target)) event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
