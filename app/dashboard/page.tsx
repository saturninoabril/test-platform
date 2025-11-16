import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import AuthButton from '@/components/auth-button';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AuthButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow border dark:border-gray-700">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            Welcome, {session.user.name || session.user.email}!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You are successfully authenticated and can access protected content.
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
              <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">User Info</h3>
              <dl className="space-y-1 text-sm">
                <div>
                  <dt className="inline font-medium text-gray-700 dark:text-gray-300">Email:</dt>
                  <dd className="inline ml-2 text-gray-600 dark:text-gray-400">
                    {session.user.email}
                  </dd>
                </div>
                {session.user.name && (
                  <div>
                    <dt className="inline font-medium text-gray-700 dark:text-gray-300">Name:</dt>
                    <dd className="inline ml-2 text-gray-600 dark:text-gray-400">
                      {session.user.name}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
              <h3 className="mb-2 font-medium text-blue-900 dark:text-blue-300">API Example</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
                Try accessing the protected API endpoint:
              </p>
              <code className="block rounded bg-blue-100 dark:bg-blue-900/40 p-2 text-xs text-blue-900 dark:text-blue-300">
                GET /api/protected
              </code>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
