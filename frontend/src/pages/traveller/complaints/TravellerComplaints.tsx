import ComplaintListPage from '@components/complaints/ComplaintListPage';
import { TravellerComplaintService } from '@services/complaints.service';
import { ROUTES } from '@/constants/routes';

const TravellerComplaints = () => (
    <ComplaintListPage
        filedService={TravellerComplaintService.listFiled}
        receivedService={TravellerComplaintService.listReceived}
        filedDetailRoute={ROUTES.TRAVELLER_COMPLAINT_DETAIL}
        receivedDetailRoute={ROUTES.TRAVELLER_RECEIVED_COMPLAINT_DETAIL}
        typographyVariant="traveller"
    />
);

export default TravellerComplaints;
