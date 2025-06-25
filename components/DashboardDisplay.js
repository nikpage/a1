export default function DashboardDisplay({ userId }) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Dashboard</h2>
      <p>Welcome back, user {userId}.</p>
      <p>Your token purchase was successful.</p>
      {/* Add token count, recent downloads, etc. here later */}
    </div>
  );
}
