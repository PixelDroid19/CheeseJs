import clsx from 'clsx'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode
}

export function Select({ children, className, ...props }: SelectProps) {
  return (
    <select
      className={clsx(
        "border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all",
        "bg-background border-border text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
