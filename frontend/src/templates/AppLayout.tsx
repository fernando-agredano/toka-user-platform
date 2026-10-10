import { AssistantWidget } from '@/components/assistant/AssistantWidget';
import { Sidebar } from '@/components/layout/Sidebar';
import { usePermissions } from '@/hooks/use-permissions';
import { useSecurityAlerts } from '@/hooks/use-security-alerts';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';

export const AppLayout = () => {
  const { can } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  useSecurityAlerts();

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} />
      <main className="min-h-0 min-w-0 flex-1">
        <Outlet />
      </main>
      {can('ai:use') && <AssistantWidget />}
    </div>
  );
};
