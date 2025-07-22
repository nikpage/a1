export default function handler(req, res) {
  res.json({
    clientId: process.env.AUTH0_CLIENT_ID,
    baseUrl: process.env.AUTH0_BASE_URL
  });
}
