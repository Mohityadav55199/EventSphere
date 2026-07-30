import { motion } from "framer-motion";

export default function About() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-black via-blue-800 to-black py-12 px-6">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto text-center"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-yellow-300 mb-4 shadow-sm p-2">
          About <span className="text-green-500">EventSphere</span>
        </h1>
        <p className="text-lg text-gray-400">
          EventSphere is your one-stop platform to book, explore, and manage events with ease. 
          Whether you are an attendee looking for an unforgettable experience or an organizer 
          aiming to maximize impact, EventSphere brings innovation, security, and community 
          together in one place.
        </p>
      </motion.div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto mt-12 grid md:grid-cols-2 gap-8">
        {/* Card 1 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-black/50 shadow-md rounded-2xl p-6 hover:shadow-xl border border-slate-50"
        >
          <h2 className="text-2xl font-semibold text-purple-600 mb-2">🔒 Secure Payments & Rewards</h2>
          <p className="text-gray-600">
            Integrated with <b>Stripe</b> for safe and reliable transactions. Every booking rewards you with
            <b> Wallet Points</b>, ensuring cashback and exclusive benefits every time.
          </p>
        </motion.div>

        {/* Card 2 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-black/50 shadow-md rounded-2xl p-6 hover:shadow-xl border border-slate-50"
        >
          <h2 className="text-2xl font-semibold text-purple-600 mb-2">💬 Real-Time Event Chat Rooms</h2>
          <p className="text-gray-600">
            Join event-specific chat rooms powered by <b>WebSockets</b>. Interact live, share experiences, and build 
            connections with fellow attendees to make every event more engaging.
          </p>
        </motion.div>

        {/* Card 3 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-black/50 shadow-md rounded-2xl p-6 hover:shadow-xl border border-slate-50"
        >
          <h2 className="text-2xl font-semibold text-purple-600 mb-2 ">🕒 24/7 Assistance</h2>
          <p className="text-gray-600">
            Never feel lost with our round-the-clock support. EventSphere ensures seamless experiences 
            for both attendees and organizers with responsive help always available.
          </p>
        </motion.div>

        {/* Card 4 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-black/50 shadow-md rounded-2xl p-6 hover:shadow-xl border border-slate-50"
        >
          <h2 className="text-2xl font-semibold text-purple-600 mb-2">⭐ Reviews & Ratings</h2>
          <p className="text-gray-600">
            Built-in reviews and ratings let the community share real-time feedback. Discover the 
            <b> Trending Events</b> section powered by audience insights to never miss out on top experiences.
          </p>
        </motion.div>

        {/* Card 5 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-black/50 shadow-md rounded-2xl p-6 hover:shadow-xl border border-slate-50"
        >
          <h2 className="text-2xl font-semibold text-purple-600 mb-2">💰 Wallet Rewards Ecosystem</h2>
          <p className="text-gray-600">
            Earn loyalty rewards, enjoy seamless wallet integration, and redeem exclusive cashback deals.
            EventSphere ensures you always get more than what you pay for.
          </p>
        </motion.div>

        {/* Card 6 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-black/50 shadow-md rounded-2xl p-6 hover:shadow-xl border border-slate-50"
        >
          <h2 className="text-2xl font-semibold  text-purple-600 mb-2">📊 Organizer Analytics Dashboard</h2>
          <p className="text-gray-600">
            Track ticket sales, monitor audience engagement, and measure overall <b>event performance </b> 
            with our data visualization-powered analytics dashboard.
          </p>
        </motion.div>
      </div>

      {/* Closing Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl mx-auto text-center mt-16"
      >
        <h2 className="text-3xl font-bold text-yellow-300 mb-4">Why EventSphere?</h2>
        <p className="text-lg text-gray-400">
          Because events are more than just gatherings — they are experiences. EventSphere makes these experiences
          smoother, more rewarding, and deeply engaging for everyone involved.
        </p>
      </motion.div>
    </div>
  );
}
