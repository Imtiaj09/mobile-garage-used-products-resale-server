const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

//middleware
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vep38nb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try {
    const categoriesCollection = client.db('mobileGarage').collection('categories')
    const usersCollection = client.db('mobileGarage').collection('users')
    const productsCollection = client.db('mobileGarage').collection('products')

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
    })


    app.post('/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
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