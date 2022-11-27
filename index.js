const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vep38nb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, nest) {
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
    nest();
  })
};


async function run() {
  try {
    const categoriesCollection = client.db('mobileGarage').collection('categories');
    const productsCollection = client.db('mobileGarage').collection('products');
    const bookingsCollection = client.db('mobileGarage').collection('bookings');
    const usersCollection = client.db('mobileGarage').collection('users');

    // products Categories
    app.get('/categories', async (req, res) => {
      const query = {};
      const result = await categoriesCollection.find(query).toArray();
      res.send(result)
    });

    app.get('/category/:id', async (req, res) => {
      const id = req.params.id;
      const query = { categories_id: id };
      const products = await productsCollection.find(query).toArray();
      res.send(products);
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

    //All users
    app.get('/users', async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    //for spacapic user admin check
    app.get('/users/admin/:id', async (req, res) => {
      const id = res.params.id;
      const query = { _id: ObjectId(id) };
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

  }
  finally {

  }
}
run().catch(console.log)



app.get('/', async (req, res) => {
  res.send('Mobile Garage server is running.')
});

app.listen(port, () => console.log(`Mobile Garage Running On ${port}`))