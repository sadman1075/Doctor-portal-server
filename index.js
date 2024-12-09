const express = require('express')
const cors = require('cors')
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_key)


//middleware
app.use(cors())
app.use(express.json())





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.62b40ek.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        const appointmentcollection = client.db('doctorsportal').collection('appointmentoption');
        const bookingscollection = client.db('doctorsportal').collection('bookings')
        const userscollection = client.db('doctorsportal').collection('users')
        const doctorscollection = client.db('doctorsportal').collection('doctors')
        const paymentscollection = client.db('doctorsportal').collection('payments')
        const contactcollection = client.db('doctorsportal').collection('contact')

        app.get('/bookings', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const bookings = await bookingscollection.find(query).toArray();
            res.send(bookings)

        });

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            
            const query = {
                AppointmentDate: booking.AppointmentDate,
                treatment: booking.treatment,
                email: booking.email,
            }
            const count = await bookingscollection.find(query).toArray()
            if (count.length) {
                const message = `You have already booking on ${booking.AppointmentDate}`
                return res.send({ acknowledged: false, message })
            }
            const result = await bookingscollection.insertOne(booking)
            res.send(result)
        });

       

        //use aggregate to query multiple collection and then merge data
        app.get('/appointmentoptions', async (req, res) => {
            const date = req.query.date;
            const query = {}
            const results = await appointmentcollection.find(query).toArray();
            const bookingQuery = { AppointmentDate: date }
            const alreadybook = await bookingscollection.find(bookingQuery).toArray();
            results.forEach(result => {
                const optionBooked = alreadybook.filter(book => book.treatment === result.name);
                const bookedslots = optionBooked.map(book => book.slot)
                const remainingsolots = result.slots.filter(slot => !bookedslots.includes(slot))
                // console.log(result.name,bookedslots)
                result.slots = remainingsolots;
            })
            res.send(results)
        });

        // app.get('/addprice', async (req, res) => {
        //     const filter = {}
        //     const options = { upsert: true }
        //     const updateDoc = {
        //         $set: {
        //             price: 99

        //         }
        //     }
        //     const result=await appointmentcollection.updateMany(filter,updateDoc,options)
        //     res.send(result)
        // });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userscollection.insertOne(user);
            res.send(result)
        });

        app.put('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    role: 'admin',
                }
            }
            const updateResult = await userscollection.updateOne(filter, updateDoc, options);
            res.send(updateResult)
        });

        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email }
            const user = await userscollection.findOne(query)
            res.send({ isAdmin: user?.role == 'admin' });
        })

        app.get('/users', async (req, res) => {
            const query = {}
            const result = await userscollection.find(query).toArray();
            res.send(result)
        });

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await userscollection.deleteOne(filter)
            res.send(result)
        });

        app.get('/appointmentspecialty', async (req, res) => {
            const query = {}
            const result = await appointmentcollection.find(query).project({ name: 1 }).toArray();
            res.send(result)

        });

        app.post('/doctors', async (req, res) => {
            const doctor = req.body;
            const result = await doctorscollection.insertOne(doctor)
            res.send(result);
        });


        app.get('/doctors', async (req, res) => {
            const query = {}
            const result = await doctorscollection.find(query).toArray();
            res.send(result)
        });

        app.delete('/doctors/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await doctorscollection.deleteOne(filter)
            res.send(result)
        });

        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const booking = await bookingscollection.findOne(query)
            res.send(booking)

        });

        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: "usd",
                amount: amount,
                "payment_method_types": [
                    "card"]

            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        });

        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const result = await paymentscollection.insertOne(payment)
            const id = payment.bookingId
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    paid: true
                }
            }
            const updateResult = await bookingscollection.updateOne(filter, updateDoc)
            res.send(result)

        });

        //admin view client side

        app.get('/allbookings', async (req, res) => {
            const query = {}
            const result = await bookingscollection.find(query).toArray()
            res.send(result)
        });

        app.get('/allpayments',async(req,res)=>{
            const query={}
            const result=await paymentscollection.find(query).toArray()
            res.send(result)
        });

        app.post('/contact',async(req,res)=>{
            const query=req.body;
            const result=await contactcollection.insertOne(query)
            res.send(result)
        });









    }
    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('doctors api')
})

app.listen(port)