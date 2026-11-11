import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

export function IconLink({
  href,
  name,
  label,
  badge = 0,
  hideOnMobile = false,
}: {
  href: string;
  name: IconName;
  label: string;
  badge?: number;
  hideOnMobile?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`relative h-11 w-11 items-center justify-center rounded-full text-foreground/80 transition hover:bg-foreground/[0.07] hover:text-foreground active:scale-90 ${
        hideOnMobile ? "hidden md:flex" : "flex"
      }`}
    >
      <Icon name={name} />

      {badge > 0 && (
        <span className="absolute right-0 top-0 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white shadow-sm ring-2 ring-background">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}