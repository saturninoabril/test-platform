import Link from 'next/link';
import AuthButton from '@/components/auth-button';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-12 px-8 bg-white dark:bg-black">
        <div className="absolute top-8 right-8 flex items-center gap-2">
          <ThemeToggle />
          <AuthButton />
        </div>

        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-6xl font-bold tracking-tight text-black dark:text-zinc-50">
            Test Platform
          </h1>
          <p className="text-xl leading-relaxed text-zinc-600 dark:text-zinc-400">
            Your testing hub. Ship with confidence.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/test-reports">View Test Reports</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
