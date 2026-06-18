import ComplaintListPage from '@components/complaints/ComplaintListPage';
import { HostComplaintService } from '@services/complaints.service';
import { ROUTES } from '@/constants/routes';

const HostComplaints = () => (
    <ComplaintListPage
        filedService={HostComplaintService.listFiled}
        receivedService={HostComplaintService.listReceived}
        filedDetailRoute={ROUTES.HOST_COMPLAINT_DETAIL}
        receivedDetailRoute={ROUTES.HOST_RECEIVED_COMPLAINT_DETAIL}
        typographyVariant="traveller"
    />
);

export default HostComplaints;
