// api/cvdata.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = 'cvreview';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  let raw = '';
  req.on('data', chunk => raw += chunk);
  req.on('end', async () => {
    try {
      const { cvMetadataId, sections } = JSON.parse(raw);
      if (!cvMetadataId || !sections) {
        res.statusCode = 400;
        return res.end('Missing fields');
      }

      if (!client.topology?.isConnected()) await client.connect();
      const db = client.db(dbName);

      const result = await db.collection('cvdata').insertOne({
        cvMetadataId,
        sections,
        updatedAt: new Date()
      });

      res.statusCode = 201;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (err) {
      res.statusCode = 500;
      res.end('Server error: ' + err.message);
    }
  });
};
