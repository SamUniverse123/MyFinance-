import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoginForm } from "@/components/login-form";
import Silk from "@/components/Silk";
import { authClient } from "#/lib/auth/auth-client";

export const Route = createFileRoute("/(auth)/login")({
	component: LoginPage,
});

function LoginPage() {
	const navigate = useNavigate()
	const { data: session  } = authClient.useSession()

	if(session){
		navigate( { to : "/dashboard"})
	}

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<a href="#" className="flex items-center gap-2 font-medium"></a>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<LoginForm />
					</div>
				</div>
			</div>
			<div className="relative hidden bg-muted lg:block">
				<div className="absolute inset-0">
					<Silk
						speed={4.1}
						scale={0.9}
						color="#94a3b8"
						noiseIntensity={2.4}
						rotation={6.28}
					/>
				</div>
			</div>
		</div>
	);
}
