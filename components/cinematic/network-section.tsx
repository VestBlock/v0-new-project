import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

const routes = [
  {
    number: "01",
    title: "Capital",
    people: "Business owners, investors, borrowers, and capital partners",
    detail: "Prepare the purpose, amount, documents, readiness factors, and criteria needed to compare appropriate funding paths.",
    action: "Explore capital paths",
    href: "/funding",
  },
  {
    number: "02",
    title: "Deals",
    people: "Owners, sellers, buyers, investors, builders, and acquisition teams",
    detail: "Source or prepare real-estate and business opportunities, bring the relevant facts into view, and identify the decision that comes next.",
    action: "Explore deals",
    href: "/get-started",
  },
  {
    number: "03",
    title: "Opportunity",
    people: "People and businesses ready to build, acquire, improve, or grow",
    detail: "Explore useful strategies, resources, education, and relationships, then keep agreements and milestones connected when active work begins.",
    action: "Explore opportunity",
    href: "/get-started",
  },
]

export function NetworkSection() {
  return (
    <section className="vb-network" aria-labelledby="network-title">
      <div className="vb-section-shell">
        <div className="vb-section-intro vb-section-intro--split">
          <h2 id="network-title">Different goals. One coordinated place to move forward.</h2>
          <p>
            Start with what you are trying to accomplish. VestBlock helps organize the relevant capital path, deal path,
            opportunity, or relationship without turning every goal into the same process.
          </p>
        </div>

        <div className="vb-network__map">
          <div className="vb-network__record" aria-hidden="true">
            <span>Your next move</span>
            <strong>Objective, materials, relationships, and action stay connected.</strong>
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
