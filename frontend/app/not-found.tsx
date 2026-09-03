import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 text-center">
      <div className="glass-strong rounded-3xl p-10 max-w-md w-full">
        <div className="text-6xl font-semibold text-gradient mb-3">404</div>
        <h1 className="text-xl font-semibold text-slate-100 mb-2">This page took a wrong loop</h1>
        <p className="text-slate-500 text-sm mb-7">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/chat"
            className="px-5 py-2.5 rounded-xl text-white bg-[#c96442] hover:bg-[#b5593a] transition text-sm font-medium"
          >
            Go to chat
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl glass hover:bg-white/[0.06] transition text-sm font-medium text-slate-200"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  )
}
