import { useEffect, type ReactNode } from 'react';
import { createGlassScene, type GlassScene } from '@glass-sdk/liquid-glass';

type Props = { children: ReactNode };

function supportsGlassWorker(): boolean {
  if (typeof window === 'undefined' || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

export function GlassEnhancer({ children }: Props) {
  useEffect(() => {
    const root = document.documentElement;
    const reducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)');
    if (reducedTransparency.matches || !supportsGlassWorker()) return;

    let scene: GlassScene | null = null;
    let disposed = false;
    let edgeElements: HTMLElement[] = [];

    const mount = () => {
      if (disposed || scene) return;
      const topbar = document.querySelector<HTMLElement>('.nf-app-topbar');
      const dock = document.querySelector<HTMLElement>('.nf-app-nav');
      if (!topbar || !dock) return;

      try {
        scene = createGlassScene({
          root: document.body,
          appearance: root.dataset.theme === 'dark' ? 'dark' : 'light',
          material: 'regular',
          adaptive: true,
          specular: false,
        });

        const topEdge = document.createElement('span');
        topEdge.className = 'nf-lg-progressive-edge nf-lg-progressive-edge--topbar';
        topEdge.setAttribute('aria-hidden', 'true');
        topbar.append(topEdge);

        const dockEdge = document.createElement('span');
        dockEdge.className = 'nf-lg-progressive-edge nf-lg-progressive-edge--dock';
        dockEdge.setAttribute('aria-hidden', 'true');
        dock.append(dockEdge);

        scene.addSurface(topbar, { material: 'regular', tint: 'var(--lg-pharmacy-tint)', adaptive: true, radius: 0, specular: false });
        scene.addSurface(dock, { material: 'regular', tint: 'var(--lg-pharmacy-tint)', adaptive: true, radius: 0, specular: false });
        scene.addSurface(topEdge, { edge: 'bottom', adaptive: false, radius: 0 });
        scene.addSurface(dockEdge, { edge: 'top', adaptive: false, radius: 0 });
        edgeElements = [topEdge, dockEdge];
        root.dataset.lgGlass = 'ready';
        scene.invalidate();
        scene.requestFrame();
      } catch {
        scene?.destroy();
        scene = null;
        edgeElements.forEach((element) => element.remove());
        edgeElements = [];
        root.dataset.lgGlass = 'fallback';
      }
    };

    const themeObserver = new MutationObserver(() => {
      scene?.configure({ appearance: root.dataset.theme === 'dark' ? 'dark' : 'light' });
      scene?.requestFrame();
    });
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    const frame = window.requestAnimationFrame(mount);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      themeObserver.disconnect();
      edgeElements.forEach((element) => element.remove());
      scene?.destroy();
      delete root.dataset.lgGlass;
    };
  }, []);

  return <>{children}</>;
}
