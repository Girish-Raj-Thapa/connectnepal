interface ProgressBarProps {
    currentStep: number;
    totalSteps: number;
}

const ProgressBar = ({ currentStep, totalSteps}: ProgressBarProps) => {
    const percentage = (currentStep / totalSteps) * 100;

    return (
        <div>
            <p className="text-white/80 text-sm mb-2">
                Step {currentStep} of {totalSteps}
            </p>

            <div className="w-full bg-white/20 rounded-full h-1.5">
                <div
					className="bg-surface h-1.5 rounded-full transition-all duration-500"
					style={{ width: `${percentage}%` }}
				/>
            </div>
        </div>
    );
};

export default ProgressBar;