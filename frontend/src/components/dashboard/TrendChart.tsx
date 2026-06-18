import {
	ResponsiveContainer,
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	CartesianGrid,
	Area,
	AreaChart,
} from 'recharts';
import { formatMonthLabel } from '@utils/format';

interface TrendChartProps {
	/** Chart title shown above the chart. */
	title: string;
	/** Array of { month, value } data points. */
	data: { month: string; value: number }[];
	/** Chart type — "bar" for earnings/revenue, "area" for bookings trend. */
	type: 'bar' | 'area';
	/** Color of bars/line. Defaults to teal for bar, blue for area. */
	color?: string;
	/** Y-axis value formatter (e.g., adding "NPR" prefix). */
	yFormatter?: (value: number) => string;
}

const TrendChart = ({
	title,
	data,
	type,
	color,
	yFormatter,
}: TrendChartProps) => {
	// Default colors matching the HTML prototype
	const barColor = color ?? '#0d9488'; // teal-600
	const lineColor = color ?? '#3b82f6'; // blue-500

	// Transform data to add formatted month labels
	const chartData = data.map((point) => ({
		...point,
		label: formatMonthLabel(point.month),
	}));

	const formatTooltipValue = (value: unknown): string => {
		if (typeof value === 'number') {
			return yFormatter ? yFormatter(value) : value.toLocaleString();
		}

		if (typeof value === 'string') {
			const numericValue = Number(value);
			if (!Number.isNaN(numericValue)) {
				return yFormatter
					? yFormatter(numericValue)
					: numericValue.toLocaleString();
			}
			return value;
		}

		return '';
	};

	return (
		<div className="bg-surface rounded-2xl border border-line p-6">
			<h3 className="card-heading text-ink mb-4">
				{title}
			</h3>

			<div className="h-[250px]">
				<ResponsiveContainer width="100%" height="100%">
					{type === 'bar' ? (
						<BarChart data={chartData}>
							<CartesianGrid
								strokeDasharray="3 3"
								vertical={false}
							/>

							<XAxis
								dataKey="label"
								tick={{ fontSize: 12, fill: '#6b7280' }}
								axisLine={false}
								tickLine={false}
							/>

							<YAxis
								tick={{ fontSize: 12, fill: '#6b7280' }}
								axisLine={false}
								tickLine={false}
								tickFormatter={yFormatter}
							/>

							<Tooltip
								formatter={formatTooltipValue}
								contentStyle={{
									borderRadius: '8px',
									border: '1px solid #e5e7eb',
									fontSize: '13px',
								}}
							/>

							<Bar
								dataKey="value"
								fill={barColor}
								radius={[6, 6, 0, 0]}
								maxBarSize={40}
							/>
						</BarChart>
					) : (
						<AreaChart data={chartData}>
							<defs>
								<linearGradient
									id="areaGradient"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="5%"
										stopColor={lineColor}
										stopOpacity={0.1}
									/>
									<stop
										offset="95%"
										stopColor={lineColor}
										stopOpacity={0}
									/>
								</linearGradient>
							</defs>

							<CartesianGrid
								strokeDasharray="3 3"
								vertical={false}
							/>

							<XAxis
								dataKey="label"
								tick={{ fontSize: 12, fill: '#6b7280' }}
								axisLine={false}
								tickLine={false}
							/>

							<YAxis
								tick={{ fontSize: 12, fill: '#6b7280' }}
								axisLine={false}
								tickLine={false}
								tickFormatter={yFormatter}
							/>

							<Tooltip
								formatter={formatTooltipValue}
								contentStyle={{
									borderRadius: '8px',
									border: '1px solid #e5e7eb',
									fontSize: '13px',
								}}
							/>

							<Area
								type="monotone"
								dataKey="value"
								stroke={lineColor}
								strokeWidth={2}
								fill="url(#areaGradient)"
								dot={{
									r: 4,
									fill: lineColor,
									stroke: '#fff',
									strokeWidth: 2,
								}}
								activeDot={{ r: 6 }}
							/>
						</AreaChart>
					)}
				</ResponsiveContainer>
			</div>
		</div>
	);
};

export default TrendChart;
