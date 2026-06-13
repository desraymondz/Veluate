import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-none border border-input bg-background px-3 py-2 text-sm transition-colors duration-100 ease-out outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-foreground focus-visible:ring-1 focus-visible:ring-foreground/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-foreground aria-invalid:ring-foreground/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
