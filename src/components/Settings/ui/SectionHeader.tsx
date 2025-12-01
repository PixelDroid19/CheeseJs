import clsx from 'clsx'

export function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className={clsx("text-sm font-semibold pb-2 mb-4 border-b", "text-foreground border-border")}>
      {title}
    </h3>
  )
}
