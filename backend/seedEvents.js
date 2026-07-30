import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/user.model.js";
import Event from "./models/event.model.js";
import { DB_NAME } from "./constant.js";

dotenv.config({ path: "./.env" });

const seedDatabase = async () => {
    try {
        const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://localhost:27017";
        let mongoUri = rawUri;
        if (!rawUri.includes(`/${DB_NAME}`)) {
            mongoUri = rawUri.includes("?") ? rawUri.replace("?", `/${DB_NAME}?`) : `${rawUri.replace(/\/$/, "")}/${DB_NAME}`;
        }
        console.log(`Connecting to MongoDB at ${mongoUri}...`);
        try {
            await mongoose.connect(mongoUri);
            console.log("MongoDB Connected Successfully!");
        } catch (err) {
            console.warn(`Atlas connection failed (${err.message}). Connecting to local MongoDB...`);
            await mongoose.connect(`mongodb://localhost:27017/${DB_NAME}`);
            console.log("Connected to Local MongoDB Successfully!");
        }

        // Find or create a demo organizer user
        let organizer = await User.findOne({ email: "organizer@eventease.com" });
        if (!organizer) {
            organizer = await User.create({
                name: "Demo Organizer",
                email: "organizer@eventease.com",
                password: "password123", // Pre-save hook will hash this
                role: "organizer",
                walletPoints: 1000
            });
            console.log("Created Demo Organizer:", organizer._id);
        } else {
            console.log("Found Existing Organizer:", organizer._id);
        }

        // Demo events data
        const demoEvents = [
            {
                title: "Neon Pulse Music Festival 2026",
                description: "Experience an unbelievable night of electronic beats, neon visual spectacles, and world-renowned DJs performing live under the open sky.",
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
                location: "Grand Arena Ground, Downtown City",
                locationGoogleMapLink: "https://maps.google.com/?q=Grand+Arena+Ground",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1000&q=80",
                Price: 49,
                category: "Music",
                capacity: 500,
                activeStatus: "active",
                avgRating: 4.8
            },
            {
                title: "AI & Future Tech Summit 2026",
                description: "Join industry leaders, visionaries, and researchers to explore cutting-edge developments in Artificial Intelligence, Neural Networks, and Robotics.",
                date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
                location: "Innovation Hub & Convention Center, Tech Park",
                locationGoogleMapLink: "https://maps.google.com/?q=Innovation+Hub+Convention+Center",
                organizer: organizer._id,
                image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=80",
                Price: 99,
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
                Price: 25,
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
                Price: 65,
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
                Price: 120,
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
                Price: 20,
                category: "Music",
                capacity: 150,
                activeStatus: "active",
                avgRating: 4.6
            }
        ];

        // Clear existing demo events or add new ones
        await Event.deleteMany({ title: { $in: demoEvents.map(e => e.title) } });
        const insertedEvents = await Event.insertMany(demoEvents);

        console.log(`Successfully seeded ${insertedEvents.length} demo events!`);
        process.exit(0);
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    }
};

seedDatabase();
