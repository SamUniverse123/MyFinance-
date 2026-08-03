import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { BetterAuthActionButton } from "../better-auth-action-button";
import { useEffect, useRef, useState } from "react";
import { authClient } from "#/lib/auth/auth-client";
import { MailCheck } from "lucide-react";

const VerifyEmail = ({ email }: { email: string }) => {
	const [timeToNextResend, setTimeToNextResend] = useState(30)
	const interval = useRef<NodeJS.Timeout>(undefined)

	useEffect(() => {
		startEmailVerificationCountdown()
	}, [])

	function startEmailVerificationCountdown(time = 30) {
		setTimeToNextResend(time)

		clearInterval(interval.current)
		interval.current = setInterval(() => {
			setTimeToNextResend(t => {
				const newT = t - 1

				if (newT <= 0) {
					clearInterval(interval.current)
					return 0
				}
				return newT
			})
		}, 1000)
	}
	return (
		<FieldGroup>
			<div className="flex flex-col items-center gap-1 text-center">
				<MailCheck className="mb-2 size-8 text-muted-foreground" />
				<h1 className="text-2xl font-bold">Verify your email</h1>
				<p className="text-sm text-balance text-muted-foreground">
					An activation link has been sent to {email}. Please check your
					inbox and click on the link to complete the activation process.
				</p>
			</div>
			<Field className="gap-4">
				<BetterAuthActionButton
					variant="outline"
					className="w-full"
					successMessage="Verification email sent!"
					disabled={timeToNextResend > 0}
					action={() => {
						startEmailVerificationCountdown()
						return authClient.sendVerificationEmail({
							email,
							callbackURL: "/login",
						})
					}}
				>
					{timeToNextResend > 0
						? `Resend Email (${timeToNextResend})`
						: "Resend Email"}
				</BetterAuthActionButton>
				<FieldDescription className="text-center text-sm font-normal text-muted-foreground">
					Didn&apos;t get the email?{" "}
					<a
						href="#"
						className="font-medium text-card-foreground no-underline!"
					>
						Resend
					</a>
				</FieldDescription>
			</Field>
		</FieldGroup>
	);
};

export default VerifyEmail;
