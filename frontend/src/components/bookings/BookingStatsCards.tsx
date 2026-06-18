import type { ReactNode } from "react";

export interface StatCard {
    label: string;
    value: string | number;
	icon: ReactNode;
	colorClass: string; 
}

interface Props {
    stats: StatCard[];
	loading?: boolean;
}


const BookingStatsCards = ({ stats, loading = false }: Props) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

            {stats.map((stat) => (
                <div
					key={stat.label}
					className="bg-surface border border-line rounded-2xl p-4 flex items-center gap-4 shadow-sm"
				>
                    <div className={`shrink-0 ${stat.colorClass}`} aria-hidden="true">
                        { stat.icon }
                    </div>
                    <div>
                        {loading ? (
                            <div className="h-6 w-16 bg-surface-raised rounded animate-pulse mb-1" />
                        ): (
                            <p className={`text-2xl font-bold ${stat.colorClass}`}>
                                {stat.value}
                            </p>
                        )}
                        <p className="text-xs text-ink-muted font-medium">{stat.label}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BookingStatsCards;
