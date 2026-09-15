import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-black">404</p>
      <p>Página no encontrada · Page not found</p>
      <p className="flex gap-4 font-bold text-[var(--accent)]">
        <Link href="/es">Inicio</Link>
        <Link href="/en">Home</Link>
      </p>
    </main>
  );
}
