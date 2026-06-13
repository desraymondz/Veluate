import Image from "next/image";
import Link from "next/link";

const MARK = "/veluate_mark_light.png";
const LOCKUP = "/veluate_logomark_light.png";

type LogoProps = {
  variant?: "mark" | "lockup" | "horizontal";
  href?: string | null;
  className?: string;
  priority?: boolean;
};

export function Logo({
  variant = "horizontal",
  href = "/",
  className = "",
  priority = false,
}: LogoProps) {
  const content =
    variant === "lockup" ? (
      <Image
        src={LOCKUP}
        alt="Veluate — AI teacher evaluation"
        width={1270}
        height={1200}
        priority={priority}
        className={`h-auto w-full max-w-[280px] ${className}`}
      />
    ) : variant === "mark" ? (
      <Image
        src={MARK}
        alt="Veluate"
        width={950}
        height={758}
        priority={priority}
        className={`size-7 object-contain ${className}`}
      />
    ) : (
      <span className={`inline-flex items-center gap-3 ${className}`}>
        <Image
          src={MARK}
          alt=""
          width={950}
          height={758}
          priority={priority}
          className="size-7 shrink-0 object-contain"
          aria-hidden
        />
        <span className="font-display text-[22px] font-normal tracking-[0.18em] text-foreground">
          VELUATE
        </span>
      </span>
    );

  if (href == null) return content;

  return (
    <Link
      href={href}
      className="inline-flex transition-opacity duration-100 ease-out hover:opacity-70"
    >
      {content}
    </Link>
  );
}
