// pages/api/auth/send-magic-link.js

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "auth-api",
});
const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const getBaseUrl = () => {
  if (process.env.VERCEL) return "https://thecv.pro";
  return "http://localhost:3000";
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const origin = req.headers.origin;
  const trustedOrigin = getBaseUrl();
  if (origin && origin !== trustedOrigin) {
    return res.status(403).json({ error: "Invalid origin" });
  }

  let { email, user_id } = req.body;
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email required" });

  // Look up existing user_id by email if no user_id provided
  if (!user_id) {
    const { data: existingToken } = await supabase
      .from("magic_tokens")
      .select("user_id")
      .eq("email", email.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingToken) {
      user_id = existingToken.user_id;
    }
  }

  if (!user_id) return res.status(200).json({ success: true, message: "If that email is registered, a login link has been sent." });

  const identifier = user_id || req.ip;
  const { success } = await ratelimit.limit(identifier);
  if (!success) {
    return res.status(429).json({ error: "Too many requests. Try again in a minute." });
  }

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 900000);
    const baseUrl = getBaseUrl();
    const magicLink = `${baseUrl}/verify?token=${token}`;

    const { error: insertError } = await supabase.from("magic_tokens").insert([
      {
        email: email.toLowerCase(),
        token,
        user_id,
        expires_at: expires.toISOString(),
        remember_me: req.body.rememberMe || false,
        used: false,
      },
    ]);
    if (insertError) throw new Error("Failed to store magic token.");

    const { error: emailError } = await resend.emails.send({
      from: "login@thecv.pro",
      to: email,
      subject: "Your TheCV.Pro Login Link",
      html: `<p>Click this link to log in: <a href="${magicLink}">Login</a>. It expires in 15 minutes.</p>`,
    });
    if (emailError) throw new Error("Failed to send magic link email.");

    return res.status(200).json({ success: true, message: "If that email is registered, a login link has been sent." });
  } catch (error) {
    console.error("Magic link process failed:", error.message);
    return res.status(200).json({ success: true, message: "If that email is registered, a login link has been sent." });
  }
}
