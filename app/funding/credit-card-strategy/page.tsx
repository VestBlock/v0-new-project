import { redirect } from 'next/navigation';

export default function LegacyFundingStrategyRedirect() {
  redirect('/funding/business-funding-strategy');
}
