import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

const routes = [
  {
    number: "01",
    title: "Property and intent",
    people: "Owners, sellers, and acquisition teams",
    detail: "Establish what the property is, what needs to happen next, and the information available for review.",
    action: "Prepare a property",
    href: "/sell",
  },
  {
    number: "02",
    title: "Capital and deal fit",
    people: "Buyers, investors, lenders, and capital partners",
    detail: "Set the buy box, program criteria, capital requirement, risk parameters, and conditions for an informed conversation.",
    action: "Share decision criteria",
    href: "/get-started",
  },
  {
    number: "03",
    title: "Execution and continuity",
    people: "Operators, developers, contractors, and advisors",
    detail: "Connect operating capacity to the opportunity, then keep the approved next step and supporting record in context.",
    action: "Build a partner profile",
    href: "/get-started",
  },
]

export function NetworkSection() {
  return (
    <section className="vb-network" aria-labelledby="network-title">
      <div className="vb-section-shell">
        <div className="vb-section-intro vb-section-intro--split">
          <h2 id="network-title">A platform that connects the people needed to move an opportunity forward.</h2>
          <p>
            The property record stays at the center. Each participant adds the criteria, capacity, or decision needed for
            the next responsible action.
          </p>
        </div>

        <div className="vb-network__map">
          <div className="vb-network__record" aria-hidden="true">
            <span>Shared opportunity record</span>
            <strong>Property facts travel with the decision.</strong>
          </div>
          <ol className="vb-network__routes" aria-label="VestBlock participant routes">
            {routes.map((route) => (
              <li key={route.number}>
                <span className="vb-network__index">{route.number}</span>
                <div>
                  <p className="vb-network__route-title">{route.title}</p>
                  <h3>{route.people}</h3>
                  <p>{route.detail}</p>
                  <Link href={route.href}>
                    {route.action}
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
