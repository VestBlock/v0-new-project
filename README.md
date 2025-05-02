# VestBlock.io

VestBlock is a real-time AI-driven credit repair and financial empowerment platform. The app uses OCR + GPT-4 to analyze user-uploaded credit reports, generate dispute letters, suggest improvement strategies, and provide curated income ideas.

## Tech Stack

- **Frontend**: React 18.2.0, Next.js 14.0.4, TypeScript
- **Backend**: Next.js API Routes, Serverless Functions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: OpenAI GPT-4o
- **Styling**: Tailwind CSS
- **Payment Processing**: PayPal

## Getting Started

### Prerequisites

- Node.js 18.17.0 or later
- npm 9.0.0 or later
- Supabase account
- OpenAI API key
- PayPal Developer account (for payment processing)

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/yourusername/vestblock.git
   cd vestblock
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install --legacy-peer-deps
   \`\`\`

3. Set up environment variables:
   Create a `.env.local` file in the root directory with the following variables:
   \`\`\`
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   OPENAI_API_KEY=your_openai_api_key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   PAYPAL_CLIENT_ID=your_paypal_client_id
   PAYPAL_CLIENT_SECRET=your_paypal_client_secret
   PAYPAL_WEBHOOK_ID=your_paypal_webhook_id
   \`\`\`

4. Run the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Vercel Deployment

1. Push your code to a GitHub repository.
2. Create a new project on Vercel and import your repository.
3. Set the environment variables in the Vercel project settings.
4. Deploy the project.

### Important Deployment Notes

- Set the Node.js version to 18.x or later in your Vercel project settings.
- Configure the build command to use `--legacy-peer-deps` to handle React version compatibility issues.
- Set up Supabase webhooks for authentication events if needed.
- Configure PayPal webhook endpoints for payment notifications.

## Troubleshooting

### Common Issues

1. **React Version Conflicts**: Ensure you're using React 18.2.0 and have the proper resolutions in package.json.
2. **OpenAI API Errors**: Verify your API key and check for rate limiting or quota issues.
3. **Supabase Connection Issues**: Confirm your Supabase URL and keys are correct.
4. **Deployment Errors**: Run the deployment checker to identify and fix configuration issues.

### Running the Deployment Checker

\`\`\`bash
# In development
npm run dev

# Then navigate to /admin/deployment-check
\`\`\`

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.
