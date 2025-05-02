import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function PrivacyPage() {
  return (
    <div className="container py-10">
      <Card className="card-glow max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl">Privacy Policy</CardTitle>
          <CardDescription>Last updated: April 30, 2025</CardDescription>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <h2>1. Introduction</h2>
          <p>
            This Privacy Policy describes how VestBlock ("we", "our", or "us") collects, uses, and shares information
            about you when you use our website, services, and applications (collectively, the "Services"). Your privacy
            is important to us, and we are committed to protecting your personal information.
          </p>
          <p>
            By using our Services, you agree to the collection and use of information in accordance with this policy. We
            will not use or share your information with anyone except as described in this Privacy Policy.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>2.1 Personal Information</h3>
          <p>We may collect the following types of personal information:</p>
          <ul>
            <li>
              <strong>Account Information</strong>: When you register for an account, we collect your name, email
              address, and other contact information.
            </li>
            <li>
              <strong>Credit Report Information</strong>: When you upload credit reports for analysis, we collect the
              information contained in those reports, which may include your credit history, payment history, credit
              inquiries, and personal identifying information.
            </li>
            <li>
              <strong>Payment Information</strong>: If you purchase our Pro plan, we collect payment information
              necessary to process your transaction, although this is handled securely through our payment processor.
            </li>
            <li>
              <strong>Communications</strong>: If you contact us directly, we may receive additional information about
              you, such as your name, email address, phone number, and the contents of your message.
            </li>
          </ul>

          <h3>2.2 Usage Data</h3>
          <p>We also collect information about how you use our Services, including:</p>
          <ul>
            <li>Log data and device information</li>
            <li>Cookies and similar tracking technologies</li>
            <li>Analytics information about how you interact with our Services</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use the information we collect for various purposes, including:</p>
          <ul>
            <li>Providing, maintaining, and improving our Services</li>
            <li>Processing and analyzing your credit reports</li>
            <li>Generating personalized recommendations and dispute letters</li>
            <li>Communicating with you about our Services</li>
            <li>Responding to your requests and inquiries</li>
            <li>Understanding how users interact with our Services</li>
            <li>Detecting, preventing, and addressing technical issues</li>
            <li>Protecting the security and integrity of our Services</li>
          </ul>

          <h2>4. Information Sharing and Disclosure</h2>
          <p>We may share your information in the following circumstances:</p>
          <ul>
            <li>
              <strong>Service Providers</strong>: We may share your information with third-party vendors and service
              providers who need access to your information to help us provide our Services (e.g., cloud storage
              providers, payment processors).
            </li>
            <li>
              <strong>Legal Requirements</strong>: We may disclose your information if required to do so by law or in
              response to valid requests from public authorities.
            </li>
            <li>
              <strong>Business Transfers</strong>: In the event of a merger, acquisition, or sale of all or a portion of
              our assets, your information may be transferred as part of that transaction.
            </li>
            <li>
              <strong>With Your Consent</strong>: We may share your information with third parties when you have given
              us your consent to do so.
            </li>
          </ul>
          <p>We do not sell your personal information to third parties for marketing or advertising purposes.</p>

          <h2>5. Data Security</h2>
          <p>
            We take reasonable measures to protect your personal information from unauthorized access, use, or
            disclosure. However, no method of transmission over the Internet or electronic storage is 100% secure, so we
            cannot guarantee absolute security.
          </p>

          <h2>6. Your Rights and Choices</h2>
          <p>Depending on your location, you may have certain rights regarding your personal information, such as:</p>
          <ul>
            <li>Accessing, correcting, or deleting your personal information</li>
            <li>Withdrawing your consent at any time</li>
            <li>Objecting to the processing of your personal information</li>
            <li>Requesting the restriction of processing of your personal information</li>
            <li>Data portability</li>
          </ul>
          <p>To exercise these rights, please contact us at privacy@vestblock.io.</p>

          <h2>7. Children's Privacy</h2>
          <p>
            Our Services are not intended for children under the age of 18, and we do not knowingly collect personal
            information from children. If we learn that we have collected personal information from a child, we will
            take steps to delete that information as quickly as possible.
          </p>

          <h2>8. Changes to This Privacy Policy</h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new
            Privacy Policy on this page and updating the "Last updated" date at the top of this page. You are advised to
            review this Privacy Policy periodically for any changes.
          </p>

          <h2>9. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please{" "}
            <Link href="/contact" className="text-primary hover:underline">
              contact us
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
