import { formatDistanceToNow } from 'date-fns';

interface ReviewReplyBlockProps {
	reply: string;
	repliedAt: string;
}

const ReviewReplyBlock = ({ reply, repliedAt }: ReviewReplyBlockProps) => {
	const formattedDate = formatDistanceToNow(new Date(repliedAt), {
		addSuffix: true,
	});

	return (
		<div className="bg-surface-muted border-l-4 border-teal-600 rounded-lg p-4 mt-3">
			<div className="flex items-center gap-2 mb-2">
				<div className="w-7 h-7 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-semibold">
					H
				</div>
				<span className="text-xs font-semibold text-ink-secondary">
					Host Response
				</span>
			</div>
			<p className="text-sm text-ink-secondary mb-1">{reply}</p>
			<p className="text-xs text-ink-muted">{formattedDate}</p>
		</div>
	);
};

export default ReviewReplyBlock;
