'use client';

/**
 * Script en línea que se ejecuta al cargar el HTML (antes del primer pintado).
 *
 * Es un Client Component para que `typeof window` se evalúe también en el navegador
 * (desde un Server Component el valor quedaría fijado en el payload del servidor).
 * En el servidor se emite como `text/javascript`; en el cliente como `text/plain`,
 * así React no intenta renderizar un <script> ejecutable y no muestra el aviso
 * "Encountered a script tag while rendering React component". Patrón recomendado
 * por Next.js (guía "Preventing flash before hydration").
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
