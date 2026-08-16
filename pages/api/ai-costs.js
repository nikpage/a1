// path: /pages/api/ai-costs.js
//
// The AI cost ledger, read for the panel on /me: the last ten tasks, today and
// yesterday, each of the last seven UTC days, and the current billing period
// with the three before it.
//
// It is APP-WIDE on purpose. The panel exists to answer "what is Gemini costing
// me", and that includes runs started from a script, a chat-driven experiment
// and every retry that was billed and thrown away — not just the calls made
// under one signed-in session.

import requireAuth from '../../lib/requireAuth';
import { getAiCostRows } from '../../utils/database';
import { buildCostReport, reportSince } from '../../utils/ai-cost-report';
import { logger } from '../../lib/logger';

async function handler(req, res) {
  try {
    const now = new Date();
    const rows = await getAiCostRows(reportSince(now));
    return res.status(200).json(buildCostReport(rows, now));
  } catch (e) {
    logger.error('[ai-costs] could not read the ledger:', e.message);
    return res.status(500).json({ error: 'Could not read AI costs' });
  }
}

export default requireAuth(handler);
