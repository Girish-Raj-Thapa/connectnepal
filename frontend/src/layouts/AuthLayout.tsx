import type { ReactNode } from 'react';
import Logo from '@components/common/Logo';

interface AuthLayoutProps {
	children: ReactNode;
	header?: boolean;
	title?: string;
	subtitle?: string;
}

const AuthLayout = ({
	children,
	header = false,
	title,
	subtitle,
}: AuthLayoutProps) => {
	return (
		<div className="min-h-screen flex items-center justify-center gradient-bg relative overflow-hidden">
			{/* Background Pattern */}
			<div className="absolute inset-0 pattern-dots" />

			{/* Auth Card */}
			<div className="relative z-10 w-full max-w-md mx-4">
				<div className="bg-surface shadow-2xl rounded-3xl overflow-hidden border border-line-muted">
					{/* Header */}
					{header && (
						<div className="relative bg-linear-to-b from-tealbrand-dark to-tealbrand py-6 px-6">
							{/* Decorative Blobs */}
							<div className="absolute -top-8 -right-8 w-28 h-28 bg-white/5 rounded-full blur-2xl" />
							<div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full blur-xl" />

							{/* Logo */}
							<div className="relative flex flex-col items-center">
								<Logo />
								<p className="text-tealbrand-light text-xs tracking-wide opacity-90 mt-1">
									Community Tourism Platform
								</p>
							</div>
						</div>
					)}

					{/* Content Section */}
					<div className="px-6 py-6">
						{/* Title & Subtitle */}
						{(title || subtitle) && (
							<div className="text-center mb-5">
								{title && (
									<h2 className="page-heading text-ink mb-1">
										{title}
									</h2>
								)}
								{subtitle && (
									<p className="page-subtext">{subtitle}</p>
								)}
							</div>
						)}

						{/* Form Content */}
						{children}
					</div>
				</div>

				{/* Footer */}
				<p className="text-center text-ink-muted text-xs mt-3 tracking-wide">
					Discover authentic Nepal • Connect with local communities
				</p>
			</div>
		</div>
	);
};

export default AuthLayout;
