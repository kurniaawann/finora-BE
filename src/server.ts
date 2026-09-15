import  app  from "./app.js";
import { env } from "./config/env.js";
import {prisma} from "./config/database.js";

const startServer = async ()=> {
    try {
        await prisma.$connect();
        app.listen(env.port, ()=> {
            console.log(`Finora API running on http://localhost:${env.port}`);
        })
    } catch (error) {
        console.error(`Failed to start server`, error)
        await prisma.$disconnect();
        process.exit(1);
    }
}

startServer();