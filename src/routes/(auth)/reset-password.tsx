import { ChangePasswordForm } from '#/components/auth/change-password-form'
import { createFileRoute } from '@tanstack/react-router'
import * as z from 'zod'

const resetPasswordSearchSchema = z.object({
  token: z.string(),
})

export const Route = createFileRoute('/(auth)/reset-password')({
    validateSearch: resetPasswordSearchSchema,
    component: ResetPassword,
})

function ResetPassword() {
    const { token } = Route.useSearch()
  return (
    <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs">
        <ChangePasswordForm token={token}/>
      </div>
    </div>
  )
}
