import { createFileRoute } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";
import Silk from "@/components/Silk";
import { SignupForm } from "@/components/signup-form";

export const Route = createFileRoute("/(auth)/signup")({
	component: SignUpPage,
});

function SignUpPage() {
	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<BrandMark expanded autoPlay size={38} />
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs">
						<SignupForm />
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
