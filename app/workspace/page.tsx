import type { Metadata } from 'next'
import { CustomerWorkspace } from '@/components/workspace/customer-workspace'

export const metadata: Metadata = { title: 'My Workspace', robots: { index: false, follow: false } }
export default function WorkspacePage() { return <CustomerWorkspace /> }
