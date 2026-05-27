import EmsSidebar from '@/components/ems/EmsSidebar'

export default function EmsLayout({ children }: { children: React.ReactNode }) {
  return <EmsSidebar>{children}</EmsSidebar>
}
