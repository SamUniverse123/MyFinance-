import { BetterAuthActionButton } from "@/components/auth/better-auth-action-button"
import { authClient } from "#/lib/auth/auth-client"
import {
  SUPPORTED_OAUTH_PROVIDERS,
  SUPPORTED_OAUTH_PROVIDERS_DETAILS,
} from "#/lib/auth/o-auth-providers"

export function SocialAuthButtons( ) {

  return SUPPORTED_OAUTH_PROVIDERS.map(provider => {
    const Icon = SUPPORTED_OAUTH_PROVIDERS_DETAILS[provider].icon
    
    return (
      <BetterAuthActionButton
        variant="outline"
        key={provider}
        action={() => {
          return authClient.signIn.social({
            provider,
            callbackURL: "/dashboard",
          })
        }}
      >
        <Icon />
        { "continue with " + SUPPORTED_OAUTH_PROVIDERS_DETAILS[provider].name }
      </BetterAuthActionButton>
    )
  })
}