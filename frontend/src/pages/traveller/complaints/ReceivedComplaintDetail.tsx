import ReceivedComplaintPage from '@components/complaints/ReceivedComplaintPage';
import { TravellerComplaintService } from '@services/complaints.service';

const ReceivedComplaintDetail = () => (
    <ReceivedComplaintPage
        getReceivedDetail={TravellerComplaintService.getReceivedDetail}
        respond={TravellerComplaintService.respond}
        uploadReceivedEvidence={TravellerComplaintService.uploadReceivedEvidence}
        typographyVariant="traveller"
    />
);

export default ReceivedComplaintDetail;
