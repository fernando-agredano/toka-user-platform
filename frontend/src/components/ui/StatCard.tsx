import { Card } from './Card';
import { Skeleton } from './Skeleton';

interface StatCardProps {
  label: string;
  value: number | undefined;
  isLoading: boolean;
}

export const StatCard = ({ label, value, isLoading }: StatCardProps) => (
  <Card>
    <p className="text-sm text-ink-soft">{label}</p>
    {isLoading || value === undefined ? (
      <Skeleton className="mt-2 h-9 w-20" />
    ) : (
      <p className="mt-1 text-3xl font-bold text-ink">{value.toLocaleString('es-MX')}</p>
    )}
  </Card>
);
