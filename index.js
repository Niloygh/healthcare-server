

const express = require('express');
const cors = require('cors');
const app = express()
require('dotenv').config()
const port = process.env.PORT || 5000

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');


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


const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));


const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization



  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized' })
  }

  const token = authHeader.split(" ")[1]
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized' })
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);

    // console.log('jwt token', payload)
    req.user = payload

    next();
  } catch (error) {
    console.log(error)
    return res.status(401).send({ message: 'Unauthorized access' })
  }
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const database = client.db("healthcare");
    const doctorCollection = database.collection("doctors");
    const paymentCollection = database.collection('payment')
    const appointmentCollection = database.collection('appointment')
    const reviewCollection = database.collection('review')
    const prescriptionCollection = database.collection('prescription')


    // payment post api
    app.post('/payment', async (req, res) => {
      const { amount, doctorId, doctorName, clientId, paymentDate, request, session_id, appointmentId } = req.body
      const isExistSession = await paymentCollection.findOne({ session_id })
      if (isExistSession) {
        return res.status(400).send({ message: "session already exist" })
      }
      const pay_result = await paymentCollection.insertOne({
        session_id,
        clientId,
        doctorId,
        doctorName,
        amount: Number(amount),
        request,
        paymentDate,
        appointmentId,
        paymentStatus: "success"
      })

      if (appointmentId) {
        await appointmentCollection.updateOne(
          { _id: new ObjectId(appointmentId) },
          { $set: { paymentStatus: true } }
        )
      }

      res.send({ pay_result })
    })

    // payment get api
    app.get('/all-payment/:clientId', async (req, res) => {
      const { clientId } = req.params;
      const query = { clientId: clientId }
      const result = await paymentCollection.find(query).toArray()
      // console.log(result)
      res.send(result)
    })



    app.get('/doctors', async (req, res) => {
      const result = await doctorCollection.find().toArray()

      res.send(result)
    })

    app.get('/limit-doctors', async (req, res) => {
      const result = await doctorCollection.find().limit(4).toArray()

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

    // doctor validation
    app.get('/doctors/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };

      const doctor = await doctorCollection.findOne(query);

      if (!doctor) {
        return res.status(404).send({ message: 'Doctor not found' });
      }

      res.send(doctor);
    });

    // schedule 
    app.patch('/doctors/schedule', async (req, res) => {
      const { email, date } = req.body;

      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      const filter = { email: email };

      const updateDoc = {
        $set: {
          date: date
        }
      }

      const result = await doctorCollection.updateOne(filter, updateDoc, { upsert: true });
      res.send(result);


    })

    app.get('/doctor/:doctorId', async (req, res) => {
      const { doctorId } = req.params
      const query = { _id: new ObjectId(doctorId) }
      const result = await doctorCollection.findOne(query)
      res.send(result)
    })



    // appointment post api
    app.post('/appointment', verifyToken, async (req, res) => {
      const { clientEmail, clientId, clientName, doctorId, doctorName, date, day, fee, symptoms, time, paymentStatus, } = req.body

      const existingAppointment = await appointmentCollection.findOne({
        clientId: clientId,
        doctorId: doctorId,
        appointmentComplete: false
      });



      if (existingAppointment) {
        return res.status(400).send({
          success: false,
          message: "You already have an active appointment with this doctor."
        });
      }


      const appointment_result = await appointmentCollection.insertOne({
        clientId,
        clientEmail,
        clientName,
        doctorId,
        doctorName,
        date,
        day,
        fee: Number(fee),
        symptoms,
        time,
        appointmentStatus: 'pending',
        appointmentComplete: false,
        paymentStatus,
      })
      res.send({
        success: true,
        appointment_result
      })
    })

    // appointment get api 
    app.get('/appointment/:clientEmail', async (req, res) => {
      const { clientEmail } = req.params
      const query = { clientEmail: clientEmail }
      const result = await appointmentCollection.find(query).toArray()
      res.send(result)
    })

    // appointment delete api 
    app.delete('/appointment/:appointmentId', async (req, res) => {
      const { appointmentId } = req.params
      const query = { _id: new ObjectId(appointmentId) }
      const result = await appointmentCollection.deleteOne(query)
      res.send(result)
    })

    // appointment update api 
    app.patch('/appointment/:appointmentId', async (req, res) => {

      const appointmentId = req.params.appointmentId;
      const { date, time, day } = req.body;
      const filter = { _id: new ObjectId(appointmentId) };

      const updateDoc = {
        $set: {
          date,
          time,
          day
        },
      };

      const result = await appointmentCollection.updateOne(filter, updateDoc);
      res.send({ success: true, result });
    });



    // review post api 
    app.post('/review', async (req, res) => {
      const { clientId, clientEmail, doctorId, doctorName, specialty, rating, comment, publishedDate, image } = req.body

      const review_result = await reviewCollection.insertOne({
        clientId,
        clientEmail,
        doctorId,
        doctorName,
        specialty,
        rating: Number(rating),
        comment,
        publishedDate,
        image
      })

      res.send({ success: true, review_result })

    })

    // review get api 
    app.get('/review/:clientId', async (req, res) => {
      const { clientId } = req.params
      const query = { clientId: clientId }
      const result = await reviewCollection.find(query).toArray()
      res.send(result)
    })

    // review delete api 
    app.delete('/review/:reviewId', async (req, res) => {
      const { reviewId } = req.params
      const query = { _id: new ObjectId(reviewId) }
      const result = await reviewCollection.deleteOne(query)
      res.send(result)
    })

    app.patch('/reviewEdit/:reviewId', async (req, res) => {
      const { reviewId } = req.params
      const { comment, rating } = req.params
      const filter = { _id: new ObjectId(reviewId) };


      const updateDoc = {
        $set: {
          comment,
          rating,
          publishedDate: new Date()
        }
      }


    })


    // patient dashboard get api 
    app.get('/patient/dashboard/:clientId', async (req, res) => {

      const { clientId } = req.params;
      const query = { clientId: clientId };

      const reviewResult = await reviewCollection.find(query).toArray();
      const paymentResult = await paymentCollection.find(query).toArray();
      const appointmentResult = await appointmentCollection.find(query).toArray();

      const totalTransactionsAmount = paymentResult.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

      const upcomingConsultations = appointmentResult.filter(app => !app.appointmentComplete);


      const historiesCount = appointmentResult.filter(app => app.appointmentComplete).length;

      res.send({
        upcomingClinicsCount: upcomingConsultations.length,
        historiesCount: historiesCount,
        totalTransactionsAmount: totalTransactionsAmount,
        reviewsCount: reviewResult.length,
        consultations: upcomingConsultations
      });

    });



    // doctor all api 
    app.get('/doctor/all-appointment/:doctorId', async (req, res) => {
      const { doctorId } = req.params;
      const query = { doctorId: doctorId };
      const result = await appointmentCollection.find(query).toArray();
      // console.log(result)
      res.send(result)
    })

    // Update appointment status (accept/reject)
    app.patch('/appointment/status/:appointmentId', async (req, res) => {
      const { appointmentId } = req.params;
      const { appointmentStatus } = req.body;

      const filter = { _id: new ObjectId(appointmentId) };
      const updateDoc = {
        $set: {
          appointmentStatus: appointmentStatus
        }
      };

      const result = await appointmentCollection.updateOne(filter, updateDoc);

      if (result.modifiedCount > 0) {
        res.send({ success: true, message: 'Status updated successfully', result });
      } else {
        res.status(400).send({ success: false, message: 'Failed to update status' });
      }

    });


    // prescribe post api 
    // Prescription POST & Complete Appointment API
    app.post('/appointment/prescribe/', async (req, res) => {
      const { doctorId, doctorName, clientId, clientName, appointmentId, diagnosis, medications, advisoryNotes } = req.body;

      const filter = { _id: new ObjectId(appointmentId) };

      const updateAppointment = {
        $set: {
          appointmentComplete: true,
        }
      }

      const prescriptionResult = await prescriptionCollection.insertOne({
        doctorId,
        doctorName,
        clientId,
        clientName,
        appointmentId,
        diagnosis,
        medications,
        advisoryNotes,
      })

      const appointmentResult = await appointmentCollection.updateOne(filter, updateAppointment);

      res.send({ success: true, message: 'Prescription issued successfully', appointmentResult, prescriptionResult });
      

      // const updateDoc = {
      //     $set: {
      //         appointmentComplete: true,
      //         prescription: {
      //             diagnosis,
      //             medications,
      //             advisoryNotes,
      //             createdAt: new Date()
      //         }
      //     }
      // };

      // const result = await appointmentCollection.updateOne(filter, updateDoc);
      // res.send({ success: true, message: 'Prescription issued successfully', result });
    });




    // .toISOString()





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