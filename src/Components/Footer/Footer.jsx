import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="w-full bg-gradient-to-r from-black via-blue-800 to-black shadow-lg text-white py-8 ">
      <div className="max-w-7xl mx-auto  px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
        
        {/* Brand Info */}
        <div>
          <h2 className="text-2xl font-bold tracking-wide">
            Event<span className="text-yellow-300">Sphere</span>
          </h2>
          <p className="mt-3 text-sm text-gray-300">
            Your one-stop destination for discovering and managing events with ease.  
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-yellow-300">Quick Links</h3>
          <nav className="flex flex-col space-y-2">
            <Link to="/" className="hover:text-yellow-300 transition">Home</Link>
            <Link to="/events" className="hover:text-yellow-300 transition">Events</Link>
            <Link to="/about" className="hover:text-yellow-300 transition">About</Link>
            <Link to="/contact" className="hover:text-yellow-300 transition">Contact</Link>
          </nav>
        </div>

        {/* Social Media */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-yellow-300">Follow Us</h3>
          <div className="flex justify-center md:justify-start space-x-4">
            <a href="#" className="hover:text-yellow-300 transition">Facebook</a>
            <a href="#" className="hover:text-yellow-300 transition">Twitter</a>
            <a href="#" className="hover:text-yellow-300 transition">Instagram</a>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="mt-8 border-t border-gray-600 pt-4 text-center text-gray-400 text-sm">
        © {new Date().getFullYear()} EventSphere. All Rights Reserved.
      </div>
    </footer>
  );
}
