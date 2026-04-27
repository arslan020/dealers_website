const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/motordesk');
        const vehiclesCol = mongoose.connection.collection('vehicles');
        
        const vehicles = await vehiclesCol.find({}, { projection: { make: 1, model: 1, stockId: 1, vrm: 1 } }).toArray();
        console.log(`Vehicles count: ${vehicles.length}`);
        vehicles.forEach(v => {
            console.log(`- ${v.vrm || 'No VRM'} | ${v.make} ${v.model} | stockId: ${v.stockId || 'MISSING'}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
