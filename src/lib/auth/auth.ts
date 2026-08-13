import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { sendEmailVerificationEmail } from "@/lib/email/email-validation";
import { sendResetPasswordEmail } from "../email/reset-password-email";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,

    sendResetPassword: async ({ user, url, token }, request) => {
            await sendResetPasswordEmail({ user, url })
          }
	},

	emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmailVerificationEmail({ user, url })
    },
  },



	socialProviders:{
		
		google: { 
            clientId: process.env.GOOGLE_CLIENT_ID as string, 
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string, 
        },
	},

	account: {
        accountLinking: {
            enabled: true,
        }
    },

	// ADR-0002: every user gets their own copy of the system categories — there's no
	// global row, since `categories.userId` is required.
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					await db.insert(categories).values({
						userId: user.id,
						name: "Balance Adjustment",
						kind: "expense",
						isSystem: true,
					});
				},
			},
		},
	},


	session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
    	}


	
	},

	plugins: [tanstackStartCookies()],
});

