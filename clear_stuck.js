import mongoose from 'mongoose';
import Commit from './models/Commit.js';

mongoose.connect('mongodb://jsaini8378_db_user:p1KkZ6obQ7lcnjVd@ac-a6qhcgu-shard-00-00.om4hrfl.mongodb.net:27017,ac-a6qhcgu-shard-00-01.om4hrfl.mongodb.net:27017,ac-a6qhcgu-shard-00-02.om4hrfl.mongodb.net:27017/?ssl=true&replicaSet=atlas-8xd4dx-shard-0&authSource=admin&appName=Cluster0')
.then(async () => {
  const res = await Commit.updateMany(
    { aiStatus: 'pending' },
    { 
      $set: { 
        aiStatus: 'failed', 
        aiMessage: 'Server was restarted before AI could finish.',
        impactSummary: 'Analysis aborted by server restart.'
      } 
    }
  );
  console.log('Reset stuck commits to failed:', res.modifiedCount);
  process.exit();
}).catch(console.error);
