import { redirect } from 'next/navigation';

// /admin/requests now lives at /admin/approvals (unified Requests page)
export default function RequestsRedirectPage() {
  redirect('/admin/approvals');
}
