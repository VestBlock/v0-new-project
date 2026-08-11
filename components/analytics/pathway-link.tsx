"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

import { captureClientEvent } from "@/lib/analytics/client"
import type { AnalyticsEventName } from "@/lib/analytics/events"

type PathwayLinkProps = ComponentProps<typeof Link> & {
  analyticsEvent: AnalyticsEventName
  placement: string
}

export function PathwayLink({ analyticsEvent, placement, onClick, ...props }: PathwayLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        captureClientEvent(analyticsEvent, {
          destination: typeof props.href === "string" ? props.href : props.href.pathname,
          placement,
        })
        onClick?.(event)
      }}
    />
  )
}
