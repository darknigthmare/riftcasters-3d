import { useEffect, useState } from 'react';
import type { GamePhase } from '@/lib/game/types';

export function OfflineStatus({ phase }: { phase: GamePhase }) {
  const [status, setStatus] = useState('');
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (
      !import.meta.env.PROD ||
      !('serviceWorker' in navigator) ||
      location.protocol === 'file:'
    )
      return;
    let disposed = false;
    let updateRequested = false;
    const controllerChanged = () => {
      if (updateRequested) location.reload();
    };
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      controllerChanged,
    );
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none',
        });
        const inspect = () => {
          if (!disposed)
            setWaiting(
              navigator.serviceWorker.controller ? registration.waiting : null,
            );
        };
        inspect();
        registration.addEventListener('updatefound', () =>
          registration.installing?.addEventListener('statechange', inspect),
        );
        await navigator.serviceWorker.ready;
        if (!disposed) setStatus('Hors ligne prêt');
      } catch {
        if (!disposed) setStatus('Mode en ligne uniquement');
      }
    };
    void register();
    const request = () => {
      updateRequested = true;
    };
    window.addEventListener('rift-update-requested', request);
    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        controllerChanged,
      );
      window.removeEventListener('rift-update-requested', request);
    };
  }, []);
  if (phase !== 'menu' && phase !== 'gameover' && phase !== 'victory')
    return null;
  return (
    <output className="offline-status">
      {waiting ? (
        <button
          onClick={() => {
            window.dispatchEvent(new Event('rift-update-requested'));
            waiting.postMessage('ACTIVATE_UPDATE');
          }}
        >
          Nouvelle version prête — recharger
        </button>
      ) : (
        status
      )}
    </output>
  );
}
