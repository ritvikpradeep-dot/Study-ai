export function Card({
  className = "",
  hover = false,
  children,
  style,
}: {
  className?: string;
  hover?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`glass rounded-2xl ${hover ? "card-hover" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
