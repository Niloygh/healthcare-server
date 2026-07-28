

const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
const port = 5000

const { MongoClient, ServerApiVersion } = require('mongodb');


app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!')
})



const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("healthcare");
    const doctorCollection = database.collection("doctors");




    app.get('/doctors', async(req, res) =>{
      const result = await doctorCollection.find().toArray()
      
      res.send(result)
    })

    app.put('/doctors', async (req, res) => {
      const doctor = req.body;

      const filter = { email: doctor.email };

      const updateDoc = {
        $set: {
          ...doctor
        },
      };

      const options = { upsert: true };

      const result = await doctorCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });


app.get('/doctors/:email', async (req, res) => {
  const email = req.params.email;
    const query = { email: email };

    const doctor = await doctorCollection.findOne(query);

    if (!doctor) {
      return res.status(404).send({ message: 'Doctor not found' });
    }

    res.send(doctor);  
});
    

    

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})