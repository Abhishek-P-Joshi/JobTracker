import { useProfile } from '../hooks/useProfile';
import {
  useAnalyticsSummary,
  useAnalyticsTimeline,
  useAnalyticsLocations,
  useAnalyticsSalary,
  useAnalyticsWorkTypes,
} from '../hooks/useAnalytics';
import ApplicationTimeline from '../components/charts/ApplicationTimeline';
import StatusBreakdown from '../components/charts/StatusBreakdown';
import WorkTypeBreakdown from '../components/charts/WorkTypeBreakdown';
import TopLocations from '../components/charts/TopLocations';
import SalaryDistribution from '../components/charts/SalaryDistribution';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function SkeletonChart() {
  return <div className="skeleton h-[220px] rounded-lg" />;
}

export default function Insights() {
  const { activeProfileId } = useProfile();
  const { data: summary, isPending: s0 } = useAnalyticsSummary(activeProfileId);
  const { data: timeline = [], isPending: s1 } = useAnalyticsTimeline(activeProfileId);
  const { data: locations = [], isPending: s2 } = useAnalyticsLocations(activeProfileId);
  const { data: salary, isPending: s3 } = useAnalyticsSalary(activeProfileId);
  const { data: workTypes = [], isPending: s4 } = useAnalyticsWorkTypes(activeProfileId);

  if (!activeProfileId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Select a profile to view insights.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white">Insights</h1>
      </div>

      <div className="p-6 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <ChartCard title="Application Timeline — last 12 weeks">
            {s1 ? <SkeletonChart /> : <ApplicationTimeline data={timeline} />}
          </ChartCard>
        </div>

        <ChartCard title="Status Breakdown">
          {s0 || !summary ? <SkeletonChart /> : <StatusBreakdown summary={summary} />}
        </ChartCard>

        <ChartCard title="Work Type Breakdown">
          {s4 ? <SkeletonChart /> : <WorkTypeBreakdown data={workTypes} />}
        </ChartCard>

        <ChartCard title="Top Locations">
          {s2 ? <SkeletonChart /> : <TopLocations data={locations} />}
        </ChartCard>

        <ChartCard title="Salary Distribution">
          {s3 || !salary ? <SkeletonChart /> : <SalaryDistribution stats={salary} />}
        </ChartCard>
      </div>
    </div>
  );
}
