if (typeof window !== 'undefined') throw new Error('Portfolio feedback may only be used on the server.');

export { submitPortfolioFeedback, testPortfolioConnection } from './portfolio-feedback-core';
export type { FeedbackInput, DeliveryResult } from './portfolio-feedback-core';
