import Event from "../models/event.model.js";
import User from "../models/user.model.js";

export const autoSeedEventsIfEmpty = async () => {
    try {
        const count = await Event.countDocuments();
        if (count > 0) return;

        console.log("No events found in DB. Auto-seeding 10 demo events with Tiered Ticket Passes & Rupee (₹) pricing...");

        let organizer = await User.findOne({ email: "organizer@eventease.com" });
        if (!organizer) {
            organizer = await User.create({
                name: "Demo Organizer",
                email: "organizer@eventease.com",
                password: "password123",
                role: "organizer",
                walletPoints: 1000
            });
        }

        const demoEvents = [
            {
                title: "Neon Pulse Music Festival 2026",
                description: "Experience an unbelievable night of electronic beats, neon visual spectacles, and world-renowned DJs performing live under the open sky.",
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                location: "Grand Arena Ground, Downtown City",
                locationGoogleMapLink: "https://maps.google.com/?q=Grand+Arena+Ground",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1000&q=80",
                Price: 499,
                ticketTypes: [
                    { name: "Early Bird Pass", price: 399, description: "Discounted entry for early adopters" },
                    { name: "Standard Pass", price: 499, description: "General venue admission" },
                    { name: "VIP Lounge Pass", price: 999, description: "Front stage access & complimentary drinks" }
                ],
                category: "Music",
                capacity: 500,
                activeStatus: "active",
                avgRating: 4.8
            },
            {
                title: "AI & Future Tech Summit 2026",
                description: "Join industry leaders, visionaries, and researchers to explore cutting-edge developments in Artificial Intelligence, Neural Networks, and Robotics.",
                date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                location: "Innovation Hub & Convention Center, Tech Park",
                locationGoogleMapLink: "https://maps.google.com/?q=Innovation+Hub+Convention+Center",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80",
                Price: 999,
                ticketTypes: [
                    { name: "Standard Pass", price: 999, description: "Keynote & main hall access" },
                    { name: "Executive VIP Pass", price: 1999, description: "Networking dinner & speaker lounge" }
                ],
                category: "Workshop",
                capacity: 300,
                activeStatus: "active",
                avgRating: 4.9
            },
            {
                title: "Blockbuster Movie Premiere Night",
                description: "Be the first to watch the summer's most anticipated sci-fi thriller on IMAX 3D with exclusive director Q&A and red carpet access.",
                date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                location: "CineMax Grand Theater, Westside Mall",
                locationGoogleMapLink: "https://maps.google.com/?q=CineMax+Grand+Theater",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1000&q=80",
                Price: 250,
                ticketTypes: [
                    { name: "Standard IMAX Seat", price: 250, description: "Standard IMAX 3D entry" },
                    { name: "Recliner VIP Seat", price: 450, description: "Plush recliner with popcorn combo" }
                ],
                category: "Movie",
                capacity: 200,
                activeStatus: "active",
                avgRating: 4.7
            },
            {
                title: "Championship Basketball Finals",
                description: "Witness the ultimate sports showdown live as top teams clash in an intense battle for the championship trophy.",
                date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                location: "National Sports Complex Stadium",
                locationGoogleMapLink: "https://maps.google.com/?q=National+Sports+Complex",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1000&q=80",
                Price: 650,
                ticketTypes: [
                    { name: "Galleria Seat", price: 650, description: "Upper deck seating" },
                    { name: "Courtside VIP Seat", price: 1499, description: "Direct courtside row 1 seating" }
                ],
                category: "Sports",
                capacity: 1000,
                activeStatus: "active",
                avgRating: 4.9
            },
            {
                title: "Gourmet Culinary & Artisan Wine Masterclass",
                description: "Indulge in a fine dining masterclass guided by Michelin-starred chefs, complete with artisanal cheese and wine pairings.",
                date: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
                location: "Skyline Lounge Pavilion",
                locationGoogleMapLink: "https://maps.google.com/?q=Skyline+Lounge",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80",
                Price: 1200,
                ticketTypes: [
                    { name: "Masterclass Pass", price: 1200, description: "Live tasting & cooking workshop" }
                ],
                category: "Workshop",
                capacity: 80,
                activeStatus: "active",
                avgRating: 5.0
            },
            {
                title: "Acoustic Unplugged Night",
                description: "An intimate evening of soulful indie acoustic melodies, hot beverage bars, and cozy campfire vibes.",
                date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                location: "Lakeside Amphitheater Park",
                locationGoogleMapLink: "https://maps.google.com/?q=Lakeside+Amphitheater",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1000&q=80",
                Price: 199,
                ticketTypes: [
                    { name: "General Admission", price: 199, description: "Campfire lawn entry" }
                ],
                category: "Music",
                capacity: 150,
                activeStatus: "active",
                avgRating: 4.6
            },
            {
                title: "International Gaming & Esports Championship",
                description: "Cheer for top professional esports teams battling live in Valorant, League of Legends, and Counter-Strike for a ₹5,00,000 prize pool.",
                date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
                location: "CyberDome Gaming Arena",
                locationGoogleMapLink: "https://maps.google.com/?q=CyberDome+Gaming+Arena",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1000&q=80",
                Price: 350,
                ticketTypes: [
                    { name: "Gamer Pass", price: 350, description: "Arena seating" },
                    { name: "Pro VIP Gamer Pass", price: 799, description: "Meet & greet + goodie bag" }
                ],
                category: "Sports",
                capacity: 800,
                activeStatus: "active",
                avgRating: 4.9
            },
            {
                title: "Modern Art & 3D Generative Exhibition",
                description: "Immerse yourself in interactive digital installations, 3D projection mapping, and contemporary generative art galleries.",
                date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
                location: "Metropolitan Museum of Fine Arts",
                locationGoogleMapLink: "https://maps.google.com/?q=Metropolitan+Museum",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1000&q=80",
                Price: 149,
                ticketTypes: [
                    { name: "Gallery Day Pass", price: 149, description: "Access to all exhibit halls" }
                ],
                category: "Workshop",
                capacity: 250,
                activeStatus: "active",
                avgRating: 4.8
            },
            {
                title: "Stand-Up Comedy All-Stars Gala",
                description: "Get ready for non-stop laughter with a star-studded lineup of celebrity comedians performing brand new live material.",
                date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
                location: "The Laugh Factory Comedy Club",
                locationGoogleMapLink: "https://maps.google.com/?q=Laugh+Factory+Comedy+Club",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1000&q=80",
                Price: 299,
                ticketTypes: [
                    { name: "Laughter Pass", price: 299, description: "Standard club seating" },
                    { name: "Front Row VIP", price: 599, description: "Front row seating + drink voucher" }
                ],
                category: "Movie",
                capacity: 180,
                activeStatus: "active",
                avgRating: 4.9
            },
            {
                title: "Global Startup Pitch & Founder Networking Night",
                description: "Connect with venture capitalists, angel investors, and innovative founders over drinks and pitch showcases.",
                date: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
                location: "Venture Tower Grand Ballroom",
                locationGoogleMapLink: "https://maps.google.com/?q=Venture+Tower",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1000&q=80",
                Price: 750,
                ticketTypes: [
                    { name: "Founder Pass", price: 750, description: "Networking & pitch lounge entry" }
                ],
                category: "Workshop",
                capacity: 350,
                activeStatus: "active",
                avgRating: 5.0
            }
        ];

        await Event.insertMany(demoEvents);
        console.log("Auto-seeded 10 demo events with Tiered Passes & INR pricing successfully!");
    } catch (err) {
        console.error("Auto-seeding error:", err);
    }
};
