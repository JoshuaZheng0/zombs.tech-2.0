Develop Client: npm run dev:client (or just npm run dev)
Develop Server: npm run watch:server:build
Develop Server: npm run watch:server:run
Secure tunnel forwarding: ngrok http 3000
Build Client: npm run build:client
Build Server: npm run build:server
Run Production Server: npm run start:server (after building)
Deploy to Vercel: Connect your Git repository to Vercel. It should now automatically pick up vercel.json and build/deploy only the client using npm run build:client.