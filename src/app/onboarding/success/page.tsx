import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { getWorkspaceById } from '@/lib/pricing'

export default async function OnboardingSuccessPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await props.searchParams
  const workspaceId = Array.isArray(params.workspace) ? params.workspace[0] : params.workspace
  const workspace = workspaceId ? getWorkspaceById(workspaceId) : null

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-950">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Workspace billing is ready</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {workspace ? `${workspace.name} is selected for your TASKIT account.` : 'Your TASKIT workspace selection has been saved.'}
        </p>
        <Link
          href="/account/billing"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-slate-950 px-5 text-sm font-bold text-white"
        >
          Open billing
        </Link>
      </section>
    </main>
  )
}
