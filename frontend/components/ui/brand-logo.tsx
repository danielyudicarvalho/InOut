import Image from "next/image";
/** Shared image identity; the surrounding Link supplies navigation. */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "ninho-logo ninho-logo-compact" : "ninho-logo"}>
      <Image
        src="/images/ninho-logo.png"
        alt="Ninho"
        width={1942}
        height={809}
        className="ninho-logo-image"
      />
    </span>
  );
}
