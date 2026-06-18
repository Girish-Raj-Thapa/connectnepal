import { Settings as SettingsIcon } from 'lucide-react';
import DashboardLayout from '@/layouts/DashboardLayout';
import ProfileSettingsForm from '@components/form/ProfileSettingsForm';

const Settings = () => {
	return (
		<DashboardLayout>
			<div className="mb-6">
				<h1 className="page-heading text-ink flex items-center gap-2">
					<SettingsIcon className="w-6 h-6 text-teal-600" />
					Settings
				</h1>
				<p className="page-subtext mt-1">Manage your profile and password</p>
			</div>
			<ProfileSettingsForm />
		</DashboardLayout>
	);
};

export default Settings;
