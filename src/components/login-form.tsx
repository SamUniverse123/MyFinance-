import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSeparator,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import * as z from "zod";
import { authClient } from "#/lib/auth/auth-client";
import { Spinner } from "@/components/ui/spinner"
import { SocialAuthButtons } from "./auth/social-auth-buttons";
import { PasswordInput } from "./ui/password-input";
import { useState } from "react";
import { ForgotPasswordForm } from "./auth/forgot-password-form";
import { sessionQueryKey } from "#/lib/auth/session";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";


export const loginSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

type loginForm = z.infer<typeof loginSchema>;




export function LoginForm({
	className,
	...props
}: React.ComponentProps<"form">) {
	const [changePasswordState, setChangePassword] = useState<boolean>(false)
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const router = useRouter()

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onSubmit: loginSchema,
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email({
				...value,
				rememberMe: true,
				callbackURL: "/dashboard",
			},{
        
        onError: (ctx) => {
            toast.error(ctx.error.message || "cannot log in")
        },
		 onSuccess: async () => {
			queryClient.removeQueries({ queryKey: sessionQueryKey });
			await router.invalidate();
			await navigate({ to: "/dashboard" });
  },
});
		},

    

	});


		if(changePasswordState){
			return <ForgotPasswordForm   setChangePassword={setChangePassword}/>
		}

	return (
		<form
			className={cn("flex flex-col gap-6", className)}
			{...props}
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<FieldGroup>
				<div className="flex flex-col items-center gap-1 text-center">
					<h1 className="text-2xl font-bold mb-8">Welcome Back!</h1>
					{/* <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p> */}
				</div>

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
									<a
										href="#"
										onClick={async () => {
											setChangePassword(true)

										}}
										className="ml-auto text-sm underline-offset-4 hover:underline"
									>
										Forgot your password?
									</a>
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

								{isInvalid && <FieldError errors={field.state.meta.errors} />}
							</Field>
						);
					}}
				/>
				
				<form.Subscribe selector={(state) => state.isSubmitting}>
				{(isSubmitting) => (
					<Field>
						<Button type="submit" disabled={isSubmitting} >{isSubmitting ? <Spinner/> : "Login" }</Button>
					</Field>
				)}
				</form.Subscribe>
				
				<FieldSeparator>Or continue with</FieldSeparator>
				<Field>
					<SocialAuthButtons  />

					<FieldDescription className="text-center">
						Don&apos;t have an account?{" "}
						<a href="/signup" className="underline underline-offset-4">
							Sign up
						</a>
					</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
	);
}
