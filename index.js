const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const e = require('express');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);



const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vep38nb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send('Unauthorized Access')
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden Access' })
    }
    req.decoded = decoded;
    next();
  })
};


async function run() {
  try {
    const categoriesCollection = client.db('mobileGarage').collection('categories');
    const productsCollection = client.db('mobileGarage').collection('products');
    const bookingsCollection = client.db('mobileGarage').collection('bookings');
    const usersCollection = client.db('mobileGarage').collection('users');
    const paymentsCollection = client.db('mobileGarage').collection('payments');


    // products Categories
    app.get('/categories', async (req, res) => {
      const query = {};
      const result = await categoriesCollection.find(query).toArray();
      res.send(result)
    });

    //Add Product API
    app.post('/categories', async (req, res) => {
      const query = req.body;
      const products = await productsCollection.insertOne(query);
      res.send(products);
    })

    app.get('/category/:id', async (req, res) => {
      const id = req.params.id;
      const query = { categories_id: id };
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });

    //query with email for spacapic product 
    app.get('/products', async (req, res) => {
      let query = {};
      console.log(req.query.email);
      if (req.query.email) {
        query = {
          "author.email": req.query.email
        }
      }
      console.log(query);
      const cursor = await productsCollection.find(query).toArray();
      res.send(cursor)
    });

    //booking products
    app.get('/bookings', verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: 'Forbidden Access' })
      }
      const query = { email: email };
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    //for single booking id
    app.get('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
    })

    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    //JWT token API
    app.get('/jwt', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
        return res.send({ accessToken: token })
      }
      res.status(403).send({ accessToken: '' })
    });

    //Payment intent API 
    app.post('/create-payment-intent', async (req, res) => {
      const booking = req.body;
      const sellingPrice = booking.sellingPrice;
      const amount = sellingPrice * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        "payment_method_types": [
          "card"
        ]
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //store Payment 
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.bookingId;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const updateResult = await bookingsCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })

    //All users
    app.get('/users', async (req, res) => {
      let query = {}
      if (req.query.person) {
        query = { role: req.query.person };
      };
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    //user verify for admin 
    app.get('/users/isVerified', async (req, res) => {
      const query = { email: req.query.email };
      const user = await usersCollection.findOne(query);
      res.send(user?.verify || false);
    });


    //for spacapic seller check API
    app.get('/users/seller/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.role === 'seller' });
    });

    //verify seller API
    app.put('/users/:email', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query1 = { email: decodedEmail };
      const user1 = await usersCollection.findOne(query1);

      if (user1?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden Access' })
      }

      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      const updatedDoc = {
        $set: {
          verify: true
        }
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //for advertisement API
    app.put('/products/:id', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query1 = { email: decodedEmail };
      const user1 = await usersCollection.findOne(query1);

      if (user1?.role !== 'seller') {
        return res.status(403).send({ message: 'Forbidden Access' })
      };

      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          advertise: true
        }
      };
      const result = await productsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //To get All advertisement API
    app.get('/products/advertise', async (req, res) => {
      const query = { advertise: true };
      const product = await productsCollection.find(query).toArray();
      res.send(product)
    })

    //for spacapic user admin check API
    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.role === 'admin' });
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Make ADMIN API
    app.put('/users/admin/:id', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);

      if (user?.role !== 'admin') {
        return res.status(403).send({ message: 'Forbidden Access' });
      }

      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const option = { upsert: true };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc, option);
      res.send(result)
    });

    // delete API for all users
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(filter);
      res.send(result);
    })

  }
  finally {

  }
}
run().catch(console.log)



app.get('/', async (req, res) => {
  res.send('Mobile Garage server is running.')
});

app.listen(port, () => console.log(`Mobile Garage Running On ${port}`))