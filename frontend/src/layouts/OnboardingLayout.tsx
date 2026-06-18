import type { ReactNode } from 'react';
import Logo from '@components/common/Logo';
import ProgressBar from '@components/common/ProgressBar';
import { Check } from 'lucide-react';

interface SidebarContent {
	heading: string;
	description: string;
	bullets: readonly string[];
}

interface OnboardingLayoutProps {
	children: ReactNode;
	sidebar: SidebarContent;
	currentStep: number;
	totalSteps: number;
}

const OnboardingLayout = ({
	children,
	sidebar,
	currentStep,
	totalSteps,
}: OnboardingLayoutProps) => {
	return (
		<div className="min-h-screen bg-surface-muted flex items-center justify-center p-4">
			<div className="bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col lg:flex-row w-full max-w-6xl min-h-[85vh]">
				{/* ── Left Sidebar ── */}
				<div className="w-full lg:w-2/5 bg-linear-to-br from-tealbrand-dark to-tealbrand text-white p-8 lg:p-12 flex flex-col justify-between">
					<div>
						{/* Logo */}
						<div className="mb-10">
							<Logo className="brightness-0 invert" />
						</div>

						{/* Heading */}
						<h2 className="text-3xl lg:text-4xl font-bold mb-4 whitespace-pre-line leading-tight">
							{sidebar.heading}
						</h2>

						{/* Description */}
						<p className="text-white/80 text-sm leading-relaxed mb-8">
							{sidebar.description}
						</p>

						{/* Bullet Points */}
						<ul className="space-y-3">
							{sidebar.bullets.map((bullet) => (
								<li
									key={bullet}
									className="flex items-center gap-3 text-white/90 text-sm"
								>
									<span className="shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
										<Check size={12} />
									</span>
									{bullet}
								</li>
							))}
						</ul>
					</div>

					{/* Progress Bar */}
					<div className="mt-10">
						<ProgressBar
							currentStep={currentStep}
							totalSteps={totalSteps}
						/>
					</div>
				</div>

				{/* ── Right Content Area ── */}
				<div className="w-full lg:w-3/5 p-8 lg:p-12 overflow-y-auto flex flex-col justify-center">
					<div className="max-w-xl mx-auto w-full">
                        {children}
                    </div>
				</div>
			</div>
		</div>
	);
};

export default OnboardingLayout;