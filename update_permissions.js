require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    // Update all users
    const result = await mongoose.connection.collection('users').updateMany(
        {}, 
        { 
            $set: { 
                "permissions.canLookupAutoTrader": true,
                "permissions.canPublishAutoTrader": true,
                "permissions.canViewValuations": true,
                "permissions.canManageMessages": true,
            } 
        }
    );
    
    console.log(`Updated ${result.modifiedCount} users to have all AutoTrader permissions.`);
    process.exit(0);
}

run().catch(console.error);
