import { createFeedbackHandler } from '@/lib/feedback-handler';
import { submitPortfolioFeedback } from '@/lib/portfolio-feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = createFeedbackHandler(submitPortfolioFeedback);
