import ComplaintDetailPage from '@components/complaints/ComplaintDetailPage';
import { HostComplaintService } from '@services/complaints.service';

const HostComplaintDetail = () => (
    <ComplaintDetailPage
        getDetail={HostComplaintService.getDetail}
        uploadEvidence={HostComplaintService.uploadEvidence}
        typographyVariant="traveller"
    />
);

export default HostComplaintDetail;
