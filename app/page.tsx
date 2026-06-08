import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold">SSTDREAM</h1>
      <p className="max-w-md text-neutral-500">
        Draw your app. Simulate it. Export SST. Deploy it yourself.
      </p>
      <Button asChild>
        <Link href="/builder">Open the builder</Link>
      </Button>
    </main>
  );
}
