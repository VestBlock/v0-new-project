import Link from "next/link"
import { Facebook, Instagram, Twitter, Linkedin, Mail, MapPin } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-gray-950 text-gray-400 py-12 border-t border-gray-800">
      <div className="container py-12 md:py-16">
        <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">VestBlock</h3>
            <p className="text-slate-400 text-sm max-w-xs">
              AI-powered credit repair and financial empowerment platform. Upload your credit report, get personalized
              recommendations, and improve your financial health.
            </p>
            <div className="flex space-x-4">
              <Link href="#" className="text-brand-blue hover:text-brand-blue/80">
                <Facebook className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-brand-blue hover:text-brand-blue/80">
                <Instagram className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-brand-blue hover:text-brand-blue/80">
                <Twitter className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-brand-blue hover:text-brand-blue/80">
                <Linkedin className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Quick Links</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/resources" className="hover:text-white">
                  Resources
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-white">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-white">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Features</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link href="#" className="hover:text-white">
                  Credit Analysis
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white">
                  Dispute Letters
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white">
                  Credit Hacks
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white">
                  Side Hustle Recommendations
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white">
                  AI Assistant
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white">
                  Progress Tracking
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Contact</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start">
                <MapPin className="h-5 w-5 mr-2 shrink-0 text-slate-300" />
                <span>123 Financial Street, Suite 456, New York, NY 10001</span>
              </li>
              <li className="flex items-center">
                <Mail className="h-5 w-5 mr-2 shrink-0 text-slate-300" />
                <span>support@vestblock.io</span>
              </li>
              <li>
                <span className="block text-xs uppercase text-slate-500 font-medium mb-1">Support Hours</span>
                <span>Monday - Friday: 9AM - 5PM EST</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-slate-400">
          <div className="mb-4 md:mb-0">&copy; {new Date().getFullYear()} VestBlock. All rights reserved.</div>
          <div className="flex space-x-6">
            <Link href="/terms" className="hover:text-white">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/sitemap" className="hover:text-white">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
