import Image from "next/image";

export function Hero() {
  return (
    <div className="flex flex-col gap-16 items-center">
      <Image
        src="/danum-logo.png"
        alt="Danum Logo"
        width={120}
        height={120}
        priority
      />
      <h1 className="text-4xl lg:text-5xl font-bold text-center">
        Danum
      </h1>
      <p className="text-xl text-center text-foreground/80">
        Share your moments
      </p>
      <div className="w-full p-[1px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent my-8" />
    </div>
  );
}