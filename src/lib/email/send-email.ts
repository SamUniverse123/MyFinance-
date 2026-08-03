import { Resend } from "resend";
import { env } from "@/env";

const resend = new Resend(env.RESEND_API_KEY);

const DEFAULT_FROM = env.EMAIL_FROM ?? "Acme <onboarding@resend.dev>";

type SendEmailParams = {
	to: string | string[];
	subject: string;
	replyTo?: string | string[];
} & ({ html: string; text?: string } | { html?: string; text: string });

export async function sendEmail(params: SendEmailParams) {
	const { data, error } = await resend.emails.send({
		from: DEFAULT_FROM,
		...params,
	});

	if (error) {
		console.error(error);
		throw new Error(error.message);
	}

	return data;
}
