import TripPlanModal from '@components/trip-planner/TripPlanModal';

interface CreateTripModalProps {
	open: boolean;
	onClose: () => void;
	onCreated: (planId: number) => void;
}

const CreateTripModal = ({ open, onClose, onCreated }: CreateTripModalProps) => {
	return (
		<TripPlanModal
			open={open}
			onClose={onClose}
			onCreated={onCreated}
			mode="create"
		/>
	);
};

export default CreateTripModal;
