import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TermsPage() {
  return (
    <div className="container py-10">
      <Card className="card-glow max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl">Terms of Service</CardTitle>
          <CardDescription>Last updated: April 30, 2025</CardDescription>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <h2>1. Introduction</h2>
          <p>
            Welcome to VestBlock ("Company", "we", "our", "us"). These Terms of Service ("Terms", "Terms of Service")
            govern your use of our website located at vestblock.io (the "Service") operated by VestBlock.
          </p>
          <p>
            By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of
            the terms, then you may not access the Service.
          </p>

          <h2>2. Accounts</h2>
          <p>
            When you create an account with us, you must provide information that is accurate, complete, and current at
            all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of
            your account on our Service.
          </p>
          <p>
            You are responsible for safeguarding the password that you use to access the Service and for any activities
            or actions under your password, whether your password is with our Service or a third-party service.
          </p>
          <p>
            You agree not to disclose your password to any third party. You must notify us immediately upon becoming
            aware of any breach of security or unauthorized use of your account.
          </p>

          <h2>3. Content</h2>
          <p>
            Our Service allows you to upload, analyze, and store credit report information. You are responsible for the
            data you provide and its accuracy.
          </p>
          <p>
            By submitting content to VestBlock, you grant us a worldwide, non-exclusive, royalty-free license to use,
            reproduce, adapt, publish, translate, and distribute your content in any existing or future media formats
            for the purpose of providing and improving our service.
          </p>
          <p>
            You represent and warrant that: (i) the content is yours or you have the right to use it and grant us the
            rights and license as provided in these Terms, and (ii) the uploading of your content on or through the
            Service does not violate the privacy rights, publicity rights, copyrights, contract rights, or any other
            rights of any person.
          </p>

          <h2>4. Service Description</h2>
          <p>
            VestBlock provides AI-driven credit repair and financial empowerment services. These services include, but
            are not limited to, credit report analysis, dispute letter generation, credit improvement recommendations,
            and income opportunity suggestions.
          </p>
          <p>
            The Service is provided for informational purposes only. We are not financial advisors, credit counselors,
            or legal representatives. The information and recommendations provided by the Service should not be
            considered financial, legal, or professional advice.
          </p>
          <p>
            Results from using our Service may vary based on individual circumstances, accuracy of information provided,
            and external factors beyond our control.
          </p>

          <h2>5. Payments and Refunds</h2>
          <p>
            Our Pro plan is a one-time payment for lifetime access to premium features. We may offer refunds within 30
            days of purchase if you are not satisfied with the Service.
          </p>
          <p>
            To request a refund, please contact our support team with your order information. Refund eligibility is
            determined on a case-by-case basis.
          </p>
          <p>
            We reserve the right to modify or terminate the Service or your access to the Service for any reason,
            without notice, at any time.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            In no event shall VestBlock, nor its directors, employees, partners, agents, suppliers, or affiliates, be
            liable for any indirect, incidental, special, consequential, or punitive damages, including without
            limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access
            to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on
            the Service; (iii) any content obtained from the Service; and (iv) unauthorized access, use, or alteration
            of your transmissions or content, whether based on warranty, contract, tort (including negligence), or any
            other legal theory, whether or not we have been informed of the possibility of such damage.
          </p>

          <h2>7. Privacy Policy</h2>
          <p>
            Please review our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            to understand our practices.
          </p>

          <h2>8. Governing Law</h2>
          <p>
            These Terms shall be governed and construed in accordance with the laws of the United States, without regard
            to its conflict of law provisions.
          </p>
          <p>
            Our failure to enforce any right or provision of these Terms will not be considered a waiver of those
            rights. If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions
            will remain in effect.
          </p>

          <h2>9. Changes</h2>
          <p>
            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is
            material, we will try to provide at least 30 days' notice prior to any new terms taking effect.
          </p>
          <p>
            By continuing to access or use our Service after those revisions become effective, you agree to be bound by
            the revised terms. If you do not agree to the new terms, please stop using the Service.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have any questions about these Terms, please{" "}
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
