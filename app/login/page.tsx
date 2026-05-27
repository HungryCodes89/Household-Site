import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string }
}) {
  return <LoginForm nextPath={searchParams.next ?? '/dashboard'} initialError={searchParams.error} />
}
