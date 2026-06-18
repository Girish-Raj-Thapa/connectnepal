import logo from '@assets/logo.png';

interface LogoProps {
	className?: string;
}

const Logo = ({ className = '' }: LogoProps) => {
	return (
		<div className={`flex items-center ${className}`}>
			<img
				src={logo}
				alt="ConnectNepal Logo"
				className="h-20 w-auto"
			/>
		</div>
	);
};

export default Logo;
