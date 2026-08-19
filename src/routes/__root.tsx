import {
	HeadContent,
	Scripts,
	createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import Footer from "../components/Footer";
import Header from "../components/Header";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";

import { TooltipProvider } from "../components/ui/tooltip";

import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { RegisterSW } from "../components/register-sw";
import { sessionQueryOptions } from "../lib/auth/session";

interface MyRouterContext {
	queryClient: QueryClient;
	// Resolves once the persisted Query cache has been restored on the client (a
	// no-op on the server). Awaited in beforeLoad so an offline boot reads cached
	// data before any query runs. See integrations/tanstack-query/persister.
	restore: Promise<void>;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
	// Resolved before any route component renders (on the server during SSR),
	// so child routes can guard without a client-side flash.
	beforeLoad: async ({ context }) => {
		// Wait for the persisted cache to load before the first query runs, so an
		// offline boot resolves the session (and everything else) from cache instead
		// of hitting an unreachable network. Instant once resolved / on the server.
		await context.restore;
		const session = await context.queryClient.ensureQueryData(
			sessionQueryOptions,
		);
		return { session };
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Denarii",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "manifest",
				href: "/manifest.webmanifest",
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)] ">
				{/* <Header /> */}
				<TooltipProvider>{children}</TooltipProvider>
				<Toaster />
				<RegisterSW />
				{/* <Footer /> */}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
