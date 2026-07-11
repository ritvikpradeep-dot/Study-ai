export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass animate-fade-in flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
      {icon && <div className="text-3xl opacity-40">{icon}</div>}
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm opacity-60">{description}</p>}
      {action}
    </div>
  );
}
