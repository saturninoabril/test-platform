import { auth, signOut } from '@/auth';
import Link from 'next/link';

export default async function AuthButton() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700">{session.user.email || session.user.name}</span>
        <form
          action={async () => {
            'use server';
            await signOut();
          }}
        >
          <button
            type="submit"
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
          >
            Sign out
          </button>
        </form>
      </div>
    );
  }

  return (
    <Link
      href="/auth/signin"
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
    >
      Sign in
    </Link>
  );
}
