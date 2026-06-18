import ComplaintDetailPage from '@components/complaints/ComplaintDetailPage';
import { TravellerComplaintService } from '@services/complaints.service';

const TravellerComplaintDetail = () => (
    <ComplaintDetailPage
        getDetail={TravellerComplaintService.getDetail}
        uploadEvidence={TravellerComplaintService.uploadEvidence}
        typographyVariant="traveller"
    />
);

export default TravellerComplaintDetail;
