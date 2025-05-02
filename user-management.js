// Core Initialization
export const supabase = supabase.createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

export const stripe = Stripe(process.env.STRIPE_KEY);

// Shared Utilities
export function showLoading(message) {
    document.getElementById('loading-message').textContent = message;
    document.getElementById('loading-overlay').style.display = 'flex';
}

export function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}
import { supabase } from './app-core.js';

// User State
let currentUser = null;
let isLoggedIn = false;
let isAdmin = false;

// Auth Functions
export async function handleAuth(email, password, isLoginMode) {
    try {
        const { data, error } = isLoginMode
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });

        if (error) throw error;

        currentUser = data.user;
        isLoggedIn = true;
        isAdmin = currentUser.email.endsWith('@admin.com');

        return { success: true, isAdmin };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Token Management
export async function purchaseTokens(tokenAmount) {
    const { error } = await supabase
        .from('user_tokens')
        .upsert({
            user_id: currentUser.id,
            balance: tokenAmount,
            last_purchase: new Date()
        });

    if (error) throw new Error('Token purchase failed');
}

// User Data
export async function loadUserData() {
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    return data;
}
import { stripe } from './app-core.js';
import { currentUser } from './user-management.js';

// Payment Handling
export async function processPayment(amount, tokenCount) {
    const paymentIntent = await stripe.confirmCardPayment(
        await createPaymentIntent(amount),
        { payment_method: { card: elements.getElement('card') }}
    );

    if (paymentIntent.error) throw paymentIntent.error;

    await recordTransaction(
        currentUser.id,
        amount,
        tokenCount,
        paymentIntent.id
    );
}

// Database Records
async function recordTransaction(userId, amount, tokens, stripeId) {
    await supabase.from('transactions').insert({
        user_id: userId,
        amount,
        tokens,
        stripe_id: stripeId,
        status: 'completed'
    });
}
import { supabase } from './app-core.js';

// Admin Functions
export async function fetchDashboardStats() {
    const { count: users } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' });

    const { data: revenue } = await supabase
        .from('transactions')
        .select('sum(amount)');

    return { users, revenue: revenue[0].sum };
}

export async function fetchRecentActivity() {
    const { data } = await supabase
        .from('transactions')
        .select(`
            id,
            amount,
            created_at,
            profiles(email)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

    return data;
}
