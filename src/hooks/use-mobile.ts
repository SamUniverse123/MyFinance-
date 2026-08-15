import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // 767.98px (not 767) so this is the exact complement of Tailwind's
    // `md` breakpoint (min-width: 768px) even at fractional viewport widths.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 0.02}px)`)
    // Read from the media query itself, not window.innerWidth. innerWidth
    // includes the scrollbar width while media queries (and Tailwind's `md:`
    // breakpoint) measure the CSS viewport, so mixing the two leaves a ~15px
    // dead zone near 768px where neither the desktop sidebar nor the mobile
    // Sheet renders and the toggle appears to do nothing.
    const onChange = () => {
      setIsMobile(mql.matches)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
