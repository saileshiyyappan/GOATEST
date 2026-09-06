/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CribPage } from './components/CribPage';

export default function App() {
  const handleExitToHome = () => {
    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer || '';
    const currentOrigin = window.location.origin;
    const enteredFromHome =
      params.get('returnTo') === 'home' ||
      referrer.startsWith(`${currentOrigin}/home`) ||
      referrer.startsWith('http://localhost:3000/home') ||
      referrer.startsWith('http://localhost:3000/');

    if (enteredFromHome && window.history.length > 1) {
      window.history.back();
      return;
    }

    window.history.pushState({}, '', '/home');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="w-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-neutral-950 flex flex-col">
      <CribPage onExitToHome={handleExitToHome} />
    </div>
  );
}
