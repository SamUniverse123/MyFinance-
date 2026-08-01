import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),

	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
	},

// 	emailVerification: {
//     autoSignInAfterVerification: true,
//     sendOnSignUp: true,
//     sendVerificationEmail: async ({ user, url }) => {
//       await sendEmailVerificationEmail({ user, url })
//     },
//   },



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


	session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // Cache duration in seconds
    	}


	
	},

	plugins: [tanstackStartCookies()],
});
