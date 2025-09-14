// pages/api/auth/send-magic-link.js

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getBaseUrl, isValidOrigin } from "../../../utils/originCheck";

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "auth-api",
});
const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
  const { data: existingUser } = await supabase
    .from("users")
    .select("user_id, email")
    .eq("email", emailNorm)
    .maybeSingle();

  if (existingUser?.user_id) {
    effectiveUserId = existingUser.user_id;
  } else if (user_id) {
    effectiveUserId = user_id;
    // Ensure this user row has email set
    await supabase.from("users").update({ email: emailNorm }).eq("user_id", user_id);
  } else {
    // Create new user with email
    const { data: created, error: createErr } = await supabase
      .from("users")
      .insert([{
        email: emailNorm,
        user_id: crypto.randomUUID()
      }])
      .select("user_id")
      .maybeSingle();

    if (createErr || !created?.user_id) {
      console.error("Supabase create error:", createErr);
      return res.status(500).json({ error: "Could not create user." });
    }
    effectiveUserId = created.user_id;
  } // 🔴 properly closed else block here

  // Rate limit
  const identifier = effectiveUserId || req.ip;
  const { success } = await ratelimit.limit(identifier);
  if (!success) {
    return res
      .status(429)
      .json({ error: "Too many requests. Try again in a minute." });
  }

  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    const baseUrl = getBaseUrl();
    const magicLink = `${baseUrl}/api/auth/verify?token=${token}`;

    // Clean old tokens
    await supabase.from("magic_tokens").delete().eq("email", emailNorm);

    // Insert new token
    const { error: insertError } = await supabase.from("magic_tokens").insert([
      {
        email: emailNorm,
        token,
        user_id: effectiveUserId,
        expires_at: expires.toISOString(),
        remember_me: !!rememberMe,
        used: false,
      },
    ]);
    if (insertError) {
      return res.status(500).json({ error: "Token insert failed." });
    }

    // Always trigger email send
    const { error: mailError } = await resend.emails.send({
      from: "noreply@thecv.pro",
      to: emailNorm,
      subject: "Your login link",
      html: `<p>Click <a href="${magicLink}">here</a> to log in. Link expires in 15 minutes.</p>`,
    });
    if (mailError) {
      return res.status(500).json({ error: "Email send failed." });
    }

    return res.status(200).json({
      success: true,
      message: "Login link sent successfully.",
    });
  } catch (e) {
    console.error("Magic link error:", e);
    return res.status(500).json({ error: "Internal error." });
  }
}
