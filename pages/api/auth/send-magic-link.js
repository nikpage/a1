// pages/api/auth/send-magic-link.js

import { logger } from '../../../lib/logger';
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import nodemailer from 'nodemailer';
import crypto from "crypto";
import { getBaseUrl, isValidOrigin } from "../../../utils/originCheck";
import {
  getUserByEmail,
  updateUserEmail,
  createUserWithEmail,
  deleteMagicTokensByEmail,
  insertMagicToken,
} from '../../../utils/database';

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "auth-api",
});
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  auth: {
    user: 'pod.one@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const origin = req.headers.origin;
  if (!isValidOrigin(origin)) {
    return res.status(403).json({ error: "Invalid origin" });
  }

  let { email, user_id, rememberMe } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required" });
  }
  const emailNorm = email.toLowerCase().trim();

  // Always resolve to a valid user_id with email stored
  let effectiveUserId = null;

  // Look up user by email
  const existingUser = await getUserByEmail(emailNorm);

  if (existingUser?.user_id) {
    effectiveUserId = existingUser.user_id;
  } else if (user_id) {
    effectiveUserId = user_id;
    await updateUserEmail(user_id, emailNorm);
  } else {
    try {
      const created = await createUserWithEmail(emailNorm);
      if (!created?.user_id) throw new Error('no user_id returned');
      effectiveUserId = created.user_id;
    } catch (createErr) {
      logger.error("Create user error:", createErr.message);
      return res.status(500).json({ error: "Could not create user." });
    }
  }

  // Rate limit (fail-open if Redis is unreachable)
  try {
    const identifier = effectiveUserId || req.ip;
    const { success } = await ratelimit.limit(identifier);
    if (!success) {
      return res.status(429).json({ error: "Too many requests. Try again in a minute." });
    }
  } catch {
    // Redis unavailable — allow the request through
  }

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    const baseUrl = getBaseUrl();
    const magicLink = `${baseUrl}/api/auth/verify?token=${token}`;

    // Clean old tokens
    await deleteMagicTokensByEmail(emailNorm);

    // Insert new token
    try {
      await insertMagicToken({
        email: emailNorm,
        token,
        user_id: effectiveUserId,
        expires_at: expires.toISOString(),
        remember_me: !!rememberMe,
      });
    } catch {
      return res.status(500).json({ error: "Token insert failed." });
    }

    // In dev, skip email and return link directly so the flow is testable
    if (process.env.NODE_ENV !== "production") {
      return res.status(200).json({
        success: true,
        message: "Dev mode: use the link below to log in (no email sent).",
        devLink: magicLink,
      });
    }

    try {
      await transporter.sendMail({
        from: 'pod.one@gmail.com',
        to: emailNorm,
        subject: 'Your login link for thecv.pro',
        html: `<p>Click <a href="${magicLink}">here</a> to log in. Link expires in 15 minutes.</p>`,
      });
    } catch (mailErr) {
      logger.error('Mail error:', mailErr.message);
      return res.status(500).json({ error: 'Email send failed.', detail: mailErr.message });
    }

    return res.status(200).json({
      success: true,
      message: "Login link sent successfully.",
    });
  } catch (e) {
    logger.error("Magic link error:", e.message);
    return res.status(500).json({ error: "Internal error." });
  }
}
