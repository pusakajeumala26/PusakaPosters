'use client';

import type { PortfolioStatus } from '@/lib/feedback-types';
import { PortfolioConnectionCard } from './PortfolioConnectionCard';

export function McpServerView({ portfolio }: { portfolio: PortfolioStatus }) {
  return (
    <div className="sets">
      <PortfolioConnectionCard initial={portfolio} />
    </div>
  );
}
