import { BadgeCheck } from 'lucide-react';
import type { ListingHost } from '@/types/listings';

interface ListingHostCardProps {
	host: ListingHost;
}

const ListingHostCard = ({ host }: ListingHostCardProps) => {
	const hostSinceDate = host.hostSince ? new Date(host.hostSince) : null;
	const hostSinceYear =
		hostSinceDate && !Number.isNaN(hostSinceDate.getTime())
			? hostSinceDate.getFullYear()
			: null;

	return (
		<div className="bg-surface border border-line rounded-2xl p-6">
			<div className="flex items-start gap-4">
				{host.profilePhotoUrl && (
					<img
						src={host.profilePhotoUrl}
						alt={host.businessName}
						className="w-20 h-20 rounded-2xl object-cover shrink-0 shadow-lg"
					/>
				)}

				<div className="grow">
					<div className="flex items-center gap-3 mb-2">
						<h3 className="section-heading text-ink">
							{host.businessName}
						</h3>
						{host.isVerified && (
							<span className="px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1">
								<BadgeCheck className="w-3 h-3" />
								Verified
							</span>
						)}
						</div>
						<p className="text-ink-muted mb-1">{host.fullName}</p>
						{hostSinceYear !== null && (
							<p className="text-sm text-ink-muted">
								Host since {hostSinceYear}
							</p>
						)}
					</div>
				</div>
			</div>
	);
};

export default ListingHostCard;
