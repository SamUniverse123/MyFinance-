import { cn } from "@/lib/utils.ts"
import { Button } from "@/components/ui/button.tsx"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field.tsx"
import { Input } from "@/components/ui/input.tsx"
import { authClient } from "#/lib/auth/auth-client";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import * as z from "zod";
import { Google, Apple, Facebook } from "./ui/socialProviderButton";
import { useNavigate } from "@tanstack/react-router";
import { Spinner } from "./ui/spinner";
import { SocialAuthButtons } from "./auth/social-auth-buttons";
import { PasswordInput } from "./ui/password-input";
import VerifyEmail from "./auth/email/verify-email";
import { useState } from "react";


export const signupSchema = z
  .object({
    name: z.string().min(1, "Full name is required"),
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Must be at least 8 characters long"),
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type signupForm = z.infer<typeof signupSchema>;

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const navigate = useNavigate()
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)

const form = useForm({
		defaultValues: {
      		name: "",
			email: "",
			password: "",
      		confirm_password: ""
		},
		validators: {
			onSubmit: signupSchema,
		},
		onSubmit: async ({ value }) => {
			const res = await authClient.signUp.email({
        ...value,
        callbackURL: "/dashboard",

      },{

        onError: (ctx) => {
            toast.error(ctx.error.message || "cannot log in")

        },
});

	if (res.error == null) {
		if (!res.data.user.emailVerified) {
			setPendingVerificationEmail(value.email)
		} else {
			navigate({ to: '/dashboard' })
		}
	}

		},

    

	});

  if (pendingVerificationEmail) {
    return (
      <div className={cn("flex flex-col gap-6", className)}>
        <VerifyEmail email={pendingVerificationEmail} />
      </div>
    )
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}   onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Fill in the form below to create your account
          </p>
        </div>
        <form.Field
                  name="name"
                  children={(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>Full Name</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={isInvalid}
                          placeholder="Full Name"
                          autoComplete="off"
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    );
                  }}
                />
                <form.Field
					name="email"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<FieldLabel htmlFor={field.name}>Email</FieldLabel>
								<Input
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="Email Address"
									autoComplete="off"
								/>
								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				/>
				<form.Field
					name="password"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<div className="flex items-center">
									<FieldLabel htmlFor={field.name}>Password</FieldLabel>
								</div>
								<PasswordInput 
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="Password"
									autoComplete="off"/>
								{!isInvalid ? <FieldDescription>
            Must be at least 8 characters long
          </FieldDescription> : <FieldError errors={field.state.meta.errors} />}
                 
							</Field>
						);
					}}
				/>
        	<form.Field
					name="confirm_password"
					children={(field) => {
						const isInvalid =
							field.state.meta.isTouched && !field.state.meta.isValid;
						return (
							<Field data-invalid={isInvalid}>
								<div className="flex items-center">
									<FieldLabel htmlFor={field.name}>Confirm Password</FieldLabel>
								</div>
								<PasswordInput 
									id={field.name}
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									aria-invalid={isInvalid}
									placeholder="Password"
									autoComplete="off"/>
                 {!isInvalid ? <FieldDescription>
            Please confirm your password.
          </FieldDescription> : <FieldError errors={field.state.meta.errors} />}
                 
							</Field>
						);
					}}
				/>


       <form.Subscribe selector={(state) => state.isSubmitting}>
					{(isSubmitting) => (
						<Field>
							<Button type="submit" disabled={isSubmitting} >{isSubmitting ? <Spinner/> : "Create Account" }</Button>
						</Field>
					)}
					</form.Subscribe>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
         {/* <Button variant="outline" type="button">
						<Google />
						Login with Google
					</Button>
					<Button variant="outline" type="button">
						<Apple />
						Login with Apple
					</Button>
					<Button variant="outline" type="button">
						<Facebook />
						Login with Facebook
					</Button> */}
			<SocialAuthButtons />
			
          <FieldDescription className="px-6 text-center">
            Already have an account? <a href="/login">Sign in</a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
