import ReceivedComplaintPage from '@components/complaints/ReceivedComplaintPage';
import { HostComplaintService } from '@services/complaints.service';

const HostReceivedComplaintDetail = () => (
    <ReceivedComplaintPage
        getReceivedDetail={HostComplaintService.getReceivedDetail}
        respond={HostComplaintService.respond}
        uploadReceivedEvidence={HostComplaintService.uploadReceivedEvidence}
        typographyVariant="traveller"
    />
);

export default HostReceivedComplaintDetail;
