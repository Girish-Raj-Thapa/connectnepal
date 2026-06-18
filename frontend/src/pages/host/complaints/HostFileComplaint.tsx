import FileComplaintForm from '@components/complaints/FileComplaintForm';
import { HostComplaintService } from '@services/complaints.service';
import { ROUTES } from '@/constants/routes';

const HostFileComplaint = () => (
    <FileComplaintForm
        fileComplaint={HostComplaintService.fileComplaint}
        detailRoute={ROUTES.HOST_COMPLAINT_DETAIL}
        typographyVariant="traveller"
    />
);

export default HostFileComplaint;
