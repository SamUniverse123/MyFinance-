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
import { Google, Apple, Facebook } from "./ui/socialProviderButton";
import { authClient } from "#/lib/auth/auth-client";
import { Spinner } from "@/components/ui/spinner"
import { SocialAuthButtons } from "./auth/social-auth-buttons";
import { PasswordInput } from "./ui/password-input";


export const loginSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

type loginForm = z.infer<typeof loginSchema>;




export function LoginForm({
	className,
	...props
}: React.ComponentProps<"form">) {
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
				callbackURL: "/",
			},{
        
        onError: (ctx) => {
            toast.error(ctx.error.message || "cannot log in")
        },
});
		},

    

	});

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
					<h1 className="text-2xl font-bold mb-8">Login to your account</h1>
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
						<a href="#" className="underline underline-offset-4">
							Sign up
						</a>
					</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
	);
}
