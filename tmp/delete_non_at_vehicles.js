const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/motordesk');
        console.log('Connected to DB');
        
        const query = { 
            $or: [
                { stockId: { $exists: false } },
                { stockId: null },
                { stockId: "" }
            ]
        };
        
        const vehiclesCol = mongoose.connection.collection('vehicles');
        
        const totalVehicles = await vehiclesCol.countDocuments({});
        console.log(`Total vehicles in DB: ${totalVehicles}`);

        const countToDelete = await vehiclesCol.countDocuments(query);
        console.log(`Found ${countToDelete} non-AutoTrader vehicles to delete.`);
        
        if (countToDelete > 0) {
            const result = await vehiclesCol.deleteMany(query);
            console.log(`Successfully deleted ${result.deletedCount} non-AutoTrader vehicles.`);
        } else {
            console.log('No vehicles to delete.');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from DB');
    }
}

run();
