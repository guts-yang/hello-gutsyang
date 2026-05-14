import Link from 'next/link';

const ASCII = String.raw`
  __  __  ___  _  _
 |  \/  |/ _ \| || |
 | |\/| | | | | || |_
 | |  | | |_| |__   _|
 |_|  |_|\___/   |_|
`;

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="space-y-6">
        <pre className="font-mono text-xs sm:text-sm text-gradient">{ASCII}</pre>
        <h1 className="display-headline text-3xl">页面走丢了 · Page lost in the aurora</h1>
        <p className="text-sm text-muted-foreground">
          把这里的极光当作迷雾，回首页吧。 / Treat the aurora as fog, and head back home.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 px-5 py-2 text-sm font-medium backdrop-blur-md hover:-translate-y-0.5 transition-transform"
        >
          返回首页 · Back home
        </Link>
      </div>
    </div>
  );
}
