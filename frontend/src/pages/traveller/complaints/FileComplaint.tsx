import FileComplaintForm from '@components/complaints/FileComplaintForm';
import { TravellerComplaintService } from '@services/complaints.service';
import { ROUTES } from '@/constants/routes';

const FileComplaint = () => (
    <FileComplaintForm
        fileComplaint={TravellerComplaintService.fileComplaint}
        detailRoute={ROUTES.TRAVELLER_COMPLAINT_DETAIL}
        typographyVariant="traveller"
    />
);

export default FileComplaint;
