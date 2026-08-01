import { Google, Apple, Facebook } from "@/components/ui/socialProviderButton"
import type { ComponentProps, ElementType } from "react";

 
export const SUPPORTED_OAUTH_PROVIDERS = ["google", "apple", "facebook"] as const

export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number]


export const SUPPORTED_OAUTH_PROVIDERS_DETAILS : Record<SupportedOAuthProvider, {name: string; icon: ElementType<ComponentProps<"svg">>}> = {
    google :{ name:"Google", icon: Google},
    apple :{ name:"Apple", icon: Apple},
    facebook :{ name:"Facebook", icon: Facebook},
}