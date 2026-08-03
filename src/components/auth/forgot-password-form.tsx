import { useForm } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import * as z from "zod";
import { authClient } from "#/lib/auth/auth-client";
import { Button } from "@/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils.ts";
import type { Dispatch, SetStateAction } from "react";

export const forgotPasswordSchema = z.object({
	email: z.email("Invalid email address"),
});

export function ForgotPasswordForm({
	setChangePassword,
	className,
	...props
}: React.ComponentProps<"div"> & {setChangePassword : React.Dispatch<SetStateAction<boolean>>})  {
	const form = useForm({
		defaultValues: {
			email: "",
		},
		validators: {
			onSubmit: forgotPasswordSchema,
		},
		onSubmit: async ({ value }) => {
			const res = await authClient.requestPasswordReset(
				{
					email: value.email,
					redirectTo: "/reset-password",
				},
				{
					onError: (ctx) => {
						toast.error(ctx.error.message || "Could not send reset email");
					},
				},
			);

			if (res.error == null) {
				toast.success("Password reset email sent");
			}
		},
	});

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>Forgot Password</CardTitle>
					<CardDescription>
						Enter your email and we&apos;ll send you a link to reset your
						password.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							form.handleSubmit();
						}}
					>
						<FieldGroup>
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
												type="email"
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												placeholder="Email Address"
												autoComplete="email"
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>

							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Field>
										<Button type="submit" disabled={isSubmitting}>
											{isSubmitting ? <Spinner /> : "Send Email"}
										</Button>
									</Field>
								)}
							</form.Subscribe>

							<Field>
								<Button variant="outline" onClick={() => setChangePassword(false)} >
										Back to Login
								</Button>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
