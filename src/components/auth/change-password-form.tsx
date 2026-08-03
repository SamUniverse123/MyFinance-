import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field.tsx";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import * as z from "zod";
import { authClient } from "#/lib/auth/auth-client";
import { Spinner } from "@/components/ui/spinner";
import {
	PasswordInput,
	PasswordInputStrengthChecker,
} from "@/components/ui/password-input.tsx";
import { useNavigate } from "@tanstack/react-router";



export const changePasswordSchema = z
	.object({
		currentPassword: z.string(),
		newPassword: z.string().min(8, "Must be at least 8 characters long"),
		confirm_new_password: z.string().min(1, "Please confirm your new password"),
		revokeOtherSessions: z.boolean(),
	})
	.superRefine((data, ctx) => {
		if (!data.currentPassword) {
			ctx.addIssue({
				code: "custom",
				message: "Current password is required",
				path: ["currentPassword"],
			});
		}
		if (data.newPassword !== data.confirm_new_password) {
			ctx.addIssue({
				code: "custom",
				message: "Passwords do not match",
				path: ["confirm_new_password"],
			});
		}
	});

export const resetPasswordSchema = z
	.object({
		currentPassword: z.string(),
		newPassword: z.string().min(8, "Must be at least 8 characters long"),
		confirm_new_password: z.string().min(1, "Please confirm your new password"),
		revokeOtherSessions: z.boolean(),
	})
	.refine((data) => data.newPassword === data.confirm_new_password, {
		message: "Passwords do not match",
		path: ["confirm_new_password"],
	});

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm({
	token,
	className,
	...props
}: React.ComponentProps<"div"> & { token?: string }) {
	const navigate = useNavigate()
	const isReset = token != null;

	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirm_new_password: "",
			revokeOtherSessions: false as boolean,
		},
		validators: {
			onSubmit: isReset ? resetPasswordSchema : changePasswordSchema,
		},
		onSubmit: async ({ value, formApi }) => {
			const res = isReset
				? await authClient.resetPassword(
						{
							newPassword: value.newPassword,
							token,
						},
						{
							onError: (ctx) => {
								toast.error(ctx.error.message || "Could not reset password");
							},


							onSuccess: () => {
								toast.success("Password reset successful", {
									description: "Redirection to login...",
								})
								setTimeout(()=> navigate({to: "/login"}),1000)
							}
						},
						
					)
				: await authClient.changePassword(
						{
							currentPassword: value.currentPassword,
							newPassword: value.newPassword,
							revokeOtherSessions: value.revokeOtherSessions,
						},
						{
							onError: (ctx) => {
								toast.error(ctx.error.message || "Could not change password");
							},
						},
					);

			if (res.error == null) {
				toast.success(
					isReset ? "Password reset successfully" : "Password changed successfully",
				);
				formApi.reset();
			}
		},
	});

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>{isReset ? "Reset Password" : "Change Password"}</CardTitle>
					<CardDescription>
						{isReset
							? "Choose a new password for your account."
							: "Enter your current password and choose a new one."}
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
							{!isReset && (
								<form.Field
									name="currentPassword"
									children={(field) => {
										const isInvalid =
											field.state.meta.isTouched && !field.state.meta.isValid;
										return (
											<Field data-invalid={isInvalid}>
												<FieldLabel htmlFor={field.name}>
													Current Password
												</FieldLabel>
												<PasswordInput
													id={field.name}
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													aria-invalid={isInvalid}
													placeholder="Current Password"
													autoComplete="current-password"
												/>
												{isInvalid && (
													<FieldError errors={field.state.meta.errors} />
												)}
											</Field>
										);
									}}
								/>
							)}
							<form.Field
								name="newPassword"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>
												New Password
											</FieldLabel>
											<PasswordInput
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												placeholder="New Password"
												autoComplete="new-password"
											>
												<PasswordInputStrengthChecker />
											</PasswordInput>
											{!isInvalid ? (
												<FieldDescription>
													Must be at least 8 characters long
												</FieldDescription>
											) : (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>
							<form.Field
								name="confirm_new_password"
								children={(field) => {
									const isInvalid =
										field.state.meta.isTouched && !field.state.meta.isValid;
									return (
										<Field data-invalid={isInvalid}>
											<FieldLabel htmlFor={field.name}>
												Confirm New Password
											</FieldLabel>
											<PasswordInput
												id={field.name}
												name={field.name}
												value={field.state.value}
												onBlur={field.handleBlur}
												onChange={(e) => field.handleChange(e.target.value)}
												aria-invalid={isInvalid}
												placeholder="Confirm New Password"
												autoComplete="new-password"
											/>
											{isInvalid && (
												<FieldError errors={field.state.meta.errors} />
											)}
										</Field>
									);
								}}
							/>
							{!isReset && (
								<form.Field
									name="revokeOtherSessions"
									children={(field) => (
										<Field orientation="horizontal">
											<Checkbox
												id={field.name}
												name={field.name}
												checked={field.state.value}
												onCheckedChange={(checked) =>
													field.handleChange(checked === true)
												}
											/>
											<FieldContent>
												<FieldLabel htmlFor={field.name} className="font-normal">
													Log out of other devices
												</FieldLabel>
											</FieldContent>
										</Field>
									)}
								/>
							)}

							<form.Subscribe selector={(state) => state.isSubmitting}>
								{(isSubmitting) => (
									<Field>
										<Button type="submit" disabled={isSubmitting}>
											{isSubmitting ? (
												<Spinner />
											) : isReset ? (
												"Reset Password"
											) : (
												"Change Password"
											)}
										</Button>
									</Field>
								)}
							</form.Subscribe>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
